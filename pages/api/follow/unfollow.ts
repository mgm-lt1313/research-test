import type { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { targetUserId, selfSpotifyId: followerId } = req.body;

  if (!targetUserId || !followerId) {
    return res.status(400).json({ error: 'Missing parameters' });
  }

  try {
    // フォロー関係を削除
    await pool.query(
      'DELETE FROM follows WHERE follower_id = $1 AND following_id = $2',
      [followerId, targetUserId]
    );

    res.status(200).json({ message: 'Unfollowed successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error' });
  }
}