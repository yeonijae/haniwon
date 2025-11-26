export type AppType = 'manage' | 'chart' | 'inventory';

export type UserRole = 'super_admin' | 'medical_staff' | 'desk' | 'counseling' | 'treatment' | 'decoction';

export interface PortalUser {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  permissions: AppType[];
  created_at: string;
  updated_at: string;
}

export interface AuthState {
  user: PortalUser | null;
  loading: boolean;
  error: string | null;
}

export interface AppInfo {
  id: AppType;
  name: string;
  description: string;
  path: string;
  icon: string;
  color: string;
}

// 역할 한글명
export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: '최고관리자',
  medical_staff: '의료진',
  desk: '데스크',
  counseling: '상담실',
  treatment: '치료실',
  decoction: '탕전실',
};
