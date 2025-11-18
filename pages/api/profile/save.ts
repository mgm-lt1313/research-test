// pages/api/profile/save.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../../lib/db';
import { getMyFollowingArtists, SpotifyArtist } from '../../../lib/spotify';
import { PoolClient } from 'pg';

// ▼▼▼ 共通アーティストの型定義を追加 ▼▼▼
interface CommonArtistInfo {
  name: string;
  image_url: string | null;
}

interface SimilarityData {
  userA: string;
  userB: string;
  artistSim: number;
  genreSim: number;
  combinedSim: number;
  commonArtists: CommonArtistInfo[]; // 👈 string[] から変更
  commonGenres: string[];
}
// DBから取得する型
interface DbUserArtist {
  user_id: string; // uuid
  artist_id: string;
  artist_name: string;
  genres: string; 
  image_url: string | null; // 👈 image_url を追加
}
// ▲▲▲ 型定義ここまで ▲▲▲

type UserDataMap = Map<string, {
  artists: Set<string>;
  genres: Set<string>;
}>;

// ... (calculateJaccard は変更なし) ...
function calculateJaccard(setA: Set<string>, setB: Set<string>): { similarity: number, intersection: Set<string> } {
  const intersection = new Set<string>([...setA].filter(x => setB.has(x)));
  const union = new Set<string>([...setA, ...setB]);
  if (union.size === 0) return { similarity: 0, intersection };
  return { similarity: intersection.size / union.size, intersection };
}

// ▼▼▼ getAllArtistData の修正 (calculate-graph.ts と同様) ▼▼▼
async function getAllArtistData(client: PoolClient): Promise<{
  userMap: UserDataMap,
  artistInfoMap: Map<string, CommonArtistInfo> // <artist_id, {name, image_url}>
}> {
  // ▼▼▼ artist_name, image_url を SELECT に追加 ▼▼▼
  const res = await client.query<DbUserArtist>(
    'SELECT user_id, artist_id, artist_name, genres::TEXT, image_url FROM user_artists'
  );
  const userMap: UserDataMap = new Map();
  const artistInfoMap = new Map<string, CommonArtistInfo>(); // 👈 アーティスト情報Map

  for (const row of res.rows) {
    if (!userMap.has(row.user_id)) {
      userMap.set(row.user_id, {
        artists: new Set<string>(),
        genres: new Set<string>(),
      });
    }
    const userData = userMap.get(row.user_id)!;
    userData.artists.add(row.artist_id);
    
    // 👈 アーティストIDと{名前, URL}を紐付け
    if (row.artist_name && !artistInfoMap.has(row.artist_id)) {
        artistInfoMap.set(row.artist_id, {
          name: row.artist_name,
          image_url: row.image_url
        });
    }
    
    try {
      const genres: string[] = JSON.parse(row.genres || '[]');
      for (const genre of genres) {
        userData.genres.add(genre.toLowerCase().trim());
      }
    } catch (e) { 
      // console.warn(`Could not parse genres for user ${row.user_id}`);
    }
  }
  return { userMap, artistInfoMap }; // 👈 2つ返す
}
// ▲▲▲ ヘルパー関数ここまで ▲▲▲


// ▼▼▼【即時類似度計算】の修正 ▼▼▼
async function calculateNewUserSimilarities(client: PoolClient, newUserId: string) {
  console.log(`[API profile/save] Starting O(n) similarity calculation for user ${newUserId}`);
  
  // ▼▼▼ 受け取り方を変更 ▼▼▼
  const { userMap: userDataMap, artistInfoMap } = await getAllArtistData(client);
  const newUser = userDataMap.get(newUserId);
  // ▲▲▲ 修正 ▲▲▲
  
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

    // ▼▼▼ 共通アーティストIDを取得し、{名前, URL} オブジェクトに変換 ▼▼▼
    const { similarity: artistSim, intersection: commonArtistIds } = calculateJaccard(newUser.artists, otherUser.artists);
    const { similarity: genreSim, intersection: commonGenres } = calculateJaccard(newUser.genres, otherUser.genres);

    // 共通アーティストの「ID」を「{名前, URL}」に変換
    const commonArtists = Array.from(commonArtistIds)
        .map(id => artistInfoMap.get(id)) // IDを情報オブジェクトにマッピング
        .filter((info): info is CommonArtistInfo => !!info); // undefined を除去
    // ▲▲▲ 修正 ▲▲▲

    const w1 = 0.6;
    const w2 = 0.4;
    const combinedSim = (artistSim * w1) + (genreSim * w2);
    
    const [id1, id2] = [newUserId, otherId].sort();

    similarities.push({
      userA: id1,
      userB: id2,
      artistSim,
      genreSim,
      combinedSim,
      commonArtists: commonArtists, // 👈 オブジェクトの配列
      commonGenres: Array.from(commonGenres),
    });
  }
  console.log(`[API profile/save] Calculated ${similarities.length} new similarity pairs.`);

  // 3. DBに挿入
  if (similarities.length > 0) {
    const simValues: (string | number | null)[] = [];
    const simQueryRows = similarities.map((sim, index) => {
      const i = index * 7;
      simValues.push(
        sim.userA, sim.userB, sim.artistSim, sim.genreSim,
        sim.combinedSim,
        JSON.stringify(sim.commonArtists), // 👈 オブジェクト配列をJSON化
        JSON.stringify(sim.commonGenres)
      );
      return `($${i + 1}, $${i + 2}, $${i + 3}, $${i + 4}, $${i + 5}, $${i + 6}, $${i + 7})`;
    });
    
    // 既に存在するペアは更新 (ON CONFLICT DO UPDATE)
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
// ▲▲▲【即時計算】の修正ここまで ▲▲▲


/**
 * ユーザーの全フォローアーティストをDBに保存（または更新）する
 * (image_url も保存)
 */
async function saveAllFollowingArtists(
  client: PoolClient,
  userId: string,
  accessToken: string
) {
  const artists: SpotifyArtist[] = await getMyFollowingArtists(accessToken);
  console.log(`[API profile/save] Fetched ${artists.length} artists for user ${userId}`);

  await client.query(
    'DELETE FROM user_artists WHERE user_id = $1', 
    [userId]
  );

  if (artists.length === 0) {
    console.log(`[API profile/save] No artists to save for user ${userId}`);
    return;
  }

  const values: (string | number | null)[] = []; 
  const queryRows = artists.map((artist, index) => {
    const i = index * 6; // 👈 6列
    values.push(
      userId, 
      artist.id, 
      artist.name, 
      JSON.stringify(artist.genres || []),
      artist.popularity,
      artist.images?.[2]?.url || artist.images?.[1]?.url || artist.images?.[0]?.url || null // 👈 画像URL
    );
    return `($${i + 1}, $${i + 2}, $${i + 3}, $${i + 4}, $${i + 5}, $${i + 6})`;
  });

  const insertQuery = `
    INSERT INTO user_artists (user_id, artist_id, artist_name, genres, popularity, image_url) 
    VALUES ${queryRows.join(', ')}
  `;

  await client.query(insertQuery, values);
  console.log(`[API profile/save] Successfully saved ${artists.length} artists for user ${userId}`);
}


// メインのAPIハンドラ (軽量化版)
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

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
    const userCheck = await client.query(
      'SELECT id FROM users WHERE spotify_user_id = $1',
      [spotifyUserId]
    ); 

    let userId: string;
    if (userCheck.rows.length > 0) {
      userId = userCheck.rows[0].id;
      await client.query(
        'UPDATE users SET nickname = $1, profile_image_url = $2, bio = $3, updated_at = CURRENT_TIMESTAMP WHERE spotify_user_id = $4',
        [nickname, profileImageUrl || null, bio || null, spotifyUserId]
      ); 
    } else {
      const insertResult = await client.query(
        'INSERT INTO users (spotify_user_id, nickname, profile_image_url, bio) VALUES ($1, $2, $3, $4) RETURNING id',
        [spotifyUserId, nickname, profileImageUrl || null, bio || null]
      ); 
      userId = insertResult.rows[0].id;
    }

    // 2. フォローアーティストを保存
    await saveAllFollowingArtists(client, userId, accessToken);

    // ▼▼▼【重要】即時計算(O(n))は重いので削除 ▼▼▼
    // await calculateNewUserSimilarities(client, userId);
    // ▲▲▲ 削除 ▲▲▲

    await client.query('COMMIT'); // トランザクションコミット
    
    // 全体計算(O(n^2))を非同期でトリガー (これは変更なし)
    fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/batch/calculate-graph`)
      .catch(err => {
        console.error('Failed to trigger background graph calculation:', err);
      });

    res.status(200).json({ message: 'Profile and artists saved successfully!', userId: userId });

  } catch (dbError) {
    await client.query('ROLLBACK');
    console.error('Database transaction failed:', dbError);
    if (dbError instanceof Error && (dbError.message.includes('spotify') || dbError.message.includes('fetch'))) {
       res.status(500).json({ message: `Failed to fetch artists from Spotify: ${dbError.message}` });
    } else {
       res.status(500).json({ message: 'Failed to save profile due to database error.' });
    }
  } finally {
    client.release();
  }
}