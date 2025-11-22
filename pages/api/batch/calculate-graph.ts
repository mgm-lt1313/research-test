import type { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const client = await pool.connect();
  try {
    // 1. 全ユーザーのタグを取得
    const dbRes = await client.query('SELECT user_id, hobby_name FROM user_hobbies'); // 名前を変更
    const userHobbies = new Map<string, Set<string>>();

    for (const row of dbRes.rows) { // ここも変更
      if (!userHobbies.has(row.user_id)) userHobbies.set(row.user_id, new Set());
      userHobbies.get(row.user_id)!.add(row.hobby_name);
    }
    
    const userIds = Array.from(userHobbies.keys());
    const matches = [];

    // 2. 総当たりで一致数を計算
    for (let i = 0; i < userIds.length; i++) {
      for (let j = i + 1; j < userIds.length; j++) {
        const userA = userIds[i];
        const userB = userIds[j];
        const tagsA = userHobbies.get(userA)!;
        const tagsB = userHobbies.get(userB)!;

        // 共通タグ
        const commonTags = [...tagsA].filter(tag => tagsB.has(tag));
        const matchCount = commonTags.length;
        
        // Jaccardスコア (表示上の%用)
        const unionCount = new Set([...tagsA, ...tagsB]).size;
        const score = unionCount === 0 ? 0 : matchCount / unionCount;

        if (matchCount > 0) {
          matches.push({
            userA, userB, score, matchCount, commonTags
          });
        }
      }
    }

    // 3. DB保存
    await client.query('TRUNCATE TABLE similarities CASCADE');
    
    if (matches.length > 0) {
      const values = matches.map(m => {
        return `('${m.userA}', '${m.userB}', ${m.score}, ${m.matchCount}, '${JSON.stringify(m.commonTags)}')`;
      }).join(',');
      
      await client.query(`
        INSERT INTO similarities (user_a_id, user_b_id, score, match_count, common_tags)
        VALUES ${values}
      `);
    }

    // ※グラフ構築・コミュニティ検出が必要であればここに続けて実装
    
    res.status(200).json({ count: matches.length });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: String(e) });
  } finally {
    client.release();
  }
}