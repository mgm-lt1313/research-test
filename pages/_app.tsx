import '../styles/globals.css';
import type { AppProps } from 'next/app';
import Head from 'next/head';
import Header from '../components/Header';
import { useRouter } from 'next/router';

function MyApp({ Component, pageProps }: AppProps) {
  const router = useRouter(); 
  const showNavigation = router.pathname !== '/';

  return (
    <>
      <Head>
        <title>趣味マッチング</title> {/* 修正箇所 */}
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>
      
      <div className="dark min-h-screen bg-gray-900 text-white">
        {showNavigation && <Header />}
        <main className="pt-20"> 
          <Component {...pageProps} />
        </main>
      </div>
    </>
  );
}

export default MyApp;