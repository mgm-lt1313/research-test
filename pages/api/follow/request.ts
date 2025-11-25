import type { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  // フロントエンド(user/[id].tsx)は selfSpotifyId というキーで送ってくるため、それを followerId として受け取ります
  const { targetUserId, selfSpotifyId: followerId } = req.body;

  if (!targetUserId || !followerId) {
    return res.status(400).json({ error: 'Missing parameters' });
  }

  const client = await pool.connect();
  try {
    // 既に何らかの関係があるかチェック（双方向）
    const checkRes = await client.query(
      `SELECT id, follower_id, following_id, status FROM follows 
       WHERE (follower_id = $1 AND following_id = $2) 
          OR (follower_id = $2 AND following_id = $1)`,
      [followerId, targetUserId]
    );

    if (checkRes.rows.length > 0) {
      const existing = checkRes.rows[0];
      
      // パターンA: 相手(Target)が既に自分(Follower)をフォローしていて、承認待ち(pending)の場合
      //  -> 「フォローし返す」ことになるので、マッチング成立(approved)に更新する
      if (existing.follower_id === targetUserId && existing.status === 'pending') {
        await client.query(
          `UPDATE follows SET status = 'approved' WHERE id = $1`,
          [existing.id]
        );
        return res.status(200).json({ status: 'approved', message: 'マッチング成立！' });
      }

      // パターンB: 既に自分がフォロー済み、またはマッチング済み
      return res.status(200).json({ status: existing.status });
    }

    // パターンC: 関係なし -> 新規フォローリクエスト(pending)を作成
    await client.query(
      `INSERT INTO follows (follower_id, following_id, status) VALUES ($1, $2, 'pending')`,
      [followerId, targetUserId]
    );

    res.status(200).json({ status: 'pending' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error' });
  } finally {
    client.release();
  }
}