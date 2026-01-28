import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import type { Doctor } from '../types';
import { searchPatients, PatientSearchResult } from '../lib/api';
import { fetchPatientDefaultTreatments } from '@modules/manage/lib/treatmentApi';
import type { PatientDefaultTreatments } from '@modules/manage/types';

// 외부에서 환자 정보를 넘겨받을 때 사용하는 타입
export interface InitialPatient {
  id: number;
  chartNo: string;
  name: string;
  phone?: string;
}

// 1단계에서 선택한 정보 (2단계로 전달)
export interface ReservationDraft {
  patient: PatientSearchResult;
  doctor: string;
  doctorColor: string;
  selectedItems: string[];
  requiredSlots: number;
  memo: string;
  defaultTime?: string;  // 빈 시간 클릭시 선택한 시간
}

interface ReservationStep1ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNext: (draft: ReservationDraft) => void;
  doctors: Doctor[];
  initialPatient?: InitialPatient | null;
  initialDetails?: string;
  defaultDoctor?: string;  // 빈 시간 클릭시 선택한 의사
  defaultTime?: string;    // 빈 시간 클릭시 선택한 시간
}

// 진료 항목 카테고리
const TREATMENT_CATEGORIES = {
  '기본진료': [
    { name: '침', slots: 1 },
    { name: '추나', slots: 1 },
    { name: '초음파', slots: 1 },
  ],
  '약상담': [
    { name: '약초진', slots: 6 },
    { name: '약재진(내원)', slots: 3 },
    { name: '약재진(전화)', slots: 1 },
  ],
};

// 모든 항목의 슬롯 사용량 맵
const ITEM_SLOT_USAGE: Record<string, number> = {};
Object.values(TREATMENT_CATEGORIES).flat().forEach(item => {
  ITEM_SLOT_USAGE[item.name] = item.slots;
});

// 진료내역에서 치료항목 파싱
const parseDetailsToItems = (details: string): string[] => {
  // 빈 문자열이면 빈 배열 반환 (비급여만 있는 경우)
  if (!details) return [];

  const items: string[] = [];
  const lowerDetails = details.toLowerCase();

  // 기본 치료 항목 파싱
  if (lowerDetails.includes('침') && !lowerDetails.includes('약침')) items.push('침');
  if (lowerDetails.includes('추나')) items.push('추나');

  // 약상담 파싱
  if (lowerDetails.includes('약초진')) items.push('약초진');
  else if (lowerDetails.includes('약재진') && lowerDetails.includes('내원')) items.push('약재진(내원)');
  else if (lowerDetails.includes('약재진') && lowerDetails.includes('전화')) items.push('약재진(전화)');

  // 비급여만 있을 때는 빈 배열 유지
  return items;
};

// 환자 기본치료 DB에서 항목 추출
const getDefaultItemsFromTreatments = (treatments: PatientDefaultTreatments | null): string[] => {
  if (!treatments) return []; // 빈 배열

  const items: string[] = [];

  // 기본 치료 항목
  if (treatments.has_acupuncture) items.push('침');
  if (treatments.has_chuna) items.push('추나');

  // 비급여만 있으면 빈 배열 유지
  return items;
};

export const ReservationStep1Modal: React.FC<ReservationStep1ModalProps> = ({
  isOpen,
  onClose,
  onNext,
  doctors,
  initialPatient,
  initialDetails,
  defaultDoctor,
  defaultTime,
}) => {
  // 환자 검색 관련 상태
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<PatientSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<PatientSearchResult | null>(null);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 예약 폼 관련 상태
  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [memo, setMemo] = useState('');
  const [error, setError] = useState<string | null>(null);

  // 외부에서 환자 정보가 넘어온 경우 설정
  useEffect(() => {
    if (initialPatient) {
      setSelectedPatient({
        id: initialPatient.id,
        chartNo: initialPatient.chartNo,
        name: initialPatient.name,
        phone: initialPatient.phone,
      });
    }
  }, [initialPatient]);

  // 모달 열릴 때 초기값 설정
  useEffect(() => {
    if (isOpen) {
      // 환자 정보 설정
      if (initialPatient) {
        setSelectedPatient({
          id: initialPatient.id,
          chartNo: initialPatient.chartNo,
          name: initialPatient.name,
          phone: initialPatient.phone,
        });
      }
      // 담당의 설정
      setSelectedDoctor(defaultDoctor || '');
      // 진료항목 설정 (비급여만 있으면 빈 배열)
      setSelectedItems(parseDetailsToItems(initialDetails || ''));
      // 기타 초기화
      setSearchTerm('');
      setSearchResults([]);
      setShowSearchResults(false);
      setMemo('');
      setError(null);
    }
  }, [isOpen, initialPatient, initialDetails, defaultDoctor]);

  // doctors 로드 후 담당의 선택 (defaultDoctor가 없으면 첫 번째 의사)
  useEffect(() => {
    if (isOpen && doctors.length > 0 && !selectedDoctor) {
      if (defaultDoctor) {
        setSelectedDoctor(defaultDoctor);
      } else {
        setSelectedDoctor(doctors[0].name);
      }
    }
  }, [isOpen, doctors, selectedDoctor, defaultDoctor]);

  // 환자 기본치료 정보 로드 (initialPatient가 있고, initialDetails가 없을 때만)
  // CS수납에서 넘어온 경우 initialDetails가 있으므로 DB 조회 안 함
  useEffect(() => {
    const loadPatientDefaultTreatments = async () => {
      // initialDetails가 있으면 그 값을 우선 사용 (CS수납에서 분석한 값)
      if (!isOpen || !initialPatient || initialDetails !== undefined) return;

      try {
        const treatments = await fetchPatientDefaultTreatments(initialPatient.id);
        if (treatments) {
          const defaultItems = getDefaultItemsFromTreatments(treatments);
          setSelectedItems(defaultItems);
        }
      } catch (err) {
        console.error('환자 기본치료 정보 로드 실패:', err);
        // 실패 시 기본값 유지
      }
    };

    loadPatientDefaultTreatments();
  }, [isOpen, initialPatient, initialDetails]);

  // 환자 검색 (디바운스 적용)
  const handleSearch = useCallback(async (term: string) => {
    if (term.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const results = await searchPatients(term);
      setSearchResults(results);
      setShowSearchResults(true);
    } catch (err) {
      console.error('환자 검색 실패:', err);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // 검색어 변경 핸들러 (디바운스)
  const handleSearchTermChange = (value: string) => {
    setSearchTerm(value);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      handleSearch(value);
    }, 300);
  };

  // 환자 선택 핸들러
  const handleSelectPatient = async (patient: PatientSearchResult) => {
    setSelectedPatient(patient);
    setSearchTerm('');
    setSearchResults([]);
    setShowSearchResults(false);

    // 환자 기본치료 정보 로드
    try {
      const treatments = await fetchPatientDefaultTreatments(patient.id);
      if (treatments) {
        const defaultItems = getDefaultItemsFromTreatments(treatments);
        setSelectedItems(defaultItems);
      }
    } catch (err) {
      console.error('환자 기본치료 정보 로드 실패:', err);
    }
  };

  // 환자 선택 해제
  const handleClearPatient = () => {
    setSelectedPatient(null);
    setSearchTerm('');
  };

  // 검색 결과 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 항목 선택/해제 토글
  const toggleItem = (itemName: string) => {
    setSelectedItems(prev => {
      if (prev.includes(itemName)) {
        // 최소 1개는 선택되어야 함
        if (prev.length === 1) return prev;
        return prev.filter(i => i !== itemName);
      } else {
        return [...prev, itemName];
      }
    });
  };

  // 선택된 진료 항목들의 총 슬롯 사용량
  const requiredSlots = useMemo(() => {
    // 복합 진료인 경우 (2개 이상 선택)
    if (selectedItems.length > 1) {
      let totalSlots = 0;
      selectedItems.forEach(item => {
        if (item.includes('약재진') && item.includes('내원')) {
          totalSlots += 3;
        } else if (item.includes('약재진') && item.includes('전화')) {
          totalSlots += 1;
        } else if (item.includes('약초진')) {
          totalSlots += 6;
        } else {
          totalSlots += 1; // 침, 추나
        }
      });
      return Math.min(totalSlots, 6); // 최대 6칸
    }

    // 단일 항목인 경우
    return ITEM_SLOT_USAGE[selectedItems[0]] || 1;
  }, [selectedItems]);

  // 선택한 의사의 색상
  const selectedDoctorColor = useMemo(() => {
    const doc = doctors.find(d => d.name === selectedDoctor);
    return doc?.color || '#3B82F6';
  }, [doctors, selectedDoctor]);

  const handleNext = () => {
    setError(null);

    if (!selectedPatient) {
      setError('환자를 검색하여 선택해주세요.');
      return;
    }

    if (!selectedDoctor) {
      setError('담당 의사를 선택해주세요.');
      return;
    }

    onNext({
      patient: selectedPatient,
      doctor: selectedDoctor,
      doctorColor: selectedDoctorColor,
      selectedItems,
      requiredSlots,
      memo,
      defaultTime,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold">새 예약 - 1단계</h3>
            <p className="text-sm text-gray-500">진료항목과 담당의 선택</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <i className="fa-solid fa-xmark text-xl"></i>
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* 에러 메시지 */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              <i className="fa-solid fa-circle-exclamation mr-2"></i>
              {error}
            </div>
          )}

          {/* 환자 검색/선택 */}
          <div ref={searchRef}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              환자 <span className="text-red-500">*</span>
            </label>

            {selectedPatient ? (
              // 환자가 선택된 상태
              <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-clinic-primary text-white rounded-full flex items-center justify-center font-bold">
                    {selectedPatient.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">
                      {selectedPatient.name}
                      <span className="ml-2 text-sm font-normal text-gray-500">
                        ({selectedPatient.chartNo})
                      </span>
                    </p>
                    {selectedPatient.phone && (
                      <p className="text-sm text-gray-500">{selectedPatient.phone}</p>
                    )}
                  </div>
                </div>
                {!initialPatient && (
                  <button
                    type="button"
                    onClick={handleClearPatient}
                    className="text-sm text-red-600 hover:text-red-700 font-medium"
                  >
                    변경
                  </button>
                )}
              </div>
            ) : (
              // 환자 검색 입력
              <div className="relative">
                <div className="relative">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => handleSearchTermChange(e.target.value)}
                    onFocus={() => searchResults.length > 0 && setShowSearchResults(true)}
                    className="w-full px-3 py-2 pr-10 border rounded-lg focus:ring-2 focus:ring-clinic-primary focus:border-clinic-primary"
                    placeholder="환자 이름 또는 차트번호로 검색 (2글자 이상)"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {isSearching ? (
                      <i className="fa-solid fa-spinner fa-spin text-gray-400"></i>
                    ) : (
                      <i className="fa-solid fa-search text-gray-400"></i>
                    )}
                  </div>
                </div>

                {/* 검색 결과 드롭다운 */}
                {showSearchResults && searchResults.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {searchResults.map((patient) => (
                      <button
                        key={patient.id}
                        type="button"
                        onClick={() => handleSelectPatient(patient)}
                        className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b last:border-b-0 flex items-center gap-3"
                      >
                        <div className="w-8 h-8 bg-gray-200 text-gray-600 rounded-full flex items-center justify-center text-sm font-medium">
                          {patient.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {patient.name}
                            <span className="ml-2 text-sm font-normal text-gray-500">
                              ({patient.chartNo})
                            </span>
                          </p>
                          {patient.phone && (
                            <p className="text-xs text-gray-500">{patient.phone}</p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* 검색 결과 없음 */}
                {showSearchResults && searchTerm.length >= 2 && searchResults.length === 0 && !isSearching && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-4 text-center text-gray-500">
                    <i className="fa-solid fa-user-slash text-2xl mb-2"></i>
                    <p>검색 결과가 없습니다</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 진료 항목 - 복수 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              진료 항목 <span className="text-red-500">*</span>
              <span className="ml-2 text-xs text-gray-500 font-normal">
                (선택: {selectedItems.length}개, 총 <span className="font-bold text-clinic-primary">{requiredSlots}칸</span>)
              </span>
            </label>
            <div className="space-y-3">
              {Object.entries(TREATMENT_CATEGORIES).map(([category, items]) => (
                <div key={category} className="border rounded-lg p-3">
                  <div className="text-xs font-semibold text-gray-500 mb-2">{category}</div>
                  <div className="flex flex-wrap gap-2">
                    {items.map(({ name, slots }) => {
                      const isSelected = selectedItems.includes(name);
                      return (
                        <button
                          key={name}
                          type="button"
                          onClick={() => toggleItem(name)}
                          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                            isSelected
                              ? 'bg-clinic-primary text-white ring-2 ring-clinic-primary ring-offset-1'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {name}
                          <span className={`ml-1 text-xs ${isSelected ? 'text-white/80' : 'text-gray-500'}`}>
                            ({slots}칸)
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            {/* 선택된 항목 표시 */}
            {selectedItems.length > 0 && (
              <div className="mt-2 text-sm text-gray-600">
                선택됨: {selectedItems.join(', ')}
              </div>
            )}
          </div>

          {/* 담당 의사 - 버튼 형태 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              담당 의사 <span className="text-red-500">*</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {doctors.map((doc) => {
                const isSelected = selectedDoctor === doc.name;
                return (
                  <button
                    key={doc.id}
                    type="button"
                    onClick={() => setSelectedDoctor(doc.name)}
                    className={`px-4 py-2 rounded-lg font-medium transition-all ${
                      isSelected
                        ? 'bg-clinic-primary text-white ring-2 ring-clinic-primary ring-offset-1'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
                    }`}
                    style={isSelected ? {} : { borderLeftColor: doc.color, borderLeftWidth: '4px' }}
                  >
                    {doc.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 메모 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              메모 <span className="text-xs text-gray-400">(선택)</span>
            </label>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-clinic-primary focus:border-clinic-primary"
              rows={2}
              placeholder="예약 관련 메모"
            />
          </div>

          {/* 안내 메시지 */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-sm">
            <i className="fa-solid fa-info-circle mr-2"></i>
            다음 단계에서 캘린더에서 직접 예약 시간을 선택합니다.
          </div>

          {/* 버튼 */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-colors"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="flex-1 py-2.5 bg-clinic-primary text-white font-semibold rounded-lg hover:bg-clinic-primary/90 transition-colors"
            >
              다음: 시간 선택
              <i className="fa-solid fa-arrow-right ml-2"></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReservationStep1Modal;
