import React, { useState, useEffect } from 'react';
import { auth } from './firebase';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import Auth from './components/Auth';
import ChatList from './components/ChatList';
import ChatRoom from './components/ChatRoom';
import Settings from './components/Settings';
import { UserProfile, AppView, Theme } from './types';
import { MessageCircle, Settings as SettingsIcon } from 'lucide-react';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<AppView>('chats');
  const [activeChatRecipient, setActiveChatRecipient] = useState<UserProfile | null>(null);
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem('flux_theme') as Theme) || 'light';
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    localStorage.setItem('flux_theme', theme);
  }, [theme]);

  const handleLogout = async () => {
    await signOut(auth);
    setCurrentView('chats');
  };

  const handleSelectChat = (recipient: UserProfile) => {
    setActiveChatRecipient(recipient);
    setCurrentView('chat_room');
  };

  // Theme Base Background Logic
  const getMainBg = () => {
    if (theme === 'dark') return 'bg-gray-900';
    if (theme === 'newyear') return 'bg-red-50';
    return 'bg-blue-50';
  };

  const getNavColor = (isActive: boolean) => {
    if (!isActive) return 'text-gray-400';
    if (theme === 'dark') return 'text-purple-400 bg-gray-800';
    if (theme === 'newyear') return 'text-red-600 bg-red-100';
    return 'text-blue-600 bg-blue-50';
  };

  if (loading) {
    return (
      <div className={`h-screen w-screen flex items-center justify-center ${getMainBg()}`}>
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-current opacity-70"></div>
      </div>
    );
  }

  if (!user) {
    return <Auth onLogin={() => {}} />;
  }

  return (
    <div className={`h-screen w-full ${getMainBg()} max-w-lg mx-auto relative shadow-2xl overflow-hidden flex flex-col transition-colors duration-300`}>
      
      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden relative">
        
        {/* Chats View */}
        {currentView === 'chats' && (
          <div className="h-full w-full">
            <ChatList onSelectChat={handleSelectChat} theme={theme} />
          </div>
        )}

        {/* Settings View */}
        {currentView === 'settings' && (
          <div className="h-full w-full">
            <Settings onLogout={handleLogout} theme={theme} setTheme={setTheme} />
          </div>
        )}

        {/* Chat Room View (Overlays everything) */}
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

      {/* Bottom Navigation (Hidden if in ChatRoom) */}
      {currentView !== 'chat_room' && (
        <div className={`${theme === 'dark' ? 'bg-gray-900 border-gray-800' : 'bg-white border-blue-100'} border-t p-2 flex justify-around items-center h-20 pb-4 z-20 transition-colors duration-300`}>
          <button 
            onClick={() => setCurrentView('chats')}
            className={`flex flex-col items-center gap-1 p-2 rounded-xl w-20 transition ${getNavColor(currentView === 'chats')}`}
          >
            <MessageCircle size={24} fill={currentView === 'chats' ? "currentColor" : "none"} />
            <span className="text-xs font-medium">Чаты</span>
          </button>
          
          <button 
            onClick={() => setCurrentView('settings')}
            className={`flex flex-col items-center gap-1 p-2 rounded-xl w-20 transition ${getNavColor(currentView === 'settings')}`}
          >
            <SettingsIcon size={24} />
            <span className="text-xs font-medium">Настройки</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default App;