import { useState, useEffect, useCallback } from 'react';
import * as api from '../lib/api';
import type { Inquiry, CreateInquiryRequest, UpdateInquiryRequest, InquiryStatus } from '../types';

function getCurrentDateStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function useInquiries() {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(getCurrentDateStr());
  const [dateViewMode, setDateViewMode] = useState<'created' | 'completed'>('created');
  const [rangeMode, setRangeMode] = useState<'day' | '1w' | '1m' | '3m'>('day');

  // 기간 계산
  const getDateRange = useCallback(() => {
    const end = selectedDate;
    const d = new Date(selectedDate + 'T00:00:00');
    if (rangeMode === '1w') d.setDate(d.getDate() - 6);
    else if (rangeMode === '1m') d.setMonth(d.getMonth() - 1);
    else if (rangeMode === '3m') d.setMonth(d.getMonth() - 3);
    else return { date: selectedDate };
    const start = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    return { dateFrom: start, dateTo: end };
  }, [selectedDate, rangeMode]);

  // 문의 목록 로드
  const loadInquiries = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await api.ensureInquiriesTable();

      const range = getDateRange();
      const data = await api.getInquiries({
        ...range,
        dateField: dateViewMode === 'created' ? 'created_at' : 'completed_at',
        includeOpen: true,
      });
      setInquiries(data);
    } catch (err) {
      console.error('문의 목록 로드 실패:', err);
      setError('문의 목록을 불러오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate, dateViewMode, rangeMode, getDateRange]);

  // 초기 로드
  useEffect(() => {
    loadInquiries();
  }, [loadInquiries]);

  // 문의 등록
  const createInquiry = useCallback(async (data: CreateInquiryRequest) => {
    try {
      await api.createInquiry(data);
      await loadInquiries();
    } catch (err) {
      console.error('문의 등록 실패:', err);
      throw err;
    }
  }, [loadInquiries]);

  // 문의 수정
  const updateInquiry = useCallback(async (id: number, data: UpdateInquiryRequest) => {
    try {
      await api.updateInquiry(id, data);
      await loadInquiries();
    } catch (err) {
      console.error('문의 수정 실패:', err);
      throw err;
    }
  }, [loadInquiries]);

  // 문의 삭제
  const deleteInquiry = useCallback(async (id: number) => {
    try {
      await api.deleteInquiry(id);
      await loadInquiries();
    } catch (err) {
      console.error('문의 삭제 실패:', err);
      throw err;
    }
  }, [loadInquiries]);

  // 상태 변경
  const updateStatus = useCallback(async (id: number, status: InquiryStatus) => {
    try {
      await api.updateInquiryStatus(id, status);
      await loadInquiries();
    } catch (err) {
      console.error('상태 변경 실패:', err);
      throw err;
    }
  }, [loadInquiries]);

  // 환자 매칭
  const matchPatient = useCallback(async (inquiryId: number, patientId: number | null) => {
    try {
      await api.updateInquiry(inquiryId, { patient_id: patientId === null ? null : Number(patientId) });
      await loadInquiries();
    } catch (err) {
      console.error('환자 매칭 실패:', err);
      throw err;
    }
  }, [loadInquiries]);

  return {
    inquiries,
    isLoading,
    error,
    selectedDate,
    setSelectedDate,
    dateViewMode,
    setDateViewMode,
    rangeMode,
    setRangeMode,
    loadInquiries,
    createInquiry,
    updateInquiry,
    deleteInquiry,
    updateStatus,
    matchPatient,
  };
}
