import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import type { Reservation, Doctor, CreateReservationRequest } from '../types';
import { searchPatients, PatientSearchResult } from '../lib/api';

interface SlotInfo {
  time: string;
  usedSlots: number;
  remainingSlots: number;
}

// 외부에서 환자 정보를 넘겨받을 때 사용하는 타입
export interface InitialPatient {
  id: number;
  chartNo: string;
  name: string;
  phone?: string;
}

interface NewReservationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: CreateReservationRequest) => Promise<void>;
  doctors: Doctor[];
  reservations: Reservation[];
  selectedDate: string;
  defaultTime?: string;
  defaultDoctor?: string;
  initialPatient?: InitialPatient | null; // 운영관리시스템에서 넘어온 환자
  initialDetails?: string; // 운영관리에서 넘어온 진료내역 (예: "침치료(건보) - 침+추나")
}

// 슬롯 용량 상수
const SLOT_CAPACITY = 6;

// 진료 항목 카테고리
const TREATMENT_CATEGORIES = {
  '기본진료': [
    { name: '침', slots: 1 },
    { name: '추나', slots: 1 },
    { name: '부항', slots: 1 },
    { name: '뜸', slots: 1 },
    { name: '약침', slots: 1 },
  ],
  '재초진': [
    { name: '재초진', slots: 2 },
  ],
  '약상담': [
    { name: '약재진(내원)', slots: 3 },
    { name: '약재진(전화)', slots: 1 },
    { name: '신규약상담', slots: 6 },
    { name: '약초진', slots: 6 },
  ],
};

// 모든 항목의 슬롯 사용량 맵
const ITEM_SLOT_USAGE: Record<string, number> = {};
Object.values(TREATMENT_CATEGORIES).flat().forEach(item => {
  ITEM_SLOT_USAGE[item.name] = item.slots;
});

// 30분 단위 시간 슬롯
const generateTimeSlots = (): string[] => {
  const slots: string[] = [];
  let hour = 9;
  let minute = 30;
  const endHour = 21; // 20:30까지 예약 가능

  while (hour < endHour) {
    slots.push(`${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`);
    minute += 30;
    if (minute >= 60) {
      hour++;
      minute = 0;
    }
  }
  return slots;
};

const TIME_SLOTS = generateTimeSlots();

// 예약의 슬롯 사용량 계산 (DayView와 동일한 로직)
const getSlotUsage = (reservation: Reservation): number => {
  const item = reservation.item?.toLowerCase() || '';
  const type = reservation.type?.toLowerCase() || '';

  if (reservation.canceled) return 0;

  // === 약상담 (신규/초진) = 6칸 ===
  if (item.includes('신규') && (item.includes('약') || item.includes('상담'))) return 6;
  if (item.includes('약초진') || type.includes('약초진')) return 6;
  if ((type === '초진' || type === '초진예약') && (item.includes('약') || item.includes('상담') || item.includes('한약'))) return 6;

  // === 약상담 (재진) ===
  const isYakReJin = item.includes('약재진') || item.includes('선결') ||
    (item.includes('재진') && (item.includes('약') || item.includes('상담'))) ||
    type.includes('약재진') ||
    (type === '재진' && (item.includes('약') || item.includes('상담') || item.includes('한약')));

  if (isYakReJin) {
    if (type.includes('전화상담')) return 1;
    return 3;
  }

  if (item.includes('선결')) {
    if (type.includes('전화상담')) return 1;
    return 3;
  }

  // === 재초진 = 2칸 ===
  if (item.includes('재초') || type.includes('재초')) return 2;

  // === 복합 진료 계산: 쉼표나 +로 구분된 항목들의 슬롯 합산 ===
  const items = item.split(/[,+\/]/).map(s => s.trim()).filter(s => s);

  if (items.length > 1) {
    let totalSlots = 0;
    items.forEach(singleItem => {
      if (singleItem.includes('재초')) {
        totalSlots += 2;
      } else if (singleItem.includes('약재진') || singleItem.includes('선결')) {
        totalSlots += type.includes('전화상담') ? 1 : 3;
      } else if (singleItem.includes('추나')) {
        totalSlots += 1;
      } else if (singleItem.includes('침') || singleItem.includes('acupuncture')) {
        totalSlots += 1;
      } else if (singleItem.includes('부항')) {
        totalSlots += 1;
      } else if (singleItem.includes('뜸')) {
        totalSlots += 1;
      } else if (singleItem.includes('약침')) {
        totalSlots += 1;
      } else {
        totalSlots += 1;
      }
    });
    // type(구분)이 재초이면 추가 1칸
    if (type.includes('재초')) {
      totalSlots += 1;
    }
    return Math.min(totalSlots, SLOT_CAPACITY);
  }

  // === 단일 항목 처리 ===
  if (item.includes('추나')) return 1;
  if (item.includes('침') || item.includes('acupuncture')) return 1;
  if (item.includes('부항')) return 1;
  if (item.includes('뜸')) return 1;
  if (item.includes('약침')) return 1;

  return 1;
};

// 다음 시간 슬롯 가져오기
const getNextTimeSlot = (time: string): string | null => {
  const index = TIME_SLOTS.indexOf(time);
  if (index === -1 || index >= TIME_SLOTS.length - 1) return null;
  return TIME_SLOTS[index + 1];
};

// 진료내역에서 치료항목 파싱
const parseDetailsToItems = (details: string): string[] => {
  if (!details) return ['침'];

  const items: string[] = [];
  const lowerDetails = details.toLowerCase();

  // 치료 항목 파싱
  if (lowerDetails.includes('침') && !lowerDetails.includes('약침')) items.push('침');
  if (lowerDetails.includes('추나')) items.push('추나');
  if (lowerDetails.includes('부항')) items.push('부항');
  if (lowerDetails.includes('뜸')) items.push('뜸');
  if (lowerDetails.includes('약침')) items.push('약침');

  // 약상담 파싱
  if (lowerDetails.includes('약재진') && lowerDetails.includes('내원')) items.push('약재진(내원)');
  else if (lowerDetails.includes('약재진') && lowerDetails.includes('전화')) items.push('약재진(전화)');
  else if (lowerDetails.includes('신규약상담') || lowerDetails.includes('신규') && lowerDetails.includes('약')) items.push('신규약상담');
  else if (lowerDetails.includes('약초진')) items.push('약초진');

  // 재초진 파싱
  if (lowerDetails.includes('재초진') || lowerDetails.includes('재초')) items.push('재초진');

  return items.length > 0 ? items : ['침'];
};

export const NewReservationModal: React.FC<NewReservationModalProps> = ({
  isOpen,
  onClose,
  onSave,
  doctors,
  reservations,
  selectedDate,
  defaultTime,
  defaultDoctor,
  initialPatient,
  initialDetails,
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
  const [selectedDoctor, setSelectedDoctor] = useState(defaultDoctor || '');
  const [selectedTime, setSelectedTime] = useState(defaultTime || '');
  const [selectedItems, setSelectedItems] = useState<string[]>(['침']);
  const [memo, setMemo] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 2-step 상태: 1 = 환자+담당의+치료항목, 2 = 날짜+시간선택
  const [currentStep, setCurrentStep] = useState(1);

  // Step 2에서 사용할 예약 날짜 (기본값: 달력에서 선택한 날짜)
  const [reservationDate, setReservationDate] = useState(selectedDate);

  // 기본값 설정
  useEffect(() => {
    if (defaultDoctor) setSelectedDoctor(defaultDoctor);
    if (defaultTime) setSelectedTime(defaultTime);
  }, [defaultDoctor, defaultTime]);

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

  // 모달 닫힐 때 상태 초기화
  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
      setSearchResults([]);
      setSelectedPatient(initialPatient ? {
        id: initialPatient.id,
        chartNo: initialPatient.chartNo,
        name: initialPatient.name,
        phone: initialPatient.phone,
      } : null);
      setShowSearchResults(false);
      setSelectedDoctor(defaultDoctor || '');
      setSelectedTime(defaultTime || '');
      setSelectedItems(initialDetails ? parseDetailsToItems(initialDetails) : ['침']);
      setMemo('');
      setError(null);
      setCurrentStep(1); // step 초기화
      setReservationDate(selectedDate); // 날짜 초기화
    }
  }, [isOpen, initialPatient, defaultDoctor, defaultTime, initialDetails, selectedDate]);

  // initialDetails가 변경되면 진료항목 자동 선택
  useEffect(() => {
    if (initialDetails) {
      setSelectedItems(parseDetailsToItems(initialDetails));
    }
  }, [initialDetails]);

  // 외부에서 환자 정보가 넘어온 경우 첫 번째 의사 자동 선택
  useEffect(() => {
    if (initialPatient && doctors.length > 0 && !selectedDoctor) {
      setSelectedDoctor(doctors[0].name);
    }
  }, [initialPatient, doctors, selectedDoctor]);

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
  const handleSelectPatient = (patient: PatientSearchResult) => {
    setSelectedPatient(patient);
    setSearchTerm('');
    setSearchResults([]);
    setShowSearchResults(false);
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

  // 의사별, 시간별 슬롯 사용량 계산
  const slotUsageByDoctorAndTime = useMemo(() => {
    const usage: Record<string, Record<string, number>> = {};

    doctors.forEach(doc => {
      usage[doc.name] = {};
      TIME_SLOTS.forEach(time => {
        usage[doc.name][time] = 0;
      });
    });

    reservations.forEach(res => {
      if (!usage[res.doctor]) return;

      const [hour, min] = res.time.split(':').map(Number);
      const roundedMin = min < 30 ? '00' : '30';
      const roundedTime = `${hour.toString().padStart(2, '0')}:${roundedMin}`;

      if (usage[res.doctor][roundedTime] !== undefined) {
        usage[res.doctor][roundedTime] += getSlotUsage(res);
      }
    });

    return usage;
  }, [reservations, doctors]);

  // 선택된 진료 항목들의 총 슬롯 사용량
  const requiredSlots = useMemo(() => {
    return selectedItems.reduce((total, item) => total + (ITEM_SLOT_USAGE[item] || 1), 0);
  }, [selectedItems]);

  // 선택된 의사와 시간의 잔여 슬롯 계산
  const getRemainingSlots = (doctor: string, time: string): number => {
    const used = slotUsageByDoctorAndTime[doctor]?.[time] || 0;
    return Math.max(0, SLOT_CAPACITY - used);
  };

  // 예약 가능 여부 체크 (현재 슬롯 + 다음 슬롯까지 확인)
  const checkAvailability = (): { canBook: boolean; message: string; overflow: number } => {
    if (!selectedDoctor || !selectedTime) {
      return { canBook: false, message: '의사와 시간을 선택해주세요.', overflow: 0 };
    }

    const currentRemaining = getRemainingSlots(selectedDoctor, selectedTime);

    // 현재 슬롯에 충분한 공간이 있는 경우
    if (requiredSlots <= currentRemaining) {
      return { canBook: true, message: `예약 가능 (${requiredSlots}칸 사용)`, overflow: 0 };
    }

    // 현재 슬롯이 꽉 찬 경우
    if (currentRemaining === 0) {
      return { canBook: false, message: '선택한 시간은 이미 꽉 찼습니다.', overflow: 0 };
    }

    // 현재 슬롯에 일부 공간만 있는 경우 - 다음 슬롯으로 넘치는지 체크
    const overflow = requiredSlots - currentRemaining;
    const nextTime = getNextTimeSlot(selectedTime);

    if (!nextTime) {
      return { canBook: false, message: '마지막 시간대입니다. 다음 슬롯으로 넘길 수 없습니다.', overflow: 0 };
    }

    const nextRemaining = getRemainingSlots(selectedDoctor, nextTime);

    if (overflow <= nextRemaining) {
      return {
        canBook: true,
        message: `예약 가능 (${currentRemaining}칸 사용 + 다음 시간 ${overflow}칸 사용)`,
        overflow,
      };
    }

    return {
      canBook: false,
      message: `예약 불가: ${requiredSlots}칸 필요, 현재 ${currentRemaining}칸 + 다음 시간 ${nextRemaining}칸 = ${currentRemaining + nextRemaining}칸 가용`,
      overflow: 0,
    };
  };

  const availability = checkAvailability();

  // Step1 → Step2 이동 (환자/담당의/치료항목 선택 후)
  const handleNextStep = () => {
    setError(null);
    if (!selectedPatient) {
      setError('환자를 검색하여 선택해주세요.');
      return;
    }
    if (!selectedDoctor) {
      setError('담당 의사를 선택해주세요.');
      return;
    }
    if (selectedItems.length === 0) {
      setError('치료 항목을 하나 이상 선택해주세요.');
      return;
    }
    setCurrentStep(2);
  };

  // Step2 → Step1 뒤로가기
  const handlePrevStep = () => {
    setError(null);
    setCurrentStep(1);
  };

  // 시간별 슬롯 정보 (선택된 의사 기준)
  const timeSlotInfo: SlotInfo[] = useMemo(() => {
    if (!selectedDoctor) return [];

    return TIME_SLOTS.map(time => {
      const used = slotUsageByDoctorAndTime[selectedDoctor]?.[time] || 0;
      return {
        time,
        usedSlots: used,
        remainingSlots: Math.max(0, SLOT_CAPACITY - used),
      };
    });
  }, [selectedDoctor, slotUsageByDoctorAndTime]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedPatient) {
      setError('환자를 검색하여 선택해주세요.');
      return;
    }

    if (!availability.canBook) {
      setError(availability.message);
      return;
    }

    setIsSubmitting(true);

    try {
      await onSave({
        patientId: selectedPatient.id,
        date: reservationDate, // Step 2에서 선택한 날짜 사용
        time: selectedTime,
        doctor: selectedDoctor,
        item: selectedItems.join(','), // 복수 선택된 항목을 쉼표로 연결
        type: '재진', // 기본값
        memo,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || '예약 저장 실패');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        {/* 헤더 */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            {currentStep === 2 && (
              <button
                onClick={handlePrevStep}
                className="p-1 hover:bg-gray-100 rounded text-gray-600"
              >
                <i className="fa-solid fa-arrow-left text-lg"></i>
              </button>
            )}
            <h3 className="text-lg font-bold">
              새 예약 {currentStep === 1 ? '- 환자 선택' : '- 시간 선택'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <i className="fa-solid fa-xmark text-xl"></i>
          </button>
        </div>

        {/* Step Indicator */}
        <div className="px-6 py-3 bg-gray-50 border-b">
          <div className="flex items-center justify-center gap-2">
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${
              currentStep === 1 ? 'bg-clinic-primary text-white' : 'bg-gray-200 text-gray-600'
            }`}>
              <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs">1</span>
              환자/치료
            </div>
            <i className="fa-solid fa-chevron-right text-gray-400 text-xs"></i>
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${
              currentStep === 2 ? 'bg-clinic-primary text-white' : 'bg-gray-200 text-gray-600'
            }`}>
              <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs">2</span>
              시간 선택
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* 에러 메시지 */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              <i className="fa-solid fa-circle-exclamation mr-2"></i>
              {error}
            </div>
          )}

          {/* ===== STEP 1: 환자 + 담당의 + 치료항목 선택 ===== */}
          {currentStep === 1 && (
            <>
              {/* 환자 검색/선택 */}
              <div ref={searchRef}>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  환자 <span className="text-red-500">*</span>
                </label>

                {selectedPatient ? (
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

                    {showSearchResults && searchTerm.length >= 2 && searchResults.length === 0 && !isSearching && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-4 text-center text-gray-500">
                        <i className="fa-solid fa-user-slash text-2xl mb-2"></i>
                        <p>검색 결과가 없습니다</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 담당 의사 선택 - Step 1로 이동 */}
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

              {/* 진료 항목 - 복수 선택 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  진료 항목 <span className="text-red-500">*</span>
                  <span className="ml-2 text-xs text-gray-500 font-normal">
                    (선택: {selectedItems.length}개, 총 {requiredSlots}칸)
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
                {selectedItems.length > 0 && (
                  <div className="mt-2 text-sm text-gray-600">
                    선택됨: {selectedItems.join(', ')}
                  </div>
                )}
              </div>

              {/* Step1 버튼 */}
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
                  onClick={handleNextStep}
                  disabled={!selectedPatient || !selectedDoctor || selectedItems.length === 0}
                  className="flex-1 py-2.5 bg-clinic-primary text-white font-semibold rounded-lg hover:bg-clinic-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  다음: 날짜/시간 선택 <i className="fa-solid fa-arrow-right ml-2"></i>
                </button>
              </div>
            </>
          )}

          {/* ===== STEP 2: 날짜 + 시간 선택 (프리뷰) ===== */}
          {currentStep === 2 && (
            <>
              {/* 선택된 환자/담당의/치료 요약 */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-clinic-primary text-white rounded-full flex items-center justify-center font-bold text-sm">
                      {selectedPatient?.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">
                        {selectedPatient?.name}
                        <span className="ml-2 text-sm font-normal text-gray-500">
                          ({selectedPatient?.chartNo})
                        </span>
                      </p>
                      <p className="text-sm text-gray-600">
                        담당: <span className="font-medium">{selectedDoctor}</span>
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {selectedItems.map(item => (
                    <span key={item} className="px-2 py-0.5 bg-clinic-primary/20 text-clinic-primary text-xs rounded-full font-medium">
                      {item}
                    </span>
                  ))}
                  <span className="px-2 py-0.5 bg-gray-200 text-gray-600 text-xs rounded-full">
                    총 {requiredSlots}칸
                  </span>
                </div>
              </div>

              {/* 예약 날짜 선택 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  예약 날짜 <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={reservationDate}
                  onChange={(e) => {
                    setReservationDate(e.target.value);
                    setSelectedTime(''); // 날짜 변경 시 시간 초기화
                  }}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-clinic-primary focus:border-clinic-primary"
                />
                <p className="mt-1 text-xs text-gray-500">
                  {(() => {
                    const date = new Date(reservationDate);
                    const days = ['일', '월', '화', '수', '목', '금', '토'];
                    return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 (${days[date.getDay()]})`;
                  })()}
                </p>
              </div>

              {/* 예약 시간 - 비주얼 프리뷰 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  예약 시간 <span className="text-red-500">*</span>
                  {selectedTime && (
                    <span className="ml-2 text-clinic-primary font-semibold">{selectedTime} 선택됨</span>
                  )}
                </label>

                {/* 시간 슬롯 비주얼 프리뷰 */}
                <div className="border rounded-lg overflow-hidden">
                  {/* 프리뷰 헤더 */}
                  <div className="px-3 py-2 bg-gray-100 border-b flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">
                      <i className="fa-solid fa-clock mr-1"></i>
                      {selectedDoctor} 원장 시간표
                    </span>
                    <span className="text-xs text-gray-500">
                      필요: <span className="font-bold text-clinic-primary">{requiredSlots}칸</span>
                    </span>
                  </div>

                  {/* 시간 슬롯 그리드 */}
                  <div className="p-3 bg-gray-50 max-h-72 overflow-y-auto">
                    <div className="space-y-1">
                      {timeSlotInfo.map((slot) => {
                        const isSelected = selectedTime === slot.time;
                        const isFull = slot.remainingSlots === 0;
                        const canFit = slot.remainingSlots >= requiredSlots;
                        const needsOverflow = !canFit && slot.remainingSlots > 0;

                        // 예약 가능 여부 미리 체크
                        let slotAvailable = false;
                        let overflowSlots = 0;
                        if (!isFull) {
                          if (canFit) {
                            slotAvailable = true;
                          } else if (needsOverflow) {
                            const nextTime = getNextTimeSlot(slot.time);
                            if (nextTime) {
                              const nextRemaining = getRemainingSlots(selectedDoctor, nextTime);
                              overflowSlots = requiredSlots - slot.remainingSlots;
                              if (overflowSlots <= nextRemaining) {
                                slotAvailable = true;
                              }
                            }
                          }
                        }

                        // 비주얼 슬롯 바
                        const usedSlots = SLOT_CAPACITY - slot.remainingSlots;
                        const usedWidth = (usedSlots / SLOT_CAPACITY) * 100;
                        const previewWidth = slotAvailable && isSelected ? (requiredSlots / SLOT_CAPACITY) * 100 : 0;

                        return (
                          <button
                            key={slot.time}
                            type="button"
                            onClick={() => slotAvailable && setSelectedTime(slot.time)}
                            disabled={!slotAvailable}
                            className={`w-full p-2 rounded-lg text-left transition-all ${
                              isSelected
                                ? 'bg-clinic-primary/10 ring-2 ring-clinic-primary'
                                : !slotAvailable
                                  ? 'bg-gray-100 cursor-not-allowed opacity-50'
                                  : 'bg-white hover:bg-blue-50 border border-gray-200'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className={`font-semibold ${isSelected ? 'text-clinic-primary' : !slotAvailable ? 'text-gray-400' : 'text-gray-700'}`}>
                                {slot.time}
                              </span>
                              <span className={`text-xs ${!slotAvailable ? 'text-gray-400' : 'text-gray-500'}`}>
                                잔여 {slot.remainingSlots}/{SLOT_CAPACITY}
                                {needsOverflow && slotAvailable && (
                                  <span className="ml-1 text-orange-500">
                                    (+{overflowSlots}→다음)
                                  </span>
                                )}
                              </span>
                            </div>
                            {/* 슬롯 바 */}
                            <div className="h-3 bg-gray-200 rounded-full overflow-hidden flex">
                              {/* 사용 중인 슬롯 */}
                              <div
                                className="h-full bg-gray-400 transition-all"
                                style={{ width: `${usedWidth}%` }}
                              />
                              {/* 예약 프리뷰 */}
                              {isSelected && slotAvailable && (
                                <div
                                  className="h-full bg-clinic-primary animate-pulse transition-all"
                                  style={{ width: `${Math.min(previewWidth, 100 - usedWidth)}%` }}
                                />
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 범례 */}
                  <div className="px-3 py-2 bg-gray-100 border-t text-xs text-gray-600 flex items-center gap-4">
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 bg-gray-400 rounded"></span> 예약됨
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 bg-clinic-primary rounded"></span> 새 예약
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 bg-gray-200 rounded"></span> 여유
                    </span>
                  </div>
                </div>
              </div>

              {/* 예약 가능 여부 표시 */}
              {selectedTime && (
                <div className={`p-3 rounded-lg text-sm ${
                  availability.canBook
                    ? 'bg-green-50 border border-green-200 text-green-700'
                    : 'bg-red-50 border border-red-200 text-red-700'
                }`}>
                  <i className={`fa-solid ${availability.canBook ? 'fa-check-circle' : 'fa-times-circle'} mr-2`}></i>
                  {availability.message}
                  {availability.overflow > 0 && (
                    <p className="mt-1 text-xs">
                      * 다음 시간대({getNextTimeSlot(selectedTime)})로 {availability.overflow}칸이 넘어갑니다.
                    </p>
                  )}
                </div>
              )}

              {/* 메모 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  메모
                </label>
                <textarea
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-clinic-primary focus:border-clinic-primary"
                  rows={2}
                  placeholder="예약 관련 메모"
                />
              </div>

              {/* Step2 버튼 */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={handlePrevStep}
                  className="flex-1 py-2.5 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-colors"
                >
                  <i className="fa-solid fa-arrow-left mr-2"></i> 이전
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !availability.canBook}
                  className="flex-1 py-2.5 bg-clinic-primary text-white font-semibold rounded-lg hover:bg-clinic-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <i className="fa-solid fa-spinner fa-spin mr-2"></i>
                      저장 중...
                    </>
                  ) : (
                    '예약 저장'
                  )}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
};

export default NewReservationModal;
