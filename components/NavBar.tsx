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


export default function NavBar() {
  const router = useRouter();
  // spotifyUserId をクエリから取得
  const { spotifyUserId } = router.query as { spotifyUserId?: string };

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
      default: return null;
    }
  };
  
  // spotifyUserId がない場合はナビゲーションを表示しない（チャットページなどで必要）
  if (!spotifyUserId && !router.pathname.startsWith('/profile')) {
      return null;
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 z-50">
      <div className="max-w-lg mx-auto flex justify-around">
        {navItems.map((item) => {
          // access_token や spotifyUserId を現在のクエリから引き継ぐ
          const query = { ...router.query };
          
          // /profile ページは access_token を必要とする場合がある
          if(item.href === '/profile' && router.query.access_token) {
              query.access_token = router.query.access_token;
          }
          // /profile 以外は spotifyUserId を引き継ぐ
          if(item.href !== '/profile' && spotifyUserId) {
              query.spotifyUserId = spotifyUserId;
          }

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
      </div>
    </nav>
  );
}