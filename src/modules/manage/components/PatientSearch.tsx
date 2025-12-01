
import React, { useState, useEffect } from 'react';
import { Patient, ConsultationItem } from '../types';
import * as api from '../lib/api';

// 선택된 진료항목 형식
export interface SelectedConsultationItem {
  itemId: number;
  itemName: string;
  subItemId?: number;
  subItemName?: string;
}

interface PatientSearchProps {
  addPatientToConsultation: (patient: Patient, details?: string) => void;
  addPatientToTreatment: (patient: Patient) => void;
  updatePatientInfo: (patient: Patient) => void;
  deletePatient: (patientId: number) => void;
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

const PatientSearch: React.FC<PatientSearchProps> = ({ addPatientToConsultation, addPatientToTreatment, updatePatientInfo, deletePatient, onClose, consultationItems = [], onReservation }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Patient[]>([]);
  const [view, setView] = useState<'search' | 'detail' | 'edit' | 'selectItems'>('search');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [editFormData, setEditFormData] = useState<Patient | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // 진료항목 선택 상태
  const [selectedConsultationItems, setSelectedConsultationItems] = useState<SelectedConsultationItem[]>([]);

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
  
  const handleSelectPatient = (patient: Patient) => {
    setSelectedPatient(patient);
    setView('detail');
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
    if (editFormData) {
        if (!editFormData.name.trim()) {
            alert('환자 이름은 필수입니다.');
            return;
        }
        updatePatientInfo(editFormData);
        setSelectedPatient(editFormData);
        setView('detail');
    }
  };

  const handleDelete = () => {
    if (selectedPatient) {
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
                    <button onClick={() => setView('edit')} className="px-4 py-2 bg-white text-sm text-clinic-secondary font-semibold rounded-md border border-clinic-secondary hover:bg-gray-50 transition-colors">
                        <i className="fa-solid fa-pencil mr-2"></i>수정
                    </button>
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
                <button
                    onClick={() => {
                        setSelectedConsultationItems([]);
                        setView('selectItems');
                    }}
                    className="px-4 py-2 bg-clinic-secondary text-white font-semibold rounded-md hover:bg-blue-700 transition-colors"
                >
                    <i className="fa-solid fa-user-doctor mr-2"></i>진료대기
                </button>
                <button
                    onClick={() => {
                        addPatientToTreatment(selectedPatient);
                        onClose?.();
                    }}
                    className="px-4 py-2 bg-clinic-accent text-white font-semibold rounded-md hover:bg-green-700 transition-colors"
                >
                    <i className="fa-solid fa-bed-pulse mr-2"></i>치료대기
                </button>
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
    const toggleItem = (item: ConsultationItem) => {
      const existing = selectedConsultationItems.find(s => s.itemId === item.id && !s.subItemId);
      if (existing) {
        // 이미 선택된 항목 제거 (해당 항목과 모든 세부항목 제거)
        setSelectedConsultationItems(prev =>
          prev.filter(s => s.itemId !== item.id)
        );
      } else {
        // 새로 선택 추가 (세부항목이 없는 경우만 메인 항목으로 추가)
        if (item.subItems.length === 0) {
          setSelectedConsultationItems(prev => [
            ...prev,
            { itemId: item.id, itemName: item.name }
          ]);
        }
      }
    };

    const toggleSubItem = (item: ConsultationItem, subItem: { id: number; name: string }) => {
      const existing = selectedConsultationItems.find(
        s => s.itemId === item.id && s.subItemId === subItem.id
      );
      if (existing) {
        // 이미 선택된 세부항목 제거
        setSelectedConsultationItems(prev =>
          prev.filter(s => !(s.itemId === item.id && s.subItemId === subItem.id))
        );
      } else {
        // 새로 선택 추가
        setSelectedConsultationItems(prev => [
          ...prev,
          { itemId: item.id, itemName: item.name, subItemId: subItem.id, subItemName: subItem.name }
        ]);
      }
    };

    const isItemSelected = (itemId: number) => {
      return selectedConsultationItems.some(s => s.itemId === itemId && !s.subItemId);
    };

    const isSubItemSelected = (itemId: number, subItemId: number) => {
      return selectedConsultationItems.some(s => s.itemId === itemId && s.subItemId === subItemId);
    };

    const hasAnySubItemSelected = (itemId: number) => {
      return selectedConsultationItems.some(s => s.itemId === itemId && s.subItemId);
    };

    const handleConfirmSelection = () => {
      // 선택된 항목들을 문자열로 변환
      const detailsText = selectedConsultationItems.length > 0
        ? selectedConsultationItems.map(item => {
            if (item.subItemName) {
              return `${item.itemName}(${item.subItemName})`;
            }
            return item.itemName;
          }).join(', ')
        : '검색 추가';

      addPatientToConsultation(selectedPatient, detailsText);
      onClose?.();
    };

    return (
      <div className="flex flex-col h-[60vh]">
        <div className="flex items-center mb-4 -mt-2">
          <button onClick={() => setView('detail')} className="flex items-center text-gray-600 hover:text-gray-900 font-semibold text-sm">
            <i className="fa-solid fa-arrow-left mr-2"></i>
            <span>환자 정보로 돌아가기</span>
          </button>
        </div>

        <div className="bg-gray-50 p-3 rounded-lg mb-4">
          <p className="font-bold text-clinic-primary">{selectedPatient.name}</p>
          <p className="text-sm text-gray-600">오늘 받을 진료항목을 선택해주세요.</p>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2">
          {consultationItems.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>등록된 진료항목이 없습니다.</p>
              <p className="text-sm mt-1">설정에서 진료항목을 추가해주세요.</p>
            </div>
          ) : (
            consultationItems.map((item) => (
              <div key={item.id} className="border rounded-lg bg-white">
                {/* 메인 항목 */}
                <div
                  onClick={() => item.subItems.length === 0 && toggleItem(item)}
                  className={`p-3 flex items-center justify-between ${
                    item.subItems.length === 0 ? 'cursor-pointer hover:bg-gray-50' : ''
                  } ${
                    isItemSelected(item.id) ? 'bg-blue-50 border-blue-200' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {item.subItems.length === 0 ? (
                      <div className={`w-5 h-5 rounded border flex items-center justify-center ${
                        isItemSelected(item.id)
                          ? 'bg-clinic-secondary border-clinic-secondary text-white'
                          : 'border-gray-300'
                      }`}>
                        {isItemSelected(item.id) && <i className="fa-solid fa-check text-xs"></i>}
                      </div>
                    ) : (
                      <div className={`w-5 h-5 rounded border flex items-center justify-center ${
                        hasAnySubItemSelected(item.id)
                          ? 'bg-clinic-secondary border-clinic-secondary text-white'
                          : 'border-gray-300 bg-gray-100'
                      }`}>
                        {hasAnySubItemSelected(item.id) && <i className="fa-solid fa-minus text-xs"></i>}
                      </div>
                    )}
                    <span className="font-medium">{item.name}</span>
                  </div>
                  {item.subItems.length > 0 && (
                    <span className="text-sm text-gray-500">{item.subItems.length}개 세부항목</span>
                  )}
                </div>

                {/* 세부항목 */}
                {item.subItems.length > 0 && (
                  <div className="border-t bg-gray-50 p-2 grid grid-cols-2 gap-2">
                    {item.subItems.map((subItem) => (
                      <div
                        key={subItem.id}
                        onClick={() => toggleSubItem(item, subItem)}
                        className={`p-2 rounded cursor-pointer flex items-center gap-2 ${
                          isSubItemSelected(item.id, subItem.id)
                            ? 'bg-blue-100 border border-blue-300'
                            : 'bg-white border border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                          isSubItemSelected(item.id, subItem.id)
                            ? 'bg-clinic-secondary border-clinic-secondary text-white'
                            : 'border-gray-300'
                        }`}>
                          {isSubItemSelected(item.id, subItem.id) && <i className="fa-solid fa-check text-xs"></i>}
                        </div>
                        <span className="text-sm">{subItem.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* 선택된 항목 요약 및 버튼 */}
        <div className="border-t pt-4 mt-4">
          {selectedConsultationItems.length > 0 && (
            <div className="mb-3 p-2 bg-blue-50 rounded text-sm">
              <span className="font-medium text-blue-800">선택된 항목: </span>
              <span className="text-blue-600">
                {selectedConsultationItems.map(s =>
                  s.subItemName ? `${s.itemName}(${s.subItemName})` : s.itemName
                ).join(', ')}
              </span>
            </div>
          )}
          <div className="flex justify-end space-x-2">
            <button
              onClick={() => setView('detail')}
              className="px-4 py-2 bg-gray-200 text-gray-700 font-semibold rounded-md hover:bg-gray-300 transition-colors"
            >
              취소
            </button>
            <button
              onClick={handleConfirmSelection}
              className="px-4 py-2 bg-clinic-secondary text-white font-semibold rounded-md hover:bg-blue-700 transition-colors"
            >
              <i className="fa-solid fa-user-doctor mr-2"></i>
              접수하기 {selectedConsultationItems.length > 0 && `(${selectedConsultationItems.length})`}
            </button>
          </div>
        </div>
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
