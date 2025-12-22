import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { updateProfile } from 'firebase/auth';
import { ref, update, get, set, remove, child } from 'firebase/database';
import { LogOut, Edit2, Moon, Sun, Snowflake, Palette, ArrowLeft, ChevronRight } from 'lucide-react';
import { UserProfile, Theme } from '../types';

interface SettingsProps {
  onLogout: () => void;
  theme: Theme;
  setTheme: (t: Theme) => void;
}

const Settings: React.FC<SettingsProps> = ({ onLogout, theme, setTheme }) => {
  const [activeSection, setActiveSection] = useState<'main' | 'profile' | 'themes'>('main');
  
  // Profile State
  const [displayName, setDisplayName] = useState(auth.currentUser?.displayName || '');
  const [username, setUsername] = useState(''); 
  const [newUsername, setNewUsername] = useState(''); 
  const [photoURL, setPhotoURL] = useState(auth.currentUser?.photoURL || '');
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const currentUser = auth.currentUser;

  // Theme Styles
  const isDark = theme === 'dark';
  const textPrimary = isDark ? 'text-white' : 'text-gray-900';
  const textSecondary = isDark ? 'text-gray-400' : 'text-gray-500';
  const bgCard = isDark ? 'bg-gray-800' : 'bg-white';
  const inputBg = isDark ? 'bg-gray-700 text-white border-gray-600' : 'bg-white text-gray-800 border-blue-100';
  
  // Theme Specific Colors
  const accentColor = theme === 'newyear' ? 'bg-red-600' : (theme === 'dark' ? 'bg-purple-600' : 'bg-blue-600');
  const accentLight = theme === 'newyear' ? 'bg-red-100 text-red-600' : (theme === 'dark' ? 'bg-purple-900/30 text-purple-400' : 'bg-blue-100 text-blue-600');
  const accentText = theme === 'newyear' ? 'text-red-600' : (theme === 'dark' ? 'text-purple-400' : 'text-blue-500');

  useEffect(() => {
    if (currentUser) {
      const fetchUserData = async () => {
         const snapshot = await get(ref(db, `users/${currentUser.uid}`));
         if (snapshot.exists()) {
           const data = snapshot.val() as UserProfile;
           setUsername(data.username);
           setNewUsername(data.username);
           setDisplayName(data.displayName);
           setPhotoURL(data.photoURL);
         }
      };
      fetchUserData();
    }
  }, [currentUser]);

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

      await update(ref(db), updates);

      await updateProfile(currentUser, {
        displayName: displayName,
        photoURL: photoURL
      });

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

  // RENDER: Profile Editor
  if (activeSection === 'profile') {
    return (
      <div className={`h-full flex flex-col p-6 overflow-y-auto ${isDark ? 'bg-gray-900' : (theme === 'newyear' ? 'bg-red-50' : 'bg-blue-50')}`}>
        <div className="flex items-center gap-2 mb-6">
           <button 
             onClick={() => { setActiveSection('main'); setNewUsername(username); setError(''); }}
             className={`p-2 -ml-2 rounded-full hover:bg-black/5 transition ${textPrimary}`}
           >
             <ArrowLeft size={24} />
           </button>
           <h2 className={`text-2xl font-bold ${textPrimary}`}>Редактор профиля</h2>
        </div>
        
        <div className="flex flex-col items-center mb-8">
           <img src={photoURL} alt="Avatar" className={`w-24 h-24 rounded-full shadow-md mb-4 ${bgCard}`} />
           <button 
             onClick={generateNewAvatar}
             className={`text-sm font-medium px-4 py-2 rounded-full transition ${accentLight}`}
           >
             Сгенерировать новую аватарку
           </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className={`text-sm font-bold ml-1 ${textSecondary}`}>Никнейм</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className={`w-full p-4 rounded-xl outline-none focus:ring-2 focus:ring-opacity-50 transition ${inputBg} ${isDark ? 'focus:ring-purple-500' : 'focus:ring-blue-500'}`}
            />
          </div>
          
          <div>
             <label className={`text-sm font-bold ml-1 ${textSecondary}`}>Юзернейм</label>
             <div className="relative">
                <span className={`absolute left-4 top-4 ${textSecondary}`}>@</span>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value.replace(/\s/g, '').toLowerCase())}
                  className={`w-full pl-8 p-4 rounded-xl outline-none focus:ring-2 focus:ring-opacity-50 transition ${inputBg} ${isDark ? 'focus:ring-purple-500' : 'focus:ring-blue-500'}`}
                />
             </div>
             <p className={`text-xs mt-1 ml-1 ${textSecondary}`}>Можно изменить.</p>
          </div>
        </div>

        {error && <div className="mt-4 p-3 bg-red-500/10 text-red-500 rounded-lg text-center">{error}</div>}
        {message && <div className="mt-4 p-3 bg-green-500/10 text-green-500 rounded-lg text-center">{message}</div>}

        <div className="flex-1 min-h-[20px]"></div>

        <button 
            onClick={handleSave}
            disabled={loading}
            className={`w-full py-4 text-white rounded-xl font-bold shadow-lg transition ${accentColor} ${loading ? 'opacity-50' : 'hover:brightness-110'}`}
          >
            {loading ? '...' : 'Сохранить'}
        </button>
      </div>
    );
  }

  // RENDER: Theme Selector
  if (activeSection === 'themes') {
    return (
      <div className={`h-full flex flex-col p-6 overflow-y-auto ${isDark ? 'bg-gray-900' : (theme === 'newyear' ? 'bg-red-50' : 'bg-blue-50')}`}>
         <div className="flex items-center gap-2 mb-6">
            <button 
              onClick={() => setActiveSection('main')}
              className={`p-2 -ml-2 rounded-full hover:bg-black/5 transition ${textPrimary}`}
            >
              <ArrowLeft size={24} />
            </button>
            <h2 className={`text-2xl font-bold ${textPrimary}`}>Оформление</h2>
         </div>

         <div className="space-y-4">
            <button
               onClick={() => setTheme('light')}
               className={`w-full p-4 rounded-2xl border-2 flex items-center justify-between transition ${theme === 'light' ? 'border-blue-500 bg-blue-50' : `${bgCard} border-transparent`}`}
             >
                <div className="flex items-center gap-4">
                   <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-500">
                     <Sun size={20} />
                   </div>
                   <div className="text-left">
                     <p className={`font-bold ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>Яркая</p>
                     <p className="text-xs text-gray-500">Классическая светлая тема</p>
                   </div>
                </div>
                {theme === 'light' && <div className="w-5 h-5 bg-blue-500 rounded-full border-2 border-white"></div>}
             </button>

             <button
               onClick={() => setTheme('dark')}
               className={`w-full p-4 rounded-2xl border-2 flex items-center justify-between transition ${theme === 'dark' ? 'border-purple-500 bg-gray-800' : `${bgCard} border-transparent`}`}
             >
                <div className="flex items-center gap-4">
                   <div className="w-10 h-10 rounded-full bg-purple-900/50 flex items-center justify-center text-purple-400">
                     <Moon size={20} />
                   </div>
                   <div className="text-left">
                     <p className={`font-bold ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>Тёмная</p>
                     <p className="text-xs text-gray-500">Для ночного времени</p>
                   </div>
                </div>
                {theme === 'dark' && <div className="w-5 h-5 bg-purple-500 rounded-full border-2 border-gray-800"></div>}
             </button>

             <button
               onClick={() => setTheme('newyear')}
               className={`w-full p-4 rounded-2xl border-2 flex items-center justify-between transition ${theme === 'newyear' ? 'border-red-500 bg-red-50' : `${bgCard} border-transparent`}`}
             >
                <div className="flex items-center gap-4">
                   <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-500">
                     <Snowflake size={20} />
                   </div>
                   <div className="text-left">
                     <p className={`font-bold ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>Новый год</p>
                     <p className="text-xs text-gray-500">Праздничное настроение</p>
                   </div>
                </div>
                {theme === 'newyear' && <div className="w-5 h-5 bg-red-500 rounded-full border-2 border-white"></div>}
             </button>
         </div>
      </div>
    );
  }

  // RENDER: Main Menu
  return (
    <div className="h-full p-6 flex flex-col overflow-y-auto">
       <h1 className={`text-3xl font-bold mb-8 ${textPrimary}`}>Настройки</h1>

       {/* Profile Card */}
       <div className={`${bgCard} p-6 rounded-3xl shadow-sm mb-6 flex items-center gap-4`}>
          <img src={currentUser?.photoURL || ''} className="w-16 h-16 rounded-full bg-gray-200 object-cover" />
          <div className="min-w-0">
            <h2 className={`text-xl font-bold truncate ${textPrimary}`}>{currentUser?.displayName}</h2>
            <p className={`${accentText} truncate`}>@{username}</p>
          </div>
       </div>

       {/* Menu Items */}
       <div className="space-y-3 mb-8">
         <button 
           onClick={() => setActiveSection('profile')}
           className={`w-full ${bgCard} p-4 rounded-2xl shadow-sm flex items-center gap-4 text-left hover:brightness-95 transition group`}
         >
           <div className={`p-3 rounded-full transition group-hover:scale-110 ${accentLight}`}>
             <Edit2 size={24} />
           </div>
           <div className="flex-1">
             <span className={`text-base font-bold block ${textPrimary}`}>Редактор профиля</span>
             <span className={`text-xs ${textSecondary}`}>Имя, фото, юзернейм</span>
           </div>
           <ChevronRight className={`${textSecondary} opacity-50`} size={20} />
         </button>

         <button 
           onClick={() => setActiveSection('themes')}
           className={`w-full ${bgCard} p-4 rounded-2xl shadow-sm flex items-center gap-4 text-left hover:brightness-95 transition group`}
         >
           <div className={`p-3 rounded-full transition group-hover:scale-110 ${theme === 'newyear' ? 'bg-red-100 text-red-600' : (isDark ? 'bg-gray-700 text-purple-400' : 'bg-blue-100 text-blue-600')}`}>
             <Palette size={24} />
           </div>
           <div className="flex-1">
             <span className={`text-base font-bold block ${textPrimary}`}>Оформление</span>
             <span className={`text-xs ${textSecondary}`}>
                {theme === 'light' ? 'Яркая тема' : (theme === 'dark' ? 'Тёмная тема' : 'Новогодняя тема')}
             </span>
           </div>
           <ChevronRight className={`${textSecondary} opacity-50`} size={20} />
         </button>
       </div>

       <div className="flex-1"></div>

       <div className="text-center mb-8">
          <p className={`font-bold text-lg ${textPrimary}`}>Flux Web</p>
          <p className={`${textSecondary} text-sm`}>Версия 0.1</p>
       </div>

       <button 
         onClick={onLogout}
         className="w-full bg-red-500/10 text-red-500 p-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-red-500/20 transition active:scale-[0.98]"
       >
         <LogOut size={20} />
         Выйти
       </button>
    </div>
  );
};

export default Settings;