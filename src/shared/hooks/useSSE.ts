/**
 * SSE (Server-Sent Events) 실시간 구독 훅
 * PostgreSQL LISTEN/NOTIFY를 통한 실시간 데이터 동기화
 * 싱글톤 패턴으로 하나의 연결만 유지
 */

import { useEffect, useCallback, useState, useSyncExternalStore } from 'react';

const API_URL = import.meta.env.VITE_POSTGRES_API_URL || 'http://192.168.0.173:3200';

export interface SSEMessage {
  table: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  id: number;
}

// 싱글톤 SSE 매니저
class SSEManager {
  private static instance: SSEManager;
  private eventSource: EventSource | null = null;
  private listeners: Set<(message: SSEMessage) => void> = new Set();
  private connectListeners: Set<() => void> = new Set();
  private disconnectListeners: Set<() => void> = new Set();
  private _isConnected = false;
  private reconnectTimeout: number | null = null;
  private subscriberCount = 0;

  static getInstance(): SSEManager {
    if (!SSEManager.instance) {
      SSEManager.instance = new SSEManager();
    }
    return SSEManager.instance;
  }

  get isConnected(): boolean {
    return this._isConnected;
  }

  subscribe(
    onMessage: (message: SSEMessage) => void,
    onConnect?: () => void,
    onDisconnect?: () => void
  ): () => void {
    this.listeners.add(onMessage);
    if (onConnect) this.connectListeners.add(onConnect);
    if (onDisconnect) this.disconnectListeners.add(onDisconnect);

    this.subscriberCount++;

    // 첫 구독자일 때만 연결
    if (this.subscriberCount === 1) {
      this.connect();
    } else if (this._isConnected && onConnect) {
      // 이미 연결되어 있으면 즉시 콜백 호출
      onConnect();
    }

    // 구독 해제 함수 반환
    return () => {
      this.listeners.delete(onMessage);
      if (onConnect) this.connectListeners.delete(onConnect);
      if (onDisconnect) this.disconnectListeners.delete(onDisconnect);

      this.subscriberCount--;

      // 마지막 구독자가 해제되면 연결 종료
      if (this.subscriberCount === 0) {
        this.disconnect();
      }
    };
  }

  private connect(): void {
    if (this.eventSource) {
      return; // 이미 연결됨
    }

    const url = `${API_URL}/api/subscribe`;
    console.log(`[SSE] Connecting to ${url}...`);

    this.eventSource = new EventSource(url);

    this.eventSource.onopen = () => {
      console.log('[SSE] Connection opened');
      this._isConnected = true;
      this.connectListeners.forEach(cb => cb());
    };

    this.eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'connected') {
          console.log('[SSE] Subscription confirmed:', data);
          return;
        }

        if (data.type === 'error') {
          console.error('[SSE] Server error:', data.message);
          return;
        }

        const message: SSEMessage = {
          table: data.table,
          action: data.action,
          id: data.id,
        };

        console.log('[SSE] Received:', message);
        this.listeners.forEach(cb => cb(message));
      } catch (e) {
        // keepalive 메시지 등 JSON이 아닌 경우 무시
      }
    };

    this.eventSource.onerror = () => {
      console.error('[SSE] Connection error');
      this._isConnected = false;
      this.disconnectListeners.forEach(cb => cb());

      // 재연결 시도
      if (this.eventSource?.readyState === EventSource.CLOSED) {
        this.eventSource = null;

        if (this.subscriberCount > 0) {
          console.log('[SSE] Will reconnect in 3s...');
          this.reconnectTimeout = window.setTimeout(() => {
            this.connect();
          }, 3000);
        }
      }
    };
  }

  private disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
      this._isConnected = false;
      console.log('[SSE] Disconnected');
    }
  }

  // 강제 재연결
  reconnect(): void {
    this.disconnect();
    if (this.subscriberCount > 0) {
      this.connect();
    }
  }
}

// 싱글톤 인스턴스
const sseManager = SSEManager.getInstance();

export interface UseSSEOptions {
  /** 연결 성공 시 콜백 */
  onConnect?: () => void;
  /** 메시지 수신 시 콜백 */
  onMessage?: (message: SSEMessage) => void;
  /** 연결 끊김 시 콜백 */
  onDisconnect?: () => void;
  /** 활성화 여부 (기본: true) */
  enabled?: boolean;
}

export const useSSE = (options: UseSSEOptions = {}) => {
  const {
    onConnect,
    onMessage,
    onDisconnect,
    enabled = true,
  } = options;

  const [isConnected, setIsConnected] = useState(sseManager.isConnected);
  const [lastMessage, setLastMessage] = useState<SSEMessage | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const handleMessage = (message: SSEMessage) => {
      setLastMessage(message);
      onMessage?.(message);
    };

    const handleConnect = () => {
      setIsConnected(true);
      onConnect?.();
    };

    const handleDisconnect = () => {
      setIsConnected(false);
      onDisconnect?.();
    };

    const unsubscribe = sseManager.subscribe(
      handleMessage,
      handleConnect,
      handleDisconnect
    );

    // 현재 연결 상태 동기화
    setIsConnected(sseManager.isConnected);

    return unsubscribe;
  }, [enabled, onConnect, onMessage, onDisconnect]);

  const reconnect = useCallback(() => {
    sseManager.reconnect();
  }, []);

  return {
    isConnected,
    lastMessage,
    reconnect,
  };
};

/**
 * 여러 테이블 구독을 위한 훅
 */
export const useSSEMultiple = (
  handlers: Record<string, (message: SSEMessage) => void>,
  options: Omit<UseSSEOptions, 'onMessage'> = {}
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
