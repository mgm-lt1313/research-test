import type { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { userId, followId } = req.body;

  if (!userId || !followId) {
    return res.status(400).json({ error: 'Missing parameters' });
  }

  try {
    // 自分がフォローされている(following_id = Me) リクエストのみ承認可能
    const updateRes = await pool.query(
      `UPDATE follows
       SET status = 'approved'
       WHERE id = $1
         AND following_id = $2
         AND status = 'pending'
       RETURNING id`,
      [followId, userId]
    );

    if (updateRes.rowCount === 0) {
      return res.status(404).json({ message: 'Request not found or already handled.' });
    }

    res.status(200).json({ message: 'Approved successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error' });
  }
}