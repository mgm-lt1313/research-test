import type { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../../lib/db'; //
import { PoolClient } from 'pg'; // 👈 修正: '@vercel/postgres' から 'pg' に変更
import Graph from 'graphology'; //

import louvain from 'graphology-communities-louvain';

// ▼▼▼【修正】commonArtists/Genres の型を string[] に変更 ▼▼▼
interface SimilarityData {
  userA: string;
  userB: string;
  artistSim: number;
  genreSim: number;
  combinedSim: number;
  commonArtists: string[]; // 👈 string になっていたのを string[] に変更
  commonGenres: string[];  // 👈 string になっていたのを string[] に変更
}

// ... (中略: calculateJaccard, DbUserArtist, UserDataMap) ...

function calculateJaccard(setA: Set<string>, setB: Set<string>): { similarity: number, intersection: Set<string> } {
  const intersection = new Set<string>([...setA].filter(x => setB.has(x)));
  const union = new Set<string>([...setA, ...setB]);

  if (union.size === 0) {
    return { similarity: 0, intersection };
  }
  
  return { similarity: intersection.size / union.size, intersection };
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

/**
 * DBから全ユーザーのアーティストとジャンルのセットを取得
 */
async function getAllArtistData(client: PoolClient): Promise<UserDataMap> { // 👈 修正: VercelPoolClient を PoolClient に変更
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
    } catch (e: unknown) { 
      const errorMessage = e instanceof Error ? e.message : String(e);
      console.warn(`Could not parse genres for user ${row.user_id} (${row.genres}): ${errorMessage}`);
    }
  }

  return userMap;
}


// APIメインハンドラ
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed. Use GET to trigger.' });
  }

  // if (req.query.secret !== process.env.BATCH_SECRET) {
  //   return res.status(401).json({ message: 'Invalid secret.' });
  // }

  console.log('[Batch] === Start: Similarity & Graph Calculation ===');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const userDataMap = await getAllArtistData(client);
    const userIds = Array.from(userDataMap.keys());
    console.log(`[Batch] Step 1: Loaded data for ${userIds.length} users.`);

    if (userIds.length < 2) {
      await client.query('ROLLBACK');
      console.log('[Batch] Canceled: Need at least 2 users to calculate similarities.');
      return res.status(200).json({ message: 'Calculation skipped: Need at least 2 users.' });
    }

    // ... (中略: 類似度計算ロジック allSimilarities.push まで) ...
    const allSimilarities: SimilarityData[] = []; // 👈 型が更新されている
    for (let i = 0; i < userIds.length; i++) {
      for (let j = i + 1; j < userIds.length; j++) {
        const userA_id = userIds[i];
        const userB_id = userIds[j];
        
        const dataA = userDataMap.get(userA_id)!;
        const dataB = userDataMap.get(userB_id)!;

        const { similarity: artistSim, intersection: commonArtists } = calculateJaccard(dataA.artists, dataB.artists);
        const { similarity: genreSim, intersection: commonGenres } = calculateJaccard(dataA.genres, dataB.genres);

        const w1 = 0.6; // アーティスト重み
        const w2 = 0.4; // ジャンル重み
        const combinedSim = (artistSim * w1) + (genreSim * w2);

        allSimilarities.push({
          userA: userA_id,
          userB: userB_id,
          artistSim,
          genreSim,
          combinedSim,
          commonArtists: Array.from(commonArtists), // 👈 JSON.stringify を削除
          commonGenres: Array.from(commonGenres),   // 👈 JSON.stringify を削除
        });
      }
    }
    console.log(`[Batch] Step 2: Calculated ${allSimilarities.length} similarity pairs.`);

    await client.query('TRUNCATE TABLE similarities CASCADE');
    
    // ... (中略: 類似度保存ロジック simInsertQuery まで) ...
    if (allSimilarities.length > 0) {
      // ▼▼▼【修正】simValues の型を (string | number | null | string[])[] に変更 ▼▼▼
      const simValues: (string | number | null | string[])[] = []; 
      const simQueryRows = allSimilarities.map((sim, index) => {
        const i = index * 7;
        simValues.push(
          sim.userA, sim.userB, sim.artistSim, sim.genreSim, 
          sim.combinedSim, 
          sim.commonArtists, // 👈 ここは配列のまま渡す
          sim.commonGenres   // 👈 ここは配列のまま渡す
        );
        return `($${i + 1}, $${i + 2}, $${i + 3}, $${i + 4}, $${i + 5}, $${i + 6}, $${i + 7})`;
      });
      const simInsertQuery = `
        INSERT INTO similarities (user_a_id, user_b_id, artist_similarity, genre_similarity, combined_similarity, common_artists, common_genres)
        VALUES ${simQueryRows.join(', ')}
      `;
      // ▲▲▲ 修正ここまで ▲▲▲
      await client.query(simInsertQuery, simValues);
    }
    console.log(`[Batch] Step 3: Saved similarities to DB.`);

    const graph = new Graph();
    const similarityThreshold = 0.20; 

    for (const userId of userIds) {
      graph.addNode(userId);
    }

    for (const sim of allSimilarities) {
      if (sim.combinedSim >= similarityThreshold) {
        graph.addUndirectedEdge(sim.userA, sim.userB, { weight: sim.combinedSim });
      }
    }
    console.log(`[Batch] Step 4: Graph built (${graph.order} nodes, ${graph.size} edges).`);

    // ▼▼▼【修正】変数をifブロックの外側で宣言 ▼▼▼
    let communityAssignments: { [key: string]: number } = {};
    let communityCount = 0;
    // ▲▲▲ 修正ここまで ▲▲▲

    // ▼▼▼【変更後】グラフにエッジがある場合のみLouvainを実行 ▼▼▼
    if (graph.size > 0) {
      // ▼▼▼【修正】ここで代入する ▼▼▼
      communityAssignments = louvain(graph, { 
        resolution: 1.0
      });

      await client.query('TRUNCATE TABLE communities CASCADE'); 

      const communityEntries = Object.entries(communityAssignments); 
      if (communityEntries.length > 0) {
        const commValues: (string | number)[] = [];
        const commQueryRows = communityEntries.map(([userId, communityId], index) => {
          const i = index * 2;
          commValues.push(userId, communityId as number);
          return `($${i + 1}, $${i + 2})`;
        });
        const commInsertQuery = `
          INSERT INTO communities (user_id, community_id)
          VALUES ${commQueryRows.join(', ')}
        `;
        await client.query(commInsertQuery, commValues);
      }
      
      // ▼▼▼【修正】コミュニティ数をここで計算 ▼▼▼
      communityCount = new Set(Object.values(communityAssignments)).size;
      console.log(`[Batch] Step 5 & 6: Communities detected (${communityCount}) and saved to DB.`);
    
    } else {
      console.log(`[Batch] Step 5 & 6: Skipped community detection (no edges in graph).`);
      await client.query('TRUNCATE TABLE communities CASCADE'); 
    }
    // ▲▲▲ ifブロック修正ここまで ▲▲▲

    await client.query('COMMIT');
    console.log('[Batch] === Success: All calculations committed. ===');
    
    // ▼▼▼【修正】外で宣言した変数を使う ▼▼▼
    res.status(200).json({ 
      message: 'Batch calculation successful.',
      users: userIds.length,
      pairs: allSimilarities.length,
      edges: graph.size,
      communities: communityCount // 修正した communityCount を使う
    });

  } catch (error: unknown) {
    await client.query('ROLLBACK');
    console.error('[Batch] === Error: Transaction rolled back. ===', error);
    const message = error instanceof Error ? error.message : 'Unknown batch error';
    res.status(500).json({ message });
  } finally {
    client.release();
  }
}