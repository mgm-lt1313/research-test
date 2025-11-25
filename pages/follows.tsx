import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import Image from 'next/image';
import Link from 'next/link';
import { supabase } from '../lib/supabaseClient';

interface FollowUser {
  id: number;
  user_id: string;
  nickname: string;
  profile_image_url: string | null;
}

export default function Follows() {
  const router = useRouter();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  const [followers, setFollowers] = useState<FollowUser[]>([]); 
  const [pending, setPending] = useState<FollowUser[]>([]);     
  const [matches, setMatches] = useState<FollowUser[]>([]);     
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acceptingId, setAcceptingId] = useState<number | null>(null);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setCurrentUserId(session.user.id);
      } else {
        if (router.isReady) {
          setError('ログインしてください');
          setLoading(false);
        }
      }
    };
    checkUser();
  }, [router.isReady]);

  useEffect(() => {
    if (!currentUserId) return;

    const fetchLists = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await axios.get(`/api/follow/list`, {
          params: { userId: currentUserId }
        });
        setFollowers(res.data.pendingRequestsToMe || []);
        setPending(res.data.pendingRequestsFromMe || []);
        setMatches(res.data.approvedMatches || []);
      } catch (e) {
         console.error(e);
         setError('リストの取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };
    fetchLists();
  }, [currentUserId]);

  const handleAccept = async (followId: number) => {
    if (!currentUserId || acceptingId) return;
    setAcceptingId(followId);
    try {
      await axios.post('/api/follow/accept', {
        userId: currentUserId,
        followId: followId,
      });
      router.reload();
    } catch (e) {
      console.error(e);
      alert('承認に失敗しました');
      setAcceptingId(null);
    }
  };

  if (loading) return <div className="p-4 text-center text-white">読み込み中...</div>;
  if (error) return <div className="p-4 text-center text-red-500">{error}</div>;
  
  const userDetailLink = (targetId: string) => `/user/${targetId}`;

  return (
    <div className="p-4 max-w-lg mx-auto text-white min-h-screen">
      <h1 className="text-3xl font-bold mb-6">フォロー状況</h1>

      {/* 1. 相互フォロー */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4 border-b border-gray-700 pb-2">相互フォロー</h2>
        {matches.length > 0 ? (
          <ul className="space-y-3">
            {matches.map(match => (
              <li key={match.id}>
                <Link href={userDetailLink(match.user_id)} className="block bg-gray-800 p-4 rounded-lg flex items-center space-x-4 hover:bg-gray-700 transition-colors shadow">
                  {match.profile_image_url ? (
                    <Image src={match.profile_image_url} alt={match.nickname} width={48} height={48} className="w-12 h-12 rounded-full object-cover flex-shrink-0" />
                  ) : (
                     <div className="w-12 h-12 rounded-full bg-gray-600 flex-shrink-0"></div>
                  )}
                  <div className="overflow-hidden">
                    <h3 className="font-bold text-lg truncate">{match.nickname}</h3>
                    <span className="text-xs text-green-400">チャット可能</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-400 text-sm">相互フォローのユーザーはいません。</p>
        )}
      </section>

      {/* 2. フォロワー */}
      <section className="mb-8">
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
                  className="px-3 py-1 rounded text-sm font-semibold flex-shrink-0 bg-green-600 hover:bg-green-500 transition-colors"
                >
                  {acceptingId === req.id ? '処理中...' : '承認する'}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-400 text-sm">新しいフォロワーはいません。</p>
        )}
      </section>
      
      {/* 3. フォロー中 */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4 border-b border-gray-700 pb-2">フォロー中</h2>
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
                <span className="text-sm text-gray-400 flex-shrink-0">申請中</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-400 text-sm">フォロー中のユーザーはいません。</p>
        )}
      </section>

    </div>
  );
}