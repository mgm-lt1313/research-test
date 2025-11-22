import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';
import { HOBBY_TAGS } from '../lib/constants';
import axios from 'axios';

export default function Profile() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [nickname, setNickname] = useState('');
  const [bio, setBio] = useState('');
  const [selectedHobbies, setSelectedHobbies] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Supabaseのセッション確認
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/');
        return;
      }
      setUser(session.user);
      
      // 既存データの取得
      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .single();
      
      if (profile) {
        setNickname(profile.nickname);
        setBio(profile.bio || '');
        // 保存済みタグの取得
        const { data: hobbies } = await supabase
          .from('user_hobbies')
          .select('hobby_name')
          .eq('user_id', session.user.id);
        if (hobbies) setSelectedHobbies(hobbies.map((h: any) => h.hobby_name));
      }
      setLoading(false);
    };
    checkUser();
  }, []);

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
      // APIへ保存リクエスト
      await axios.post('/api/profile/save', {
        userId: user.id,
        email: user.email,
        nickname,
        bio,
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
      <h1 className="text-2xl font-bold mb-4">プロフィール設定</h1>
      
      <div className="mb-4">
        <label className="block mb-2">ニックネーム</label>
        <input 
          className="w-full p-2 rounded bg-gray-800 border border-gray-700"
          value={nickname} 
          onChange={e => setNickname(e.target.value)} 
        />
      </div>

      <div className="mb-4">
        <label className="block mb-2">自己紹介</label>
        <textarea 
          className="w-full p-2 rounded bg-gray-800 border border-gray-700"
          value={bio} 
          onChange={e => setBio(e.target.value)} 
        />
      </div>

      <div className="mb-6">
        <label className="block mb-2 font-bold">趣味タグを選択</label>
        <div className="flex flex-wrap gap-2">
          {HOBBY_TAGS.map(tag => (
            <button
              key={tag}
              onClick={() => toggleHobby(tag)}
              className={`px-3 py-1 rounded-full text-sm transition-colors ${
                selectedHobbies.includes(tag)
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      <button 
        onClick={handleSave}
        className="w-full py-3 bg-green-600 font-bold rounded hover:bg-green-700"
        disabled={loading}
      >
        保存してマッチングへ
      </button>
    </div>
  );
}