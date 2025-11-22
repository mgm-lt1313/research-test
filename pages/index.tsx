import { supabase } from '../lib/supabaseClient';

export default function Home() {
  const handleGoogleLogin = async () => {
    // SupabaseのGoogle認証を呼び出す
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        // ログイン後のリダイレクト先
        redirectTo: `${window.location.origin}/profile`,
      },
    });
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-2 bg-gray-900 text-white">
      <h1 className="text-4xl font-bold mb-6">趣味マッチング</h1>
      <button 
        onClick={handleGoogleLogin}
        className="px-6 py-3 bg-white text-gray-800 font-bold rounded-md hover:bg-gray-200"
      >
        Googleでログイン
      </button>
    </div>
  );
}