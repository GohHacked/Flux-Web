import React, { useState, useEffect, useRef } from 'react';
import { db, auth } from '../firebase';
import { ref, push, onValue, set, update, remove, serverTimestamp, get } from 'firebase/database';
import { UserProfile, Message, Theme, UserStatus } from '../types';
import { ArrowLeft, Send, X, Paperclip, Image as ImageIcon, Video, Mic, Check, CheckCheck, MoreVertical, Trash2, Edit2, Reply, CornerDownLeft, Download, Smile, Music, FileText, Sticker, Copy, BadgeCheck, Zap, Ban, Bot, AlertTriangle, ShieldCheck } from 'lucide-react';

interface ChatRoomProps {
  recipient: UserProfile;
  onBack: () => void;
  theme: Theme;
}

interface ExtendedMessage extends Message {
  read?: boolean;
  type?: 'text' | 'image' | 'video' | 'audio' | 'file';
  fileName?: string;
  fileSize?: string;
}

const FLUX_BOT_ID = 'flux_bot_official';
const SPAM_BOT_ID = 'flux_spam_bot';

const AVAILABLE_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

const EMOJI_CATEGORIES = {
  'Recent': ['😂', '👍', '❤️', '😭', '🙏', '🔥', '😍', '🤔', '👀', '🥰'],
  'Smiles': ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗'],
  'Gestures': ['👋', 'Qw', '🤚', '🖐', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '👇'],
  'Hearts': ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖'],
};

const STICKERS_MOCK = [
  "https://cdn-icons-png.flaticon.com/512/9376/9376993.png",
  "https://cdn-icons-png.flaticon.com/512/9376/9376973.png",
  "https://cdn-icons-png.flaticon.com/512/9376/9376949.png",
  "https://cdn-icons-png.flaticon.com/512/4712/4712009.png",
  "https://cdn-icons-png.flaticon.com/512/4712/4712027.png",
  "https://cdn-icons-png.flaticon.com/512/4712/4712100.png",
  "https://cdn-icons-png.flaticon.com/512/4712/4712139.png",
  "https://cdn-icons-png.flaticon.com/512/4712/4712109.png",
  "https://cdn-icons-png.flaticon.com/512/8666/8666879.png",
  "https://cdn-icons-png.flaticon.com/512/8666/8666810.png",
];

const ChatRoom: React.FC<ChatRoomProps> = ({ recipient, onBack, theme }) => {
  const [messages, setMessages] = useState<ExtendedMessage[]>([]);
  const [inputText, setInputText] = useState('');
  
  // Interaction States
  const [activePickerId, setActivePickerId] = useState<string | null>(null); // For Reactions
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null); // For 3-dots Menu
  const [editingMessage, setEditingMessage] = useState<ExtendedMessage | null>(null); // For Edit Mode
  const [replyingTo, setReplyingTo] = useState<ExtendedMessage | null>(null); // For Reply

  const [recipientStatus, setRecipientStatus] = useState<UserStatus | null>(null);
  const [isRecipientTyping, setIsRecipientTyping] = useState(false);
  
  // Current User Profile (To check restrictions)
  const [myProfile, setMyProfile] = useState<UserProfile | null>(null);

  // UI States
  const [showProfile, setShowProfile] = useState(false);
  const [fullProfileData, setFullProfileData] = useState<UserProfile>(recipient);
  
  // New "Max Messenger" Sheet States
  const [showMediaSheet, setShowMediaSheet] = useState(false);
  const [showEmojiSheet, setShowEmojiSheet] = useState(false);
  const [emojiTab, setEmojiTab] = useState<'emoji' | 'stickers'>('emoji');

  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null); // Lightbox

  // Voice Recording
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<number | null>(null);

  // Processing/Upload State
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Spam Detection Refs
  const spamCounterRef = useRef<number>(0);
  const spamTimerRef = useRef<number | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const currentUser = auth.currentUser;

  const isNewsBot = recipient.uid === FLUX_BOT_ID;
  const isSpamBot = recipient.uid === SPAM_BOT_ID;
  const isBot = isNewsBot || isSpamBot;

  // Theme Config
  const isDark = theme === 'dark';
  const headerBg = isDark ? 'bg-gray-900/90 border-gray-800' : 'bg-white/90 border-blue-50';
  const textPrimary = isDark ? 'text-white' : 'text-gray-900';
  const textSecondary = isDark ? 'text-gray-400' : 'text-gray-500';
  const inputAreaBg = isDark ? 'bg-gray-900 border-t border-gray-800' : 'bg-white border-t border-blue-50';
  const inputBg = isDark ? 'bg-gray-800 text-white' : 'bg-white text-gray-800';
  const accentText = theme === 'newyear' ? 'text-red-600' : (isDark ? 'text-purple-400' : 'text-blue-600');
  
  const myBubble = theme === 'newyear' ? 'bg-red-600' : (theme === 'dark' ? 'bg-purple-600' : 'bg-blue-500');
  const otherBubble = isDark ? 'bg-gray-800 text-gray-200' : 'bg-white text-gray-800 shadow-sm border border-gray-100';
  const iconColor = theme === 'newyear' ? 'text-red-600' : (isDark ? 'text-purple-400' : 'text-blue-600');

  const getChatId = (uid1: string, uid2: string) => {
    return uid1 < uid2 ? `${uid1}_${uid2}` : `${uid2}_${uid1}`;
  };

  const chatId = currentUser ? getChatId(currentUser.uid, recipient.uid) : '';

  const [chatWallpaper, setChatWallpaper] = useState<string | null>(null);
  const [showWallpaperMenu, setShowWallpaperMenu] = useState(false);
  const [selectedWallpaper, setSelectedWallpaper] = useState<string | null>(null);
  const [showChatMenu, setShowChatMenu] = useState(false);
  const wallpaperInputRef = useRef<HTMLInputElement>(null);

  const PRESET_WALLPAPERS = [
      "https://images.unsplash.com/photo-1557683316-973673baf926?q=80&w=1000&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1557682250-33bd709cbe85?q=80&w=1000&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1557682224-5b8590cd9ec5?q=80&w=1000&auto=format&fit=crop"
  ];

  // 1. Fetch CURRENT USER Profile (to check for Bans)
  useEffect(() => {
    if (!currentUser) return;
    const myProfileRef = ref(db, `users/${currentUser.uid}`);
    const unsub = onValue(myProfileRef, (snapshot) => {
        if (snapshot.exists()) {
            setMyProfile(snapshot.val());
        }
    });
    return () => unsub();
  }, [currentUser]);

  // Fetch full profile data when opening profile
  useEffect(() => {
    if (showProfile && recipient.uid) {
      if (isNewsBot) {
          setFullProfileData({
              ...recipient,
              bio: 'Официальный бот новостей Flux Web. Здесь публикуются обновления и важные объявления.',
              username: 'bot'
          });
      } else if (isSpamBot) {
          setFullProfileData({
              ...recipient,
              bio: 'Бот для проверки статуса вашего аккаунта и ограничений на отправку сообщений.',
              username: 'spambot'
          });
      } else {
        get(ref(db, `users/${recipient.uid}`)).then((snapshot) => {
            if (snapshot.exists()) {
            setFullProfileData(snapshot.val());
            }
        });
      }
    }
  }, [showProfile, recipient.uid, isNewsBot, isSpamBot]);

  useEffect(() => {
    if (!chatId || !currentUser) return;

    if (isNewsBot) {
        setMessages([
            {
                id: 'welcome',
                senderId: FLUX_BOT_ID,
                text: '👋 Добро пожаловать в Flux Web! Это официальный канал новостей.',
                timestamp: Date.now() - 100000,
                read: true,
                type: 'text'
            },
            {
                id: 'update_0_2_img',
                senderId: FLUX_BOT_ID,
                text: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1000&auto=format&fit=crop',
                timestamp: Date.now() - 50000,
                read: true,
                type: 'image'
            },
            {
                id: 'update_0_2',
                senderId: FLUX_BOT_ID,
                text: '🚀 Обновление Flux Web 0.2!\n\nМы рады представить вам новую версию нашего мессенджера. Мы добавили множество полезных функций для вашей безопасности и удобства:\n\n• 🔒 Защита приложения (PIN-код)\nТеперь вы можете установить 4-значный PIN-код для входа в приложение. Ваши переписки под надежной защитой!\n\n• 🖼️ Обои для чатов\nНастраивайте внешний вид каждого чата индивидуально. Выбирайте из предустановленных вариантов или загружайте свои собственные изображения.\n\n• 🔄 Пересылка сообщений\nДелитесь важной информацией в один клик.\n\n• 🗑️ Удаление сообщений\nОшиблись? Не беда. Теперь вы можете удалять свои сообщения.\n\n• 🔗 Новая ссылка-приглашение\nПриглашать друзей стало еще проще.\n\nСпасибо, что вы с нами! ❤️',
                timestamp: Date.now(),
                read: true,
                type: 'text'
            }
        ]);
        return;
    }

    if (isSpamBot) {
         // Spam Bot: We can store history locally or in a special node. 
         // For "Realness" let's just keep it local state for the user session, but logic is DB based.
         if (messages.length === 0) {
             setMessages([
                 {
                     id: 'spam_welcome',
                     senderId: SPAM_BOT_ID,
                     text: 'Я официальный Спам-бот Flux.\n\nНажмите /start чтобы узнать статус вашего аккаунта.',
                     timestamp: Date.now(),
                     read: true,
                     type: 'text'
                 }
             ]);
         }
         return;
    }

    const messagesRef = ref(db, `messages/${chatId}`);
    
    const unsubscribe = onValue(messagesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const loadedMessages: ExtendedMessage[] = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        }));
        setMessages(loadedMessages);

        const updates: any = {};
        let needsUpdate = false;
        loadedMessages.forEach(msg => {
          if (msg.senderId !== currentUser.uid && !msg.read) {
            updates[`${msg.id}/read`] = true;
            needsUpdate = true;
          }
        });
        if (needsUpdate) update(messagesRef, updates);

      } else {
        setMessages([]);
      }
    });
    return () => unsubscribe();
  }, [chatId, currentUser, isNewsBot, isSpamBot]);

  useEffect(() => {
    if (!chatId || isBot) return;
    const statusRef = ref(db, `/status/${recipient.uid}`);
    const unsubStatus = onValue(statusRef, (snapshot) => setRecipientStatus(snapshot.val()));
    const typingRef = ref(db, `chats/${chatId}/typing/${recipient.uid}`);
    const unsubTyping = onValue(typingRef, (snapshot) => {
        const timestamp = snapshot.val();
        setIsRecipientTyping(timestamp && (Date.now() - timestamp < 4000));
    });
    
    if (currentUser) {
        const wallpaperRef = ref(db, `chats/${chatId}/wallpaper/${currentUser.uid}`);
        const unsubWallpaper = onValue(wallpaperRef, (snapshot) => {
            setChatWallpaper(snapshot.val());
        });
        return () => { unsubStatus(); unsubTyping(); unsubWallpaper(); };
    }

    return () => { unsubStatus(); unsubTyping(); };
  }, [recipient.uid, chatId, isBot, currentUser]);

  useEffect(() => {
    if (!editingMessage && !lightboxSrc && !showMediaSheet && !showEmojiSheet) {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isRecipientTyping, isProcessing, showMediaSheet, showEmojiSheet]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
           const base64Audio = reader.result as string;
           await sendMessage(base64Audio, 'audio', 'Voice Message');
        };
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      recordingIntervalRef.current = window.setInterval(() => {
         setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Microphone access denied", err);
      alert("Нет доступа к микрофону");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
       mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
       setIsRecording(false);
       if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
       setRecordingTime(0);
       audioChunksRef.current = [];
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    if (!currentUser || !chatId || isBot) return;
    const myTypingRef = ref(db, `chats/${chatId}/typing/${currentUser.uid}`);
    set(myTypingRef, serverTimestamp());
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => remove(myTypingRef), 3000);
  };

  // REAL SPAM BOT LOGIC
  const handleSpamBotCommand = async (command: string) => {
      if (!currentUser) return;
      setIsRecipientTyping(true);
      
      // Simulating "Thinking"
      await new Promise(resolve => setTimeout(resolve, 800));
      
      setIsRecipientTyping(false);

      let responseText = '';
      
      if (command === '/start') {
          // Check REAL DB Status
          const isRestricted = myProfile?.isRestricted;
          
          if (isRestricted) {
              const releaseDate = new Date();
              releaseDate.setDate(releaseDate.getDate() + 7); // Mock date for display
              const dateStr = releaseDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit'});
              
              responseText = `🚫 **Ваш аккаунт ограничен.**\n\nВы не можете писать первым пользователям, которых нет в ваших контактах.\n\nОграничения будут сняты: ${dateStr}.`;
          } else {
              responseText = `✅ **Ваш аккаунт свободен.**\n\nСейчас на вашем аккаунте нет никаких ограничений. Вы можете свободно писать пользователям Flux Web.\n\nЖелаем приятного общения!`;
          }
      } else if (command === '/ban') {
          // REAL DB UPDATE
          await update(ref(db, `users/${currentUser.uid}`), { isRestricted: true });
          responseText = "⚠️ **Ограничение применено.**\nЯ ограничил ваш аккаунт. Попробуйте написать кому-нибудь (кроме меня) - у вас не получится.";
      } else if (command === '/unban') {
          // REAL DB UPDATE
          await update(ref(db, `users/${currentUser.uid}`), { isRestricted: false });
          responseText = "✅ **Ограничение снято.**\nТеперь ваш аккаунт чист. Спасибо, что не нарушаете правила.";
      } else {
          responseText = 'Я понимаю только команды:\n/start - проверить статус\n/ban - симулировать бан\n/unban - снять бан';
      }

      setMessages(prev => [
          ...prev,
          {
              id: Date.now().toString(),
              senderId: SPAM_BOT_ID,
              text: responseText,
              timestamp: Date.now(),
              read: true,
              type: 'text'
          }
      ]);
  };

  const checkSpam = async () => {
     if (!currentUser) return false;
     
     // Simple client-side spam detection (Rate Limiter)
     const now = Date.now();
     spamCounterRef.current += 1;

     if (!spamTimerRef.current) {
         spamTimerRef.current = now;
     }

     // If sent 5 messages in less than 3 seconds
     if (spamCounterRef.current > 5 && (now - spamTimerRef.current) < 3000) {
        // TRIGGER AUTO BAN
        await update(ref(db, `users/${currentUser.uid}`), { isRestricted: true });
        alert("Вы слишком часто отправляете сообщения! Аккаунт ограничен.");
        return true;
     }

     // Reset counter after 3 seconds
     if ((now - spamTimerRef.current) >= 3000) {
         spamCounterRef.current = 1;
         spamTimerRef.current = now;
     }

     return false;
  }

  const sendMessage = async (content: string, type: 'text' | 'image' | 'video' | 'audio' | 'file' = 'text', fileName?: string, fileSize?: string) => {
    if (!currentUser) return;

    // 1. SPAM BOT INTERACTION (Allowed even if banned)
    if (isSpamBot) {
        setInputText('');
        setShowMediaSheet(false);
        setShowEmojiSheet(false);
        
        setMessages(prev => [
            ...prev,
            {
                id: Date.now().toString(),
                senderId: currentUser.uid,
                text: content,
                timestamp: Date.now(),
                read: true,
                type: type,
                fileName, fileSize
            }
        ]);

        await handleSpamBotCommand(content);
        return;
    }

    // 2. CHECK RESTRICTION (REAL DB CHECK)
    if (myProfile?.isRestricted) {
        alert("ОШИБКА: Ваш аккаунт ограничен за спам. Вы не можете отправлять сообщения. Напишите Spam Info Bot для подробностей.");
        return; // BLOCK SENDING
    }

    // 3. NEWS BOT LOGIC - BLOCKED
    if (isNewsBot) return;

    // 4. REGULAR CHAT LOGIC
    if (!chatId) return;

    // 5. SPAM CHECK
    const isSpamming = await checkSpam();
    if (isSpamming) return;

    if (editingMessage && type === 'text') {
        const msgRef = ref(db, `messages/${chatId}/${editingMessage.id}`);
        await update(msgRef, {
            text: content,
            isEdited: true
        });
        setEditingMessage(null);
        setInputText('');
        return;
    }

    setInputText('');
    setShowMediaSheet(false);
    setShowEmojiSheet(false);

    const replyData = replyingTo ? {
      id: replyingTo.id,
      text: replyingTo.text,
      senderName: replyingTo.senderId === currentUser.uid ? 'Вы' : recipient.displayName
    } : null;
    setReplyingTo(null);

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    remove(ref(db, `chats/${chatId}/typing/${currentUser.uid}`));

    const messageRef = ref(db, `messages/${chatId}`);
    const newMessageRef = push(messageRef);
    const timestamp = Date.now();

    const payload: any = {
      senderId: currentUser.uid,
      text: content,
      type: type,
      timestamp: timestamp,
      read: false,
      fileName: fileName || null,
      fileSize: fileSize || null
    };

    if (replyData) {
      payload.replyTo = replyData;
    }

    await set(newMessageRef, payload);

    const chatMetaRef = ref(db, `chats/${chatId}`);
    let lastMsgText = content;
    if (type === 'image') lastMsgText = 'Фото';
    if (type === 'video') lastMsgText = 'Видео';
    if (type === 'audio') lastMsgText = 'Аудио';
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

  const deleteMessage = async (msgId: string) => {
    // Local delete for Spam Bot
    if (isSpamBot) {
        setMessages(prev => prev.filter(m => m.id !== msgId));
        return;
    }
    if (!currentUser || !chatId || isBot) return;
    try {
        setMenuOpenId(null);
        await remove(ref(db, `messages/${chatId}/${msgId}`));
    } catch (e) {
        console.error("Delete failed", e);
        alert("Не удалось удалить сообщение");
    }
  };

  const startEditing = (msg: ExtendedMessage) => {
      setEditingMessage(msg);
      setInputText(msg.text);
      setMenuOpenId(null);
      setReplyingTo(null);
      inputRef.current?.focus();
  };

  const startReplying = (msg: ExtendedMessage) => {
    setReplyingTo(msg);
    setMenuOpenId(null);
    setEditingMessage(null);
    inputRef.current?.focus();
  };

  const copyMessageText = (text: string) => {
    navigator.clipboard.writeText(text);
    setMenuOpenId(null);
    setActivePickerId(null);
  };

  const cancelEditing = () => {
      setEditingMessage(null);
      setInputText('');
  };

  const toggleReaction = async (msgId: string, emoji: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser || !chatId || isBot) return;
    const reactionRef = ref(db, `messages/${chatId}/${msgId}/reactions/${currentUser.uid}`);
    const msg = messages.find(m => m.id === msgId);
    if (msg?.reactions?.[currentUser.uid] === emoji) await remove(reactionRef);
    else await set(reactionRef, emoji);
    setActivePickerId(null);
  };

  const handleFileSelect = (type: 'image' | 'video' | 'audio' | 'file') => {
    setShowMediaSheet(false);
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

  const convertToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
  };

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const MAX_SIZE = 1200; 
          if (width > height) { if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; } } 
          else { if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; } }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
      };
      reader.onerror = (err) => reject(err);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser || (!chatId && !isSpamBot)) return;
    e.target.value = ''; 
    let type: 'image' | 'video' | 'audio' | 'file' = 'file';
    if (file.type.startsWith('image/')) type = 'image';
    else if (file.type.startsWith('video/')) type = 'video';
    else if (file.type.startsWith('audio/')) type = 'audio';

    setIsProcessing(true);

    try {
        let resultUrl = '';
        const fileSizeStr = (file.size / 1024).toFixed(1) + ' KB';
        if (type === 'image') resultUrl = await compressImage(file);
        else resultUrl = await convertToBase64(file);
        
        await sendMessage(resultUrl, type, file.name, fileSizeStr);
    } catch (err) {
        console.error(err);
    } finally {
        setIsProcessing(false);
    }
  };

  const handleWallpaperUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      e.target.value = '';
      try {
          const resultUrl = await compressImage(file);
          setSelectedWallpaper(resultUrl);
      } catch (err) {
          console.error(err);
      }
  };

  const applyWallpaper = async (forBoth: boolean) => {
      if (!currentUser || !chatId || !selectedWallpaper) return;
      
      const updates: any = {};
      updates[`chats/${chatId}/wallpaper/${currentUser.uid}`] = selectedWallpaper;
      if (forBoth) {
          updates[`chats/${chatId}/wallpaper/${recipient.uid}`] = selectedWallpaper;
      }
      
      await update(ref(db), updates);
      setShowWallpaperMenu(false);
      setSelectedWallpaper(null);
  };

  const forwardMessage = (msg: ExtendedMessage) => {
      // In a real app we would open a chat selector.
      // For now, let's just copy it to the input or show a toast.
      setInputText(`[Переслано от ${msg.senderId === currentUser?.uid ? 'Вы' : recipient.displayName}]:\n${msg.text}`);
      setMenuOpenId(null);
      inputRef.current?.focus();
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatLastSeen = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    // Check if yesterday
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    if (isToday) return `был(а) сегодня в ${time}`;
    if (isYesterday) return `был(а) вчера в ${time}`;
    return `был(а) ${date.toLocaleDateString()} в ${time}`;
  };

  const formatDateSeparator = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.getDate() === now.getDate() && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = date.getDate() === yesterday.getDate() && date.getMonth() === yesterday.getMonth() && date.getFullYear() === yesterday.getFullYear();

    if (isToday) return 'Сегодня';
    if (isYesterday) return 'Вчера';
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  };

  const renderMessageContent = (msg: ExtendedMessage, isMe: boolean) => {
      // Special formatting for Spam Bot Responses
      if (isSpamBot && !isMe && msg.type === 'text') {
           if (msg.text.includes('Ваш аккаунт свободен')) {
               return (
                   <div className="flex flex-col gap-2">
                       <div className="flex items-center gap-2 text-green-600 font-bold text-lg">
                           <ShieldCheck size={24} />
                           <span>Аккаунт свободен</span>
                       </div>
                       <p className="whitespace-pre-wrap">{msg.text.replace('✅ **Ваш аккаунт свободен.**\n\n', '')}</p>
                   </div>
               )
           }
           if (msg.text.includes('Ваш аккаунт ограничен')) {
                return (
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2 text-red-600 font-bold text-lg">
                            <AlertTriangle size={24} />
                            <span>Аккаунт ограничен</span>
                        </div>
                        <p className="whitespace-pre-wrap">{msg.text.replace('🚫 **Ваш аккаунт ограничен.**\n\n', '')}</p>
                    </div>
                )
           }
      }

      if (msg.type === 'image') {
          return (
              <div className="relative group/img cursor-pointer" onClick={(e) => { e.stopPropagation(); setLightboxSrc(msg.text); }}>
                <img src={msg.text} alt="Image" className="max-w-[220px] max-h-[300px] w-auto h-auto object-cover rounded-lg" />
                <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/10 transition rounded-lg" />
              </div>
          );
      }
      
      if (msg.type === 'audio') {
           return (
            <div className="flex flex-col min-w-[200px] py-1">
                <div className="flex items-center gap-2 mb-1">
                   <div className="bg-white/20 p-1.5 rounded-full"><Music size={16} className="text-white" /></div>
                   <span className="text-xs opacity-80">{msg.fileName || 'Audio'}</span>
                </div>
                <audio src={msg.text} controls className="w-full h-8" />
            </div>
          );
      }

      if (msg.type === 'video') {
          return (
              <div className="relative max-w-[240px]">
                  <video src={msg.text} controls className="w-full rounded-lg bg-black/10" />
              </div>
          );
      }

      if (msg.text.startsWith('data:') && msg.type === 'file') {
         return (
             <div className="flex items-center gap-3">
                 <div className="bg-white/20 p-2 rounded-full text-white"><FileText size={20} /></div>
                 <div>
                    <p className="text-sm font-bold truncate max-w-[150px]">{msg.fileName || 'Файл'}</p>
                    <a href={msg.text} download={msg.fileName || 'download'} className="text-xs underline opacity-80">Скачать {msg.fileSize && `(${msg.fileSize})`}</a>
                 </div>
             </div>
         )
      }

      // Sticker support
      if ((msg.text.startsWith('http') && (msg.text.includes('cdn-icons-png') || msg.text.includes('giphy')))) {
          return <img src={msg.text} alt="Sticker" className="max-w-[150px] w-auto h-auto" />;
      }

      return <span className="whitespace-pre-wrap break-words">{msg.text}</span>;
  };

  // Close sheets on outside click
  const handleBackdropClick = () => {
      setActivePickerId(null);
      setMenuOpenId(null);
      if (showMediaSheet) setShowMediaSheet(false);
      if (showEmojiSheet) setShowEmojiSheet(false);
  };

  const getStatusText = () => {
    if (isBot) return 'бот';
    if (isRecipientTyping) return 'печатает...';
    if (recipientStatus?.state === 'online') return 'в сети';
    if (recipientStatus?.last_changed) return formatLastSeen(recipientStatus.last_changed);
    return 'был(а) недавно';
  };

  const renderAvatar = () => {
    if (isNewsBot) {
        return (
            <div className={`w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white mr-3 shadow-lg`}>
                <Zap size={20} fill="currentColor" />
            </div>
        )
    }
    if (isSpamBot) {
        return (
            <div className={`w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white mr-3 shadow-lg`}>
                <Bot size={20} />
            </div>
        )
    }
    return <img src={recipient.photoURL} alt="Avatar" className="w-10 h-10 rounded-full bg-gray-200 mr-3 object-cover" />;
  };

  const renderProfileAvatar = () => {
    if (isNewsBot) {
        return (
             <div className="w-full h-full bg-gradient-to-br from-purple-600 to-indigo-900 flex items-center justify-center">
                 <Zap size={80} className="text-white" fill="currentColor" />
             </div>
        )
    }
    if (isSpamBot) {
        return (
             <div className="w-full h-full bg-gradient-to-br from-emerald-500 to-emerald-800 flex items-center justify-center">
                 <Bot size={80} className="text-white" />
             </div>
        )
    }
    return <img src={fullProfileData.photoURL} className="w-full h-full object-cover" alt="Profile" />;
  };

  return (
    <div className="flex flex-col h-full relative" onClick={handleBackdropClick}>
      
      {/* Wallpaper Menu Modal */}
      {showWallpaperMenu && (
        <div className="fixed inset-0 z-[100] bg-black/60 flex flex-col items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setShowWallpaperMenu(false)}>
          <div 
            className={`w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden flex flex-col ${isDark ? 'bg-gray-900' : 'bg-white'}`}
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
              <h3 className={`font-bold text-lg ${textPrimary}`}>Обои чата</h3>
              <button onClick={() => setShowWallpaperMenu(false)} className={`p-1 rounded-full hover:bg-black/5 ${textSecondary}`}>
                <X size={24} />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh]">
              <div className="grid grid-cols-2 gap-3 mb-4">
                {PRESET_WALLPAPERS.map((url, i) => (
                  <div 
                    key={i} 
                    className={`aspect-[9/16] rounded-xl overflow-hidden cursor-pointer border-2 transition ${selectedWallpaper === url ? 'border-blue-500 scale-95' : 'border-transparent hover:scale-105'}`}
                    onClick={() => setSelectedWallpaper(url)}
                  >
                    <img src={url} className="w-full h-full object-cover" />
                  </div>
                ))}
                <div 
                  className={`aspect-[9/16] rounded-xl overflow-hidden cursor-pointer border-2 border-dashed flex flex-col items-center justify-center transition ${isDark ? 'border-gray-700 hover:bg-gray-800' : 'border-gray-300 hover:bg-gray-50'} ${selectedWallpaper && !PRESET_WALLPAPERS.includes(selectedWallpaper) ? 'border-blue-500 scale-95' : 'hover:scale-105'}`}
                  onClick={() => wallpaperInputRef.current?.click()}
                >
                  <ImageIcon className={textSecondary} size={32} />
                  <span className={`text-xs mt-2 font-medium ${textSecondary}`}>Свой фон</span>
                  {selectedWallpaper && !PRESET_WALLPAPERS.includes(selectedWallpaper) && (
                    <img src={selectedWallpaper} className="absolute inset-0 w-full h-full object-cover opacity-50" />
                  )}
                </div>
              </div>
              
              <input type="file" ref={wallpaperInputRef} className="hidden" accept="image/*" onChange={handleWallpaperUpload} />

              {selectedWallpaper && (
                <div className="space-y-2 mt-4 animate-in slide-in-from-bottom-2">
                  <button 
                    onClick={() => applyWallpaper(false)}
                    className="w-full py-3 rounded-xl font-bold bg-blue-500 text-white hover:bg-blue-600 transition active:scale-95"
                  >
                    Применить у себя
                  </button>
                  <button 
                    onClick={() => applyWallpaper(true)}
                    className={`w-full py-3 rounded-xl font-bold transition active:scale-95 ${isDark ? 'bg-gray-800 text-white hover:bg-gray-700' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}`}
                  >
                    Применить у себя и {recipient.displayName}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightboxSrc && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center animate-in fade-in duration-200" onClick={() => setLightboxSrc(null)}>
           <button className="absolute top-4 right-4 text-white p-2 bg-white/10 rounded-full hover:bg-white/20 transition">
              <X size={24} />
           </button>
           <button 
             className="absolute top-4 left-4 text-white p-2 bg-white/10 rounded-full hover:bg-white/20 transition flex items-center gap-2"
             onClick={(e) => { e.stopPropagation(); const link = document.createElement('a'); link.href = lightboxSrc; link.download = 'image.jpg'; link.click(); }}
           >
              <Download size={20} />
           </button>
           <img 
             src={lightboxSrc} 
             className="max-w-[95%] max-h-[90%] object-contain rounded-lg shadow-2xl" 
             onClick={(e) => e.stopPropagation()} 
           />
        </div>
      )}

      {/* Profile Modal - Improved with Bio and Last Seen */}
      {showProfile && (
        <div className={`absolute inset-0 z-50 flex flex-col ${isDark ? 'bg-gray-900' : 'bg-gray-100'} animate-in slide-in-from-right duration-200`}>
           <div className="relative w-full h-[40%]">
              {renderProfileAvatar()}
              <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-start bg-gradient-to-b from-black/60 to-transparent">
                 <button onClick={() => setShowProfile(false)} className="text-white p-2 rounded-full bg-black/20 hover:bg-black/40 transition backdrop-blur-md">
                    <ArrowLeft size={24} />
                 </button>
              </div>
              <div className="absolute bottom-0 left-0 w-full p-6 bg-gradient-to-t from-black/80 to-transparent">
                 <div className="flex items-center gap-2">
                    <h1 className="text-white text-3xl font-bold">{fullProfileData.displayName}</h1>
                    {isBot && <BadgeCheck size={28} className="text-blue-500" fill="white" />}
                 </div>
                 <p className="text-gray-300 flex items-center gap-2">
                    @{fullProfileData.username}
                    {isBot && <span className="bg-white/20 px-2 py-0.5 rounded text-xs uppercase font-bold tracking-wider">BOT</span>}
                 </p>
              </div>
           </div>
           
           <div className={`flex-1 p-6 space-y-6 overflow-y-auto ${isDark ? 'bg-gray-900' : 'bg-white'}`}>
              <div className="space-y-1">
                 <h3 className={`text-sm font-bold ${theme === 'newyear' ? 'text-red-500' : (isDark ? 'text-purple-400' : 'text-blue-500')}`}>О себе</h3>
                 <p className={`text-lg leading-relaxed ${textPrimary}`}>
                    {fullProfileData.bio || "Информация отсутствует"}
                 </p>
              </div>

              {!isBot && (
                <div className="space-y-1">
                    <h3 className={`text-sm font-bold ${theme === 'newyear' ? 'text-red-500' : (isDark ? 'text-purple-400' : 'text-blue-500')}`}>Статус</h3>
                    <p className={`text-base ${textPrimary}`}>
                        {recipientStatus?.state === 'online' ? 'В сети' : (recipientStatus?.last_changed ? formatLastSeen(recipientStatus.last_changed) : 'Был(а) недавно')}
                    </p>
                </div>
              )}
              
              {!isBot && (
                <div className="space-y-1">
                    <h3 className={`text-sm font-bold ${theme === 'newyear' ? 'text-red-500' : (isDark ? 'text-purple-400' : 'text-blue-500')}`}>Контакт</h3>
                    <p className={`text-base ${textPrimary}`}>
                        {fullProfileData.email}
                    </p>
                </div>
              )}
           </div>
        </div>
      )}

      {/* Header */}
      <div className={`${headerBg} backdrop-blur-md p-3 flex items-center shadow-sm sticky top-0 z-20 border-b transition-colors`}>
        <button onClick={onBack} className={`p-2 mr-2 rounded-full transition ${isDark ? 'hover:bg-gray-800' : 'hover:bg-blue-50'}`}>
          <ArrowLeft className={iconColor} size={22} />
        </button>
        <div className="flex items-center flex-1 cursor-pointer" onClick={() => setShowProfile(true)}>
          {renderAvatar()}
          <div>
             <div className="flex items-center gap-1">
                <h3 className={`font-bold leading-tight ${textPrimary}`}>{recipient.displayName}</h3>
                {isBot && <BadgeCheck size={14} className="text-blue-500" fill="currentColor" stroke="white" />}
             </div>
             <p className={`text-xs ${isRecipientTyping ? accentText : textSecondary} ${isRecipientTyping ? 'font-bold animate-pulse' : ''}`}>
               {getStatusText()}
             </p>
          </div>
        </div>
        
        {!isBot && (
          <div className="relative">
            <button 
              onClick={(e) => { e.stopPropagation(); setShowChatMenu(!showChatMenu); }}
              className={`p-2 rounded-full transition ${isDark ? 'hover:bg-gray-800' : 'hover:bg-blue-50'}`}
            >
              <MoreVertical className={iconColor} size={22} />
            </button>
            {showChatMenu && (
              <div className={`absolute right-0 mt-2 w-48 rounded-xl shadow-xl border z-50 overflow-hidden animate-in fade-in zoom-in duration-200 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
                <button 
                  onClick={(e) => { e.stopPropagation(); setShowChatMenu(false); setShowWallpaperMenu(true); }}
                  className={`w-full text-left px-4 py-3 text-sm font-medium transition flex items-center gap-3 ${isDark ? 'hover:bg-gray-700 text-white' : 'hover:bg-gray-50 text-gray-800'}`}
                >
                  <ImageIcon size={18} />
                  Поменять обои
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Messages Area */}
      <div 
        className={`flex-1 overflow-y-auto p-4 space-y-0.5 no-scrollbar ${!chatWallpaper ? (isDark ? 'bg-gray-900' : (theme === 'newyear' ? 'bg-red-50/30' : 'bg-[#eef2f5]')) : ''}`} 
        onClick={handleBackdropClick}
        style={chatWallpaper ? { backgroundImage: `url(${chatWallpaper})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
      >
        {messages.map((msg, index) => {
          const isMe = msg.senderId === currentUser?.uid;
          const isActive = activePickerId === msg.id;
          const isMenuOpen = menuOpenId === msg.id;
          const canEdit = isMe && msg.type === 'text';

          const prevMsg = messages[index - 1];
          const nextMsg = messages[index + 1];
          const isSameSenderPrev = prevMsg && prevMsg.senderId === msg.senderId;
          const isSameSenderNext = nextMsg && nextMsg.senderId === msg.senderId;
          
          let showDateSeparator = false;
          if (!prevMsg) showDateSeparator = true;
          else {
             const prevDate = new Date(prevMsg.timestamp).getDate();
             const currDate = new Date(msg.timestamp).getDate();
             if (prevDate !== currDate) showDateSeparator = true;
          }

          let borderRadiusClass = 'rounded-2xl';
          if (isMe) {
              if (isSameSenderNext && !isSameSenderPrev) borderRadiusClass = 'rounded-t-2xl rounded-bl-2xl rounded-br-md';
              else if (isSameSenderNext && isSameSenderPrev) borderRadiusClass = 'rounded-l-2xl rounded-r-md';
              else if (!isSameSenderNext && isSameSenderPrev) borderRadiusClass = 'rounded-b-2xl rounded-tl-2xl rounded-tr-md';
              else borderRadiusClass = 'rounded-2xl rounded-br-md';
          } else {
              if (isSameSenderNext && !isSameSenderPrev) borderRadiusClass = 'rounded-t-2xl rounded-br-2xl rounded-bl-md';
              else if (isSameSenderNext && isSameSenderPrev) borderRadiusClass = 'rounded-r-2xl rounded-l-md';
              else if (!isSameSenderNext && isSameSenderPrev) borderRadiusClass = 'rounded-b-2xl rounded-tr-2xl rounded-tl-md';
              else borderRadiusClass = 'rounded-2xl rounded-bl-md';
          }

          const marginClass = (!isSameSenderNext) ? 'mb-2' : 'mb-0.5';

          return (
            <React.Fragment key={msg.id}>
              {showDateSeparator && (
                  <div className="flex justify-center my-4 sticky top-2 z-10">
                      <span className={`text-[10px] font-bold px-3 py-1 rounded-full shadow-sm backdrop-blur-md ${isDark ? 'bg-gray-800 text-gray-300' : 'bg-white/60 text-gray-500'}`}>
                          {formatDateSeparator(msg.timestamp)}
                      </span>
                  </div>
              )}

              <div 
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} group relative transition-all hover:z-10 ${isActive || isMenuOpen ? 'z-50' : ''} ${marginClass}`}
              >
                <div className={`flex items-end gap-2 max-w-[85%] ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                  {!isMe && (
                     <div className="w-8 flex-shrink-0">
                        {(!isSameSenderNext) && (
                            isNewsBot ? (
                                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white">
                                    <Zap size={12} fill="currentColor" />
                                </div>
                            ) : isSpamBot ? (
                                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white">
                                    <Bot size={12} />
                                </div>
                            ) : (
                                <img src={recipient.photoURL} className="w-6 h-6 rounded-full object-cover" />
                            )
                        )}
                     </div>
                  )}

                  <div className="relative">
                      {/* Reaction Picker Popup - Disabled for bot messages usually, but keeping for fun */}
                      {!isBot && isActive && (
                         <div className={`absolute -top-12 ${isMe ? 'right-0' : 'left-0'} z-50 p-1.5 rounded-full shadow-xl flex items-center gap-1 animate-in zoom-in duration-200 ${isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-100'}`}>
                            {AVAILABLE_REACTIONS.map(emoji => (
                               <button 
                                 key={emoji} 
                                 onClick={(e) => toggleReaction(msg.id, emoji, e)}
                                 className="p-1.5 hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition hover:scale-110 active:scale-90"
                               >
                                 <span className="text-lg leading-none">{emoji}</span>
                               </button>
                            ))}
                         </div>
                      )}

                      <div
                        className={`relative shadow-sm break-words overflow-hidden cursor-pointer ${
                           msg.type === 'image' || (msg.text.includes('cdn-icons-png') || msg.text.includes('giphy'))
                          ? 'bg-transparent p-0 rounded-lg' 
                          : `px-3 py-1.5 ${borderRadiusClass} ${isMe ? `${myBubble} text-white` : `${otherBubble}`}`
                        }`}
                        onClick={(e) => {
                            if (!isBot) {
                                e.stopPropagation();
                                if (isMe) {
                                    setMenuOpenId(isMenuOpen ? null : msg.id);
                                    setActivePickerId(null);
                                } else {
                                    setActivePickerId(isActive ? null : msg.id);
                                    setMenuOpenId(null);
                                }
                            }
                        }}
                      >
                        {msg.replyTo && (
                            <div className={`mb-1 pl-2 border-l-2 text-xs opacity-80 cursor-pointer ${isMe ? 'border-white/50' : 'border-blue-500'}`} onClick={() => { /* Scroll to msg */ }}>
                                <p className="font-bold">{msg.replyTo.senderName}</p>
                                <p className="truncate max-w-[150px]">{msg.replyTo.text}</p>
                            </div>
                        )}

                        {renderMessageContent(msg, isMe)}

                        <div className={`flex items-center justify-end gap-1 mt-0.5 text-[10px] opacity-70 leading-none select-none ${isMe ? 'text-blue-50' : 'text-gray-400'} ${(msg.type === 'image') ? 'absolute bottom-1 right-1 bg-black/40 px-1 py-0.5 rounded-full text-white' : ''}`}>
                             {msg.isEdited && <Edit2 size={8} />}
                             <span>{formatTime(msg.timestamp)}</span>
                             {isMe && (msg.read ? <CheckCheck size={12} strokeWidth={2} /> : <Check size={12} strokeWidth={2} />)}
                        </div>
                      </div>
                      
                      {/* Message Menu for Own Messages */}
                      {isMenuOpen && isMe && (
                        <div className={`absolute top-full right-0 mt-1 z-50 w-48 rounded-2xl shadow-xl border overflow-hidden animate-in fade-in zoom-in duration-200 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
                          {canEdit && (
                            <button 
                              onClick={(e) => { e.stopPropagation(); startEditing(msg); }}
                              className={`w-full text-left px-4 py-3 text-sm font-medium transition flex items-center gap-3 ${isDark ? 'hover:bg-gray-700 text-white' : 'hover:bg-gray-50 text-gray-800'}`}
                            >
                              <Edit2 size={18} className="text-blue-500" />
                              Изменить
                            </button>
                          )}
                          <button 
                            onClick={(e) => { e.stopPropagation(); forwardMessage(msg); }}
                            className={`w-full text-left px-4 py-3 text-sm font-medium transition flex items-center gap-3 ${isDark ? 'hover:bg-gray-700 text-white' : 'hover:bg-gray-50 text-gray-800'}`}
                          >
                            <CornerDownLeft size={18} className="text-green-500" />
                            Переслать
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); deleteMessage(msg.id); }}
                            className={`w-full text-left px-4 py-3 text-sm font-medium transition flex items-center gap-3 text-red-500 ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}`}
                          >
                            <Trash2 size={18} />
                            Удалить
                          </button>
                        </div>
                      )}
                      
                  </div>
                </div>
              </div>
            </React.Fragment>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* --- MEDIA PICKER SHEET (Updated) --- */}
      {showMediaSheet && (
         <div 
           className={`absolute bottom-0 left-0 right-0 z-40 rounded-t-3xl shadow-[0_-5px_30px_rgba(0,0,0,0.1)] animate-in slide-in-from-bottom duration-300 ${isDark ? 'bg-gray-800 border-t border-gray-700' : 'bg-white'}`}
           style={{ height: '55%' }}
           onClick={(e) => e.stopPropagation()}
         >
           <div className="flex flex-col h-full">
               <div className="flex justify-between items-center p-4 border-b border-gray-100 dark:border-gray-700">
                  <h3 className={`font-bold text-lg ${textPrimary}`}>Вложения</h3>
                  <button onClick={() => setShowMediaSheet(false)} className={`p-1 rounded-full hover:bg-black/5 ${textSecondary}`}>
                     <X size={24} />
                  </button>
               </div>
               
               {/* Simulated Gallery Grid */}
               <div className="flex-1 overflow-y-auto p-1">
                 <div className="grid grid-cols-3 gap-1">
                    {[1,2,3,4,5,6,7,8,9,10,11,12].map((i) => (
                       <div 
                          key={i} 
                          className="aspect-square bg-gray-200 dark:bg-gray-700 relative cursor-pointer hover:opacity-80 transition group"
                          onClick={() => handleFileSelect('image')}
                       >
                          <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                             <ImageIcon size={24} />
                          </div>
                          <div className="absolute top-1 right-1 w-6 h-6 rounded-full border-2 border-white/80 dark:border-gray-600 bg-transparent group-hover:bg-blue-500/20"></div>
                       </div>
                    ))}
                 </div>
               </div>

               {/* Action Buttons - Removed Loc/Contact, Added Music */}
               <div className="p-4 grid grid-cols-3 gap-3 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800">
                  <button onClick={() => handleFileSelect('image')} className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white dark:bg-gray-700 shadow-sm border border-gray-100 dark:border-gray-600 hover:bg-gray-50 transition active:scale-95">
                     <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mb-1">
                        <ImageIcon size={20} />
                     </div>
                     <span className={`text-xs font-bold ${textPrimary}`}>Галерея</span>
                  </button>
                  <button onClick={() => handleFileSelect('file')} className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white dark:bg-gray-700 shadow-sm border border-gray-100 dark:border-gray-600 hover:bg-gray-50 transition active:scale-95">
                     <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center mb-1">
                        <FileText size={20} />
                     </div>
                     <span className={`text-xs font-bold ${textPrimary}`}>Файл</span>
                  </button>
                  {/* Added Music Button */}
                  <button onClick={() => handleFileSelect('audio')} className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white dark:bg-gray-700 shadow-sm border border-gray-100 dark:border-gray-600 hover:bg-gray-50 transition active:scale-95">
                     <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center mb-1">
                        <Music size={20} />
                     </div>
                     <span className={`text-xs font-bold ${textPrimary}`}>Музыка</span>
                  </button>
               </div>
           </div>
         </div>
      )}

      {/* --- TELEGRAM STYLE EMOJI SHEET (Improved) --- */}
      {showEmojiSheet && (
          <div 
           className={`absolute bottom-0 left-0 right-0 z-40 rounded-t-3xl shadow-[0_-5px_30px_rgba(0,0,0,0.2)] animate-in slide-in-from-bottom duration-300 backdrop-blur-xl ${isDark ? 'bg-gray-800/90 border-t border-gray-700' : 'bg-white/90 border-t border-gray-200'}`}
           style={{ height: '45%' }}
           onClick={(e) => e.stopPropagation()}
         >
             <div className="flex flex-col h-full">
                 {/* Tabs - Telegram Style */}
                 <div className={`flex items-center justify-center gap-2 p-2 border-b border-gray-200/50 dark:border-gray-700/50`}>
                    <button 
                      onClick={() => setEmojiTab('emoji')}
                      className={`flex-1 py-1.5 rounded-lg text-sm font-bold transition ${emojiTab === 'emoji' ? 'bg-gray-200/50 dark:bg-gray-700/50' : 'opacity-50 hover:opacity-100'} ${textPrimary}`}
                    >
                      Смайлы
                    </button>
                    <button 
                      onClick={() => setEmojiTab('stickers')}
                      className={`flex-1 py-1.5 rounded-lg text-sm font-bold transition ${emojiTab === 'stickers' ? 'bg-gray-200/50 dark:bg-gray-700/50' : 'opacity-50 hover:opacity-100'} ${textPrimary}`}
                    >
                      Стикеры
                    </button>
                 </div>

                 <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                    {emojiTab === 'emoji' ? (
                       <div className="space-y-6 pb-4">
                          {Object.entries(EMOJI_CATEGORIES).map(([cat, emojis]) => (
                             <div key={cat}>
                                <h4 className={`text-xs font-bold uppercase mb-3 opacity-60 sticky top-0 bg-transparent backdrop-blur-sm py-1 z-10 ${textSecondary}`}>{cat}</h4>
                                <div className="grid grid-cols-8 gap-3">
                                   {emojis.map((e, i) => (
                                      <button 
                                        key={i} 
                                        onClick={() => setInputText(prev => prev + e)}
                                        className="text-3xl hover:scale-125 transition active:scale-90 flex items-center justify-center"
                                      >
                                        {e}
                                      </button>
                                   ))}
                                </div>
                             </div>
                          ))}
                       </div>
                    ) : (
                       <div className="grid grid-cols-4 gap-4 pb-4">
                           {STICKERS_MOCK.map((url, i) => (
                              <img 
                                key={i} 
                                src={url} 
                                className="w-full h-auto cursor-pointer hover:scale-105 transition active:scale-95"
                                onClick={() => sendMessage(url, 'text')}
                              />
                           ))}
                       </div>
                    )}
                 </div>
             </div>
         </div>
      )}

      {(editingMessage || replyingTo) && (
        <div className={`flex items-center justify-between px-4 py-2 border-t ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'} animate-in slide-in-from-bottom-2`}>
           <div className="flex items-center gap-3 overflow-hidden">
              {editingMessage ? <Edit2 size={16} className="text-blue-500" /> : <Reply size={16} className="text-blue-500" />}
              <div className="min-w-0 border-l-2 border-blue-500 pl-2">
                  <p className={`text-xs font-bold text-blue-500`}>{editingMessage ? 'Редактирование' : `Ответ: ${replyingTo?.senderId === currentUser?.uid ? 'Вы' : recipient.displayName}`}</p>
                  <p className={`text-xs truncate ${textSecondary}`}>{editingMessage?.text || replyingTo?.text}</p>
              </div>
           </div>
           <button onClick={() => { cancelEditing(); setReplyingTo(null); }} className="p-1 hover:bg-black/5 rounded-full">
              <X size={16} className={textSecondary} />
           </button>
        </div>
      )}

      {/* Input Area - Max Messenger Style */}
      {isNewsBot ? (
          <div className={`p-4 ${inputAreaBg} pb-safe z-30 text-center`}>
              <div className="text-gray-500 text-sm flex items-center justify-center gap-2 py-3">
                  <Ban size={16} />
                  <span>К сожалению, вы не можете писать в этот чат</span>
              </div>
          </div>
      ) : (
        <div className={`p-2 px-3 ${inputAreaBg} transition-colors pb-safe z-30`}>
            {isSpamBot && messages.length <= 1 && (
                <div className="flex justify-center mb-2">
                    <button 
                        onClick={() => sendMessage('/start', 'text')}
                        className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-full font-bold shadow-md transition transform active:scale-95"
                    >
                        Запустить
                    </button>
                </div>
            )}
            
            <div className="flex items-end gap-2">
                <div className={`flex-1 flex items-end gap-2 ${inputBg} rounded-[2rem] px-1 py-1 border border-transparent transition shadow-sm ${isDark ? '' : 'border-gray-200'}`}>
                    {/* Emoji Button */}
                    <button 
                        onClick={(e) => { e.stopPropagation(); setShowEmojiSheet(!showEmojiSheet); setShowMediaSheet(false); }}
                        className={`p-2.5 rounded-full transition hover:bg-gray-100 dark:hover:bg-white/10 ${showEmojiSheet ? 'text-blue-500' : textSecondary}`}
                    >
                        <Smile size={24} />
                    </button>

                    <input
                        ref={inputRef}
                        type="text"
                        value={inputText}
                        onChange={handleInputChange}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        onFocus={() => { setShowMediaSheet(false); setShowEmojiSheet(false); }}
                        placeholder={isRecording ? `Запись... ${recordingTime}s` : "Сообщение"}
                        className="flex-1 bg-transparent focus:outline-none min-h-[44px] py-2.5 max-h-32 text-[16px]"
                        disabled={isRecording}
                    />

                    {/* Recording Indicator */}
                    {isRecording && (
                        <div className="flex items-center gap-2 animate-pulse text-red-500 mr-2">
                            <div className="w-2 h-2 rounded-full bg-red-500"></div>
                        </div>
                    )}

                    {/* Cancel Recording Button */}
                    {isRecording && (
                        <button onClick={cancelRecording} className="p-2 text-red-500 hover:bg-red-50 rounded-full"><Trash2 size={24} /></button>
                    )}

                    {/* Attachment Button (Only if not recording) */}
                    {!isRecording && (
                        <button 
                            onClick={(e) => { e.stopPropagation(); setShowMediaSheet(!showMediaSheet); setShowEmojiSheet(false); }}
                            className={`p-2.5 rounded-full transition hover:bg-gray-100 dark:hover:bg-white/10 transform rotate-45 ${showMediaSheet ? 'text-blue-500' : textSecondary}`}
                        >
                            <Paperclip size={24} />
                        </button>
                    )}
                </div>

                {/* Mic / Send Button (Outside) */}
                <div className="flex items-center justify-center mb-1">
                     {(inputText.trim() || isRecording) ? (
                        <button
                            onClick={isRecording ? stopRecording : handleSend}
                            className={`w-12 h-12 rounded-full flex items-center justify-center shadow-md transition active:scale-90 ${theme === 'newyear' ? 'bg-red-600 text-white' : (isDark ? 'bg-purple-600 text-white' : 'bg-blue-500 text-white')}`}
                        >
                            {isRecording ? <Send size={24} className="ml-1" /> : (editingMessage ? <Check size={24} /> : <Send size={24} className="ml-1" />)}
                        </button>
                     ) : (
                        <button 
                            onClick={startRecording}
                            className={`w-12 h-12 rounded-full flex items-center justify-center shadow-md transition active:scale-90 ${isDark ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-500'}`}
                        >
                            <Mic size={24} />
                        </button>
                     )}
                </div>
            </div>
        </div>
      )}
      
      <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileChange} />

    </div>
  );
};

export default ChatRoom;