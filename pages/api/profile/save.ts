// pages/api/profile/save.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../../lib/db';
import { getMyFollowingArtists, SpotifyArtist } from '../../../lib/spotify';
import { PoolClient } from 'pg';

// ... (SimilarityData は変更なし) ...
interface SimilarityData {
  userA: string;
  userB: string;
  artistSim: number;
  genreSim: number;
  combinedSim: number;
  commonArtists: string[];
  commonGenres: string[];
}
// ▼▼▼ DbUserArtist に artist_name を追加 ▼▼▼
interface DbUserArtist {
  user_id: string; // uuid
  artist_id: string;
  artist_name: string; // 👈 追加
  genres: string; 
}
type UserDataMap = Map<string, {
  artists: Set<string>;
  genres: Set<string>;
}>;
// ▲▲▲ 型定義ここまで ▲▲▲

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
  artistNameMap: Map<string, string>
}> {
  // 👈 artist_name を SELECT
  const res = await client.query<DbUserArtist>(
    'SELECT user_id, artist_id, artist_name, genres::TEXT FROM user_artists'
  );
  const userMap: UserDataMap = new Map();
  const artistNameMap = new Map<string, string>(); // 👈 新設

  for (const row of res.rows) {
    if (!userMap.has(row.user_id)) {
      userMap.set(row.user_id, {
        artists: new Set<string>(),
        genres: new Set<string>(),
      });
    }
    const userData = userMap.get(row.user_id)!;
    userData.artists.add(row.artist_id);
    
    // 👈 マップに保存
    if (row.artist_name) {
      artistNameMap.set(row.artist_id, row.artist_name);
    }
    
    // ... (ジャンル処理は変更なし) ...
    try {
      const genres: string[] = JSON.parse(row.genres || '[]');
      for (const genre of genres) {
        userData.genres.add(genre.toLowerCase().trim());
      }
    } catch (e) { 
      // console.warn(`Could not parse genres for user ${row.user_id}`);
    }
  }
  return { userMap, artistNameMap }; // 👈 2つ返す
}
// ▲▲▲ ヘルパー関数ここまで ▲▲▲


// ▼▼▼【即時類似度計算】の修正 ▼▼▼
async function calculateNewUserSimilarities(client: PoolClient, newUserId: string) {
  console.log(`[API profile/save] Starting O(n) similarity calculation for user ${newUserId}`);
  
  // ▼▼▼ 受け取り方を変更 ▼▼▼
  const { userMap: userDataMap, artistNameMap } = await getAllArtistData(client);
  const newUser = userDataMap.get(newUserId);
  // ▲▲▲ 修正 ▲▲▲
  
  if (!newUser) {
    // ... (変更なし) ...
    return;
  }
  const otherUserIds = Array.from(userDataMap.keys()).filter(id => id !== newUserId);
  if (otherUserIds.length === 0) {
    // ... (変更なし) ...
    return;
  }

  const similarities: SimilarityData[] = [];

  // 2. 新規ユーザー vs 既存ユーザー (O(n))
  for (const otherId of otherUserIds) {
    const otherUser = userDataMap.get(otherId)!;

    // ▼▼▼ 共通アーティストIDを取得し、名前に変換 ▼▼▼
    const { similarity: artistSim, intersection: commonArtistIds } = calculateJaccard(newUser.artists, otherUser.artists);
    const { similarity: genreSim, intersection: commonGenres } = calculateJaccard(newUser.genres, otherUser.genres);

    // 共通アーティストの「ID」を「名前」に変換
    const commonArtists = Array.from(commonArtistIds)
        .map(id => artistNameMap.get(id)) // IDを名前にマッピング
        .filter((name): name is string => !!name); // undefined を除去
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
      commonArtists: commonArtists, // 👈 名前の配列
      commonGenres: Array.from(commonGenres),
    });
  }
  console.log(`[API profile/save] Calculated ${similarities.length} new similarity pairs.`);

  // 3. DBに挿入 (変更なし)
  if (similarities.length > 0) {
    // ... (simValues の型定義を変更) ...
    const simValues: (string | number | null)[] = []; // 👈 (string | number | null | string[])[] でも良いが、JSON化するので
    const simQueryRows = similarities.map((sim, index) => {
      const i = index * 7;
      simValues.push(
        sim.userA, sim.userB, sim.artistSim, sim.genreSim,
        sim.combinedSim,
        JSON.stringify(sim.commonArtists), // 👈 名前の配列をJSON化
        JSON.stringify(sim.commonGenres)
      );
      return `($${i + 1}, $${i + 2}, $${i + 3}, $${i + 4}, $${i + 5}, $${i + 6}, $${i + 7})`;
    });
    
    // ... (ON CONFLICT クエリは変更なし) ...
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
 * (▼▼▼ 2b. アーティストアイコンの保存処理を追加 ▼▼▼)
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

  // ▼▼▼ カラム数に合わせて 5 -> 6 に変更 ▼▼▼
  const values: (string | number | null)[] = []; 
  const queryRows = artists.map((artist, index) => {
    const i = index * 6; // 👈 6
    values.push(
      userId, 
      artist.id, 
      artist.name, 
      JSON.stringify(artist.genres || []),
      artist.popularity,
      artist.images?.[2]?.url || artist.images?.[1]?.url || artist.images?.[0]?.url || null // 👈 6番目の値 (画像URL) を追加
    );
    return `($${i + 1}, $${i + 2}, $${i + 3}, $${i + 4}, $${i + 5}, $${i + 6})`; // 👈 $i + 6 まで
  });

  // ▼▼▼ image_url カラムを追加 ▼▼▼
  const insertQuery = `
    INSERT INTO user_artists (user_id, artist_id, artist_name, genres, popularity, image_url) 
    VALUES ${queryRows.join(', ')}
  `;

  await client.query(insertQuery, values);
  console.log(`[API profile/save] Successfully saved ${artists.length} artists for user ${userId}`);
}
// ▲▲▲ 2b. 修正ここまで ▲▲▲


// ... (メインのAPIハンドラは変更なし) ...
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // ...
  // ... (トランザクション処理) ...
  // ...
}