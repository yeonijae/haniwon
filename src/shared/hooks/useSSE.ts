/**
 * SSE (Server-Sent Events) 실시간 구독 훅
 * PostgreSQL LISTEN/NOTIFY를 통한 실시간 데이터 동기화
 */

import { useEffect, useRef, useCallback, useState } from 'react';

const API_URL = import.meta.env.VITE_POSTGRES_API_URL || 'http://192.168.0.173:3200';

export interface SSEMessage {
  table: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  id: number;
}

export interface UseSSEOptions {
  /** 구독할 테이블 이름 (없으면 전체 구독) */
  table?: string;
  /** 연결 성공 시 콜백 */
  onConnect?: () => void;
  /** 메시지 수신 시 콜백 */
  onMessage?: (message: SSEMessage) => void;
  /** 에러 발생 시 콜백 */
  onError?: (error: Event) => void;
  /** 연결 끊김 시 콜백 */
  onDisconnect?: () => void;
  /** 자동 재연결 활성화 (기본: true) */
  autoReconnect?: boolean;
  /** 재연결 딜레이 (ms, 기본: 3000) */
  reconnectDelay?: number;
  /** 활성화 여부 (기본: true) */
  enabled?: boolean;
}

export const useSSE = (options: UseSSEOptions = {}) => {
  const {
    table,
    onConnect,
    onMessage,
    onError,
    onDisconnect,
    autoReconnect = true,
    reconnectDelay = 3000,
    enabled = true,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<SSEMessage | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);

  const connect = useCallback(() => {
    if (!enabled) return;

    // 기존 연결 정리
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const url = table
      ? `${API_URL}/api/subscribe/${table}`
      : `${API_URL}/api/subscribe`;

    console.log(`[SSE] Connecting to ${url}...`);

    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log('[SSE] Connection opened');
      setIsConnected(true);
      onConnect?.();
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // 연결 확인 메시지
        if (data.type === 'connected') {
          console.log('[SSE] Subscription confirmed:', data);
          return;
        }

        // 에러 메시지
        if (data.type === 'error') {
          console.error('[SSE] Server error:', data.message);
          return;
        }

        // 테이블 변경 메시지
        const message: SSEMessage = {
          table: data.table,
          action: data.action,
          id: data.id,
        };

        console.log('[SSE] Received:', message);
        setLastMessage(message);
        onMessage?.(message);
      } catch (e) {
        console.error('[SSE] Failed to parse message:', event.data);
      }
    };

    eventSource.onerror = (event) => {
      console.error('[SSE] Connection error');
      setIsConnected(false);
      onError?.(event);
      onDisconnect?.();

      // EventSource가 자동으로 재연결을 시도하지만,
      // 서버가 완전히 다운된 경우를 위해 수동 재연결도 설정
      if (autoReconnect && eventSource.readyState === EventSource.CLOSED) {
        console.log(`[SSE] Will reconnect in ${reconnectDelay}ms...`);
        reconnectTimeoutRef.current = window.setTimeout(() => {
          connect();
        }, reconnectDelay);
      }
    };
  }, [table, enabled, onConnect, onMessage, onError, onDisconnect, autoReconnect, reconnectDelay]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setIsConnected(false);
      console.log('[SSE] Disconnected');
    }
  }, []);

  // 연결 관리
  useEffect(() => {
    if (enabled) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [enabled, connect, disconnect]);

  return {
    isConnected,
    lastMessage,
    reconnect: connect,
    disconnect,
  };
};

/**
 * 여러 테이블 구독을 위한 훅
 * 변경된 테이블에 따라 다른 콜백 실행
 */
export const useSSEMultiple = (
  handlers: Record<string, (message: SSEMessage) => void>,
  options: Omit<UseSSEOptions, 'table' | 'onMessage'> = {}
) => {
  const handleMessage = useCallback((message: SSEMessage) => {
    const handler = handlers[message.table];
    if (handler) {
      handler(message);
    }
  }, [handlers]);

  return useSSE({
    ...options,
    onMessage: handleMessage,
  });
};

export default useSSE;
