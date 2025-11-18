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
      
      {/* ▼▼▼ この div のクラス名を変更します ▼▼▼ */}
      <div className="min-h-screen bg-white text-gray-900">
      {/* 変更点：
        1. `dark` を削除
        2. `bg-gray-900` を `bg-white` に変更
        3. `text-white` を `text-gray-900` に変更
      */}
      {/* ▲▲▲ 変更ここまで ▲▲▲ */}
        
        {showNavigation && <Header />}

        <main className="pt-20"> 
          <Component {...pageProps} />
        </main>
        
      </div>
    </>
  );
}

export default MyApp;