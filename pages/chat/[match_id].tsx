// pages/chat/[match_id].tsx
import { useRouter } from 'next/router';
import { useEffect, useState, useRef, FormEvent } from 'react';
import axios from 'axios';
import Image from 'next/image';
import Link from 'next/link';
import { supabase } from '../../lib/supabaseClient';

// メッセージの型
interface Message {
    id: number;
    created_at: string;
    sender_id: string; // uuid
    content: string;
}

// 相手のユーザー情報の型
interface OtherUser {
    id: string;
    nickname: string;
    profile_image_url: string | null;
}

export default function ChatRoom() {
    const router = useRouter();
    
    const { match_id, selfSpotifyId, otherUserId, otherNickname, otherImageUrl } = router.query as {
        match_id?: string;
        selfSpotifyId?: string;
        otherUserId?: string;
        otherNickname?: string;
        otherImageUrl?: string;
    };

    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [sending, setSending] = useState(false);
    const [otherUserInfo, setOtherUserInfo] = useState<OtherUser | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // 相手のプロフィール情報をセット
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

    // メッセージ履歴の初回取得
    useEffect(() => {
        if (!match_id || !selfSpotifyId) return;

        const fetchMessages = async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await axios.get(`/api/chat/${match_id}?selfSpotifyId=${selfSpotifyId}`);
                setMessages(res.data.messages || []);
            } catch (err: unknown) {
                 console.error("Failed to fetch messages:", err);
                 setError('メッセージの取得に失敗しました。');
            } finally {
                setLoading(false);
            }
        };

        fetchMessages();
    }, [match_id, selfSpotifyId]);

    // Supabase Realtime (新規メッセージ購読)
    useEffect(() => {
        if (!match_id || !otherUserId) return;

        const handleNewMessage = (payload: any) => {
            console.log('Realtime message received:', payload.new);
            if (payload.new.sender_id === otherUserId) {
                setMessages(currentMessages => [...currentMessages, payload.new as Message]);
            }
        };

        const subscription = supabase
            .channel(`chat_room_${match_id}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `match_id=eq.${match_id}`
                },
                handleNewMessage
            )
            .subscribe();

        console.log(`Subscribed to match_id: ${match_id}`);

        return () => {
            console.log(`Unsubscribing from match_id: ${match_id}`);
            supabase.removeChannel(subscription);
        };

    }, [match_id, otherUserId]);

    // 自動スクロール
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // メッセージ送信処理
    const handleSendMessage = async (e: FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !match_id || !selfSpotifyId || sending) return;

        setSending(true);
        setError(null);
        const contentToSend = newMessage;
        setNewMessage('');

        try {
            await axios.post(`/api/chat/${match_id}`, {
                senderSpotifyId: selfSpotifyId,
                content: contentToSend,
            });
            
            const getResponse = await axios.get(`/api/chat/${match_id}?selfSpotifyId=${selfSpotifyId}`);
            setMessages(getResponse.data.messages || []);

        } catch (err: unknown) {
           console.error("Failed to send message OR fetch after sending:", err);
           setError('メッセージの送信または再取得に失敗しました。');
           setNewMessage(contentToSend);
        } finally {
            setSending(false);
        }
    };

    if (!router.isReady) {
         return <div className="text-white p-4">チャット情報を読み込み中...</div>;
    }
    if (error) {
        return <div className="text-red-500 p-4">{error}</div>;
    }

    return (
        <div className="flex flex-col h-[calc(100vh-5rem)] max-w-lg mx-auto bg-gray-900 text-white">
            {/* ヘッダー (「...」ボタン削除済み) */}
            <header className="bg-gray-800 p-4 shadow-md flex items-center justify-between sticky top-0 z-10">
                <div className="flex items-center space-x-3">
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
            </header>

            {/* メッセージリスト */}
            <main className="flex-1 overflow-y-auto p-4 space-y-4 flex flex-col-reverse">
                 <div ref={messagesEndRef} />
                 {messages.length > 0 && [...messages].reverse().map((msg) => (
                    <div key={msg.id} className={`flex ${
                        msg.sender_id === otherUserId ? 'justify-start' : 'justify-end'
                    }`}>
                        <div className={`p-3 rounded-lg max-w-xs lg:max-w-md ${
                            msg.sender_id === otherUserId
                                ? 'bg-gray-700'
                                : 'bg-blue-600'
                        }`}>
                            <p>{msg.content}</p>
                            <p className={`text-xs mt-1 ${
                                msg.sender_id === otherUserId ? 'text-gray-400' : 'text-blue-200'
                            }`}>
                                {new Date(msg.created_at).toLocaleString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                        </div>
                    </div>
                 ))}
                 
                 {loading && messages.length === 0 && (
                    <div className="text-center text-gray-400">メッセージ履歴を読み込み中...</div>
                 )}
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

/**
 * SSRを強制し、ビルドエラーを回避
 */
export const getServerSideProps = async () => {
  return { props: {} };
};