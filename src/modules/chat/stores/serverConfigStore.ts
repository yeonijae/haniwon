import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ServerConfig {
  serverUrl: string;
  serverPort: string;
}

interface ServerConfigState extends ServerConfig {
  setServerConfig: (config: Partial<ServerConfig>) => void;
  getApiUrl: () => string;
  getSocketUrl: () => string;
  resetToDefault: () => void;
}

const DEFAULT_CONFIG: ServerConfig = {
  serverUrl: '192.168.0.173',  // 프로덕션 서버
  serverPort: '3300',
};

export const useServerConfigStore = create<ServerConfigState>()(
  persist(
    (set, get) => ({
      ...DEFAULT_CONFIG,

      setServerConfig: (config) => set((state) => ({ ...state, ...config })),

      getApiUrl: () => {
        const { serverUrl, serverPort } = get();
        return `http://${serverUrl}:${serverPort}/api/v1`;
      },

      getSocketUrl: () => {
        const { serverUrl, serverPort } = get();
        return `http://${serverUrl}:${serverPort}`;
      },

      resetToDefault: () => set(DEFAULT_CONFIG),
    }),
    {
      name: 'haniwon-chat-server-config',
    }
  )
);

// Helper function to convert relative URLs to absolute URLs
export function getAbsoluteUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('/api/') || url.startsWith('/uploads/')) {
    const { serverUrl, serverPort } = useServerConfigStore.getState();
    return `http://${serverUrl}:${serverPort}${url}`;
  }
  return url;
}
