// pages/api/batch/calculate-graph.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../../lib/db';
import { PoolClient } from 'pg';
import Graph from 'graphology';
import louvain from 'graphology-communities-louvain';

// ... (SimilarityData, DbUserArtist, calculateJaccard は変更なし) ...
// (DbUserArtist は artist_name を含むようにクエリ側で調整)
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
  artist_name: string; // 👈 取得対象
  genres: string; 
}
type UserDataMap = Map<string, {
  artists: Set<string>;
  genres: Set<string>;
}>;

function calculateJaccard(setA: Set<string>, setB: Set<string>): { similarity: number, intersection: Set<string> } {
  // ... (変更なし) ...
  const intersection = new Set<string>([...setA].filter(x => setB.has(x)));
  const union = new Set<string>([...setA, ...setB]);
  if (union.size === 0) {
    return { similarity: 0, intersection };
  }
  return { similarity: intersection.size / union.size, intersection };
}


/**
 * DBから全ユーザーのアーティストとジャンルのセットを取得
 */
// ▼▼▼ 戻り値の型を変更 ▼▼▼
async function getAllArtistData(client: PoolClient): Promise<{
  userMap: UserDataMap,
  artistNameMap: Map<string, string> // <artist_id, artist_name>
}> {
  // ▼▼▼ artist_name を SELECT に追加 ▼▼▼
  const res = await client.query<DbUserArtist>(
    'SELECT user_id, artist_id, artist_name, genres::TEXT FROM user_artists'
  );

  const userMap: UserDataMap = new Map();
  const artistNameMap = new Map<string, string>(); // 👈 アーティスト名Mapを新設

  for (const row of res.rows) {
    if (!userMap.has(row.user_id)) {
      userMap.set(row.user_id, {
        artists: new Set<string>(),
        genres: new Set<string>(),
      });
    }

    const userData = userMap.get(row.user_id)!;
    userData.artists.add(row.artist_id);
    
    // 👈 アーティストIDと名前を紐付け (重複は上書きされるが問題なし)
    if (row.artist_name) {
        artistNameMap.set(row.artist_id, row.artist_name);
    }

    try {
      // ... (ジャンル処理は変更なし) ...
      const genres: string[] = JSON.parse(row.genres || '[]');
      for (const genre of genres) {
        userData.genres.add(genre.toLowerCase().trim());
      }
    } catch (e: unknown) { 
      const errorMessage = e instanceof Error ? e.message : String(e);
      console.warn(`Could not parse genres for user ${row.user_id} (${row.genres}): ${errorMessage}`);
    }
  }

  return { userMap, artistNameMap }; // 👈 2つのMapを返す
}
// ▲▲▲ getAllArtistData の修正ここまで ▲▲▲


// APIメインハンドラ
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // ... (メソッドチェック等は変更なし) ...
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed. Use GET to trigger.' });
  }

  console.log('[Batch] === Start: Similarity & Graph Calculation ===');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // ▼▼▼ 戻り値の受け取り方を変更 ▼▼▼
    const { userMap, artistNameMap } = await getAllArtistData(client);
    const userIds = Array.from(userMap.keys());
    // ▲▲▲ 修正ここまで ▲▲▲

    console.log(`[Batch] Step 1: Loaded data for ${userIds.length} users.`);
    // ... (ユーザー数チェックは変更なし) ...

    const allSimilarities: SimilarityData[] = []; 
    for (let i = 0; i < userIds.length; i++) {
      for (let j = i + 1; j < userIds.length; j++) {
        const userA_id = userIds[i];
        const userB_id = userIds[j];
        
        const dataA = userMap.get(userA_id)!;
        const dataB = userMap.get(userB_id)!;

        // ▼▼▼ 共通アーティストIDを取得し、名前に変換 ▼▼▼
        const { similarity: artistSim, intersection: commonArtistIds } = calculateJaccard(dataA.artists, dataB.artists);
        const { similarity: genreSim, intersection: commonGenres } = calculateJaccard(dataA.genres, dataB.genres);

        // 共通アーティストの「ID」を「名前」に変換
        const commonArtists = Array.from(commonArtistIds)
            .map(id => artistNameMap.get(id)) // IDを名前にマッピング
            .filter((name): name is string => !!name); // undefined を除去

        // ▲▲▲ 修正ここまで ▲▲▲

        const w1 = 0.6;
        const w2 = 0.4;
        const combinedSim = (artistSim * w1) + (genreSim * w2);

        const [id1, id2] = [userA_id, userB_id].sort();

        allSimilarities.push({
          userA: id1,
          userB: id2,
          artistSim,
          genreSim,
          combinedSim,
          commonArtists: commonArtists,       // 👈 名前の配列
          commonGenres: Array.from(commonGenres),
        });
      }
    }
    console.log(`[Batch] Step 2: Calculated ${allSimilarities.length} similarity pairs.`);

    // ... (TRUNCATE TABLE similarities CASCADE は変更なし) ...
    await client.query('TRUNCATE TABLE similarities CASCADE');
    
    if (allSimilarities.length > 0) {
      // ... (simValues の型定義を変更) ...
      // ▼▼▼ simValues の型定義を変更 ▼▼▼
      const simValues: (string | number | null | string[])[] = []; 
      const simQueryRows = allSimilarities.map((sim, index) => {
        const i = index * 7;
        simValues.push(
          sim.userA, sim.userB, sim.artistSim, sim.genreSim, 
          sim.combinedSim, 
          JSON.stringify(sim.commonArtists), // 👈 名前の配列をJSON化
          JSON.stringify(sim.commonGenres)
        );
        return `($${i + 1}, $${i + 2}, $${i + 3}, $${i + 4}, $${i + 5}, $${i + 6}, $${i + 7})`;
      });
      // ... (INSERT クエリは変更なし) ...
      const simInsertQuery = `
        INSERT INTO similarities (user_a_id, user_b_id, artist_similarity, genre_similarity, combined_similarity, common_artists, common_genres)
        VALUES ${simQueryRows.join(', ')}
      `;
      await client.query(simInsertQuery, simValues);
    }
    console.log(`[Batch] Step 3: Saved similarities to DB.`);

    // ... (以降のグラフ構築、Louvain法、レスポンス部分は変更なし) ...
    const graph = new Graph();
    // ...
    // res.status(200).json(...)

  } catch (error: unknown) {
    // ... (エラーハンドリングは変更なし) ...
  } finally {
    client.release();
  }
}