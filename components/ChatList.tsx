import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { ref, onValue, get } from 'firebase/database';
import { UserProfile, ChatSession, Theme } from '../types';
import { Search, MessageSquare } from 'lucide-react';

interface ChatListProps {
  onSelectChat: (recipient: UserProfile) => void;
  theme: Theme;
}

const ChatList: React.FC<ChatListProps> = ({ onSelectChat, theme }) => {
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const currentUser = auth.currentUser;

  // Theme Config
  const isDark = theme === 'dark';
  const headerBg = theme === 'newyear' ? 'bg-gradient-to-br from-red-600 to-red-700' : (isDark ? 'bg-gray-800 border-b border-gray-700' : 'bg-blue-600');
  const cardBg = isDark ? 'bg-gray-800' : 'bg-white';
  const textPrimary = isDark ? 'text-white' : 'text-gray-800';
  const textSecondary = isDark ? 'text-gray-400' : 'text-gray-500';
  const accentText = theme === 'newyear' ? 'text-red-500' : (isDark ? 'text-purple-400' : 'text-blue-500');
  const inputBg = isDark ? 'bg-gray-900/50 border-gray-700 placeholder-gray-500' : 'bg-white/20 border-white/10 placeholder-blue-100';

  useEffect(() => {
    if (!currentUser) return;
    const chatsRef = ref(db, 'chats');
    const unsubscribe = onValue(chatsRef, async (snapshot) => {
      const data = snapshot.val();
      const loadedChats: ChatSession[] = [];
      if (data) {
        for (const [key, value] of Object.entries(data)) {
          const chatData = value as any;
          if (chatData.participants && chatData.participants.includes(currentUser.uid)) {
            const otherUid = chatData.participants.find((uid: string) => uid !== currentUser.uid);
            if (otherUid) {
               const userRef = ref(db, `users/${otherUid}`);
               const userSnap = await get(userRef);
               if (userSnap.exists()) {
                 loadedChats.push({
                   chatId: key,
                   participants: chatData.participants,
                   lastMessage: chatData.lastMessage,
                   timestamp: chatData.timestamp,
                   recipientUser: userSnap.val()
                 });
               }
            }
          }
        }
      }
      loadedChats.sort((a, b) => b.timestamp - a.timestamp);
      setChats(loadedChats);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [currentUser]);

  const handleSearch = async (term: string) => {
    setSearchTerm(term);
    
    // Удаляем @ в начале и пробелы
    const cleanTerm = term.trim().replace(/^@/, '').toLowerCase();

    if (cleanTerm.length > 0) {
      setIsSearching(true);
      const usersRef = ref(db, 'users');
      
      try {
        // Используем client-side filtering чтобы избежать ошибки "Index not defined"
        // если правила базы данных не настроены вручную.
        const snapshot = await get(usersRef);
        
        if (snapshot.exists()) {
          const results: UserProfile[] = [];
          snapshot.forEach((child) => {
             const u = child.val();
             // Не показываем самого себя в поиске и проверяем совпадение по началу строки
             if (u.uid !== currentUser?.uid && u.username && u.username.startsWith(cleanTerm)) {
                 results.push(u);
             }
          });
          setSearchResults(results);
        } else {
          setSearchResults([]);
        }
      } catch (e) { 
        console.error(e); 
        setSearchResults([]);
      }
    } else {
      setIsSearching(false);
      setSearchResults([]);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className={`${headerBg} p-4 pb-6 shadow-md rounded-b-[2rem] z-10 transition-colors duration-300`}>
        <div className="flex justify-between items-center mb-4">
           <h1 className="text-white text-2xl font-bold">Flux Web</h1>
           {theme === 'newyear' && <span className="text-2xl">🎄</span>}
        </div>
        <div className="relative">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Поиск по @юзернейм"
            className={`w-full pl-10 pr-4 py-3 rounded-xl text-white focus:outline-none backdrop-blur-sm transition border ${inputBg}`}
          />
          <Search className="absolute left-3 top-3 text-white/60" size={20} />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar">
        {isSearching ? (
          <div>
             <h2 className={`${isDark ? 'text-gray-300' : 'text-blue-900'} font-semibold mb-2 ml-2`}>Результаты поиска</h2>
             {searchResults.length === 0 ? (
               <div className={`text-center mt-10 ${textSecondary}`}>Пользователь не найден</div>
             ) : (
               searchResults.map((user) => (
                 <div
                   key={user.uid}
                   onClick={() => onSelectChat(user)}
                   className={`flex items-center gap-4 ${cardBg} p-4 rounded-2xl shadow-sm cursor-pointer hover:shadow-md transition active:scale-[0.98]`}
                 >
                    <img src={user.photoURL} alt={user.username} className="w-12 h-12 rounded-full bg-gray-200 object-cover" />
                    <div>
                      <p className={`font-bold ${textPrimary}`}>{user.displayName}</p>
                      <p className={`${accentText} text-sm`}>@{user.username}</p>
                    </div>
                 </div>
               ))
             )}
          </div>
        ) : (
          <>
             <h2 className={`${isDark ? 'text-gray-300' : 'text-blue-900'} font-semibold mb-2 ml-2`}>Ваши чаты</h2>
             {loading ? (
               <div className={`text-center mt-10 animate-pulse ${textSecondary}`}>Загрузка чатов...</div>
             ) : chats.length === 0 ? (
               <div className={`flex flex-col items-center justify-center h-64 opacity-70 ${textSecondary}`}>
                 <MessageSquare size={48} className="mb-2" />
                 <p>Нет чатов</p>
                 <p className="text-sm mt-1">Найдите кого-нибудь через поиск!</p>
               </div>
             ) : (
               chats.map((chat) => (
                 <div
                   key={chat.chatId}
                   onClick={() => chat.recipientUser && onSelectChat(chat.recipientUser)}
                   className={`flex items-center gap-4 ${cardBg} p-4 rounded-2xl shadow-sm cursor-pointer hover:brightness-95 transition active:scale-[0.99]`}
                 >
                    <div className="relative">
                      <img
                        src={chat.recipientUser?.photoURL}
                        alt="Avatar"
                        className="w-14 h-14 rounded-full bg-gray-200 object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline">
                        <h3 className={`font-bold truncate ${textPrimary}`}>{chat.recipientUser?.displayName}</h3>
                        <span className={`text-xs ml-2 ${textSecondary}`}>
                           {new Date(chat.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </span>
                      </div>
                      <p className={`${textSecondary} text-sm truncate`}>{chat.lastMessage || 'Изображение'}</p>
                    </div>
                 </div>
               ))
             )}
          </>
        )}
      </div>
    </div>
  );
};

export default ChatList;