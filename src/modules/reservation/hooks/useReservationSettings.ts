import { useState, useEffect, useCallback } from 'react';
import type { ReservationSettings, TreatmentItem } from '../types';

const STORAGE_KEY = 'haniwon_reservation_settings';

// 기본 설정값
const DEFAULT_SETTINGS: ReservationSettings = {
  treatmentItems: [
    // 기본진료
    { id: 'acup', name: '침', slots: 1, slotsInCompound: 1, category: '기본진료', isActive: true, sortOrder: 1 },
    { id: 'chuna', name: '추나', slots: 1, slotsInCompound: 1, category: '기본진료', isActive: true, sortOrder: 2 },
    { id: 'cup', name: '부항', slots: 1, slotsInCompound: 1, category: '기본진료', isActive: true, sortOrder: 3 },
    { id: 'moxa', name: '뜸', slots: 1, slotsInCompound: 1, category: '기본진료', isActive: true, sortOrder: 4 },
    { id: 'yakchim', name: '약침', slots: 1, slotsInCompound: 1, category: '기본진료', isActive: true, sortOrder: 5 },
    // 재초진
    { id: 'jaecho', name: '재초진', slots: 2, slotsInCompound: 1, category: '재초진', isActive: true, sortOrder: 10 },
    // 약상담
    { id: 'yakjaejin-visit', name: '약재진(내원)', slots: 3, slotsInCompound: 3, category: '약상담', isActive: true, sortOrder: 20 },
    { id: 'yakjaejin-phone', name: '약재진(전화)', slots: 1, slotsInCompound: 1, category: '약상담', isActive: true, sortOrder: 21 },
    { id: 'new-consult', name: '신규약상담', slots: 6, slotsInCompound: 6, category: '약상담', isActive: true, sortOrder: 22 },
    { id: 'yakchojin', name: '약초진', slots: 6, slotsInCompound: 6, category: '약상담', isActive: true, sortOrder: 23 },
  ],
  categories: ['기본진료', '재초진', '약상담', '특수진료'],
  maxSlotsPerReservation: 6,
  slotDurationMinutes: 10,
};

export function useReservationSettings() {
  const [settings, setSettings] = useState<ReservationSettings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);

  // 설정 로드
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // 기존 설정과 병합 (새 항목이 추가되었을 경우 대비)
        setSettings({
          ...DEFAULT_SETTINGS,
          ...parsed,
          treatmentItems: mergeItems(DEFAULT_SETTINGS.treatmentItems, parsed.treatmentItems || []),
        });
      }
    } catch (err) {
      console.error('Failed to load reservation settings:', err);
    }
    setIsLoaded(true);
  }, []);

  // 설정 저장
  const saveSettings = useCallback(async (newSettings: ReservationSettings) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
      setSettings(newSettings);
    } catch (err) {
      console.error('Failed to save reservation settings:', err);
      throw err;
    }
  }, []);

  // 활성화된 치료 항목만 가져오기
  const getActiveItems = useCallback(() => {
    return settings.treatmentItems
      .filter(item => item.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [settings.treatmentItems]);

  // 카테고리별 활성 항목 가져오기
  const getItemsByCategory = useCallback(() => {
    const activeItems = getActiveItems();
    return settings.categories.reduce((acc, category) => {
      const items = activeItems.filter(item => item.category === category);
      if (items.length > 0) {
        acc[category] = items;
      }
      return acc;
    }, {} as Record<string, TreatmentItem[]>);
  }, [settings.categories, getActiveItems]);

  // 항목 이름으로 슬롯 수 가져오기
  const getSlotsByName = useCallback((itemName: string, isCompound: boolean = false): number => {
    const item = settings.treatmentItems.find(
      i => i.isActive && i.name === itemName
    );
    if (!item) return 1; // 기본값
    return isCompound ? (item.slotsInCompound ?? item.slots) : item.slots;
  }, [settings.treatmentItems]);

  // 여러 항목의 총 슬롯 계산
  const calculateTotalSlots = useCallback((itemNames: string[]): number => {
    if (itemNames.length === 0) return 0;
    if (itemNames.length === 1) {
      return getSlotsByName(itemNames[0], false);
    }

    // 복합 진료
    let total = 0;
    itemNames.forEach(name => {
      total += getSlotsByName(name, true);
    });
    return Math.min(total, settings.maxSlotsPerReservation);
  }, [getSlotsByName, settings.maxSlotsPerReservation]);

  // 항목 문자열에서 슬롯 수 계산 (예: "침,추나,약재진(내원)")
  const calculateSlotsFromString = useCallback((itemString: string): number => {
    if (!itemString) return 1;
    const items = itemString.split(/[,+\/]/).map(s => s.trim()).filter(s => s);
    return calculateTotalSlots(items);
  }, [calculateTotalSlots]);

  return {
    settings,
    isLoaded,
    saveSettings,
    getActiveItems,
    getItemsByCategory,
    getSlotsByName,
    calculateTotalSlots,
    calculateSlotsFromString,
    DEFAULT_SETTINGS,
  };
}

// 기존 항목과 새 항목 병합
function mergeItems(defaults: TreatmentItem[], stored: TreatmentItem[]): TreatmentItem[] {
  const result = [...stored];

  // 기본 항목 중 저장된 것에 없는 것 추가
  defaults.forEach(defaultItem => {
    const exists = stored.some(s => s.id === defaultItem.id);
    if (!exists) {
      result.push(defaultItem);
    }
  });

  return result;
}

export { DEFAULT_SETTINGS };
