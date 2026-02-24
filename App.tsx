import React, { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { ref, onValue, onDisconnect, set, serverTimestamp } from 'firebase/database';
import Auth from './components/Auth';
import ChatList from './components/ChatList';
import ChatRoom from './components/ChatRoom';
import Settings from './components/Settings';
import { UserProfile, AppView, Theme } from './types';
import { MessageCircle, Settings as SettingsIcon, Zap, Snowflake } from 'lucide-react';

// Lightweight Snowfall Component for Global Usage
const GlobalSnowfall = () => {
  const [flakes] = useState(() => 
    Array.from({ length: 30 }).map((_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      animationDuration: `${Math.random() * 5 + 5}s`,
      animationDelay: `${Math.random() * 5}s`,
      opacity: Math.random() * 0.5 + 0.1,
      size: Math.random() * 3 + 2
    }))
  );

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
       {flakes.map(flake => (
         <div
           key={flake.id}
           className="absolute top-[-10px] rounded-full bg-white blur-[0.5px]"
           style={{
             left: flake.left,
             width: `${flake.size}px`,
             height: `${flake.size}px`,
             opacity: flake.opacity,
             animation: `fall ${flake.animationDuration} linear infinite`,
             animationDelay: flake.animationDelay,
             willChange: 'transform'
           }}
         />
       ))}
       <style>{`
         @keyframes fall {
           0% { transform: translate3d(0, -10vh, 0); }
           100% { transform: translate3d(20px, 110vh, 0); }
         }
       `}</style>
    </div>
  );
};

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

  // Global Background Logic
  const getMainBg = () => {
    if (theme === 'dark') return 'bg-gray-900';
    // Rich Red Gradient for New Year
    if (theme === 'newyear') return 'bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-red-900 via-red-800 to-red-950';
    if (theme === 'forest') return 'bg-[#1a2e22]'; // Dark Forest Green
    if (theme === 'neon') return 'bg-black'; // Deep Black
    if (theme === 'moscow') return 'bg-[#f5f5f7]'; // Clean Light Gray
    if (theme === 'lebedev') return 'bg-[#ffffff]'; // Pure White
    if (theme === 'simple') return 'bg-blue-50'; // Default Blue
    return 'bg-blue-50';
  };

  const isDark = ['dark', 'forest', 'neon'].includes(theme);
  const isNewYear = theme === 'newyear';

  // Navigation Styles
  let navContainerClass = 'glass-dock'; // Default Light
  if (isDark) navContainerClass = 'glass-dock-dark';
  // Frosty Glass for New Year
  if (isNewYear) navContainerClass = 'bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl';

  // Active Pill Styles
  let activePillClass = 'bg-blue-600 text-white';
  if (theme === 'dark') activePillClass = 'bg-purple-600 text-white';
  if (theme === 'forest') activePillClass = 'bg-emerald-600 text-white';
  if (theme === 'neon') activePillClass = 'bg-pink-600 text-white shadow-[0_0_15px_rgba(236,72,153,0.5)]';
  if (theme === 'moscow') activePillClass = 'bg-red-600 text-white';
  if (theme === 'lebedev') activePillClass = 'bg-black text-white';
  
  // White pill with red text for New Year (looks cleaner on red bg)
  if (isNewYear) activePillClass = 'bg-white text-red-700 shadow-lg scale-105';

  // Inactive Icon Styles
  let inactiveIconClass = 'text-gray-400 hover:text-gray-600';
  if (isDark) inactiveIconClass = 'text-gray-400 hover:text-gray-200';
  if (isNewYear) inactiveIconClass = 'text-red-200/70 hover:text-white';

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
    <div className={`h-screen w-full ${getMainBg()} relative overflow-hidden flex flex-col transition-colors duration-500`}>
      
      {/* Global Snowfall for New Year Theme */}
      {isNewYear && <GlobalSnowfall />}

      {/* Main Content Area - Added pb-28 for floating dock space */}
      <div className="flex-1 overflow-hidden relative animate-enter z-10">
        
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
        <div className="absolute bottom-6 left-0 right-0 flex justify-center z-20 animate-[fadeInUp_0.8s_cubic-bezier(0.16,1,0.3,1)_0.2s_forwards] opacity-0 pointer-events-none">
          <div className={`${navContainerClass} w-full max-w-md mx-4 pointer-events-auto rounded-2xl p-1.5 flex justify-between items-center transition-all duration-300`}>
            
            <button 
              onClick={() => setCurrentView('chats')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-all duration-300 active:scale-95 ${currentView === 'chats' ? activePillClass : inactiveIconClass}`}
            >
              <MessageCircle size={22} fill={currentView === 'chats' ? "currentColor" : "none"} />
              {currentView === 'chats' && <span className="text-sm font-bold animate-[fadeInUp_0.3s_ease-out]">Чаты</span>}
            </button>
            
            <button 
              onClick={() => setCurrentView('settings')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-all duration-300 active:scale-95 ${currentView === 'settings' ? activePillClass : inactiveIconClass}`}
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