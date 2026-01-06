/**
 * 치료 정보 관리 훅
 * 환자별 기본 치료 정보 및 당일 치료 기록을 관리
 */

import { useState, useCallback } from 'react';
import { getCurrentDate } from '@shared/lib/postgres';
import {
  fetchPatientDefaultTreatments,
  savePatientDefaultTreatments,
  fetchDailyTreatmentRecord,
  updateDailyTreatmentRecord,
  getOrCreateDailyTreatmentRecord,
} from '../lib/treatmentApi';
import type {
  PatientDefaultTreatments,
  DailyTreatmentRecord,
  YakchimType,
} from '../types';

interface UseTreatmentInfoResult {
  /** 로딩 상태 */
  isLoading: boolean;
  /** 에러 메시지 */
  error: string | null;
  /** 현재 로드된 기본 치료 정보 */
  defaultTreatments: PatientDefaultTreatments | null;
  /** 현재 로드된 당일 치료 기록 */
  dailyRecord: DailyTreatmentRecord | null;
  /** 기본 치료 정보 로드 */
  loadDefaultTreatments: (patientId: number) => Promise<PatientDefaultTreatments | null>;
  /** 기본 치료 정보 저장 */
  saveDefaultTreatments: (patientId: number, treatments: Partial<PatientDefaultTreatments>) => Promise<void>;
  /** 당일 치료 기록 로드 */
  loadDailyRecord: (patientId: number, date?: string) => Promise<DailyTreatmentRecord | null>;
  /** 당일 치료 기록 업데이트 */
  updateDailyRecord: (recordId: number, updates: Partial<DailyTreatmentRecord>) => Promise<void>;
  /** 당일 치료 기록 생성 또는 조회 */
  getOrCreateDailyRecord: (
    patientId: number,
    patientName: string,
    chartNumber: string | undefined,
    date?: string
  ) => Promise<DailyTreatmentRecord>;
  /** 캐시 클리어 */
  clearCache: () => void;
}

export const useTreatmentInfo = (): UseTreatmentInfoResult => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [defaultTreatments, setDefaultTreatments] = useState<PatientDefaultTreatments | null>(null);
  const [dailyRecord, setDailyRecord] = useState<DailyTreatmentRecord | null>(null);

  // 기본 치료 정보 로드
  const loadDefaultTreatments = useCallback(async (patientId: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchPatientDefaultTreatments(patientId);
      setDefaultTreatments(data);
      return data;
    } catch (err) {
      setError('기본 치료 정보 로드 실패');
      console.error('기본 치료 정보 로드 오류:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 기본 치료 정보 저장
  const saveDefaultTreatments = useCallback(async (
    patientId: number,
    treatments: Partial<PatientDefaultTreatments>
  ) => {
    setIsLoading(true);
    setError(null);
    try {
      await savePatientDefaultTreatments(patientId, treatments);
      // 저장 후 다시 로드하여 상태 업데이트
      const updated = await fetchPatientDefaultTreatments(patientId);
      setDefaultTreatments(updated);
    } catch (err) {
      setError('기본 치료 정보 저장 실패');
      console.error('기본 치료 정보 저장 오류:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 당일 치료 기록 로드
  const loadDailyRecord = useCallback(async (patientId: number, date?: string) => {
    const targetDate = date || getCurrentDate();
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchDailyTreatmentRecord(patientId, targetDate);
      setDailyRecord(data);
      return data;
    } catch (err) {
      setError('당일 치료 기록 로드 실패');
      console.error('당일 치료 기록 로드 오류:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 당일 치료 기록 업데이트
  const updateDailyRecordHandler = useCallback(async (
    recordId: number,
    updates: Partial<DailyTreatmentRecord>
  ) => {
    setIsLoading(true);
    setError(null);
    try {
      await updateDailyTreatmentRecord(recordId, updates);
      // 상태 업데이트
      setDailyRecord(prev => prev ? { ...prev, ...updates } : null);
    } catch (err) {
      setError('당일 치료 기록 업데이트 실패');
      console.error('당일 치료 기록 업데이트 오류:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 당일 치료 기록 생성 또는 조회
  const getOrCreateDailyRecordHandler = useCallback(async (
    patientId: number,
    patientName: string,
    chartNumber: string | undefined,
    date?: string
  ) => {
    const targetDate = date || getCurrentDate();
    setIsLoading(true);
    setError(null);
    try {
      const data = await getOrCreateDailyTreatmentRecord(
        patientId,
        patientName,
        chartNumber,
        targetDate
      );
      setDailyRecord(data);
      return data;
    } catch (err) {
      setError('당일 치료 기록 생성 실패');
      console.error('당일 치료 기록 생성 오류:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 캐시 클리어
  const clearCache = useCallback(() => {
    setDefaultTreatments(null);
    setDailyRecord(null);
    setError(null);
  }, []);

  return {
    isLoading,
    error,
    defaultTreatments,
    dailyRecord,
    loadDefaultTreatments,
    saveDefaultTreatments,
    loadDailyRecord,
    updateDailyRecord: updateDailyRecordHandler,
    getOrCreateDailyRecord: getOrCreateDailyRecordHandler,
    clearCache,
  };
};

// 치료 항목 체크박스용 헬퍼
export interface TreatmentCheckboxItem {
  key: keyof Pick<PatientDefaultTreatments,
    'has_acupuncture' | 'has_moxa' | 'has_hotpack' | 'has_cupping' |
    'has_chuna' | 'has_ultrasound' | 'has_highfreq' | 'has_aroma'>;
  label: string;
  isActing: boolean;
}

export const TREATMENT_CHECKBOX_ITEMS: TreatmentCheckboxItem[] = [
  { key: 'has_acupuncture', label: '침', isActing: true },
  { key: 'has_moxa', label: '물치', isActing: false },
  { key: 'has_hotpack', label: '핫팩', isActing: false },
  { key: 'has_cupping', label: '습부항', isActing: false },
  { key: 'has_chuna', label: '추나', isActing: true },
  { key: 'has_ultrasound', label: '초음파', isActing: true },
  { key: 'has_highfreq', label: '고주파', isActing: false },
  { key: 'has_aroma', label: '향기요법', isActing: false },
];

// 약침 종류 선택용 헬퍼
export interface YakchimSelectItem {
  value: YakchimType;
  label: string;
}

export const YAKCHIM_SELECT_ITEMS: YakchimSelectItem[] = [
  { value: 'gyeonggeun', label: '경근' },
  { value: 'nokwong', label: '녹용' },
  { value: 'taeban', label: '태반' },
  { value: 'hwata', label: '화타' },
  { value: 'line', label: '라인' },
];
