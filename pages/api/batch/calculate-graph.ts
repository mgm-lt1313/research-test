import type { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../../lib/db'; //
import { VercelPoolClient } from '@vercel/postgres'; // 👈 修正: 'pg' から '@vercel/postgres' に変更
import Graph from 'graphology'; //
// ▼▼▼ 修正 1: @ts-expect-error に理由（3文字以上）を追加 ▼▼▼
// @ts-expect-error: graphology-communities-louvain lacks official TS types
// ▲▲▲
import { louvain } from 'graphology-communities-louvain';

interface SimilarityData {
  userA: string;
  userB: string;
  artistSim: number;
  genreSim: number;
  combinedSim: number;
  commonArtists: string;
  commonGenres: string;
}

// --- 研究計画 3.1 & 3.2 ---
/**
 * Jaccard係数を計算するヘルパー関数
 */
function calculateJaccard(setA: Set<string>, setB: Set<string>): { similarity: number, intersection: Set<string> } {
  const intersection = new Set<string>([...setA].filter(x => setB.has(x)));
  const union = new Set<string>([...setA, ...setB]);

  if (union.size === 0) {
    return { similarity: 0, intersection };
  }
  
  return { similarity: intersection.size / union.size, intersection };
}

// DBから取得するアーティストデータの型
interface DbUserArtist {
  user_id: string; // uuid
  artist_id: string;
  genres: string; // DBからはJSON文字列として取得
}

// 計算用に整形するデータ型
type UserDataMap = Map<string, {
  artists: Set<string>;
  genres: Set<string>;
}>;

/**
 * DBから全ユーザーのアーティストとジャンルのセットを取得
 */
async function getAllArtistData(client: VercelPoolClient): Promise<UserDataMap> { // 👈 修正: PoolClient を VercelPoolClient に変更
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
    // ▼▼▼ 修正 2: catch (e: unknown) に変更し、e を使用する ▼▼▼
    } catch (e: unknown) { 
      const errorMessage = e instanceof Error ? e.message : String(e);
      console.warn(`Could not parse genres for user ${row.user_id} (${row.genres}): ${errorMessage}`);
    // ▲▲▲
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

    const allSimilarities: SimilarityData[] = [];
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
          commonArtists: JSON.stringify(Array.from(commonArtists)),
          commonGenres: JSON.stringify(Array.from(commonGenres)),
        });
      }
    }
    console.log(`[Batch] Step 2: Calculated ${allSimilarities.length} similarity pairs.`);

    await client.query('TRUNCATE TABLE similarities CASCADE');
    
    if (allSimilarities.length > 0) {
      const simValues: (string | number | null)[] = [];
      const simQueryRows = allSimilarities.map((sim, index) => {
        const i = index * 7;
        simValues.push(
          sim.userA, sim.userB, sim.artistSim, sim.genreSim, 
          sim.combinedSim, sim.commonArtists, sim.commonGenres
        );
        return `($${i + 1}, $${i + 2}, $${i + 3}, $${i + 4}, $${i + 5}, $${i + 6}, $${i + 7})`;
      });
      const simInsertQuery = `
        INSERT INTO similarities (user_a_id, user_b_id, artist_similarity, genre_similarity, combined_similarity, common_artists, common_genres)
        VALUES ${simQueryRows.join(', ')}
      `;
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

    const communityAssignments = louvain(graph, { 
      resolution: 1.0, 
      weighted: true 
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
    console.log(`[Batch] Step 5 & 6: Communities detected and saved to DB.`);

    await client.query('COMMIT');
    console.log('[Batch] === Success: All calculations committed. ===');
    res.status(200).json({ 
      message: 'Batch calculation successful.',
      users: userIds.length,
      pairs: allSimilarities.length,
      edges: graph.size,
      communities: new Set(Object.values(communityAssignments)).size
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