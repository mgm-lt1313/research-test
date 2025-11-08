// pages/match.tsx (入力フォーカス修正版)
import { useEffect, useState, FormEvent } from 'react'; // 👈 FormEvent を import
import { useRouter } from 'next/router';
import axios from 'axios';
import { SpotifyProfile, getMyProfile } from '../lib/spotify';
import Image from 'next/image';
import Link from 'next/link';

interface UserProfile {
  nickname: string;
  profile_image_url: string | null;
  bio: string | null;
}

// ▼ 新しい MatchResult の型 (APIレスポンスに合わせる)
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
  common_artists: string; // JSON文字列
  common_genres: string; // JSON文字列
}

// --- 🔽 1. ProfileEditor の Props 型を定義 ---
interface ProfileEditorProps {
  isNewUser: boolean;
  handleProfileSubmit: (e: FormEvent) => Promise<void>;
  nickname: string;
  setNickname: (val: string) => void;
  profileImageUrl: string;
  setProfileImageUrl: (val: string) => void;
  bio: string;
  setBio: (val: string) => void;
  loading: boolean;
  isEditingProfile: boolean;
  setIsEditingProfile: (val: boolean) => void;
}

// --- 🔽 2. ProfileEditor コンポーネントを外に定義 ---
const ProfileEditor = ({
  isNewUser,
  handleProfileSubmit,
  nickname,
  setNickname,
  profileImageUrl,
  setProfileImageUrl,
  bio,
  setBio,
  loading,
  isEditingProfile,
  setIsEditingProfile
}: ProfileEditorProps) => (
  <div className="p-4 max-w-xl mx-auto bg-gray-800 rounded-lg shadow-md mt-4">
    <h2 className="text-xl font-bold text-white mb-4">
      {isNewUser ? 'プロフィール登録' : 'プロフィール編集'}
    </h2>
    <form onSubmit={handleProfileSubmit} className="space-y-4">
      <div>
        <label htmlFor="nickname" className="block text-white text-sm font-bold mb-2">ニックネーム <span className="text-red-500">*</span></label>
        <input
          type="text"
          id="nickname"
          className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)} // props経由で更新
          required
        />
      </div>
      <div>
        <label htmlFor="profileImageUrl" className="block text-white text-sm font-bold mb-2">プロフィール画像URL (任意)</label>
        <input
          type="url"
          id="profileImageUrl"
          className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          value={profileImageUrl}
          onChange={(e) => setProfileImageUrl(e.target.value)} // props経由で更新
          placeholder="例: http://example.com/your-image.jpg"
        />
        {profileImageUrl && <Image src={profileImageUrl} alt="Preview" width={96} height={96} className="mt-2 w-24 h-24 object-cover rounded-full" />}
      </div>
      <div>
        <label htmlFor="bio" className="block text-white text-sm font-bold mb-2">自己紹介文 (任意)</label>
        <textarea
          id="bio"
          className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline h-24 resize-none"
          value={bio}
          onChange={(e) => setBio(e.target.value)} // props経由で更新
          placeholder="あなたの好きな音楽のジャンルや、活動していることなど"
        ></textarea>
      </div>
      <div className="flex justify-between">
        <button
          type="submit"
          className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
          disabled={loading}
        >
          {loading ? '保存中...' : (isNewUser ? 'プロフィールを登録' : '更新を保存')}
        </button>
        {isEditingProfile && !isNewUser && (
          <button
            type="button"
            onClick={() => setIsEditingProfile(false)} // props経由で更新
            className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
            disabled={loading}
          >
            キャンセル
          </button>
        )}
      </div>
    </form>
  </div>
);


export default function Match() {
  const router = useRouter();
  const { access_token } = router.query as { access_token?: string };

  const [profile, setProfile] = useState<SpotifyProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [nickname, setNickname] = useState<string>('');
  const [profileImageUrl, setProfileImageUrl] = useState<string>('');
  const [bio, setBio] = useState<string>('');
  
  const [isNewUser, setIsNewUser] = useState<boolean>(true);
  const [isEditingProfile, setIsEditingProfile] = useState<boolean>(false);
  
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [followingInProgress, setFollowingInProgress] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!access_token) {
      setLoading(false);
      if (router.query.error) setError(`エラー: ${router.query.error}`);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const profileData = await getMyProfile(access_token);
        setProfile(profileData);

        const existingProfileRes = await axios.get<{ profile: UserProfile | null }>(
            `/api/profile/get?spotifyUserId=${profileData.id}`
        );

        const existingProfile = existingProfileRes.data.profile;

        if (existingProfile) {
            setNickname(existingProfile.nickname);
            setProfileImageUrl(existingProfile.profile_image_url || '');
            setBio(existingProfile.bio || '');
            setIsNewUser(false);
            
            const matchRes = await axios.post('/api/match/get-recommendations', { 
                spotifyUserId: profileData.id 
            });
            setMatches(matchRes.data.matches);
        } else {
            setNickname(profileData.display_name || '');
            setProfileImageUrl(profileData.images?.[0]?.url || '');
            setIsNewUser(true);
            setIsEditingProfile(true);
        }
      } catch (e: unknown) {
        if (axios.isAxiosError(e)) {
          if (e.response?.status !== 404) {
            console.error('API Error:', e.response?.status, e.response?.data);
            setError(`APIエラーが発生しました: ${e.response?.status || '不明'}`);
          }
        } else if (e instanceof Error) {
          console.error('予期せぬエラー:', e);
          setError(`予期せぬエラーが発生しました: ${e.message}`);
        } else {
            console.error('予期せぬ不明なエラー:', e);
            setError('予期せぬ不明なエラーが発生しました。');
        }
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [access_token, router.query]);

  const handleFollow = async (targetUserId: string) => {
    setFollowingInProgress(prev => new Set(prev).add(targetUserId));
    try {
      if (!profile) throw new Error('Profile not loaded');
      await axios.post('/api/follow/request', {
        targetUserId: targetUserId,
        selfSpotifyId: profile.id
      });
      alert(`ユーザー: ${targetUserId} にフォローリクエストを送信しました。`);
    } catch (err: unknown) {
      let errorMessage = 'フォローリクエストに失敗しました。';
      if (axios.isAxiosError(err) && err.response?.data?.message) {
          errorMessage = `フォローリクエストに失敗しました: ${err.response.data.message}`;
          console.error('フォローリクエストエラー:', err.response.data.message);
      } else if (err instanceof Error) {
          errorMessage = `フォローリクエストに失敗しました: ${err.message}`;
          console.error('フォローリクエストエラー:', err.message);
      } else {
          console.error('フォローリクエストで不明なエラー:', err);
      }
      alert(errorMessage);
      setFollowingInProgress(prev => {
        const next = new Set(prev);
        next.delete(targetUserId);
        return next;
      });
    }
  };

  
  const handleProfileSubmit = async (e: FormEvent) => { // 👈 型を FormEvent に
    e.preventDefault();
    if (!profile || !nickname.trim()) return setError('Spotifyプロフィール未読込かニックネームが空です。');
    setLoading(true); setError(null);
    try {
      await axios.post('/api/profile/save', {
        spotifyUserId: profile.id, 
        nickname, 
        profileImageUrl, 
        bio,
        accessToken: access_token, 
      }); 
      alert(isNewUser ? 'プロフィールを登録しました！' : 'プロフィールを更新しました！');
      setIsNewUser(false); setIsEditingProfile(false);
    } catch (e: unknown) {
      if (axios.isAxiosError(e)) {
            setError(`プロフィールの保存中にエラーが発生しました: ${e.response?.status || '不明'}`);
            console.error('プロフィール保存エラー(Axios):', e.response?.data || e.message);
        } else if (e instanceof Error) {
            setError(`予期せぬエラーが発生しました: ${e.message}`);
            console.error('プロフィール保存エラー:', e.message);
        } else {
             setError('予期せぬ不明なエラーが発生しました。');
             console.error('プロフィール保存で不明なエラー:', e);
        }
    } finally { setLoading(false); }
  };

  
  if (loading) return <div className="flex justify-center items-center min-h-screen">データをロード中...</div>;
  if (error) return <div className="flex justify-center items-center min-h-screen text-red-500">{error}</div>;

  
  // --- 🔽 3. 呼び出し側で props をすべて渡す ---
  
  // 共通のpropsをオブジェクトとしてまとめておく
  const editorProps = {
    isNewUser,
    handleProfileSubmit,
    nickname,
    setNickname,
    profileImageUrl,
    setProfileImageUrl,
    bio,
    setBio,
    loading,
    isEditingProfile,
    setIsEditingProfile
  };

  if (isNewUser) return (
    <div className="p-4 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold text-white mb-6 mt-8 text-center">👋 ようこそ！プロフィールを登録してください</h1>
      <ProfileEditor {...editorProps} />
    </div>
  );
  
  if (isEditingProfile) {
      return (
          <div className="p-4 max-w-2xl mx-auto mt-8">
              <ProfileEditor {...editorProps} />
              <div className='flex justify-center mt-6'>
                  <button onClick={() => setIsEditingProfile(false)} className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline">
                      メイン画面に戻る
                  </button>
              </div>
          </div>
      );
  }

  return (
    <div className="p-4 max-w-2xl mx-auto text-white">
      {profile && (
        <div className="bg-gray-800 p-6 rounded-lg shadow-md mb-6 relative">
          <div className="absolute top-4 right-4 flex space-x-2">
            <Link href={`/chats?spotifyUserId=${profile.id}`} className="bg-green-600 hover:bg-green-700 text-white font-bold py-1 px-3 rounded text-sm">チャット一覧</Link>
            <button onClick={() => setIsEditingProfile(true)} className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-1 px-3 rounded text-sm">プロフィール編集</button>
          </div>
          <div className="flex items-center space-x-4 mb-4">
            {(profileImageUrl || profile.images?.[0]?.url) && (<Image src={profileImageUrl || profile.images?.[0]?.url || ''} alt={nickname || profile.display_name || 'プロフィール画像'} width={40} height={40} className="w-10 h-10 rounded-full object-cover" />)}
            <div>
              <h1 className="text-2xl font-bold">こんにちは、{nickname || profile.display_name} さん！</h1>
              <a href={profile.external_urls.spotify} target="_blank" rel="noopener noreferrer" className="text-green-400 hover:underline text-sm">Spotifyで開く</a>
            </div>
          </div>
        </div>
      )}

      {matches.length > 0 && (
        <>
          <h2 className="text-xl font-bold mt-8 mb-4 border-b border-gray-700 pb-2">🔥 おすすめのマッチング</h2>
          <ul className="space-y-4 mb-8">
            {matches.map((match) => {
              const isFollowing = followingInProgress.has(match.other_user_id);
              const commonArtists: string[] = JSON.parse(match.common_artists || '[]');
              const commonGenres: string[] = JSON.parse(match.common_genres || '[]');

              return (
              <li key={match.other_user_id} className="bg-gray-700 p-4 rounded-lg shadow-md">
                <div className="flex items-start space-x-4">
                  {match.profile_image_url ? (<Image src={match.profile_image_url} alt={match.nickname} width={48} height={48} className="w-12 h-12 rounded-full object-cover flex-shrink-0" />) : (<div className="w-12 h-12 rounded-full bg-gray-600 flex-shrink-0"></div>)}
                  
                  <div className="flex-grow">
                    <h3 className="text-lg font-bold">{match.nickname}</h3>
                    {match.is_same_community && (
                        <span className="text-xs font-bold text-cyan-300">★同じ音楽コミュニティ</span>
                    )}
                    <p className="text-sm text-gray-300 mt-1 mb-2 line-clamp-2">{match.bio || '(自己紹介文がありません)'}</p>
                    
                    <div className="text-sm mb-2">
                        <span className="font-bold text-white">総合一致度: {Math.round(match.combined_similarity * 100)}%</span>
                        <span className="text-xs text-gray-400 ml-2">
                            (アーティスト: {Math.round(match.artist_similarity * 100)}%, ジャンル: {Math.round(match.genre_similarity * 100)}%)
                        </span>
                    </div>
                    {commonArtists.length > 0 && (
                        <div className="text-xs text-gray-300">
                           <span className="font-semibold">共通アーティスト:</span> {commonArtists.slice(0, 3).join(', ')} {commonArtists.length > 3 ? '...' : ''}
                        </div>
                    )}
                    {commonGenres.length > 0 && (
                         <div className="text-xs text-gray-300">
                           <span className="font-semibold">共通ジャンル:</span> {commonGenres.slice(0, 2).join(', ')} {commonGenres.length > 2 ? '...' : ''}
                        </div>
                    )}
                  </div>
                  
                  <button onClick={() => handleFollow(match.other_user_id)} disabled={isFollowing} className={`flex-shrink-0 px-4 py-2 rounded font-semibold text-sm ${isFollowing ? 'bg-gray-500 text-white cursor-wait' : 'bg-blue-500 hover:bg-blue-600 text-white'}`}>
                    {isFollowing ? '送信中...' : 'フォロー'}
                  </button>
                </div>
              </li>
            );})}
          </ul>
        </>
      )}

    </div>
  );
}