// pages/api/match/get-recommendations.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../../lib/db';

// (getUserIdBySpotifyId, getMyCommunityId ヘルパー関数は変更なし)
async function getUserIdBySpotifyId(spotifyUserId: string): Promise<string | null> {
    const res = await pool.query('SELECT id FROM users WHERE spotify_user_id = $1', [spotifyUserId]);
    return res.rows.length > 0 ? res.rows[0].id : null;
}
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
        const selfId = await getUserIdBySpotifyId(spotifyUserId);
        if (!selfId) {
            return res.status(404).json({ message: 'User not found.' });
        }

        const myCommunityId = await getMyCommunityId(selfId);
        
        // ▼▼▼【修正】common_artists と common_genres を ::text にキャスト ▼▼▼
        const baseQuery = `
            WITH MySimilarities AS (
                SELECT
                    CASE WHEN user_a_id = $1 THEN user_b_id ELSE user_a_id END AS other_user_id,
                    artist_similarity,
                    genre_similarity,
                    combined_similarity,
                    common_artists::text, 
                    common_genres::text
                FROM similarities
                WHERE (user_a_id = $1 OR user_b_id = $1)
            ),
            MatchesWithCommunity AS (
                SELECT
                    s.other_user_id,
                    s.artist_similarity,
                    s.genre_similarity,
                    s.combined_similarity,
                    s.common_artists,    -- 👈 textとして受け取る
                    s.common_genres,     -- 👈 textとして受け取る
                    c.community_id,
                    u.nickname,
                    u.profile_image_url,
                    u.bio,
                    (s.combined_similarity + (CASE WHEN c.community_id = $2 THEN 0.2 ELSE 0 END)) AS match_score,
                    (c.community_id = $2) AS is_same_community
                FROM MySimilarities s
                JOIN users u ON s.other_user_id = u.id
                LEFT JOIN communities c ON s.other_user_id = c.user_id
            ),
            MatchesWithFollowStatus AS (
                SELECT
                    m.*,
                    f.status AS follow_status,
                    (f.follower_id = $1) AS i_am_follower
                FROM MatchesWithCommunity m
                LEFT JOIN follows f ON
                    (f.follower_id = $1 AND f.following_id = m.other_user_id) OR
                    (f.follower_id = m.other_user_id AND f.following_id = $1)
            )
            SELECT *
            FROM MatchesWithFollowStatus
        `;
        // ▲▲▲ 修正ここまで ▲▲▲
        
        // (Tier 1 クエリは変更なし)
        const primaryQuery = `
            ${baseQuery}
            WHERE combined_similarity >= 0.20
            ORDER BY match_score DESC
            LIMIT 10;
        `;
        
        let { rows } = await pool.query(primaryQuery, [selfId, myCommunityId]);

        // (Tier 2 クエリは変更なし)
        if (rows.length === 0) {
            console.log(`[get-recommendations] No matches found >= 0.20 for user ${selfId}. Running fallback query.`);
            const fallbackQuery = `
                ${baseQuery}
                WHERE combined_similarity > 0 
                ORDER BY match_score DESC
                LIMIT 10;
            `;
            const fallbackResult = await pool.query(fallbackQuery, [selfId, myCommunityId]);
            rows = fallbackResult.rows;
        }

        // (JSONパース処理は変更なし - textをパースするので正しい)
        const matches = rows.map(row => ({
          ...row,
          common_artists: JSON.parse(row.common_artists || '[]'),
          common_genres: JSON.parse(row.common_genres || '[]'),
        }));

        res.status(200).json({ matches: matches });

    } catch (dbError) {
        console.error('Recommendation calculation failed:', dbError);
        res.status(500).json({ message: 'Failed to get recommendations.' });
    }
}