import React, { useState, useEffect, useRef } from 'react';
import { db, auth } from '../firebase';
import { ref, push, onValue, serverTimestamp, set, update } from 'firebase/database';
import { UserProfile, Message, Theme } from '../types';
import { ArrowLeft, Send } from 'lucide-react';

interface ChatRoomProps {
  recipient: UserProfile;
  onBack: () => void;
  theme: Theme;
}

const ChatRoom: React.FC<ChatRoomProps> = ({ recipient, onBack, theme }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const currentUser = auth.currentUser;

  // Theme Config
  const isDark = theme === 'dark';
  const headerBg = isDark ? 'bg-gray-800/90 border-gray-700' : 'bg-white/80 border-blue-100';
  const textPrimary = isDark ? 'text-white' : 'text-gray-800';
  const textSecondary = isDark ? 'text-gray-400' : 'text-gray-500';
  const inputAreaBg = isDark ? 'bg-gray-900 shadow-[0_-2px_10px_rgba(255,255,255,0.02)]' : 'bg-white shadow-[0_-2px_10px_rgba(0,0,0,0.05)]';
  const inputBg = isDark ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-700';
  
  // Message Bubbles
  const myBubble = theme === 'newyear' ? 'bg-red-600' : (theme === 'dark' ? 'bg-purple-600' : 'bg-blue-600');
  const otherBubble = isDark ? 'bg-gray-800 text-gray-200 border-gray-700' : 'bg-white text-gray-800 border-blue-100';
  const iconColor = theme === 'newyear' ? 'text-red-600' : (isDark ? 'text-purple-400' : 'text-blue-600');

  const getChatId = (uid1: string, uid2: string) => {
    return uid1 < uid2 ? `${uid1}_${uid2}` : `${uid2}_${uid1}`;
  };

  const chatId = currentUser ? getChatId(currentUser.uid, recipient.uid) : '';

  useEffect(() => {
    if (!chatId) return;
    const messagesRef = ref(db, `messages/${chatId}`);
    const unsubscribe = onValue(messagesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const loadedMessages = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        }));
        setMessages(loadedMessages);
      } else {
        setMessages([]);
      }
    });
    return () => unsubscribe();
  }, [chatId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!inputText.trim() || !currentUser || !chatId) return;
    const text = inputText;
    setInputText('');

    const messageRef = ref(db, `messages/${chatId}`);
    const newMessageRef = push(messageRef);
    const timestamp = Date.now();

    await set(newMessageRef, {
      senderId: currentUser.uid,
      text: text,
      timestamp: timestamp
    });

    const chatMetaRef = ref(db, `chats/${chatId}`);
    await update(chatMetaRef, {
      participants: [currentUser.uid, recipient.uid],
      lastMessage: text,
      timestamp: timestamp
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className={`${headerBg} backdrop-blur-md p-4 flex items-center shadow-sm sticky top-0 z-20 border-b transition-colors`}>
        <button onClick={onBack} className={`p-2 mr-2 rounded-full transition ${isDark ? 'hover:bg-gray-700' : 'hover:bg-blue-50'}`}>
          <ArrowLeft className={iconColor} />
        </button>
        <img src={recipient.photoURL} alt="Avatar" className="w-10 h-10 rounded-full bg-gray-200 mr-3" />
        <div>
           <h3 className={`font-bold ${textPrimary}`}>{recipient.displayName}</h3>
           <p className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-blue-500'}`}>@{recipient.username}</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar">
        {messages.map((msg) => {
          const isMe = msg.senderId === currentUser?.uid;
          return (
            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[75%] px-4 py-2 rounded-2xl break-words text-sm shadow-sm border ${
                  isMe
                    ? `${myBubble} text-white rounded-br-none border-transparent`
                    : `${otherBubble} rounded-bl-none`
                }`}
              >
                {msg.text}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className={`p-4 ${inputAreaBg} transition-colors`}>
        <div className={`flex items-center gap-2 ${inputBg} rounded-full px-4 py-2 border border-transparent focus-within:border-opacity-50 ${isDark ? 'focus-within:border-purple-400' : 'focus-within:border-blue-400 focus-within:bg-white'} transition`}>
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Сообщение..."
            className="flex-1 bg-transparent focus:outline-none"
          />
          <button
            onClick={handleSend}
            disabled={!inputText.trim()}
            className={`p-2 rounded-full ${inputText.trim() ? `${myBubble} text-white` : 'bg-gray-300 text-gray-500'} transition transform active:scale-90`}
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatRoom;