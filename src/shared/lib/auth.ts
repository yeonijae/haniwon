import { query, queryOne, execute, insert, escapeString, getCurrentTimestamp } from './postgres';
import type { PortalUser, AppType } from '../types';

const SESSION_KEY = 'portal_session';

// 세션 토큰 생성
function generateSessionToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// 서버에 세션 생성
async function createServerSession(userId: number): Promise<string> {
  if (!userId) {
    throw new Error('유효하지 않은 사용자 ID입니다.');
  }

  const sessionToken = generateSessionToken();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  // 기존 세션 삭제
  await execute(`DELETE FROM portal_sessions WHERE user_id = ${userId}`);

  // 새 세션 생성
  await execute(`
    INSERT INTO portal_sessions (user_id, session_token, expires_at)
    VALUES (${userId}, ${escapeString(sessionToken)}, ${escapeString(expiresAt)})
  `);

  return sessionToken;
}

// 서버 세션 검증
export async function validateServerSession(sessionToken: string): Promise<boolean> {
  const session = await queryOne<{ user_id: number; expires_at: string }>(`
    SELECT user_id, expires_at FROM portal_sessions
    WHERE session_token = ${escapeString(sessionToken)}
  `);

  if (!session) {
    return false;
  }

  // 만료 확인
  if (new Date(session.expires_at) < new Date()) {
    return false;
  }

  return true;
}

// 서버 세션 무효화
export async function invalidateServerSession(sessionToken: string): Promise<void> {
  await execute(`DELETE FROM portal_sessions WHERE session_token = ${escapeString(sessionToken)}`);
}

// 사용자 ID로 모든 세션 무효화
export async function invalidateAllUserSessions(userId: number): Promise<void> {
  if (!userId) {
    console.warn('invalidateAllUserSessions: userId is undefined');
    return;
  }
  await execute(`DELETE FROM portal_sessions WHERE user_id = ${userId}`);
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

// DB 결과를 PortalUser로 변환 (대소문자 구분 없이 처리)
function toPortalUser(data: any): PortalUser {
  // 대소문자 구분 없이 필드 접근
  const getField = (obj: any, ...keys: string[]) => {
    for (const key of keys) {
      if (obj[key] !== undefined) return obj[key];
      if (obj[key.toLowerCase()] !== undefined) return obj[key.toLowerCase()];
      if (obj[key.toUpperCase()] !== undefined) return obj[key.toUpperCase()];
    }
    return undefined;
  };

  let permissions: AppType[] = [];
  const permData = getField(data, 'permissions');
  if (permData) {
    try {
      permissions = typeof permData === 'string' ? JSON.parse(permData) : permData;
    } catch {
      permissions = [];
    }
  }

  return {
    id: getField(data, 'id', 'ID', 'Id'),
    username: getField(data, 'login_id', 'LOGIN_ID'),
    name: getField(data, 'name', 'NAME'),
    role: getField(data, 'role', 'ROLE'),
    permissions,
    created_at: getField(data, 'created_at', 'CREATED_AT'),
    updated_at: getField(data, 'updated_at', 'UPDATED_AT'),
  };
}

// 로그인
export async function signIn(username: string, password: string): Promise<PortalUser> {
  const data = await queryOne<any>(`
    SELECT * FROM portal_users
    WHERE login_id = ${escapeString(username)}
    AND password_hash = ${escapeString(password)}
    AND is_active = 1
  `);

  if (!data) {
    throw new Error('아이디 또는 비밀번호가 올바르지 않습니다.');
  }

  // ID 컬럼 확인 (SQLite는 대소문자 구분 없이 반환할 수 있음)
  const userId = data.id || data.ID || data.Id;
  if (!userId) {
    console.error('signIn: user data has no id field', data);
    throw new Error('사용자 정보를 불러올 수 없습니다.');
  }

  // 서버 세션 생성
  const sessionToken = await createServerSession(userId);

  const user = toPortalUser(data);

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
    const userId = parsed.id || parsed.ID || parsed.Id;

    // 유효하지 않은 세션 데이터
    if (!userId) {
      console.warn('getCurrentUser: invalid session data (no user id)');
      clearSession();
      return null;
    }

    // 서버 세션 유효성 검증
    if (sessionToken) {
      const isValid = await validateServerSession(sessionToken);
      if (!isValid) {
        clearSession();
        return null;
      }
    }

    // DB에서 최신 정보 확인
    const data = await queryOne<any>(`
      SELECT * FROM portal_users WHERE id = ${userId} AND is_active = 1
    `);

    if (!data) {
      clearSession();
      return null;
    }

    const updatedUser = toPortalUser(data);

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
  const permissionsJson = JSON.stringify(permissions);
  const now = getCurrentTimestamp();

  try {
    await execute(`
      INSERT INTO portal_users (login_id, password_hash, name, role, permissions, is_active, created_at, updated_at)
      VALUES (${escapeString(username)}, ${escapeString(password)}, ${escapeString(name)},
              ${escapeString(role)}, ${escapeString(permissionsJson)}, 1,
              ${escapeString(now)}, ${escapeString(now)})
    `);
  } catch (error: any) {
    if (error.message?.includes('UNIQUE constraint failed')) {
      throw new Error('이미 존재하는 아이디입니다.');
    }
    throw new Error('사용자 생성에 실패했습니다.');
  }
}

// 사용자 삭제 (관리자용)
export async function deleteUser(userId: number): Promise<void> {
  try {
    await execute(`DELETE FROM portal_users WHERE id = ${userId}`);
  } catch {
    throw new Error('사용자 삭제에 실패했습니다.');
  }
}

// 비밀번호 변경
export async function changePassword(userId: number, newPassword: string): Promise<void> {
  const now = getCurrentTimestamp();
  try {
    await execute(`
      UPDATE portal_users
      SET password_hash = ${escapeString(newPassword)}, updated_at = ${escapeString(now)}
      WHERE id = ${userId}
    `);
  } catch {
    throw new Error('비밀번호 변경에 실패했습니다.');
  }
}

// 모든 사용자 조회 (관리자용)
export async function getAllUsers(): Promise<PortalUser[]> {
  const data = await query<any>(`
    SELECT * FROM portal_users WHERE is_active = 1 ORDER BY created_at DESC
  `);
  return data.map(toPortalUser);
}

// 사용자 권한 업데이트
export async function updateUserPermissions(userId: number, permissions: AppType[]): Promise<void> {
  const permissionsJson = JSON.stringify(permissions);
  const now = getCurrentTimestamp();
  try {
    await execute(`
      UPDATE portal_users
      SET permissions = ${escapeString(permissionsJson)}, updated_at = ${escapeString(now)}
      WHERE id = ${userId}
    `);
  } catch {
    throw new Error('권한 업데이트에 실패했습니다.');
  }
}
