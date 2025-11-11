// pages/api/follow/list.ts
// (※ 既存の `pages/api/follow/list.ts` を以下の内容で置き換え)
import type { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../../lib/db';

async function getUserIdBySpotifyId(spotifyUserId: string): Promise<string | null> {
    const res = await pool.query('SELECT id FROM users WHERE spotify_user_id = $1', [spotifyUserId]);
    return res.rows.length > 0 ? res.rows[0].id : null;
}

// ユーザー情報を取得する共通関数
async function getUserProfiles(userIds: string[]) {
    if (userIds.length === 0) return new Map();
    const usersRes = await pool.query(
        'SELECT id, nickname, profile_image_url FROM users WHERE id = ANY($1::uuid[])',
        [userIds]
    );
    return new Map<string, { nickname: string, profile_image_url: string | null }>(
        usersRes.rows.map(u => [u.id, { nickname: u.nickname, profile_image_url: u.profile_image_url }])
    );
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') return res.status(405).end();
    const { spotifyUserId } = req.query;
    if (!spotifyUserId || typeof spotifyUserId !== 'string') {
        return res.status(400).json({ message: 'Missing spotifyUserId.' });
    }

    try {
        const selfId = await getUserIdBySpotifyId(spotifyUserId);
        if (!selfId) return res.status(404).json({ message: 'User not found.' });

        // 1. フォロワー一覧 (自分宛の pending リクエスト) [cite: 69]
        const followersRes = await pool.query(
            `SELECT id, follower_id as user_id FROM follows
             WHERE following_id = $1 AND status = 'pending'`,
            [selfId]
        );

        // 2. 承認待ち (自分発の pending リクエスト) [cite: 67]
        const pendingRes = await pool.query(
            `SELECT id, following_id as user_id FROM follows
             WHERE follower_id = $1 AND status = 'pending'`,
            [selfId]
        );

        // 3. フォロー一覧 (approved) [cite: 64]
        const matchesRes = await pool.query(
            `SELECT id, CASE WHEN follower_id = $1 THEN following_id ELSE follower_id END as user_id
             FROM follows
             WHERE (follower_id = $1 OR following_id = $1) AND status = 'approved'`,
            [selfId]
        );

        // 必要な全ユーザーIDを収集
        const allUserIds = [
            ...followersRes.rows.map(r => r.user_id),
            ...pendingRes.rows.map(r => r.user_id),
            ...matchesRes.rows.map(r => r.user_id)
        ];
        const userProfileMap = await getUserProfiles(allUserIds);

        // データを整形
        const pendingRequestsToMe = followersRes.rows.map(r => ({
            id: r.id,
            user_id: r.user_id,
            ...userProfileMap.get(r.user_id)
        })).filter(r => r.nickname); // プロフ未取得は除外

        const pendingRequestsFromMe = pendingRes.rows.map(r => ({
            id: r.id,
            user_id: r.user_id,
            ...userProfileMap.get(r.user_id)
        })).filter(r => r.nickname);

        const approvedMatches = matchesRes.rows.map(r => ({
            id: r.id, // match_id (チャットルームID)
            user_id: r.user_id,
            ...userProfileMap.get(r.user_id)
        })).filter(r => r.nickname);

        res.status(200).json({
            pendingRequestsToMe,
            pendingRequestsFromMe,
            approvedMatches
        });

    } catch (dbError: unknown) {
        console.error('Failed to list follows:', dbError);
        res.status(500).json({ message: 'Database error while fetching lists.' });
    }
}