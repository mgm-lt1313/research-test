// pages/match.tsx (修正済み・全体)
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import { SpotifyProfile, SpotifyArtist, getMyProfile, getMyFollowingArtists } from '../lib/spotify';
import Image from 'next/image';
import Link from 'next/link';

interface UserProfile {
  nickname: string;
  profile_image_url: string | null;
  bio: string | null;
}

interface SelectedArtist {
  id: string;
  name: string;
  image: string | null;
}

type MatchTab = 'profile' | 'artists';

interface MatchResult {
    matched_user_id: string; // uuid
    score: number;
    profile: UserProfile | null;
    sharedArtists: string[];
}

export default function Match() {
  const router = useRouter();
  const { access_token } = router.query as { access_token?: string };

  const [profile, setProfile] = useState<SpotifyProfile | null>(null);
  const [artists, setArtists] = useState<SpotifyArtist[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [nickname, setNickname] = useState<string>('');
  const [profileImageUrl, setProfileImageUrl] = useState<string>('');
  const [bio, setBio] = useState<string>('');
  const [selectedArtists, setSelectedArtists] = useState<SelectedArtist[]>([]);
  const [calculatedArtists, setCalculatedArtists] = useState<SelectedArtist[]>([]);
  const [activeTab, setActiveTab] = useState<MatchTab>('profile');
  const [isNewUser, setIsNewUser] = useState<boolean>(true);
  const [isEditingProfile, setIsEditingProfile] = useState<boolean>(false);
  const [isEditingArtists, setIsEditingArtists] = useState<boolean>(false);
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [followingInProgress, setFollowingInProgress] = useState<Set<string>>(new Set()); // uuid

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
        const artistsData = await getMyFollowingArtists(access_token);
        setArtists(artistsData);

        const [existingProfileRes, artistsRes] = await Promise.all([
             axios.get<{ profile: UserProfile | null }>(`/api/profile/get?spotifyUserId=${profileData.id}`),
             axios.get(`/api/artists/get?spotifyUserId=${profileData.id}`)
        ]);

        const existingProfile = existingProfileRes.data.profile;
        setSelectedArtists(artistsRes.data.selectedArtists || []);
        setCalculatedArtists(artistsRes.data.calculatedArtists || []);

        if (existingProfile) {
            setNickname(existingProfile.nickname);
            setProfileImageUrl(existingProfile.profile_image_url || '');
            setBio(existingProfile.bio || '');
            setIsNewUser(false);
            const matchRes = await axios.post('/api/match/calculate', { spotifyUserId: profileData.id });
            setMatches(matchRes.data.matches);
        } else {
            setNickname(profileData.display_name || '');
            setProfileImageUrl(profileData.images?.[0]?.url || '');
            setIsNewUser(true);
            setIsEditingProfile(true);
        }
      } catch (e: unknown) { // unknown 型を使用
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

  const handleFollow = async (targetUserId: string) => { // uuid
    setFollowingInProgress(prev => new Set(prev).add(targetUserId));
    try {
      if (!profile) throw new Error('Profile not loaded');
      // --- 🔽 API呼び出し (ステップ3で作成) ---
      await axios.post('/api/follow/request', {
        targetUserId: targetUserId,
        selfSpotifyId: profile.id
      });
      // --- 🔼 API呼び出し ---
      alert(`ユーザー: ${targetUserId} にフォローリクエストを送信しました。`);
      // TODO: UIを「リクエスト済み」に変更 (例: followingInProgress を使ってボタン表示を切り替える)
    } catch (err: unknown) { // unknown 型を使用
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
     // (デモ用にすぐ解除する場合)
    // setTimeout(() => {
    //     setFollowingInProgress(prev => {
    //         const next = new Set(prev);
    //         next.delete(targetUserId);
    //         return next;
    //       });
    // }, 1000);
  };

  const toggleArtistSelection = (artist: SpotifyArtist) => {
    if (!isEditingArtists) {
        alert('「アーティスト選択」ボタンを押して編集モードを開始してください。');
        return;
    }
    const isSelected = selectedArtists.some(sa => sa.id === artist.id);
    const artistData: SelectedArtist = {
        id: artist.id, name: artist.name, image: artist.images?.[0]?.url || null,
    };
    if (isSelected) {
        setSelectedArtists(selectedArtists.filter(sa => sa.id !== artist.id));
    } else {
        if (selectedArtists.length < 3) {
            setSelectedArtists([...selectedArtists, artistData]);
        } else {
            alert('選択できるアーティストは最大3人までです。');
        }
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !nickname.trim()) return setError('Spotifyプロフィール未読込かニックネームが空です。');
    setLoading(true); setError(null);
    try {
      await axios.post('/api/profile/save', {
        spotifyUserId: profile.id, 
        nickname, 
        profileImageUrl, 
        bio,
        // ▼▼▼ この行を追加 ▼▼▼
        accessToken: access_token, 
        // ▲▲▲ この行を追加 ▲▲▲
      }); //
      alert(isNewUser ? 'プロフィールを登録しました！' : 'プロフィールを更新しました！');
      setIsNewUser(false); setIsEditingProfile(false);
    } catch (e: unknown) { // unknown 型を使用
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

  const handleArtistSave = async () => {
    if (!profile || !access_token || selectedArtists.length === 0) {
        return setError('プロフィール未読込かアーティスト未選択です。');
    }
    setLoading(true); setError(null);
    try {
        const res = await axios.post('/api/artists/save', {
            spotifyUserId: profile.id, selectedArtists, accessToken: access_token,
        });
        setCalculatedArtists(res.data.calculatedArtists || []);
        alert('アーティストを保存し、関連アーティストを計算しました！');
        setIsEditingArtists(false);
        // マッチング再計算
        const matchRes = await axios.post('/api/match/calculate', { spotifyUserId: profile.id });
        setMatches(matchRes.data.matches);
    } catch (e: unknown) { // unknown 型を使用
       if (axios.isAxiosError(e)) {
            const apiMessage = e.response?.data?.message || e.response?.status || '不明';
            setError(`アーティストの保存・計算中にエラーが発生しました: ${apiMessage}`);
            console.error('アーティスト保存エラー(Axios):', e.response?.data || e.message);
        } else if (e instanceof Error) {
             setError(`予期せぬエラーが発生しました: ${e.message}`);
             console.error('アーティスト保存エラー:', e.message);
        } else {
            setError('予期せぬ不明なエラーが発生しました。');
            console.error('アーティスト保存で不明なエラー:', e);
        }
    } finally { setLoading(false); }
  };

  if (loading) return <div className="flex justify-center items-center min-h-screen">データをロード中...</div>;
  if (error) return <div className="flex justify-center items-center min-h-screen text-red-500">{error}</div>;

  const ProfileEditor = () => (/* ... (変更なし) ... */ <div className="p-4 max-w-xl mx-auto bg-gray-800 rounded-lg shadow-md mt-4"> <h2 className="text-xl font-bold text-white mb-4"> {isNewUser ? 'プロフィール登録' : 'プロフィール編集'} </h2> <form onSubmit={handleProfileSubmit} className="space-y-4"> <div> <label htmlFor="nickname" className="block text-white text-sm font-bold mb-2">ニックネーム <span className="text-red-500">*</span></label> <input type="text" id="nickname" className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" value={nickname} onChange={(e) => setNickname(e.target.value)} required /> </div> <div> <label htmlFor="profileImageUrl" className="block text-white text-sm font-bold mb-2">プロフィール画像URL (任意)</label> <input type="url" id="profileImageUrl" className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" value={profileImageUrl} onChange={(e) => setProfileImageUrl(e.target.value)} placeholder="例: http://example.com/your-image.jpg" /> {profileImageUrl && <Image src={profileImageUrl} alt="Preview" width={96} height={96} className="mt-2 w-24 h-24 object-cover rounded-full" />} </div> <div> <label htmlFor="bio" className="block text-white text-sm font-bold mb-2">自己紹介文 (任意)</label> <textarea id="bio" className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline h-24 resize-none" value={bio} onChange={(e) => setBio(e.target.value)} placeholder="あなたの好きな音楽のジャンルや、活動していることなど"></textarea> </div> <div className="flex justify-between"> <button type="submit" className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline" disabled={loading}> {loading ? '保存中...' : (isNewUser ? 'プロフィールを登録' : '更新を保存')} </button> {isEditingProfile && !isNewUser && ( <button type="button" onClick={() => setIsEditingProfile(false)} className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline" disabled={loading}> キャンセル </button> )} </div> </form> </div>);
  const ArtistSelection = () => (/* ... (変更なし) ... */ <div className="p-4 max-w-2xl mx-auto bg-gray-800 rounded-lg shadow-md mt-4"> <h2 className="text-xl font-bold text-white mb-4">マッチング用アーティスト選択 ({selectedArtists.length}/3)</h2> <p className="text-gray-400 mb-4">あなたのプロフィールを特徴づけるアーティストを3人まで選んでください。</p> <div className="mb-4 flex flex-wrap gap-2"> <span className="text-white text-sm font-bold">選択中:</span> {selectedArtists.map(artist => ( <span key={artist.id} className="bg-green-600 text-white text-xs font-semibold px-2 py-1 rounded-full"> {artist.name} </span> ))} {selectedArtists.length === 0 && <span className="text-gray-400 text-sm">選択されていません</span>} </div> <button onClick={handleArtistSave} className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline mb-4" disabled={loading || selectedArtists.length === 0} > {loading ? '保存・計算中...' : '選択したアーティストを保存・計算'} </button> <ul className="grid grid-cols-1 md:grid-cols-2 gap-4"> {artists.map((artist) => { const isSelected = selectedArtists.some(sa => sa.id === artist.id); return ( <li key={artist.id} className={`bg-gray-700 p-4 rounded-lg shadow-sm flex items-center space-x-3 cursor-pointer ${isSelected ? 'ring-2 ring-green-500' : 'hover:bg-gray-600'}`} onClick={() => toggleArtistSelection(artist)} > {artist.images?.[0]?.url && ( <Image src={artist.images[0].url} alt={artist.name} width={32} height={32} className="w-8 h-8 rounded-full object-cover" /> )} <span className="text-white font-medium"> {artist.name} </span> </li> ); })} </ul> </div>);

  if (isNewUser) return <div className="p-4 max-w-2xl mx-auto"><h1 className="text-3xl font-bold text-white mb-6 mt-8 text-center">👋 ようこそ！プロフィールを登録してください</h1><ProfileEditor /></div>;
  if (isEditingProfile || isEditingArtists) return <div className="p-4 max-w-2xl mx-auto mt-8"><div className="flex border-b border-gray-700 mb-4"><button onClick={() => { setActiveTab('profile'); setIsEditingProfile(true); setIsEditingArtists(false); }} className={`px-4 py-2 font-medium text-sm ${(activeTab === 'profile' || isEditingProfile) ? 'border-b-2 border-blue-500 text-blue-400' : 'text-gray-400 hover:text-white'}`}>プロフィール編集</button><button onClick={() => { setActiveTab('artists'); setIsEditingArtists(true); setIsEditingProfile(false); }} className={`px-4 py-2 font-medium text-sm ${(activeTab === 'artists' || isEditingArtists) ? 'border-b-2 border-blue-500 text-blue-400' : 'text-gray-400 hover:text-white'}`}>アーティスト選択</button></div>{(activeTab === 'profile' || isEditingProfile) && <ProfileEditor />}{(activeTab === 'artists' || isEditingArtists) && <ArtistSelection />}<div className='flex justify-center mt-6'><button onClick={() => { setIsEditingProfile(false); setIsEditingArtists(false); }} className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline">メイン画面に戻る</button></div></div>;

  return (
    <div className="p-4 max-w-2xl mx-auto text-white">
      {profile && (
        <div className="bg-gray-800 p-6 rounded-lg shadow-md mb-6 relative">
          <div className="absolute top-4 right-4 flex space-x-2">
            <Link href={`/chats?spotifyUserId=${profile.id}`} className="bg-green-600 hover:bg-green-700 text-white font-bold py-1 px-3 rounded text-sm">チャット一覧</Link>
            <button onClick={() => { setIsEditingProfile(true); setActiveTab('profile'); }} className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-1 px-3 rounded text-sm">プロフィール編集</button>
            <button onClick={() => { setIsEditingArtists(true); setActiveTab('artists'); }} className="bg-purple-500 hover:bg-purple-600 text-white font-bold py-1 px-3 rounded text-sm">アーティスト選択</button>
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
              if (!match.profile) return <li key={match.matched_user_id} className="bg-gray-700 p-4 rounded-lg shadow-md"><span className="text-gray-400">プロフィールの取得に失敗 (ID: {match.matched_user_id})</span></li>;
              const isFollowing = followingInProgress.has(match.matched_user_id);
              return (
              <li key={match.matched_user_id} className="bg-gray-700 p-4 rounded-lg shadow-md">
                <div className="flex items-start space-x-4">
                  {match.profile.profile_image_url ? (<Image src={match.profile.profile_image_url} alt={match.profile.nickname} width={48} height={48} className="w-12 h-12 rounded-full object-cover flex-shrink-0" />) : (<div className="w-12 h-12 rounded-full bg-gray-600 flex-shrink-0"></div>)}
                  <div className="flex-grow">
                    <h3 className="text-lg font-bold">{match.profile.nickname}</h3>
                    <p className="text-sm text-gray-300 mt-1 mb-2 line-clamp-2">{match.profile.bio || '(自己紹介文がありません)'}</p>
                    <div className="text-xs text-green-400">💚 共通のアーティストが {match.score}人 います</div>
                  </div>
                  <button onClick={() => handleFollow(match.matched_user_id)} disabled={isFollowing} className={`flex-shrink-0 px-4 py-2 rounded font-semibold text-sm ${isFollowing ? 'bg-gray-500 text-white cursor-wait' : 'bg-blue-500 hover:bg-blue-600 text-white'}`}>
                    {isFollowing ? '送信中...' : 'フォロー'}
                  </button>
                </div>
              </li>
            );})}
          </ul>
        </>
      )}

      <h2 className="text-xl font-bold mt-8 mb-4 border-b border-gray-700 pb-2">あなたの音楽的趣味</h2>
      <h3 className="text-lg font-semibold mb-3">🎧 選択したアーティスト</h3>
      {selectedArtists.length > 0 ? (<div className="flex flex-wrap gap-4 mb-4">{selectedArtists.map(artist => (<div key={artist.id} className="bg-gray-700 p-3 rounded-lg flex items-center space-x-3 shadow-md">{artist.image && (<Image src={artist.image} alt={artist.name} width={32} height={32} className="w-8 h-8 rounded-full object-cover" />)}<span className="font-medium">{artist.name}</span></div>))}</div>) : (<p className="text-gray-400 mb-4">（アーティストが選択されていません。「アーティスト選択」から設定してください）</p>)}
      <h3 className="text-lg font-semibold mb-3">📈 算出された関連アーティスト</h3>
      {calculatedArtists.length > 0 ? (<div className="flex flex-wrap gap-4 mb-8">{calculatedArtists.map(artist => (<div key={artist.id} className="bg-gray-600 p-3 rounded-lg flex items-center space-x-3 shadow-sm">{artist.image && (<Image src={artist.image} alt={artist.name} width={32} height={32} className="w-8 h-8 rounded-full object-cover" />)}<span className="font-medium">{artist.name}</span></div>))}</div>) : (<p className="text-gray-400 mb-8">{selectedArtists.length > 0 ? '（関連アーティストがまだ計算されていません）' : '（アーティストを選択すると、関連アーティストが計算されます）'}</p>)}

      <h2 className="text-xl font-bold mt-4 mb-4">フォロー中の全アーティスト</h2>
      {artists.length > 0 ? (<ul className="grid grid-cols-1 md:grid-cols-2 gap-4">{artists.map((artist) => {const isSelected = selectedArtists.some(sa => sa.id === artist.id); return (<li key={artist.id} className={`bg-gray-700 p-4 rounded-lg shadow-sm flex items-center space-x-3 ${isEditingArtists ? 'cursor-pointer hover:bg-gray-600' : 'opacity-70'} ${isSelected ? 'ring-2 ring-green-500' : ''}`} onClick={() => isEditingArtists && toggleArtistSelection(artist)}>{artist.images?.[0]?.url && (<Image src={artist.images[0].url} alt={artist.name} width={32} height={32} className="w-8 h-8 rounded-full object-cover"/>)}<a href={artist.external_urls.spotify} target="_blank" rel="noopener noreferrer" className="text-blue-300 hover:underline font-medium" onClick={(e) => isEditingArtists && e.preventDefault()}>{artist.name}</a></li>);})}</ul>) : (<p className="text-gray-400">フォローしているアーティストがいません。</p>)}
    </div>
  );
}