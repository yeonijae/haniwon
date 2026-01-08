export interface SidebarChannel {
  id: string;
  type: 'direct' | 'group' | 'topic';
  name: string | null;
  avatar_url: string | null;
  last_message_at: string | null;
  is_pinned: boolean;
  unread_count: number;
  last_read_message_id: string | null;
}

export type SidebarItemType = 'channel' | 'folder' | 'separator';

export interface SidebarItem {
  id: string;
  type: SidebarItemType;
  channelId?: string;       // type === 'channel'
  name?: string;            // type === 'folder'
  isExpanded?: boolean;     // type === 'folder'
  children?: SidebarItem[]; // type === 'folder'
}

export interface SidebarState {
  items: SidebarItem[];
  unorganizedChannels: string[]; // 폴더에 속하지 않은 채널 ID들
}

// 기본 상태 (now stored in DB)
export const DEFAULT_SIDEBAR_STATE: SidebarState = {
  items: [],
  unorganizedChannels: [],
};

// Helper 함수들
export function generateId(): string {
  return `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function createFolder(name: string): SidebarItem {
  return {
    id: generateId(),
    type: 'folder',
    name,
    isExpanded: true,
    children: [],
  };
}

export function createSeparator(): SidebarItem {
  return {
    id: generateId(),
    type: 'separator',
  };
}

export function createChannelItem(channelId: string): SidebarItem {
  return {
    id: generateId(),
    type: 'channel',
    channelId,
  };
}
