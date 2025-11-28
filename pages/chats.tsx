import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import Image from 'next/image';
import Link from 'next/link';
import { supabase } from '../lib/supabaseClient';

interface ApprovedMatch {
  match_id: number;
  other_user: {
    id: string;
    nickname: string;
    profile_image_url: string | null;
  };
}

export default function Chats() {
  const router = useRouter();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [matches, setMatches] = useState<ApprovedMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setCurrentUserId(session.user.id);
      } else {
        if(router.isReady) {
            setError('ログインしてください。');
            setLoading(false);
        }
      }
    };
    checkUser();
  }, [router.isReady]);

  useEffect(() => {
    if (!currentUserId) return;

    const fetchMatches = async () => {
      setLoading(true);
      setError(null);
      try {
        // userId を渡してAPI呼び出し
        const res = await axios.get(`/api/chat/list`, {
            params: { userId: currentUserId }
        });
        setMatches(res.data.approvedMatches || []);
      } catch (e) {
         console.error(e);
         setError('チャットリストの取得に失敗しました。');
      } finally {
        setLoading(false);
      }
    };
    fetchMatches();
  }, [currentUserId]);

  if (loading) return <div className="p-4 text-center text-white">読み込み中...</div>;
  if (error) return <div className="p-4 text-center text-red-500">{error}</div>;

  return (
    <div className="p-4 max-w-lg mx-auto text-white">
      <h1 className="text-3xl font-bold mb-6">チャット</h1>

      <section>
        {matches.length > 0 ? (
          <ul className="space-y-3">
            {matches.map(match => (
              <li 
                key={match.match_id}
                className="bg-gray-800 p-4 rounded-lg flex items-center justify-between space-x-4 shadow"
              >
                {/* チャットルームへのリンク（メインエリア） */}
                <Link
                  href={{
                      pathname: `/chat/${match.match_id}`,
                      query: {
                          otherUserId: match.other_user.id,
                          otherNickname: match.other_user.nickname,
                          otherImageUrl: match.other_user.profile_image_url
                      }
                  }}
                  className="flex items-center space-x-4 hover:bg-gray-700 transition-colors duration-150 p-2 rounded-l-md -m-2 flex-grow min-w-0"
                >
                  {match.other_user.profile_image_url ? (
                    <Image src={match.other_user.profile_image_url} alt={match.other_user.nickname} width={48} height={48} className="w-12 h-12 rounded-full object-cover flex-shrink-0" />
                  ) : (
                     <div className="w-12 h-12 rounded-full bg-gray-600 flex-shrink-0"></div>
                  )}
                  <div className="overflow-hidden">
                    <h3 className="font-bold text-lg truncate">{match.other_user.nickname}</h3>
                    <p className="text-gray-300 text-sm truncate text-green-400">チャットを開始する &gt;</p>
                  </div>
                </Link>
                
                {/* ▼▼▼ 追加: ユーザー詳細への「...」ボタン ▼▼▼ */}
                <Link
                  href={`/user/${match.other_user.id}`}
                  className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-full transition-colors flex-shrink-0"
                  title="ユーザー詳細を見る"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM12.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM18.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
                  </svg>
                </Link>
                {/* ▲▲▲ 追加ここまで ▲▲▲ */}

              </li>
            ))}
          </ul>
        ) : (
          <div className="text-center text-gray-400 mt-10">
            <p>チャット可能な相手がいません。</p>
            <p className="text-sm mt-2">「マッチング」画面で気になる相手をフォローし、<br/>承認されるとチャットができます。</p>
          </div>
        )}
      </section>
    </div>
  );
}