import React, { useState, useEffect, useRef } from 'react';
import { db, auth, storage } from '../firebase';
import { ref, push, onValue, set, update, remove, serverTimestamp } from 'firebase/database';
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { UserProfile, Message, Theme, UserStatus } from '../types';
import { ArrowLeft, Send, Smile, X, Paperclip, Image as ImageIcon, Video, Music, FileText, Sticker as StickerIcon, Gift, Check, CheckCheck, Play, Download, Loader2 } from 'lucide-react';

interface ChatRoomProps {
  recipient: UserProfile;
  onBack: () => void;
  theme: Theme;
}

interface ExtendedMessage extends Message {
  read?: boolean;
  type?: 'text' | 'image' | 'video' | 'audio' | 'file';
  fileName?: string;
}

const AVAILABLE_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

// Mock Data for Stickers and GIFs
const MOCK_STICKERS = [
  "https://cdn-icons-png.flaticon.com/512/9376/9376993.png", // Duck
  "https://cdn-icons-png.flaticon.com/512/9376/9376973.png", // Cool
  "https://cdn-icons-png.flaticon.com/512/9376/9376949.png", // Love
  "https://cdn-icons-png.flaticon.com/512/4712/4712009.png", // Cat
  "https://cdn-icons-png.flaticon.com/512/4712/4712027.png", // Dog
  "https://cdn-icons-png.flaticon.com/512/4712/4712100.png", // Panda
  "https://cdn-icons-png.flaticon.com/512/4712/4712139.png", // Koala
  "https://cdn-icons-png.flaticon.com/512/4712/4712109.png", // Fox
];

const MOCK_GIFS = [
  "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExbXp4Z3I4Z3I4Z3I4Z3I4Z3I4Z3I4Z3I4Z3I4Z3I4Z3I4/3o7TKSjRrfIPjeiVyM/giphy.gif", // Excited
  "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExbXp4Z3I4Z3I4Z3I4Z3I4Z3I4Z3I4Z3I4Z3I4Z3I4Z3I4/26AHONQ79FdWZhAI0/giphy.gif", // Hello
  "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExbXp4Z3I4Z3I4Z3I4Z3I4Z3I4Z3I4Z3I4Z3I4Z3I4Z3I4/l0HlHFRbmaZtBRhXG/giphy.gif", // Cat typing
  "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExbXp4Z3I4Z3I4Z3I4Z3I4Z3I4Z3I4Z3I4Z3I4Z3I4Z3I4/3o6UB3VhArvomJHtdK/giphy.gif", // Party
];

const ChatRoom: React.FC<ChatRoomProps> = ({ recipient, onBack, theme }) => {
  const [messages, setMessages] = useState<ExtendedMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [activePickerId, setActivePickerId] = useState<string | null>(null);
  const [recipientStatus, setRecipientStatus] = useState<UserStatus | null>(null);
  const [isRecipientTyping, setIsRecipientTyping] = useState(false);
  
  // UI States
  const [showProfile, setShowProfile] = useState(false);
  const [profileData, setProfileData] = useState<UserProfile>(recipient);
  const [showAttachments, setShowAttachments] = useState(false);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [stickerTab, setStickerTab] = useState<'stickers' | 'gifs'>('stickers');

  // Upload State
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentUser = auth.currentUser;

  // Theme Config
  const isDark = theme === 'dark';
  const headerBg = isDark ? 'bg-gray-900/90 border-gray-800' : 'bg-white/90 border-blue-50';
  const textPrimary = isDark ? 'text-white' : 'text-gray-900';
  const textSecondary = isDark ? 'text-gray-400' : 'text-gray-500';
  const bgCard = isDark ? 'bg-gray-800' : 'bg-white';
  const inputAreaBg = isDark ? 'bg-gray-900 border-t border-gray-800' : 'bg-white border-t border-blue-50';
  const inputBg = isDark ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-800';
  const accentText = theme === 'newyear' ? 'text-red-600' : (isDark ? 'text-purple-400' : 'text-blue-600');
  
  // Message Bubbles
  const myBubble = theme === 'newyear' ? 'bg-red-600' : (theme === 'dark' ? 'bg-purple-600' : 'bg-blue-500');
  const otherBubble = isDark ? 'bg-gray-800 text-gray-200' : 'bg-white text-gray-800 shadow-sm border border-gray-100';
  const iconColor = theme === 'newyear' ? 'text-red-600' : (isDark ? 'text-purple-400' : 'text-blue-600');

  const getChatId = (uid1: string, uid2: string) => {
    return uid1 < uid2 ? `${uid1}_${uid2}` : `${uid2}_${uid1}`;
  };

  const chatId = currentUser ? getChatId(currentUser.uid, recipient.uid) : '';

  // Load Messages & Mark as Read Logic
  useEffect(() => {
    if (!chatId || !currentUser) return;
    const messagesRef = ref(db, `messages/${chatId}`);
    
    const unsubscribe = onValue(messagesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const loadedMessages: ExtendedMessage[] = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        }));
        setMessages(loadedMessages);

        // Mark unread messages from other user as read
        const updates: any = {};
        let needsUpdate = false;

        loadedMessages.forEach(msg => {
          if (msg.senderId !== currentUser.uid && !msg.read) {
            updates[`${msg.id}/read`] = true;
            needsUpdate = true;
          }
        });

        if (needsUpdate) {
           update(messagesRef, updates);
        }

      } else {
        setMessages([]);
      }
    });
    return () => unsubscribe();
  }, [chatId, currentUser]);

  useEffect(() => {
    if (!chatId) return;
    const statusRef = ref(db, `/status/${recipient.uid}`);
    const unsubStatus = onValue(statusRef, (snapshot) => setRecipientStatus(snapshot.val()));
    const typingRef = ref(db, `chats/${chatId}/typing/${recipient.uid}`);
    const unsubTyping = onValue(typingRef, (snapshot) => {
        const timestamp = snapshot.val();
        setIsRecipientTyping(timestamp && (Date.now() - timestamp < 4000));
    });
    return () => { unsubStatus(); unsubTyping(); };
  }, [recipient.uid, chatId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isRecipientTyping, showStickerPicker, showAttachments, uploadProgress]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    if (!currentUser || !chatId) return;
    const myTypingRef = ref(db, `chats/${chatId}/typing/${currentUser.uid}`);
    set(myTypingRef, serverTimestamp());
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => remove(myTypingRef), 3000);
  };

  const sendMessage = async (content: string, type: 'text' | 'image' | 'video' | 'audio' | 'file' = 'text', fileName?: string) => {
    if (!currentUser || !chatId) return;
    
    setInputText('');
    setShowStickerPicker(false);
    setShowAttachments(false);

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    remove(ref(db, `chats/${chatId}/typing/${currentUser.uid}`));

    const messageRef = ref(db, `messages/${chatId}`);
    const newMessageRef = push(messageRef);
    const timestamp = Date.now();

    await set(newMessageRef, {
      senderId: currentUser.uid,
      text: content, // For media, this is the Download URL
      type: type,
      timestamp: timestamp,
      read: false,
      fileName: fileName || null
    });

    const chatMetaRef = ref(db, `chats/${chatId}`);
    let lastMsgText = content;
    if (type === 'image') lastMsgText = 'Фото';
    if (type === 'video') lastMsgText = 'Видео';
    if (type === 'audio') lastMsgText = 'Голосовое сообщение';
    if (type === 'file') lastMsgText = 'Файл';

    await update(chatMetaRef, {
      participants: [currentUser.uid, recipient.uid],
      lastMessage: lastMsgText,
      timestamp: timestamp
    });
  };

  const handleSend = () => {
    if (inputText.trim()) sendMessage(inputText, 'text');
  };

  const toggleReaction = async (msgId: string, emoji: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser || !chatId) return;
    const reactionRef = ref(db, `messages/${chatId}/${msgId}/reactions/${currentUser.uid}`);
    const msg = messages.find(m => m.id === msgId);
    if (msg?.reactions?.[currentUser.uid] === emoji) await remove(reactionRef);
    else await set(reactionRef, emoji);
    setActivePickerId(null);
  };

  const handleFileSelect = (type: 'image' | 'video' | 'audio' | 'file') => {
    setShowAttachments(false);
    if (fileInputRef.current) {
        let accept = '*/*';
        switch (type) {
            case 'image': accept = 'image/*'; break;
            case 'video': accept = 'video/*'; break;
            case 'audio': accept = 'audio/*'; break;
        }
        fileInputRef.current.accept = accept;
        fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser || !chatId) return;

    // Reset input
    e.target.value = '';

    let type: 'image' | 'video' | 'audio' | 'file' = 'file';
    if (file.type.startsWith('image/')) type = 'image';
    else if (file.type.startsWith('video/')) type = 'video';
    else if (file.type.startsWith('audio/')) type = 'audio';

    // 2025 Standard: Firebase Storage with Resumable Upload
    // This allows large files (up to terabytes) and handles network interruptions
    try {
        const storageRefPath = `chat_files/${chatId}/${Date.now()}_${file.name}`;
        const fileRef = storageRef(storage, storageRefPath);
        
        const uploadTask = uploadBytesResumable(fileRef, file);

        uploadTask.on('state_changed', 
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                setUploadProgress(progress);
            }, 
            (error) => {
                console.error("Upload error:", error);
                // Friendly error message for CORS or permissions
                if (error.code === 'storage/unauthorized') {
                   alert("Ошибка доступа. Проверьте правила Storage в консоли Firebase.");
                } else if (error.message.includes('cors')) {
                   alert("Ошибка CORS. Требуется настройка на сервере.");
                } else {
                   alert("Ошибка загрузки: " + error.message);
                }
                setUploadProgress(null);
            }, 
            async () => {
                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                await sendMessage(downloadURL, type, file.name);
                setUploadProgress(null);
            }
        );
    } catch (err: any) {
        console.error(err);
        alert("Не удалось начать загрузку.");
        setUploadProgress(null);
    }
  };

  // Format Time
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getStatusText = () => {
    if (!recipientStatus) return 'был(а) в сети недавно';
    if (recipientStatus.state === 'online') return 'в сети';
    
    const lastSeen = new Date(recipientStatus.last_changed);
    const now = new Date();
    
    const isSameDay = (d1: Date, d2: Date) => d1.getDate() === d2.getDate() && d1.getMonth() === d2.getMonth() && d1.getFullYear() === d2.getFullYear();
    const isYesterday = (d1: Date, d2: Date) => {
        const yesterday = new Date(d1);
        yesterday.setDate(d1.getDate() - 1);
        return isSameDay(yesterday, d2);
    };

    const time = lastSeen.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});

    if (now.getTime() - lastSeen.getTime() < 60000) return 'был(а) в сети только что';
    if (isSameDay(now, lastSeen)) return `был(а) в сети сегодня в ${time}`;
    if (isYesterday(now, lastSeen)) return `был(а) в сети вчера в ${time}`;
    
    return `был(а) в сети ${lastSeen.toLocaleDateString()} в ${time}`;
  };

  const renderMessageContent = (msg: ExtendedMessage, isMe: boolean) => {
      // Handle legacy messages or explicit text type
      if (!msg.type || msg.type === 'text') {
          // Check for legacy image URLs (stickers)
          if ((msg.text.startsWith('http') && (msg.text.includes('cdn-icons-png') || msg.text.includes('giphy')))) {
              return (
                  <div className="relative">
                    <img src={msg.text} alt="Sticker" className="max-w-[180px] w-auto h-auto object-cover rounded-xl drop-shadow-md hover:scale-105 transition" />
                    <div className="absolute bottom-1 right-1 bg-black/30 backdrop-blur-sm rounded-full px-1.5 py-0.5 flex items-center gap-1">
                        <span className="text-[10px] text-white opacity-90">{formatTime(msg.timestamp)}</span>
                        {isMe && (msg.read ? <CheckCheck size={12} className="text-white" /> : <Check size={12} className="text-white" />)}
                    </div>
                  </div>
              );
          }
          return (
              <div className="flex flex-wrap items-end gap-x-2 gap-y-0 relative min-w-[60px]">
                <span className="leading-snug mr-10">{msg.text}</span>
                <div className={`ml-auto flex items-center gap-0.5 select-none opacity-70 -mb-0.5 text-[11px] absolute bottom-0 right-0 ${isMe ? 'text-blue-50' : 'text-gray-400'}`}>
                   <span>{formatTime(msg.timestamp)}</span>
                   {isMe && (msg.read ? <CheckCheck size={14} strokeWidth={2} /> : <Check size={14} strokeWidth={2} />)}
                </div>
              </div>
          );
      }

      if (msg.type === 'image') {
          return (
              <div className="relative">
                <img src={msg.text} alt="Image" className="max-w-[220px] max-h-[300px] w-auto h-auto object-cover rounded-xl" />
                <div className="absolute bottom-1 right-1 bg-black/30 backdrop-blur-sm rounded-full px-1.5 py-0.5 flex items-center gap-1">
                    <span className="text-[10px] text-white opacity-90">{formatTime(msg.timestamp)}</span>
                    {isMe && (msg.read ? <CheckCheck size={12} className="text-white" /> : <Check size={12} className="text-white" />)}
                </div>
              </div>
          );
      }

      if (msg.type === 'video') {
          return (
              <div className="relative max-w-[240px]">
                  <video src={msg.text} controls className="w-full rounded-lg bg-black/10" />
                  <div className="flex justify-end items-center gap-1 mt-1 text-[11px] opacity-70">
                    <span>{formatTime(msg.timestamp)}</span>
                    {isMe && (msg.read ? <CheckCheck size={14} strokeWidth={2} /> : <Check size={14} strokeWidth={2} />)}
                  </div>
              </div>
          );
      }

      if (msg.type === 'audio') {
          return (
            <div className="flex flex-col min-w-[200px]">
                <audio src={msg.text} controls className="w-full h-10 mb-1" />
                <div className="flex justify-end items-center gap-1 text-[11px] opacity-70">
                    <span>{formatTime(msg.timestamp)}</span>
                    {isMe && (msg.read ? <CheckCheck size={14} strokeWidth={2} /> : <Check size={14} strokeWidth={2} />)}
                </div>
            </div>
          );
      }

      if (msg.type === 'file') {
          return (
              <div className="flex items-center gap-3 pr-2 min-w-[160px]">
                  <div className="bg-black/10 dark:bg-white/10 p-2 rounded-full">
                      <FileText size={20} />
                  </div>
                  <div className="flex-1 overflow-hidden">
                      <p className="text-sm font-medium truncate max-w-[120px]">{msg.fileName || 'Файл'}</p>
                      <a href={msg.text} target="_blank" rel="noopener noreferrer" download className="text-xs underline opacity-80 hover:opacity-100 block">Скачать</a>
                  </div>
                  <div className={`flex flex-col items-end gap-0.5 text-[11px] opacity-70 ml-2 ${isMe ? 'text-blue-50' : 'text-gray-400'}`}>
                     <span>{formatTime(msg.timestamp)}</span>
                     {isMe && (msg.read ? <CheckCheck size={14} strokeWidth={2} /> : <Check size={14} strokeWidth={2} />)}
                  </div>
              </div>
          );
      }
      return null;
  };

  return (
    <div className="flex flex-col h-full relative" onClick={() => { setActivePickerId(null); }}>
      
      {/* Profile Info Overlay */}
      {showProfile && (
        <div className={`absolute inset-0 z-50 flex flex-col ${isDark ? 'bg-gray-900' : 'bg-gray-100'} animate-in slide-in-from-right duration-200`}>
           <div className="relative w-full h-80">
              <img src={profileData.photoURL} className="w-full h-full object-cover" alt="Profile" />
              <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-start bg-gradient-to-b from-black/60 to-transparent">
                 <button onClick={() => setShowProfile(false)} className="text-white p-2 rounded-full bg-black/20 hover:bg-black/40 transition">
                    <ArrowLeft size={24} />
                 </button>
              </div>
              <div className="absolute bottom-0 left-0 w-full p-6 bg-gradient-to-t from-black/80 to-transparent">
                 <h1 className="text-white text-3xl font-bold">{profileData.displayName}</h1>
                 <p className="text-gray-300">{getStatusText()}</p>
              </div>
           </div>
           <div className={`flex-1 p-6 ${isDark ? 'bg-gray-900' : 'bg-gray-100'}`}>
              <div className={`${bgCard} rounded-2xl p-4 shadow-sm space-y-4`}>
                 <div className="border-b border-gray-100 dark:border-gray-700 pb-3">
                    <p className={`text-lg leading-relaxed ${textPrimary}`}>{profileData.bio || 'Нет описания'}</p>
                    <p className={`text-xs ${textSecondary} mt-1`}>О себе</p>
                 </div>
                 <div className="border-b border-gray-100 dark:border-gray-700 pb-3">
                    <p className={`text-lg ${textPrimary}`}>@{profileData.username}</p>
                    <p className={`text-xs ${textSecondary} mt-1`}>Имя пользователя</p>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* Header */}
      <div className={`${headerBg} backdrop-blur-md p-3 flex items-center shadow-sm sticky top-0 z-20 border-b transition-colors`}>
        <button onClick={onBack} className={`p-2 mr-2 rounded-full transition ${isDark ? 'hover:bg-gray-800' : 'hover:bg-blue-50'}`}>
          <ArrowLeft className={iconColor} size={22} />
        </button>
        <div className="flex items-center flex-1 cursor-pointer" onClick={() => setShowProfile(true)}>
          <img src={recipient.photoURL} alt="Avatar" className="w-10 h-10 rounded-full bg-gray-200 mr-3 object-cover" />
          <div>
             <h3 className={`font-bold leading-tight ${textPrimary}`}>{recipient.displayName}</h3>
             <p className={`text-xs ${isRecipientTyping ? accentText : textSecondary} ${isRecipientTyping ? 'font-bold animate-pulse' : ''}`}>
               {isRecipientTyping ? 'печатает...' : getStatusText()}
             </p>
          </div>
        </div>
      </div>

      {/* Upload Progress Overlay (Telegram style) */}
      {uploadProgress !== null && (
          <div className="absolute top-16 left-0 right-0 z-30 px-4 animate-in slide-in-from-top-5 duration-300">
             <div className={`${bgCard} p-3 rounded-xl shadow-lg border border-blue-500/20 flex items-center gap-3`}>
                 <div className="relative">
                    <Loader2 className={`animate-spin ${iconColor}`} size={24} />
                    <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold">{Math.round(uploadProgress)}</span>
                 </div>
                 <div className="flex-1">
                    <div className="flex justify-between text-xs mb-1">
                       <span className={`font-medium ${textPrimary}`}>Загрузка файла...</span>
                       <span className={textSecondary}>{Math.round(uploadProgress)}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
                       <div className="h-full bg-blue-500 transition-all duration-300 ease-out" style={{ width: `${uploadProgress}%` }}></div>
                    </div>
                 </div>
             </div>
          </div>
      )}

      {/* Messages */}
      <div className={`flex-1 overflow-y-auto p-4 space-y-1.5 no-scrollbar ${isDark ? 'bg-gray-900' : (theme === 'newyear' ? 'bg-red-50/30' : 'bg-[#eef2f5]')}`} onClick={() => { setShowAttachments(false); setShowStickerPicker(false); }}>
        {messages.map((msg) => {
          const isMe = msg.senderId === currentUser?.uid;
          const isActive = activePickerId === msg.id;
          const isMedia = msg.type === 'image' || msg.type === 'video' || (msg.text.startsWith('http') && !msg.text.includes(' ')); // Simple heuristic for legacy stickers

          return (
            <div 
              key={msg.id} 
              className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} group relative animate-in zoom-in-95 duration-200 transition-all hover:z-10 ${isActive ? 'z-20' : ''}`}
            >
              <div className={`flex items-end gap-2 max-w-[85%] ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                {/* Avatar for other user */}
                {!isMe && (
                   <img src={recipient.photoURL} className="w-6 h-6 rounded-full mb-1 object-cover" />
                )}

                <div
                  className={`relative shadow-sm break-words ${
                    isMedia
                    ? 'bg-transparent p-0' 
                    : `px-3 py-1.5 rounded-2xl ${isMe ? `${myBubble} text-white rounded-br-md` : `${otherBubble} rounded-bl-md`}`
                  }`}
                  onClick={(e) => {
                     // On mobile, tapping the message toggles the picker to ensure accessibility if hover fails
                     if (window.innerWidth < 768 && !isMedia) {
                        e.stopPropagation();
                        setActivePickerId(isActive ? null : msg.id);
                     }
                  }}
                >
                  {renderMessageContent(msg, isMe)}

                  {/* Reaction Button (Hover & Active) */}
                  {!isMedia && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); setActivePickerId(isActive ? null : msg.id); }}
                      className={`absolute -bottom-6 ${isMe ? 'right-0' : 'left-0'} p-1 text-gray-400 hover:text-gray-600 transition-all
                        ${isActive ? 'opacity-100 scale-100' : 'opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100'}
                      `}
                    >
                       <Smile size={16} />
                    </button>
                  )}
                  
                  {/* Reaction Picker Popup */}
                  {isActive && (
                    <div className={`absolute -top-12 ${isMe ? 'right-0' : 'left-0'} p-1.5 rounded-full shadow-xl flex gap-1 z-30 animate-in fade-in zoom-in duration-200 ${isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white'}`}>
                        {AVAILABLE_REACTIONS.map(emoji => (
                            <button key={emoji} onClick={(e) => toggleReaction(msg.id, emoji, e)} className="hover:scale-125 transition text-lg w-8 h-8 flex items-center justify-center">
                                {emoji}
                            </button>
                        ))}
                    </div>
                  )}
                </div>
              </div>
              
              {/* Reactions Display */}
              {msg.reactions && (
                 <div className={`flex gap-1 -mt-2 z-10 ${isMe ? 'mr-8' : 'ml-8'}`}>
                    {Object.values(msg.reactions).map((r, i) => (
                        <span key={i} className="text-xs bg-white/90 dark:bg-gray-800/90 shadow-sm border border-black/5 dark:border-white/5 rounded-full px-1.5 py-0.5">{r}</span>
                    ))}
                 </div>
              )}
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Attachments Menu (Floating) */}
      {showAttachments && (
         <div className={`absolute bottom-20 left-4 p-2 rounded-2xl shadow-2xl z-40 animate-in slide-in-from-bottom-5 duration-200 ${isDark ? 'bg-gray-800/95 border border-gray-700' : 'bg-white/95 border border-gray-100'}`}>
            <div className="grid grid-cols-4 gap-2 w-full min-w-[280px]">
               <button onClick={() => handleFileSelect('image')} className="flex flex-col items-center gap-1 p-3 hover:bg-black/5 dark:hover:bg-white/5 rounded-xl transition">
                  <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center"><ImageIcon size={20} /></div>
                  <span className={`text-[10px] font-medium ${textPrimary}`}>Фото</span>
               </button>
               <button onClick={() => handleFileSelect('video')} className="flex flex-col items-center gap-1 p-3 hover:bg-black/5 dark:hover:bg-white/5 rounded-xl transition">
                  <div className="w-10 h-10 rounded-full bg-green-100 text-green-600 flex items-center justify-center"><Video size={20} /></div>
                  <span className={`text-[10px] font-medium ${textPrimary}`}>Видео</span>
               </button>
               <button onClick={() => handleFileSelect('audio')} className="flex flex-col items-center gap-1 p-3 hover:bg-black/5 dark:hover:bg-white/5 rounded-xl transition">
                  <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center"><Music size={20} /></div>
                  <span className={`text-[10px] font-medium ${textPrimary}`}>Музыка</span>
               </button>
               <button onClick={() => handleFileSelect('file')} className="flex flex-col items-center gap-1 p-3 hover:bg-black/5 dark:hover:bg-white/5 rounded-xl transition">
                  <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center"><FileText size={20} /></div>
                  <span className={`text-[10px] font-medium ${textPrimary}`}>Файл</span>
               </button>
            </div>
         </div>
      )}

      {/* Sticker/GIF Picker (Floating Panel) */}
      {showStickerPicker && (
          <div className={`h-64 border-t transition-colors flex flex-col ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
              {/* Tabs */}
              <div className={`flex border-b ${isDark ? 'border-gray-700' : 'border-gray-100'}`}>
                 <button 
                   onClick={() => setStickerTab('stickers')}
                   className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 transition ${stickerTab === 'stickers' ? (isDark ? 'text-white border-b-2 border-purple-500' : 'text-blue-600 border-b-2 border-blue-600') : textSecondary}`}
                 >
                    <StickerIcon size={18} /> Стикеры
                 </button>
                 <button 
                   onClick={() => setStickerTab('gifs')}
                   className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 transition ${stickerTab === 'gifs' ? (isDark ? 'text-white border-b-2 border-purple-500' : 'text-blue-600 border-b-2 border-blue-600') : textSecondary}`}
                 >
                    <Gift size={18} /> GIF
                 </button>
              </div>

              {/* Grid Content */}
              <div className="flex-1 overflow-y-auto p-4 grid grid-cols-4 gap-4 no-scrollbar">
                  {stickerTab === 'stickers' ? (
                      MOCK_STICKERS.map((url, i) => (
                          <button key={i} onClick={() => sendMessage(url, 'image')} className="hover:scale-110 transition p-2">
                             <img src={url} alt="Sticker" className="w-full h-auto" />
                          </button>
                      ))
                  ) : (
                      MOCK_GIFS.map((url, i) => (
                          <button key={i} onClick={() => sendMessage(url, 'image')} className="hover:scale-105 transition rounded-lg overflow-hidden">
                             <img src={url} alt="GIF" className="w-full h-full object-cover" />
                          </button>
                      ))
                  )}
              </div>
          </div>
      )}

      {/* Input Area */}
      <div className={`p-2 px-3 ${inputAreaBg} transition-colors pb-safe`}>
        <div className={`flex items-end gap-2 ${inputBg} rounded-2xl px-2 py-2 border border-transparent transition focus-within:border-opacity-50 ${isDark ? 'focus-within:border-purple-500' : 'focus-within:border-blue-400 focus-within:bg-white'}`}>
          
          {/* Attach Button */}
          <button 
             onClick={() => { setShowAttachments(!showAttachments); setShowStickerPicker(false); }}
             className={`p-2 rounded-full transition hover:bg-black/10 dark:hover:bg-white/10 ${showAttachments ? (theme === 'newyear' ? 'text-red-500' : 'text-blue-500') : textSecondary}`}
          >
             <Paperclip size={22} className="transform rotate-45" />
          </button>

          <input
            type="text"
            value={inputText}
            onChange={handleInputChange}
            onClick={() => { setShowAttachments(false); setShowStickerPicker(false); }}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Сообщение"
            className="flex-1 bg-transparent focus:outline-none min-h-[40px] py-2 max-h-32"
          />

          {/* Sticker Button */}
          <button 
             onClick={() => { setShowStickerPicker(!showStickerPicker); setShowAttachments(false); }}
             className={`p-2 rounded-full transition hover:bg-black/10 dark:hover:bg-white/10 ${showStickerPicker ? (theme === 'newyear' ? 'text-red-500' : 'text-blue-500') : textSecondary}`}
          >
             {showStickerPicker ? <X size={24} /> : <Smile size={24} />}
          </button>

          {/* Send Button */}
          {inputText.trim() && (
            <button
              onClick={handleSend}
              className={`p-2 rounded-full mb-0.5 animate-in zoom-in duration-200 ${myBubble} text-white shadow-md`}
            >
              <Send size={20} />
            </button>
          )}
        </div>
      </div>
      
      {/* Hidden File Input */}
      <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileChange} />

    </div>
  );
};

export default ChatRoom;