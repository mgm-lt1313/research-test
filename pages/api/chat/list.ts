// pages/api/chat/list.ts
// (チャットページ [cite: 77] 専用の、承認済みマッチのみを取得するAPI)
import type { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../../lib/db';

async function getUserIdBySpotifyId(spotifyUserId: string): Promise<string | null> {
    const res = await pool.query('SELECT id FROM users WHERE spotify_user_id = $1', [spotifyUserId]);
    return res.rows.length > 0 ? res.rows[0].id : null;
}

interface MatchProfile {
    id: string; // users.id (uuid)
    nickname: string;
    profile_image_url: string | null;
}
interface ApprovedMatchResult {
  match_id: number; // follows.id (bigint) - チャットルームID
  other_user: MatchProfile | undefined;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') return res.status(405).end();
    const { spotifyUserId } = req.query;
    if (!spotifyUserId || typeof spotifyUserId !== 'string') {
        return res.status(400).json({ message: 'Missing spotifyUserId.' });
    }

    try {
        const selfId = await getUserIdBySpotifyId(spotifyUserId);
        if (!selfId) return res.status(404).json({ message: 'User not found.' });

        // 成立済みのマッチングのみ取得
        const approvedMatches = await pool.query(
            `SELECT
                f.id as match_id,
                CASE
                    WHEN f.follower_id = $1 THEN f.following_id
                    ELSE f.follower_id
                END as other_user_id
             FROM follows f
             WHERE (f.follower_id = $1 OR f.following_id = $1)
               AND f.status = 'approved'`,
            [selfId]
        );

        const otherUserIds = approvedMatches.rows.map(r => r.other_user_id);
        let matchesWithProfiles: ApprovedMatchResult[] = [];

        if (otherUserIds.length > 0) {
            const usersRes = await pool.query(
                'SELECT id, nickname, profile_image_url FROM users WHERE id = ANY($1::uuid[])',
                [otherUserIds]
            );
            
            const userProfileMap = new Map<string, MatchProfile>(
                usersRes.rows.map(u => [u.id, { id: u.id, nickname: u.nickname, profile_image_url: u.profile_image_url }])
            );

            matchesWithProfiles = approvedMatches.rows.map(match => ({
                match_id: match.match_id,
                other_user: userProfileMap.get(match.other_user_id)
            }));
        }

        res.status(200).json({ approvedMatches: matchesWithProfiles });

    } catch (dbError: unknown) {
        console.error('Failed to list chats:', dbError);
        res.status(500).json({ message: 'Database error while fetching chat lists.' });
    }
}