import React, { useState } from 'react';
import { auth, db } from '../firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { ref, set, get, child } from 'firebase/database';
import { UserProfile } from '../types';

interface AuthProps {
  onLogin: () => void;
}

const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isRegistering) {
        // Validation
        if (!username || username.length < 3) {
          throw new Error("Юзернейм должен быть больше 3 символов");
        }

        // Check if username exists (simple check for this demo)
        const dbRef = ref(db);
        const snapshot = await get(child(dbRef, `usernames/${username}`));
        if (snapshot.exists()) {
           throw new Error("Этот юзернейм уже занят");
        }

        // Create User
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Default Avatar
        const photoURL = `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`;

        // Save generic profile
        await updateProfile(user, {
          displayName: username, // Initially set displayName as username
          photoURL: photoURL
        });

        // Save to Database
        const newUser: UserProfile = {
          uid: user.uid,
          email: user.email || '',
          username: username.toLowerCase(),
          displayName: username,
          photoURL: photoURL
        };

        await set(ref(db, 'users/' + user.uid), newUser);
        await set(ref(db, 'usernames/' + username.toLowerCase()), user.uid);

      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      onLogin();
    } catch (err: any) {
      setError(err.message.replace('Firebase: ', ''));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-purple-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative Circles */}
      <div className="absolute top-10 left-10 w-32 h-32 bg-purple-600 rounded-full blur-3xl opacity-30"></div>
      <div className="absolute bottom-10 right-10 w-64 h-64 bg-indigo-600 rounded-full blur-3xl opacity-30"></div>

      <div className="bg-white/10 backdrop-blur-md border border-white/20 p-8 rounded-2xl w-full max-w-md shadow-2xl z-10">
        <h1 className="text-3xl font-bold text-center text-white mb-2">Flux Web</h1>
        <p className="text-purple-200 text-center mb-8">
          {isRegistering ? 'Создать аккаунт' : 'Вход в аккаунт'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegistering && (
            <div>
              <label className="block text-purple-200 text-sm font-medium mb-1">Юзернейм</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.replace(/\s/g, '').toLowerCase())}
                placeholder="username"
                className="w-full bg-black/20 border border-purple-400/30 rounded-lg p-3 text-white placeholder-purple-300/50 focus:outline-none focus:ring-2 focus:ring-purple-400 transition"
                required
              />
            </div>
          )}

          <div>
            <label className="block text-purple-200 text-sm font-medium mb-1">Почта</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@mail.com"
              className="w-full bg-black/20 border border-purple-400/30 rounded-lg p-3 text-white placeholder-purple-300/50 focus:outline-none focus:ring-2 focus:ring-purple-400 transition"
              required
            />
          </div>

          <div>
            <label className="block text-purple-200 text-sm font-medium mb-1">Пароль</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-black/20 border border-purple-400/30 rounded-lg p-3 text-white placeholder-purple-300/50 focus:outline-none focus:ring-2 focus:ring-purple-400 transition"
              required
            />
          </div>

          {error && <div className="text-red-300 text-sm bg-red-900/40 p-2 rounded">{error}</div>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 rounded-xl transition duration-300 transform hover:scale-[1.02] shadow-lg"
          >
            {loading ? 'Загрузка...' : (isRegistering ? 'Создать' : 'Войти')}
          </button>
        </form>

        {isRegistering && (
           <p className="mt-4 text-xs text-purple-300 text-center leading-relaxed opacity-80">
             Почту можно любой ввести, мы не воруем данные как у Max messages.
           </p>
        )}

        <div className="mt-6 text-center">
          <button
            onClick={() => setIsRegistering(!isRegistering)}
            className="text-purple-300 hover:text-white text-sm font-medium transition"
          >
            {isRegistering ? 'Уже есть аккаунт? Войти' : 'Нет аккаунта? Создать'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Auth;