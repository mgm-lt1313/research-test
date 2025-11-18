// pages/chat/[match_id].tsx
// ... (import は変更なし) ...

export default function ChatRoom() {
    // ... (ロジックは変更なし) ...
    // ...
    
    return (
        <div className="flex flex-col h-[calc(100vh-5rem)] max-w-lg mx-auto bg-gray-900 text-white">
            {/* ▼▼▼ ヘッダー (修正) ▼▼▼ */}
            <header className="bg-gray-800 p-4 shadow-md flex items-center justify-between sticky top-0 z-10">
                <div className="flex items-center space-x-3">
                    {/* 戻るボタン */}
                    <Link href={`/chats?spotifyUserId=${selfSpotifyId}`} className="text-blue-400 hover:text-blue-300">
                        &lt; 戻る
                    </Link>
                    {otherUserInfo?.profile_image_url ? (
                         <Image src={otherUserInfo.profile_image_url} alt={otherUserInfo.nickname} width={40} height={40} className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                         <div className="w-10 h-10 rounded-full bg-gray-600"></div>
                    )}
                    <h1 className="font-bold text-lg">{otherUserInfo?.nickname || '読み込み中...'}</h1>
                </div>
                
                {/* ▼▼▼ 「...」リンク (<div> ごと削除) ▼▼▼ */}
                {/* <Link 
                  href={{ ... }}
                  className="..."
                  title="ユーザー詳細を見る"
                >
                  <svg ... />
                </Link>
                */}
                {/* ▲▲▲ 削除ここまで ▲▲▲ */}
            </header>
            {/* ▲▲▲ 修正ここまで ▲▲▲ */}

            {/* ... (main, footer は変更なし) ... */}
        </div>
    );
}

// ... (getServerSideProps は変更なし) ...
export const getServerSideProps = async () => {
  return { props: {} };
};