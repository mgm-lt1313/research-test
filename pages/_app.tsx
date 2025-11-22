import '../styles/globals.css';
import type { AppProps } from 'next/app';
import Head from 'next/head';
import Header from '../components/Header';
import { useRouter } from 'next/router';

function MyApp({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const showNavigation = router.pathname !== '/'; // ログイン画面以外でヘッダーを表示

  return (
    <>
      <Head>
        {/* ▼▼▼ ここを修正 ▼▼▼ */}
        <title>趣味マッチング</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>
      
      <div className="min-h-screen bg-gray-900 text-white">
        {showNavigation && <Header />}
        <main className={showNavigation ? "pt-20" : ""}> 
          <Component {...pageProps} />
        </main>
      </div>
    </>
  );
}

export default MyApp;