import type { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const { match_id: matchIdStr } = req.query;
    
    // GETの場合はクエリから、POSTの場合はボディから userId (senderId) を取得
    const userId = (req.method === 'GET' ? req.query.userId : req.body.senderId) as string;

    if (!matchIdStr || typeof matchIdStr !== 'string') {
        return res.status(400).json({ message: 'Invalid match_id' });
    }
    const matchId = parseInt(matchIdStr, 10);

    if (!userId) {
        return res.status(401).json({ message: 'Missing userId' });
    }

    try {
        // 権限チェック: このチャットルーム(match_id)の参加者か？
        const authCheck = await pool.query(
            `SELECT 1 FROM follows
             WHERE id = $1 AND (follower_id = $2 OR following_id = $2) AND status = 'approved'`,
            [matchId, userId]
        );
        
        if (authCheck.rowCount === 0) {
            return res.status(403).json({ message: 'Access denied' });
        }

        if (req.method === 'GET') {
            // メッセージ取得
            const messagesRes = await pool.query(
                `SELECT id, created_at, sender_id, content
                 FROM messages
                 WHERE match_id = $1
                 ORDER BY created_at ASC`,
                [matchId]
            );
            res.status(200).json({ messages: messagesRes.rows });

        } else if (req.method === 'POST') {
            // メッセージ送信
            const { content } = req.body;
            if (!content || typeof content !== 'string' || !content.trim()) {
                return res.status(400).json({ message: 'Empty content' });
            }

            const insertRes = await pool.query(
                `INSERT INTO messages (match_id, sender_id, content)
                 VALUES ($1, $2, $3)
                 RETURNING id, created_at, sender_id, content`,
                [matchId, userId, content.trim()]
            );

            res.status(201).json({ message: 'Sent', newMessage: insertRes.rows[0] });

        } else {
            res.status(405).end();
        }

    } catch (dbError) {
        console.error('Chat API Error:', dbError);
        res.status(500).json({ message: 'Database error' });
    }
}