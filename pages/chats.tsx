// pages/chats.tsx
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import Image from 'next/image';
import Link from 'next/link';

// ... (型定義 ApprovedMatch は変更なし) ...
interface ApprovedMatch { /* ... */ }

export default function Chats() {
  // ... (ロジックは変更なし) ...
  const router = useRouter();
  const [spotifyUserId, setSpotifyUserId] = useState<string | undefined>(/* ... */);
  useEffect(() => { /* ... */ }, [router.isReady, spotifyUserId]);
  const [matches, setMatches] = useState<ApprovedMatch[]>([]);
  // ...

  // ... (loading, error の return は変更なし) ...

  return (
    <div className="p-4 max-w-lg mx-auto text-white">
      <h1 className="text-3xl font-bold mb-6">チャット</h1>

      <section>
        {matches.length > 0 ? (
          <ul className="space-y-3">
            {matches.map(match => (
              // ▼▼▼ li を flex コンテナに変更 ▼▼▼
              <li 
                key={match.match_id}
                className="bg-gray-800 p-4 rounded-lg flex items-center justify-between space-x-4 shadow"
              >
                {/* 1. チャットルームへのリンク (flex-grow) */}
                <Link
                  href={`/chat/${match.match_id}?selfSpotifyId=${spotifyUserId}&otherUserId=${match.other_user.id}&otherNickname=${encodeURIComponent(match.other_user.nickname)}&otherImageUrl=${encodeURIComponent(match.other_user.profile_image_url || '')}`}
                  className="flex items-center space-x-4 hover:bg-gray-700 transition-colors duration-150 p-2 rounded-l-md -m-2 flex-grow min-w-0" // 👈 p-2, -m-2 でクリック範囲拡大
                >
                  {match.other_user.profile_image_url ? (
                    <Image src={match.other_user.profile_image_url} alt={match.other_user.nickname} width={48} height={48} className="w-12 h-12 rounded-full object-cover flex-shrink-0" />
                  ) : (
                     <div className="w-12 h-12 rounded-full bg-gray-600 flex-shrink-0"></div>
                  )}
                  <div className="overflow-hidden">
                    <h3 className="font-bold text-lg truncate">{match.other_user.nickname}</h3>
                    <p className="text-gray-300 text-sm truncate">(チャットを開始する)</p>
                  </div>
                </Link>
                
                {/* 2. ユーザー詳細への「...」リンク (flex-shrink-0) */}
                <Link 
                  href={{
                      pathname: `/user/${match.other_user.id}`,
                      query: { selfSpotifyId: spotifyUserId }
                  }}
                  className="text-gray-400 hover:text-white p-2 rounded-full hover:bg-gray-700 flex-shrink-0"
                  title="ユーザー詳細を見る"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                  </svg>
                </Link>
                {/* ▲▲▲ 修正ここまで ▲▲▲ */}
                
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-400 text-sm">チャット可能なユーザーがいません。</p>
        )}
      </section>
    </div>
  );
}