// pages/profile.tsx
import { useEffect, useState, FormEvent, ChangeEvent, useRef } from 'react'; // 👈 ChangeEvent, useRef をインポート
import { useRouter } from 'next/router';
import axios from 'axios';
import { SpotifyProfile, getMyProfile, SpotifyArtist, getMyFollowingArtists } from '../lib/spotify';
import Image from 'next/image';
import { supabase } from '../lib/supabaseClient'; // 👈 Supabase クライアントをインポート

// --- (型定義 UserProfile は変更なし) ---
interface UserProfile {
  nickname: string;
  profile_image_url: string | null;
  bio: string | null;
}

// --- (デフォルトアイコンコンポーネント) ---
// (Header.tsx から ProfileIcon をコピー)
const DefaultProfileIcon = () => (
  <svg className="w-24 h-24 text-gray-500" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
  </svg>
);


// --- (ProfileEditor コンポーネント) ---
interface ProfileEditorProps {
  // ... (既存の props は変更なし) ...
  handleProfileSubmit: (e: FormEvent) => Promise<void>;
  nickname: string;
  setNickname: (val: string) => void;
  // ▼▼▼ profileImageUrl を削除し、関連 props を追加 ▼▼▼
  // setProfileImageUrl: (val: string) => void;
  profileImageUrl: string | null; // URL または null
  bio: string;
  setBio: (val: string) => void;
  loading: boolean;
  spotifyProfile: SpotifyProfile | null;
  // ▼▼▼ ファイルアップロード関連の props を追加 ▼▼▼
  onFileChange: (e: ChangeEvent<HTMLFileInputElement>) => void;
  uploading: boolean;
}

const ProfileEditor = ({
  isNewUser,
  handleProfileSubmit,
  nickname,
  setNickname,
  profileImageUrl, // 👈 string | null を受け取る
  bio,
  setBio,
  loading,
  spotifyProfile,
  onFileChange, // 👈 追加
  uploading      // 👈 追加
}: ProfileEditorProps) => {
  
  // 隠されたファイル入力をトリガーするための ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <section className="bg-gray-800 p-6 rounded-lg shadow-md mb-6">
      <h2 className="text-xl font-bold text-white mb-4">
        プロフィール設定
      </h2>
      <form onSubmit={handleProfileSubmit} className="space-y-4">
        
        {/* ▼▼▼ アイコンアップロード機能 ▼▼▼ */}
        <div>
          <label className="block text-white text-sm font-bold mb-2">プロフィール画像 (任意)</label>
          <div className="flex items-center space-x-4">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()} // 👈 アイコンクリックで file input を開く
              className="relative w-24 h-24 rounded-full bg-gray-700 flex items-center justify-center hover:opacity-80 transition-opacity"
              disabled={uploading}
            >
              {profileImageUrl ? (
                <Image src={profileImageUrl} alt="Profile Preview" layout="fill" className="rounded-full object-cover" />
              ) : (
                <DefaultProfileIcon />
              )}
              {uploading && (
                <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-full">
                  <span className="text-xs text-white">UP...</span>
                </div>
              )}
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={onFileChange} // 👈 ファイルが選択されたら onFileChange を呼ぶ
              className="hidden" // 👈 input 自体は隠す
              accept="image/png, image/jpeg"
              disabled={uploading}
            />
            <p className="text-gray-400 text-sm">アイコンをクリックして<br />画像をアップロード</p>
          </div>
        </div>
        {/* ▲▲▲ アイコンアップロード機能ここまで ▲▲▲ */}

        {spotifyProfile && (
          // ... (Spotifyアカウント表示部分は変更なし) ...
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
          {/* ... (ニックネーム入力欄は変更なし) ... */}
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
        
        {/* ▼▼▼ 画像URL入力欄 (<div> ごと削除) ▼▼▼ */}
        {/* <div>
          <label htmlFor="profileImageUrl" ...>プロフィール画像URL (任意)</label>
          <input ... />
        </div>
        */}
        {/* ▲▲▲ 削除ここまで ▲▲▲ */}
        
        <div>
          {/* ... (自己紹介文は変更なし) ... */}
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
            disabled={loading || uploading} // 👈 uploading 中も無効化
          >
            {loading ? '保存中...' : (uploading ? '画像UP中...' : '保存')}
          </button>
        </div>
      </form>
    </section>
  );
}
// --- (ProfileEditor ここまで) ---


// --- メインコンポーネント (Profile ページ) ---
export default function Profile() {
  const router = useRouter();
  const { access_token: query_token } = router.query as { access_token?: string };

  const [accessToken, setAccessToken] = useState<string | null>(null);

  const [spotifyProfile, setSpotifyProfile] = useState<SpotifyProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true); // 👈 保存処理のローディング
  const [error, setError] = useState<string | null>(null);
  
  const [nickname, setNickname] = useState<string>('');
  // ▼▼▼ 修正: string から string | null に変更 ▼▼▼
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);
  // ▲▲▲ 修正ここまで ▲▲▲
  const [bio, setBio] = useState<string>('');
  
  const [isNewUser, setIsNewUser] = useState<boolean>(true);
  
  const [myArtists, setMyArtists] = useState<SpotifyArtist[]>([]);

  // ▼▼▼ アップロード用の state を追加 ▼▼▼
  const [uploading, setUploading] = useState<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  // ▲▲▲ 修正ここまで ▲▲▲

  // ... (トークンを特定する useEffect は変更なし) ...
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
          setProfileImageUrl(existingProfile.profile_image_url || null); // 👈 修正
          setBio(existingProfile.bio || '');
          setIsNewUser(false);
          const artistsData = await getMyFollowingArtists(accessToken); 
          setMyArtists(artistsData);
        } else {
          setNickname(profileData.display_name || '');
          setProfileImageUrl(profileData.images?.[0]?.url || null); // 👈 修正
          setIsNewUser(true);
        }
      } catch (e: unknown) {
        // ... (エラーハンドリングは変更なし) ...
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


  // ▼▼▼ 3. ファイル選択ハンドラを追加 ▼▼▼
  const handleFileChange = (e: ChangeEvent<HTMLFileInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      // プレビュー用にローカルURLを生成
      setProfileImageUrl(URL.createObjectURL(file));
    }
  };

  // ▼▼▼ 4. プロフィール保存処理 (アップロードロジックを追加) ▼▼▼
  const handleProfileSubmit = async (e: FormEvent) => { 
    e.preventDefault();
    if (!spotifyProfile || !nickname.trim() || !accessToken) {
        setError('ニックネームは必須です。');
        return;
    }
    
    setLoading(true); // 👈 (保存処理)
    setError(null);
    
    let finalImageUrl = profileImageUrl; // 現在の画像URL (DBの値 or プレビューURL)

    // --- 1. 新しいファイルが選択されている場合のみアップロード ---
    if (selectedFile) {
      setUploading(true); // 👈 (アップロード処理)
      try {
        // バケット名を 'profile-images' と仮定
        const bucketName = 'profile-images'; 
        // ファイルパス (例: public/user-spotify-id.png)
        const fileExt = selectedFile.name.split('.').pop();
        const filePath = `public/${spotifyProfile.id}.${fileExt}`;

        // Supabase Storage にアップロード (upsert: true で上書き)
        const { data, error: uploadError } = await supabase.storage
          .from(bucketName)
          .upload(filePath, selectedFile, {
            cacheControl: '3600',
            upsert: true,
          });

        if (uploadError) throw uploadError;

        // --- 2. アップロードした画像の公開URLを取得 ---
        const { data: urlData } = supabase.storage
          .from(bucketName)
          .getPublicUrl(data.path);
        
        finalImageUrl = urlData.publicUrl;
        console.log('Uploaded Public URL:', finalImageUrl);

      } catch (uploadError: any) {
         console.error('Failed to upload image:', uploadError);
         setError(`画像アップロード失敗: ${uploadError.message}`);
         setUploading(false);
         setLoading(false);
         return; // 保存処理を中断
      } finally {
        setUploading(false); // 👈 (アップロード処理) 終了
      }
    }
    // --- アップロード処理ここまで ---

    // --- 3. 最終的なURLでプロフィールを保存 ---
    try {
      await axios.post('/api/profile/save', {
        spotifyUserId: spotifyProfile.id, 
        nickname, 
        profileImageUrl: finalImageUrl, // 👈 DBのURL or 新しくアップロードしたURL
        bio,
        accessToken: accessToken, 
      }); 
      
      alert(isNewUser ? 'プロフィールを登録しました！' : 'プロフィールを更新しました！');
      setSelectedFile(null); // 選択済みファイルをリセット
      
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
      setLoading(false); // 👈 (保存処理) 終了
    }
  };

  // ... (if (loading) ... return は変更なし) ...
  if (loading && !spotifyProfile) return <div className="p-4 text-center">読み込み中...</div>;
  if (error) return <div className="p-4 text-center text-red-500">{error}</div>;

  return (
    <div className="p-4 max-w-lg mx-auto">
      
      {/* 1. プロフィール編集フォーム */}
      <ProfileEditor
        isNewUser={isNewUser}
        handleProfileSubmit={handleProfileSubmit}
        nickname={nickname}
        setNickname={setNickname}
        profileImageUrl={profileImageUrl} // 👈 string | null を渡す
        bio={bio}
        setBio={setBio}
        loading={loading} // 👈 保存ローディング
        spotifyProfile={spotifyProfile}
        onFileChange={handleFileChange} // 👈 ファイル選択ハンドラ
        uploading={uploading} // 👈 アップロードローディング
      />

      {/* 2. フォロー中のアーティスト (変更なし) */}
      {!isNewUser && (
        <div className="bg-gray-800 p-6 rounded-lg shadow-md">
          {/* ... (内容は変更なし) ... */}
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