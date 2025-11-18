// pages/matches.tsx
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import Image from 'next/image';
import Link from 'next/link';

// ▼▼▼ 共通アーティストの型を定義 ▼▼▼
interface CommonArtist {
  name: string;
  image_url: string | null;
}
// ▲▲▲ 修正ここまで ▲▲▲

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
  common_artists: CommonArtist[]; // 👈 string[] から CommonArtist[] に変更
  common_genres: string[];
  follow_status: 'pending' | 'approved' | null;
  i_am_follower: boolean;
}

export default function Matches() {
  const router = useRouter();
  const { spotifyUserId } = router.query as { spotifyUserId?: string };

  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let id = spotifyUserId;
    if (!id && typeof window !== 'undefined') {
      id = localStorage.getItem('spotify_user_id') || undefined;
    }
    
    if (!id) {
      if (router.isReady) {
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
            spotifyUserId: id
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
    <div className="p-4 max-w-lg mx-auto">
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
              <Link 
                href={{ 
                  pathname: `/user/${match.other_user_id}`,
                  query: { selfSpotifyId: spotifyUserId || localStorage.getItem('spotify_user_id') }
                }}
                className="flex space-x-4"
              >
                {match.profile_image_url ? (
                  <Image src={match.profile_image_url} alt={match.nickname} width={56} height={56} className="w-14 h-14 rounded-full object-cover flex-shrink-0" />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-gray-600 flex-shrink-0"></div>
                )}
                
                <div className="flex-grow min-w-0">
                  <h3 className="text-lg font-bold truncate">{match.nickname}</h3>
                  
                  <p className="text-sm text-gray-300 mt-1 truncate">{match.bio || '(自己紹介なし)'}</p>

                  <div className="text-sm mt-1">
                      <span className="font-bold text-green-400">マッチ率: {Math.round(match.combined_similarity * 100)}%</span>
                      <span className="text-xs text-gray-400 ml-2">
                          (アーティスト: {Math.round(match.artist_similarity * 100)}%, ジャンル: {Math.round(match.genre_similarity * 100)}%)
                      </span>
                  </div>

                  {/* ▼▼▼ 共通アーティストの表示をアイコン + 名前に変更 ▼▼▼ */}
                  {match.common_artists && match.common_artists.length > 0 ? (
                    <div className="text-xs text-gray-300 mt-2 flex items-center space-x-2 overflow-hidden">
                      <span className="font-semibold flex-shrink-0">共通:</span>
                      <div className="flex space-x-2">
                        {match.common_artists.slice(0, 3).map(artist => ( // 3件まで表示
                          <div key={artist.name} className="flex items-center space-x-1 bg-gray-700 px-2 py-0.5 rounded-full flex-shrink-0">
                            {artist.image_url && (
                              <Image src={artist.image_url} alt={artist.name} width={12} height={12} className="w-3 h-3 rounded-full" />
                            )}
                            <span className="text-xs">{artist.name}</span>
                          </div>
                        ))}
                        {match.common_artists.length > 3 && (
                          <span className="text-xs text-gray-400">...</span>
                        )}
                      </div>
                    </div>
                  // ▲▲▲ 修正ここまで ▲▲▲
                  ) : match.common_genres && match.common_genres.length > 0 ? (
                    <div className="text-xs text-gray-300 mt-2">
                      <span className="font-semibold">共通ジャンル:</span>
                      <span className="ml-1">{match.common_genres.slice(0, 2).join(', ')}{match.common_genres.length > 2 ? ' ...' : ''}</span>
                    </div>
                  ) : (
                    <div className="text-xs text-gray-400 mt-2">
                      (詳細を見る)
                    </div>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}