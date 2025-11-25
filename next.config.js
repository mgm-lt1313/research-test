/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com', // Googleアイコン用
      },
      {
        protocol: 'https',
        hostname: 'i.scdn.co', // 旧Spotify用（念のため）
      },
      {
        // あなたのSupabaseのドメイン (例: xxxxx.supabase.co)
        // Vercelのログでエラーが出る場合は、SupabaseダッシュボードのURLを確認して合わせてください
        protocol: 'https',
        hostname: 'yboauknclliydigxwtju.supabase.co', 
      },
    ],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;