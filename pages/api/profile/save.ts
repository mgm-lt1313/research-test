import type { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  // profileImageUrl を受け取るように追加
  const { userId, email, nickname, bio, profileImageUrl, hobbies } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const userQuery = `
      INSERT INTO users (id, email, nickname, bio, profile_image_url, updated_at)
      VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO UPDATE 
      SET nickname = EXCLUDED.nickname, 
          bio = EXCLUDED.bio, 
          profile_image_url = EXCLUDED.profile_image_url, -- 更新
          updated_at = CURRENT_TIMESTAMP
    `;
    await client.query(userQuery, [userId, email, nickname, bio, profileImageUrl]);

    // 趣味タグ保存 (変更なし)
    await client.query('DELETE FROM user_hobbies WHERE user_id = $1', [userId]);
    if (hobbies && hobbies.length > 0) {
      const values = hobbies.map((h: string) => `('${userId}', '${h}')`).join(',');
      await client.query(`INSERT INTO user_hobbies (user_id, hobby_name) VALUES ${values}`);
    }

    await client.query('COMMIT');
    fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/batch/calculate-graph`).catch(console.error);
    res.status(200).json({ message: 'Saved' });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(e);
    res.status(500).json({ message: 'Error' });
  } finally {
    client.release();
  }
}