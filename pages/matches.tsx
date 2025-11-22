// pages/matches.tsx
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import Image from 'next/image';
import Link from 'next/link';
import { supabase } from '../lib/supabaseClient';

// マッチング結果の型定義（趣味タグ版）
interface MatchResult {
  other_user_id: string; // uuid
  nickname: string;
  profile_image_url: string | null;
  bio: string | null;
  score: number;         // 一致度 (0.0〜1.0)
  match_count: number;   // 合致したタグの数
  common_tags: string[]; // 共通タグのリスト
}

export default function Matches() {
  const router = useRouter();
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    // ログインユーザーの確認
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        if (router.isReady) {
          setError('ログインしていません。トップページに戻ってください。');
          setLoading(false);
        }
        return;
      }
      setCurrentUserId(session.user.id);
    };
    checkUser();
  }, [router.isReady]);

  useEffect(() => {
    if (!currentUserId) return;

    const fetchMatches = async () => {
      setLoading(true);
      setError(null);
      try {
        // おすすめユーザー取得APIを呼び出し
        // (API側も hobby_tags 対応に変更されている前提)
        const res = await axios.post('/api/match/get-recommendations', { 
            userId: currentUserId // Google認証版に合わせてパラメータ名を変更しても良いですが、既存APIが spotifyUserId を期待している場合は合わせるかAPI側を修正してください。ここでは汎用的に userId とします。
        });
        
        // APIのレスポンス形式に合わせてセット
        setMatches(res.data.matches || []);
      } catch (e: any) {
        console.error('Failed to fetch recommendations:', e);
        setError('おすすめユーザーの取得に失敗しました。');
      } finally {
        setLoading(false);
      }
    };
    fetchMatches();
  }, [currentUserId]);

  if (loading) return <div className="p-4 text-center text-white">マッチング相手を検索中...</div>;
  if (error) return <div className="p-4 text-center text-red-500">{error}</div>;

  return (
    <div className="p-4 max-w-lg mx-auto">
      <h1 className="text-3xl font-bold text-white mb-6">マッチング</h1>
      
      {matches.length === 0 ? (
        <div className="bg-gray-800 p-6 rounded-lg text-center text-gray-400">
          <p className="text-lg font-semibold mb-2">まだおすすめのユーザーがいません</p>
          <p className="text-sm">
            自分や他のユーザーがプロフィールを登録すると、マッチング計算が行われます。
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {matches.map((match) => (
            <li key={match.other_user_id} className="bg-gray-800 p-4 rounded-lg shadow-md list-none">
              <Link 
                href={{ 
                  pathname: `/user/${match.other_user_id}`,
                }}
                className="flex space-x-4"
              >
                {/* プロフィール画像 */}
                {match.profile_image_url ? (
                  <Image 
                    src={match.profile_image_url} 
                    alt={match.nickname} 
                    width={56} 
                    height={56} 
                    className="w-14 h-14 rounded-full object-cover flex-shrink-0" 
                  />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-gray-600 flex-shrink-0"></div>
                )}
                
                <div className="flex-grow min-w-0">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-bold truncate text-white">{match.nickname}</h3>
                    {/* マッチ度表示 */}
                    <span className="text-sm font-bold text-green-400">
                      一致度: {Math.round(match.score * 100)}%
                    </span>
                  </div>
                  
                  <p className="text-sm text-gray-300 mt-1 truncate">{match.bio || '(自己紹介なし)'}</p>

                  {/* 共通タグの表示 */}
                  <div className="mt-3">
                    <span className="text-xs text-gray-400 block mb-1">
                      共通の趣味 ({match.match_count}個):
                    </span>
                    {match.common_tags && match.common_tags.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {match.common_tags.slice(0, 5).map((tag) => (
                          <span 
                            key={tag} 
                            className="bg-green-600 text-white text-xs px-2 py-1 rounded-full"
                          >
                            {tag}
                          </span>
                        ))}
                        {match.common_tags.length > 5 && (
                          <span className="text-xs text-gray-500 self-center">
                            +{match.common_tags.length - 5}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-500">共通の趣味タグはありません</span>
                    )}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}