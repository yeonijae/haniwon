import { useState, useEffect, useCallback } from 'react';
import * as api from '../lib/api';
import type { Inquiry, CreateInquiryRequest, UpdateInquiryRequest, InquiryStatus } from '../types';

export function useInquiries() {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'today' | 'pending'>('today');

  // 문의 목록 로드
  const loadInquiries = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // 테이블이 없으면 생성
      await api.ensureInquiriesTable();

      let data: Inquiry[];
      switch (filter) {
        case 'today':
          data = await api.getTodayInquiries();
          break;
        case 'pending':
          data = await api.getPendingInquiries();
          break;
        default:
          data = await api.getInquiries({ limit: 100 });
      }
      setInquiries(data);
    } catch (err) {
      console.error('문의 목록 로드 실패:', err);
      setError('문의 목록을 불러오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [filter]);

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

  return {
    inquiries,
    isLoading,
    error,
    filter,
    setFilter,
    loadInquiries,
    createInquiry,
    updateInquiry,
    deleteInquiry,
    updateStatus,
  };
}
