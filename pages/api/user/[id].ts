import type { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    // クエリパラメータの受け取り (userIdは自分のID、idは相手のID)
    const { id: targetUserId, userId } = req.query as {
        id?: string;
        userId?: string; // 旧 selfSpotifyId の代わりに userId を使用
    };

    if (!targetUserId || !userId) {
        return res.status(400).json({ message: 'Missing targetUserId or userId.' });
    }

    try {
        // 1. 相手のプロフィールを取得
        const profileRes = await pool.query(
            'SELECT id, nickname, profile_image_url, bio FROM users WHERE id = $1',
            [targetUserId]
        );
        if (profileRes.rows.length === 0) {
            return res.status(404).json({ message: 'Target user not found.' });
        }
        
        // 2. 自分と相手の類似度を取得 (趣味タグ版)
        const query = `
            SELECT score, match_count, common_tags::text 
            FROM similarities 
            WHERE (user_a_id = $1 AND user_b_id = $2) 
               OR (user_a_id = $2 AND user_b_id = $1)
        `;
        const simRes = await pool.query(query, [userId, targetUserId]);
        
        // 3. フォロー状態を取得
        const followRes = await pool.query(
            `SELECT status, follower_id FROM follows
             WHERE (follower_id = $1 AND following_id = $2)
                OR (follower_id = $2 AND following_id = $1)`,
            [userId, targetUserId]
        );

        let follow_status: 'pending' | 'approved' | 'none' = 'none';
        let i_am_follower = false;
        if (followRes.rows.length > 0) {
            follow_status = followRes.rows[0].status;
            i_am_follower = (followRes.rows[0].follower_id === userId);
        }

        // 4. 【変更点】相手の趣味タグを取得 (user_hobbiesから)
        const hobbiesRes = await pool.query(
            `SELECT hobby_name FROM user_hobbies WHERE user_id = $1`,
            [targetUserId]
        );

        // 5. レスポンス
        res.status(200).json({
            profile: profileRes.rows[0],
            similarity: simRes.rows.length > 0 ? {
                score: simRes.rows[0].score,
                match_count: simRes.rows[0].match_count,
                common_tags: JSON.parse(simRes.rows[0].common_tags || '[]')
            } : null,
            follow_status,
            i_am_follower,
            hobbies: hobbiesRes.rows.map((r: any) => r.hobby_name) // 単純な文字列配列にする
        });

    } catch (dbError: any) {
        console.error('Failed to fetch user details:', dbError);
        res.status(500).json({ message: 'Database error occurred.' });
    }
}