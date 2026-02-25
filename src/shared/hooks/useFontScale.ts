import { useState, useEffect, useCallback } from 'react';

const MIN_SCALE = 0.8;  // 80%
const MAX_SCALE = 1.4;  // 140%
const STEP = 0.05;      // 5%씩 조절

/**
 * 앱별 폰트 크기 조절 훅
 * @param appName 앱 이름 (localStorage 키로 사용)
 * @param defaultScale 기본 스케일 (1 = 100%)
 */
export function useFontScale(appName: string, defaultScale: number = 1) {
  const storageKey = `font-scale-${appName}`;

  const [scale, setScale] = useState<number>(() => {
    const saved = localStorage.getItem(storageKey);
    return saved ? parseFloat(saved) : defaultScale;
  });

  // 스케일 변경 시 localStorage에 저장 + 다른 훅 인스턴스에 알림
  useEffect(() => {
    localStorage.setItem(storageKey, scale.toString());
    window.dispatchEvent(new CustomEvent('font-scale-change', { detail: { key: storageKey, scale } }));
  }, [scale, storageKey]);

  // 다른 컴포넌트의 useFontScale에서 변경한 값 동기화
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail.key === storageKey) {
        setScale(detail.scale);
      }
    };
    window.addEventListener('font-scale-change', handler);
    return () => window.removeEventListener('font-scale-change', handler);
  }, [storageKey]);

  // 스케일 증가
  const increaseScale = useCallback(() => {
    setScale(prev => Math.min(MAX_SCALE, prev + STEP));
  }, []);

  // 스케일 감소
  const decreaseScale = useCallback(() => {
    setScale(prev => Math.max(MIN_SCALE, prev - STEP));
  }, []);

  // 스케일 초기화
  const resetScale = useCallback(() => {
    setScale(defaultScale);
  }, [defaultScale]);

  // 퍼센트 표시
  const scalePercent = Math.round(scale * 100);

  // 최소/최대 도달 여부
  const canIncrease = scale < MAX_SCALE;
  const canDecrease = scale > MIN_SCALE;

  return {
    scale,
    scalePercent,
    increaseScale,
    decreaseScale,
    resetScale,
    canIncrease,
    canDecrease,
  };
}
