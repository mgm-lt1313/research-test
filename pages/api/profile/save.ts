import type { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../../lib/db';
import { getMyFollowingArtists, SpotifyArtist } from '../../../lib/spotify';
import { PoolClient } from 'pg';

// ▼▼▼ calculate-graph.ts から型定義をコピー ▼▼▼
interface SimilarityData {
  userA: string;
  userB: string;
  artistSim: number;
  genreSim: number;
  combinedSim: number;
  commonArtists: string[];
  commonGenres: string[];
}
interface DbUserArtist {
  user_id: string; // uuid
  artist_id: string;
  genres: string; // DBからはJSON文字列として取得
}
type UserDataMap = Map<string, {
  artists: Set<string>;
  genres: Set<string>;
}>;
// ▲▲▲ 型定義ここまで ▲▲▲

// ▼▼▼ calculate-graph.ts からヘルパー関数をコピー ▼▼▼
function calculateJaccard(setA: Set<string>, setB: Set<string>): { similarity: number, intersection: Set<string> } {
  const intersection = new Set<string>([...setA].filter(x => setB.has(x)));
  const union = new Set<string>([...setA, ...setB]);
  if (union.size === 0) return { similarity: 0, intersection };
  return { similarity: intersection.size / union.size, intersection };
}

async function getAllArtistData(client: PoolClient): Promise<UserDataMap> {
  const res = await client.query<DbUserArtist>(
    'SELECT user_id, artist_id, genres::TEXT FROM user_artists'
  );
  const userMap: UserDataMap = new Map();
  for (const row of res.rows) {
    if (!userMap.has(row.user_id)) {
      userMap.set(row.user_id, {
        artists: new Set<string>(),
        genres: new Set<string>(),
      });
    }
    const userData = userMap.get(row.user_id)!;
    userData.artists.add(row.artist_id);
    try {
      const genres: string[] = JSON.parse(row.genres || '[]');
      for (const genre of genres) {
        userData.genres.add(genre.toLowerCase().trim());
      }
    } catch (e) { 
      // console.warn(`Could not parse genres for user ${row.user_id}`);
    }
  }
  return userMap;
}
// ▲▲▲ ヘルパー関数ここまで ▲▲▲

// ▼▼▼【新設】即時類似度計算 (O(n)) の関数 ▼▼▼
/**
 * 新規ユーザーと全既存ユーザー間の類似度を計算し、DBに挿入する (O(n))
 */
async function calculateNewUserSimilarities(client: PoolClient, newUserId: string) {
  console.log(`[API profile/save] Starting O(n) similarity calculation for user ${newUserId}`);
  
  // 1. 全ユーザーのアーティスト・ジャンルデータを取得
  const userDataMap = await getAllArtistData(client);

  const newUser = userDataMap.get(newUserId);
  if (!newUser) {
    console.warn(`[API profile/save] New user ${newUserId} has no artist data. Skipping O(n) calculation.`);
    return;
  }

  const otherUserIds = Array.from(userDataMap.keys()).filter(id => id !== newUserId);
  if (otherUserIds.length === 0) {
    console.log(`[API profile/save] No other users to compare. Skipping O(n) calculation.`);
    return;
  }

  const similarities: SimilarityData[] = [];

  // 2. 新規ユーザー vs 既存ユーザー (O(n))
  for (const otherId of otherUserIds) {
    const otherUser = userDataMap.get(otherId)!;

    const { similarity: artistSim, intersection: commonArtists } = calculateJaccard(newUser.artists, otherUser.artists);
    const { similarity: genreSim, intersection: commonGenres } = calculateJaccard(newUser.genres, otherUser.genres);

    const w1 = 0.6; // アーティスト重み
    const w2 = 0.4; // ジャンル重み
    const combinedSim = (artistSim * w1) + (genreSim * w2);

    similarities.push({
      userA: newUserId,
      userB: otherId,
      artistSim,
      genreSim,
      combinedSim,
      commonArtists: Array.from(commonArtists),
      commonGenres: Array.from(commonGenres),
    });
  }
  console.log(`[API profile/save] Calculated ${similarities.length} new similarity pairs.`);

  // 3. DBに挿入 (TRUNCATE しない)
  if (similarities.length > 0) {
    const simValues: (string | number | null)[] = []; // 👈 型を (string | number | null)[] に変更
    const simQueryRows = similarities.map((sim, index) => {
      const i = index * 7;
      simValues.push(
        sim.userA, sim.userB, sim.artistSim, sim.genreSim,
        sim.combinedSim,
        JSON.stringify(sim.commonArtists), // 👈 ★ JSONエラー修正
        JSON.stringify(sim.commonGenres)   // 👈 ★ JSONエラー修正
      );
      return `($${i + 1}, $${i + 2}, $${i + 3}, $${i + 4}, $${i + 5}, $${i + 6}, $${i + 7})`;
    });
    
    // 既に存在するペアは更新 (ON CONFLICT DO UPDATE)
    // ( user_b_id, user_a_id ) のペアも考慮
    const simInsertQuery = `
      INSERT INTO similarities (
        user_a_id, user_b_id, artist_similarity, genre_similarity, 
        combined_similarity, common_artists, common_genres
      )
      VALUES ${simQueryRows.join(', ')}
      ON CONFLICT (user_a_id, user_b_id) DO UPDATE SET
        artist_similarity = EXCLUDED.artist_similarity,
        genre_similarity = EXCLUDED.genre_similarity,
        combined_similarity = EXCLUDED.combined_similarity,
        common_artists = EXCLUDED.common_artists,
        common_genres = EXCLUDED.common_genres,
        calculated_at = CURRENT_TIMESTAMP
    `;
    
    await client.query(simInsertQuery, simValues);
    console.log(`[API profile/save] Inserted/Updated ${similarities.length} new pairs into DB.`);
  }
}
// ▲▲▲【新設】ここまで ▲▲▲

/**
 * ユーザーの全フォローアーティストをDBに保存（または更新）する
 * (研究計画 2.1)
 */
async function saveAllFollowingArtists(
  client: PoolClient, // 👈 修正: VercelPoolClient を PoolClient に変更
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
  // ... (中略: values, queryRows, insertQuery) ...
  const values: (string | number | null)[] = []; 
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

  // ... (中略: req.body, 必須項目チェック) ...
  const { spotifyUserId, nickname, profileImageUrl, bio, accessToken } = req.body;

  if (!spotifyUserId || !nickname) {
    return res.status(400).json({ message: 'Missing required fields: spotifyUserId and nickname' });
  } 

  if (!accessToken) {
    return res.status(400).json({ message: 'Missing required field: accessToken' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN'); // トランザクション開始

    // 1. ユーザープロフィールを users テーブルに挿入または更新
    // ... (中略: userCheck, userId の決定, insert/update) ...
    const userCheck = await client.query(
      'SELECT id FROM users WHERE spotify_user_id = $1',
      [spotifyUserId]
    ); 

    let userId: string; // DBの内部UUID
    if (userCheck.rows.length > 0) {
      // ユーザーが既に存在する場合は更新
      userId = userCheck.rows[0].id;
      await client.query(
        'UPDATE users SET nickname = $1, profile_image_url = $2, bio = $3, updated_at = CURRENT_TIMESTAMP WHERE spotify_user_id = $4',
        [nickname, profileImageUrl || null, bio || null, spotifyUserId]
      ); 
    } else {
      // ユーザーが存在しない場合は新規挿入
      const insertResult = await client.query(
        'INSERT INTO users (spotify_user_id, nickname, profile_image_url, bio) VALUES ($1, $2, $3, $4) RETURNING id',
        [spotifyUserId, nickname, profileImageUrl || null, bio || null]
      ); 
      userId = insertResult.rows[0].id;
    }

    // 2. 
    // (プロフィール保存が成功した後、同じトランザクション内で実行)
    await saveAllFollowingArtists(client, userId, accessToken);
    // 

    await client.query('COMMIT'); // トランザクションコミット
    
    // 
    // プロフィール保存とアーティスト保存が成功したら、
    // 非同期でグラフ全体の再計算をトリガーする (await しない)
    fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/batch/calculate-graph`)
      .catch(err => {
        console.error('Failed to trigger background graph calculation:', err);
      });
    // 

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