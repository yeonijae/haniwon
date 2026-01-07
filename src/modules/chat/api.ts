// 채팅 API 함수

import type { ChatUser, Channel, Message, ChatSession } from './types';

const CHAT_API_URL = import.meta.env.VITE_CHAT_API_URL || 'http://192.168.0.173:3300';

let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

export function getAuthToken(): string | null {
  return authToken;
}

async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const response = await fetch(`${CHAT_API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

// Auth API
export async function login(username: string, password: string): Promise<ChatSession> {
  const result = await fetchApi<{ token: string; user: ChatUser }>('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  authToken = result.token;
  return result;
}

export async function register(
  username: string,
  password: string,
  displayName: string
): Promise<ChatSession> {
  const result = await fetchApi<{ token: string; user: ChatUser }>('/api/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, password, display_name: displayName }),
  });
  authToken = result.token;
  return result;
}

export async function logout(): Promise<void> {
  await fetchApi('/api/v1/auth/logout', { method: 'POST' });
  authToken = null;
}

export async function getCurrentUser(): Promise<ChatUser> {
  return fetchApi<ChatUser>('/api/v1/auth/me');
}

// Channel API
export async function getChannels(): Promise<Channel[]> {
  return fetchApi<Channel[]>('/api/v1/channels');
}

export async function getChannel(channelId: string): Promise<Channel> {
  return fetchApi<Channel>(`/api/v1/channels/${channelId}`);
}

export async function createChannel(
  name: string,
  description?: string,
  isPrivate = false
): Promise<Channel> {
  return fetchApi<Channel>('/api/v1/channels', {
    method: 'POST',
    body: JSON.stringify({ name, description, is_private: isPrivate }),
  });
}

export async function joinChannel(channelId: string): Promise<void> {
  await fetchApi(`/api/v1/channels/${channelId}/join`, { method: 'POST' });
}

export async function leaveChannel(channelId: string): Promise<void> {
  await fetchApi(`/api/v1/channels/${channelId}/leave`, { method: 'POST' });
}

// Message API
export async function getMessages(
  channelId: string,
  limit = 50,
  before?: string
): Promise<Message[]> {
  const params = new URLSearchParams({ limit: limit.toString() });
  if (before) params.append('before', before);
  return fetchApi<Message[]>(`/api/v1/channels/${channelId}/messages?${params}`);
}

export async function sendMessage(
  channelId: string,
  content: string,
  messageType: 'text' | 'image' | 'file' = 'text'
): Promise<Message> {
  return fetchApi<Message>('/api/v1/messages', {
    method: 'POST',
    body: JSON.stringify({ channel_id: channelId, content, message_type: messageType }),
  });
}

export async function updateMessage(messageId: string, content: string): Promise<Message> {
  return fetchApi<Message>(`/api/v1/messages/${messageId}`, {
    method: 'PUT',
    body: JSON.stringify({ content }),
  });
}

export async function deleteMessage(messageId: string): Promise<void> {
  await fetchApi(`/api/v1/messages/${messageId}`, { method: 'DELETE' });
}

// User API
export async function getUsers(): Promise<ChatUser[]> {
  return fetchApi<ChatUser[]>('/api/v1/users');
}

export async function updateStatus(status: 'online' | 'offline' | 'away'): Promise<void> {
  await fetchApi('/api/v1/users/status', {
    method: 'PUT',
    body: JSON.stringify({ status }),
  });
}

// Health check
export async function healthCheck(): Promise<{ status: string }> {
  return fetchApi<{ status: string }>('/health');
}
