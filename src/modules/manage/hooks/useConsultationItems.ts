import { useState, useEffect, useCallback } from 'react';
import { ConsultationItem, ConsultationSubItem } from '../types';
import * as api from '../lib/api';

export const useConsultationItems = (currentUser: any) => {
  const [consultationItems, setConsultationItems] = useState<ConsultationItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // 초기 데이터 로드
  useEffect(() => {
    if (!currentUser) return;

    const loadConsultationItems = async () => {
      try {
        setIsLoading(true);
        const items = await api.fetchConsultationItems();
        setConsultationItems(items);
      } catch (error) {
        console.error('❌ 진료항목 데이터 로드 오류:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadConsultationItems();
  }, [currentUser]);

  // 진료항목 추가
  const addConsultationItem = useCallback(async (name: string) => {
    try {
      const maxOrder = consultationItems.length > 0
        ? Math.max(...consultationItems.map(item => item.displayOrder))
        : -1;

      const createdItem = await api.createConsultationItem({
        name,
        displayOrder: maxOrder + 1,
      });
      setConsultationItems(prev => [...prev, createdItem]);
    } catch (error) {
      console.error('진료항목 추가 오류:', error);
      alert('진료항목 추가 중 오류가 발생했습니다.');
    }
  }, [consultationItems]);

  // 진료항목 수정
  const updateConsultationItem = useCallback(async (id: number, name: string) => {
    try {
      const item = consultationItems.find(i => i.id === id);
      if (!item) return;

      await api.updateConsultationItem(id, { name, displayOrder: item.displayOrder });
      setConsultationItems(prev => prev.map(i =>
        i.id === id ? { ...i, name } : i
      ));
    } catch (error) {
      console.error('진료항목 수정 오류:', error);
      alert('진료항목 수정 중 오류가 발생했습니다.');
    }
  }, [consultationItems]);

  // 진료항목 삭제
  const deleteConsultationItem = useCallback(async (id: number) => {
    try {
      await api.deleteConsultationItem(id);
      setConsultationItems(prev => prev.filter(i => i.id !== id));
    } catch (error) {
      console.error('❌ 진료항목 삭제 오류:', error);
      alert('진료항목 삭제 중 오류가 발생했습니다.');
    }
  }, []);

  // 진료항목 순서 변경
  const reorderConsultationItems = useCallback(async (reorderedItems: ConsultationItem[]) => {
    setConsultationItems(reorderedItems);

    try {
      const orderUpdates = reorderedItems.map((item, index) => ({
        id: item.id,
        displayOrder: index
      }));

      await api.updateConsultationItemsOrder(orderUpdates);
    } catch (error) {
      console.error('❌ 진료항목 순서 변경 오류:', error);
      alert('순서 변경 중 오류가 발생했습니다.');

      // 실패 시 원래 데이터 다시 로드
      try {
        const items = await api.fetchConsultationItems();
        setConsultationItems(items);
      } catch (reloadError) {
        console.error('❌ 데이터 재로드 오류:', reloadError);
      }
    }
  }, []);

  // 세부항목 추가
  const addSubItem = useCallback(async (parentId: number, name: string) => {
    try {
      const parent = consultationItems.find(i => i.id === parentId);
      if (!parent) return;

      const maxOrder = parent.subItems.length > 0
        ? Math.max(...parent.subItems.map(sub => sub.displayOrder))
        : -1;

      const createdSubItem = await api.createConsultationSubItem(parentId, {
        name,
        displayOrder: maxOrder + 1,
      });

      setConsultationItems(prev => prev.map(item =>
        item.id === parentId
          ? { ...item, subItems: [...item.subItems, createdSubItem] }
          : item
      ));
    } catch (error) {
      console.error('세부항목 추가 오류:', error);
      alert('세부항목 추가 중 오류가 발생했습니다.');
    }
  }, [consultationItems]);

  // 세부항목 수정
  const updateSubItem = useCallback(async (parentId: number, subItemId: number, name: string) => {
    try {
      const parent = consultationItems.find(i => i.id === parentId);
      const subItem = parent?.subItems.find(s => s.id === subItemId);
      if (!subItem) return;

      await api.updateConsultationSubItem(subItemId, { name, displayOrder: subItem.displayOrder });

      setConsultationItems(prev => prev.map(item =>
        item.id === parentId
          ? {
              ...item,
              subItems: item.subItems.map(sub =>
                sub.id === subItemId ? { ...sub, name } : sub
              )
            }
          : item
      ));
    } catch (error) {
      console.error('세부항목 수정 오류:', error);
      alert('세부항목 수정 중 오류가 발생했습니다.');
    }
  }, [consultationItems]);

  // 세부항목 삭제
  const deleteSubItem = useCallback(async (parentId: number, subItemId: number) => {
    try {
      await api.deleteConsultationSubItem(subItemId);

      setConsultationItems(prev => prev.map(item =>
        item.id === parentId
          ? { ...item, subItems: item.subItems.filter(sub => sub.id !== subItemId) }
          : item
      ));
    } catch (error) {
      console.error('❌ 세부항목 삭제 오류:', error);
      alert('세부항목 삭제 중 오류가 발생했습니다.');
    }
  }, []);

  // 세부항목 순서 변경
  const reorderSubItems = useCallback(async (parentId: number, reorderedSubItems: ConsultationSubItem[]) => {
    setConsultationItems(prev => prev.map(item =>
      item.id === parentId
        ? { ...item, subItems: reorderedSubItems }
        : item
    ));

    try {
      const orderUpdates = reorderedSubItems.map((sub, index) => ({
        id: sub.id,
        displayOrder: index
      }));

      await api.updateConsultationSubItemsOrder(orderUpdates);
    } catch (error) {
      console.error('❌ 세부항목 순서 변경 오류:', error);
      alert('순서 변경 중 오류가 발생했습니다.');

      // 실패 시 원래 데이터 다시 로드
      try {
        const items = await api.fetchConsultationItems();
        setConsultationItems(items);
      } catch (reloadError) {
        console.error('❌ 데이터 재로드 오류:', reloadError);
      }
    }
  }, []);

  return {
    consultationItems,
    isLoading,
    addConsultationItem,
    updateConsultationItem,
    deleteConsultationItem,
    reorderConsultationItems,
    addSubItem,
    updateSubItem,
    deleteSubItem,
    reorderSubItems,
  };
};
