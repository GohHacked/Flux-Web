export interface UserProfile {
  uid: string;
  email: string;
  username: string;
  displayName: string; // Nickname
  photoURL: string;
}

export interface Message {
  id: string;
  senderId: string;
  text: string;
  timestamp: number;
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