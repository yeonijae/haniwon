import { useCallback, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { create } from 'zustand';
import { useAuthStore } from '../stores/authStore';
import { useServerConfigStore } from '../stores/serverConfigStore';

interface SocketState {
  socket: Socket | null;
  isConnected: boolean;
  setSocket: (socket: Socket | null) => void;
  setConnected: (connected: boolean) => void;
}

export const useSocketStore = create<SocketState>((set) => ({
  socket: null,
  isConnected: false,
  setSocket: (socket) => set({ socket }),
  setConnected: (connected) => set({ isConnected: connected }),
}));

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const { setSocket, setConnected } = useSocketStore();
  const accessToken = useAuthStore((state) => state.accessToken);

  const connect = useCallback(() => {
    if (socketRef.current?.connected || !accessToken) return;

    const socketUrl = useServerConfigStore.getState().getSocketUrl();
    console.log('Connecting to socket at:', socketUrl, 'with token:', accessToken?.substring(0, 10) + '...');
    const socket = io(socketUrl, {
      auth: { token: accessToken },
      transports: ['polling', 'websocket'],  // polling first for better dev server support
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      console.log('Socket connected');
      setConnected(true);
      // 대기 중인 이벤트 전송
      flushPendingEmits(socket);
    });

    socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      setConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error.message);
      setConnected(false);
    });

    socketRef.current = socket;
    setSocket(socket);
  }, [accessToken, setSocket, setConnected]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setSocket(null);
      setConnected(false);
    }
  }, [setSocket, setConnected]);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return { connect, disconnect };
}

export function useSocketEvent<T>(event: string, handler: (data: T) => void) {
  const socket = useSocketStore((state) => state.socket);

  useEffect(() => {
    if (!socket) return;

    socket.on(event, handler);

    return () => {
      socket.off(event, handler);
    };
  }, [socket, event, handler]);
}

// 연결 대기 중인 이벤트 큐 (전역)
let pendingEmits: Array<{ event: string; data: unknown }> = [];

// 대기열 플러시 함수
function flushPendingEmits(socket: Socket) {
  if (socket.connected && pendingEmits.length > 0) {
    console.log(`[Socket] Flushing ${pendingEmits.length} pending events`);
    const eventsToFlush = [...pendingEmits];
    pendingEmits = [];
    eventsToFlush.forEach(({ event, data }) => {
      socket.emit(event, data);
      console.log(`[Socket] Flushed: ${event}`);
    });
  }
}

// Socket store에 flush 함수 노출
export function getFlushPendingEmits() {
  return flushPendingEmits;
}

export function useSocketEmit() {
  const socket = useSocketStore((state) => state.socket);

  return useCallback(
    <T>(event: string, data: T) => {
      console.log(`[Socket] useSocketEmit called: ${event}`, data, 'socket:', !!socket, 'connected:', socket?.connected);
      if (socket?.connected) {
        socket.emit(event, data);
        console.log(`[Socket] emit ${event} sent successfully`);
      } else {
        console.log(`[Socket] emit ${event} queued (socket not connected)`);
        pendingEmits.push({ event, data });
      }
    },
    [socket]
  );
}
