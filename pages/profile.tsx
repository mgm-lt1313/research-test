import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';
import { HOBBY_TAGS } from '../lib/constants';
import Image from 'next/image'; // 画像表示用に追加
import axios from 'axios';

export default function Profile() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [nickname, setNickname] = useState('');
  const [bio, setBio] = useState('');
  const [profileImageUrl, setProfileImageUrl] = useState(''); // 画像URL管理用
  const [selectedHobbies, setSelectedHobbies] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/');
        return;
      }
      setUser(session.user);
      
      // DBから既存データを取得
      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .single();
      
      if (profile) {
        setNickname(profile.nickname || '');
        setBio(profile.bio || '');
        // DBに画像があればそれを、なければGoogleの画像をセット
        setProfileImageUrl(profile.profile_image_url || session.user.user_metadata.avatar_url || '');
        
        const { data: hobbies } = await supabase
          .from('user_hobbies')
          .select('hobby_name')
          .eq('user_id', session.user.id);
        if (hobbies) setSelectedHobbies(hobbies.map((h: any) => h.hobby_name));
      } else {
        // 初回ログイン時はGoogleの情報を初期値にする
        setProfileImageUrl(session.user.user_metadata.avatar_url || '');
        setNickname(session.user.user_metadata.full_name || '');
      }
      setLoading(false);
    };
    checkUser();
  }, [router]);

  const toggleHobby = (hobby: string) => {
    if (selectedHobbies.includes(hobby)) {
      setSelectedHobbies(prev => prev.filter(h => h !== hobby));
    } else {
      setSelectedHobbies(prev => [...prev, hobby]);
    }
  };

  const handleSave = async () => {
    if (!user || !nickname) return alert("ニックネームは必須です");
    setLoading(true);

    try {
      await axios.post('/api/profile/save', {
        userId: user.id,
        email: user.email,
        nickname,
        bio,
        profileImageUrl, // 画像URLも送信
        hobbies: selectedHobbies
      });
      alert('保存しました！');
      router.push('/matches');
    } catch (e) {
      console.error(e);
      alert('エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-4 text-white">読み込み中...</div>;

  return (
    <div className="p-4 max-w-lg mx-auto bg-gray-900 text-white min-h-screen">
      <h1 className="text-2xl font-bold mb-6">プロフィール設定</h1>
      
      {/* ▼▼▼ アイコン表示エリア ▼▼▼ */}
      <div className="flex flex-col items-center mb-6">
        <div className="w-24 h-24 relative mb-2">
          {profileImageUrl ? (
            <Image 
              src={profileImageUrl} 
              alt="Profile" 
              layout="fill" 
              className="rounded-full object-cover border-2 border-gray-600"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-gray-700 flex items-center justify-center text-gray-400">
              No Image
            </div>
          )}
        </div>
        <p className="text-xs text-gray-400">
          ※Googleアカウントのアイコンが自動設定されます
        </p>
      </div>

      <div className="mb-4">
        <label className="block mb-2 text-sm text-gray-300">ニックネーム</label>
        <input 
          className="w-full p-3 rounded bg-gray-800 border border-gray-700 focus:border-green-500 focus:outline-none"
          value={nickname} 
          onChange={e => setNickname(e.target.value)} 
        />
      </div>

      <div className="mb-4">
        <label className="block mb-2 text-sm text-gray-300">自己紹介</label>
        <textarea 
          className="w-full p-3 rounded bg-gray-800 border border-gray-700 focus:border-green-500 focus:outline-none"
          rows={3}
          value={bio} 
          onChange={e => setBio(e.target.value)} 
        />
      </div>

      <div className="mb-8">
        <label className="block mb-2 text-sm text-gray-300 font-bold">趣味タグを選択</label>
        <div className="flex flex-wrap gap-2">
          {HOBBY_TAGS.map(tag => (
            <button
              key={tag}
              onClick={() => toggleHobby(tag)}
              className={`px-3 py-1.5 rounded-full text-sm transition-all ${
                selectedHobbies.includes(tag)
                  ? 'bg-green-600 text-white shadow-md shadow-green-900'
                  : 'bg-gray-800 text-gray-300 border border-gray-600 hover:bg-gray-700'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      <button 
        onClick={handleSave}
        className="w-full py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-500 transition-colors shadow-lg"
        disabled={loading}
      >
        {loading ? '保存中...' : '保存してマッチングへ'}
      </button>
    </div>
  );
}