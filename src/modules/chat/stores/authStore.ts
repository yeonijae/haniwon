import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '../api';

interface User {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  avatarColor?: string;
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
}

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
            user,
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
          set({
            user: response.data.data.user,
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
                user,
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

// 포털 사용자로 자동 로그인
export async function autoLoginWithPortalUser(portalUser: { id: string; username: string; name: string }): Promise<boolean> {
  const store = useAuthStore.getState();
  const email = `${portalUser.username}@haniwon.local`;
  const password = `haniwon_${portalUser.id}_chat`;

  // 먼저 로그인 시도
  const success = await store.login(email, password);
  if (success) return true;

  // 로그인 실패 시 회원가입 후 다시 로그인
  try {
    await api.post('/auth/register', {
      email,
      password,
      displayName: portalUser.name,
    });
    return await store.login(email, password);
  } catch {
    return false;
  }
}
