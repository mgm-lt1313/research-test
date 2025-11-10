// pages/api/match/get-recommendations.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../../lib/db';
// 

// 内部UUIDを取得するヘルパー (pool.query を直接使う)
async function getUserIdBySpotifyId(spotifyUserId: string): Promise<string | null> {
    const res = await pool.query('SELECT id FROM users WHERE spotify_user_id = $1', [spotifyUserId]);
    return res.rows.length > 0 ? res.rows[0].id : null;
}

// 自分のコミュニティIDを取得するヘルパー (pool.query を直接使う)
async function getMyCommunityId(selfId: string): Promise<number | null> {
    const res = await pool.query('SELECT community_id FROM communities WHERE user_id = $1', [selfId]);
    return res.rows.length > 0 ? res.rows[0].community_id : null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }
    const { spotifyUserId } = req.body;
    if (!spotifyUserId) {
        return res.status(400).json({ message: 'Missing spotifyUserId.' });
    }

    try {
        // 
        const selfId = await getUserIdBySpotifyId(spotifyUserId);
        if (!selfId) {
            return res.status(404).json({ message: 'User not found.' });
        }

        const myCommunityId = await getMyCommunityId(selfId);
        
        // 設計書 6.2 (マッチングスコア) と 6.3 (多様性) に基づくクエリ
        const query = `
            WITH MySimilarities AS (
                -- 自分に関連する類似度をすべて取得 (自分がAでもBでも対応)
                SELECT
                    CASE WHEN user_a_id = $1 THEN user_b_id ELSE user_a_id END AS other_user_id,
                    artist_similarity,
                    genre_similarity,
                    combined_similarity,
                    common_artists,
                    common_genres
                FROM similarities
                WHERE (user_a_id = $1 OR user_b_id = $1)
                  AND combined_similarity >= 0.20 -- 閾値 (設計書 4.3)
            ),
            MatchesWithCommunity AS (
                -- 相手のコミュニティIDとプロフィールを紐付け
                SELECT
                    s.other_user_id,
                    s.artist_similarity,
                    s.genre_similarity,
                    s.combined_similarity,
                    s.common_artists,
                    s.common_genres,
                    c.community_id,
                    u.nickname,
                    u.profile_image_url,
                    u.bio,
                    -- 設計書 6.2: コミュニティボーナス
                    (s.combined_similarity + (CASE WHEN c.community_id = $2 THEN 0.2 ELSE 0 END)) AS match_score,
                    (c.community_id = $2) AS is_same_community
                FROM MySimilarities s
                JOIN users u ON s.other_user_id = u.id
                LEFT JOIN communities c ON s.other_user_id = c.user_id
            )
            -- スコア順にソートして上位10件 (設計書 6.1)
            SELECT *
            FROM MatchesWithCommunity
            ORDER BY match_score DESC
            LIMIT 10;
        `;
        
        // pool.query を直接呼び出す
        const { rows } = await pool.query(query, [selfId, myCommunityId]);

        res.status(200).json({ matches: rows });
        // 

    } catch (dbError) {
        console.error('Recommendation calculation failed:', dbError);
        res.status(500).json({ message: 'Failed to get recommendations.' });
    }
    // finally { client.release() } は不要
}