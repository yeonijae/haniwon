import axios from 'axios';
import { useAuthStore } from './stores/authStore';
import { useServerConfigStore } from './stores/serverConfigStore';

// Dynamic API URL getter
const getApiUrl = () => useServerConfigStore.getState().getApiUrl();

export const api = axios.create({
  headers: {
    'Content-Type': 'application/json',
  },
});

// Set baseURL dynamically on each request
api.interceptors.request.use((config) => {
  config.baseURL = getApiUrl();
  return config;
});

// Request interceptor to add auth token
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor to handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const refreshToken = useAuthStore.getState().refreshToken;
      if (refreshToken) {
        try {
          const response = await axios.post(`${getApiUrl()}/auth/refresh`, {
            refreshToken,
          });

          const { accessToken, refreshToken: newRefreshToken } = response.data.data;
          useAuthStore.getState().setTokens(accessToken, newRefreshToken);

          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return api(originalRequest);
        } catch {
          useAuthStore.getState().logout();
        }
      } else {
        useAuthStore.getState().logout();
      }
    }

    return Promise.reject(error);
  }
);

// Channel Layout API
export interface ChannelLayoutData {
  items: Array<{
    id: string;
    type: 'channel' | 'folder' | 'separator';
    channelId?: string;
    name?: string;
    isExpanded?: boolean;
    children?: Array<{
      id: string;
      type: 'channel' | 'folder' | 'separator';
      channelId?: string;
    }>;
  }>;
  hiddenChannels: string[];
  pinnedChannels: string[];
  gridSize: number;
  layoutMode: string;
  zoom?: number; // 50 ~ 150 (%)
  fontSize?: number; // 8 ~ 20 (px)
}

export const channelLayoutApi = {
  async get(): Promise<ChannelLayoutData> {
    const response = await api.get('/users/me/channel-layout');
    return response.data.data;
  },

  async save(layout: ChannelLayoutData): Promise<ChannelLayoutData> {
    const response = await api.put('/users/me/channel-layout', layout);
    return response.data.data;
  },
};
