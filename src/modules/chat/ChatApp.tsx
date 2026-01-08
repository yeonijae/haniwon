import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PortalUser } from '@shared/types';
import { useAuthStore, autoLoginWithPortalUser } from './stores/authStore';
import { useSocket } from './hooks/useSocket';
import MainLayout from './components/layout/MainLayout';
import './chat.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1분
      retry: 1,
    },
  },
});

interface ChatAppProps {
  user: PortalUser;
}

function ChatAppContent({ user }: ChatAppProps) {
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isAuthenticated, isLoading } = useAuthStore();
  const { connect, disconnect } = useSocket();

  // 포털 사용자로 자동 로그인
  useEffect(() => {
    async function init() {
      setIsInitializing(true);
      setError(null);

      try {
        const success = await autoLoginWithPortalUser({
          id: user.id,
          username: user.username,
          name: user.name,
        });

        if (!success) {
          setError('채팅 서버 연결 실패. 서버가 실행 중인지 확인하세요.');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '알 수 없는 오류');
      } finally {
        setIsInitializing(false);
      }
    }

    init();
  }, [user]);

  // 인증 완료 후 소켓 연결
  useEffect(() => {
    if (isAuthenticated) {
      connect();
    }
    return () => {
      disconnect();
    };
  }, [isAuthenticated, connect, disconnect]);

  // 창 닫기
  const handleClose = () => {
    window.close();
  };

  // 로딩 중
  if (isInitializing || isLoading) {
    return (
      <div className="chat-loading-container">
        <div className="chat-loading-card">
          <div className="chat-logo-large">💬</div>
          <h1>한의원 채팅</h1>
          <p>{user.name}님으로 접속 중...</p>
          <div className="loading-spinner-large"></div>
        </div>
      </div>
    );
  }

  // 에러
  if (error) {
    return (
      <div className="chat-loading-container">
        <div className="chat-loading-card">
          <div className="chat-logo-large">💬</div>
          <h1>연결 실패</h1>
          <p className="error-message">{error}</p>
          <p className="error-hint">채팅 서버(포트 3300)가 실행 중인지 확인하세요.</p>
          <div className="button-group">
            <button
              className="btn-retry"
              onClick={() => window.location.reload()}
            >
              다시 시도
            </button>
            <button className="btn-close-error" onClick={handleClose}>
              닫기
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 인증 실패
  if (!isAuthenticated) {
    return (
      <div className="chat-loading-container">
        <div className="chat-loading-card">
          <div className="chat-logo-large">💬</div>
          <h1>인증 실패</h1>
          <p>채팅 서버에 로그인할 수 없습니다.</p>
          <button
            className="btn-retry"
            onClick={() => window.location.reload()}
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  // 메인 채팅 화면
  return <MainLayout />;
}

export default function ChatApp({ user }: ChatAppProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <ChatAppContent user={user} />
    </QueryClientProvider>
  );
}
