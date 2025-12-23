import React, { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { ref, onValue, onDisconnect, set, serverTimestamp } from 'firebase/database';
import Auth from './components/Auth';
import ChatList from './components/ChatList';
import ChatRoom from './components/ChatRoom';
import Settings from './components/Settings';
import { UserProfile, AppView, Theme } from './types';
import { MessageCircle, Settings as SettingsIcon, Zap } from 'lucide-react';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<AppView>('chats');
  const [activeChatRecipient, setActiveChatRecipient] = useState<UserProfile | null>(null);
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem('flux_theme') as Theme) || 'light';
  });

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      // Small artificial delay to show off the beautiful loading animation
      setTimeout(() => {
        setUser(currentUser);
        setLoading(false);
      }, 800);
    });
    return () => unsubscribe();
  }, []);

  // Presence System
  useEffect(() => {
    if (!user) return;
    const userStatusRef = ref(db, `/status/${user.uid}`);
    const connectedRef = ref(db, '.info/connected');

    const setOnline = () => {
      set(userStatusRef, { state: 'online', last_changed: serverTimestamp() });
      onDisconnect(userStatusRef).set({ state: 'offline', last_changed: serverTimestamp() });
    };

    const setOffline = () => {
      set(userStatusRef, { state: 'offline', last_changed: serverTimestamp() });
    };

    const unsubscribeConnected = onValue(connectedRef, (snap) => {
      if (snap.val() === true) {
        if (document.visibilityState === 'visible') setOnline();
        else setOffline();
      }
    });

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') setOnline();
      else setOffline();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      unsubscribeConnected();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user]);

  useEffect(() => {
    localStorage.setItem('flux_theme', theme);
  }, [theme]);

  const handleLogout = async () => {
    if (auth.currentUser) {
      const userStatusRef = ref(db, `/status/${auth.currentUser.uid}`);
      await set(userStatusRef, { state: 'offline', last_changed: serverTimestamp() });
    }
    await signOut(auth);
    setCurrentView('chats');
  };

  const handleSelectChat = (recipient: UserProfile) => {
    setActiveChatRecipient(recipient);
    setCurrentView('chat_room');
  };

  const getMainBg = () => {
    if (theme === 'dark') return 'bg-gray-900';
    if (theme === 'newyear') return 'bg-red-50';
    return 'bg-blue-50';
  };

  const isDark = theme === 'dark';

  // Floating Nav Styles
  const navContainerClass = isDark ? 'glass-dock-dark' : 'glass-dock';
  const activePillClass = theme === 'newyear' ? 'bg-red-500 text-white' : (isDark ? 'bg-purple-600 text-white' : 'bg-blue-600 text-white');
  const inactiveIconClass = isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-400 hover:text-gray-600';

  if (loading) {
    return (
      <div className={`h-screen w-screen flex flex-col items-center justify-center ${getMainBg()} transition-colors duration-500`}>
        <div className="relative">
          <div className={`absolute inset-0 blur-xl opacity-50 ${theme === 'dark' ? 'bg-purple-500' : 'bg-blue-400'} animate-pulse-soft`}></div>
          <div className="relative z-10 bg-white/10 backdrop-blur-md p-6 rounded-3xl border border-white/20 shadow-2xl animate-pulse-soft">
             <Zap size={48} className={theme === 'dark' ? 'text-white' : 'text-blue-600'} fill="currentColor" />
          </div>
        </div>
        <h1 className={`mt-8 text-2xl font-bold tracking-widest uppercase opacity-0 animate-[fadeInUp_0.8s_ease-out_0.2s_forwards] ${isDark ? 'text-white' : 'text-gray-800'}`}>
          Flux Web
        </h1>
      </div>
    );
  }

  if (!user) {
    return <Auth onLogin={() => {}} />;
  }

  return (
    <div className={`h-screen w-full ${getMainBg()} max-w-lg mx-auto relative shadow-2xl overflow-hidden flex flex-col transition-colors duration-300`}>
      
      {/* Main Content Area - Added pb-28 for floating dock space */}
      <div className="flex-1 overflow-hidden relative animate-enter">
        
        {currentView === 'chats' && (
          <div className="h-full w-full pb-28">
            <ChatList onSelectChat={handleSelectChat} theme={theme} />
          </div>
        )}

        {currentView === 'settings' && (
          <div className="h-full w-full pb-28">
            <Settings onLogout={handleLogout} theme={theme} setTheme={setTheme} />
          </div>
        )}

        {currentView === 'chat_room' && activeChatRecipient && (
          <div className={`absolute inset-0 z-30 h-full ${theme === 'dark' ? 'bg-gray-900' : 'bg-white'}`}>
            <ChatRoom 
              recipient={activeChatRecipient} 
              onBack={() => setCurrentView('chats')}
              theme={theme} 
            />
          </div>
        )}
      </div>

      {/* Floating Bottom Navigation */}
      {currentView !== 'chat_room' && (
        <div className="absolute bottom-6 left-6 right-6 z-20 animate-[fadeInUp_0.8s_cubic-bezier(0.16,1,0.3,1)_0.2s_forwards] opacity-0">
          <div className={`${navContainerClass} rounded-2xl p-1.5 flex justify-between items-center shadow-lg`}>
            
            <button 
              onClick={() => setCurrentView('chats')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-all duration-300 active:scale-95 ${currentView === 'chats' ? `${activePillClass} shadow-md` : inactiveIconClass}`}
            >
              <MessageCircle size={22} fill={currentView === 'chats' ? "currentColor" : "none"} />
              {currentView === 'chats' && <span className="text-sm font-bold animate-[fadeInUp_0.3s_ease-out]">Чаты</span>}
            </button>
            
            <button 
              onClick={() => setCurrentView('settings')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-all duration-300 active:scale-95 ${currentView === 'settings' ? `${activePillClass} shadow-md` : inactiveIconClass}`}
            >
              <SettingsIcon size={22} />
              {currentView === 'settings' && <span className="text-sm font-bold animate-[fadeInUp_0.3s_ease-out]">Настройки</span>}
            </button>
            
          </div>
        </div>
      )}
    </div>
  );
};

export default App;