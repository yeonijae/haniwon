// 채팅 관련 타입 정의

export interface ChatUser {
  id: string;
  username: string;
  display_name: string;
  status: 'online' | 'offline' | 'away';
  last_seen?: string;
  created_at: string;
}

export interface Channel {
  id: string;
  name: string;
  description?: string;
  is_private: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  member_count?: number;
  last_message?: Message;
  unread_count?: number;
}

export interface Message {
  id: string;
  channel_id: string;
  user_id: string;
  username?: string;
  display_name?: string;
  content: string;
  message_type: 'text' | 'image' | 'file' | 'system';
  is_edited: boolean;
  created_at: string;
  updated_at: string;
  reactions?: Reaction[];
}

export interface Reaction {
  emoji: string;
  user_id: string;
  username: string;
}

export interface TypingUser {
  user_id: string;
  username: string;
  display_name: string;
}

export interface ChatSession {
  token: string;
  user: ChatUser;
}
