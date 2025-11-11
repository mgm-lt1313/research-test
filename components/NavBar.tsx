// components/NavBar.tsx
import { useRouter } from 'next/router';
import Link from 'next/link';

// ナビゲーションアイテムの型
interface NavItem {
  href: string;
  label: string;
  icon: string; // 簡単なSVGアイコン
}

// アイコンコンポーネント
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
// ▼▼▼ ログアウトアイコンを追加 ▼▼▼
const LogoutIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
  </svg>
);
// ▲▲▲ 修正ここまで ▲▲▲


export default function NavBar() {
  const router = useRouter();
  // spotifyUserId をクエリから取得
  const { spotifyUserId } = router.query as { spotifyUserId?: string };
  // ▼▼▼ 修正: access_token もクエリから取得 ▼▼▼
  const { access_token } = router.query as { access_token?: string };

  const navItems: NavItem[] = [
    { href: `/profile`, label: 'プロフィール', icon: 'profile' },
    { href: `/matches`, label: 'マッチング', icon: 'match' },
    { href: `/follows`, label: 'フォロー', icon: 'follow' },
    { href: `/chats`, label: 'チャット', icon: 'chat' },
  ];

  const getIcon = (icon: string) => {
    switch (icon) {
      case 'profile': return <ProfileIcon />;
      case 'match': return <MatchIcon />;
      case 'follow': return <FollowIcon />;
      case 'chat': return <ChatIcon />;
    //    ▼▼▼ ログアウトアイコンのcaseを追加 ▼▼▼
      case 'logout': return <LogoutIcon />;
      default: return null;
    }
  };
  // ▼▼▼ ログアウト処理を追加 ▼▼▼
  const handleLogout = () => {
    localStorage.removeItem('spotify_access_token');
    localStorage.removeItem('spotify_user_id');
    router.push('/'); // ログインページに戻る
  };
  
  // ▼▼▼ 修正: 判定ロジックを修正 ▼▼▼
  // spotifyUserId も access_token もない場合は表示しない
  if (!spotifyUserId && !access_token && router.pathname.startsWith('/chat/')) {
     // トークン情報が何もないチャットルーム詳細ページでは非表示
     return null;
  }
  if (router.pathname === '/') {
      // ルートページ (ログイン画面) では非表示
      return null;
  }
  // ▲▲▲ 修正ここまで ▲▲▲

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 z-50">
      <div className="max-w-lg mx-auto flex justify-around">
        {navItems.map((item) => {
          // ▼▼▼ 修正: クエリの引き継ぎロジックを簡素化 ▼▼▼
          const currentSpotifyId = spotifyUserId || localStorage.getItem('spotify_user_id');
          const query: { [key: string]: string } = {};

          if (item.href === '/profile') {
            // プロフィールページは access_token を優先
            if (access_token) query.access_token = access_token;
          }
          
          // 他のページは spotifyUserId を必須とする
          if (item.href !== '/profile' && currentSpotifyId) {
             query.spotifyUserId = currentSpotifyId;
          }
          // ▲▲▲ 修正ここまで ▲▲▲

          const isActive = router.pathname === item.href;
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
        {/* ▼▼▼ ログアウトボタンを追加 ▼▼▼ */}
        <button
          onClick={handleLogout}
          className="flex-1 flex flex-col items-center justify-center p-2 text-xs font-medium text-gray-400 hover:text-white transition-colors"
        >
          {getIcon('logout')}
          <span>ログアウト</span>
        </button>
        {/* ▲▲▲ 修正ここまで ▲▲▲ */}
      </div>
    </nav>
  );
}