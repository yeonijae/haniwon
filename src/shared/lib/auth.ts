import { supabase } from './supabase';
import type { PortalUser, AppType } from '../types';

const SESSION_KEY = 'portal_session';

// 세션 토큰 생성
function generateSessionToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// 서버에 세션 생성
async function createServerSession(userId: string): Promise<string> {
  const sessionToken = generateSessionToken();

  // 기존 세션 무효화
  await supabase
    .from('portal_sessions')
    .update({ is_valid: false })
    .eq('user_id', userId);

  // 새 세션 생성
  const { error } = await supabase
    .from('portal_sessions')
    .insert({
      user_id: userId,
      session_token: sessionToken,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });

  if (error) {
    console.error('세션 생성 실패:', error);
    throw new Error('세션 생성에 실패했습니다.');
  }

  return sessionToken;
}

// 서버 세션 검증
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

// 서버 세션 무효화
export async function invalidateServerSession(sessionToken: string): Promise<void> {
  await supabase
    .from('portal_sessions')
    .update({ is_valid: false })
    .eq('session_token', sessionToken);
}

// 사용자 ID로 모든 세션 무효화
export async function invalidateAllUserSessions(userId: string): Promise<void> {
  await supabase
    .from('portal_sessions')
    .update({ is_valid: false })
    .eq('user_id', userId);
}

// 현재 세션 토큰 가져오기
export function getSessionToken(): string | null {
  const session = localStorage.getItem(SESSION_KEY);
  if (!session) return null;
  try {
    const parsed = JSON.parse(session);
    return parsed.sessionToken || null;
  } catch {
    return null;
  }
}

// 저장된 세션 정보 가져오기
export function getStoredSession(): (PortalUser & { sessionToken: string }) | null {
  const session = localStorage.getItem(SESSION_KEY);
  if (!session) return null;
  try {
    return JSON.parse(session);
  } catch {
    return null;
  }
}

// 세션 저장
export function saveSession(user: PortalUser, sessionToken: string): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ ...user, sessionToken }));
}

// 세션 삭제
export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

// 로그인
export async function signIn(username: string, password: string): Promise<PortalUser> {
  const { data, error } = await supabase
    .from('portal_users')
    .select('*')
    .eq('username', username)
    .eq('password', password)
    .single();

  if (error || !data) {
    throw new Error('아이디 또는 비밀번호가 올바르지 않습니다.');
  }

  // 서버 세션 생성
  const sessionToken = await createServerSession(data.id);

  const user: PortalUser = {
    id: data.id,
    username: data.username,
    name: data.name,
    role: data.role,
    permissions: data.permissions || [],
    created_at: data.created_at,
    updated_at: data.updated_at,
  };

  // 로컬 세션 저장 (세션 토큰 포함)
  saveSession(user, sessionToken);

  return user;
}

// 로그아웃
export async function signOut(): Promise<void> {
  const sessionToken = getSessionToken();
  if (sessionToken) {
    await invalidateServerSession(sessionToken);
  }
  clearSession();
}

// 현재 세션 확인
export async function getCurrentUser(): Promise<PortalUser | null> {
  const session = localStorage.getItem(SESSION_KEY);
  if (!session) {
    return null;
  }

  try {
    const parsed = JSON.parse(session);
    const sessionToken = parsed.sessionToken;

    // 서버 세션 유효성 검증
    if (sessionToken) {
      const isValid = await validateServerSession(sessionToken);
      if (!isValid) {
        clearSession();
        return null;
      }
    }

    // DB에서 최신 정보 확인
    const { data, error } = await supabase
      .from('portal_users')
      .select('*')
      .eq('id', parsed.id)
      .single();

    if (error || !data) {
      clearSession();
      return null;
    }

    const updatedUser: PortalUser = {
      id: data.id,
      username: data.username,
      name: data.name,
      role: data.role,
      permissions: data.permissions || [],
      created_at: data.created_at,
      updated_at: data.updated_at,
    };

    // 세션 업데이트 (토큰 유지)
    saveSession(updatedUser, sessionToken);

    return updatedUser;
  } catch {
    clearSession();
    return null;
  }
}

// 권한 확인
export function hasPermission(user: PortalUser, app: AppType): boolean {
  if (user.role === 'super_admin') {
    return true;
  }
  return user.permissions.includes(app);
}

// 사용자 생성 (관리자용)
export async function createUser(
  username: string,
  password: string,
  name: string,
  role: PortalUser['role'],
  permissions: AppType[]
): Promise<void> {
  const { error } = await supabase
    .from('portal_users')
    .insert({
      username,
      password,
      name,
      role,
      permissions,
    });

  if (error) {
    if (error.code === '23505') {
      throw new Error('이미 존재하는 아이디입니다.');
    }
    throw new Error('사용자 생성에 실패했습니다.');
  }
}

// 사용자 삭제 (관리자용)
export async function deleteUser(userId: string): Promise<void> {
  const { error } = await supabase
    .from('portal_users')
    .delete()
    .eq('id', userId);

  if (error) {
    throw new Error('사용자 삭제에 실패했습니다.');
  }
}

// 비밀번호 변경
export async function changePassword(userId: string, newPassword: string): Promise<void> {
  const { error } = await supabase
    .from('portal_users')
    .update({ password: newPassword })
    .eq('id', userId);

  if (error) {
    throw new Error('비밀번호 변경에 실패했습니다.');
  }
}
