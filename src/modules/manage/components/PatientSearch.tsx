
import React, { useState, useEffect } from 'react';
import { Patient, ConsultationItem } from '../types';
import * as api from '../lib/api';
import type { ReceiptHistoryItem } from '../lib/api';

// 선택된 진료항목 형식
export interface SelectedConsultationItem {
  itemId: number;
  itemName: string;
  subItemId?: number;
  subItemName?: string;
}

interface PatientSearchProps {
  // 심플 모드 props (수납 히스토리 조회용)
  allPatients?: Patient[];
  onSelectPatient?: (patient: Patient) => void;
  // 풀 모드 props (접수용)
  addPatientToConsultation?: (patient: Patient, details?: string, memo?: string) => void;
  addPatientToTreatment?: (patient: Patient, details?: string, memo?: string) => void;
  updatePatientInfo?: (patient: Patient) => void;
  deletePatient?: (patientId: number) => void;
  onClose?: () => void;
  consultationItems?: ConsultationItem[];
  onReservation?: (patient: Patient) => void;
}

const DetailItem: React.FC<{ label: string; value?: string }> = ({ label, value }) => (
    <div>
        <dt className="text-sm font-medium text-gray-500">{label}</dt>
        <dd className="mt-1 text-sm text-gray-900">{value || '-'}</dd>
    </div>
);

const PatientSearch: React.FC<PatientSearchProps> = ({
  allPatients,
  onSelectPatient,
  addPatientToConsultation,
  addPatientToTreatment,
  updatePatientInfo,
  deletePatient,
  onClose,
  consultationItems = [],
  onReservation
}) => {
  // 심플 모드 여부 판단 (수납 히스토리 조회 전용 모드)
  const isSimpleMode = !addPatientToConsultation && !addPatientToTreatment;

  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Patient[]>([]);
  const [view, setView] = useState<'search' | 'detail' | 'edit' | 'selectItems' | 'selectTreatmentItems' | 'paymentHistory'>('search');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [editFormData, setEditFormData] = useState<Patient | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // 수납 히스토리 상태
  const [receiptHistory, setReceiptHistory] = useState<ReceiptHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // 진료항목 선택 상태
  const [selectedConsultationItems, setSelectedConsultationItems] = useState<SelectedConsultationItem[]>([]);

  // 새로운 진료 선택 상태
  const [selectedCategory, setSelectedCategory] = useState<'acupuncture' | 'accident' | null>(null);
  const [insuranceType, setInsuranceType] = useState<string>('건보');
  const [selectedTreatments, setSelectedTreatments] = useState<string[]>([]);
  const [includeHerbal, setIncludeHerbal] = useState<boolean>(false);
  const [selectedHerbalType, setSelectedHerbalType] = useState<string>('');
  const [customHerbalNote, setCustomHerbalNote] = useState<string>('');
  const [receptionMemo, setReceptionMemo] = useState<string>('');

  // 선택 초기화 함수
  const resetSelections = () => {
    setSelectedCategory(null);
    setInsuranceType('건보');
    setSelectedTreatments([]);
    setIncludeHerbal(false);
    setSelectedHerbalType('');
    setCustomHerbalNote('');
    setReceptionMemo('');
  };

  // 서버사이드 검색 (디바운싱 적용)
  useEffect(() => {
    // 검색어가 비어있으면 초기화
    if (searchTerm.trim() === '') {
      setSearchResults([]);
      return;
    }

    // 서버사이드 검색 (디바운싱)
    const timeoutId = setTimeout(async () => {
      try {
        setIsSearching(true);
        const results = await api.searchPatients(searchTerm);
        setSearchResults(results);
      } catch (error) {
        console.error('❌ 검색 오류:', error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  useEffect(() => {
    if (view === 'edit' && selectedPatient) {
        setEditFormData(JSON.parse(JSON.stringify(selectedPatient)));
    } else {
        setEditFormData(null);
    }
  }, [view, selectedPatient]);
  
  const handleSelectPatient = async (patient: Patient) => {
    setSelectedPatient(patient);

    // 심플 모드에서는 수납 히스토리 뷰로 이동
    if (isSimpleMode) {
      setView('paymentHistory');
      setIsLoadingHistory(true);
      try {
        if (patient.chartNumber) {
          const response = await api.fetchPatientReceiptHistory({ chartNo: patient.chartNumber });
          setReceiptHistory(response.receipts);
        } else {
          setReceiptHistory([]);
        }
      } catch (error) {
        console.error('수납 히스토리 조회 오류:', error);
        setReceiptHistory([]);
      } finally {
        setIsLoadingHistory(false);
      }
    } else {
      setView('detail');
    }
  };

  const handleBackToSearch = () => {
    setSelectedPatient(null);
    setView('search');
    setSearchTerm('');
  };


  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (!editFormData) return;
    const { id, value } = e.target;
    setEditFormData({ ...editFormData, [id]: value });
  };
  
  const handleRadioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!editFormData) return;
    const { name, value } = e.target;
    setEditFormData({ ...editFormData, [name]: value as 'male' | 'female' });
  };

  const handleSave = () => {
    if (editFormData && updatePatientInfo) {
        if (!editFormData.name.trim()) {
            alert('환자 이름은 필수입니다.');
            return;
        }
        updatePatientInfo(editFormData);
        setSelectedPatient(editFormData);
        setView('detail');
    }
  };

  // 이전 진료정보 파싱 함수
  const parseLastTreatmentInfo = async (patientId: number) => {
    try {
      // DB에서 마지막 진료정보 조회
      const lastInfo = await api.getLastTreatmentInfo(patientId);
      if (lastInfo) {
        const details = lastInfo.details || '';

        // 침치료 파싱
        const acupunctureMatch = details.match(/침치료\(([^)]+)\)\s*-\s*([^,]+)/);
        if (acupunctureMatch) {
          setSelectedCategory('acupuncture');
          setInsuranceType(acupunctureMatch[1]);
          setSelectedTreatments(acupunctureMatch[2].split('+').map((t: string) => t.trim()));
        }

        // 자보 파싱
        const accidentMatch = details.match(/자보\s*-\s*([^,]+)/);
        if (accidentMatch && !acupunctureMatch) {
          setSelectedCategory('accident');
          setSelectedTreatments(accidentMatch[1].split('+').map((t: string) => t.trim()));
        }

        // 약상담 파싱
        const herbalMatch = details.match(/약상담-([^,()\s]+)(?:\(([^)]+)\))?/);
        if (herbalMatch) {
          setIncludeHerbal(true);
          setSelectedHerbalType(herbalMatch[1]);
          if (herbalMatch[2]) {
            setCustomHerbalNote(herbalMatch[2]);
          }
        }
      }
    } catch (error) {
      console.error('이전 진료정보 조회 오류:', error);
    }
  };

  const handleDelete = () => {
    if (selectedPatient && deletePatient) {
        deletePatient(selectedPatient.id);
    }
  };
  
  if (view === 'edit' && editFormData) {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between mb-4 -mt-2">
                 <button onClick={() => setView('detail')} className="flex items-center text-gray-600 hover:text-gray-900 font-semibold text-sm">
                    <i className="fa-solid fa-arrow-left mr-2"></i>
                    <span>상세 정보로 돌아가기</span>
                </button>
                <h3 className="text-lg font-semibold text-clinic-text-primary">
                    {editFormData.name}님 정보 수정
                </h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700">이름</label>
                    <input type="text" id="name" value={editFormData.name} onChange={handleFormChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-clinic-secondary focus:border-clinic-secondary sm:text-sm" />
                </div>
                <div>
                    <label htmlFor="chartNumber" className="block text-sm font-medium text-gray-700">차트번호</label>
                    <input type="text" id="chartNumber" value={editFormData.chartNumber || ''} onChange={handleFormChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-clinic-secondary focus:border-clinic-secondary sm:text-sm" />
                </div>
                <div>
                    <label htmlFor="dob" className="block text-sm font-medium text-gray-700">생년월일</label>
                    <input type="date" id="dob" value={editFormData.dob || ''} onChange={handleFormChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-clinic-secondary focus:border-clinic-secondary sm:text-sm" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">성별</label>
                    <div className="mt-2 flex items-center space-x-6">
                        <label className="inline-flex items-center">
                        <input type="radio" name="gender" value="male" checked={editFormData.gender === 'male'} onChange={handleRadioChange} className="focus:ring-clinic-secondary h-4 w-4 text-clinic-secondary border-gray-300" />
                        <span className="ml-2 text-sm text-gray-700">남성</span>
                        </label>
                        <label className="inline-flex items-center">
                        <input type="radio" name="gender" value="female" checked={editFormData.gender === 'female'} onChange={handleRadioChange} className="focus:ring-clinic-secondary h-4 w-4 text-clinic-secondary border-gray-300" />
                        <span className="ml-2 text-sm text-gray-700">여성</span>
                        </label>
                    </div>
                </div>
                 <div className="md:col-span-2">
                    <label htmlFor="address" className="block text-sm font-medium text-gray-700">주소</label>
                    <input type="text" id="address" value={editFormData.address || ''} onChange={handleFormChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-clinic-secondary focus:border-clinic-secondary sm:text-sm" />
                </div>
                <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-gray-700">연락처</label>
                    <input type="tel" id="phone" value={editFormData.phone || ''} onChange={handleFormChange} placeholder="010-1234-5678" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-clinic-secondary focus:border-clinic-secondary sm:text-sm" />
                </div>
                <div>
                    <label htmlFor="registrationDate" className="block text-sm font-medium text-gray-700">등록일</label>
                    <input type="date" id="registrationDate" value={editFormData.registrationDate || ''} onChange={handleFormChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-clinic-secondary focus:border-clinic-secondary sm:text-sm" />
                </div>
                <div className="md:col-span-2">
                    <label htmlFor="referralPath" className="block text-sm font-medium text-gray-700">유입경로</label>
                    <input type="text" id="referralPath" value={editFormData.referralPath || ''} onChange={handleFormChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-clinic-secondary focus:border-clinic-secondary sm:text-sm" />
                </div>
            </div>

            <div className="flex justify-between items-center pt-4 border-t mt-6">
                <button 
                    type="button" 
                    onClick={handleDelete} 
                    className="px-4 py-2 bg-red-600 text-white font-semibold rounded-md hover:bg-red-700 transition-colors"
                >
                    <i className="fa-solid fa-trash-can mr-2"></i>
                    삭제
                </button>
                <div>
                    <button type="button" onClick={() => setView('detail')} className="mr-2 px-6 py-2 bg-gray-200 text-gray-800 font-semibold rounded-md hover:bg-gray-300 transition-colors">취소</button>
                    <button type="button" onClick={handleSave} className="px-6 py-2 bg-clinic-primary text-white font-semibold rounded-md hover:bg-clinic-secondary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-clinic-secondary transition-colors">저장하기</button>
                </div>
            </div>
        </div>
    );
  }

  // 수납 히스토리 뷰 (심플 모드)
  if (view === 'paymentHistory' && selectedPatient) {
    return (
      <div className="flex flex-col h-[70vh]">
        {/* 헤더 */}
        <div className="flex-shrink-0">
          <div className="flex items-center mb-4 -mt-2">
            <button onClick={handleBackToSearch} className="flex items-center text-gray-600 hover:text-gray-900 font-semibold text-sm">
              <i className="fa-solid fa-arrow-left mr-2"></i>
              <span>검색 결과로 돌아가기</span>
            </button>
          </div>

          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-200">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-blue-500 text-white flex items-center justify-center text-xl font-bold">
                {selectedPatient.name.charAt(0)}
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-800">{selectedPatient.name}</h3>
                <p className="text-sm text-gray-500">
                  차트번호: {selectedPatient.chartNumber || 'N/A'}
                  {selectedPatient.phone && ` | ${selectedPatient.phone}`}
                </p>
              </div>
            </div>
          </div>

          <h4 className="text-lg font-semibold text-gray-700 mt-4 mb-2 flex items-center gap-2">
            <i className="fa-solid fa-clock-rotate-left text-blue-500"></i>
            수납 히스토리
          </h4>
        </div>

        {/* 수납 내역 리스트 */}
        <div className="flex-1 overflow-y-auto min-h-0 border rounded-lg bg-white">
          {isLoadingHistory ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <i className="fa-solid fa-spinner fa-spin text-3xl text-blue-500 mb-2"></i>
                <p className="text-gray-500">수납 내역을 불러오는 중...</p>
              </div>
            </div>
          ) : receiptHistory.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-gray-400">
                <i className="fa-solid fa-receipt text-5xl mb-3"></i>
                <p className="text-lg">수납 내역이 없습니다.</p>
              </div>
            </div>
          ) : (
            <div className="divide-y">
              {receiptHistory.map((receipt, index) => (
                <div key={receipt.id || index} className="p-4 hover:bg-gray-50">
                  {/* 날짜 및 시간 */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-700">
                        {receipt.receipt_time ? new Date(receipt.receipt_time).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }) : '-'}
                      </span>
                      <span className="text-xs text-gray-400">
                        {receipt.receipt_time ? new Date(receipt.receipt_time).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                      {receipt.insurance_type && (
                        <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                          receipt.insurance_type === '건보' ? 'bg-blue-100 text-blue-700' :
                          receipt.insurance_type === '자보' ? 'bg-purple-100 text-purple-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {receipt.insurance_type}
                        </span>
                      )}
                    </div>
                    <span className="text-lg font-bold text-gray-800">
                      {(receipt.total_amount || 0).toLocaleString()}원
                    </span>
                  </div>

                  {/* 금액 상세 */}
                  <div className="flex gap-4 text-xs text-gray-500 mb-2">
                    <span>급여: {(receipt.insurance_self || 0).toLocaleString()}원</span>
                    <span>비급여: {(receipt.general_amount || 0).toLocaleString()}원</span>
                    {receipt.unpaid && receipt.unpaid > 0 && (
                      <span className="text-red-500 font-medium">미수: {receipt.unpaid.toLocaleString()}원</span>
                    )}
                  </div>

                  {/* 치료 요약 */}
                  {receipt.treatment_summary && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {receipt.treatment_summary.acupuncture && (
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-xs rounded">침</span>
                      )}
                      {receipt.treatment_summary.choona && (
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-xs rounded">추나</span>
                      )}
                      {receipt.treatment_summary.yakchim && (
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-xs rounded">약침</span>
                      )}
                      {receipt.treatment_summary.uncovered?.map((item, i) => (
                        <span key={i} className="px-2 py-0.5 bg-green-50 text-green-600 text-xs rounded">
                          {item.name}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* 패키지 정보 및 메모 */}
                  {(receipt.package_info || receipt.memo) && (
                    <div className="mt-2 p-2 bg-amber-50 rounded border border-amber-100">
                      {receipt.package_info && (
                        <p className="text-sm text-amber-700 font-medium">
                          <i className="fa-solid fa-tag mr-1"></i>
                          {receipt.package_info}
                        </p>
                      )}
                      {receipt.memo && (
                        <p className="text-sm text-amber-600 mt-1">
                          <i className="fa-solid fa-sticky-note mr-1"></i>
                          {receipt.memo}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (view === 'detail' && selectedPatient) {
    return (
        <div>
            <div className="flex items-center mb-4 -mt-2">
                 <button onClick={handleBackToSearch} className="flex items-center text-gray-600 hover:text-gray-900 font-semibold text-sm">
                    <i className="fa-solid fa-arrow-left mr-2"></i>
                    <span>검색 결과로 돌아가기</span>
                </button>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <div className="flex justify-between items-start">
                    <div>
                        <h3 className="text-xl font-bold text-clinic-primary">{selectedPatient.name}</h3>
                        <p className="text-sm text-clinic-text-secondary">차트번호: {selectedPatient.chartNumber || 'N/A'}</p>
                    </div>
                    {updatePatientInfo && (
                      <button onClick={() => setView('edit')} className="px-4 py-2 bg-white text-sm text-clinic-secondary font-semibold rounded-md border border-clinic-secondary hover:bg-gray-50 transition-colors">
                          <i className="fa-solid fa-pencil mr-2"></i>수정
                      </button>
                    )}
                </div>
            </div>
            
            <dl className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-6">
                <DetailItem label="생년월일" value={selectedPatient.dob} />
                <DetailItem label="성별" value={selectedPatient.gender === 'male' ? '남성' : selectedPatient.gender === 'female' ? '여성' : ''} />
                <DetailItem label="연락처" value={selectedPatient.phone} />
                <DetailItem label="등록일" value={selectedPatient.registrationDate} />
                <div className="md:col-span-2">
                    <DetailItem label="유입경로" value={selectedPatient.referralPath} />
                </div>
                <div className="md:col-span-2">
                    <DetailItem label="주소" value={selectedPatient.address} />
                </div>
            </dl>
            
            <div className="flex justify-end space-x-2 pt-4 border-t mt-6">
                {addPatientToConsultation && (
                  <button
                      onClick={() => {
                          setSelectedConsultationItems([]);
                          setView('selectItems');
                      }}
                      className="px-4 py-2 bg-clinic-secondary text-white font-semibold rounded-md hover:bg-blue-700 transition-colors"
                  >
                      <i className="fa-solid fa-user-doctor mr-2"></i>재초진 접수
                  </button>
                )}
                {addPatientToTreatment && (
                  <button
                      onClick={async () => {
                          resetSelections();
                          await parseLastTreatmentInfo(selectedPatient.id);
                          setView('selectTreatmentItems');
                      }}
                      className="px-4 py-2 bg-clinic-accent text-white font-semibold rounded-md hover:bg-green-700 transition-colors"
                  >
                      <i className="fa-solid fa-bed-pulse mr-2"></i>재진 접수
                  </button>
                )}
                {onReservation && (
                    <button
                        onClick={() => {
                            onReservation(selectedPatient);
                            onClose?.();
                        }}
                        className="px-4 py-2 bg-orange-500 text-white font-semibold rounded-md hover:bg-orange-600 transition-colors"
                    >
                        <i className="fa-solid fa-calendar-plus mr-2"></i>예약
                    </button>
                )}
            </div>
        </div>
    );
  }

  // 진료항목 선택 뷰
  if (view === 'selectItems' && selectedPatient) {
    // 카테고리별 옵션 정의
    const INSURANCE_TYPES = ['건보', '차상위', '1종', '2종', '임산부', '산정특례', '일반'];
    const ACUPUNCTURE_TREATMENTS = ['침', '추나', '약침', '초음파'];
    const ACCIDENT_TREATMENTS = ['침', '추나', '자보약'];
    const HERBAL_TYPES = ['상비약', '감기약', '맞춤한약'];

    const toggleTreatment = (treatment: string) => {
      setSelectedTreatments(prev =>
        prev.includes(treatment)
          ? prev.filter(t => t !== treatment)
          : [...prev, treatment]
      );
    };

    const handleConfirmNewSelection = () => {
      const parts: string[] = [];

      // 침치료 또는 자보
      if (selectedCategory === 'acupuncture' && selectedTreatments.length > 0) {
        const treatments = selectedTreatments.join('+');
        parts.push(`침치료(${insuranceType}) - ${treatments}`);
      } else if (selectedCategory === 'accident' && selectedTreatments.length > 0) {
        const treatments = selectedTreatments.join('+');
        parts.push(`자보 - ${treatments}`);
      }

      // 약상담 (추가 선택)
      if (includeHerbal && selectedHerbalType) {
        if (selectedHerbalType === '맞춤한약') {
          parts.push(`약상담-맞춤한약${customHerbalNote ? `(${customHerbalNote})` : ''}`);
        } else {
          parts.push(`약상담-${selectedHerbalType}`);
        }
      }

      const detailsText = parts.join(', ');

      if (detailsText && addPatientToConsultation) {
        addPatientToConsultation(selectedPatient, detailsText, receptionMemo || undefined);
        resetSelections();
        onClose?.();
      }
    };

    const canSubmit = () => {
      // 침치료/자보가 선택된 경우: 치료 항목이 있어야 함
      if (selectedCategory) {
        if (selectedTreatments.length === 0) return false;
      }
      // 약상담만 선택한 경우: 약상담 유형이 있어야 함
      if (!selectedCategory && includeHerbal) {
        return selectedHerbalType !== '';
      }
      // 약상담이 추가로 선택된 경우: 약상담 유형이 있어야 함
      if (includeHerbal && !selectedHerbalType) return false;

      // 최소 하나는 선택되어야 함
      return selectedCategory !== null || (includeHerbal && selectedHerbalType !== '');
    };

    return (
      <div className="flex flex-col h-[75vh]">
        {/* 상단: 뒤로가기 + 환자정보 + 접수메모 + 버튼 */}
        <div className="flex-shrink-0">
          <div className="flex items-center mb-2 -mt-2">
            <button onClick={() => { resetSelections(); setView('detail'); }} className="flex items-center text-gray-600 hover:text-gray-900 font-semibold text-sm">
              <i className="fa-solid fa-arrow-left mr-2"></i>
              <span>환자 정보로 돌아가기</span>
            </button>
          </div>

          <div className="bg-gray-50 p-3 rounded-lg mb-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex-shrink-0">
                <p className="font-bold text-clinic-primary text-lg">{selectedPatient.name}</p>
                <p className="text-xs text-gray-500">재초진 접수</p>
              </div>
              <div className="flex-1">
                <input
                  type="text"
                  value={receptionMemo}
                  onChange={(e) => setReceptionMemo(e.target.value)}
                  placeholder="접수 메모 (붉은글씨 표시)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-400 focus:border-red-400"
                />
              </div>
              <div className="flex-shrink-0 flex items-center gap-2">
                <button
                  onClick={() => { resetSelections(); setView('detail'); }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-colors text-sm"
                >
                  취소
                </button>
                <button
                  onClick={handleConfirmNewSelection}
                  disabled={!canSubmit()}
                  className={`px-4 py-2 font-semibold rounded-lg transition-all text-sm ${
                    canSubmit()
                      ? 'bg-clinic-secondary text-white hover:bg-blue-700 shadow-md'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  <i className="fa-solid fa-user-doctor mr-1"></i>
                  접수
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 2단 레이아웃: 좌측 진료유형 / 우측 세부항목 */}
        <div className="flex-1 overflow-y-auto min-h-0 mb-3">
          <div className="grid grid-cols-2 gap-4 h-full">
            {/* 좌측: 진료 유형 선택 */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">진료 유형 선택</label>

              {/* 침치료 */}
              <button
                onClick={() => { setSelectedCategory(selectedCategory === 'acupuncture' ? null : 'acupuncture'); setSelectedTreatments([]); }}
                className={`w-full p-3 rounded-lg border-2 transition-all flex items-center gap-3 ${
                  selectedCategory === 'acupuncture'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className={`w-9 h-9 rounded-full flex items-center justify-center ${
                  selectedCategory === 'acupuncture' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-500'
                }`}>
                  <i className="fa-solid fa-hand-dots"></i>
                </div>
                <div className="text-left flex-1">
                  <span className={`font-bold ${selectedCategory === 'acupuncture' ? 'text-blue-600' : 'text-gray-700'}`}>
                    침치료
                  </span>
                  <p className="text-xs text-gray-500">건강보험</p>
                </div>
                {selectedCategory === 'acupuncture' && <i className="fa-solid fa-check text-blue-500"></i>}
              </button>

              {/* 자보 */}
              <button
                onClick={() => { setSelectedCategory(selectedCategory === 'accident' ? null : 'accident'); setSelectedTreatments([]); }}
                className={`w-full p-3 rounded-lg border-2 transition-all flex items-center gap-3 ${
                  selectedCategory === 'accident'
                    ? 'border-red-500 bg-red-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className={`w-9 h-9 rounded-full flex items-center justify-center ${
                  selectedCategory === 'accident' ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-500'
                }`}>
                  <i className="fa-solid fa-car-burst"></i>
                </div>
                <div className="text-left flex-1">
                  <span className={`font-bold ${selectedCategory === 'accident' ? 'text-red-600' : 'text-gray-700'}`}>
                    자보
                  </span>
                  <p className="text-xs text-gray-500">자동차보험</p>
                </div>
                {selectedCategory === 'accident' && <i className="fa-solid fa-check text-red-500"></i>}
              </button>

              {/* 약상담 추가 */}
              <div
                onClick={() => { setIncludeHerbal(!includeHerbal); if (includeHerbal) { setSelectedHerbalType(''); setCustomHerbalNote(''); } }}
                className={`w-full p-3 rounded-lg border-2 transition-all flex items-center gap-3 cursor-pointer ${
                  includeHerbal
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className={`w-9 h-9 rounded-full flex items-center justify-center ${
                  includeHerbal ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-500'
                }`}>
                  <i className="fa-solid fa-prescription-bottle-medical"></i>
                </div>
                <div className="text-left flex-1">
                  <span className={`font-bold ${includeHerbal ? 'text-green-600' : 'text-gray-700'}`}>
                    약상담
                  </span>
                  <p className="text-xs text-gray-500">한약 상담</p>
                </div>
                {includeHerbal && <i className="fa-solid fa-check text-green-500"></i>}
              </div>
            </div>

            {/* 우측: 세부항목 선택 */}
            <div className="border rounded-lg p-4 bg-white shadow-sm">
              {!selectedCategory && !includeHerbal && (
                <div className="h-full flex items-center justify-center text-gray-400">
                  <div className="text-center">
                    <i className="fa-solid fa-arrow-left text-3xl mb-2"></i>
                    <p className="font-medium text-sm">좌측에서 진료 유형을 선택해주세요</p>
                  </div>
                </div>
              )}

              {/* 침치료 세부항목 */}
              {selectedCategory === 'acupuncture' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      <i className="fa-solid fa-id-card mr-1 text-blue-500"></i>종별
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {INSURANCE_TYPES.map((type) => (
                        <button
                          key={type}
                          onClick={() => setInsuranceType(type)}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                            insuranceType === type
                              ? 'bg-blue-500 text-white'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      <i className="fa-solid fa-hand-holding-medical mr-1 text-blue-500"></i>치료 (복수선택)
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {ACUPUNCTURE_TREATMENTS.map((treatment) => (
                        <button
                          key={treatment}
                          onClick={() => toggleTreatment(treatment)}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            selectedTreatments.includes(treatment)
                              ? 'bg-blue-500 text-white'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {selectedTreatments.includes(treatment) && <i className="fa-solid fa-check mr-1"></i>}
                          {treatment}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* 자보 세부항목 */}
              {selectedCategory === 'accident' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      <i className="fa-solid fa-hand-holding-medical mr-1 text-red-500"></i>치료 (복수선택)
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {ACCIDENT_TREATMENTS.map((treatment) => (
                        <button
                          key={treatment}
                          onClick={() => toggleTreatment(treatment)}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            selectedTreatments.includes(treatment)
                              ? 'bg-red-500 text-white'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {selectedTreatments.includes(treatment) && <i className="fa-solid fa-check mr-1"></i>}
                          {treatment}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* 약상담 세부항목 */}
              {includeHerbal && (
                <div className={`space-y-3 ${selectedCategory ? 'mt-3 pt-3 border-t' : ''}`}>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      <i className="fa-solid fa-pills mr-1 text-green-500"></i>약상담 유형
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {HERBAL_TYPES.map((type) => (
                        <button
                          key={type}
                          onClick={() => setSelectedHerbalType(type)}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            selectedHerbalType === type
                              ? 'bg-green-500 text-white'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {selectedHerbalType === type && <i className="fa-solid fa-check mr-1"></i>}
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>

                  {selectedHerbalType === '맞춤한약' && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">
                        <i className="fa-solid fa-pen mr-1 text-green-500"></i>상담 내용
                      </label>
                      <input
                        type="text"
                        value={customHerbalNote}
                        onChange={(e) => setCustomHerbalNote(e.target.value)}
                        placeholder="예: 피로회복, 면역력 강화"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 하단: 선택항목 요약 (항상 보임) */}
        {(selectedCategory || (includeHerbal && selectedHerbalType)) && (
          <div className="flex-shrink-0 p-2.5 bg-blue-50 rounded-lg text-sm">
            <span className="font-semibold text-blue-800">선택된 항목: </span>
            <span className="text-blue-600 font-medium">
              {(() => {
                const parts: string[] = [];
                if (selectedCategory === 'acupuncture' && selectedTreatments.length > 0) {
                  parts.push(`침치료(${insuranceType}) - ${selectedTreatments.join('+')}`);
                }
                if (selectedCategory === 'accident' && selectedTreatments.length > 0) {
                  parts.push(`자보 - ${selectedTreatments.join('+')}`);
                }
                if (includeHerbal && selectedHerbalType) {
                  if (selectedHerbalType === '맞춤한약') {
                    parts.push(`약상담-맞춤한약${customHerbalNote ? `(${customHerbalNote})` : ''}`);
                  } else {
                    parts.push(`약상담-${selectedHerbalType}`);
                  }
                }
                return parts.join(', ');
              })()}
            </span>
          </div>
        )}
      </div>
    );
  }

  // 재진 접수 - 진료항목 선택 뷰 (치료대기로 추가)
  if (view === 'selectTreatmentItems' && selectedPatient) {
    const INSURANCE_TYPES = ['건보', '차상위', '1종', '2종', '임산부', '산정특례', '일반'];
    const ACUPUNCTURE_TREATMENTS = ['침', '추나', '약침', '초음파'];
    const ACCIDENT_TREATMENTS = ['침', '추나', '자보약'];
    const HERBAL_TYPES = ['상비약', '감기약', '맞춤한약'];

    const toggleTreatment = (treatment: string) => {
      setSelectedTreatments(prev =>
        prev.includes(treatment)
          ? prev.filter(t => t !== treatment)
          : [...prev, treatment]
      );
    };

    const handleConfirmTreatmentSelection = () => {
      const parts: string[] = [];

      if (selectedCategory === 'acupuncture' && selectedTreatments.length > 0) {
        const treatments = selectedTreatments.join('+');
        parts.push(`침치료(${insuranceType}) - ${treatments}`);
      } else if (selectedCategory === 'accident' && selectedTreatments.length > 0) {
        const treatments = selectedTreatments.join('+');
        parts.push(`자보 - ${treatments}`);
      }

      if (includeHerbal && selectedHerbalType) {
        if (selectedHerbalType === '맞춤한약') {
          parts.push(`약상담-맞춤한약${customHerbalNote ? `(${customHerbalNote})` : ''}`);
        } else {
          parts.push(`약상담-${selectedHerbalType}`);
        }
      }

      const detailsText = parts.join(', ');

      if (detailsText && addPatientToTreatment) {
        // 치료대기로 추가 (details와 memo 파라미터로 전달)
        addPatientToTreatment(selectedPatient, detailsText, receptionMemo || undefined);
        resetSelections();
        onClose?.();
      }
    };

    const canSubmit = () => {
      if (selectedCategory) {
        if (selectedTreatments.length === 0) return false;
      }
      if (!selectedCategory && includeHerbal) {
        return selectedHerbalType !== '';
      }
      if (includeHerbal && !selectedHerbalType) return false;
      return selectedCategory !== null || (includeHerbal && selectedHerbalType !== '');
    };

    return (
      <div className="flex flex-col h-[75vh]">
        {/* 상단: 뒤로가기 + 환자정보 + 접수메모 + 버튼 */}
        <div className="flex-shrink-0">
          <div className="flex items-center mb-2 -mt-2">
            <button onClick={() => { resetSelections(); setView('detail'); }} className="flex items-center text-gray-600 hover:text-gray-900 font-semibold text-sm">
              <i className="fa-solid fa-arrow-left mr-2"></i>
              <span>환자 정보로 돌아가기</span>
            </button>
          </div>

          <div className="bg-green-50 p-3 rounded-lg mb-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex-shrink-0">
                <p className="font-bold text-clinic-accent text-lg">{selectedPatient.name}</p>
                <p className="text-xs text-gray-500">재진 접수 (치료대기)</p>
              </div>
              <div className="flex-1">
                <input
                  type="text"
                  value={receptionMemo}
                  onChange={(e) => setReceptionMemo(e.target.value)}
                  placeholder="접수 메모 (붉은글씨 표시)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-400 focus:border-red-400"
                />
              </div>
              <div className="flex-shrink-0 flex items-center gap-2">
                <button
                  onClick={() => { resetSelections(); setView('detail'); }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-colors text-sm"
                >
                  취소
                </button>
                <button
                  onClick={handleConfirmTreatmentSelection}
                  disabled={!canSubmit()}
                  className={`px-4 py-2 font-semibold rounded-lg transition-all text-sm ${
                    canSubmit()
                      ? 'bg-clinic-accent text-white hover:bg-green-700 shadow-md'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  <i className="fa-solid fa-bed-pulse mr-1"></i>
                  치료접수
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 mb-3">
          <div className="grid grid-cols-2 gap-4 h-full">
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">진료 유형 선택</label>

              <button
                onClick={() => { setSelectedCategory(selectedCategory === 'acupuncture' ? null : 'acupuncture'); setSelectedTreatments([]); }}
                className={`w-full p-3 rounded-lg border-2 transition-all flex items-center gap-3 ${
                  selectedCategory === 'acupuncture'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className={`w-9 h-9 rounded-full flex items-center justify-center ${
                  selectedCategory === 'acupuncture' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-500'
                }`}>
                  <i className="fa-solid fa-hand-dots"></i>
                </div>
                <div className="text-left flex-1">
                  <span className={`font-bold ${selectedCategory === 'acupuncture' ? 'text-blue-600' : 'text-gray-700'}`}>
                    침치료
                  </span>
                  <p className="text-xs text-gray-500">건강보험</p>
                </div>
                {selectedCategory === 'acupuncture' && <i className="fa-solid fa-check text-blue-500"></i>}
              </button>

              <button
                onClick={() => { setSelectedCategory(selectedCategory === 'accident' ? null : 'accident'); setSelectedTreatments([]); }}
                className={`w-full p-3 rounded-lg border-2 transition-all flex items-center gap-3 ${
                  selectedCategory === 'accident'
                    ? 'border-red-500 bg-red-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className={`w-9 h-9 rounded-full flex items-center justify-center ${
                  selectedCategory === 'accident' ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-500'
                }`}>
                  <i className="fa-solid fa-car-burst"></i>
                </div>
                <div className="text-left flex-1">
                  <span className={`font-bold ${selectedCategory === 'accident' ? 'text-red-600' : 'text-gray-700'}`}>
                    자보
                  </span>
                  <p className="text-xs text-gray-500">자동차보험</p>
                </div>
                {selectedCategory === 'accident' && <i className="fa-solid fa-check text-red-500"></i>}
              </button>

              <div
                onClick={() => { setIncludeHerbal(!includeHerbal); if (includeHerbal) { setSelectedHerbalType(''); setCustomHerbalNote(''); } }}
                className={`w-full p-3 rounded-lg border-2 transition-all flex items-center gap-3 cursor-pointer ${
                  includeHerbal
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className={`w-9 h-9 rounded-full flex items-center justify-center ${
                  includeHerbal ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-500'
                }`}>
                  <i className="fa-solid fa-prescription-bottle-medical"></i>
                </div>
                <div className="text-left flex-1">
                  <span className={`font-bold ${includeHerbal ? 'text-green-600' : 'text-gray-700'}`}>
                    약상담
                  </span>
                  <p className="text-xs text-gray-500">한약 상담</p>
                </div>
                {includeHerbal && <i className="fa-solid fa-check text-green-500"></i>}
              </div>
            </div>

            <div className="border rounded-lg p-4 bg-white shadow-sm">
              {!selectedCategory && !includeHerbal && (
                <div className="h-full flex items-center justify-center text-gray-400">
                  <div className="text-center">
                    <i className="fa-solid fa-arrow-left text-3xl mb-2"></i>
                    <p className="font-medium text-sm">좌측에서 진료 유형을 선택해주세요</p>
                  </div>
                </div>
              )}

              {selectedCategory === 'acupuncture' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      <i className="fa-solid fa-id-card mr-1 text-blue-500"></i>종별
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {INSURANCE_TYPES.map((type) => (
                        <button
                          key={type}
                          onClick={() => setInsuranceType(type)}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                            insuranceType === type
                              ? 'bg-blue-500 text-white'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      <i className="fa-solid fa-hand-holding-medical mr-1 text-blue-500"></i>치료 (복수선택)
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {ACUPUNCTURE_TREATMENTS.map((treatment) => (
                        <button
                          key={treatment}
                          onClick={() => toggleTreatment(treatment)}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            selectedTreatments.includes(treatment)
                              ? 'bg-blue-500 text-white'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {selectedTreatments.includes(treatment) && <i className="fa-solid fa-check mr-1"></i>}
                          {treatment}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {selectedCategory === 'accident' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      <i className="fa-solid fa-hand-holding-medical mr-1 text-red-500"></i>치료 (복수선택)
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {ACCIDENT_TREATMENTS.map((treatment) => (
                        <button
                          key={treatment}
                          onClick={() => toggleTreatment(treatment)}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            selectedTreatments.includes(treatment)
                              ? 'bg-red-500 text-white'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {selectedTreatments.includes(treatment) && <i className="fa-solid fa-check mr-1"></i>}
                          {treatment}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {includeHerbal && (
                <div className={`space-y-3 ${selectedCategory ? 'mt-3 pt-3 border-t' : ''}`}>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      <i className="fa-solid fa-pills mr-1 text-green-500"></i>약상담 유형
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {HERBAL_TYPES.map((type) => (
                        <button
                          key={type}
                          onClick={() => setSelectedHerbalType(type)}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            selectedHerbalType === type
                              ? 'bg-green-500 text-white'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {selectedHerbalType === type && <i className="fa-solid fa-check mr-1"></i>}
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>

                  {selectedHerbalType === '맞춤한약' && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">
                        <i className="fa-solid fa-pen mr-1 text-green-500"></i>상담 내용
                      </label>
                      <input
                        type="text"
                        value={customHerbalNote}
                        onChange={(e) => setCustomHerbalNote(e.target.value)}
                        placeholder="예: 피로회복, 면역력 강화"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 하단: 선택항목 요약 (항상 보임) */}
        {(selectedCategory || (includeHerbal && selectedHerbalType)) && (
          <div className="flex-shrink-0 p-2.5 bg-green-50 rounded-lg text-sm">
            <span className="font-semibold text-green-800">선택된 항목: </span>
            <span className="text-green-600 font-medium">
              {(() => {
                const parts: string[] = [];
                if (selectedCategory === 'acupuncture' && selectedTreatments.length > 0) {
                  parts.push(`침치료(${insuranceType}) - ${selectedTreatments.join('+')}`);
                }
                if (selectedCategory === 'accident' && selectedTreatments.length > 0) {
                  parts.push(`자보 - ${selectedTreatments.join('+')}`);
                }
                if (includeHerbal && selectedHerbalType) {
                  if (selectedHerbalType === '맞춤한약') {
                    parts.push(`약상담-맞춤한약${customHerbalNote ? `(${customHerbalNote})` : ''}`);
                  } else {
                    parts.push(`약상담-${selectedHerbalType}`);
                  }
                }
                return parts.join(', ');
              })()}
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[60vh]">
      <div className="flex-shrink-0">
        <label htmlFor="patient-search" className="sr-only">환자 이름 또는 차트번호 검색</label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <i className={`fa-solid ${isSearching ? 'fa-spinner fa-spin' : 'fa-magnifying-glass'} text-gray-400`}></i>
          </div>
          <input
            type="text"
            id="patient-search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="mt-1 block w-full pl-10 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-clinic-secondary focus:border-clinic-secondary sm:text-sm"
            placeholder="환자 이름 또는 차트번호로 검색..."
            autoComplete="off"
            autoFocus
          />
        </div>
      </div>

      <div className="border-t border-gray-200 -mx-6 my-4 flex-shrink-0"></div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {isSearching && searchResults.length === 0 ? (
          <div className="text-center py-10 text-gray-500">
            <i className="fa-solid fa-spinner fa-spin text-2xl mb-2"></i>
            <p>검색 중...</p>
          </div>
        ) : searchResults.length > 0 ? (
          <ul className="divide-y divide-gray-200">
            {searchResults.map((patient) => (
              <li key={patient.id} className="p-3 flex justify-between items-center hover:bg-blue-50 cursor-pointer" onClick={() => handleSelectPatient(patient)}>
                <div>
                  <p className="font-semibold text-clinic-text-primary">{patient.name} <span className="text-sm font-normal text-clinic-text-secondary">({patient.chartNumber})</span></p>
                  <p className="text-sm text-clinic-text-secondary">{patient.dob || '-'} / {patient.gender === 'male' ? '남' : patient.gender === 'female' ? '여' : '-'}</p>
                </div>
                <i className="fa-solid fa-chevron-right text-gray-400"></i>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-center py-10 text-gray-500">
            {searchTerm ? '검색 결과가 없습니다.' : '환자 이름 또는 차트번호를 입력하세요.'}
          </div>
        )}
      </div>
    </div>
  );
};

export default PatientSearch;
