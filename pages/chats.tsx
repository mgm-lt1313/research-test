// pages/chats.tsx
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import Image from 'next/image';
import Link from 'next/link';

// マッチ済みの相手の型
interface ApprovedMatch {
  match_id: number; // followsテーブルのID (チャットルームID)
  other_user: {
    id: string; // 相手のuser ID (uuid)
    nickname: string;
    profile_image_url: string | null;
  };
}

export default function Chats() {
  const router = useRouter();
  // ▼▼▼ 修正: LocalStorage からのフォールバックを追加 ▼▼▼
  const [spotifyUserId, setSpotifyUserId] = useState<string | undefined>(router.query.spotifyUserId as string | undefined);
  
  useEffect(() => {
    if (router.isReady && !spotifyUserId) {
        const storedId = localStorage.getItem('spotify_user_id');
        if (storedId) {
            setSpotifyUserId(storedId);
        }
    }
  }, [router.isReady, spotifyUserId]);
  // ▲▲▲ 修正ここまで ▲▲▲

  const [matches, setMatches] = useState<ApprovedMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!spotifyUserId) {
        if(router.isReady) {
            setError('ユーザー情報がありません。');
            setLoading(false);
        }
        return;
    }
    // ▲▲▲ 修正ここまで ▲▲▲

    const fetchMatches = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await axios.get(`/api/chat/list?spotifyUserId=${spotifyUserId}`);
        setMatches(res.data.approvedMatches || []);
      } catch (e: unknown) {
         console.error("Failed to fetch chat lists:", e);
         setError('チャットリストの取得に失敗しました。');
      } finally {
        setLoading(false);
      }
    };
    fetchMatches();
  }, [spotifyUserId, router.isReady]); // 👈 spotifyUserId が変更されたら再実行

  if (loading) return <div className="p-4 text-center">読み込み中...</div>;
  if (error) return <div className="p-4 text-center text-red-500">{error}</div>;

  return (
    <div className="p-4 max-w-lg mx-auto text-white">
      {/* ▼▼▼ 修正: [cite] 削除 ▼▼▼ */}
      <h1 className="text-3xl font-bold mb-6">チャット</h1>

      {/* --- マッチ一覧 (チャットルームへのリンク) --- */}
      <section>
        {matches.length > 0 ? (
          <ul className="space-y-3">
            {matches.map(match => (
              <li key={match.match_id}>
                {/* チャットルームへのリンク */}
                <Link
                  href={`/chat/${match.match_id}?selfSpotifyId=${spotifyUserId}&otherUserId=${match.other_user.id}&otherNickname=${encodeURIComponent(match.other_user.nickname)}&otherImageUrl=${encodeURIComponent(match.other_user.profile_image_url || '')}`}
                  className="block bg-gray-800 p-4 rounded-lg flex items-center space-x-4 hover:bg-gray-700 transition-colors duration-150 shadow"
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