// pages/user/[id].tsx
import { useEffect, useState } from 'react';
import axios from 'axios';
import Image from 'next/image'; // 👈 Image コンポーネントをインポート

// ▼▼▼ Artist 型に image_url を追加 ▼▼▼
interface Artist {
  name: string;
  genres: string[];
  image_url: string | null; // 👈 追加
}
// ▲▲▲ 修正ここまで ▲▲▲

// ... (UserDetail 型は変更なし) ...
interface UserDetail {
  profile: { /* ... */ };
  similarity: { /* ... */ } | null;
  follow_status: 'pending' | 'approved' | 'none';
  i_am_follower: boolean; 
  artists: Artist[]; // 👈 Artist 型が更新された
}

export default function UserProfilePage() {
  // ... (useState, useEffect, handleFollow などのロジックは変更なし) ...
  const [targetUserId, setTargetUserId] = useState<string | null>(null);
  // ...
  const [user, setUser] = useState<UserDetail | null>(null);
  // ...
  
  // ... (loading, error, !user の return は変更なし) ...

  const { profile, similarity, follow_status, i_am_follower, artists } = user;
  
  // ... (followButtonText, followButtonClass のロジックは変更なし) ...

  return (
    <div className="p-4 max-w-xl mx-auto text-white">
      {/* ... (戻るリンク, ユーザーヘッダー, フォローボタン は変更なし) ... */}

      {/* ... (類似度情報(共通点) は変更なし) ... */}
      {/* (2a の修正により similarity.common_artists はアーティスト名になっているはず) */}

      {/* ▼▼▼ 相手のアーティスト一覧 (Image タグを追加) ▼▼▼ */}
      <div className="bg-gray-800 p-6 rounded-lg shadow-md my-6">
        <h2 className="text-xl font-bold mb-4">フォロー中のアーティスト</h2>
        {artists && artists.length > 0 ? (
          <ul className="space-y-3 max-h-60 overflow-y-auto">
            {artists.map(artist => (
              <li key={artist.name} className="flex items-center space-x-3">
                {/* 👈 Image タグの追加 */}
                {artist.image_url ? (
                  <Image src={artist.image_url} alt={artist.name} width={40} height={40} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gray-600 flex-shrink-0"></div>
                )}
                <div>
                  <p className="font-semibold">{artist.name}</p>
                  <p className="text-xs text-gray-400">{artist.genres.slice(0, 3).join(', ')}</p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-400 text-sm">このユーザーはアーティストをフォローしていません。</p>
        )}
      </div>
      {/* ▲▲▲ 修正ここまで ▲▲▲ */}
      
    </div>
  );
}