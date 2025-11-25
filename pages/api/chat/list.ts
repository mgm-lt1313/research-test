import type { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../../lib/db';

// ユーザー情報を取得するヘルパー
async function getUserProfiles(userIds: string[]) {
    if (userIds.length === 0) return new Map();
    const usersRes = await pool.query(
        'SELECT id, nickname, profile_image_url FROM users WHERE id = ANY($1::uuid[])',
        [userIds]
    );
    return new Map(
        usersRes.rows.map(u => [u.id, { nickname: u.nickname, profile_image_url: u.profile_image_url }])
    );
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') return res.status(405).end();

    // クエリパラメータを userId に変更
    const { userId } = req.query;
    if (!userId || typeof userId !== 'string') {
        return res.status(400).json({ message: 'Missing userId.' });
    }

    try {
        // approved (マッチング成立) のペアを取得
        const approvedMatches = await pool.query(
            `SELECT
                f.id as match_id,
                CASE
                    WHEN f.follower_id = $1 THEN f.following_id
                    ELSE f.follower_id
                END as other_user_id
             FROM follows f
             WHERE (f.follower_id = $1 OR f.following_id = $1)
               AND f.status = 'approved'`,
            [userId]
        );

        const otherUserIds = approvedMatches.rows.map(r => r.other_user_id);
        
        // 相手のプロフィール情報を取得
        const profileMap = await getUserProfiles(otherUserIds);

        // 整形
        const matchesWithProfiles = approvedMatches.rows.map(match => ({
            match_id: match.match_id,
            other_user: {
                id: match.other_user_id,
                ...profileMap.get(match.other_user_id)
            }
        })).filter(m => m.other_user.nickname); // 削除済みユーザー等は除外

        res.status(200).json({ approvedMatches: matchesWithProfiles });

    } catch (dbError) {
        console.error('Failed to list chats:', dbError);
        res.status(500).json({ message: 'Database error while fetching chat lists.' });
    }
}