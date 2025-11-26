import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import type { PortalUser } from '../types';
import {
  getCurrentUser,
  signOut,
  validateServerSession,
  getSessionToken,
  clearSession,
} from '../lib/auth';

const SESSION_CHECK_INTERVAL = 30000; // 30초마다 세션 체크

interface AuthContextType {
  user: PortalUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PortalUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const intervalRef = useRef<number | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  // 세션 검증 함수
  const checkSession = useCallback(async () => {
    const sessionToken = getSessionToken();
    if (!sessionToken) return;

    const isValid = await validateServerSession(sessionToken);
    if (!isValid) {
      clearSession();
      setUser(null);
      navigate('/', { state: { message: '세션이 만료되었습니다.' } });
    }
  }, [navigate]);

  // 로그아웃 함수
  const logout = useCallback(async () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    await signOut();
    setUser(null);
    navigate('/');
  }, [navigate]);

  useEffect(() => {
    const initAuth = async () => {
      const currentUser = await getCurrentUser();

      if (currentUser) {
        setUser(currentUser);
        // 주기적 세션 검증 시작
        intervalRef.current = window.setInterval(checkSession, SESSION_CHECK_INTERVAL);
      } else if (location.pathname !== '/') {
        // 포털(루트)이 아닌 다른 페이지에서 인증되지 않은 경우 포털로 리다이렉트
        navigate('/', { state: { message: '로그인이 필요합니다.' } });
      }

      setIsLoading(false);
    };

    initAuth();

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [checkSession, navigate, location.pathname]);

  return (
    <AuthContext.Provider value={{ user, isLoading, isAuthenticated: !!user, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
