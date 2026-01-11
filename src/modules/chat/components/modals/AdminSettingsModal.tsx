import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { api } from '../../api';
import { useEmojiPresetsStore, DEFAULT_EMOJI_LIST } from '../../stores/emojiPresetsStore';
import clsx from 'clsx';

interface AdminSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = 'system' | 'channels' | 'emoji';

// 이모지 카테고리별 목록 (전체)
const EMOJI_CATEGORIES: Record<string, string[]> = {
  '스마일 & 사람': [
    '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '☺️', '😚',
    '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥',
    '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '🥸', '😎',
    '🤓', '🧐', '😕', '😟', '🙁', '☹️', '😮', '😯', '😲', '😳', '🥺', '😦', '😧', '😨', '😰', '😥', '😢', '😭', '😱', '😖',
    '😣', '😞', '😓', '😩', '😫', '🥱', '😤', '😡', '😠', '🤬', '😈', '👿', '💀', '☠️', '💩', '🤡', '👹', '👺', '👻', '👽',
    '👾', '🤖', '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾',
  ],
  '제스처 & 신체': [
    '👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍',
    '👎', '👊', '✊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💅', '🤳', '💪', '🦾', '🦿', '🦵', '🦶', '👂',
    '🦻', '👃', '🧠', '🫀', '🫁', '🦷', '🦴', '👀', '👁️', '👅', '👄', '👶', '🧒', '👦', '👧', '🧑', '👱', '👨', '🧔', '👩',
    '🧓', '👴', '👵', '🙍', '🙎', '🙅', '🙆', '💁', '🙋', '🧏', '🙇', '🤦', '🤷', '👮', '🕵️', '💂', '🥷', '👷', '🤴', '👸',
  ],
  '하트 & 감정': [
    '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '❤️‍🔥',
    '❤️‍🩹', '💋', '💯', '💢', '💥', '💫', '💦', '💨', '🕳️', '💣', '💬', '👁️‍🗨️', '🗨️', '🗯️', '💭', '💤', '🔥', '✨', '🌟', '💫',
  ],
  '동물 & 자연': [
    '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐻‍❄️', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒',
    '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🪱', '🐛', '🦋', '🐌', '🐞',
    '🐜', '🪰', '🪲', '🪳', '🦟', '🦗', '🕷️', '🦂', '🐢', '🐍', '🦎', '🦖', '🦕', '🐙', '🦑', '🦐', '🦞', '🦀', '🐡', '🐠',
    '🐟', '🐬', '🐳', '🐋', '🦈', '🐊', '🐅', '🐆', '🦓', '🦍', '🦧', '🐘', '🦛', '🦏', '🐪', '🐫', '🦒', '🦘', '🦬', '🐃',
    '🌸', '💮', '🏵️', '🌹', '🥀', '🌺', '🌻', '🌼', '🌷', '🌱', '🪴', '🌲', '🌳', '🌴', '🌵', '🌾', '🌿', '☘️', '🍀', '🍁',
    '🍂', '🍃', '🌍', '🌎', '🌏', '🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘', '🌙', '🌚', '🌛', '🌜', '☀️', '🌝', '🌞',
    '⭐', '🌟', '🌠', '☁️', '⛅', '🌤️', '🌥️', '🌦️', '🌧️', '🌨️', '🌩️', '🌪️', '🌫️', '🌈', '❄️', '☃️', '⛄', '🔥', '💧', '🌊',
  ],
  '음식 & 음료': [
    '🍏', '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑',
    '🥦', '🥬', '🥒', '🌶️', '🫑', '🌽', '🥕', '🫒', '🧄', '🧅', '🥔', '🍠', '🥐', '🥯', '🍞', '🥖', '🥨', '🧀', '🥚', '🍳',
    '🧈', '🥞', '🧇', '🥓', '🥩', '🍗', '🍖', '🦴', '🌭', '🍔', '🍟', '🍕', '🫓', '🥪', '🥙', '🧆', '🌮', '🌯', '🫔', '🥗',
    '🥘', '🫕', '🍝', '🍜', '🍲', '🍛', '🍣', '🍱', '🥟', '🦪', '🍤', '🍙', '🍚', '🍘', '🍥', '🥠', '🥮', '🍢', '🍡', '🍧',
    '🍨', '🍦', '🥧', '🧁', '🍰', '🎂', '🍮', '🍭', '🍬', '🍫', '🍿', '🍩', '🍪', '🌰', '🥜', '🍯', '🥛', '🍼', '☕', '🫖',
    '🍵', '🧃', '🥤', '🧋', '🍶', '🍺', '🍻', '🥂', '🍷', '🥃', '🍸', '🍹', '🧉', '🍾', '🧊', '🥄', '🍴', '🍽️', '🥣', '🥡',
  ],
  '활동 & 스포츠': [
    '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🪀', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🪃', '🥅', '⛳',
    '🪁', '🏹', '🎣', '🤿', '🥊', '🥋', '🎽', '🛹', '🛼', '🛷', '⛸️', '🥌', '🎿', '⛷️', '🏂', '🪂', '🏋️', '🤼', '🤸', '⛹️',
    '🤺', '🤾', '🏌️', '🏇', '⛹️', '🏊', '🤽', '🚣', '🧗', '🚵', '🚴', '🏆', '🥇', '🥈', '🥉', '🏅', '🎖️', '🏵️', '🎗️', '🎫',
    '🎟️', '🎪', '🤹', '🎭', '🩰', '🎨', '🎬', '🎤', '🎧', '🎼', '🎹', '🥁', '🪘', '🎷', '🎺', '🪗', '🎸', '🪕', '🎻', '🎲',
    '♟️', '🎯', '🎳', '🎮', '🎰', '🧩',
  ],
  '여행 & 장소': [
    '🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐', '🛻', '🚚', '🚛', '🚜', '🏍️', '🛵', '🚲', '🛴', '🚨', '🚔',
    '🚍', '🚘', '🚖', '🚡', '🚠', '🚟', '🚃', '🚋', '🚞', '🚝', '🚄', '🚅', '🚈', '🚂', '🚆', '🚇', '🚊', '🚉', '✈️', '🛫',
    '🛬', '🛩️', '💺', '🛰️', '🚀', '🛸', '🚁', '🛶', '⛵', '🚤', '🛥️', '🛳️', '⛴️', '🚢', '⚓', '🪝', '⛽', '🚧', '🚦', '🚥',
    '🗺️', '🗿', '🗽', '🗼', '🏰', '🏯', '🏟️', '🎡', '🎢', '🎠', '⛲', '⛱️', '🏖️', '🏝️', '🏜️', '🌋', '⛰️', '🏔️', '🗻', '🏕️',
    '🛖', '🏠', '🏡', '🏘️', '🏚️', '🏗️', '🏢', '🏬', '🏣', '🏤', '🏥', '🏦', '🏨', '🏪', '🏫', '🏩', '💒', '🏛️', '⛪', '🕌',
  ],
  '사물 & 기호': [
    '⌚', '📱', '📲', '💻', '⌨️', '🖥️', '🖨️', '🖱️', '🖲️', '🕹️', '🗜️', '💽', '💾', '💿', '📀', '📼', '📷', '📸', '📹', '🎥',
    '📽️', '🎞️', '📞', '☎️', '📟', '📠', '📺', '📻', '🎙️', '🎚️', '🎛️', '🧭', '⏱️', '⏲️', '⏰', '🕰️', '⌛', '⏳', '📡', '🔋',
    '🔌', '💡', '🔦', '🕯️', '🧯', '🛢️', '💵', '💴', '💶', '💷', '🪙', '💰', '💳', '💎', '⚖️', '🪜', '🧰', '🪛', '🔧', '🔨',
    '⚒️', '🛠️', '⛏️', '🪚', '🔩', '⚙️', '🪤', '🧱', '⛓️', '🧲', '🔫', '💣', '🧨', '🪓', '🔪', '🗡️', '⚔️', '🛡️', '🚬', '⚰️',
    '🪦', '⚱️', '🏺', '🔮', '📿', '🧿', '💈', '⚗️', '🔭', '🔬', '🕳️', '🩹', '🩺', '💊', '💉', '🩸', '🧬', '🦠', '🧫', '🧪',
    '✅', '✔️', '☑️', '❌', '❎', '➕', '➖', '➗', '✖️', '♾️', '💲', '💱', '™️', '©️', '®️', '〰️', '➰', '➿', '🔚', '🔙',
    '🔛', '🔝', '🔜', '✳️', '❇️', '‼️', '⁉️', '❓', '❔', '❕', '❗', '〽️', '⚠️', '🚸', '🔱', '⚜️', '🔰', '♻️', '✴️', '🈯',
    '💠', '🔷', '🔶', '🔵', '🔴', '🟠', '🟡', '🟢', '🟣', '🟤', '⚫', '⚪', '🟥', '🟧', '🟨', '🟩', '🟦', '🟪', '🟫', '⬛',
    '⬜', '◼️', '◻️', '◾', '◽', '▪️', '▫️', '🔳', '🔲', '🔘', '🏁', '🚩', '🎌', '🏴', '🏳️', '🏳️‍🌈', '🏳️‍⚧️', '🏴‍☠️',
  ],
};

interface Channel {
  id: string;
  type: 'direct' | 'group' | 'topic';
  name: string | null;
  created_at: string;
  member_count?: number;
}

// 드래그 가능한 이모지 아이템
function SortableEmoji({ id, emoji, onRemove }: { id: string; emoji: string; onRemove: () => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="flex items-center justify-center w-10 h-10 text-2xl bg-gray-600 hover:bg-gray-500 rounded-lg cursor-grab active:cursor-grabbing"
      title="드래그하여 순서 변경, 더블클릭하여 제거"
      onDoubleClick={onRemove}
    >
      {emoji}
    </div>
  );
}

export default function AdminSettingsModal({ isOpen, onClose }: AdminSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('system');
  const queryClient = useQueryClient();

  // Emoji presets state
  const { emojis, setEmojis } = useEmojiPresetsStore();
  const [editingEmojis, setEditingEmojis] = useState<string[]>([]);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = parseInt(String(active.id).split('-')[1]);
      const newIndex = parseInt(String(over.id).split('-')[1]);
      setEditingEmojis((items) => arrayMove(items, oldIndex, newIndex));
    }
  };

  // System settings state (local storage based for now)
  const [defaultFontSize, setDefaultFontSize] = useState(() =>
    localStorage.getItem('haniwon-default-font-size') || '14'
  );

  useEffect(() => {
    if (isOpen) {
      setEditingEmojis([...emojis]);
    }
  }, [isOpen, emojis]);

  // Fetch all channels for admin
  const { data: channels = [], isLoading: channelsLoading } = useQuery<Channel[]>({
    queryKey: ['admin-channels'],
    queryFn: async () => {
      const response = await api.get('/channels');
      return response.data.data;
    },
    enabled: isOpen && activeTab === 'channels',
  });

  // Delete channel mutation
  const deleteChannel = useMutation({
    mutationFn: async (channelId: string) => {
      await api.delete(`/channels/${channelId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-channels'] });
      queryClient.invalidateQueries({ queryKey: ['channels'] });
    },
  });

  if (!isOpen) return null;

  const handleRemoveEmoji = (emoji: string) => {
    setEditingEmojis(editingEmojis.filter((e) => e !== emoji));
  };

  const handleSaveEmojis = () => {
    setEmojis(editingEmojis);
    alert('이모지 프리셋이 저장되었습니다.');
  };

  const handleResetEmojis = () => {
    setEditingEmojis([...DEFAULT_EMOJI_LIST]);
  };

  const handleSaveSystemSettings = () => {
    localStorage.setItem('haniwon-default-font-size', defaultFontSize);
    alert('시스템 설정이 저장되었습니다.');
  };

  const handleDeleteChannel = (channel: Channel) => {
    if (confirm(`"${channel.name || '이름 없음'}" 채널을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) {
      deleteChannel.mutate(channel.id);
    }
  };

  const tabs: { key: TabType; label: string }[] = [
    { key: 'system', label: '시스템 설정' },
    { key: 'channels', label: '채널 관리' },
    { key: 'emoji', label: '이모지 프리셋' },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg w-full max-w-2xl mx-4 shadow-xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">관리자 설정</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="px-6 pt-4 border-b border-gray-700">
          <div className="flex gap-4">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={clsx(
                  'pb-3 px-1 text-sm font-medium border-b-2 transition-colors',
                  activeTab === tab.key
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-gray-400 hover:text-gray-300'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* System Settings Tab */}
          {activeTab === 'system' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  기본 폰트 크기 (px)
                </label>
                <input
                  type="number"
                  value={defaultFontSize}
                  onChange={(e) => setDefaultFontSize(e.target.value)}
                  min="10"
                  max="24"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="mt-1 text-xs text-gray-500">
                  새로운 사용자의 기본 폰트 크기입니다. (10-24px)
                </p>
              </div>

              <div className="pt-4 border-t border-gray-700">
                <button
                  onClick={handleSaveSystemSettings}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors"
                >
                  시스템 설정 저장
                </button>
              </div>
            </div>
          )}

          {/* Channels Tab */}
          {activeTab === 'channels' && (
            <div className="space-y-4">
              {channelsLoading ? (
                <div className="text-gray-400 text-center py-8">로딩 중...</div>
              ) : channels.length === 0 ? (
                <div className="text-gray-400 text-center py-8">채널이 없습니다.</div>
              ) : (
                <div className="space-y-2">
                  {channels.map((channel) => (
                    <div
                      key={channel.id}
                      className="flex items-center justify-between p-3 bg-gray-700 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-gray-400">
                          {channel.type === 'direct' ? '@' : '#'}
                        </span>
                        <div>
                          <div className="text-white font-medium">
                            {channel.name || '이름 없음'}
                          </div>
                          <div className="text-xs text-gray-400">
                            {channel.type} · {new Date(channel.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteChannel(channel)}
                        disabled={deleteChannel.isPending}
                        className="px-3 py-1 text-sm text-red-400 hover:text-red-300 hover:bg-red-900/30 rounded transition-colors disabled:opacity-50"
                      >
                        삭제
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Emoji Presets Tab */}
          {activeTab === 'emoji' && (
            <div className="space-y-6">
              {/* 현재 프리셋 */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  현재 이모지 프리셋 ({editingEmojis.length}개)
                </label>
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={editingEmojis.map((_, i) => `emoji-${i}`)}
                    strategy={horizontalListSortingStrategy}
                  >
                    <div className="flex flex-wrap gap-2 p-4 bg-gray-700 rounded-lg min-h-[60px]">
                      {editingEmojis.map((emoji, index) => (
                        <SortableEmoji
                          key={`emoji-${index}`}
                          id={`emoji-${index}`}
                          emoji={emoji}
                          onRemove={() => handleRemoveEmoji(emoji)}
                        />
                      ))}
                      {editingEmojis.length === 0 && (
                        <span className="text-gray-500">아래에서 이모지를 선택하세요.</span>
                      )}
                    </div>
                  </SortableContext>
                </DndContext>
                <p className="mt-1 text-xs text-gray-500">드래그하여 순서 변경, 더블클릭하여 제거</p>
              </div>

              {/* 이모지 선택 */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  이모지 선택
                </label>
                <div className="space-y-4 max-h-[300px] overflow-y-auto">
                  {Object.entries(EMOJI_CATEGORIES).map(([category, emojiList]) => (
                    <div key={category}>
                      <div className="text-xs text-gray-400 mb-2">{category}</div>
                      <div className="flex flex-wrap gap-1">
                        {emojiList.map((emoji) => {
                          const isSelected = editingEmojis.includes(emoji);
                          return (
                            <button
                              key={emoji}
                              onClick={() => {
                                if (isSelected) {
                                  handleRemoveEmoji(emoji);
                                } else {
                                  setEditingEmojis([...editingEmojis, emoji]);
                                }
                              }}
                              className={clsx(
                                'w-9 h-9 text-xl rounded-lg transition-colors',
                                isSelected
                                  ? 'bg-blue-600 ring-2 ring-blue-400'
                                  : 'bg-gray-700 hover:bg-gray-600'
                              )}
                              title={isSelected ? '선택됨 (클릭하여 제거)' : '클릭하여 추가'}
                            >
                              {emoji}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 버튼 */}
              <div className="flex gap-3 pt-4 border-t border-gray-700">
                <button
                  onClick={handleResetEmojis}
                  className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                >
                  기본값으로 초기화
                </button>
                <div className="flex-1" />
                <button
                  onClick={handleSaveEmojis}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors"
                >
                  이모지 저장
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
