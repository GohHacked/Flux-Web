import React, { useState, useEffect, useRef } from 'react';
import { auth, db } from '../firebase';
import { updateProfile } from 'firebase/auth';
import { ref, update, get, child } from 'firebase/database';
import { LogOut, Edit2, Moon, Sun, Snowflake, Palette, ArrowLeft, ChevronRight, Camera, Upload, Share2, Check, Shield, Lock, Fingerprint, EyeOff, KeyRound } from 'lucide-react';
import { UserProfile, Theme } from '../types';

interface SettingsProps {
  onLogout: () => void;
  theme: Theme;
  setTheme: (t: Theme) => void;
}

const Settings: React.FC<SettingsProps> = ({ onLogout, theme, setTheme }) => {
  const [activeSection, setActiveSection] = useState<'main' | 'profile' | 'themes' | 'security'>('main');
  
  // Profile State
  const [displayName, setDisplayName] = useState(auth.currentUser?.displayName || '');
  const [username, setUsername] = useState(''); 
  const [newUsername, setNewUsername] = useState(''); 
  const [bio, setBio] = useState('');
  const [photoURL, setPhotoURL] = useState(auth.currentUser?.photoURL || '');
  
  // Security State
  const [pinCode, setPinCode] = useState('');
  const [isPinEnabled, setIsPinEnabled] = useState(false);
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [pinStep, setPinStep] = useState<'create' | 'confirm'>('create');
  const [tempPin, setTempPin] = useState('');
  const [pinError, setPinError] = useState('');

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentUser = auth.currentUser;

  // Theme Styles
  const isDark = ['dark', 'forest', 'neon'].includes(theme);
  const isNewYear = theme === 'newyear';

  const textPrimary = isDark || isNewYear ? 'text-white' : 'text-gray-900';
  const textSecondary = isDark ? 'text-gray-400' : (isNewYear ? 'text-red-100' : 'text-gray-500');
  
  // Backgrounds
  const mainBg = (() => {
    if (theme === 'dark') return 'bg-gray-900';
    if (theme === 'newyear') return 'bg-transparent';
    if (theme === 'forest') return 'bg-[#1a2e22]';
    if (theme === 'neon') return 'bg-black';
    if (theme === 'moscow') return 'bg-[#f5f5f7]';
    if (theme === 'lebedev') return 'bg-white';
    if (theme === 'simple') return 'bg-blue-50';
    return 'bg-blue-50';
  })();
  
  // Card Style
  const bgCard = (() => {
    if (theme === 'dark') return 'bg-gray-800';
    if (theme === 'newyear') return 'bg-gradient-to-br from-white/20 to-white/5 backdrop-blur-xl border border-white/30 shadow-[0_8px_32px_0_rgba(0,0,0,0.15)]';
    if (theme === 'forest') return 'bg-[#243b2f] border border-[#355243]';
    if (theme === 'neon') return 'bg-gray-900 border border-pink-500/20 shadow-[0_0_15px_rgba(236,72,153,0.1)]';
    if (theme === 'moscow') return 'bg-white shadow-sm border border-gray-100';
    if (theme === 'lebedev') return 'bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]';
    if (theme === 'simple') return 'bg-white shadow-sm';
    return 'bg-white';
  })();
  
  // Inputs
  const inputBg = (() => {
    if (theme === 'dark') return 'bg-gray-700 text-white border-gray-600';
    if (theme === 'newyear') return 'bg-white/10 text-white border-white/30 placeholder-white/50 focus:bg-white/20 focus:border-white/60 focus:ring-2 focus:ring-white/20';
    if (theme === 'forest') return 'bg-[#2f4a3b] text-white border-[#416350] placeholder-emerald-200/50';
    if (theme === 'neon') return 'bg-black text-pink-500 border-pink-500/50 placeholder-pink-900';
    if (theme === 'lebedev') return 'bg-white text-black border-2 border-black focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all';
    return 'bg-white text-gray-800 border-blue-100';
  })();
  
  // Theme Specific Colors
  const accentColor = (() => {
    if (theme === 'newyear') return 'bg-white text-red-700 hover:bg-red-50 shadow-lg';
    if (theme === 'dark') return 'bg-purple-600 text-white';
    if (theme === 'forest') return 'bg-emerald-600 text-white hover:bg-emerald-500';
    if (theme === 'neon') return 'bg-pink-600 text-white hover:bg-pink-500 shadow-[0_0_15px_rgba(236,72,153,0.5)]';
    if (theme === 'lebedev') return 'bg-black text-white hover:bg-gray-800';
    if (theme === 'moscow') return 'bg-red-600 text-white hover:bg-red-700';
    return 'bg-blue-600 text-white';
  })();
  
  // Icon Backgrounds
  const accentLight = (() => {
    if (theme === 'newyear') return 'bg-white text-red-600 shadow-lg';
    if (theme === 'dark') return 'bg-purple-900/30 text-purple-400';
    if (theme === 'forest') return 'bg-emerald-900/30 text-emerald-400';
    if (theme === 'neon') return 'bg-pink-900/30 text-pink-500';
    if (theme === 'lebedev') return 'bg-gray-100 text-black border border-black';
    if (theme === 'moscow') return 'bg-red-100 text-red-600';
    return 'bg-blue-100 text-blue-600';
  })();
    
  const accentText = (() => {
    if (theme === 'newyear') return 'text-red-200';
    if (theme === 'dark') return 'text-purple-400';
    if (theme === 'forest') return 'text-emerald-400';
    if (theme === 'neon') return 'text-pink-500';
    if (theme === 'lebedev') return 'text-black font-bold';
    if (theme === 'moscow') return 'text-red-600';
    return 'text-blue-500';
  })();

  useEffect(() => {
    if (currentUser) {
      const fetchUserData = async () => {
         const snapshot = await get(ref(db, `users/${currentUser.uid}`));
         if (snapshot.exists()) {
           const data = snapshot.val() as UserProfile;
           setUsername(data.username);
           setNewUsername(data.username);
           setDisplayName(data.displayName);
           if (data.photoURL) setPhotoURL(data.photoURL);
           setBio(data.bio || '');
         }
      };
      fetchUserData();
      
      const savedPin = localStorage.getItem(`flux_pin_${currentUser.uid}`);
      if (savedPin) {
          setIsPinEnabled(true);
      }
    }
  }, [currentUser]);

  // Helper to compress image
  const compressImage = (base64Str: string, maxWidth = 300): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ratio = maxWidth / img.width;
        if (img.width <= maxWidth) {
           resolve(base64Str);
           return;
        }
        canvas.width = maxWidth;
        canvas.height = img.height * ratio;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
    });
  };

  const handleSave = async () => {
    if (!currentUser) return;
    setLoading(true);
    setMessage('');
    setError('');

    try {
      const cleanNewUsername = newUsername.replace(/\s/g, '').toLowerCase();

      if (cleanNewUsername.length < 3) {
        throw new Error("Юзернейм слишком короткий");
      }

      const updates: any = {};
      let usernameChanged = false;

      if (cleanNewUsername !== username) {
        const usernameRef = child(ref(db), `usernames/${cleanNewUsername}`);
        const snapshot = await get(usernameRef);
        
        if (snapshot.exists()) {
          throw new Error("Юзернейм уже занят");
        }

        updates[`usernames/${username}`] = null;
        updates[`usernames/${cleanNewUsername}`] = currentUser.uid;
        updates[`users/${currentUser.uid}/username`] = cleanNewUsername;
        usernameChanged = true;
      }

      updates[`users/${currentUser.uid}/displayName`] = displayName;
      updates[`users/${currentUser.uid}/photoURL`] = photoURL;
      updates[`users/${currentUser.uid}/bio`] = bio;

      await update(ref(db), updates);

      const authUpdates: { displayName?: string; photoURL?: string } = {
        displayName: displayName
      };

      if (!photoURL.startsWith('data:')) {
         authUpdates.photoURL = photoURL;
      }

      await updateProfile(currentUser, authUpdates);

      if (usernameChanged) {
        setUsername(cleanNewUsername);
      }
      
      setMessage('Профиль успешно сохранен!');
      setTimeout(() => setActiveSection('main'), 1000);

    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Ошибка сохранения.');
    } finally {
      setLoading(false);
    }
  };

  const generateNewAvatar = () => {
    const seed = Math.random().toString(36).substring(7);
    setPhotoURL(`https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError('Файл слишком большой (макс 5МБ)');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (ev) => {
        if (ev.target?.result) {
            const rawBase64 = ev.target.result as string;
            const compressed = await compressImage(rawBase64);
            setPhotoURL(compressed);
        }
    };
    reader.readAsDataURL(file);
    e.target.value = ''; 
  };

  const handleInvite = async () => {
      const url = 'https://flux-web-six.vercel.app';
      const shareData = {
          title: 'Flux Web',
          text: 'Привет! Присоединяйся ко мне в мессенджере Flux Web: ',
          url: url
      };

      if (navigator.share) {
          try {
              await navigator.share(shareData);
          } catch (e) {
              console.log('Share dismissed');
          }
      } else {
          try {
             await navigator.clipboard.writeText(`${shareData.text} ${url}`);
             setMessage('Ссылка скопирована в буфер обмена!');
             setTimeout(() => setMessage(''), 3000);
          } catch (err) {
             setMessage('Не удалось скопировать ссылку');
          }
      }
  };

  const handlePinInput = (digit: string) => {
      if (pinCode.length < 4) {
          setPinCode(prev => prev + digit);
          setPinError('');
      }
  };

  const handlePinDelete = () => {
      setPinCode(prev => prev.slice(0, -1));
      setPinError('');
  };

  useEffect(() => {
      if (pinCode.length === 4) {
          if (pinStep === 'create') {
              setTempPin(pinCode);
              setPinCode('');
              setPinStep('confirm');
          } else if (pinStep === 'confirm') {
              if (pinCode === tempPin) {
                  // Save PIN
                  localStorage.setItem(`flux_pin_${currentUser?.uid}`, pinCode);
                  setIsPinEnabled(true);
                  setShowPinSetup(false);
                  setPinCode('');
                  setTempPin('');
                  setPinStep('create');
                  setMessage('Защита успешно установлена!');
                  setTimeout(() => setMessage(''), 3000);
              } else {
                  setPinError('Коды не совпадают. Попробуйте снова.');
                  setPinCode('');
                  setTempPin('');
                  setPinStep('create');
              }
          }
      }
  }, [pinCode, pinStep, tempPin, currentUser?.uid]);

  const removePin = () => {
      localStorage.removeItem(`flux_pin_${currentUser?.uid}`);
      setIsPinEnabled(false);
      setMessage('Защита отключена');
      setTimeout(() => setMessage(''), 3000);
  };

  // RENDER: Profile Editor
  if (activeSection === 'profile') {
    return (
      <div className={`h-full flex flex-col p-6 overflow-y-auto relative ${mainBg}`}>
        <div className="flex items-center gap-2 mb-6 z-10 relative">
           <button 
             onClick={() => { setActiveSection('main'); setNewUsername(username); setError(''); }}
             className={`p-2 -ml-2 rounded-full hover:bg-black/10 transition ${textPrimary}`}
           >
             <ArrowLeft size={24} />
           </button>
           <h2 className={`text-2xl font-bold ${textPrimary}`}>Редактор профиля</h2>
        </div>
        
        <div className="flex flex-col items-center mb-8 z-10 relative">
           <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
             <img src={photoURL} alt="Avatar" className={`w-28 h-28 rounded-full shadow-lg object-cover ${bgCard} ${isNewYear ? 'ring-4 ring-white/30' : ''}`} />
             <div className="absolute inset-0 bg-black/30 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="text-white" size={32} />
             </div>
             <div className="absolute bottom-0 right-0 p-2 bg-blue-500 rounded-full border-2 border-white dark:border-gray-900 text-white shadow-sm">
                <Camera size={16} />
             </div>
           </div>

           <div className="flex gap-2 mt-4">
              <button 
                onClick={() => fileInputRef.current?.click()}
                className={`text-sm font-medium px-4 py-2 rounded-full transition flex items-center gap-2 ${isNewYear ? 'bg-white text-red-600 hover:bg-red-50 shadow-md' : (isDark ? 'bg-gray-800 text-white hover:bg-gray-700' : 'bg-white text-gray-800 hover:bg-gray-100 shadow-sm')}`}
              >
                <Upload size={14} />
                Загрузить фото
              </button>
              <button 
                onClick={generateNewAvatar}
                className={`text-sm font-medium px-4 py-2 rounded-full transition ${accentLight}`}
              >
                Сгенерировать
              </button>
           </div>
           
           <input 
             type="file" 
             ref={fileInputRef} 
             onChange={handleFileChange} 
             className="hidden" 
             accept="image/*" 
           />
        </div>

        <div className="space-y-6 z-10 relative">
          <div>
            <label className={`text-sm font-bold ml-1 mb-1 block ${textSecondary}`}>Имя</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className={`w-full p-4 rounded-xl outline-none transition ${inputBg}`}
            />
          </div>

          <div>
            <label className={`text-sm font-bold ml-1 mb-1 block ${textSecondary}`}>О себе</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Немного о себе..."
              rows={3}
              className={`w-full p-4 rounded-xl outline-none transition resize-none ${inputBg}`}
            />
            <p className={`text-xs mt-1 ml-1 ${textSecondary}`}>Любые подробности, например: возраст, род занятий или город.</p>
          </div>
          
          <div>
             <label className={`text-sm font-bold ml-1 mb-1 block ${textSecondary}`}>Имя пользователя</label>
             <div className="relative">
                <span className={`absolute left-4 top-4 ${textSecondary}`}>@</span>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value.replace(/\s/g, '').toLowerCase())}
                  className={`w-full pl-8 p-4 rounded-xl outline-none transition ${inputBg}`}
                />
             </div>
             <p className={`text-xs mt-1 ml-1 ${textSecondary}`}>По этому имени вас смогут найти другие люди.</p>
          </div>
        </div>

        {error && <div className="mt-4 p-3 bg-red-500/10 text-red-500 rounded-lg text-center z-10 relative">{error}</div>}
        {message && <div className="mt-4 p-3 bg-green-500/10 text-green-500 rounded-lg text-center z-10 relative">{message}</div>}

        <div className="flex-1 min-h-[20px]"></div>

        <button 
            onClick={handleSave}
            disabled={loading}
            className={`w-full py-4 rounded-xl font-bold transition z-10 relative ${accentColor} ${loading ? 'opacity-50' : 'hover:brightness-110'}`}
          >
            {loading ? '...' : 'Сохранить'}
        </button>
      </div>
    );
  }

  // Helper functions for Preview
  const getPreviewBg = (t: Theme) => {
    if (t === 'dark') return 'bg-gray-900';
    if (t === 'newyear') return 'bg-gradient-to-b from-red-900 to-red-950';
    if (t === 'forest') return 'bg-[#1a2e22]';
    if (t === 'neon') return 'bg-black';
    if (t === 'moscow') return 'bg-[#f5f5f7]';
    if (t === 'lebedev') return 'bg-white border border-gray-200';
    if (t === 'simple') return 'bg-blue-50';
    return 'bg-blue-50';
  };

  const getMyBubble = (t: Theme) => {
    if (t === 'dark') return 'bg-purple-600';
    if (t === 'newyear') return 'bg-white text-red-600';
    if (t === 'forest') return 'bg-emerald-600';
    if (t === 'neon') return 'bg-pink-600 shadow-[0_0_10px_rgba(236,72,153,0.5)]';
    if (t === 'moscow') return 'bg-red-600';
    if (t === 'lebedev') return 'bg-black';
    return 'bg-blue-500';
  };

  const getOtherBubble = (t: Theme) => {
    if (t === 'dark' || t === 'forest' || t === 'neon') return 'bg-gray-800 text-gray-200';
    if (t === 'newyear') return 'bg-white/20 text-white backdrop-blur-sm';
    return 'bg-white text-gray-800 shadow-sm';
  };

  const themesList = [
    { id: 'forest', name: 'Тайный лес', color: 'bg-[#1a2e22]', textColor: 'text-emerald-100' },
    { id: 'neon', name: 'Неон', color: 'bg-black border border-pink-500/30', textColor: 'text-pink-500' },
    { id: 'moscow', name: 'Москва', color: 'bg-[#f5f5f7]', textColor: 'text-gray-800' },
    { id: 'lebedev', name: 'Тема Студии Лебедева', color: 'bg-white border border-gray-200', textColor: 'text-black' },
    { id: 'simple', name: 'Простая', color: 'bg-blue-50', textColor: 'text-blue-600' },
  ];

  // RENDER: Theme Selector
  if (activeSection === 'themes') {
    return (
      <div className={`h-full flex flex-col p-6 overflow-y-auto ${mainBg}`}>
         <div className="flex items-center gap-2 mb-6">
            <button 
              onClick={() => setActiveSection('main')}
              className={`p-2 -ml-2 rounded-full hover:bg-black/5 transition ${textPrimary}`}
            >
              <ArrowLeft size={24} />
            </button>
            <h2 className={`text-2xl font-bold ${textPrimary}`}>Оформление</h2>
         </div>

         {/* Segmented Control */}
         <div className="bg-gray-200/50 p-1 rounded-xl flex mb-8">
              <button onClick={() => setTheme('light')} className={`flex-1 py-2 text-sm font-medium rounded-lg transition ${theme === 'light' ? 'bg-white shadow-sm text-black' : 'text-gray-500 hover:text-gray-700'}`}>Светлая</button>
              <button onClick={() => setTheme('dark')} className={`flex-1 py-2 text-sm font-medium rounded-lg transition ${theme === 'dark' ? 'bg-white shadow-sm text-black' : 'text-gray-500 hover:text-gray-700'}`}>Тёмная</button>
         </div>

         <div className="space-y-6">
            <div>
                <p className={`text-xs uppercase font-bold mb-3 ml-1 opacity-60 ${textPrimary}`}>Тема оформления</p>
                
                {/* Chat Preview */}
                <div className={`w-full p-6 rounded-3xl ${getPreviewBg(theme)} transition-all duration-500 shadow-inner min-h-[180px] flex flex-col justify-center relative overflow-hidden border border-black/5`}>
                    {/* Decorative Elements for some themes */}
                    {theme === 'neon' && <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-pink-900/20 via-black to-black pointer-events-none"></div>}
                    {theme === 'newyear' && <Snowflake className="absolute top-2 right-2 text-white/20 animate-spin-slow" />}

                    <div className="flex flex-col gap-3 relative z-10">
                        {/* Incoming Message */}
                        <div className={`p-3.5 rounded-2xl rounded-tl-none max-w-[85%] self-start ${getOtherBubble(theme)} animate-in slide-in-from-left duration-500`}>
                            <p className="text-sm leading-snug">Выберите тему, чтобы изменить фон и цвет сообщений 🎨</p>
                            <span className="text-[10px] opacity-60 mt-1 block text-right">09:41</span>
                        </div>
                        
                        {/* Outgoing Message */}
                        <div className={`p-3.5 rounded-2xl rounded-tr-none max-w-[85%] self-end ${getMyBubble(theme)} ${theme === 'newyear' ? 'text-red-600' : 'text-white'} shadow-md animate-in slide-in-from-right duration-500 delay-100`}>
                            <p className="text-sm leading-snug">Посмотрите, как с ней будут выглядеть ваши чаты</p>
                            <div className="flex items-center justify-end gap-1.5 mt-1">
                                <div className="flex -space-x-1.5 bg-black/10 rounded-full px-1 py-0.5">
                                    <span className="text-xs">👍</span>
                                    <span className="text-xs">❤️</span>
                                </div>
                                <span className="text-[10px] opacity-80">09:42</span>
                                {/* CheckCheck icon needs to be imported if not already */}
                                <div className="opacity-80"><Check size={12} /></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Theme Grid */}
            <div>
                <p className={`text-xs uppercase font-bold mb-3 ml-1 opacity-60 ${textPrimary}`}>Выберите стиль</p>
                <div className="grid grid-cols-3 gap-3">
                    {themesList.map(t => (
                        <button 
                            key={t.id}
                            onClick={() => setTheme(t.id as Theme)}
                            className={`relative aspect-[4/3] rounded-2xl overflow-hidden flex flex-col items-center justify-end p-2 transition-all duration-300 border-2 ${theme === t.id ? 'border-blue-500 scale-[1.02] shadow-lg' : 'border-transparent hover:scale-[1.02] hover:shadow-md'}`}
                        >
                            <div className={`absolute inset-0 ${t.color}`}></div>
                            
                            {/* Mini Chat Preview inside Card */}
                            <div className="absolute top-3 left-3 right-3 bottom-8 bg-white/20 backdrop-blur-sm rounded-lg border border-white/10">
                                <div className="absolute top-2 left-2 w-8 h-2 bg-white/40 rounded-full"></div>
                                <div className="absolute top-5 left-2 w-12 h-2 bg-white/30 rounded-full"></div>
                                <div className="absolute bottom-2 right-2 w-10 h-6 bg-white/50 rounded-lg rounded-br-none"></div>
                            </div>

                            <span className={`relative z-10 text-[10px] font-bold text-center leading-tight ${t.textColor}`}>{t.name}</span>
                            
                            {theme === t.id && (
                                <div className="absolute top-2 right-2 bg-blue-500 rounded-full p-1 shadow-sm">
                                    <Check size={10} className="text-white" strokeWidth={3} />
                                </div>
                            )}
                        </button>
                    ))}
                </div>
            </div>
         </div>
      </div>
    );
  }

  // RENDER: Security
  if (activeSection === 'security') {
      return (
        <div className={`h-full flex flex-col p-6 overflow-y-auto ${mainBg}`}>
           <div className="flex items-center gap-2 mb-6">
              <button 
                onClick={() => setActiveSection('main')}
                className={`p-2 -ml-2 rounded-full hover:bg-black/5 transition ${textPrimary}`}
              >
                <ArrowLeft size={24} />
              </button>
              <h2 className={`text-2xl font-bold ${textPrimary}`}>Безопасность</h2>
           </div>

           <div className="flex flex-col items-center justify-center py-8">
               <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-6 shadow-xl ${isDark ? 'bg-gray-800 text-blue-400' : 'bg-blue-100 text-blue-600'}`}>
                   <Shield size={48} />
               </div>
               <h3 className={`text-xl font-bold mb-2 ${textPrimary}`}>Защита приложения</h3>
               <p className={`text-center text-sm px-4 mb-8 ${textSecondary}`}>
                   Установите PIN-код для входа в приложение. Это защитит ваши переписки от посторонних глаз.
               </p>

               {isPinEnabled ? (
                   <div className="w-full space-y-4">
                       <div className={`p-4 rounded-2xl flex items-center justify-between border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                           <div className="flex items-center gap-3">
                               <div className="p-2 bg-green-100 text-green-600 rounded-full">
                                   <Lock size={20} />
                               </div>
                               <div>
                                   <p className={`font-bold ${textPrimary}`}>PIN-код включен</p>
                                   <p className={`text-xs ${textSecondary}`}>Приложение защищено</p>
                               </div>
                           </div>
                           <Check className="text-green-500" />
                       </div>
                       <button 
                           onClick={removePin}
                           className="w-full py-4 rounded-xl font-bold text-red-500 bg-red-500/10 hover:bg-red-500/20 transition active:scale-95"
                       >
                           Отключить защиту
                       </button>
                   </div>
               ) : (
                   <button 
                       onClick={() => setShowPinSetup(true)}
                       className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition active:scale-95 ${accentColor}`}
                   >
                       <KeyRound size={20} />
                       Установить PIN-код
                   </button>
               )}
           </div>

           {/* PIN Setup Modal */}
           {showPinSetup && (
               <div className="fixed inset-0 z-50 bg-black/80 flex flex-col items-center justify-center p-4 animate-in fade-in duration-200">
                   <div className={`w-full max-w-sm p-6 rounded-3xl shadow-2xl flex flex-col items-center ${isDark ? 'bg-gray-900' : 'bg-white'}`}>
                       <h3 className={`text-xl font-bold mb-2 ${textPrimary}`}>
                           {pinStep === 'create' ? 'Придумайте PIN-код' : 'Повторите PIN-код'}
                       </h3>
                       <p className={`text-sm mb-8 text-center ${pinError ? 'text-red-500' : textSecondary}`}>
                           {pinError || 'Введите 4 цифры'}
                       </p>

                       <div className="flex gap-4 mb-8">
                           {[0, 1, 2, 3].map(i => (
                               <div 
                                   key={i} 
                                   className={`w-4 h-4 rounded-full transition-all duration-200 ${pinCode.length > i ? 'bg-blue-500 scale-110' : (isDark ? 'bg-gray-700' : 'bg-gray-200')}`}
                               />
                           ))}
                       </div>

                       <div className="grid grid-cols-3 gap-4 w-full max-w-[240px]">
                           {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                               <button 
                                   key={num}
                                   onClick={() => handlePinInput(num.toString())}
                                   className={`aspect-square rounded-full text-2xl font-bold flex items-center justify-center transition active:scale-90 ${isDark ? 'bg-gray-800 text-white hover:bg-gray-700' : 'bg-gray-100 text-gray-900 hover:bg-gray-200'}`}
                               >
                                   {num}
                               </button>
                           ))}
                           <div className="aspect-square"></div>
                           <button 
                               onClick={() => handlePinInput('0')}
                               className={`aspect-square rounded-full text-2xl font-bold flex items-center justify-center transition active:scale-90 ${isDark ? 'bg-gray-800 text-white hover:bg-gray-700' : 'bg-gray-100 text-gray-900 hover:bg-gray-200'}`}
                           >
                               0
                           </button>
                           <button 
                               onClick={handlePinDelete}
                               className={`aspect-square rounded-full text-2xl font-bold flex items-center justify-center transition active:scale-90 ${isDark ? 'bg-gray-800 text-white hover:bg-gray-700' : 'bg-gray-100 text-gray-900 hover:bg-gray-200'}`}
                           >
                               <ArrowLeft size={24} />
                           </button>
                       </div>

                       <button 
                           onClick={() => {
                               setShowPinSetup(false);
                               setPinCode('');
                               setTempPin('');
                               setPinStep('create');
                               setPinError('');
                           }}
                           className={`mt-8 px-6 py-2 rounded-full text-sm font-bold ${textSecondary} hover:bg-black/5 transition`}
                       >
                           Отмена
                       </button>
                   </div>
               </div>
           )}
        </div>
      );
  }

  // RENDER: Main Menu
  return (
    <div className={`h-full p-6 flex flex-col overflow-y-auto ${mainBg}`}>
       <h1 className={`text-3xl font-bold mb-8 ${textPrimary}`}>Настройки</h1>

       {/* Profile Card */}
       <div className={`${bgCard} p-6 rounded-3xl mb-6 flex items-center gap-4`}>
          <img src={photoURL || currentUser?.photoURL || ''} className={`w-16 h-16 rounded-full bg-gray-200 object-cover ${isNewYear ? 'ring-2 ring-white/50' : ''}`} />
          <div className="min-w-0">
            <h2 className={`text-xl font-bold truncate ${textPrimary}`}>{displayName}</h2>
            <p className={`${accentText} truncate`}>@{username}</p>
          </div>
       </div>

       {/* Menu Items */}
       <div className="space-y-3 mb-8">
         <button 
           onClick={() => setActiveSection('profile')}
           className={`w-full ${bgCard} p-4 rounded-2xl flex items-center gap-4 text-left hover:brightness-105 transition group ${isNewYear ? 'hover:bg-white/20' : ''}`}
         >
           <div className={`p-3 rounded-full transition group-hover:scale-110 ${accentLight}`}>
             <Edit2 size={24} />
           </div>
           <div className="flex-1">
             <span className={`text-base font-bold block ${textPrimary}`}>Редактор профиля</span>
             <span className={`text-xs ${textSecondary}`}>Имя, описание, юзернейм</span>
           </div>
           <ChevronRight className={`${isNewYear ? 'text-white/70' : 'text-gray-400 opacity-50'}`} size={20} />
         </button>

         <button 
           onClick={() => setActiveSection('themes')}
           className={`w-full ${bgCard} p-4 rounded-2xl flex items-center gap-4 text-left hover:brightness-105 transition group ${isNewYear ? 'hover:bg-white/20' : ''}`}
         >
           <div className={`p-3 rounded-full transition group-hover:scale-110 ${theme === 'newyear' ? 'bg-red-100 text-red-600' : (isDark ? 'bg-gray-700 text-purple-400' : 'bg-blue-100 text-blue-600')} ${isNewYear ? '!bg-white !text-red-600 shadow-lg' : ''}`}>
             <Palette size={24} />
           </div>
           <div className="flex-1">
             <span className={`text-base font-bold block ${textPrimary}`}>Оформление</span>
             <span className={`text-xs ${textSecondary}`}>
                {theme === 'light' ? 'Яркая тема' : (theme === 'dark' ? 'Тёмная тема' : 'Новогодняя тема')}
             </span>
           </div>
           <ChevronRight className={`${isNewYear ? 'text-white/70' : 'text-gray-400 opacity-50'}`} size={20} />
         </button>

         <button 
           onClick={() => setActiveSection('security')}
           className={`w-full ${bgCard} p-4 rounded-2xl flex items-center gap-4 text-left hover:brightness-105 transition group ${isNewYear ? 'hover:bg-white/20' : ''}`}
         >
           <div className={`p-3 rounded-full transition group-hover:scale-110 ${theme === 'newyear' ? 'bg-blue-100 text-blue-600' : (isDark ? 'bg-gray-700 text-blue-400' : 'bg-blue-100 text-blue-600')} ${isNewYear ? '!bg-white !text-blue-600 shadow-lg' : ''}`}>
             <Shield size={24} />
           </div>
           <div className="flex-1">
             <span className={`text-base font-bold block ${textPrimary}`}>Безопасность</span>
             <span className={`text-xs ${textSecondary}`}>Защита приложения, PIN-код</span>
           </div>
           <ChevronRight className={`${isNewYear ? 'text-white/70' : 'text-gray-400 opacity-50'}`} size={20} />
         </button>

         <button 
           onClick={handleInvite}
           className={`w-full ${bgCard} p-4 rounded-2xl flex items-center gap-4 text-left hover:brightness-105 transition group ${isNewYear ? 'hover:bg-white/20' : ''}`}
         >
           <div className={`p-3 rounded-full transition group-hover:scale-110 ${theme === 'newyear' ? 'bg-green-100 text-green-600' : (isDark ? 'bg-gray-700 text-green-400' : 'bg-green-100 text-green-600')} ${isNewYear ? '!bg-white !text-green-600 shadow-lg' : ''}`}>
             <Share2 size={24} />
           </div>
           <div className="flex-1">
             <span className={`text-base font-bold block ${textPrimary}`}>Пригласить друга</span>
             <span className={`text-xs ${textSecondary}`}>Поделиться ссылкой</span>
           </div>
           <ChevronRight className={`${isNewYear ? 'text-white/70' : 'text-gray-400 opacity-50'}`} size={20} />
         </button>
       </div>
       
       {message && <div className="mb-4 p-3 bg-green-500/20 text-green-600 font-bold rounded-xl text-center animate-in zoom-in duration-300">{message}</div>}

       <div className="flex-1"></div>

       <div className="text-center mb-8">
          <p className={`font-bold text-lg ${textPrimary}`}>Flux Web</p>
          <p className={`${textSecondary} text-sm`}>Версия 0.2</p>
       </div>

       <button 
         onClick={onLogout}
         className={`w-full p-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition active:scale-[0.98] ${isNewYear ? 'bg-white/10 text-white hover:bg-white/20 border border-white/20 shadow-lg' : 'bg-red-500/10 text-red-500 hover:bg-red-500/20'}`}
       >
         <LogOut size={20} />
         Выйти
       </button>
    </div>
  );
};

export default Settings;