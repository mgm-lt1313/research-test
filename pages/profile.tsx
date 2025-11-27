import { useEffect, useState, useRef, ChangeEvent } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';
import { HOBBY_CATEGORIES } from '../lib/constants'; // 変更：カテゴリ付きの定数をインポート
import Image from 'next/image';
import axios from 'axios';

export default function Profile() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [nickname, setNickname] = useState('');
  const [bio, setBio] = useState('');
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);
  const [selectedHobbies, setSelectedHobbies] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/');
        return;
      }
      setUser(session.user);
      
      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .single();
      
      if (profile) {
        setNickname(profile.nickname || '');
        setBio(profile.bio || '');
        setProfileImageUrl(profile.profile_image_url || session.user.user_metadata.avatar_url || null);
        
        const { data: hobbies } = await supabase
          .from('user_hobbies')
          .select('hobby_name')
          .eq('user_id', session.user.id);
        if (hobbies) setSelectedHobbies(hobbies.map((h: any) => h.hobby_name));
      } else {
        setProfileImageUrl(session.user.user_metadata.avatar_url || null);
        setNickname(session.user.user_metadata.full_name || '');
      }
      setLoading(false);
    };
    checkUser();
  }, [router]);

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !user) return;
    
    setUploading(true);
    const file = e.target.files[0];
    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}-${Date.now()}.${fileExt}`;
    const filePath = `${fileName}`;

    try {
      const { error: uploadError } = await supabase.storage
        .from('profile-images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('profile-images')
        .getPublicUrl(filePath);

      setProfileImageUrl(urlData.publicUrl);
    } catch (error) {
      console.error('Upload error:', error);
      alert('画像のアップロードに失敗しました。');
    } finally {
      setUploading(false);
    }
  };

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
        profileImageUrl,
        hobbies: selectedHobbies
      });
      alert('保存しました！');
      router.push('/matches');
    } catch (e) {
      console.error(e);
      alert('保存に失敗しました。');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-4 text-white text-center">読み込み中...</div>;

  return (
    <div className="p-4 max-w-2xl mx-auto bg-gray-900 text-white min-h-screen">
      <h1 className="text-2xl font-bold mb-6 text-center">プロフィール設定</h1>
      
      {/* 画像アップロードエリア */}
      <div className="flex flex-col items-center mb-8">
        <div className="relative w-28 h-28 mb-3 group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
          <div className="w-full h-full rounded-full overflow-hidden border-2 border-gray-600 group-hover:border-green-500 transition-colors relative">
            {profileImageUrl ? (
              <Image 
                src={profileImageUrl} 
                alt="Profile" 
                layout="fill" 
                className="object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gray-700 flex items-center justify-center text-gray-400">
                No Image
              </div>
            )}
            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 flex items-center justify-center transition-all duration-200">
              <span className="text-white opacity-0 group-hover:opacity-100 text-xs font-bold">変更</span>
            </div>
          </div>
          {uploading && <div className="absolute bottom-0 right-0 text-xs text-white bg-green-600 px-2 py-0.5 rounded-full shadow">UP中...</div>}
        </div>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          accept="image/*"
        />
        <p className="text-xs text-gray-400">アイコンをクリックして画像を変更</p>
      </div>

      {/* 入力フォーム */}
      <div className="space-y-6 mb-10">
        <div>
          <label className="block mb-2 text-sm font-semibold text-gray-300">ニックネーム <span className="text-red-500">*</span></label>
          <input 
            className="w-full p-3 rounded-lg bg-gray-800 border border-gray-700 focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none transition-all"
            value={nickname} 
            onChange={e => setNickname(e.target.value)}
            placeholder="表示名を入力してください"
          />
        </div>

        <div>
          <label className="block mb-2 text-sm font-semibold text-gray-300">自己紹介</label>
          <textarea 
            className="w-full p-3 rounded-lg bg-gray-800 border border-gray-700 focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none transition-all"
            rows={3}
            value={bio} 
            onChange={e => setBio(e.target.value)}
            placeholder="趣味や興味について自由に書いてください"
          />
        </div>
      </div>

      {/* 趣味タグ選択エリア（カテゴリ別表示） */}
      <div className="mb-10">
        <h2 className="text-lg font-bold mb-4 border-b border-gray-700 pb-2">趣味タグを選択</h2>
        <div className="space-y-6">
          {HOBBY_CATEGORIES.map((category) => (
            <div key={category.name}>
              <h3 className="text-sm text-green-400 font-bold mb-3">{category.name}</h3>
              <div className="flex flex-wrap gap-2">
                {category.tags.map(tag => (
                  <button
                    key={tag}
                    onClick={() => toggleHobby(tag)}
                    className={`px-3 py-1.5 rounded-full text-sm transition-all duration-200 ${
                      selectedHobbies.includes(tag)
                        ? 'bg-green-600 text-white shadow-lg scale-105'
                        : 'bg-gray-800 text-gray-300 border border-gray-600 hover:bg-gray-700 hover:border-gray-500'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 保存ボタン */}
      <div className="sticky bottom-6">
        <button 
          onClick={handleSave}
          className="w-full py-4 bg-green-600 text-white font-bold rounded-xl hover:bg-green-500 transition-colors shadow-lg disabled:opacity-70 disabled:cursor-not-allowed"
          disabled={loading || uploading}
        >
          {loading ? '保存中...' : '保存してマッチングへ'}
        </button>
      </div>
    </div>
  );
}