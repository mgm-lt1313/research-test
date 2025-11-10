import type { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../../lib/db'; //
import { getMyFollowingArtists, SpotifyArtist } from '../../../lib/spotify'; //
import { VercelPoolClient } from '@vercel/postgres'; // 👈 修正: 'pg' から '@vercel/postgres' に変更

/**
 * ユーザーの全フォローアーティストをDBに保存（または更新）する
 * (研究計画 2.1)
 */
async function saveAllFollowingArtists(
  client: VercelPoolClient, // 👈 修正: PoolClient を VercelPoolClient に変更
  userId: string, // DBの内部UUID
  accessToken: string
) {
  // 1. Spotify APIから全フォローアーティストを取得
  const artists: SpotifyArtist[] = await getMyFollowingArtists(accessToken); //

  console.log(`[API profile/save] Fetched ${artists.length} artists for user ${userId}`);

  // 2. このユーザーの古いアーティスト情報を一度すべて削除 (冪等性を担保)
  await client.query(
    'DELETE FROM user_artists WHERE user_id = $1', 
    [userId]
  );

  // 3. 新しいアーティスト情報を一括挿入 (Bulk Insert)
  if (artists.length === 0) {
    console.log(`[API profile/save] No artists to save for user ${userId}`);
    return; // 保存するアーティストがいない場合はここで終了
  }

  // 挿入クエリの構築
  const values: (string | number | null)[] = []; // 👈 any[] から変更
  const queryRows = artists.map((artist, index) => {
    const i = index * 5; // 各行の値のインデックス
    values.push(
      userId, 
      artist.id, 
      artist.name, 
      JSON.stringify(artist.genres || []), // genresをJSON文字列として保存
      artist.popularity
    );
    return `($${i + 1}, $${i + 2}, $${i + 3}, $${i + 4}, $${i + 5})`;
  });

  const insertQuery = `
    INSERT INTO user_artists (user_id, artist_id, artist_name, genres, popularity) 
    VALUES ${queryRows.join(', ')}
  `;

  await client.query(insertQuery, values);
  console.log(`[API profile/save] Successfully saved ${artists.length} artists for user ${userId}`);
}


// メインのAPIハンドラ
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  // ▼▼▼ accessToken を受け取る ▼▼▼
  const { spotifyUserId, nickname, profileImageUrl, bio, accessToken } = req.body;
  // ▲▲▲

  // 必須項目チェック
  if (!spotifyUserId || !nickname) {
    return res.status(400).json({ message: 'Missing required fields: spotifyUserId and nickname' });
  } //

  // ▼▼▼ accessToken のチェックを追加 ▼▼▼
  if (!accessToken) {
    return res.status(400).json({ message: 'Missing required field: accessToken' });
  }
  // ▲▲▲

  const client = await pool.connect();
  try {
    await client.query('BEGIN'); // トランザクション開始

    // 1. ユーザープロフィールを users テーブルに挿入または更新
    const userCheck = await client.query(
      'SELECT id FROM users WHERE spotify_user_id = $1',
      [spotifyUserId]
    ); //

    let userId: string; // DBの内部UUID
    if (userCheck.rows.length > 0) {
      // ユーザーが既に存在する場合は更新
      userId = userCheck.rows[0].id;
      await client.query(
        'UPDATE users SET nickname = $1, profile_image_url = $2, bio = $3, updated_at = CURRENT_TIMESTAMP WHERE spotify_user_id = $4',
        [nickname, profileImageUrl || null, bio || null, spotifyUserId]
      ); //
    } else {
      // ユーザーが存在しない場合は新規挿入
      const insertResult = await client.query(
        'INSERT INTO users (spotify_user_id, nickname, profile_image_url, bio) VALUES ($1, $2, $3, $4) RETURNING id',
        [spotifyUserId, nickname, profileImageUrl || null, bio || null]
      ); //
      userId = insertResult.rows[0].id;
    }

    // 2. ▼▼▼ アーティスト保存ロジックの呼び出し ▼▼▼
    // (プロフィール保存が成功した後、同じトランザクション内で実行)
    await saveAllFollowingArtists(client, userId, accessToken);
    // ▲▲▲

    await client.query('COMMIT'); // トランザクションコミット
    
    // ▼▼▼ 追加 ▼▼▼
    // プロフィール保存とアーティスト保存が成功したら、
    // 非同期でグラフ全体の再計算をトリガーする (await しない)
    fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/batch/calculate-graph`)
      .catch(err => {
        console.error('Failed to trigger background graph calculation:', err);
      });
    // ▲▲▲ 追加 ▲▲▲

    res.status(200).json({ message: 'Profile and artists saved successfully!', userId: userId });

  } catch (dbError) {
    await client.query('ROLLBACK'); // エラー時はロールバック
    console.error('Database transaction failed:', dbError);
    // エラーがSpotify APIからのものかDBからのものか
    if (dbError instanceof Error && (dbError.message.includes('spotify') || dbError.message.includes('fetch'))) {
       res.status(500).json({ message: `Failed to fetch artists from Spotify: ${dbError.message}` });
    } else {
       res.status(500).json({ message: 'Failed to save profile due to database error.' });
    }
  } finally {
    client.release(); // クライアントをプールに戻す
  }
}