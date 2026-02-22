import React, { useState, useRef, useEffect, useCallback } from 'react';
import { searchLocalPatients, getLocalPatientByChartNo, type LocalPatient } from '../lib/patientSync';
import LocalPatientRegisterModal from './LocalPatientRegisterModal';

interface HeaderPatientSearchProps {
  onPatientSelect: (patient: LocalPatient) => void;
}

/**
 * 헤더 환자 검색 컴포넌트
 * - PostgreSQL 로컬 검색 (사전 동기화된 2만명 환자 데이터)
 * - 300ms 디바운스 자동 검색
 * - 최소 2글자 이상 입력 시 검색 실행
 */
export default function HeaderPatientSearch({ onPatientSelect }: HeaderPatientSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<LocalPatient[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [showRegisterModal, setShowRegisterModal] = useState(false);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 검색 실행
  const executeSearch = useCallback(async (term: string) => {
    if (term.trim().length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    try {
      const patients = await searchLocalPatients(term.trim());
      setResults(patients);
      setIsOpen(true);
    } catch (error) {
      console.error('환자 검색 오류:', error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 입력 변경 시 디바운스 처리
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    setHighlightIndex(-1);

    // 기존 디바운스 타이머 초기화
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // 2글자 미만이면 드롭다운 닫기
    if (value.trim().length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    // 300ms 디바운스
    debounceRef.current = setTimeout(() => {
      executeSearch(value);
    }, 300);
  };

  // 환자 선택 처리
  const handleSelect = (patient: LocalPatient) => {
    onPatientSelect(patient);
    setQuery('');
    setResults([]);
    setIsOpen(false);
  };

  // 키보드 이벤트 처리
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      setHighlightIndex(-1);
      inputRef.current?.blur();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (isOpen && results.length > 0) {
        setHighlightIndex(prev => prev < results.length - 1 ? prev + 1 : 0);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (isOpen && results.length > 0) {
        setHighlightIndex(prev => prev > 0 ? prev - 1 : results.length - 1);
      }
    } else if (e.key === 'Enter') {
      if (isOpen && highlightIndex >= 0 && highlightIndex < results.length) {
        e.preventDefault();
        handleSelect(results[highlightIndex]);
      }
    }
  };

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 컴포넌트 언마운트 시 디바운스 타이머 정리
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  // 전화번호 포맷팅 (010-1234-5678 형태)
  const formatPhone = (phone: string | null): string => {
    if (!phone) return '';
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 11) {
      return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
    }
    if (digits.length === 10) {
      return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    return phone;
  };

  // 생년월일 포맷팅
  const formatBirthDate = (date: string | null): string => {
    if (!date) return '';
    // YYYY-MM-DD 또는 YYYYMMDD 형태 처리
    const cleaned = date.replace(/\D/g, '');
    if (cleaned.length === 8) {
      return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 6)}-${cleaned.slice(6)}`;
    }
    return date;
  };

  // 환자 등록 완료 후 대시보드 열기
  const handleRegisterSuccess = async (patientId: number, chartNumber: string) => {
    setShowRegisterModal(false);
    const localPatient = await getLocalPatientByChartNo(chartNumber);
    if (localPatient) {
      onPatientSelect(localPatient);
    }
  };

  return (
    <>
    <div className="cs-header-search" ref={wrapperRef}>
      <input
        ref={inputRef}
        type="text"
        className="cs-header-search-input"
        placeholder="검색(이름/차트번호/연락처)"
        value={query}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
      />

      {/* 로딩 상태 */}
      {isLoading && (
        <div className="cs-header-search-dropdown">
          <div className="cs-header-search-loading">검색 중...</div>
        </div>
      )}

      {/* 검색 결과 드롭다운 */}
      {!isLoading && isOpen && (
        <div className="cs-header-search-dropdown">
          {results.length === 0 ? (
            <div className="cs-header-search-empty">검색 결과 없음</div>
          ) : (
            results.map((patient, idx) => (
              <div
                key={patient.id}
                className={`cs-header-search-item${idx === highlightIndex ? ' highlighted' : ''}`}
                onClick={() => handleSelect(patient)}
                onMouseEnter={() => setHighlightIndex(idx)}
              >
                <span className="cs-header-search-item-name">{patient.name}</span>
                {patient.chart_number && (
                  <span className="cs-header-search-item-chart">
                    {patient.chart_number}
                  </span>
                )}
                {patient.birth_date && (
                  <span className="cs-header-search-item-birth">
                    {formatBirthDate(patient.birth_date)}
                  </span>
                )}
                {patient.phone && (
                  <span className="cs-header-search-item-phone">
                    {formatPhone(patient.phone)}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
    <button
      className="cs-header-register-btn"
      onClick={() => setShowRegisterModal(true)}
      title="로컬 환자 등록 (EMR 연동 없이)"
    >
      <i className="fa-solid fa-user-plus"></i>
    </button>

    {showRegisterModal && (
      <LocalPatientRegisterModal
        onClose={() => setShowRegisterModal(false)}
        onSuccess={handleRegisterSuccess}
      />
    )}
    </>
  );
}
