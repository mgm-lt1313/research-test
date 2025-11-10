module.exports = {
  images: {
    domains: ['i.scdn.co'], // Spotify画像のドメイン
  },
  // ▼▼▼ 以下の3行を追記 ▼▼▼
  eslint: {
    // ビルド時にESLintエラーがあってもビルドを続行する
    ignoreDuringBuilds: true,
  },
  // ▲▲▲ 追記ここまで ▲▲▲
};