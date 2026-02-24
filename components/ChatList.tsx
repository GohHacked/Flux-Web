import React, { useState, useEffect, useRef } from 'react';
import { db, auth } from '../firebase';
import { ref, onValue, get } from 'firebase/database';
import { UserProfile, ChatSession, Theme } from '../types';
import { Search, MessageSquare, Loader2, Snowflake, Zap, BadgeCheck, Bot } from 'lucide-react';

interface ChatListProps {
  onSelectChat: (recipient: UserProfile) => void;
  theme: Theme;
}

interface ChatSessionExtended extends ChatSession {
  isTyping?: boolean;
}

const FLUX_BOT_ID = 'flux_bot_official';
const SPAM_BOT_ID = 'flux_spam_bot';

const ChatList: React.FC<ChatListProps> = ({ onSelectChat, theme }) => {
  const [chats, setChats] = useState<ChatSessionExtended[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isConnected, setIsConnected] = useState(true);
  
  // New state for unread counts
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const initialLoadRef = useRef(true);

  const currentUser = auth.currentUser;

  // Theme Config
  const isDark = theme === 'dark';
  const isNewYear = theme === 'newyear';
  
  // Header Styles
  const headerBg = isNewYear 
      ? 'bg-transparent' 
      : (isDark ? 'bg-gray-900/90 border-b border-gray-800' : 'bg-white/80 border-b border-blue-50');
  
  const titleColor = isNewYear ? 'text-white drop-shadow-sm' : (isDark ? 'text-white' : 'text-blue-600');
  
  // Search Input Styles
  const inputContainerBg = isNewYear 
      ? 'bg-black/20 border border-white/10 backdrop-blur-sm' 
      : (isDark ? 'bg-gray-800' : 'bg-gray-100');
  
  const inputText = isNewYear || isDark 
      ? 'text-white placeholder-white/50' 
      : 'text-gray-800 placeholder-gray-400';
  
  const searchIconColor = isNewYear ? 'text-white/60' : (isDark ? 'text-gray-500' : 'text-gray-400');

  // Card Styles
  const cardBg = isNewYear 
      ? 'bg-white/10 backdrop-blur-md border border-white/5 hover:bg-white/15' 
      : (isDark ? 'bg-gray-800' : 'bg-white');
      
  const textPrimary = isNewYear || isDark ? 'text-white' : 'text-gray-900';
  const textSecondary = isNewYear ? 'text-red-100/70' : (isDark ? 'text-gray-400' : 'text-gray-500');
  const accentText = isNewYear ? 'text-red-200 font-bold' : (isDark ? 'text-purple-400' : 'text-blue-500');

  // Request Notification Permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Connection Status Listener
  useEffect(() => {
    const connectedRef = ref(db, '.info/connected');
    const unsubscribe = onValue(connectedRef, (snap) => {
      setIsConnected(!!snap.val());
    });
    return () => unsubscribe();
  }, []);

  // Load Chats
  useEffect(() => {
    if (!currentUser) return;
    const chatsRef = ref(db, 'chats');
    const unsubscribe = onValue(chatsRef, async (snapshot) => {
      const data = snapshot.val();
      const loadedChats: ChatSessionExtended[] = [];
      const now = Date.now();

      // --- INJECT OFFICIAL BOTS ---
      
      // 1. News Bot
      const newsBotUser: UserProfile = {
        uid: FLUX_BOT_ID,
        displayName: 'Flux Bot',
        username: 'flux_news_bot',
        email: 'news@flux.web',
        photoURL: 'flux_logo_zap', 
        bio: 'Официальный бот новостей Flux Web.'
      };
      const newsBotChat: ChatSessionExtended = {
        chatId: 'official_news_channel',
        participants: [currentUser.uid, FLUX_BOT_ID],
        lastMessage: 'Добро пожаловать в Flux Web!',
        timestamp: Date.now() + 20000, 
        recipientUser: newsBotUser,
        isTyping: false
      };
      loadedChats.push(newsBotChat);

      // 2. Spam Info Bot
      const spamBotUser: UserProfile = {
        uid: SPAM_BOT_ID,
        displayName: 'Spam Info Bot',
        username: 'spambot',
        email: 'spam@flux.web',
        photoURL: 'flux_spam_bot_img',
        bio: 'Бот для проверки ограничений аккаунта.'
      };
      const spamBotChat: ChatSessionExtended = {
        chatId: 'official_spam_channel',
        participants: [currentUser.uid, SPAM_BOT_ID],
        lastMessage: 'Нажмите /start для проверки',
        timestamp: Date.now() + 15000,
        recipientUser: spamBotUser,
        isTyping: false
      };
      loadedChats.push(spamBotChat);

      // -------------------------------

      if (data) {
        // Iterate through all chats
        for (const [key, value] of Object.entries(data)) {
          const chatData = value as any;
          if (chatData.participants && chatData.participants.includes(currentUser.uid)) {
            const otherUid = chatData.participants.find((uid: string) => uid !== currentUser.uid);
            
            if (otherUid && otherUid !== FLUX_BOT_ID && otherUid !== SPAM_BOT_ID) {
               // Check typing status
               let isTyping = false;
               if (chatData.typing && chatData.typing[otherUid]) {
                   const typingTime = chatData.typing[otherUid];
                   if (now - typingTime < 4000) {
                       isTyping = true;
                   }
               }

               const userRef = ref(db, `users/${otherUid}`);
               const userSnap = await get(userRef);
               
               if (userSnap.exists()) {
                 loadedChats.push({
                   chatId: key,
                   participants: chatData.participants,
                   lastMessage: chatData.lastMessage,
                   timestamp: chatData.timestamp,
                   recipientUser: userSnap.val(),
                   isTyping: isTyping
                 });
               }
            }
          }
        }
      }
      // Sort by timestamp desc
      loadedChats.sort((a, b) => b.timestamp - a.timestamp);
      
      setChats(loadedChats);
      setLoading(false);
      
      // Allow notifications after initial load logic
      setTimeout(() => { initialLoadRef.current = false; }, 2000);
    });
    return () => unsubscribe();
  }, [currentUser]);

  // Listen for Unread Messages & Trigger Notifications
  useEffect(() => {
    if (!currentUser || chats.length === 0) return;

    const unsubs: (() => void)[] = [];

    chats.forEach(chat => {
      // Skip listener for fake bots
      if (chat.chatId === 'official_news_channel' || chat.chatId === 'official_spam_channel') return; 

      const messagesRef = ref(db, `messages/${chat.chatId}`);
      
      const unsub = onValue(messagesRef, (snapshot) => {
         const msgs = snapshot.val();
         if (!msgs) {
             setUnreadCounts(prev => ({ ...prev, [chat.chatId]: 0 }));
             return;
         }

         let count = 0;
         let lastUnreadMsg = '';
         
         Object.values(msgs).forEach((m: any) => {
            if (m.senderId !== currentUser.uid && !m.read) {
                count++;
                lastUnreadMsg = m.text;
            }
         });

         setUnreadCounts(prev => {
             const prevCount = prev[chat.chatId] || 0;
             
             // Trigger Notification if count increased and not initial load
             if (count > prevCount && !initialLoadRef.current) {
                 if (Notification.permission === 'granted' && chat.recipientUser) {
                     new Notification(chat.recipientUser.displayName, {
                         body: lastUnreadMsg.startsWith('data:') ? 'Фото' : lastUnreadMsg,
                         icon: chat.recipientUser.photoURL,
                         silent: false
                     });
                 }
             }
             
             return { ...prev, [chat.chatId]: count };
         });
      });
      
      unsubs.push(unsub);
    });

    return () => unsubs.forEach(u => u());
  }, [chats, currentUser]);

  const handleSearch = async (term: string) => {
    setSearchTerm(term);
    const cleanTerm = term.trim().replace(/^@/, '').toLowerCase();

    if (cleanTerm.length > 0) {
      setIsSearching(true);
      const usersRef = ref(db, 'users');
      try {
        const snapshot = await get(usersRef);
        if (snapshot.exists()) {
          const results: UserProfile[] = [];
          snapshot.forEach((child) => {
             const u = child.val();
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

  const getHeaderContent = () => {
    if (!isConnected) {
      return (
        <div className="flex items-center gap-2 animate-pulse">
           <span>Соединение...</span>
           <Loader2 size={18} className="animate-spin opacity-60" />
        </div>
      );
    }
    if (loading) {
      return (
        <div className="flex items-center gap-2 animate-pulse">
           <span>Обновление...</span>
           <Loader2 size={18} className="animate-spin opacity-60" />
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2">
        <span>Flux Web</span>
        {isNewYear && <Snowflake size={18} className="animate-spin-slow" />}
      </div>
    );
  };

  const renderAvatar = (user: UserProfile) => {
    if (user.uid === FLUX_BOT_ID || user.photoURL === 'flux_logo_zap') {
       return (
         <div className={`w-14 h-14 rounded-full flex items-center justify-center bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-lg ${isNewYear ? 'ring-2 ring-white/20' : ''}`}>
             <Zap size={28} fill="currentColor" />
         </div>
       );
    }
    if (user.uid === SPAM_BOT_ID || user.photoURL === 'flux_spam_bot_img') {
        return (
          <div className={`w-14 h-14 rounded-full flex items-center justify-center bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-lg ${isNewYear ? 'ring-2 ring-white/20' : ''}`}>
              <Bot size={28} />
          </div>
        );
     }
    return (
      <img
        src={user.photoURL}
        alt="Avatar"
        className={`w-14 h-14 rounded-full bg-gray-200 object-cover ${isNewYear ? 'ring-2 ring-white/20' : ''}`}
      />
    );
  };

  return (
    <div className={`flex flex-col h-full ${isNewYear ? 'bg-transparent' : ''}`}>
      {/* Header */}
      <div className={`${headerBg} backdrop-blur-md px-4 pt-4 pb-3 z-10 transition-colors duration-300`}>
        <div className="flex justify-between items-center mb-3 px-1 h-8">
           <h1 className={`text-2xl font-bold tracking-tight ${titleColor}`}>
              {getHeaderContent()}
           </h1>
        </div>
        
        <div className="relative group">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Поиск"
            className={`w-full pl-10 pr-4 py-2.5 rounded-xl text-sm font-medium focus:outline-none transition-all ${inputContainerBg} ${inputText} focus:ring-2 ${isNewYear ? 'focus:ring-white/30' : (isDark ? 'focus:ring-gray-700' : 'focus:ring-blue-100')}`}
          />
          <Search className={`absolute left-3 top-2.5 ${searchIconColor} transition group-focus-within:text-current`} size={18} />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1 no-scrollbar">
        {isSearching ? (
          <div className="pt-2 px-2">
             <h2 className={`text-xs font-bold uppercase tracking-wider mb-3 ml-1 ${textSecondary}`}>Результаты поиска</h2>
             {searchResults.length === 0 ? (
               <div className={`text-center mt-10 ${textSecondary}`}>Пользователь не найден</div>
             ) : (
               searchResults.map((user) => (
                 <div
                   key={user.uid}
                   onClick={() => onSelectChat(user)}
                   className={`flex items-center gap-3 ${cardBg} p-3 rounded-xl mb-2 cursor-pointer transition hover:bg-opacity-80 active:scale-[0.98]`}
                 >
                    {renderAvatar(user)}
                    <div>
                      <p className={`font-semibold text-sm ${textPrimary}`}>{user.displayName}</p>
                      <p className={`text-xs ${isNewYear ? 'text-red-200' : 'text-blue-500'}`}>@{user.username}</p>
                    </div>
                 </div>
               ))
             )}
          </div>
        ) : (
          <div className="pt-2">
             <h2 className={`text-xs font-bold uppercase tracking-wider mb-2 ml-3 ${textSecondary}`}>Ваши чаты</h2>
             {loading ? (
               <div className={`text-center mt-10 animate-pulse text-sm ${textSecondary}`}>Загрузка...</div>
             ) : chats.length === 0 ? (
               <div className={`flex flex-col items-center justify-center h-64 opacity-60 ${textSecondary}`}>
                 <MessageSquare size={40} className="mb-3 opacity-50" strokeWidth={1.5} />
                 <p className="font-medium">Нет чатов</p>
                 <p className="text-xs mt-1">Найдите друзей через поиск</p>
               </div>
             ) : (
               chats.map((chat) => {
                 const unreadCount = unreadCounts[chat.chatId] || 0;
                 const isNewsBot = chat.recipientUser?.uid === FLUX_BOT_ID;
                 const isSpamBot = chat.recipientUser?.uid === SPAM_BOT_ID;
                 const isOfficial = isNewsBot || isSpamBot;
                 
                 return (
                   <div
                     key={chat.chatId}
                     onClick={() => chat.recipientUser && onSelectChat(chat.recipientUser)}
                     className={`flex items-center gap-3 ${cardBg} p-3 mx-1 rounded-xl cursor-pointer transition active:scale-[0.99] group shadow-sm ${isNewsBot ? 'border-l-4 border-l-purple-500' : (isSpamBot ? 'border-l-4 border-l-emerald-500' : '')}`}
                   >
                      <div className="relative">
                        {renderAvatar(chat.recipientUser!)}
                        {isOfficial && (
                             <div className="absolute -bottom-1 -right-1 bg-blue-500 text-white p-0.5 rounded-full border-2 border-white">
                                <BadgeCheck size={12} fill="currentColor" className="text-white" />
                             </div>
                        )}
                      </div>
                      
                      {/* Flex container for content with proper overflow handling */}
                      <div className="flex-1 min-w-0 pr-1">
                        <div className="flex justify-between items-center mb-0.5 gap-2">
                          <div className="flex items-center gap-1 min-w-0">
                              <h3 className={`font-semibold text-base truncate ${textPrimary}`}>{chat.recipientUser?.displayName}</h3>
                              {isOfficial && <BadgeCheck size={14} className="text-blue-500 flex-shrink-0" fill="currentColor" stroke="white" />}
                          </div>
                          <span className={`text-[11px] whitespace-nowrap flex-shrink-0 ${unreadCount > 0 ? (isNewYear ? 'text-white font-bold' : 'text-blue-500 font-medium') : textSecondary}`}>
                             {new Date(chat.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          </span>
                        </div>
                        
                        <div className="flex justify-between items-center gap-2 h-5">
                            <p className={`text-sm truncate flex-1 min-w-0 leading-snug ${chat.isTyping ? accentText + ' animate-pulse font-medium' : (unreadCount > 0 ? textPrimary : textSecondary)}`}>
                               {chat.isTyping ? 'печатает...' : (chat.lastMessage || 'Изображение')}
                            </p>

                            {unreadCount > 0 && (
                                <div className={`flex-shrink-0 min-w-[20px] h-5 px-1.5 rounded-full flex items-center justify-center text-[11px] font-bold text-white animate-in zoom-in duration-300 ${isNewYear ? 'bg-white text-red-700 shadow-md' : (isDark ? 'bg-purple-600' : 'bg-blue-500')}`}>
                                    {unreadCount}
                                </div>
                            )}
                        </div>
                      </div>
                   </div>
                 );
               })
             )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatList;