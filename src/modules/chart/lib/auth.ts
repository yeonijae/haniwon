/**
 * 통합 포털 인증 유틸리티 - URL 토큰 방식 + 서버 세션 검증
 */

import { supabase } from './supabaseClient';

const PORTAL_URL = import.meta.env.VITE_PORTAL_URL || 'http://localhost:5170';
const SESSION_KEY = 'patient_chart_session';

export type AppType = 'hani_man' | 'patient_chart' | 'inventory';

export interface PortalUser {
  id: string;
  username: string;
  name: string;
  role: 'admin' | 'doctor' | 'staff';
  permissions: AppType[];
  timestamp?: number;
  sessionToken?: string;
}

/**
 * URL에서 토큰 추출
 */
export function getTokenFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get('portal_token');
}

/**
 * URL에서 토큰 파라미터 제거
 */
export function removeTokenFromUrl(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete('portal_token');
  window.history.replaceState({}, '', url.toString());
}

/**
 * 토큰 디코딩
 */
export function decodeToken(token: string): PortalUser | null {
  try {
    const decoded = decodeURIComponent(atob(token));
    return JSON.parse(decoded) as PortalUser;
  } catch {
    return null;
  }
}

/**
 * 앱 접근 권한 확인 (진료관리 = patient_chart)
 */
export function hasAppAccess(user: PortalUser): boolean {
  if (user.role === 'admin') {
    return true;
  }
  return user.permissions.includes('patient_chart');
}

/**
 * 포털로 리다이렉트
 */
export function redirectToPortal(message?: string): void {
  const url = new URL(PORTAL_URL);
  if (message) {
    url.searchParams.set('error', message);
  }
  window.location.href = url.toString();
}

/**
 * 세션 저장 (앱 자체 localStorage)
 */
export function saveSession(user: PortalUser): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

/**
 * 세션 가져오기
 */
export function getStoredSession(): PortalUser | null {
  try {
    const session = localStorage.getItem(SESSION_KEY);
    if (session) {
      const user = JSON.parse(session) as PortalUser;
      // 24시간 후 만료
      if (user.timestamp && Date.now() - user.timestamp > 24 * 60 * 60 * 1000) {
        localStorage.removeItem(SESSION_KEY);
        return null;
      }
      return user;
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * 세션 삭제
 */
export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

/**
 * 서버 세션 검증
 */
export async function validateServerSession(sessionToken: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('portal_sessions')
    .select('*')
    .eq('session_token', sessionToken)
    .eq('is_valid', true)
    .single();

  if (error || !data) {
    return false;
  }

  // 만료 확인
  if (new Date(data.expires_at) < new Date()) {
    return false;
  }

  return true;
}

/**
 * 현재 저장된 세션 토큰 가져오기
 */
export function getSessionToken(): string | null {
  const session = getStoredSession();
  return session?.sessionToken || null;
}

/**
 * 로그아웃 (로컬 세션만 삭제하고 포털로 이동)
 */
export function logout(): void {
  clearSession();
  redirectToPortal();
}

// 초기화 함수 - URL 토큰 확인 및 저장
export function initAuth(): PortalUser | null {
  // 1. URL에서 토큰 확인
  const urlToken = getTokenFromUrl();

  if (urlToken) {
    const user = decodeToken(urlToken);
    if (user && hasAppAccess(user)) {
      saveSession(user);
      removeTokenFromUrl();
      return user;
    } else if (user) {
      redirectToPortal('진료관리 시스템에 접근 권한이 없습니다.');
      return null;
    } else {
      redirectToPortal('인증 정보가 올바르지 않습니다.');
      return null;
    }
  }

  // 2. 저장된 세션 확인
  const storedUser = getStoredSession();
  if (storedUser && hasAppAccess(storedUser)) {
    return storedUser;
  }

  // 3. 인증 없음
  return null;
}
