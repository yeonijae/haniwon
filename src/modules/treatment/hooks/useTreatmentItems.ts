import { useState, useEffect, useCallback } from 'react';
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

  // 치료항목 추가
  const addTreatmentItem = useCallback(async (newItem: Omit<TreatmentItem, 'id'>) => {
    try {
      // 마지막 순서로 추가
      const maxOrder = treatmentItems.length > 0
        ? Math.max(...treatmentItems.map(item => item.displayOrder))
        : -1;
      const itemWithOrder = { ...newItem, displayOrder: maxOrder + 1 };

      const createdItem = await api.createTreatmentItem(itemWithOrder);
      setTreatmentItems(prev => [...prev, createdItem]);
    } catch (error) {
      console.error('치료항목 추가 오류:', error);
      alert('치료항목 추가 중 오류가 발생했습니다.');
    }
  }, [treatmentItems]);

  // 치료항목 수정
  const updateTreatmentItem = useCallback(async (id: number, updatedItem: Omit<TreatmentItem, 'id'>) => {
    try {
      const updated = await api.updateTreatmentItem(id, updatedItem);
      setTreatmentItems(prev => prev.map(item => item.id === id ? updated : item));
    } catch (error) {
      console.error('치료항목 수정 오류:', error);
      alert('치료항목 수정 중 오류가 발생했습니다.');
    }
  }, []);

  // 치료항목 삭제
  const deleteTreatmentItem = useCallback(async (id: number) => {
    const itemToDelete = treatmentItems.find(item => item.id === id);
    if (!itemToDelete) {
      alert('삭제할 치료항목을 찾을 수 없습니다.');
      return;
    }

    try {
      await api.deleteTreatmentItem(id);
      setTreatmentItems(prev => prev.filter(item => item.id !== id));
    } catch (error) {
      console.error('❌ 치료항목 삭제 오류:', error);
      alert('치료항목 삭제 중 오류가 발생했습니다.');
    }
  }, [treatmentItems]);

  // 치료항목 순서 변경
  const reorderTreatmentItems = useCallback(async (reorderedItems: TreatmentItem[]) => {
    // 낙관적 업데이트: UI 먼저 변경
    setTreatmentItems(reorderedItems);

    try {
      // DB 업데이트: id와 새로운 displayOrder만 전송
      const orderUpdates = reorderedItems.map((item, index) => ({
        id: item.id,
        displayOrder: index
      }));

      await api.updateTreatmentItemsOrder(orderUpdates);
    } catch (error) {
      console.error('❌ 치료항목 순서 변경 오류:', error);
      alert('순서 변경 중 오류가 발생했습니다. 페이지를 새로고침하세요.');

      // 실패 시 원래 데이터 다시 로드
      try {
        const items = await api.fetchTreatmentItems();
        setTreatmentItems(items);
      } catch (reloadError) {
        console.error('❌ 데이터 재로드 오류:', reloadError);
      }
    }
  }, []);

  return {
    treatmentItems,
    addTreatmentItem,
    updateTreatmentItem,
    deleteTreatmentItem,
    reorderTreatmentItems,
  };
};
