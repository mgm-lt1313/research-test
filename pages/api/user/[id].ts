// pages/api/user/[id].ts
import type { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../../lib/db';

async function getUserIdBySpotifyId(spotifyUserId: string): Promise<string | null> {
    const res = await pool.query('SELECT id FROM users WHERE spotify_user_id = $1', [spotifyUserId]);
    return res.rows.length > 0 ? res.rows[0].id : null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const { id: targetUserId, selfSpotifyId } = req.query as {
        id?: string;
        selfSpotifyId?: string;
    };

    if (!targetUserId || !selfSpotifyId) {
        return res.status(400).json({ message: 'Missing targetUserId or selfSpotifyId.' });
    }

    try {
        const selfId = await getUserIdBySpotifyId(selfSpotifyId);
        if (!selfId) {
            return res.status(401).json({ message: 'Self user not found.' });
        }

        // 1. 相手のプロフィールを取得
        const profileRes = await pool.query(
            'SELECT id, nickname, profile_image_url, bio FROM users WHERE id = $1',
            [targetUserId]
        );
        if (profileRes.rows.length === 0) {
            return res.status(404).json({ message: 'Target user not found.' });
        }
        
        // 2. 自分と相手の類似度を取得 (IDの順序を考慮)
        const [id1, id2] = [selfId, targetUserId].sort();
        const simRes = await pool.query(
            `SELECT artist_similarity, genre_similarity, combined_similarity, 
                    common_artists::text, common_genres::text 
             FROM similarities WHERE user_a_id = $1 AND user_b_id = $2`,
            [id1, id2]
        );
        
        // 3. フォロー状態を取得
        const followRes = await pool.query(
            `SELECT status, follower_id FROM follows
             WHERE (follower_id = $1 AND following_id = $2)
                OR (follower_id = $2 AND following_id = $1)`,
            [selfId, targetUserId]
        );

        let follow_status: 'pending' | 'approved' | 'none' = 'none';
        let i_am_follower = false;
        if (followRes.rows.length > 0) {
            follow_status = followRes.rows[0].status;
            i_am_follower = (followRes.rows[0].follower_id === selfId);
        }

        // ▼▼▼ 4. 相手のアーティストを取得 (image_url を SELECT に追加) ▼▼▼
        const artistsRes = await pool.query(
            `SELECT artist_name, genres::text, image_url 
             FROM user_artists 
             WHERE user_id = $1 
             ORDER BY popularity DESC 
             LIMIT 10`, // 10件に制限
            [targetUserId]
        );
        // ▲▲▲ 修正ここまで ▲▲▲

        // 5. データを整形して返す
        res.status(200).json({
            profile: profileRes.rows[0],
            similarity: simRes.rows.length > 0 ? {
                ...simRes.rows[0],
                // JSON文字列を配列にパース
                common_artists: JSON.parse(simRes.rows[0].common_artists || '[]'),
                common_genres: JSON.parse(simRes.rows[0].common_genres || '[]')
            } : null,
            follow_status,
            i_am_follower,
            // ▼▼▼ 5. アーティスト情報に image_url をレスポンスに追加 ▼▼▼
            artists: artistsRes.rows.map((r: any) => ({
                name: r.artist_name,
                genres: JSON.parse(r.genres || '[]'),
                image_url: r.image_url // 👈 追加
            }))
            // ▲▲▲ 修正ここまで ▲▲▲
        });

    } catch (dbError: unknown) {
        console.error('Failed to fetch user details:', dbError);
        res.status(500).json({ message: 'Database error occurred.' });
    }
}