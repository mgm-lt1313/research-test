import type { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    // ▼▼▼ 変更点1: フロントエンドから受け取るIDを 'userId' (uuid) に変更 ▼▼▼
    const { userId } = req.body; 

    if (!userId) {
        return res.status(400).json({ message: 'Missing userId.' });
    }

    try {
        // ▼▼▼ 変更点2: 趣味タグ用の新しいテーブル構造に合わせてクエリを修正 ▼▼▼
        // similarities テーブルから、スコアが高い順にデータを取得します
        const query = `
            SELECT 
                CASE 
                    WHEN s.user_a_id = $1 THEN s.user_b_id 
                    ELSE s.user_a_id 
                END AS other_user_id,
                u.nickname,
                u.profile_image_url,
                u.bio,
                s.score,
                s.match_count,
                s.common_tags::text  -- JSONB型をテキストとして取得してJS側でパースする
            FROM similarities s
            JOIN users u ON (
                CASE 
                    WHEN s.user_a_id = $1 THEN s.user_b_id 
                    ELSE s.user_a_id 
                END = u.id
            )
            WHERE (s.user_a_id = $1 OR s.user_b_id = $1)
            AND s.match_count > 0  -- 1つ以上の一致がある場合のみ
            ORDER BY s.match_count DESC, s.score DESC
            LIMIT 20;
        `;

        const { rows } = await pool.query(query, [userId]);

        // データを整形して返す
        const matches = rows.map(row => ({
            other_user_id: row.other_user_id,
            nickname: row.nickname,
            profile_image_url: row.profile_image_url,
            bio: row.bio,
            score: row.score,
            match_count: row.match_count,
            common_tags: JSON.parse(row.common_tags || '[]')
        }));

        res.status(200).json({ matches });

    } catch (dbError) {
        console.error('Recommendation calculation failed:', dbError);
        res.status(500).json({ message: 'Failed to get recommendations.' });
    }
}