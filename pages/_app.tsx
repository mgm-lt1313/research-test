import '../styles/globals.css';
import type { AppProps } from 'next/app';
import Head from 'next/head';
import NavBar from '../components/NavBar'; // 👈 1. NavBar をインポート
import { useRouter } from 'next/router'; // 👈 2. useRouter をインポート

function MyApp({ Component, pageProps }: AppProps) {
  const router = useRouter(); // 👈 3. router を取得
  
  // ログインページでは NavBar を表示しない
  const showNavBar = router.pathname !== '/';

  return (
    <>
      <Head>
        <title>Spotify音楽嗜好マッチング</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>
      <div className="dark min-h-screen bg-gray-900 text-white">
        
        {/* 👈 4. コンテンツエリアを修正 (padding-bottom を追加) */}
        <main className="pb-20"> 
          <Component {...pageProps} />
        </main>

        {/* 👈 5. NavBar を表示 */}
        {showNavBar && <NavBar />}
      </div>
    </>
  );
}

export default MyApp;