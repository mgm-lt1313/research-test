// pages/_app.tsx
import '../styles/globals.css'; // 👈 ステップ2で作成したCSSをインポート
import type { AppProps } from 'next/app';
import Head from 'next/head';

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <title>Spotify音楽嗜好マッチング</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>
      {/* 以下の 'dark' クラスと背景色(bg-gray-900)を
        アプリケーション全体に適用します 
      */}
      <div className="dark min-h-screen bg-gray-900 text-white">
        <Component {...pageProps} />
      </div>
    </>
  );
}

export default MyApp;