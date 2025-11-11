// pages/api/follow/unfollow.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../../lib/db';

async function getUserIdBySpotifyId(spotifyUserId: string): Promise<string | null> {
    const res = await pool.query('SELECT id FROM users WHERE spotify_user_id = $1', [spotifyUserId]);
    return res.rows.length > 0 ? res.rows[0].id : null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const { selfSpotifyId, targetUserId } = req.body;

    if (!selfSpotifyId || !targetUserId) {
        return res.status(400).json({ message: 'Missing selfSpotifyId or targetUserId.' });
    }

    try {
        const selfId = await getUserIdBySpotifyId(selfSpotifyId);
        if (!selfId) {
            return res.status(404).json({ message: 'Self user not found.' });
        }

        // 既存のフォロー関係を削除 (双方向で検索して削除)
        const deleteRes = await pool.query(
            `DELETE FROM follows
             WHERE (follower_id = $1 AND following_id = $2)
                OR (follower_id = $2 AND following_id = $1)`,
            [selfId, targetUserId]
        );

        if (deleteRes.rowCount === 0) {
            return res.status(404).json({ message: 'Follow relationship not found.' });
        }

        res.status(200).json({ message: 'Unfollowed successfully.' });

    } catch (dbError: unknown) {
        console.error('Unfollow database operation failed:', dbError);
        res.status(500).json({ message: 'Database error occurred during unfollow.' });
    }
}