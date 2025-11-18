// pages/api/batch/calculate-graph.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../../lib/db';
import { PoolClient } from 'pg';
import Graph from 'graphology';
import louvain from 'graphology-communities-louvain';

// 共通アーティストの型
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

type UserDataMap = Map<string, {
  artists: Set<string>;
  genres: Set<string>;
}>;

function calculateJaccard(setA: Set<string>, setB: Set<string>): { similarity: number, intersection: Set<string> } {
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
    } catch (e: unknown) { 
      const errorMessage = e instanceof Error ? e.message : String(e);
      console.warn(`Could not parse genres for user ${row.user_id} (${row.genres}): ${errorMessage}`);
    }
  }

  return { userMap, artistInfoMap }; // 👈 2つのMapを返す
}


// APIメインハンドラ
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed. Use GET to trigger.' });
  }

  console.log('[Batch] === Start: Similarity & Graph Calculation ===');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // ▼▼▼ 戻り値の受け取り方を変更 ▼▼▼
    const { userMap, artistInfoMap } = await getAllArtistData(client);
    const userIds = Array.from(userMap.keys());
    // ▲▲▲ 修正ここまで ▲▲▲

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
        
        const dataA = userMap.get(userA_id)!;
        const dataB = userMap.get(userB_id)!;

        // ▼▼▼ 共通アーティストIDを取得し、{名前, URL} オブジェクトに変換 ▼▼▼
        const { similarity: artistSim, intersection: commonArtistIds } = calculateJaccard(dataA.artists, dataB.artists);
        const { similarity: genreSim, intersection: commonGenres } = calculateJaccard(dataA.genres, dataB.genres);

        // 共通アーティストの「ID」を「{名前, URL}」に変換
        const commonArtists = Array.from(commonArtistIds)
            .map(id => artistInfoMap.get(id)) // IDを情報オブジェクトにマッピング
            .filter((info): info is CommonArtistInfo => !!info); // undefined を除去

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
          commonArtists: commonArtists,       // 👈 オブジェクトの配列
          commonGenres: Array.from(commonGenres),
        });
      }
    }
    console.log(`[Batch] Step 2: Calculated ${allSimilarities.length} similarity pairs.`);

    await client.query('TRUNCATE TABLE similarities CASCADE');
    
    if (allSimilarities.length > 0) {
      const simValues: (string | number | null | string[])[] = []; 
      const simQueryRows = allSimilarities.map((sim, index) => {
        const i = index * 7;
        simValues.push(
          sim.userA, sim.userB, sim.artistSim, sim.genreSim, 
          sim.combinedSim, 
          JSON.stringify(sim.commonArtists), // 👈 オブジェクト配列をJSON化
          JSON.stringify(sim.commonGenres)
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

    // ... (以降のグラフ構築、Louvain法、レスポンス部分は変更なし) ...
    const graph = new Graph();
    const similarityThreshold = 0.15;

    for (const userId of userIds) {
      graph.addNode(userId);
    }

    for (const sim of allSimilarities) {
      if (sim.combinedSim >= similarityThreshold) {
        graph.addUndirectedEdge(sim.userA, sim.userB, { weight: sim.combinedSim });
      }
    }
    console.log(`[Batch] Step 4: Graph built (${graph.order} nodes, ${graph.size} edges).`);

    let communityAssignments: { [key: string]: number } = {};
    let communityCount = 0;

    if (graph.size > 0) {
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
      
      communityCount = new Set(Object.values(communityAssignments)).size;
      console.log(`[Batch] Step 5 & 6: Communities detected (${communityCount}) and saved to DB.`);
    
    } else {
      console.log(`[Batch] Step 5 & 6: Skipped community detection (no edges in graph).`);
      await client.query('TRUNCATE TABLE communities CASCADE'); 
    }

    await client.query('COMMIT');
    console.log('[Batch] === Success: All calculations committed. ===');
    
    res.status(200).json({ 
      message: 'Batch calculation successful.',
      users: userIds.length,
      pairs: allSimilarities.length,
      edges: graph.size,
      communities: communityCount
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