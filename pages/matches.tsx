// pages/matches.tsx
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import Image from 'next/image';
import Link from 'next/link';

// マッチング結果の型 (match.tsx からコピー)
interface MatchResult {
  other_user_id: string; // uuid
  nickname: string;
  profile_image_url: string | null;
  bio: string | null;
  artist_similarity: number;
  genre_similarity: number;
  combined_similarity: number;
  match_score: number;
  is_same_community: boolean;
  common_artists: string[]; 
  common_genres: string[];
  follow_status: 'pending' | 'approved' | null;
  i_am_follower: boolean;
}

export default function Matches() {
  const router = useRouter();
  // spotifyUserId をクエリから取得
  const { spotifyUserId } = router.query as { spotifyUserId?: string };

  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!spotifyUserId) {
      if (router.isReady) { // ページが完全に読み込まれてから
        setError('ユーザー情報がありません。プロフィールページに戻ってください。');
        setLoading(false);
      }
      return;
    }

    const fetchMatches = async () => {
      setLoading(true);
      setError(null);
      try {
        const matchRes = await axios.post('/api/match/get-recommendations', { 
            spotifyUserId: spotifyUserId
        });
        setMatches(matchRes.data.matches as MatchResult[]);
      } catch (e: unknown) {
        console.error('Failed to fetch recommendations:', e);
        setError('おすすめユーザーの取得に失敗しました。');
      } finally {
        setLoading(false);
      }
    };
    fetchMatches();
  }, [spotifyUserId, router.isReady]);


  if (loading) return <div className="p-4 text-center">マッチング相手を検索中...</div>;
  if (error) return <div className="p-4 text-center text-red-500">{error}</div>;

  return (
    <div className="p-4 max-w-xl mx-auto">
      <h1 className="text-3xl font-bold text-white mb-6">マッチング</h1>
      
      {matches.length === 0 ? (
        <div className="bg-gray-800 p-6 rounded-lg text-center text-gray-400">
          <p className="text-lg font-semibold mb-2">まだおすすめのユーザーがいません</p>
          <p className="text-sm">
            新しいユーザーが登録されると、マッチング計算が自動的に実行されます。
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {matches.map((match) => (
            <li key={match.other_user_id} className="bg-gray-800 p-4 rounded-lg shadow-md">
              {/* ユーザー詳細ページへのリンクを追加 [cite: 31] */}
              <Link 
                href={{ 
                  pathname: `/user/${match.other_user_id}`,
                  query: { selfSpotifyId: spotifyUserId } 
                }}
                className="flex items-center space-x-4"
              >
                {/* アイコン */}
                {match.profile_image_url ? (
                  <Image src={match.profile_image_url} alt={match.nickname} width={56} height={56} className="w-14 h-14 rounded-full object-cover flex-shrink-0" />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-gray-600 flex-shrink-0"></div>
                )}
                
                {/* ユーザー情報 */}
                <div className="flex-grow min-w-0">
                  <h3 className="text-lg font-bold truncate">{match.nickname} [cite: 31, 35]</h3>
                  <p className="text-sm text-gray-300 truncate">{match.bio || '(自己紹介なし)'} [cite: 33, 36]</p>
                  
                  {/* マッチ率 [cite: 32, 34, 37, 38] */}
                  <div className="text-sm mt-1">
                      <span className="font-bold text-green-400">マッチ率: {Math.round(match.combined_similarity * 100)}%</span>
                      <span className="text-xs text-gray-400 ml-2">
                          (アーティスト: {Math.round(match.artist_similarity * 100)}%, ジャンル: {Math.round(match.genre_similarity * 100)}%)
                      </span>
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