/**
 * 테마 토글 컴포넌트
 */

import { useTheme } from '../contexts/ThemeContext';

export function ThemeToggle() {
  const { theme, setTheme, isDark } = useTheme();

  return (
    <div className={`flex ${isDark ? 'bg-gray-700' : 'bg-gray-200'} rounded-lg p-0.5`}>
      <button
        className={`px-2 py-1 rounded text-sm transition-all ${
          theme === 'light'
            ? 'bg-white text-gray-800 shadow'
            : isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-700'
        }`}
        onClick={() => setTheme('light')}
        title="Light Theme"
      >
        ☀️
      </button>
      <button
        className={`px-2 py-1 rounded text-sm transition-all ${
          theme === 'dark'
            ? `${isDark ? 'bg-gray-600' : 'bg-gray-700'} text-white shadow`
            : isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-700'
        }`}
        onClick={() => setTheme('dark')}
        title="Dark Theme"
      >
        🌙
      </button>
    </div>
  );
}
