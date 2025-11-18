// pages/api/user/[id].ts
import type { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../../lib/db';

// ... (getUserIdBySpotifyId は変更なし) ...
async function getUserIdBySpotifyId(spotifyUserId: string): Promise<string | null> {
    const res = await pool.query('SELECT id FROM users WHERE spotify_user_id = $1', [spotifyUserId]);
    return res.rows.length > 0 ? res.rows[0].id : null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    // ... (メソッドチェック、ID取得は変更なし) ...
    if (req.method !== 'GET') {
      // ...
    }
    const { id: targetUserId, selfSpotifyId } = req.query as {
      // ...
    };
    if (!targetUserId || !selfSpotifyId) {
      // ...
    }

    try {
        const selfId = await getUserIdBySpotifyId(selfSpotifyId);
        if (!selfId) {
            return res.status(401).json({ message: 'Self user not found.' });
        }

        // ... (1. プロフィール取得, 2. 類似度取得, 3. フォロー状態取得 は変更なし) ...
        const profileRes = await pool.query(/* ... */);
        const simRes = await pool.query(/* ... */);
        const followRes = await pool.query(/* ... */);
        // ...
        
        // ▼▼▼ 4. 相手のアーティストを取得 (image_url を追加) ▼▼▼
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
                // ▼▼▼ 2a の修正により common_artists は既に名前の配列になっているはず ▼▼▼
                common_artists: JSON.parse(simRes.rows[0].common_artists || '[]'),
                common_genres: JSON.parse(simRes.rows[0].common_genres || '[]')
            } : null,
            follow_status,
            i_am_follower,
            // ▼▼▼ 5. アーティスト情報に image_url を追加 ▼▼▼
            artists: artistsRes.rows.map((r: any) => ({
                name: r.artist_name,
                genres: JSON.parse(r.genres || '[]'),
                image_url: r.image_url // 👈 追加
            }))
            // ▲▲▲ 修正ここまで ▲▲▲
        });

    } catch (dbError: unknown) {
        // ... (エラーハンドリングは変更なし) ...
    }
}