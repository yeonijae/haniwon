import { useState, useEffect, useCallback } from 'react';
import { MedicalStaff, Staff, UncoveredCategories } from '../types';
import * as api from '../lib/api';

export const useStaff = (currentUser: any) => {
  const [medicalStaff, setMedicalStaff] = useState<MedicalStaff[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [uncoveredCategories, setUncoveredCategories] = useState<UncoveredCategories>({});

  // 초기 데이터 로드
  useEffect(() => {
    if (!currentUser) return;

    const loadStaffData = async () => {
      try {
        const medicalStaffData = await api.fetchMedicalStaff();
        setMedicalStaff(medicalStaffData);

        const staffData = await api.fetchStaff();
        setStaff(staffData);

        const categoriesData = await api.fetchUncoveredCategories();
        setUncoveredCategories(categoriesData);
      } catch (error) {
        console.error('❌ 스태프 데이터 로드 오류:', error);
      }
    };

    loadStaffData();
  }, [currentUser]);

  // 의료진 관리
  const updateMedicalStaff = useCallback(async (updatedStaff: MedicalStaff) => {
    try {
      await api.updateMedicalStaff(updatedStaff.id, updatedStaff);
      setMedicalStaff(prev => prev.map(staff => staff.id === updatedStaff.id ? updatedStaff : staff));
      alert(`${updatedStaff.name}님의 정보가 수정되었습니다.`);
    } catch (error) {
      console.error('의료진 수정 오류:', error);
      alert('의료진 정보 수정 중 오류가 발생했습니다.');
    }
  }, []);

  const addMedicalStaff = useCallback(async (newStaffData: Omit<MedicalStaff, 'id'>) => {
    try {
      const newStaff = await api.createMedicalStaff(newStaffData);
      setMedicalStaff(prev => [...prev, newStaff]);
      alert(`${newStaff.name}님을 신규 의료진으로 등록했습니다.`);
    } catch (error) {
      console.error('의료진 추가 오류:', error);
      alert('의료진 추가 중 오류가 발생했습니다.');
    }
  }, []);

  const deleteMedicalStaff = useCallback(async (staffId: number) => {
    let staffToDelete: MedicalStaff | undefined;

    setMedicalStaff(prev => {
      staffToDelete = prev.find(s => s.id === staffId);
      if (!staffToDelete) return prev;
      return prev.filter(staff => staff.id !== staffId);
    });

    if (!staffToDelete) return;

    try {
      await api.deleteMedicalStaff(staffId);
      alert(`${staffToDelete.name}님이 삭제되었습니다.`);
    } catch (error) {
      console.error('의료진 삭제 오류:', error);
      alert('의료진 삭제 중 오류가 발생했습니다.');
      // Rollback on error
      if (staffToDelete) {
        setMedicalStaff(prev => [...prev, staffToDelete!]);
      }
    }
  }, []);

  // 스태프 관리
  const updateStaff = useCallback(async (updatedStaffMember: Staff) => {
    try {
      await api.updateStaff(updatedStaffMember.id, updatedStaffMember);
      setStaff(prev => prev.map(s => s.id === updatedStaffMember.id ? updatedStaffMember : s));
      alert(`${updatedStaffMember.name}님의 정보가 수정되었습니다.`);
    } catch (error) {
      console.error('스태프 수정 오류:', error);
      alert('스태프 정보 수정 중 오류가 발생했습니다.');
    }
  }, []);

  const addStaff = useCallback(async (newStaffData: Omit<Staff, 'id'>) => {
    try {
      const newStaffMember = await api.createStaff(newStaffData);
      setStaff(prev => [...prev, newStaffMember]);
      alert(`${newStaffMember.name}님을 신규 스태프로 등록했습니다.`);
    } catch (error) {
      console.error('스태프 추가 오류:', error);
      alert('스태프 추가 중 오류가 발생했습니다.');
    }
  }, []);

  const deleteStaff = useCallback(async (staffId: number) => {
    let staffToDelete: Staff | undefined;

    setStaff(prev => {
      staffToDelete = prev.find(s => s.id === staffId);
      if (!staffToDelete) return prev;
      return prev.filter(s => s.id !== staffId);
    });

    if (!staffToDelete) return;

    try {
      await api.deleteStaff(staffId);
      alert(`${staffToDelete.name}님이 삭제되었습니다.`);
    } catch (error) {
      console.error('스태프 삭제 오류:', error);
      alert('스태프 삭제 중 오류가 발생했습니다.');
      // Rollback on error
      if (staffToDelete) {
        setStaff(prev => [...prev, staffToDelete!]);
      }
    }
  }, []);

  // 비급여 카테고리
  const updateUncoveredCategories = useCallback(async (categories: UncoveredCategories) => {
    try {
      await api.saveUncoveredCategories(categories);
      setUncoveredCategories(categories);
      alert('비급여 카테고리가 저장되었습니다.');
    } catch (error) {
      console.error('비급여 카테고리 저장 오류:', error);
      alert('비급여 카테고리 저장 중 오류가 발생했습니다.');
    }
  }, []);

  return {
    medicalStaff,
    staff,
    uncoveredCategories,
    updateMedicalStaff,
    addMedicalStaff,
    deleteMedicalStaff,
    updateStaff,
    addStaff,
    deleteStaff,
    updateUncoveredCategories,
  };
};
