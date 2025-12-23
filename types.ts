export interface UserProfile {
  uid: string;
  email: string;
  username: string;
  displayName: string; // Nickname
  photoURL: string;
  bio?: string; // Description/About info
}

export interface UserStatus {
  state: 'online' | 'offline';
  last_changed: number;
}

export interface Message {
  id: string;
  senderId: string;
  text: string;
  timestamp: number;
  reactions?: Record<string, string>; // UID -> Emoji char
}

export interface ChatSession {
  chatId: string;
  participants: string[]; // Array of UIDs
  lastMessage?: string;
  timestamp: number;
  recipientUser?: UserProfile; // Enriched data for UI
}

export type AppView = 'auth' | 'chats' | 'settings' | 'chat_room';

export type Theme = 'light' | 'dark' | 'newyear';