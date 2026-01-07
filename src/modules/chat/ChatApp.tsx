import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import type { PortalUser } from '@shared/types';
import type { ChatUser, Channel, Message, TypingUser } from './types';
import * as api from './api';
import './chat.css';

const CHAT_SERVER_URL = import.meta.env.VITE_CHAT_API_URL || 'http://192.168.0.173:3300';

interface ChatAppProps {
  user: PortalUser;
}

function ChatApp({ user }: ChatAppProps) {
  // 인증 상태
  const [chatUser, setChatUser] = useState<ChatUser | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [showRegister, setShowRegister] = useState(false);

  // 로그인 폼
  const [username, setUsername] = useState(user.username);
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState(user.name);

  // 채팅 상태
  const [channels, setChannels] = useState<Channel[]>([]);
  const [currentChannel, setCurrentChannel] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  // 채널 생성 모달
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelDesc, setNewChannelDesc] = useState('');

  // Socket.io 연결
  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 메시지 스크롤
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // 로그인 시도 (자동 또는 수동)
  const handleLogin = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setIsLoggingIn(true);
    setLoginError(null);

    try {
      const session = await api.login(username, password);
      setChatUser(session.user);
      connectSocket(session.token);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '로그인 실패';
      setLoginError(errorMessage);
    } finally {
      setIsLoggingIn(false);
    }
  };

  // 회원가입
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError(null);

    try {
      const session = await api.register(username, password, displayName);
      setChatUser(session.user);
      connectSocket(session.token);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '회원가입 실패';
      setLoginError(errorMessage);
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Socket.io 연결
  const connectSocket = (token: string) => {
    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    const socket = io(CHAT_SERVER_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      setIsConnected(true);
      console.log('[Chat] Socket connected');
      loadChannels();
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      console.log('[Chat] Socket disconnected');
    });

    socket.on('message:new', (message: Message) => {
      if (message.channel_id === currentChannel?.id) {
        setMessages((prev) => [...prev, message]);
      }
      // 채널 목록 업데이트 (최신 메시지)
      setChannels((prev) =>
        prev.map((ch) =>
          ch.id === message.channel_id ? { ...ch, last_message: message } : ch
        )
      );
    });

    socket.on('message:updated', (message: Message) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === message.id ? message : m))
      );
    });

    socket.on('message:deleted', ({ message_id }: { message_id: string }) => {
      setMessages((prev) => prev.filter((m) => m.id !== message_id));
    });

    socket.on('typing:update', ({ channel_id, users }: { channel_id: string; users: TypingUser[] }) => {
      if (channel_id === currentChannel?.id) {
        setTypingUsers(users.filter((u) => u.user_id !== chatUser?.id));
      }
    });

    socket.on('presence:update', ({ user_id, status }: { user_id: string; status: string }) => {
      console.log(`[Chat] User ${user_id} is now ${status}`);
    });

    socketRef.current = socket;
  };

  // 채널 목록 로드
  const loadChannels = async () => {
    try {
      const channelList = await api.getChannels();
      setChannels(channelList);
      if (channelList.length > 0 && !currentChannel) {
        selectChannel(channelList[0]);
      }
    } catch (error) {
      console.error('채널 목록 로드 실패:', error);
    }
  };

  // 채널 선택
  const selectChannel = async (channel: Channel) => {
    setCurrentChannel(channel);
    setMessages([]);
    setTypingUsers([]);

    // 이전 채널 떠나기
    if (currentChannel && socketRef.current) {
      socketRef.current.emit('channel:leave', { channel_id: currentChannel.id });
    }

    // 새 채널 입장
    if (socketRef.current) {
      socketRef.current.emit('channel:join', { channel_id: channel.id });
    }

    // 메시지 로드
    try {
      const msgs = await api.getMessages(channel.id);
      setMessages(msgs);
    } catch (error) {
      console.error('메시지 로드 실패:', error);
    }
  };

  // 메시지 전송
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || !currentChannel) return;

    const content = messageInput.trim();
    setMessageInput('');

    // Socket으로 전송 (실시간)
    if (socketRef.current) {
      socketRef.current.emit('message:send', {
        channel_id: currentChannel.id,
        content,
        message_type: 'text',
      });
    }

    // 타이핑 중지
    if (socketRef.current) {
      socketRef.current.emit('typing:stop', { channel_id: currentChannel.id });
    }
  };

  // 타이핑 표시
  const handleTyping = () => {
    if (!currentChannel || !socketRef.current) return;

    socketRef.current.emit('typing:start', { channel_id: currentChannel.id });

    // 3초 후 자동 중지
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      if (socketRef.current && currentChannel) {
        socketRef.current.emit('typing:stop', { channel_id: currentChannel.id });
      }
    }, 3000);
  };

  // 채널 생성
  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChannelName.trim()) return;

    try {
      const channel = await api.createChannel(newChannelName.trim(), newChannelDesc.trim());
      setChannels((prev) => [...prev, channel]);
      setShowCreateChannel(false);
      setNewChannelName('');
      setNewChannelDesc('');
      selectChannel(channel);
    } catch (error) {
      console.error('채널 생성 실패:', error);
    }
  };

  // 로그아웃
  const handleLogout = async () => {
    try {
      await api.logout();
    } catch {
      // ignore
    }
    socketRef.current?.disconnect();
    socketRef.current = null;
    setChatUser(null);
    setChannels([]);
    setCurrentChannel(null);
    setMessages([]);
    api.setAuthToken(null);
  };

  // 창 닫기
  const handleClose = () => {
    window.close();
  };

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      socketRef.current?.disconnect();
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  // 시간 포맷
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  };

  // 로그인 화면
  if (!chatUser) {
    return (
      <div className="chat-login-container">
        <div className="chat-login-card">
          <div className="chat-login-header">
            <span className="chat-logo">💬</span>
            <h1>한의원 채팅</h1>
            <p>직원간 소통을 위한 채팅 서비스입니다</p>
          </div>

          <form onSubmit={showRegister ? handleRegister : handleLogin} className="chat-login-form">
            <div className="form-group">
              <label>아이디</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="아이디 입력"
                required
              />
            </div>

            <div className="form-group">
              <label>비밀번호</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호 입력"
                required
              />
            </div>

            {showRegister && (
              <div className="form-group">
                <label>표시 이름</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="채팅에 표시될 이름"
                  required
                />
              </div>
            )}

            {loginError && <div className="login-error">{loginError}</div>}

            <button type="submit" className="btn-login" disabled={isLoggingIn}>
              {isLoggingIn ? '처리 중...' : showRegister ? '회원가입' : '로그인'}
            </button>

            <button
              type="button"
              className="btn-toggle-mode"
              onClick={() => setShowRegister(!showRegister)}
            >
              {showRegister ? '이미 계정이 있으신가요? 로그인' : '계정이 없으신가요? 회원가입'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 메인 채팅 화면
  return (
    <div className="chat-app">
      {/* 헤더 */}
      <header className="chat-header">
        <div className="chat-header-left">
          <span className="chat-logo">💬</span>
          <span className="chat-title">채팅</span>
          <span className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
            {isConnected ? '연결됨' : '연결 끊김'}
          </span>
        </div>
        <div className="chat-header-right">
          <span className="chat-user-info">👤 {chatUser.display_name}</span>
          <button className="btn-logout" onClick={handleLogout}>로그아웃</button>
          <button className="btn-close" onClick={handleClose}>✕</button>
        </div>
      </header>

      <div className="chat-body">
        {/* 채널 목록 */}
        <aside className="chat-sidebar">
          <div className="sidebar-header">
            <h3>채널</h3>
            <button className="btn-add-channel" onClick={() => setShowCreateChannel(true)}>+</button>
          </div>
          <ul className="channel-list">
            {channels.map((channel) => (
              <li
                key={channel.id}
                className={`channel-item ${currentChannel?.id === channel.id ? 'active' : ''}`}
                onClick={() => selectChannel(channel)}
              >
                <span className="channel-icon">#</span>
                <span className="channel-name">{channel.name}</span>
                {channel.unread_count && channel.unread_count > 0 && (
                  <span className="unread-badge">{channel.unread_count}</span>
                )}
              </li>
            ))}
          </ul>
        </aside>

        {/* 메시지 영역 */}
        <main className="chat-main">
          {currentChannel ? (
            <>
              <div className="channel-header">
                <span className="channel-icon">#</span>
                <span className="channel-name">{currentChannel.name}</span>
                {currentChannel.description && (
                  <span className="channel-desc">{currentChannel.description}</span>
                )}
              </div>

              <div className="messages-container">
                {messages.map((message) => (
                  <div key={message.id} className="message-item">
                    <div className="message-avatar">
                      {(message.display_name || message.username || '?')[0].toUpperCase()}
                    </div>
                    <div className="message-content">
                      <div className="message-header">
                        <span className="message-author">
                          {message.display_name || message.username}
                        </span>
                        <span className="message-time">{formatTime(message.created_at)}</span>
                        {message.is_edited && <span className="message-edited">(수정됨)</span>}
                      </div>
                      <div className="message-text">{message.content}</div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {typingUsers.length > 0 && (
                <div className="typing-indicator">
                  {typingUsers.map((u) => u.display_name).join(', ')}님이 입력 중...
                </div>
              )}

              <form className="message-form" onSubmit={handleSendMessage}>
                <input
                  type="text"
                  value={messageInput}
                  onChange={(e) => {
                    setMessageInput(e.target.value);
                    handleTyping();
                  }}
                  placeholder={`#${currentChannel.name}에 메시지 보내기`}
                  className="message-input"
                />
                <button type="submit" className="btn-send" disabled={!messageInput.trim()}>
                  전송
                </button>
              </form>
            </>
          ) : (
            <div className="no-channel-selected">
              <p>채널을 선택하거나 새 채널을 만들어주세요</p>
            </div>
          )}
        </main>
      </div>

      {/* 채널 생성 모달 */}
      {showCreateChannel && (
        <div className="modal-overlay" onClick={() => setShowCreateChannel(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>새 채널 만들기</h3>
              <button className="modal-close" onClick={() => setShowCreateChannel(false)}>×</button>
            </div>
            <form onSubmit={handleCreateChannel}>
              <div className="form-group">
                <label>채널 이름</label>
                <input
                  type="text"
                  value={newChannelName}
                  onChange={(e) => setNewChannelName(e.target.value)}
                  placeholder="예: 일반, 공지사항"
                  required
                />
              </div>
              <div className="form-group">
                <label>설명 (선택)</label>
                <input
                  type="text"
                  value={newChannelDesc}
                  onChange={(e) => setNewChannelDesc(e.target.value)}
                  placeholder="채널에 대한 설명"
                />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-cancel" onClick={() => setShowCreateChannel(false)}>
                  취소
                </button>
                <button type="submit" className="btn-submit">만들기</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default ChatApp;
