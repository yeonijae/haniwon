import { validateServerSession as validateSession, getSessionToken as getToken, clearSession as clear } from '@shared/lib/auth';

export interface PortalUser {
  id: string;
  username: string;
  name: string;
  role: string;
  permissions: string[];
  created_at: string;
  updated_at: string;
}

const SESSION_KEY = 'portal_session';

// 포털로 리다이렉트
export function redirectToPortal(message?: string): void {
  const params = new URLSearchParams();
  if (message) {
    params.set('message', message);
  }
  const queryString = params.toString();
  window.location.href = queryString ? `/?${queryString}` : '/';
}

// URL에서 세션 토큰 추출 및 초기화
export function initAuth(): PortalUser | null {
  // URL에서 토큰 확인
  const urlParams = new URLSearchParams(window.location.search);
  const urlToken = urlParams.get('token');

  if (urlToken) {
    // URL 파라미터에서 토큰이 있으면 저장하고 URL에서 제거
    try {
      const tokenData = JSON.parse(atob(urlToken));
      if (tokenData.sessionToken && tokenData.user) {
        localStorage.setItem(SESSION_KEY, JSON.stringify({
          ...tokenData.user,
          sessionToken: tokenData.sessionToken,
        }));

        // URL에서 토큰 파라미터 제거
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete('token');
        window.history.replaceState({}, '', newUrl.toString());

        return tokenData.user as PortalUser;
      }
    } catch (e) {
      console.error('토큰 파싱 실패:', e);
    }
  }

  // 로컬 스토리지에서 세션 확인
  const sessionData = localStorage.getItem(SESSION_KEY);
  if (sessionData) {
    try {
      const parsed = JSON.parse(sessionData);
      if (parsed.sessionToken) {
        return {
          id: parsed.id,
          username: parsed.username,
          name: parsed.name,
          role: parsed.role,
          permissions: parsed.permissions || [],
          created_at: parsed.created_at,
          updated_at: parsed.updated_at,
        } as PortalUser;
      }
    } catch (e) {
      console.error('세션 파싱 실패:', e);
    }
  }

  return null;
}

// 세션 토큰 가져오기
export function getSessionToken(): string | null {
  return getToken();
}

// 세션 삭제
export function clearSession(): void {
  clear();
}

// 서버 세션 검증
export async function validateServerSession(sessionToken: string): Promise<boolean> {
  return validateSession(sessionToken);
}
