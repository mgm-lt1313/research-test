// pages/follows.tsx
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import Image from 'next/image';
import Link from 'next/link';

// 型定義
interface FollowUser {
  id: number; // followsテーブルのID
  user_id: string; // 相手のuser ID (uuid)
  nickname: string;
  profile_image_url: string | null;
}
interface MatchUser {
  id: number; // followsテーブルのID (チャットルームID)
  user_id: string; // 相手のuser ID (uuid)
  nickname: string;
  profile_image_url: string | null;
}

export default function Follows() {
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

  const [followers, setFollowers] = useState<FollowUser[]>([]); 
  const [pending, setPending] = useState<FollowUser[]>([]);     
  const [matches, setMatches] = useState<MatchUser[]>([]);       
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acceptingId, setAcceptingId] = useState<number | null>(null);

  useEffect(() => {
    if (!spotifyUserId) {
        if (router.isReady) { // router.isReady かつ spotifyUserId が未定義の場合のみエラー
            setError('ユーザー情報がありません。');
            setLoading(false);
        }
        return;
    }
    // ▲▲▲ 修正ここまで ▲▲▲

    const fetchLists = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await axios.get(`/api/follow/list?spotifyUserId=${spotifyUserId}`);
        setFollowers(res.data.pendingRequestsToMe || []);
        setPending(res.data.pendingRequestsFromMe || []);
        setMatches(res.data.approvedMatches || []);
      } catch (e: unknown) {
         console.error("Failed to fetch follow lists:", e);
         setError('リストの取得に失敗しました。');
      } finally {
        setLoading(false);
      }
    };
    fetchLists();
  }, [spotifyUserId, router.isReady]); // 👈 spotifyUserId が変更されたら再実行

  const handleAccept = async (followId: number) => {
    if (!spotifyUserId || acceptingId) return;
    setAcceptingId(followId);
    try {
      await axios.post('/api/follow/accept', {
        selfSpotifyId: spotifyUserId,
        followId: followId,
      });
      router.reload();
    } catch (e: unknown) {
      console.error("Failed to accept follow request:", e);
      alert('承認に失敗しました。');
      setAcceptingId(null);
    }
  };

  if (loading) return <div className="p-4 text-center">読み込み中...</div>;
  if (error) return <div className="p-4 text-center text-red-500">{error}</div>;
  
  const userDetailLink = (userId: string) => ({
      pathname: `/user/${userId}`,
      query: { selfSpotifyId: spotifyUserId }
  });

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
                    {/* ▼▼▼ 修正: [cite] 削除 ▼▼▼ */}
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
                  {/* ▼▼▼ 修正: [cite] 削除 ▼▼▼ */}
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
                  {/* ▼▼▼ 修正: [cite] 削除 ▼▼▼ */}
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