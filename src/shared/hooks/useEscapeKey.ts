import { useEffect } from 'react';

/**
 * ESC 키를 눌렀을 때 콜백을 실행하는 훅
 * 모달 닫기 등에 사용
 *
 * @param onEscape - ESC 키 눌렀을 때 실행할 콜백
 * @param enabled - 훅 활성화 여부 (기본값: true)
 */
export function useEscapeKey(onEscape: () => void, enabled: boolean = true) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onEscape();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onEscape, enabled]);
}

export default useEscapeKey;
