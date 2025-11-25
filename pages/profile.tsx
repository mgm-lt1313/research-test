import { useEffect, useState, useRef, ChangeEvent } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';
import { HOBBY_TAGS } from '../lib/constants';
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
        // DBの画像 > Google画像 > なし
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

  // 画像選択時の処理
  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !user) return;
    
    setUploading(true);
    const file = e.target.files[0];
    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}-${Date.now()}.${fileExt}`;
    const filePath = `${fileName}`;

    try {
      // Supabase Storageへアップロード
      const { error: uploadError } = await supabase.storage
        .from('profile-images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // 公開URLを取得
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
        profileImageUrl, // 画像URLを送信
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

  if (loading) return <div className="p-4 text-white">読み込み中...</div>;

  return (
    <div className="p-4 max-w-lg mx-auto bg-gray-900 text-white min-h-screen">
      <h1 className="text-2xl font-bold mb-6">プロフィール設定</h1>
      
      {/* 画像アップロードエリア */}
      <div className="flex flex-col items-center mb-6">
        <div className="relative w-28 h-28 mb-3 group">
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="relative w-full h-full rounded-full overflow-hidden border-2 border-gray-600 group-hover:border-green-500 transition-colors"
            disabled={uploading}
          >
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
            {/* ホバー時のオーバーレイ */}
            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 flex items-center justify-center transition-all">
              <span className="text-white opacity-0 group-hover:opacity-100 text-xs font-bold">変更</span>
            </div>
          </button>
          {uploading && <div className="absolute bottom-0 right-0 text-xs text-green-400 bg-gray-800 px-1 rounded">UP中...</div>}
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
        disabled={loading || uploading}
      >
        {loading ? '処理中...' : '保存してマッチングへ'}
      </button>
    </div>
  );
}