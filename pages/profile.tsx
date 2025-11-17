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
  isEditingProfile: boolean;
  setIsEditingProfile: (val: boolean) => void;
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
  isEditingProfile,
  setIsEditingProfile,
  spotifyProfile
}: ProfileEditorProps) => (
  <div className="p-4 max-w-xl mx-auto bg-gray-800 rounded-lg shadow-md mt-4">
    <h2 className="text-xl font-bold text-white mb-4">
      {isNewUser ? 'プロフィール登録' : 'プロフィール編集'}
    </h2>
    <form onSubmit={handleProfileSubmit} className="space-y-4">
      
      {/* Spotifyアカウント情報 */}
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

      {/* ニックネーム */}
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
      
      {/* 画像URL */}
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
      
      {/* 自己紹介 */}
      <div>
        <label htmlFor="bio" className="block text-white text-sm font-bold mb-2">自己紹介文 (任意)</label>
        <textarea
          id="bio"
          className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline h-24 resize-none"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
        ></textarea>
      </div>
      
      {/* ボタン */}
      <div className="flex justify-between">
        <button
          type="submit"
          className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
          disabled={loading}
        >
          {loading ? '保存中...' : '保存'}
        </button>
        {!isNewUser && (
          <button
            type="button"
            onClick={() => setIsEditingProfile(false)}
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
// --- (ProfileEditor ここまで) ---


// --- メインコンポーネント (Profile ページ) ---
export default function Profile() {
  const router = useRouter();
  const { access_token } = router.query as { access_token?: string };

  const [spotifyProfile, setSpotifyProfile] = useState<SpotifyProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // プロフィールフォーム用 State
  const [nickname, setNickname] = useState<string>('');
  const [profileImageUrl, setProfileImageUrl] = useState<string>('');
  const [bio, setBio] = useState<string>('');
  
  const [isNewUser, setIsNewUser] = useState<boolean>(true);
  const [isEditingProfile, setIsEditingProfile] = useState<boolean>(false);
  
  // 既存ユーザー表示用
  const [myArtists, setMyArtists] = useState<SpotifyArtist[]>([]);

  useEffect(() => {
    if (!access_token) {
      setError('アクセストークンがありません。ログインからやり直してください。');
      setLoading(false);
      return;
    }

    // ▼▼▼ 修正: LocalStorage にトークンを保存 ▼▼▼
    if (typeof window !== 'undefined') {
        localStorage.setItem('spotify_access_token', access_token);
    }
    // ▲▲▲ 修正ここまで ▲▲▲

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const profileData = await getMyProfile(access_token);
        setSpotifyProfile(profileData);

        // ▼▼▼ 修正: LocalStorage に Spotify ID を保存 ▼▼▼
        if (typeof window !== 'undefined') {
            localStorage.setItem('spotify_user_id', profileData.id);
        }
        // ▲▲▲ 修正ここまで ▲▲▲

        // 既存プロフィールをDBから取得
        const existingProfileRes = await axios.get<{ profile: UserProfile | null }>(
            `/api/profile/get?spotifyUserId=${profileData.id}`
        );
        const existingProfile = existingProfileRes.data.profile;

        if (existingProfile) {
          // 既存ユーザー
          setNickname(existingProfile.nickname);
          setProfileImageUrl(existingProfile.profile_image_url || '');
          setBio(existingProfile.bio || '');
          setIsNewUser(false);
          setIsEditingProfile(false); // デフォルトは表示モード
          
          // 自分のフォローアーティスト一覧を取得
          const artistsData = await getMyFollowingArtists(access_token);
          setMyArtists(artistsData);

        } else {
          // 新規ユーザー
          setNickname(profileData.display_name || '');
          setProfileImageUrl(profileData.images?.[0]?.url || '');
          setIsNewUser(true);
          setIsEditingProfile(true); // 強制的に編集モード
        }
      } catch (e: unknown) {
        console.error('Fetch data error:', e);
        setError(`データの取得に失敗しました。`);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [access_token]);

  // プロフィール保存処理
  const handleProfileSubmit = async (e: FormEvent) => { 
    e.preventDefault();
    if (!spotifyProfile || !nickname.trim()) return setError('ニックネームは必須です。');
    
    setLoading(true); 
    setError(null);
    
    const imageUrlToSave = profileImageUrl.trim() || spotifyProfile?.images?.[0]?.url || null;
    
    try {
      await axios.post('/api/profile/save', {
        spotifyUserId: spotifyProfile.id, 
        nickname, 
        profileImageUrl: imageUrlToSave,
        bio,
        accessToken: access_token, 
      }); 
      
      alert(isNewUser ? 'プロフィールを登録しました！' : 'プロフィールを更新しました！');
      
      // 保存が完了したら、spotifyUserId をクエリに付与してマッチングページに遷移
      router.push({
          pathname: '/matches', // マッチング画面へ
          query: { spotifyUserId: spotifyProfile.id }
      });

    } catch (e: unknown) {
      // ... (エラーハンドリング) ...
    } finally { 
      setLoading(false); 
    }
  };

  if (loading) return <div className="p-4 text-center">読み込み中...</div>;
  if (error) return <div className="p-4 text-center text-red-500">{error}</div>;

  // 編集モード (新規ユーザー含む)
  if (isEditingProfile) {
    return (
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
        isEditingProfile={isEditingProfile}
        setIsEditingProfile={setIsEditingProfile}
        spotifyProfile={spotifyProfile}
      />
    );
  }

  // 既存ユーザーのプロフィール表示モード (Page 3)
  return (
    <div className="p-4 max-w-xl mx-auto">
      <h1 className="text-3xl font-bold text-white mb-4">プロフィール</h1>
      
      {/* プロフィールカード */}
      <div className="bg-gray-800 p-6 rounded-lg shadow-md mb-6">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center space-x-4">
            {profileImageUrl && (
              <Image src={profileImageUrl} alt={nickname} width={64} height={64} className="w-16 h-16 rounded-full object-cover" />
            )}
            <div>
              <h2 className="text-2xl font-bold">{nickname}</h2>
              <a 
                href={spotifyProfile?.external_urls.spotify} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-sm text-green-400 hover:underline"
              >
                Spotifyアカウント
              </a>
            </div>
          </div>
          <button 
            onClick={() => setIsEditingProfile(true)} 
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded text-sm"
          >
            編集
          </button>
        </div>
        <p className="text-gray-300 whitespace-pre-wrap">{bio || '(自己紹介がありません)'}</p>
      </div>

      {/* フォロー中のアーティスト */}
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
    </div>
  );
}