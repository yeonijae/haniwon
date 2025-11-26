import { useState, useEffect, useCallback, useRef } from 'react';
import { User } from '../types';
import {
  initAuth,
  redirectToPortal,
  validateServerSession,
  getSessionToken,
  clearSession,
  PortalUser,
} from '../lib/auth';

const SESSION_CHECK_INTERVAL = 30000; // 30초마다 세션 체크

export const useAuth = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [portalUser, setPortalUser] = useState<PortalUser | null>(null);
  const intervalRef = useRef<number | null>(null);

  // 세션 검증 함수
  const checkSession = useCallback(async () => {
    const sessionToken = getSessionToken();
    if (!sessionToken) return;

    const isValid = await validateServerSession(sessionToken);
    if (!isValid) {
      clearSession();
      setCurrentUser(null);
      setPortalUser(null);
      redirectToPortal('세션이 만료되었습니다.');
    }
  }, []);

  useEffect(() => {
    const user = initAuth();

    if (user) {
      setPortalUser(user);
      const roleToAffiliation = (role: string): '의료진' | '데스크' | '치료실' | '탕전실' => {
        switch (role) {
          case 'medical_staff': return '의료진';
          case 'desk': return '데스크';
          case 'treatment': return '치료실';
          case 'decoction': return '탕전실';
          default: return '데스크';
        }
      };
      setCurrentUser({
        id: user.username,
        name: user.name,
        password: '',
        affiliation: roleToAffiliation(user.role),
      });
      setIsLoading(false);

      // 주기적 세션 검증 시작
      intervalRef.current = window.setInterval(checkSession, SESSION_CHECK_INTERVAL);
    } else {
      // initAuth에서 이미 리다이렉트 처리됨
      // 세션이 없는 경우만 여기로 옴
      redirectToPortal('로그인이 필요합니다.');
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [checkSession]);

  return {
    currentUser,
    portalUser,
    isLoading,
  };
};
