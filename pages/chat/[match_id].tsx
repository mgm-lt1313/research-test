import { useRouter } from 'next/router';
import { useEffect, useState, useRef, FormEvent } from 'react';
import axios from 'axios';
import Image from 'next/image';
import Link from 'next/link';
import { supabase } from '../../lib/supabaseClient';

interface Message {
    id: number;
    created_at: string;
    sender_id: string;
    content: string;
}

export default function ChatRoom() {
    const router = useRouter();
    const { match_id, otherUserId, otherNickname, otherImageUrl } = router.query;

    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // ログインユーザー確認
    useEffect(() => {
        const checkUser = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) setCurrentUserId(session.user.id);
        };
        checkUser();
    }, []);

    // メッセージ取得
    useEffect(() => {
        if (!match_id || !currentUserId) return;

        const fetchMessages = async () => {
            try {
                const res = await axios.get(`/api/chat/${match_id}`, {
                    params: { userId: currentUserId }
                });
                setMessages(res.data.messages || []);
            } catch (err) {
                 console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchMessages();
    }, [match_id, currentUserId]);

    // リアルタイム購読
    useEffect(() => {
        if (!match_id) return;
        const channel = supabase
            .channel(`chat_${match_id}`)
            .on('postgres_changes', { 
                event: 'INSERT', schema: 'public', table: 'messages', 
                filter: `match_id=eq.${match_id}` 
            }, (payload) => {
                const newMsg = payload.new as Message;
                // 既に表示されているメッセージ(APIレスポンス等)と重複しないかチェック
                setMessages(prev => {
                    if (prev.some(msg => msg.id === newMsg.id)) {
                        return prev;
                    }
                    return [...prev, newMsg];
                });
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [match_id]);

    // 自動スクロール
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSendMessage = async (e: FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !match_id || !currentUserId || sending) return;

        setSending(true);
        const content = newMessage;
        setNewMessage(''); // 入力欄をクリア

        try {
            const res = await axios.post(`/api/chat/${match_id}`, {
                senderId: currentUserId,
                content: content,
            });
            
            // APIレスポンスから新しいメッセージを取得して即座に追加
            const sentMsg = res.data.newMessage;
            if (sentMsg) {
                setMessages(prev => [...prev, sentMsg]);
            }
        } catch (err) {
           console.error("Send error:", err);
           alert('送信に失敗しました');
           setNewMessage(content); // エラー時は入力を戻す
        } finally {
            setSending(false);
        }
    };

    if (!router.isReady || loading) return <div className="p-4 text-white text-center">読み込み中...</div>;

    return (
        <div className="flex flex-col h-[calc(100vh-5rem)] max-w-lg mx-auto bg-gray-900 text-white">
            {/* ヘッダー */}
            <header className="bg-gray-800 p-4 shadow-md flex items-center space-x-3 sticky top-0 z-10">
                <Link href="/chats" className="text-blue-400 hover:text-blue-300 text-sm">
                    &lt; 戻る
                </Link>
                {otherImageUrl ? (
                     <Image src={otherImageUrl as string} alt="" width={32} height={32} className="rounded-full" />
                ) : (
                     <div className="w-8 h-8 rounded-full bg-gray-600"></div>
                )}
                <h1 className="font-bold truncate">{otherNickname}</h1>
            </header>

            {/* メッセージエリア */}
            <main className="flex-1 overflow-y-auto p-4 space-y-4">
                 {messages.map((msg) => {
                    const isMe = msg.sender_id === currentUserId;
                    return (
                        <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                            <div className={`p-3 rounded-lg max-w-[80%] break-words ${
                                isMe ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-200'
                            }`}>
                                <p className="text-sm">{msg.content}</p>
                                <p className="text-[10px] opacity-70 text-right mt-1">
                                    {new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                </p>
                            </div>
                        </div>
                    );
                 })}
                 <div ref={messagesEndRef} />
            </main>

            {/* 入力フォーム */}
            <footer className="bg-gray-800 p-3">
                <form onSubmit={handleSendMessage} className="flex gap-2">
                    <input
                        className="flex-1 p-2 rounded bg-gray-700 border border-gray-600 focus:outline-none text-white"
                        placeholder="メッセージを入力"
                        value={newMessage}
                        onChange={e => setNewMessage(e.target.value)}
                        disabled={sending}
                    />
                    <button 
                        type="submit" 
                        disabled={sending || !newMessage.trim()}
                        className="bg-blue-600 px-4 py-2 rounded font-bold disabled:opacity-50"
                    >
                        送信
                    </button>
                </form>
            </footer>
        </div>
    );
}