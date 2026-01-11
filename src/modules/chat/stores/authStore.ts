import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '../api';

interface User {
  id: string;
  email: string;
  username?: string;
  displayName: string;
  avatarUrl?: string;
  avatarColor?: string;
  isAdmin?: boolean;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  checkAuth: () => Promise<void>;
  setTokens: (accessToken: string, refreshToken: string) => void;
  updateUser: (userData: Partial<User>) => void;
  setUser: (user: User) => void;
  setAuthenticated: (isAuthenticated: boolean) => void;
}

// localStorage 마이그레이션: isAdmin 없으면 강제 재로그인
const migrateAuthStorage = () => {
  try {
    const stored = localStorage.getItem('haniwon-chat-auth');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.state?.user && parsed.state.user.isAdmin === undefined) {
        console.log('[Auth] isAdmin 없음 - localStorage 초기화');
        localStorage.removeItem('haniwon-chat-auth');
      }
    }
  } catch (e) {
    console.error('[Auth] 마이그레이션 오류:', e);
  }
};
migrateAuthStorage();

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.post('/auth/login', { email, password });
          const { user, accessToken, refreshToken } = response.data.data;

          set({
            user: {
              ...user,
              isAdmin: user.username === 'admin' || user.is_admin,
            },
            accessToken,
            refreshToken,
            isAuthenticated: true,
            isLoading: false,
          });
          return true;
        } catch (error: unknown) {
          const message = (error as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Login failed';
          set({ error: message, isLoading: false });
          return false;
        }
      },

      logout: () => {
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
        });
      },

      checkAuth: async () => {
        const { accessToken } = get();
        if (!accessToken) {
          set({ isAuthenticated: false });
          return;
        }

        try {
          const response = await api.get('/auth/me');
          const user = response.data.data.user;
          set({
            user: {
              ...user,
              isAdmin: user.username === 'admin' || user.is_admin,
            },
            isAuthenticated: true,
          });
        } catch {
          // Try to refresh token
          const { refreshToken } = get();
          if (refreshToken) {
            try {
              const refreshResponse = await api.post('/auth/refresh', {
                refreshToken,
              });
              const { user, accessToken: newAccessToken, refreshToken: newRefreshToken } =
                refreshResponse.data.data;
              set({
                user: {
                  ...user,
                  isAdmin: user.username === 'admin' || user.is_admin,
                },
                accessToken: newAccessToken,
                refreshToken: newRefreshToken,
                isAuthenticated: true,
              });
            } catch {
              set({
                user: null,
                accessToken: null,
                refreshToken: null,
                isAuthenticated: false,
              });
            }
          } else {
            set({ isAuthenticated: false });
          }
        }
      },

      setTokens: (accessToken: string, refreshToken: string) => {
        set({ accessToken, refreshToken });
      },

      updateUser: (userData: Partial<User>) => {
        const { user } = get();
        if (user) {
          set({ user: { ...user, ...userData } });
        }
      },

      setUser: (user: User) => {
        set({ user, isAuthenticated: true });
      },

      setAuthenticated: (isAuthenticated: boolean) => {
        set({ isAuthenticated });
      },
    }),
    {
      name: 'haniwon-chat-auth',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

// 포털 세션 토큰으로 자동 로그인 (통합포탈 세션 기반)
export async function autoLoginWithPortalSession(portalSessionToken: string): Promise<boolean> {
  const store = useAuthStore.getState();

  try {
    // 포털 세션 토큰으로 채팅 로그인
    const response = await api.post('/auth/portal-login', {
      portalSessionToken,
    });

    const { user, accessToken } = response.data.data;
    store.setUser({
      id: user.id,
      email: '',
      username: user.username,
      displayName: user.display_name,
      avatarUrl: user.avatar_url,
      avatarColor: user.avatar_color,
      isAdmin: user.is_admin === true,
    });
    store.setTokens(accessToken, accessToken);
    return true;
  } catch {
    return false;
  }
}
