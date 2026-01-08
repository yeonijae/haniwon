import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  DragOverlay,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { api, channelLayoutApi, ChannelLayoutData } from '../../api';
import { useAuthStore } from '../../stores/authStore';
import { getAbsoluteUrl } from '../../stores/serverConfigStore';
import { useSocketEvent } from '../../hooks/useSocket';
import NewDMModal from '../modals/NewDMModal';
import NewChannelModal from '../modals/NewChannelModal';
import InviteMemberModal from '../modals/InviteMemberModal';
import ProfileSettingsModal from '../modals/ProfileSettingsModal';
import ContextMenu, { ContextMenuItem } from '../common/ContextMenu';
import SidebarChannelItem from '../sidebar/SidebarChannelItem';
import SidebarFolder from '../sidebar/SidebarFolder';
import SidebarSeparator from '../sidebar/SidebarSeparator';
import SearchModal from '../modals/SearchModal';
import {
  SidebarItem,
  SidebarChannel,
  generateId,
  createFolder,
  createSeparator,
  createChannelItem,
} from '../../types/sidebar';
import { notificationService } from '../../utils/notification';

const MIN_WIDTH = 180;
const MAX_WIDTH = 400;
const DEFAULT_WIDTH = 256;
const WIDTH_STORAGE_KEY = 'hanichat-sidebar-width';

interface SidebarProps {
  selectedChannelId: string | null;
  pinnedChannels: string[];
  onSelectChannel: (channelId: string, messageId?: string) => void;
  onPinChannel: (channelId: string) => void;
  onUnpinChannel: (channelId: string) => void;
  onSettingsClick?: () => void;
}

export default function Sidebar({
  selectedChannelId,
  pinnedChannels,
  onSelectChannel,
  onPinChannel,
  onUnpinChannel,
  onSettingsClick,
}: SidebarProps) {
  const { user, logout } = useAuthStore();
  const queryClient = useQueryClient();
  const [showNewDM, setShowNewDM] = useState(false);
  const [showNewChannel, setShowNewChannel] = useState(false);
  const [showProfileSettings, setShowProfileSettings] = useState(false);
  const [inviteChannelId, setInviteChannelId] = useState<string | null>(null);
  const [sidebarItems, setSidebarItems] = useState<SidebarItem[]>([]);
  const [hiddenChannels, setHiddenChannels] = useState<string[]>([]);
  const [isLayoutLoaded, setIsLayoutLoaded] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    type: 'channel' | 'folder' | 'separator' | 'empty';
    itemId?: string;
    channelId?: string;
  } | null>(null);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState('');
  const [editingChannelId, setEditingChannelId] = useState<string | null>(null);
  const [editingChannelName, setEditingChannelName] = useState('');
  const [showHiddenChannels, setShowHiddenChannels] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);

  // Fetch channel layout from DB
  const { data: layoutData } = useQuery<ChannelLayoutData>({
    queryKey: ['channelLayout'],
    queryFn: channelLayoutApi.get,
    staleTime: Infinity, // Don't refetch automatically
  });

  // Save layout mutation with debounce
  const saveLayoutMutation = useMutation({
    mutationFn: (data: Partial<ChannelLayoutData>) => {
      // Merge with existing data from cache
      const currentData = queryClient.getQueryData<ChannelLayoutData>(['channelLayout']);
      const mergedData: ChannelLayoutData = {
        items: data.items ?? currentData?.items ?? [],
        hiddenChannels: data.hiddenChannels ?? currentData?.hiddenChannels ?? [],
        pinnedChannels: currentData?.pinnedChannels ?? [],
        gridSize: currentData?.gridSize ?? 4,
        layoutMode: currentData?.layoutMode ?? 'grid',
      };
      return channelLayoutApi.save(mergedData);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['channelLayout'], data);
    },
    onError: (error) => console.error('Failed to save layout:', error),
  });

  // Load layout from DB on initial fetch
  useEffect(() => {
    if (layoutData && !isLayoutLoaded) {
      setSidebarItems(layoutData.items as SidebarItem[] || []);
      setHiddenChannels(layoutData.hiddenChannels || []);
      setIsLayoutLoaded(true);
    }
  }, [layoutData, isLayoutLoaded]);

  // Resize state
  const [width, setWidth] = useState(() => {
    const saved = localStorage.getItem(WIDTH_STORAGE_KEY);
    return saved ? Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, Number(saved))) : DEFAULT_WIDTH;
  });
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  // Fetch channels
  const { data: channels = [] } = useQuery<SidebarChannel[]>({
    queryKey: ['channels'],
    queryFn: async () => {
      const response = await api.get('/channels');
      return response.data.data;
    },
  });

  // Channel map for quick lookup
  const channelMap = useMemo(() => {
    const map = new Map<string, SidebarChannel>();
    channels.forEach((c) => map.set(c.id, c));
    return map;
  }, [channels]);

  // Handle user profile updates - refresh channels to update DM names
  const handleProfileUpdate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['channels'] });
  }, [queryClient]);
  useSocketEvent('user:profile_update', handleProfileUpdate);

  // Handle new messages - refresh channels to update unread count and show notification
  const handleNewMessage = useCallback((message: {
    channel_id: string;
    content: string;
    sender: { id: string; display_name: string };
  }) => {
    queryClient.invalidateQueries({ queryKey: ['channels'] });

    // Show desktop notification if message is from another user
    if (message.sender.id !== user?.id) {
      const channel = channelMap.get(message.channel_id);
      const channelName = channel?.name || (channel?.type === 'direct' ? message.sender.display_name : '채널');

      // Strip HTML tags from content
      const plainContent = message.content.replace(/<[^>]*>/g, '').substring(0, 100);

      notificationService.show({
        title: channelName,
        body: `${message.sender.display_name}: ${plainContent}`,
        onClick: () => {
          onSelectChannel(message.channel_id);
        },
      });
    }
  }, [queryClient, user?.id, channelMap, onSelectChannel]);
  useSocketEvent('message:new', handleNewMessage);

  // Sync channels with sidebar items
  useEffect(() => {
    if (channels.length === 0 || !isLayoutLoaded) return;

    setSidebarItems((prevItems) => {
      // Get all channel IDs currently in sidebar (including hidden)
      const existingChannelIds = new Set<string>(hiddenChannels);
      const collectChannelIds = (items: SidebarItem[]) => {
        items.forEach((item) => {
          if (item.type === 'channel' && item.channelId) {
            existingChannelIds.add(item.channelId);
          } else if (item.type === 'folder' && item.children) {
            collectChannelIds(item.children);
          }
        });
      };
      collectChannelIds(prevItems);

      // Find new channels not in sidebar
      const newChannels = channels.filter((c) => !existingChannelIds.has(c.id));

      if (newChannels.length === 0) return prevItems;

      // Add new channels to the end
      const newItems = newChannels.map((c) => createChannelItem(c.id));
      return [...prevItems, ...newItems];
    });
  }, [channels, isLayoutLoaded, hiddenChannels]);

  // Debounced save to DB
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isLayoutLoaded) return;

    // Clear previous timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Debounce save (500ms)
    saveTimeoutRef.current = setTimeout(() => {
      saveLayoutMutation.mutate({
        items: sidebarItems,
        hiddenChannels,
      });
    }, 500);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [sidebarItems, hiddenChannels, isLayoutLoaded]);

  // Save width
  useEffect(() => {
    localStorage.setItem(WIDTH_STORAGE_KEY, String(width));
  }, [width]);

  // Resize handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return;
    setWidth(Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, e.clientX)));
  }, [isResizing]);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, handleMouseMove, handleMouseUp]);

  // DnD handlers
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const overId = over.id as string;

    // Check if dropping over a folder
    if (overId.startsWith('folder-drop-')) {
      // Handle dropping into folder
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Check if dropping into a folder header
    if (overId.startsWith('folder-drop-')) {
      const folderId = overId.replace('folder-drop-', '');
      moveItemToFolder(activeId, folderId);
      return;
    }

    // Check if both items are in the same folder (for folder internal reorder)
    const activeFolder = findParentFolder(sidebarItems, activeId);
    const overFolder = findParentFolder(sidebarItems, overId);

    if (activeFolder && overFolder && activeFolder.id === overFolder.id) {
      // Reorder within the same folder
      setSidebarItems((items) => {
        return items.map((item) => {
          if (item.id === activeFolder.id && item.type === 'folder' && item.children) {
            const oldIndex = item.children.findIndex((c) => c.id === activeId);
            const newIndex = item.children.findIndex((c) => c.id === overId);
            if (oldIndex === -1 || newIndex === -1) return item;
            return {
              ...item,
              children: arrayMove(item.children, oldIndex, newIndex),
            };
          }
          return item;
        });
      });
      return;
    }

    // Regular reorder at root level
    setSidebarItems((items) => {
      const oldIndex = items.findIndex((i) => i.id === activeId);
      const newIndex = items.findIndex((i) => i.id === overId);

      if (oldIndex === -1) {
        // Item might be inside a folder, need to remove it first
        const newItems = removeItemFromAllFolders(items, activeId);
        const insertIndex = newItems.findIndex((i) => i.id === overId);
        if (insertIndex === -1) return items;

        // Find the dragged item
        const draggedItem = findItemById(items, activeId);
        if (!draggedItem) return items;

        newItems.splice(insertIndex, 0, draggedItem);
        return newItems;
      }

      if (newIndex === -1) return items;
      return arrayMove(items, oldIndex, newIndex);
    });
  };

  // Find the parent folder of an item
  const findParentFolder = (items: SidebarItem[], itemId: string): SidebarItem | null => {
    for (const item of items) {
      if (item.type === 'folder' && item.children) {
        if (item.children.some((c) => c.id === itemId)) {
          return item;
        }
      }
    }
    return null;
  };

  // Helper functions
  const findItemById = (items: SidebarItem[], id: string): SidebarItem | null => {
    for (const item of items) {
      if (item.id === id) return item;
      if (item.type === 'folder' && item.children) {
        const found = findItemById(item.children, id);
        if (found) return found;
      }
    }
    return null;
  };

  const removeItemFromAllFolders = (items: SidebarItem[], itemId: string): SidebarItem[] => {
    return items.map((item) => {
      if (item.type === 'folder' && item.children) {
        return {
          ...item,
          children: item.children.filter((c) => c.id !== itemId),
        };
      }
      return item;
    }).filter((item) => item.id !== itemId);
  };

  const moveItemToFolder = (itemId: string, folderId: string) => {
    setSidebarItems((items) => {
      const draggedItem = findItemById(items, itemId);
      if (!draggedItem || draggedItem.type === 'folder') return items;

      // Remove from current location
      let newItems = removeItemFromAllFolders(items, itemId);

      // Add to folder
      newItems = newItems.map((item) => {
        if (item.id === folderId && item.type === 'folder') {
          return {
            ...item,
            children: [...(item.children || []), draggedItem],
          };
        }
        return item;
      });

      return newItems;
    });
  };

  const toggleFolder = (folderId: string) => {
    setSidebarItems((items) =>
      items.map((item) =>
        item.id === folderId && item.type === 'folder'
          ? { ...item, isExpanded: !item.isExpanded }
          : item
      )
    );
  };

  // Context menu handlers
  const handleContextMenu = (
    e: React.MouseEvent,
    type: 'channel' | 'folder' | 'separator' | 'empty',
    itemId?: string,
    channelId?: string
  ) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, type, itemId, channelId });
  };

  const handleAddFolder = () => {
    const newFolder = createFolder('새 폴더');
    setSidebarItems((items) => [...items, newFolder]);
    setEditingFolderId(newFolder.id);
    setEditingFolderName('새 폴더');
    setContextMenu(null);
  };

  const handleAddSeparator = () => {
    const insertIndex = contextMenu?.itemId
      ? sidebarItems.findIndex((i) => i.id === contextMenu.itemId) + 1
      : sidebarItems.length;

    setSidebarItems((items) => {
      const newItems = [...items];
      newItems.splice(insertIndex, 0, createSeparator());
      return newItems;
    });
    setContextMenu(null);
  };

  const handleDeleteItem = (itemId: string) => {
    setSidebarItems((items) => {
      const item = findItemById(items, itemId);
      if (item?.type === 'folder' && item.children && item.children.length > 0) {
        // Move children out of folder before deleting
        const folderIndex = items.findIndex((i) => i.id === itemId);
        const newItems = items.filter((i) => i.id !== itemId);
        newItems.splice(folderIndex, 0, ...item.children);
        return newItems;
      }
      return removeItemFromAllFolders(items, itemId);
    });
    setContextMenu(null);
  };

  const handleRenameFolder = (folderId: string, newName: string) => {
    setSidebarItems((items) =>
      items.map((item) =>
        item.id === folderId && item.type === 'folder'
          ? { ...item, name: newName }
          : item
      )
    );
    setEditingFolderId(null);
  };

  const handleRenameChannel = async (channelId: string, newName: string) => {
    if (!newName.trim()) {
      setEditingChannelId(null);
      return;
    }
    try {
      await api.patch(`/channels/${channelId}`, { name: newName.trim() });
      queryClient.invalidateQueries({ queryKey: ['channels'] });
    } catch (error) {
      console.error('Failed to rename channel:', error);
    }
    setEditingChannelId(null);
  };

  const handleHideChannel = (channelId: string) => {
    // Remove from sidebar items
    setSidebarItems((items) => {
      const removeChannel = (itemList: SidebarItem[]): SidebarItem[] => {
        return itemList
          .filter((item) => !(item.type === 'channel' && item.channelId === channelId))
          .map((item) => {
            if (item.type === 'folder' && item.children) {
              return { ...item, children: removeChannel(item.children) };
            }
            return item;
          });
      };
      return removeChannel(items);
    });
    // Add to hidden list
    setHiddenChannels((prev) => [...prev, channelId]);
    setContextMenu(null);
  };

  const handleRestoreChannel = (channelId: string) => {
    // Remove from hidden list
    setHiddenChannels((prev) => prev.filter((id) => id !== channelId));
    // Add back to sidebar items
    setSidebarItems((items) => [...items, createChannelItem(channelId)]);
    setContextMenu(null);
  };

  const getContextMenuItems = (): ContextMenuItem[] => {
    if (!contextMenu) return [];

    const baseItems: ContextMenuItem[] = [
      { label: '폴더 만들기', icon: '📁', onClick: handleAddFolder },
      { label: '분리자 추가', icon: '──', onClick: handleAddSeparator },
    ];

    if (contextMenu.type === 'channel' && contextMenu.channelId) {
      const isPinned = pinnedChannels.includes(contextMenu.channelId);
      const channel = channelMap.get(contextMenu.channelId);
      const isDirectMessage = channel?.type === 'direct';

      const channelItems: ContextMenuItem[] = [
        ...baseItems,
        { type: 'separator' },
        { label: '이름 변경', icon: '✏️', onClick: () => {
          setEditingChannelId(contextMenu.channelId!);
          setEditingChannelName(channel?.name || '');
          setContextMenu(null);
        }},
        isPinned
          ? { label: '고정 해제', icon: '📌', onClick: () => { onUnpinChannel(contextMenu.channelId!); setContextMenu(null); } }
          : { label: '메인에 고정', icon: '📌', onClick: () => { onPinChannel(contextMenu.channelId!); setContextMenu(null); } },
      ];

      // 그룹/토픽 채널에만 멤버 초대 옵션 추가
      if (!isDirectMessage) {
        channelItems.push({
          label: '멤버 초대',
          icon: '👥',
          onClick: () => {
            setInviteChannelId(contextMenu.channelId!);
            setContextMenu(null);
          },
        });
      }

      channelItems.push(
        { type: 'separator' },
        { label: '목록에서 숨기기', icon: '👁️', onClick: () => handleHideChannel(contextMenu.channelId!), danger: true }
      );

      return channelItems;
    }

    if (contextMenu.type === 'folder' && contextMenu.itemId) {
      return [
        ...baseItems,
        { type: 'separator' },
        { label: '폴더 이름 변경', icon: '✏️', onClick: () => {
          const folder = findItemById(sidebarItems, contextMenu.itemId!);
          if (folder?.type === 'folder') {
            setEditingFolderId(contextMenu.itemId!);
            setEditingFolderName(folder.name || '');
          }
          setContextMenu(null);
        }},
        { label: '폴더 삭제', icon: '🗑️', onClick: () => handleDeleteItem(contextMenu.itemId!), danger: true },
      ];
    }

    if (contextMenu.type === 'separator' && contextMenu.itemId) {
      return [
        ...baseItems,
        { type: 'separator' },
        { label: '분리자 삭제', icon: '🗑️', onClick: () => handleDeleteItem(contextMenu.itemId!), danger: true },
      ];
    }

    return baseItems;
  };

  // Get all sortable IDs
  const sortableIds = useMemo(() => {
    const ids: string[] = [];
    const collectIds = (items: SidebarItem[]) => {
      items.forEach((item) => {
        ids.push(item.id);
        if (item.type === 'folder' && item.children && item.isExpanded) {
          collectIds(item.children);
        }
      });
    };
    collectIds(sidebarItems);
    return ids;
  }, [sidebarItems]);

  const handleChannelCreated = (channelId: string) => {
    onSelectChannel(channelId);
  };

  // Keyboard shortcut for search (Ctrl+F)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setShowSearchModal(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <>
      <aside
        ref={sidebarRef}
        className="bg-gray-800 text-white flex flex-col flex-shrink-0 relative"
        style={{ width: `${width}px`, minWidth: `${MIN_WIDTH}px`, maxWidth: `${MAX_WIDTH}px` }}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-700">
          <h1 className="text-xl font-bold">HaniChat</h1>
        </div>

        {/* Search Bar */}
        <div className="px-3 py-2 border-b border-gray-700">
          <button
            onClick={() => setShowSearchModal(true)}
            className="w-full flex items-center gap-2 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-gray-400 text-sm text-left"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span>검색</span>
            <span className="ml-auto text-xs text-gray-500">Ctrl+F</span>
          </button>
        </div>

        {/* Channel lists */}
        <div
          className="flex-1 overflow-y-auto p-2"
          onContextMenu={(e) => handleContextMenu(e, 'empty')}
        >
          <div className="flex items-center justify-between px-2 py-1 mb-2">
            <h2 className="text-xs font-semibold text-gray-400 uppercase">채널</h2>
            <button
              onClick={() => setShowNewChannel(true)}
              className="text-gray-400 hover:text-white text-lg leading-none"
              title="새 채널 만들기"
            >
              +
            </button>
          </div>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
              {sidebarItems.map((item) => {
                if (item.type === 'separator') {
                  return (
                    <SidebarSeparator
                      key={item.id}
                      id={item.id}
                      onContextMenu={(e) => handleContextMenu(e, 'separator', item.id)}
                    />
                  );
                }

                if (item.type === 'folder') {
                  if (editingFolderId === item.id) {
                    return (
                      <div key={item.id} className="px-2 py-1">
                        <input
                          type="text"
                          value={editingFolderName}
                          onChange={(e) => setEditingFolderName(e.target.value)}
                          onBlur={() => handleRenameFolder(item.id, editingFolderName)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRenameFolder(item.id, editingFolderName);
                            if (e.key === 'Escape') setEditingFolderId(null);
                          }}
                          autoFocus
                          className="w-full px-2 py-1 text-sm bg-gray-700 border border-gray-600 rounded text-white"
                        />
                      </div>
                    );
                  }

                  return (
                    <SidebarFolder
                      key={item.id}
                      id={item.id}
                      name={item.name || '폴더'}
                      isExpanded={item.isExpanded ?? true}
                      children={item.children || []}
                      channels={channelMap}
                      selectedChannelId={selectedChannelId}
                      pinnedChannels={pinnedChannels}
                      editingChannelId={editingChannelId}
                      editingChannelName={editingChannelName}
                      onToggle={() => toggleFolder(item.id)}
                      onSelectChannel={onSelectChannel}
                      onContextMenu={(e) => handleContextMenu(e, 'folder', item.id)}
                      onChannelContextMenu={(e, channelId) => handleContextMenu(e, 'channel', item.id, channelId)}
                      onRenameChannel={handleRenameChannel}
                      onCancelChannelEdit={() => setEditingChannelId(null)}
                    />
                  );
                }

                if (item.type === 'channel' && item.channelId) {
                  const channel = channelMap.get(item.channelId);
                  if (!channel) return null;

                  return (
                    <SidebarChannelItem
                      key={item.id}
                      id={item.id}
                      channel={channel}
                      isSelected={selectedChannelId === item.channelId}
                      isPinned={pinnedChannels.includes(item.channelId)}
                      isEditing={editingChannelId === item.channelId}
                      editingName={editingChannelName}
                      onSelect={() => onSelectChannel(item.channelId!)}
                      onContextMenu={(e) => handleContextMenu(e, 'channel', item.id, item.channelId)}
                      onRename={(newName) => handleRenameChannel(item.channelId!, newName)}
                      onCancelEdit={() => setEditingChannelId(null)}
                    />
                  );
                }

                return null;
              })}
            </SortableContext>

            <DragOverlay>
              {activeId ? (
                <div className="bg-gray-700 rounded px-2 py-1 text-sm opacity-80">
                  드래그 중...
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>

          {sidebarItems.length === 0 && (
            <div className="text-center text-gray-500 text-sm py-4">
              채널이 없습니다
            </div>
          )}

          {/* Hidden channels section (admin only) */}
          {hiddenChannels.length > 0 && (
            <div className="mt-4 border-t border-gray-700 pt-2">
              <button
                onClick={() => setShowHiddenChannels(!showHiddenChannels)}
                className="flex items-center justify-between w-full px-2 py-1 text-xs text-gray-500 hover:text-gray-300"
              >
                <span>숨겨진 채널 ({hiddenChannels.length})</span>
                <span>{showHiddenChannels ? '▼' : '▶'}</span>
              </button>
              {showHiddenChannels && (
                <div className="mt-1 space-y-1">
                  {hiddenChannels.map((channelId) => {
                    const channel = channelMap.get(channelId);
                    if (!channel) return null;
                    return (
                      <div
                        key={channelId}
                        className="flex items-center justify-between px-2 py-1 text-sm text-gray-500 hover:bg-gray-700 rounded"
                      >
                        <span className="truncate flex-1">
                          {channel.type === 'direct' ? '🔵' : '#'} {channel.name || '이름 없음'}
                        </span>
                        <button
                          onClick={() => handleRestoreChannel(channelId)}
                          className="text-xs text-blue-400 hover:text-blue-300 ml-2"
                          title="목록에 복원"
                        >
                          복원
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* User info */}
        <div className="p-3 border-t border-gray-700">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowProfileSettings(true)}
              className="flex-shrink-0 hover:opacity-80 transition-opacity"
              title="프로필 설정"
            >
              {getAbsoluteUrl(user?.avatarUrl) ? (
                <img
                  src={getAbsoluteUrl(user?.avatarUrl)!}
                  alt={user?.displayName}
                  className="w-8 h-8 rounded-full object-cover"
                />
              ) : (
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm text-white font-medium"
                  style={{ backgroundColor: user?.avatarColor || '#6B7280' }}
                >
                  {user?.displayName?.[0] || 'U'}
                </div>
              )}
            </button>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{user?.displayName}</div>
              <div className="text-xs text-gray-400 truncate">{user?.email}</div>
            </div>
            <button
              onClick={onSettingsClick}
              className="text-gray-400 hover:text-white p-1"
              title="화면 설정"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
            <button
              onClick={logout}
              className="text-gray-400 hover:text-white text-sm"
              title="로그아웃"
            >
              로그아웃
            </button>
          </div>
        </div>

        {/* Resize Handle */}
        <div
          onMouseDown={handleMouseDown}
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-blue-400 transition-colors ${
            isResizing ? 'bg-blue-500' : 'bg-transparent'
          }`}
          title="드래그하여 너비 조정"
        />
      </aside>

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={getContextMenuItems()}
          onClose={() => setContextMenu(null)}
        />
      )}

      <NewDMModal
        isOpen={showNewDM}
        onClose={() => setShowNewDM(false)}
        onChannelCreated={handleChannelCreated}
      />

      <NewChannelModal
        isOpen={showNewChannel}
        onClose={() => setShowNewChannel(false)}
        onChannelCreated={handleChannelCreated}
      />

      {inviteChannelId && (
        <InviteMemberModal
          isOpen={!!inviteChannelId}
          onClose={() => setInviteChannelId(null)}
          channelId={inviteChannelId}
          channelName={channelMap.get(inviteChannelId)?.name || '채널'}
        />
      )}

      <ProfileSettingsModal
        isOpen={showProfileSettings}
        onClose={() => setShowProfileSettings(false)}
      />

      <SearchModal
        isOpen={showSearchModal}
        onClose={() => setShowSearchModal(false)}
        onSelectMessage={(channelId, messageId) => {
          onSelectChannel(channelId, messageId);
        }}
      />
    </>
  );
}
