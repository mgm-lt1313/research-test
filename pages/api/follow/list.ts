import type { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../../lib/db';

// ユーザー情報をまとめて取得するヘルパー
async function getUserProfiles(userIds: string[]) {
  if (userIds.length === 0) return new Map();
  const usersRes = await pool.query(
    'SELECT id, nickname, profile_image_url FROM users WHERE id = ANY($1::uuid[])',
    [userIds]
  );
  return new Map(
    usersRes.rows.map(u => [u.id, { nickname: u.nickname, profile_image_url: u.profile_image_url }])
  );
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end();

  const { userId } = req.query; // spotifyUserId ではなく userId を受け取る

  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ message: 'Missing userId' });
  }

  try {
    // 1. フォロワー (自分宛の pending)
    const followersRes = await pool.query(
      `SELECT id, follower_id as user_id FROM follows WHERE following_id = $1 AND status = 'pending'`,
      [userId]
    );

    // 2. フォロー中 (自分発の pending)
    const pendingRes = await pool.query(
      `SELECT id, following_id as user_id FROM follows WHERE follower_id = $1 AND status = 'pending'`,
      [userId]
    );

    // 3. マッチング済み (双方向 approved)
    // ※ user_a_id / user_b_id のどちらかが自分
    const matchesRes = await pool.query(
      `SELECT id, 
        CASE WHEN follower_id = $1 THEN following_id ELSE follower_id END as user_id
       FROM follows
       WHERE (follower_id = $1 OR following_id = $1) AND status = 'approved'`,
      [userId]
    );

    // プロフィール情報の取得
    const allUserIds = [
      ...followersRes.rows.map(r => r.user_id),
      ...pendingRes.rows.map(r => r.user_id),
      ...matchesRes.rows.map(r => r.user_id)
    ];
    // 重複排除
    const uniqueUserIds = Array.from(new Set(allUserIds));
    const profileMap = await getUserProfiles(uniqueUserIds);

    // データ整形
    const formatList = (rows: any[]) => rows.map(r => ({
      id: r.id,
      user_id: r.user_id,
      ...profileMap.get(r.user_id)
    })).filter(r => r.nickname); // 削除済みユーザーなどを除外

    res.status(200).json({
      pendingRequestsToMe: formatList(followersRes.rows),   // フォロワー
      pendingRequestsFromMe: formatList(pendingRes.rows), // フォロー中
      approvedMatches: formatList(matchesRes.rows)        // マッチング
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Database error' });
  }
}