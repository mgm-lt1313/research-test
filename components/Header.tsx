// components/Header.tsx
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

// --- ▼▼▼ アイコンコンポーネントを NavBar.tsx からコピー ▼▼▼ ---
const ProfileIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);
const MatchIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
  </svg>
);
const FollowIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
  </svg>
);
const ChatIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
  </svg>
);
const LogoutIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
  </svg>
);
// --- ▲▲▲ アイコンコンポーネントここまで ▲▲▲ ---

interface NavItem {
  href: string;
  label: string;
  icon: string; // アイコン名を指定
}

export default function Header() {
  const router = useRouter();
  const { spotifyUserId } = router.query as { spotifyUserId?: string };
  const { access_token } = router.query as { access_token?: string };

  const [clientSpotifyId, setClientSpotifyId] = useState<string | null>(null);
  const [clientAccessToken, setClientAccessToken] = useState<string | null>(null);

  useEffect(() => {
    const storedId = localStorage.getItem('spotify_user_id');
    const storedToken = localStorage.getItem('spotify_access_token');
    if (storedId) setClientSpotifyId(storedId);
    if (storedToken) setClientAccessToken(storedToken);
  }, []);

  const currentSpotifyId = spotifyUserId || clientSpotifyId;
  const currentAccessToken = access_token || clientAccessToken;
  const currentPath = router.pathname;

  // ▼▼▼ 修正: icon プロパティを追加 ▼▼▼
  const navItems: NavItem[] = [
    { href: `/profile`, label: 'プロフィール', icon: 'profile' },
    { href: `/matches`, label: 'マッチング', icon: 'match' },
    { href: `/follows`, label: 'フォロー', icon: 'follow' },
    { href: `/chats`, label: 'チャット', icon: 'chat' },
  ];

  // ▼▼▼ 修正: アイコンを返すヘルパー関数を追加 ▼▼▼
  const getIcon = (icon: string) => {
    switch (icon) {
      case 'profile': return <ProfileIcon />;
      case 'match': return <MatchIcon />;
      case 'follow': return <FollowIcon />;
      case 'chat': return <ChatIcon />;
      case 'logout': return <LogoutIcon />;
      default: return null;
    }
  };

  // ログアウト処理
  const handleLogout = async () => {
    localStorage.removeItem('spotify_access_token');
    localStorage.removeItem('spotify_user_id');
    setClientSpotifyId(null);
    setClientAccessToken(null);
    await supabase.auth.signOut();
    router.push('/');
  };
  
  if (currentPath === '/') {
      return null;
  }

  // ▼▼▼ 修正: ヘッダーのレイアウトを PDF に合わせ、アイコンを表示 ▼▼▼
  return (
    <header className="fixed top-0 left-0 right-0 bg-gray-800 border-b border-gray-700 z-50">
      <div className="max-w-lg mx-auto flex justify-around">
        {/* ナビゲーションリンク */}
        {navItems.map((item) => {
          const query: { [key: string]: string } = {};
          
          if (item.href === '/profile') {
            if (currentAccessToken) query.access_token = currentAccessToken;
          } else if (currentSpotifyId) {
             query.spotifyUserId = currentSpotifyId;
          }
          
          const isActive = currentPath === item.href;

          return (
            <Link
              key={item.label}
              href={{ pathname: item.href, query }}
              className={`flex-1 flex flex-col items-center justify-center p-2 text-xs font-medium transition-colors
                ${isActive ? 'text-green-400' : 'text-gray-400 hover:text-white'}
              `}
            >
              {getIcon(item.icon)}
              <span>{item.label}</span>
            </Link>
          );
        })}
        {/* ログアウトボタン */}
        <button
          onClick={handleLogout}
          className="flex-1 flex flex-col items-center justify-center p-2 text-xs font-medium text-gray-400 hover:text-white transition-colors"
        >
          {getIcon('logout')}
          <span>ログアウト</span>
        </button>
      </div>
    </header>
  );
  // ▲▲▲ 修正ここまで ▲▲▲
}