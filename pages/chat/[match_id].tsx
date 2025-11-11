import { useRouter } from 'next/router';
import { useEffect, useState, useRef, FormEvent } from 'react';
import axios from 'axios';
import Image from 'next/image';
import Link from 'next/link';
import { supabase } from '../../lib/supabaseClient'; // 👈 1. Supabase クライアントをインポート

// メッセージの型 (変更なし)
interface Message {
    id: number;
    created_at: string;
    sender_id: string; // uuid
    content: string;
}

// 相手のユーザー情報の型 (変更なし)
interface OtherUser {
    id: string;
    nickname: string;
    profile_image_url: string | null;
}

export default function ChatRoom() {
    const router = useRouter();
    
    // (router.query の取得は変更なし)
    const { match_id, selfSpotifyId, otherUserId, otherNickname, otherImageUrl } = router.query as {
        match_id?: string;
        selfSpotifyId?: string;
        otherUserId?: string;
        otherNickname?: string;
        otherImageUrl?: string;
    };

    // (useState フック群は変更なし)
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [sending, setSending] = useState(false);
    const [otherUserInfo, setOtherUserInfo] = useState<OtherUser | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // (相手のプロフィール情報をセットする useEffect は変更なし)
    useEffect(() => {
        if (otherUserId && otherNickname) {
            setOtherUserInfo({
                id: otherUserId,
                nickname: decodeURIComponent(otherNickname),
                profile_image_url: otherImageUrl ? decodeURIComponent(otherImageUrl) : null
            });
        } else if (otherUserId) {
            setOtherUserInfo({ id: otherUserId, nickname: `ユーザー(${otherUserId.substring(0, 6)}...)`, profile_image_url: null });
        }
    }, [otherUserId, otherNickname, otherImageUrl]);

    // (メッセージ履歴の初回取得用 useEffect は変更なし)
    useEffect(() => {
        if (!match_id || !selfSpotifyId) return;

        const fetchMessages = async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await axios.get(`/api/chat/${match_id}?selfSpotifyId=${selfSpotifyId}`);
                setMessages(res.data.messages || []);
            } catch (err: unknown) {
                 // ... (エラーハンドリング)
            } finally {
                setLoading(false);
            }
        };

        fetchMessages();
    }, [match_id, selfSpotifyId]);

    // ▼▼▼ 2. 【重要】Supabase Realtime のための useEffect を追加 ▼▼▼
    useEffect(() => {
        // match_id または otherUserId がないと購読できない
        if (!match_id || !otherUserId) return;

        // 'messages' テーブルで 'INSERT' が発生した場合のコールバック
        const handleNewMessage = (payload: any) => {
            console.log('Realtime message received:', payload.new);
            
            // 自分が送信したメッセージは、handleSendMessage側で処理される（または既にリストにある）
            // 相手 (otherUserId) からのメッセージのみを state に追加する
            if (payload.new.sender_id === otherUserId) {
                setMessages(currentMessages => [...currentMessages, payload.new as Message]);
            }
        };

        // 購読（サブスクリプション）を開始
        const subscription = supabase
            .channel(`chat_room_${match_id}`) // このチャットルーム専用のチャンネル
            .on(
                'postgres_changes', // データベースの変更をリッスン
                {
                    event: 'INSERT', // INSERT (新規作成) イベントのみ
                    schema: 'public',
                    table: 'messages',
                    filter: `match_id=eq.${match_id}` // このチャットルームのメッセージのみに絞り込む
                },
                handleNewMessage // イベント発生時に実行する関数
            )
            .subscribe();

        console.log(`Subscribed to match_id: ${match_id}`);

        // コンポーネントがアンマウント（ページ離脱）されたときに購読を解除する（重要）
        return () => {
            console.log(`Unsubscribing from match_id: ${match_id}`);
            supabase.removeChannel(subscription);
        };

    }, [match_id, otherUserId]); // 👈 match_id と otherUserId に依存
    // ▲▲▲ 修正ここまで ▲▲▲

    // (末尾への自動スクロール useEffect は変更なし)
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // (handleSendMessage は変更なし)
    const handleSendMessage = async (e: FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !match_id || !selfSpotifyId || sending) return;

        setSending(true);
        setError(null);
        const contentToSend = newMessage;
        setNewMessage('');

        try {
            // 1. 自分のAPIにPOST (DBに保存)
            await axios.post(`/api/chat/${match_id}`, {
                senderSpotifyId: selfSpotifyId,
                content: contentToSend,
            });
            
            // 2. 自分の画面を更新するために再取得 (Supabase Realtime は相手用)
            // ※注: このGETリクエストは、自分の画面を即時更新するために残しています。
            const getResponse = await axios.get(`/api/chat/${match_id}?selfSpotifyId=${selfSpotifyId}`);
            setMessages(getResponse.data.messages || []);

        } catch (err: unknown) {
           console.error("Failed to send message OR fetch after sending:", err);
           // ... (エラーハンドリング)
           setError('メッセージの送信または再取得に失敗しました。');
           setNewMessage(contentToSend);
        } finally {
            setSending(false);
        }
    };

    // (router.isReady, error の return は変更なし)
    if (!router.isReady) {
         return <div className="text-white p-4">チャット情報を読み込み中...</div>;
    }
    if (error) {
        return <div className="text-red-500 p-4">{error}</div>;
    }

    // (JSX の return 部分は変更なし)
    return (
        <div className="flex flex-col h-screen max-w-lg mx-auto bg-gray-900 text-white">
            {/* ヘッダー (修正) */}
            <header className="bg-gray-800 p-4 shadow-md flex items-center justify-between sticky top-0 z-10">
                <div className="flex items-center space-x-3">
                    {/* 戻るボタンのリンク先を /chats に修正 */}
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
                
                {/* ▼▼▼ ユーザー詳細への「...」リンクを追加 ▼▼▼ */}
                <Link 
                  href={{
                      pathname: `/user/${otherUserId}`,
                      query: { selfSpotifyId: selfSpotifyId }
                  }}
                  className="text-gray-400 hover:text-white p-2"
                  title="ユーザー詳細を見る"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                  </svg>
                </Link>
                {/* ▲▲▲ 修正ここまで ▲▲▲ */}
            </header>

            {/* メッセージリスト */}
            <main className="flex-1 overflow-y-auto p-4 space-y-4">
                 {loading && messages.length === 0 && (
                    <div className="text-center text-gray-400">メッセージ履歴を読み込み中...</div>
                 )}
                {messages.map((msg) => (
                    <div key={msg.id} className={`flex ${
                        msg.sender_id === otherUserId ? 'justify-start' : 'justify-end'
                    }`}>
                        <div className={`p-3 rounded-lg max-w-xs lg:max-w-md ${
                            msg.sender_id === otherUserId
                                ? 'bg-gray-700' // 相手のメッセージ
                                : 'bg-blue-600' // 自分のメッセージ
                        }`}>
                            <p>{msg.content}</p>
                            {/* ▼▼▼ タイムスタンプ表示を追加 ▼▼▼ */}
                            <p className={`text-xs mt-1 ${
                                msg.sender_id === otherUserId ? 'text-gray-400' : 'text-blue-200'
                            }`}>
                                {new Date(msg.created_at).toLocaleString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                            {/* ▲▲▲ 追加ここまで ▲▲▲ */}
                            
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </main>

            {/* メッセージ入力フォーム */}
            <footer className="bg-gray-800 p-4 sticky bottom-0 z-10">
                <form onSubmit={handleSendMessage} className="flex space-x-2">
                    <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="メッセージを入力..."
                        className="flex-1 p-2 rounded bg-gray-700 border border-gray-600 focus:outline-none focus:border-blue-500 text-white"
                        disabled={sending}
                    />
                    <button
                        type="submit"
                        className={`px-4 py-2 rounded font-semibold ${
                            sending || !newMessage.trim()
                                ? 'bg-gray-500 cursor-not-allowed'
                                : 'bg-blue-600 hover:bg-blue-700'
                        }`}
                        disabled={sending || !newMessage.trim()}
                    >
                        {sending ? '送信中...' : '送信'}
                    </button>
                </form>
            </footer>
        </div>
    );
}