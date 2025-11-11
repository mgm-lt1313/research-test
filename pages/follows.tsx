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
  const { spotifyUserId } = router.query as { spotifyUserId?: string };

  const [followers, setFollowers] = useState<FollowUser[]>([]); // フォロワー一覧 [cite: 69]
  const [pending, setPending] = useState<FollowUser[]>([]);     // 承認待ち [cite: 67]
  const [matches, setMatches] = useState<MatchUser[]>([]);       // フォロー一覧 (マッチ済み) [cite: 64]
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acceptingId, setAcceptingId] = useState<number | null>(null);

  useEffect(() => {
    if (!spotifyUserId) {
        if (router.isReady) {
            setError('ユーザー情報がありません。');
            setLoading(false);
        }
        return;
    }

    const fetchLists = async () => {
      setLoading(true);
      setError(null);
      try {
        // 3つのリストを取得するAPIを呼び出す
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
  }, [spotifyUserId, router.isReady]);

  // 承認ボタンの処理 (変更なし)
  const handleAccept = async (followId: number) => {
    if (!spotifyUserId || acceptingId) return;
    setAcceptingId(followId);
    try {
      await axios.post('/api/follow/accept', {
        selfSpotifyId: spotifyUserId,
        followId: followId,
      });
      // 成功したらリストを再取得
      router.reload();
    } catch (e: unknown) {
      console.error("Failed to accept follow request:", e);
      alert('承認に失敗しました。');
      setAcceptingId(null);
    }
  };

  if (loading) return <div className="p-4 text-center">読み込み中...</div>;
  if (error) return <div className="p-4 text-center text-red-500">{error}</div>;
  
  // ユーザー詳細ページへのリンクを作成
  const userDetailLink = (userId: string) => ({
      pathname: `/user/${userId}`,
      query: { selfSpotifyId: spotifyUserId }
  });

  return (
    <div className="p-4 max-w-lg mx-auto text-white">
      <h1 className="text-3xl font-bold mb-6">フォロー</h1>

      {/* --- フォロワー一覧 (承認待ち) --- [cite: 69] */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4 border-b border-gray-700 pb-2">フォロワー一覧 (あなたをフォロー中)</h2>
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
                  <span className="font-medium truncate">{req.nickname} [cite: 70]</span>
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
      
      {/* --- 承認待ち --- [cite: 67] */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4 border-b border-gray-700 pb-2">承認待ち (あなたがフォロー中)</h2>
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
                  <span className="font-medium truncate">{req.nickname} [cite: 68]</span>
                </Link>
                <span className="text-sm text-gray-400 flex-shrink-0">承認待ち</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-400 text-sm">承認待ちのユーザーはいません。</p>
        )}
      </section>

      {/* --- フォロー一覧 (マッチ済み) --- [cite: 64] */}
      <section>
        <h2 className="text-xl font-semibold mb-4 border-b border-gray-700 pb-2">フォロー一覧 (マッチング済み)</h2>
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
                    <h3 className="font-bold text-lg truncate">{match.nickname} [cite: 65, 66]</h3>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-400 text-sm">成立したマッチングはありません。</p>
        )}
      </section>
    </div>
  );
}