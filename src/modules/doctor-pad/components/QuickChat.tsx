/**
 * 빠른 채팅 컴포넌트 (미니 대화창 + 빠른 전송 버튼)
 */

import { useState, useEffect, useRef } from 'react';
import type { ChatMessage, QuickMessage } from '../types';
import { useTheme } from '../contexts/ThemeContext';

interface Props {
  userId: number;
  userName: string;
  userRole: 'doctor' | 'nurse' | 'reception';
  maxMessages?: number;
  collapsed?: boolean;
  patientContext?: {
    patientId: number;
    patientName: string;
  };
}

// 기본 빠른 메시지 템플릿
const DEFAULT_QUICK_MESSAGES: QuickMessage[] = [
  { id: '1', label: '준비됨', message: '환자 준비 완료되었습니다', targetType: 'nurse', icon: '✅' },
  { id: '2', label: '대기요청', message: '다음 환자 대기실로 불러주세요', targetType: 'reception', icon: '📢' },
  { id: '3', label: '완료', message: '액팅 종료되었습니다', targetType: 'nurse', icon: '🏁' },
  { id: '4', label: '간호사호출', message: '간호사 도움이 필요합니다', targetType: 'nurse', icon: '🔔' },
];

// 역할별 라벨
const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  doctor: { label: '의사', color: 'text-blue-400' },
  nurse: { label: '간호사', color: 'text-green-400' },
  reception: { label: '프론트', color: 'text-orange-400' },
  admin: { label: '관리자', color: 'text-purple-400' },
};

// 시간 포맷팅
function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

export function QuickChat({
  userId,
  userName,
  userRole,
  maxMessages = 3,
  collapsed: initialCollapsed = false,
  patientContext,
}: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [sending, setSending] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // SSE 구독 (채팅 API 구현 시 활성화)
  useEffect(() => {
    // 임시: 데모 메시지 로드
    loadDemoMessages();

    // TODO: 채팅 API 구현 후 SSE 연결
    // const eventSource = new EventSource(
    //   `${import.meta.env.VITE_POSTGRES_API_URL}/api/chat/subscribe?userId=${userId}`
    // );
    //
    // eventSource.onmessage = (event) => {
    //   const newMessage = JSON.parse(event.data);
    //   newMessage.isMe = newMessage.senderId === userId;
    //   setMessages(prev => [...prev.slice(-(maxMessages - 1)), newMessage]);
    // };
    //
    // return () => eventSource.close();
  }, [userId, maxMessages]);

  // 새 메시지 시 스크롤
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 데모 메시지 (API 구현 전 테스트용)
  const loadDemoMessages = () => {
    const now = new Date();
    const demoMessages: ChatMessage[] = [
      {
        id: '1',
        senderId: 100,
        senderName: '간호사A',
        senderRole: 'nurse',
        message: '치료실1 환자 준비됐습니다',
        timestamp: new Date(now.getTime() - 5 * 60000).toISOString(),
        isMe: false,
      },
      {
        id: '2',
        senderId: userId,
        senderName: userName,
        senderRole: userRole,
        message: '네 알겠습니다',
        timestamp: new Date(now.getTime() - 3 * 60000).toISOString(),
        isMe: true,
      },
      {
        id: '3',
        senderId: 101,
        senderName: '프론트',
        senderRole: 'reception',
        message: '다음 환자 박영희님 대기중입니다',
        timestamp: new Date(now.getTime() - 1 * 60000).toISOString(),
        isMe: false,
      },
    ];
    setMessages(demoMessages.slice(-maxMessages));
  };

  // 빠른 메시지 전송
  const sendQuickMessage = async (quickMsg: QuickMessage) => {
    setSending(quickMsg.id);

    try {
      // TODO: 채팅 API 구현 후 실제 전송
      // await fetch(`${import.meta.env.VITE_POSTGRES_API_URL}/api/chat/send`, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({
      //     senderId: userId,
      //     senderName: userName,
      //     senderRole: userRole,
      //     message: quickMsg.message,
      //     targetType: quickMsg.targetType,
      //     patientId: patientContext?.patientId,
      //   }),
      // });

      // 임시: 로컬에 메시지 추가
      const newMessage: ChatMessage = {
        id: Date.now().toString(),
        senderId: userId,
        senderName: userName,
        senderRole: userRole,
        message: quickMsg.message,
        timestamp: new Date().toISOString(),
        isMe: true,
        targetType: quickMsg.targetType,
      };

      setMessages(prev => [...prev.slice(-(maxMessages - 1)), newMessage]);

      // 전송 완료 피드백
      setTimeout(() => setSending(null), 500);
    } catch (error) {
      console.error('Failed to send message:', error);
      setSending(null);
    }
  };

  const { isDark } = useTheme();

  // 테마별 스타일
  const t = {
    container: isDark ? 'bg-gray-800' : 'bg-white shadow-sm',
    border: isDark ? 'border-gray-700' : 'border-gray-200',
    text: isDark ? 'text-white' : 'text-gray-900',
    textMuted: isDark ? 'text-gray-500' : 'text-gray-400',
    hover: isDark ? 'hover:bg-gray-700/50' : 'hover:bg-gray-100',
    msgBg: isDark ? 'bg-gray-900/50' : 'bg-gray-50',
    otherBubble: isDark ? 'bg-gray-700 text-gray-200' : 'bg-gray-200 text-gray-800',
    quickBtn: isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300',
  };

  return (
    <div className={`${t.container} rounded-lg overflow-hidden flex flex-col`}>
      {/* 헤더 */}
      <div
        className={`px-3 py-2 border-b ${t.border} flex items-center justify-between cursor-pointer ${t.hover}`}
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm">💬</span>
          <span className={`text-sm font-medium ${t.text}`}>원내채팅</span>
          {messages.length > 0 && (
            <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
          )}
        </div>
        <button className={`${t.textMuted} text-xs ${isDark ? 'hover:text-white' : 'hover:text-gray-900'}`}>
          {collapsed ? '▼' : '▲'}
        </button>
      </div>

      {!collapsed && (
        <>
          {/* 메시지 목록 */}
          <div className={`flex-1 p-2 space-y-2 max-h-[140px] overflow-y-auto ${t.msgBg}`}>
            {messages.length === 0 ? (
              <div className={`text-center ${t.textMuted} text-xs py-4`}>
                메시지가 없습니다
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${msg.isMe ? 'items-end' : 'items-start'}`}
                >
                  {/* 발신자 + 시간 */}
                  {!msg.isMe && (
                    <div className="flex items-center gap-1 mb-0.5">
                      <span className={`text-[10px] ${ROLE_LABELS[msg.senderRole]?.color || t.textMuted}`}>
                        {msg.senderName}
                      </span>
                      <span className={`text-[10px] ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                        {formatTime(msg.timestamp)}
                      </span>
                    </div>
                  )}

                  {/* 메시지 버블 */}
                  <div
                    className={`
                      max-w-[85%] px-2.5 py-1.5 rounded-lg text-xs
                      ${msg.isMe
                        ? 'bg-blue-600 text-white rounded-br-none'
                        : `${t.otherBubble} rounded-bl-none`
                      }
                    `}
                  >
                    {msg.message}
                  </div>

                  {/* 내 메시지 시간 */}
                  {msg.isMe && (
                    <span className={`text-[10px] ${isDark ? 'text-gray-600' : 'text-gray-400'} mt-0.5`}>
                      {formatTime(msg.timestamp)}
                    </span>
                  )}
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* 빠른 전송 버튼 */}
          <div className={`p-2 border-t ${t.border} flex flex-wrap gap-1.5`}>
            {DEFAULT_QUICK_MESSAGES.map((qm) => (
              <button
                key={qm.id}
                onClick={() => sendQuickMessage(qm)}
                disabled={sending === qm.id}
                className={`
                  px-2 py-1 rounded text-xs font-medium transition-all
                  ${sending === qm.id
                    ? 'bg-green-600 text-white'
                    : t.quickBtn
                  }
                `}
              >
                {sending === qm.id ? '✓' : qm.icon} {qm.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
