import { useEffect, useState } from 'react';
import axios from 'axios';
import Image from 'next/image';
import { supabase } from '../../lib/supabaseClient';

// ユーザー詳細データの型 (趣味タグ版)
interface UserDetail {
  profile: {
    id: string;
    nickname: string;
    profile_image_url: string | null;
    bio: string | null;
  };
  similarity: {
    score: number;
    match_count: number;
    common_tags: string[];
  } | null;
  follow_status: 'pending' | 'approved' | 'none';
  i_am_follower: boolean;
  hobbies: string[]; // アーティストの代わりに趣味タグ
}

export default function UserProfilePage() {
  const [targetUserId, setTargetUserId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [user, setUser] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [followLoading, setFollowLoading] = useState(false);

  useEffect(() => {
    // URLから相手のIDを取得
    if (typeof window !== 'undefined') {
      const id = window.location.pathname.split('/').pop() || null;
      setTargetUserId(id);
    }

    // 自分のIDをSupabaseから取得
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setCurrentUserId(session.user.id);
      } else {
        setError('ログインしていません。');
        setLoading(false);
      }
    };
    checkUser();
  }, []);

  useEffect(() => {
    if (!targetUserId || !currentUserId) return;

    const fetchUser = async () => {
      setLoading(true);
      setError(null);
      try {
        // API呼び出し (userIdパラメータを使用)
        const res = await axios.get(`/api/user/${targetUserId}`, {
          params: { userId: currentUserId }
        });
        setUser(res.data);
      } catch (e: any) {
        console.error("Failed to fetch user details:", e);
        setError('ユーザー情報の取得に失敗しました。');
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, [targetUserId, currentUserId]);

  // フォロー/解除処理
  const handleFollow = async () => {
    if (followLoading || !user || !currentUserId) return;
    setFollowLoading(true);

    try {
      if (user.follow_status === 'none' || (user.follow_status === 'pending' && !user.i_am_follower)) {
        // フォローする
        const res = await axios.post('/api/follow/request', {
          targetUserId: user.profile.id,
          selfSpotifyId: currentUserId // API側で変数名を直していない場合のため念のため送るが、実態はUUID
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
        // フォロー解除
        await axios.post('/api/follow/unfollow', {
          targetUserId: user.profile.id,
          selfSpotifyId: currentUserId
        });
        setUser(prev => prev ? ({
          ...prev,
          follow_status: 'none',
          i_am_follower: false,
        }) : null);
        alert('フォローを解除しました。');
      }
    } catch (e) {
      console.error("Follow error:", e);
      alert('操作に失敗しました。');
    } finally {
      setFollowLoading(false);
    }
  };

  if (loading) return <div className="p-4 text-center text-white">読み込み中...</div>;
  if (error) return <div className="p-4 text-center text-red-500">{error}</div>;
  if (!user) return <div className="p-4 text-center text-white">ユーザーが見つかりません。</div>;

  const { profile, similarity, follow_status, i_am_follower, hobbies } = user;

  // ボタンの表示切り替え
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
      <a href="/matches" className="text-blue-400 hover:text-blue-300 mb-4 inline-block">
        &lt; マッチング一覧に戻る
      </a>
      
      {/* ヘッダー */}
      <div className="flex items-center space-x-4 mb-4">
        {profile.profile_image_url ? (
          <Image src={profile.profile_image_url} alt={profile.nickname} width={80} height={80} className="w-20 h-20 rounded-full object-cover" />
        ) : (
          <div className="w-20 h-20 rounded-full bg-gray-600"></div>
        )}
        <div>
          <h1 className="text-3xl font-bold">{profile.nickname}</h1>
          <p className="text-gray-300">{profile.bio || '(自己紹介なし)'}</p>
        </div>
      </div>

      {/* アクションボタン */}
      <button
        onClick={handleFollow}
        disabled={followLoading}
        className={`w-full py-2 px-4 rounded font-bold text-white transition-colors ${followLoading ? 'bg-gray-500' : followButtonClass}`}
      >
        {followLoading ? '処理中...' : followButtonText}
      </button>

      {/* 共通点エリア */}
      {similarity && (
        <div className="bg-gray-800 p-6 rounded-lg shadow-md my-6">
          <h2 className="text-xl font-bold mb-4">あなたとの共通点</h2>
          <div className="mb-4">
            <span className="font-bold text-lg text-green-400">一致度: {Math.round(similarity.score * 100)}%</span>
            <span className="text-sm text-gray-400 ml-2">({similarity.match_count}個のタグが一致)</span>
          </div>

          <div>
            <h3 className="font-semibold mb-2">共通の趣味タグ</h3>
            {similarity.common_tags.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {similarity.common_tags.map(tag => (
                  <span key={tag} className="bg-green-600 px-3 py-1 rounded-full text-sm">{tag}</span>
                ))}
              </div>
            ) : <p className="text-gray-400 text-sm">共通のタグはありません。</p>}
          </div>
        </div>
      )}

      {/* 相手の趣味一覧 */}
      <div className="bg-gray-800 p-6 rounded-lg shadow-md my-6">
        <h2 className="text-xl font-bold mb-4">登録している趣味</h2>
        {hobbies && hobbies.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {hobbies.map(tag => (
              <span key={tag} className="bg-gray-700 px-3 py-1 rounded-full text-sm text-white">
                {tag}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-gray-400 text-sm">趣味タグが登録されていません。</p>
        )}
      </div>
    </div>
  );
}