// pages/user/[id].tsx
import { useEffect, useState } from 'react';
import axios from 'axios';
import Image from 'next/image'; // 👈 Image コンポーネントをインポート

// ▼▼▼ Artist 型に image_url を追加 ▼▼▼
interface Artist {
  name: string;
  genres: string[];
  image_url: string | null; // 👈 追加
}
// ▲▲▲ 修正ここまで ▲▲▲

// ユーザー詳細データの型
interface UserDetail {
  profile: {
    id: string;
    nickname: string;
    profile_image_url: string | null;
    bio: string | null;
  };
  similarity: {
    artist_similarity: number;
    genre_similarity: number;
    combined_similarity: number;
    common_artists: any[]; // 👈 修正 2a の対応 (object[] になるため)
    common_genres: string[];
  } | null;
  follow_status: 'pending' | 'approved' | 'none';
  i_am_follower: boolean; 
  artists: Artist[]; // 👈 Artist 型が更新された
}

export default function UserProfilePage() {
  const [targetUserId, setTargetUserId] = useState<string | null>(null);
  const [selfSpotifyId, setSelfSpotifyId] = useState<string | null>(null);

  const [user, setUser] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [followLoading, setFollowLoading] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const id = window.location.pathname.split('/').pop() || null;
      let selfId = params.get('selfSpotifyId');
      
      if (!selfId) {
        selfId = localStorage.getItem('spotify_user_id');
      }

      setTargetUserId(id);
      setSelfSpotifyId(selfId);
    }
  }, []); 

  useEffect(() => {
    if (!targetUserId || !selfSpotifyId) {
        if (targetUserId) {
            setError('自分のユーザーIDが取得できません。');
        }
        setLoading(false);
        return;
    }

    const fetchUser = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await axios.get(`/api/user/${targetUserId}`, {
          params: { selfSpotifyId }
        });
        setUser(res.data);
      } catch (e: unknown) {
        console.error("Failed to fetch user details:", e);
        setError('ユーザー情報の取得に失敗しました。');
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, [targetUserId, selfSpotifyId]); 

  // フォロー/フォロー解除処理 (変更なし)
  const handleFollow = async () => {
    if (followLoading || !user || !selfSpotifyId) return;
    setFollowLoading(true);

    try {
      if (user.follow_status === 'none' || (user.follow_status === 'pending' && !user.i_am_follower)) {
        // --- フォローする (or 承認する) ---
        const res = await axios.post('/api/follow/request', {
          targetUserId: user.profile.id,
          selfSpotifyId: selfSpotifyId
        });
        setUser(prev => prev ? ({
          ...prev,
          follow_status: res.data.status,
          i_am_follower: true,
        }) : null);
        if (res.data.status === 'approved') {
          alert('マッチングが成立しました！');
        } else {
          alert('フォローリクエストを送信しました。');
        }
      } else {
        // --- フォロー解除する (or リクエスト解除) ---
        const res = await axios.post('/api/follow/unfollow', {
          targetUserId: user.profile.id,
          selfSpotifyId: selfSpotifyId
        });
        setUser(prev => prev ? ({
          ...prev,
          follow_status: 'none',
          i_am_follower: false,
        }) : null);
        alert('フォローを解除しました。');
      }
    } catch (e: unknown) {
      console.error("Follow/Unfollow error:", e);
      alert('操作に失敗しました。');
    } finally {
      setFollowLoading(false);
    }
  };


  if (loading) return <div className="p-4 text-center">読み込み中...</div>;
  if (error) return <div className="p-4 text-center text-red-500">{error}</div>;
  if (!user) return <div className="p-4 text-center">ユーザーが見つかりません。</div>;

  const { profile, similarity, follow_status, i_am_follower, artists } = user;
  
  // フォローボタンのテキストとスタイル (変更なし)
  let followButtonText = 'フォロー';
  let followButtonClass = 'bg-blue-600 hover:bg-blue-700';
  if (follow_status === 'approved') {
    followButtonText = 'フォロー解除';
    followButtonClass = 'bg-red-600 hover:bg-red-700';
  } else if (follow_status === 'pending' && i_am_follower) {
    followButtonText = 'リクエスト解除';
    followButtonClass = 'bg-red-600 hover:bg-red-700';
  } else if (follow_status === 'pending' && !i_am_follower) {
    followButtonText = '承認する'; 
    followButtonClass = 'bg-green-600 hover:bg-green-700';
  }

  return (
    <div className="p-4 max-w-xl mx-auto text-white">
      {/* 戻るリンク (selfSpotifyIdを付与) */}
      <a href={`/matches?spotifyUserId=${selfSpotifyId}`} className="text-blue-400 hover:text-blue-300 mb-4 inline-block transition-colors">
        &lt; マッチング一覧に戻る
      </a>
      
      {/* ユーザーヘッダー */}
      <div className="flex items-center space-x-4 mb-4">
        {profile.profile_image_url ? (
          <img src={profile.profile_image_url} alt={profile.nickname} className="w-20 h-20 rounded-full object-cover" />
        ) : (
          <div className="w-20 h-20 rounded-full bg-gray-600"></div>
        )}
        <div>
          <h1 className="text-3xl font-bold">{profile.nickname}</h1>
          <p className="text-gray-300">{profile.bio || '(自己紹介なし)'}</p>
        </div>
      </div>

      {/* フォローボタン */}
      <button
        onClick={handleFollow}
        disabled={followLoading}
        className={`w-full py-2 px-4 rounded font-bold text-white transition-colors ${followLoading ? 'bg-gray-500' : followButtonClass}`}
      >
        {followLoading ? '処理中...' : followButtonText}
      </button>

      {/* 類似度情報 */}
      {similarity && (
        <div className="bg-gray-800 p-6 rounded-lg shadow-md my-6">
          <h2 className="text-xl font-bold mb-4">あなたとの共通点</h2>
          <div className="mb-4">
            <span className="font-bold text-lg text-green-400">総合一致度: {Math.round(similarity.combined_similarity * 100)}%</span>
            <span className="text-sm text-gray-400 ml-2">
              (アーティスト: {Math.round(similarity.artist_similarity * 100)}%, ジャンル: {Math.round(similarity.genre_similarity * 100)}%)
            </span>
          </div>

          {/* ▼▼▼ 2a. 共通アーティストの表示 (名前 + アイコン) ▼▼▼ */}
          <div className="mb-4">
            <h3 className="font-semibold mb-2">共通しているフォローアーティスト</h3>
            {similarity.common_artists.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {similarity.common_artists.map(artist => (
                  <div key={artist.name} className="flex items-center space-x-2 bg-gray-700 px-3 py-1 rounded-full">
                    {artist.image_url && (
                      <Image src={artist.image_url} alt={artist.name} width={20} height={20} className="w-5 h-5 rounded-full object-cover" />
                    )}
                    <span className="text-sm">{artist.name}</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-gray-400 text-sm">共通のアーティストはいません。</p>}
          </div>
          {/* ▲▲▲ 修正ここまで ▲▲▲ */}


          <div>
            <h3 className="font-semibold mb-2">共通しているジャンル</h3>
            {similarity.common_genres.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {similarity.common_genres.map(genre => (
                  <span key={genre} className="bg-gray-700 px-3 py-1 rounded-full text-sm">{genre}</span>
                ))}
              </div>
            ) : <p className="text-gray-400 text-sm">共通のジャンルはいません。</p>}
          </div>
        </div>
      )}

      {/* ▼▼▼ 1b. 相手のアーティスト一覧 (Image タグを追加) ▼▼▼ */}
      <div className="bg-gray-800 p-6 rounded-lg shadow-md my-6">
        <h2 className="text-xl font-bold mb-4">フォロー中のアーティスト</h2>
        {artists && artists.length > 0 ? (
          <ul className="space-y-3 max-h-60 overflow-y-auto">
            {artists.map(artist => (
              <li key={artist.name} className="flex items-center space-x-3">
                {/* 👈 Image タグの追加 */}
                {artist.image_url ? (
                  <Image src={artist.image_url} alt={artist.name} width={40} height={40} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gray-600 flex-shrink-0"></div>
                )}
                <div>
                  <p className="font-semibold">{artist.name}</p>
                  <p className="text-xs text-gray-400">{artist.genres.slice(0, 3).join(', ')}</p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-400 text-sm">このユーザーはアーティストをフォローしていません。</p>
        )}
      </div>
      {/* ▲▲▲ 修正ここまで ▲▲▲ */}
      
    </div>
  );
}