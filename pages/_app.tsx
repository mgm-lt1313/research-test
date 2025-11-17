// pages/_app.tsx
import '../styles/globals.css';
import type { AppProps } from 'next/app';
import Head from 'next/head';
// import NavBar from '../components/NavBar'; // 👈 1. NavBar のインポートを削除
import Header from '../components/Header';
import { useRouter } from 'next/router';

function MyApp({ Component, pageProps }: AppProps) {
  const router = useRouter(); 
  
  const showNavigation = router.pathname !== '/';

  return (
    <>
      <Head>
        <title>Spotify音楽嗜好マッチング</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>
      {/* ▼▼▼ 修正: スタイリングが適用されるよう class を確認 ▼▼▼ */}
      <div className="dark min-h-screen bg-gray-900 text-white">
        
        {showNavigation && <Header />}

        {/* ▼▼▼ 修正: pb-20 (フッターパディング) を削除 ▼▼▼ */}
        <main className="pt-20"> 
          <Component {...pageProps} />
        </main>

        {/* 👈 4. NavBar (フッター) の呼び出しを削除 */}
        {/* {showNavigation && <NavBar />} */}
      </div>
      {/* ▲▲▲ 修正ここまで ▲▲▲ */}
    </>
  );
}

export default MyApp;