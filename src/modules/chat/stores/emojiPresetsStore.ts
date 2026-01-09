import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const DEFAULT_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🎉'];

interface EmojiPresetsState {
  emojis: string[];
  setEmojis: (emojis: string[]) => void;
  addEmoji: (emoji: string) => void;
  removeEmoji: (emoji: string) => void;
  resetToDefault: () => void;
}

export const useEmojiPresetsStore = create<EmojiPresetsState>()(
  persist(
    (set) => ({
      emojis: DEFAULT_EMOJIS,

      setEmojis: (emojis) => set({ emojis }),

      addEmoji: (emoji) =>
        set((state) => ({
          emojis: state.emojis.includes(emoji)
            ? state.emojis
            : [...state.emojis, emoji],
        })),

      removeEmoji: (emoji) =>
        set((state) => ({
          emojis: state.emojis.filter((e) => e !== emoji),
        })),

      resetToDefault: () => set({ emojis: DEFAULT_EMOJIS }),
    }),
    {
      name: 'haniwon-emoji-presets',
    }
  )
);

export const DEFAULT_EMOJI_LIST = DEFAULT_EMOJIS;
