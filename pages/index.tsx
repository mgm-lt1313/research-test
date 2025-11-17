// pages/index.tsx
import Head from 'next/head';
import Link from 'next/link'; // Link コンポーネントをインポート

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-2">
      <Head>
        <title>Spotify音楽嗜好マッチング</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="flex flex-col items-center justify-center w-full flex-1 px-20 text-center">
        <h1 className="text-4xl font-bold mb-6">
          Spotifyマッチングシステム
        </h1>

        
        {/* 修正: <a> タグを <Link> コンポーネントで囲む */}
        <Link href="/api/login" className="px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-green-600 hover:bg-green-700 md:py-4 md:text-lg md:px-10">
          Spotifyでログイン
        </Link>
      </main>
    </div>
  );
}