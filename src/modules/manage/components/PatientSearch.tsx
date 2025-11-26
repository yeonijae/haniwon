
import React, { useState, useEffect } from 'react';
import { Patient } from '../types';
import * as api from '../lib/api';

interface PatientSearchProps {
  addPatientToConsultation: (patient: Patient) => void;
  addPatientToTreatment: (patient: Patient) => void;
  updatePatientInfo: (patient: Patient) => void;
  deletePatient: (patientId: number) => void;
}

const DetailItem: React.FC<{ label: string; value?: string }> = ({ label, value }) => (
    <div>
        <dt className="text-sm font-medium text-gray-500">{label}</dt>
        <dd className="mt-1 text-sm text-gray-900">{value || '-'}</dd>
    </div>
);

const PatientSearch: React.FC<PatientSearchProps> = ({ addPatientToConsultation, addPatientToTreatment, updatePatientInfo, deletePatient }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Patient[]>([]);
  const [view, setView] = useState<'search' | 'detail' | 'edit'>('search');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [editFormData, setEditFormData] = useState<Patient | null>(null);
  const [isSearching, setIsSearching] = useState(false);

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
                    onClick={() => addPatientToConsultation(selectedPatient)}
                    className="px-4 py-2 bg-clinic-secondary text-white font-semibold rounded-md hover:bg-blue-700 transition-colors"
                >
                    <i className="fa-solid fa-user-doctor mr-2"></i>진료대기 추가
                </button>
                <button
                    onClick={() => addPatientToTreatment(selectedPatient)}
                    className="px-4 py-2 bg-clinic-accent text-white font-semibold rounded-md hover:bg-green-700 transition-colors"
                >
                    <i className="fa-solid fa-bed-pulse mr-2"></i>치료대기 추가
                </button>
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
