/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com', // Googleアカウントのアイコン用
      },
      {
        protocol: 'https',
        hostname: 'i.scdn.co', // 旧Spotifyのアイコン用（念のため残しています）
      },
      {
        protocol: 'https',
        // ▼▼▼ あなたのプロジェクトIDを設定しました ▼▼▼
        hostname: 'nymwqvdowrvmgzlomsom.supabase.co', 
      },
    ],
  },
  eslint: {
    // ビルド時にESLintエラーがあってもビルドを続行する
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;