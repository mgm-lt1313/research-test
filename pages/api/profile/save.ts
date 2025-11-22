import type { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { userId, email, nickname, bio, hobbies } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. usersテーブルへ保存 (UPSERT)
    const userQuery = `
      INSERT INTO users (id, email, nickname, bio, updated_at)
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO UPDATE 
      SET nickname = EXCLUDED.nickname, 
          bio = EXCLUDED.bio, 
          updated_at = CURRENT_TIMESTAMP
    `;
    await client.query(userQuery, [userId, email, nickname, bio]);

    // 2. 趣味タグの保存 (全削除→再挿入)
    await client.query('DELETE FROM user_hobbies WHERE user_id = $1', [userId]);

    if (hobbies && hobbies.length > 0) {
      const values = hobbies.map((h: string) => `('${userId}', '${h}')`).join(',');
      await client.query(
        `INSERT INTO user_hobbies (user_id, hobby_name) VALUES ${values}`
      );
    }

    await client.query('COMMIT');
    
    // マッチング計算を非同期で実行
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