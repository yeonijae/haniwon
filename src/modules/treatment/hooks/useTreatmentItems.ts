import { useState, useEffect } from 'react';
import { TreatmentItem } from '../types';
import * as api from '../lib/api';

export const useTreatmentItems = (currentUser: any) => {
  const [treatmentItems, setTreatmentItems] = useState<TreatmentItem[]>([]);

  // 초기 데이터 로드
  useEffect(() => {
    if (!currentUser) return;

    const loadTreatmentItems = async () => {
      try {
        const items = await api.fetchTreatmentItems();
        setTreatmentItems(items);
      } catch (error) {
        console.error('❌ 치료항목 데이터 로드 오류:', error);
      }
    };

    loadTreatmentItems();
  }, [currentUser]);

  return {
    treatmentItems,
  };
};
