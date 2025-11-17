// pages/profile.tsx
import { useEffect, useState, FormEvent } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import { SpotifyProfile, getMyProfile, SpotifyArtist, getMyFollowingArtists } from '../lib/spotify';
import Image from 'next/image';

// --- (型定義) ---
interface UserProfile {
  nickname: string;
  profile_image_url: string | null;
  bio: string | null;
}

// --- (ProfileEditor コンポーネント) ---
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
  spotifyProfile: SpotifyProfile | null;
}

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
  spotifyProfile
}: ProfileEditorProps) => (
  <section className="bg-gray-800 p-6 rounded-lg shadow-md mb-6">
    <h2 className="text-xl font-bold text-white mb-4">
      プロフィール設定
    </h2>
    <form onSubmit={handleProfileSubmit} className="space-y-4">
      
      {spotifyProfile && (
        <div>
          <label className="block text-white text-sm font-bold mb-2">Spotifyアカウント</label>
          <div className="flex items-center space-x-3">
            {spotifyProfile.images?.[0]?.url && (
              <Image src={spotifyProfile.images[0].url} alt="Spotify Icon" width={40} height={40} className="w-10 h-10 rounded-full" />
            )}
            <a 
              href={spotifyProfile.external_urls.spotify} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-green-400 hover:underline"
            >
              {spotifyProfile.display_name} (Spotifyで開く)
            </a>
          </div>
        </div>
      )}

      <div>
        <label htmlFor="nickname" className="block text-white text-sm font-bold mb-2">ニックネーム <span className="text-red-500">*</span></label>
        <input
          type="text"
          id="nickname"
          className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
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
          onChange={(e) => setProfileImageUrl(e.target.value)}
          placeholder="http://... (画像のアップロードは現在未対応です)"
        />
        {profileImageUrl && <Image src={profileImageUrl} alt="Preview" width={96} height={96} className="mt-2 w-24 h-24 object-cover rounded-full" />}
      </div>
      
      <div>
        <label htmlFor="bio" className="block text-white text-sm font-bold mb-2">自己紹介文 (任意)</label>
        <textarea
          id="bio"
          className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline h-24 resize-none"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
        ></textarea>
      </div>
      
      <div className="flex justify-start">
        <button
          type="submit"
          className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
          disabled={loading}
        >
          {loading ? '保存中...' : '保存'}
        </button>
      </div>
    </form>
  </section>
);
// --- (ProfileEditor ここまで) ---


// --- メインコンポーネント (Profile ページ) ---
export default function Profile() {
  const router = useRouter();
  const { access_token: query_token } = router.query as { access_token?: string };

  const [accessToken, setAccessToken] = useState<string | null>(null);

  const [spotifyProfile, setSpotifyProfile] = useState<SpotifyProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  const [nickname, setNickname] = useState<string>('');
  const [profileImageUrl, setProfileImageUrl] = useState<string>('');
  const [bio, setBio] = useState<string>('');
  
  const [isNewUser, setIsNewUser] = useState<boolean>(true);
  
  const [myArtists, setMyArtists] = useState<SpotifyArtist[]>([]);

  // (トークンを特定する useEffect)
  useEffect(() => {
    if (!router.isReady) return; 

    let token: string | null = null;

    if (query_token) {
      token = query_token;
      if (typeof window !== 'undefined') {
        localStorage.setItem('spotify_access_token', token);
      }
    } else if (typeof window !== 'undefined') {
      token = localStorage.getItem('spotify_access_token');
    }

    if (token) {
      setAccessToken(token); 
    } else {
      setError('アクセストークンがありません。ログインからやり直してください。');
      setLoading(false);
    }
  }, [router.isReady, query_token]);

  // (データ取得の useEffect)
  useEffect(() => {
    if (!accessToken) { 
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const profileData = await getMyProfile(accessToken); 
        setSpotifyProfile(profileData);

        if (typeof window !== 'undefined') {
            localStorage.setItem('spotify_user_id', profileData.id);
        }

        const existingProfileRes = await axios.get<{ profile: UserProfile | null }>(
            `/api/profile/get?spotifyUserId=${profileData.id}`
        );
        const existingProfile = existingProfileRes.data.profile;

        if (existingProfile) {
          setNickname(existingProfile.nickname);
          setProfileImageUrl(existingProfile.profile_image_url || '');
          setBio(existingProfile.bio || '');
          setIsNewUser(false);
          
          const artistsData = await getMyFollowingArtists(accessToken); 
          setMyArtists(artistsData);

        } else {
          setNickname(profileData.display_name || '');
          setProfileImageUrl(profileData.images?.[0]?.url || '');
          setIsNewUser(true);
        }
      } catch (e: unknown) {
        console.error('Fetch data error:', e);
        if (e instanceof Error && (e.message.includes('401') || (e as any).response?.status === 401)) {
            setError('セッションが切れました。再度ログインしてください。');
            if (typeof window !== 'undefined') {
                localStorage.removeItem('spotify_access_token');
                localStorage.removeItem('spotify_user_id');
            }
        } else {
            setError(`データの取得に失敗しました。`);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [accessToken]);

  // (プロフィール保存処理)
  const handleProfileSubmit = async (e: FormEvent) => { 
    e.preventDefault();
    if (!spotifyProfile || !nickname.trim() || !accessToken) {
        setError('ニックネームは必須です。');
        return;
    }
    
    setLoading(true); 
    setError(null);
    
    const imageUrlToSave = profileImageUrl.trim() || spotifyProfile?.images?.[0]?.url || null;
    
    try {
      await axios.post('/api/profile/save', {
        spotifyUserId: spotifyProfile.id, 
        nickname, 
        profileImageUrl: imageUrlToSave,
        bio,
        accessToken: accessToken, 
      }); 
      
      alert(isNewUser ? 'プロフィールを登録しました！' : 'プロフィールを更新しました！');
      
      if (isNewUser) {
          router.push({
              pathname: '/matches',
              query: { spotifyUserId: spotifyProfile.id }
          });
      } else {
          router.reload();
      }

    } catch (e: unknown) {
      console.error('Failed to save profile:', e);
      setError('プロフィールの保存に失敗しました。');
    } finally { 
      setLoading(false); 
    }
  };

  if (loading) return <div className="p-4 text-center">読み込み中...</div>;
  if (error) return <div className="p-4 text-center text-red-500">{error}</div>;

  // ▼▼▼ 修正: max-w-xl を max-w-lg に変更 ▼▼▼
  return (
    <div className="p-4 max-w-lg mx-auto">
      
      {/* 1. プロフィール編集フォーム */}
      <ProfileEditor
        isNewUser={isNewUser}
        handleProfileSubmit={handleProfileSubmit}
        nickname={nickname}
        setNickname={setNickname}
        profileImageUrl={profileImageUrl}
        setProfileImageUrl={setProfileImageUrl}
        bio={bio}
        setBio={setBio}
        loading={loading}
        spotifyProfile={spotifyProfile}
      />

      {/* 2. フォロー中のアーティスト (新規ユーザーの場合は表示しない) */}
      {!isNewUser && (
        <div className="bg-gray-800 p-6 rounded-lg shadow-md">
          <h3 className="text-xl font-bold mb-4">フォロー中のアーティスト</h3>
          {myArtists.length > 0 ? (
            <ul className="space-y-3 max-h-96 overflow-y-auto">
              {myArtists.map(artist => (
                <li key={artist.id} className="flex items-center space-x-3">
                  {artist.images?.[2] && (
                    <Image src={artist.images[2].url} alt={artist.name} width={40} height={40} className="w-10 h-10 rounded-full object-cover" />
                  )}
                  <div>
                    <p className="font-semibold">{artist.name}</p>
                    <p className="text-xs text-gray-400">{artist.genres.slice(0, 3).join(', ')}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-400">Spotifyでアーティストをフォローしていません。</p>
          )}
        </div>
      )}
    </div>
  );
}