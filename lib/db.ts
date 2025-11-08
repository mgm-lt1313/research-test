import { Pool, PoolConfig } from 'pg';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set in .env.local');
}

let config: PoolConfig;

try {
  // 開発サーバーのバグを回避するため、DATABASE_URLを手動で解析
  const dbUrl = new URL(process.env.DATABASE_URL);

  config = {
    user: dbUrl.username,
    password: dbUrl.password,
    host: dbUrl.hostname,
    port: Number(dbUrl.port),
    database: dbUrl.pathname.split('/')[1], // 先頭の '/' を除去
    ssl: { rejectUnauthorized: false }, // Supabaseへの接続は常にSSLを必須にする
    
    // ▼▼▼ ここが今回の修正点です ▼▼▼
    // IPv6での接続がタイムアウトするため、IPv4を強制する
    family: 4,
    // ▲▲▲
  };
  
} catch (e) {
  // 手動解析に失敗した場合 (例: Vercelの本番環境など)
  console.warn("Could not parse DATABASE_URL manually, falling back to connectionString. This is expected in Vercel production.");
  config = {
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  };
}

// PostgreSQL接続プールを作成
const pool = new Pool(config);

// データベース接続テスト (起動時に一度だけ実行)
pool.on('connect', () => {
  console.log('Database connected!');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

export default pool;