// pages/follows.tsx
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import Image from 'next/image';
import Link from 'next/link';

// ... (型定義 FollowUser, MatchUser は変更なし) ...
interface FollowUser { /* ... */ }
interface MatchUser { /* ... */ }

export default function Follows() {
  // ... (useState, useEffect, handleAccept などのロジックは変更なし) ...
  const router = useRouter();
  const [spotifyUserId, setSpotifyUserId] = useState<string | undefined>(/* ... */);
  useEffect(() => { /* ... */ }, [router.isReady, spotifyUserId]);
  const [followers, setFollowers] = useState<FollowUser[]>([]); 
  const [pending, setPending] = useState<FollowUser[]>([]);     
  const [matches, setMatches] = useState<MatchUser[]>([]);       
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acceptingId, setAcceptingId] = useState<number | null>(null);
  useEffect(() => { /* ... */ }, [spotifyUserId, router.isReady]);
  const handleAccept = async (followId: number) => { /* ... */ };
  // ... (loading, error の return は変更なし) ...
  const userDetailLink = (userId: string) => ({ /* ... */ });


  return (
    <div className="p-4 max-w-lg mx-auto text-white">
      <h1 className="text-3xl font-bold mb-6">フォロー</h1>

      {/* ▼▼▼ 1. 順序変更: 相互フォロー (旧フォロー一覧) ▼▼▼ */}
      <section className="mb-8">
        {/* ▼ 文言変更 ▼ */}
        <h2 className="text-xl font-semibold mb-4 border-b border-gray-700 pb-2">相互フォロー</h2>
        {matches.length > 0 ? (
          <ul className="space-y-3">
            {matches.map(match => (
              <li key={match.id}>
                <Link href={userDetailLink(match.user_id)} className="block bg-gray-700 p-4 rounded-lg flex items-center space-x-4 hover:bg-gray-600 transition-colors duration-150 shadow">
                  {match.profile_image_url ? (
                    <Image src={match.profile_image_url} alt={match.nickname} width={48} height={48} className="w-12 h-12 rounded-full object-cover flex-shrink-0" />
                  ) : (
                     <div className="w-12 h-12 rounded-full bg-gray-600 flex-shrink-0"></div>
                  )}
                  <div className="overflow-hidden">
                    <h3 className="font-bold text-lg truncate">{match.nickname}</h3>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-400 text-sm">相互フォローのユーザーはいません。</p>
        )}
      </section>

      {/* ▼▼▼ 2. 順序変更: フォロワー (旧フォロワー一覧) ▼▼▼ */}
      <section className="mb-8">
        {/* ▼ 文言変更 ▼ */}
        <h2 className="text-xl font-semibold mb-4 border-b border-gray-700 pb-2">フォロワー</h2>
        {followers.length > 0 ? (
          <ul className="space-y-3">
            {followers.map(req => (
              <li key={req.id} className="bg-gray-800 p-3 rounded-lg flex justify-between items-center shadow">
                <Link href={userDetailLink(req.user_id)} className="flex items-center space-x-3 overflow-hidden mr-2">
                  {req.profile_image_url ? (
                    <Image src={req.profile_image_url} alt={req.nickname} width={40} height={40} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                  ): (
                    <div className="w-10 h-10 rounded-full bg-gray-600 flex-shrink-0"></div>
                  )}
                  <span className="font-medium truncate">{req.nickname}</span>
                </Link>
                <button
                  onClick={() => handleAccept(req.id)}
                  disabled={acceptingId === req.id}
                  className={`px-3 py-1 rounded text-sm font-semibold flex-shrink-0 ${
                    acceptingId === req.id
                     ? 'bg-gray-500 cursor-wait'
                     : 'bg-green-600 hover:bg-green-700'
                  }`}
                >
                  {acceptingId === req.id ? '承認中...' : '承認する'}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-400 text-sm">あなたをフォローしているユーザーはいません。</p>
        )}
      </section>
      
      {/* ▼▼▼ 3. 順序変更: フォロー (旧承認待ち) ▼▼▼ */}
      <section className="mb-8">
        {/* ▼ 文言変更 ▼ */}
        <h2 className="text-xl font-semibold mb-4 border-b border-gray-700 pb-2">フォロー</h2>
        {pending.length > 0 ? (
          <ul className="space-y-3">
            {pending.map(req => (
              <li key={req.id} className="bg-gray-800 p-3 rounded-lg flex justify-between items-center shadow">
                <Link href={userDetailLink(req.user_id)} className="flex items-center space-x-3 overflow-hidden mr-2">
                  {req.profile_image_url ? (
                    <Image src={req.profile_image_url} alt={req.nickname} width={40} height={40} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                  ): (
                    <div className="w-10 h-10 rounded-full bg-gray-600 flex-shrink-0"></div>
                  )}
                  <span className="font-medium truncate">{req.nickname}</span>
                </Link>
                <span className="text-sm text-gray-400 flex-shrink-0">承認待ち</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-400 text-sm">あなたがフォロー中のユーザーはいません。</p>
        )}
      </section>

    </div>
  );
}