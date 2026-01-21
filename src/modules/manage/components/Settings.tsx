

import React, { useState, useEffect } from 'react';
import { Patient, MedicalStaff, WorkPattern, Staff, StaffRank, StaffDepartment, UncoveredCategories, ConsultationItem, ConsultationSubItem } from '../types';
import * as api from '../lib/api';
import { getCurrentDate } from '@shared/lib/postgres';
import ConsultationItemsManagement from './ConsultationItemsManagement';

// For sheetjs library loaded from CDN
declare var XLSX: any;

export interface BulkPatientData {
  name: string;
  chartNumber?: string;
  dob?: string;
  gender?: 'male' | 'female';
  address?: string;
  phone?: string;
  details?: string;
  registrationDate?: string;
}

interface SettingsProps {
    addBulkPatients: (
        patients: BulkPatientData[],
        onProgress?: (current: number, total: number, message: string) => void
    ) => Promise<{ new: number; updated: number; failures: any[] }>;
    allPatients: Patient[];
    deletePatient: (patientId: number) => void;
    deletedPatients: Patient[];
    restorePatient: (patientId: number) => void;
    medicalStaff: MedicalStaff[];
    updateMedicalStaff: (staff: MedicalStaff) => void;
    addMedicalStaff: (staff: Omit<MedicalStaff, 'id'>) => void;
    deleteMedicalStaff: (staffId: number) => void;
    staff: Staff[];
    updateStaff: (staff: Staff) => void;
    addStaff: (staff: Omit<Staff, 'id'>) => void;
    deleteStaff: (staffId: number) => void;
    uncoveredCategories: UncoveredCategories;
    updateUncoveredCategories: (categories: UncoveredCategories) => void;
    // 진료항목 관리
    consultationItems: ConsultationItem[];
    addConsultationItem: (name: string) => void;
    updateConsultationItem: (id: number, name: string) => void;
    deleteConsultationItem: (id: number) => void;
    reorderConsultationItems: (items: ConsultationItem[]) => void;
    addSubItem: (parentId: number, name: string) => void;
    updateSubItem: (parentId: number, subItemId: number, name: string) => void;
    deleteSubItem: (parentId: number, subItemId: number) => void;
    reorderSubItems: (parentId: number, subItems: ConsultationSubItem[]) => void;
}

const DetailItem: React.FC<{ label: string; value?: string }> = ({ label, value }) => (
    <div>
        <dt className="text-sm font-medium text-gray-500">{label}</dt>
        <dd className="mt-1 text-sm text-gray-900">{value || '-'}</dd>
    </div>
);

const PatientDeleteAndRecover: React.FC<{
    allPatients: Patient[];
    deletePatient: (patientId: number) => void;
    deletedPatients: Patient[];
    restorePatient: (patientId: number) => void;
}> = ({ allPatients, deletePatient, deletedPatients, restorePatient }) => {
    const [activeTab, setActiveTab] = useState<'delete' | 'recover'>('delete');
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<Patient[]>([]);
    const [selectedDeletedPatient, setSelectedDeletedPatient] = useState<Patient | null>(null);

    useEffect(() => {
        setSearchTerm('');
        setSearchResults([]);
        setSelectedDeletedPatient(null);
    }, [activeTab]);

    useEffect(() => {
        if (activeTab === 'delete') {
            if (searchTerm.trim() === '') {
                setSearchResults([]);
                return;
            }
            const filtered = allPatients.filter(patient =>
                patient.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (patient.chartNumber && patient.chartNumber.toLowerCase().includes(searchTerm.toLowerCase()))
            );
            setSearchResults(filtered);
        }
    }, [searchTerm, allPatients, activeTab]);
    
    const handleRestore = (patientId: number) => {
        if (window.confirm("이 환자의 정보를 복구하시겠습니까?")) {
            restorePatient(patientId);
            setSelectedDeletedPatient(null);
        }
    };
    
    const formatDate = (dateString?: string) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleString('ko-KR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    if (activeTab === 'recover' && selectedDeletedPatient) {
        return (
             <div>
                <div className="flex items-center mb-4">
                     <button onClick={() => setSelectedDeletedPatient(null)} className="flex items-center text-gray-600 hover:text-gray-900 font-semibold text-sm">
                        <i className="fa-solid fa-arrow-left mr-2"></i>
                        <span>삭제된 환자 목록으로</span>
                    </button>
                </div>
                
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <div className="flex justify-between items-start">
                        <div>
                            <h3 className="text-xl font-bold text-clinic-primary">{selectedDeletedPatient.name}</h3>
                            <p className="text-sm text-clinic-text-secondary">차트번호: {selectedDeletedPatient.chartNumber || 'N/A'}</p>
                        </div>
                    </div>
                </div>
                
                <dl className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-6">
                    <DetailItem label="삭제일시" value={formatDate(selectedDeletedPatient.deletionDate)} />
                    <DetailItem label="생년월일" value={selectedDeletedPatient.dob} />
                    <DetailItem label="성별" value={selectedDeletedPatient.gender === 'male' ? '남성' : selectedDeletedPatient.gender === 'female' ? '여성' : ''} />
                    <DetailItem label="연락처" value={selectedDeletedPatient.phone} />
                    <DetailItem label="등록일" value={selectedDeletedPatient.registrationDate} />
                    <div className="md:col-span-2">
                         <DetailItem label="주소" value={selectedDeletedPatient.address} />
                    </div>
                </dl>
                
                <div className="flex justify-end pt-4 border-t mt-6">
                    <button 
                        onClick={() => handleRestore(selectedDeletedPatient.id)}
                        className="px-6 py-2 bg-clinic-accent text-white font-semibold rounded-md hover:bg-green-700 transition-colors"
                    >
                        <i className="fa-solid fa-rotate-left mr-2"></i>환자 정보 복구
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div>
            <div className="flex border-b mb-4">
                <button
                    onClick={() => setActiveTab('delete')}
                    className={`px-4 py-2 text-sm font-semibold ${activeTab === 'delete' ? 'border-b-2 border-clinic-primary text-clinic-primary' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    환자 삭제
                </button>
                <button
                    onClick={() => setActiveTab('recover')}
                    className={`px-4 py-2 text-sm font-semibold ${activeTab === 'recover' ? 'border-b-2 border-clinic-primary text-clinic-primary' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    삭제된 환자 조회
                </button>
            </div>

            {activeTab === 'delete' && (
                <div className="space-y-4">
                    <p className="text-sm text-gray-600">삭제할 환자의 이름 또는 차트번호를 입력하세요. 삭제된 정보는 복구할 수 있습니다.</p>
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <i className="fa-solid fa-magnifying-glass text-gray-400"></i>
                        </div>
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="block w-full pl-10 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-clinic-secondary focus:border-clinic-secondary sm:text-sm"
                            placeholder="환자 검색..."
                            autoComplete="off"
                            autoFocus
                        />
                    </div>
                    <div className="max-h-80 overflow-y-auto border rounded-md bg-white">
                        {searchResults.length > 0 ? (
                            <ul className="divide-y divide-gray-200">
                                {searchResults.map(patient => (
                                    <li key={patient.id} className="p-3 flex justify-between items-center hover:bg-gray-50">
                                        <div>
                                            <p className="font-semibold text-clinic-text-primary">{patient.name} <span className="text-sm font-normal text-clinic-text-secondary">({patient.chartNumber})</span></p>
                                        </div>
                                        <button
                                            onClick={() => deletePatient(patient.id)}
                                            className="px-3 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded-md hover:bg-red-200 transition-colors"
                                        >
                                            <i className="fa-solid fa-trash-can mr-1.5"></i>
                                            삭제
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <div className="text-center py-10 text-gray-500">
                                {searchTerm ? '검색 결과가 없습니다.' : '검색어를 입력하여 환자를 찾으세요.'}
                            </div>
                        )}
                    </div>
                </div>
            )}
            
            {activeTab === 'recover' && (
                 <div className="space-y-4">
                    <p className="text-sm text-gray-600">삭제된 환자 목록입니다. 환자를 선택하여 상세 정보를 확인하거나 복구할 수 있습니다.</p>
                    <div className="max-h-96 overflow-y-auto border rounded-md bg-white">
                        {deletedPatients.length > 0 ? (
                            <ul className="divide-y divide-gray-200">
                                {deletedPatients.sort((a,b) => new Date(b.deletionDate!).getTime() - new Date(a.deletionDate!).getTime()).map(patient => (
                                    <li key={patient.id} className="p-3 flex justify-between items-center hover:bg-blue-50 cursor-pointer" onClick={() => setSelectedDeletedPatient(patient)}>
                                        <div>
                                            <p className="font-semibold text-clinic-text-primary">{patient.name} <span className="text-sm font-normal text-clinic-text-secondary">({patient.chartNumber})</span></p>
                                            <p className="text-xs text-gray-500 mt-1">삭제일: {formatDate(patient.deletionDate)}</p>
                                        </div>
                                        <i className="fa-solid fa-chevron-right text-gray-400"></i>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                             <div className="text-center py-10 text-gray-500">
                                삭제된 환자가 없습니다.
                            </div>
                        )}
                    </div>
                 </div>
            )}
        </div>
    );
};

const MedicalStaffManagement: React.FC<{
    staffList: MedicalStaff[];
    onUpdate: (staff: MedicalStaff) => void;
    onAdd: (staff: Omit<MedicalStaff, 'id'>) => void;
}> = ({ staffList, onUpdate, onAdd }) => {
    const [editingStaff, setEditingStaff] = useState<MedicalStaff | 'new' | null>(null);
    const [formData, setFormData] = useState<Omit<MedicalStaff, 'id'>>({
        name: '',
        alias: '',
        dob: '',
        gender: 'male',
        hireDate: '',
        fireDate: null,
        status: 'working',
        permissions: { prescription: false, chart: false, payment: false, statistics: false },
        workPatterns: [],
        consultationRoom: null,
    });
    const [newPattern, setNewPattern] = useState({
        days: [false, false, false, false, false, false, false], // Mon to Sun
        dayWorkHours: [null, null, null, null, null, null, null] as ({ startTime: string; endTime: string } | null)[],
        startDate: '',
        endDate: '',
    });
    const weekDays = ['월', '화', '수', '목', '금', '토', '일'];
    const [activeTab, setActiveTab] = useState<'working' | 'retired'>('working');

    const filteredStaffList = staffList.filter(s => s.status === activeTab);
    
    useEffect(() => {
        if (editingStaff && editingStaff !== 'new') {
            const { id, ...dataToEdit } = editingStaff;
            setFormData(dataToEdit);
        } else if (editingStaff === 'new') {
            // Reset form for new staff
            setFormData({
                name: '',
                alias: '',
                dob: '',
                gender: 'male',
                hireDate: getCurrentDate(),
                fireDate: null,
                status: 'working',
                permissions: { prescription: true, chart: true, payment: false, statistics: false },
                workPatterns: [],
                consultationRoom: null,
            });
        }
    }, [editingStaff]);

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        
        if (name === 'fireDate') {
            setFormData(prev => ({
                ...prev,
                fireDate: value,
                status: value ? 'retired' : 'working'
            }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };
    
    const handleRadioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value as 'male' | 'female' }));
    };
    
    const handlePermissionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            permissions: { ...prev.permissions, [name]: checked }
        }));
    };

    const handleNewPatternDayChange = (index: number) => {
        const updatedDays = [...newPattern.days];
        const updatedDayWorkHours = [...newPattern.dayWorkHours];
        updatedDays[index] = !updatedDays[index];

        // 요일 선택 시 기본 근무시간 설정, 해제 시 null
        if (updatedDays[index]) {
            updatedDayWorkHours[index] = { startTime: '09:00', endTime: '18:00' };
        } else {
            updatedDayWorkHours[index] = null;
        }

        setNewPattern(prev => ({ ...prev, days: updatedDays, dayWorkHours: updatedDayWorkHours }));
    };

    const handleDayWorkHoursChange = (dayIndex: number, field: 'startTime' | 'endTime', value: string) => {
        const updatedDayWorkHours = [...newPattern.dayWorkHours];
        if (updatedDayWorkHours[dayIndex]) {
            updatedDayWorkHours[dayIndex] = {
                ...updatedDayWorkHours[dayIndex]!,
                [field]: value
            };
        }
        setNewPattern(prev => ({ ...prev, dayWorkHours: updatedDayWorkHours }));
    };

    const handleNewPatternDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setNewPattern(prev => ({ ...prev, [name]: value }));
    };

    const handleAddPattern = () => {
        if (!newPattern.startDate || !newPattern.endDate) {
            alert('적용일과 종료일을 모두 입력해주세요.');
            return;
        }
        if (new Date(newPattern.startDate) > new Date(newPattern.endDate)) {
            alert('종료일은 적용일보다 빠를 수 없습니다.');
            return;
        }
        if (!newPattern.days.some(day => day)) {
            alert('근무 요일을 하나 이상 선택해주세요.');
            return;
        }

        const patternToAdd: WorkPattern = {
            id: `new-${Date.now()}`,
            ...newPattern,
        };
        
        setFormData(prev => ({
            ...prev,
            workPatterns: [...prev.workPatterns, patternToAdd].sort((a,b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
        }));

        // Reset new pattern form
        setNewPattern({
            days: [false, false, false, false, false, false, false],
            dayWorkHours: [null, null, null, null, null, null, null],
            startDate: '',
            endDate: '',
        });
    };

    const handleDeletePattern = (patternId: string) => {
        setFormData(prev => ({
            ...prev,
            workPatterns: prev.workPatterns.filter(p => p.id !== patternId)
        }));
    };

    const [editingPatternId, setEditingPatternId] = useState<string | null>(null);

    const handleEditPattern = (pattern: WorkPattern) => {
        setEditingPatternId(pattern.id);
        setNewPattern({
            days: [...pattern.days],
            dayWorkHours: pattern.dayWorkHours ? [...pattern.dayWorkHours] : [null, null, null, null, null, null, null],
            startDate: pattern.startDate,
            endDate: pattern.endDate,
        });
    };

    const handleCancelEditPattern = () => {
        setEditingPatternId(null);
        setNewPattern({
            days: [false, false, false, false, false, false, false],
            dayWorkHours: [null, null, null, null, null, null, null],
            startDate: '',
            endDate: '',
        });
    };

    const handleUpdatePattern = () => {
        if (!newPattern.startDate || !newPattern.endDate) {
            alert('적용일과 종료일을 모두 입력해주세요.');
            return;
        }
        if (new Date(newPattern.startDate) > new Date(newPattern.endDate)) {
            alert('종료일은 적용일보다 빠를 수 없습니다.');
            return;
        }
        if (!newPattern.days.some(day => day)) {
            alert('근무 요일을 하나 이상 선택해주세요.');
            return;
        }

        setFormData(prev => ({
            ...prev,
            workPatterns: prev.workPatterns.map(p =>
                p.id === editingPatternId
                    ? { ...p, ...newPattern }
                    : p
            ).sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
        }));

        setEditingPatternId(null);
        setNewPattern({
            days: [false, false, false, false, false, false, false],
            dayWorkHours: [null, null, null, null, null, null, null],
            startDate: '',
            endDate: '',
        });
    };
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name.trim() || !formData.hireDate) {
            alert('이름과 입사일은 필수 항목입니다.');
            return;
        }
        
        const finalStatus = formData.fireDate ? 'retired' : 'working';

        if (editingStaff === 'new') {
            onAdd({...formData, status: finalStatus});
        } else if (editingStaff) {
            onUpdate({ id: editingStaff.id, ...formData, status: finalStatus });
        }
        setActiveTab(finalStatus);
        setEditingStaff(null);
    };

    if (editingStaff) {
        const title = editingStaff === 'new' ? '신규 의료진 등록' : `${formData.name}님 정보 수정`;
        const permissions = [
            { key: 'prescription', label: '처방관리' },
            { key: 'chart', label: '환자차트' },
            { key: 'payment', label: '수납현황' },
            { key: 'statistics', label: '지표관리' },
        ];

        return (
             <form onSubmit={handleSubmit} className="space-y-6">
                <div className="flex items-center justify-between mb-4 -mt-2">
                    <h4 className="text-lg font-semibold text-clinic-text-primary">{title}</h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                    <div>
                        <label htmlFor="name" className="block text-sm font-medium text-gray-700">이름</label>
                        <input type="text" id="name" name="name" value={formData.name} onChange={handleFormChange} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-clinic-secondary focus:border-clinic-secondary sm:text-sm" />
                    </div>
                    <div>
                        <label htmlFor="alias" className="block text-sm font-medium text-gray-700">
                            호칭 <span className="text-gray-400 text-xs">(액팅 표시용)</span>
                        </label>
                        <input
                            type="text"
                            id="alias"
                            name="alias"
                            value={formData.alias || ''}
                            onChange={handleFormChange}
                            placeholder="예: 김, 강, 임, 전"
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-clinic-secondary focus:border-clinic-secondary sm:text-sm"
                        />
                    </div>
                    <div>
                        <label htmlFor="dob" className="block text-sm font-medium text-gray-700">생년월일</label>
                        <input type="date" id="dob" name="dob" value={formData.dob} onChange={handleFormChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-clinic-secondary focus:border-clinic-secondary sm:text-sm" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">성별</label>
                        <div className="mt-2 flex items-center space-x-6">
                            <label className="inline-flex items-center">
                                <input type="radio" name="gender" value="male" checked={formData.gender === 'male'} onChange={handleRadioChange} className="focus:ring-clinic-secondary h-4 w-4 text-clinic-secondary border-gray-300" />
                                <span className="ml-2 text-sm text-gray-700">남성</span>
                            </label>
                            <label className="inline-flex items-center">
                                <input type="radio" name="gender" value="female" checked={formData.gender === 'female'} onChange={handleRadioChange} className="focus:ring-clinic-secondary h-4 w-4 text-clinic-secondary border-gray-300" />
                                <span className="ml-2 text-sm text-gray-700">여성</span>
                            </label>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">현재 상태</label>
                        <div className="mt-2 flex items-center h-10 px-3 bg-gray-100 rounded-md border text-sm">
                            {formData.fireDate ? (
                                <span className="font-semibold text-red-700">퇴사</span>
                            ) : (
                                <span className="font-semibold text-green-700">근무중</span>
                            )}
                        </div>
                    </div>

                     <div>
                        <label htmlFor="hireDate" className="block text-sm font-medium text-gray-700">입사일</label>
                        <input type="date" id="hireDate" name="hireDate" value={formData.hireDate} onChange={handleFormChange} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-clinic-secondary focus:border-clinic-secondary sm:text-sm" />
                    </div>
                     <div>
                        <label htmlFor="fireDate" className="block text-sm font-medium text-gray-700">퇴사일</label>
                        <input type="date" id="fireDate" name="fireDate" value={formData.fireDate || ''} onChange={handleFormChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-clinic-secondary focus:border-clinic-secondary sm:text-sm" />
                    </div>

                    <div>
                        <label htmlFor="consultationRoom" className="block text-sm font-medium text-gray-700">진료실</label>
                        <select
                            id="consultationRoom"
                            name="consultationRoom"
                            value={formData.consultationRoom || ''}
                            onChange={handleFormChange}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-clinic-secondary focus:border-clinic-secondary sm:text-sm"
                        >
                            <option value="">선택 안 함</option>
                            <option value="1진료실">1진료실</option>
                            <option value="2진료실">2진료실</option>
                            <option value="3진료실">3진료실</option>
                            <option value="4진료실">4진료실</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">접근권한</label>
                        <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-4 p-4 border rounded-md bg-white">
                            {permissions.map(p => (
                                <label key={p.key} className="flex items-center">
                                    <input
                                        type="checkbox"
                                        name={p.key}
                                        checked={formData.permissions[p.key as keyof typeof formData.permissions]}
                                        onChange={handlePermissionChange}
                                        className="h-4 w-4 rounded border-gray-300 text-clinic-secondary focus:ring-clinic-secondary"
                                    />
                                    <span className="ml-2 text-sm text-gray-700">{p.label}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700">근무패턴 관리</label>

                        <div className="mt-2 space-y-3 p-4 border-2 border-dashed rounded-lg">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="md:col-span-4">
                                    <p className="text-xs font-semibold text-gray-600 mb-2">근무 요일 및 시간</p>
                                    <div className="space-y-2">
                                        {weekDays.map((day, index) => (
                                            <div key={day} className={`flex items-center gap-3 p-2 border rounded-md ${newPattern.days[index] ? 'bg-blue-50 border-blue-400' : 'bg-white'}`}>
                                                <label className="flex items-center min-w-[60px] cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={newPattern.days[index]}
                                                        onChange={() => handleNewPatternDayChange(index)}
                                                        className="h-4 w-4 rounded border-gray-300 text-clinic-secondary focus:ring-clinic-secondary"
                                                    />
                                                    <span className="ml-2 text-sm font-medium text-gray-700">{day}</span>
                                                </label>
                                                {newPattern.days[index] && newPattern.dayWorkHours[index] && (
                                                    <div className="flex items-center gap-2 flex-1">
                                                        <input
                                                            type="time"
                                                            value={newPattern.dayWorkHours[index]?.startTime || '09:00'}
                                                            onChange={(e) => handleDayWorkHoursChange(index, 'startTime', e.target.value)}
                                                            className="px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-clinic-secondary focus:border-clinic-secondary"
                                                        />
                                                        <span className="text-gray-500">~</span>
                                                        <input
                                                            type="time"
                                                            value={newPattern.dayWorkHours[index]?.endTime || '18:00'}
                                                            onChange={(e) => handleDayWorkHoursChange(index, 'endTime', e.target.value)}
                                                            className="px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-clinic-secondary focus:border-clinic-secondary"
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <label htmlFor="newPatternStartDate" className="block text-xs font-semibold text-gray-600">적용일</label>
                                    <input
                                        type="date"
                                        id="newPatternStartDate"
                                        name="startDate"
                                        value={newPattern.startDate}
                                        onChange={handleNewPatternDateChange}
                                        className="mt-1 block w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-clinic-secondary focus:border-clinic-secondary"
                                    />
                                </div>
                                 <div>
                                    <label htmlFor="newPatternEndDate" className="block text-xs font-semibold text-gray-600">종료일</label>
                                    <input
                                        type="date"
                                        id="newPatternEndDate"
                                        name="endDate"
                                        value={newPattern.endDate}
                                        onChange={handleNewPatternDateChange}
                                        className="mt-1 block w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-clinic-secondary focus:border-clinic-secondary"
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end gap-2">
                                {editingPatternId ? (
                                    <>
                                        <button
                                            type="button"
                                            onClick={handleCancelEditPattern}
                                            className="px-4 py-2 bg-gray-200 text-gray-700 text-sm font-semibold rounded-md hover:bg-gray-300 transition-colors"
                                        >
                                            취소
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleUpdatePattern}
                                            className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-md hover:bg-blue-700 transition-colors"
                                        >
                                            <i className="fa-solid fa-check mr-2"></i>수정 완료
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={handleAddPattern}
                                        className="px-4 py-2 bg-clinic-accent text-white text-sm font-semibold rounded-md hover:bg-green-700 transition-colors"
                                    >
                                        <i className="fa-solid fa-plus mr-2"></i>패턴 추가
                                    </button>
                                )}
                            </div>
                        </div>
                        
                        <div className="mt-4 space-y-2 max-h-64 overflow-y-auto">
                            {formData.workPatterns.map(pattern => {
                                const isEditing = editingPatternId === pattern.id;
                                return (
                                    <div key={pattern.id} className={`p-3 rounded-md border ${isEditing ? 'bg-blue-50 border-blue-400' : 'bg-white'}`}>
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <p className="text-xs text-gray-500 mb-2">{pattern.startDate} ~ {pattern.endDate}</p>
                                                <div className="space-y-1">
                                                    {weekDays.map((day, index) => {
                                                        if (!pattern.days[index]) return null;
                                                        const hours = pattern.dayWorkHours?.[index];
                                                        return (
                                                            <div key={day} className="flex items-center gap-2 text-sm">
                                                                <span className="font-medium text-clinic-text-primary w-6">{day}</span>
                                                                {hours ? (
                                                                    <span className="text-gray-600">{hours.startTime} ~ {hours.endTime}</span>
                                                                ) : (
                                                                    <span className="text-gray-400">시간 미설정</span>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                            <div className="flex gap-1">
                                                <button
                                                    type="button"
                                                    onClick={() => handleEditPattern(pattern)}
                                                    className={`px-2 ${isEditing ? 'text-blue-600' : 'text-gray-400 hover:text-blue-500'}`}
                                                    aria-label="근무 패턴 수정"
                                                    disabled={isEditing}
                                                >
                                                    <i className="fa-solid fa-pen"></i>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDeletePattern(pattern.id)}
                                                    className="text-gray-400 hover:text-red-500 px-2"
                                                    aria-label="근무 패턴 삭제"
                                                >
                                                    <i className="fa-solid fa-trash-can"></i>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            {formData.workPatterns.length === 0 && (
                                <div className="text-center py-4 text-sm text-gray-400">
                                    등록된 근무패턴이 없습니다.
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex justify-end pt-4 border-t mt-6 space-x-2">
                    <button type="button" onClick={() => setEditingStaff(null)} className="px-6 py-2 bg-gray-200 text-gray-800 font-semibold rounded-md hover:bg-gray-300 transition-colors">취소</button>
                    <button type="submit" className="px-6 py-2 bg-clinic-primary text-white font-semibold rounded-md hover:bg-clinic-secondary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-clinic-secondary transition-colors">저장하기</button>
                </div>
            </form>
        );
    }

    const today = getCurrentDate();

    return (
         <div className="space-y-4">
            <div className="flex justify-between items-center">
                 <div className="flex border-b">
                     <button
                        onClick={() => setActiveTab('working')}
                        className={`px-4 py-2 text-sm font-semibold ${activeTab === 'working' ? 'border-b-2 border-clinic-primary text-clinic-primary' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        근무중
                    </button>
                    <button
                        onClick={() => setActiveTab('retired')}
                        className={`px-4 py-2 text-sm font-semibold ${activeTab === 'retired' ? 'border-b-2 border-clinic-primary text-clinic-primary' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        퇴사
                    </button>
                </div>
                <button
                    onClick={() => setEditingStaff('new')}
                    className="px-4 py-2 bg-clinic-primary text-white font-semibold rounded-md hover:bg-clinic-secondary transition-colors"
                >
                    <i className="fa-solid fa-plus mr-2"></i>
                    의료진 추가
                </button>
            </div>
            <div className="overflow-x-auto border rounded-lg bg-white">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">이름</th>
                            {activeTab === 'working' ? (
                                <>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">현재 근무패턴</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">입사일</th>
                                </>
                            ) : (
                                <>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">입사일</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">퇴사일</th>
                                </>
                            )}
                            <th scope="col" className="relative px-6 py-3">
                                <span className="sr-only">Edit</span>
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {filteredStaffList.map(staff => {
                             let currentPatternDisplay: React.ReactNode = <span className="text-gray-400">-</span>;

                             if (staff.status === 'working') {
                                 const activePattern = staff.workPatterns.find(p => p.startDate <= today && p.endDate >= today);
                                 if (activePattern) {
                                     const workingDays = weekDays
                                         .filter((_, index) => activePattern.days[index])
                                         .join(', ');
                                     currentPatternDisplay = workingDays || <span className="text-gray-400">휴무</span>;
                                 } else {
                                     currentPatternDisplay = <span className="text-gray-400">해당 없음</span>;
                                 }
                             }

                            return (
                                <tr key={staff.id}>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm font-medium text-gray-900">{staff.name}</div>
                                    </td>
                                    {activeTab === 'working' ? (
                                        <>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {currentPatternDisplay}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{staff.hireDate}</td>
                                        </>
                                    ) : (
                                        <>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{staff.hireDate}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{staff.fireDate || '-'}</td>
                                        </>
                                    )}
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button onClick={() => setEditingStaff(staff)} className="text-clinic-secondary hover:text-clinic-primary">수정</button>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
                 {filteredStaffList.length === 0 && (
                    <div className="text-center py-10 text-gray-500 border-t">
                        해당하는 의료진이 없습니다.
                    </div>
                )}
            </div>
         </div>
    );
};

const StaffManagement: React.FC<{
    staffList: Staff[];
    onUpdate: (staff: Staff) => void;
    onAdd: (staff: Omit<Staff, 'id'>) => void;
}> = ({ staffList, onUpdate, onAdd }) => {
    const [editingStaff, setEditingStaff] = useState<Staff | 'new' | null>(null);
    const [formData, setFormData] = useState<Omit<Staff, 'id'>>({
        name: '',
        dob: '',
        gender: 'male',
        hireDate: '',
        fireDate: null,
        status: 'working',
        rank: '사원',
        department: '데스크',
        permissions: { decoction: false, patient: false, herbalMedicine: false, payment: false, inventory: false, board: false, treatmentRoom: false },
    });
    const [activeTab, setActiveTab] = useState<'working' | 'retired'>('working');

    const filteredStaffList = staffList.filter(s => s.status === activeTab);
    
    useEffect(() => {
        if (editingStaff && editingStaff !== 'new') {
            const { id, ...dataToEdit } = editingStaff;
            setFormData(dataToEdit);
        } else if (editingStaff === 'new') {
            setFormData({
                name: '',
                dob: '',
                gender: 'male',
                hireDate: getCurrentDate(),
                fireDate: null,
                status: 'working',
                rank: '사원',
                department: '데스크',
                permissions: { decoction: false, patient: true, herbalMedicine: false, payment: true, inventory: false, board: true, treatmentRoom: false },
            });
        }
    }, [editingStaff]);

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        
        if (name === 'fireDate') {
            setFormData(prev => ({
                ...prev,
                fireDate: value,
                status: value ? 'retired' : 'working'
            }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };
    
    const handleRadioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value as 'male' | 'female' }));
    };
    
    const handlePermissionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            permissions: { ...prev.permissions, [name]: checked }
        }));
    };
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name.trim() || !formData.hireDate) {
            alert('이름과 입사일은 필수 항목입니다.');
            return;
        }
        
        const finalStatus = formData.fireDate ? 'retired' : 'working';

        if (editingStaff === 'new') {
            onAdd({...formData, status: finalStatus});
        } else if (editingStaff) {
            onUpdate({ id: editingStaff.id, ...formData, status: finalStatus });
        }
        setActiveTab(finalStatus);
        setEditingStaff(null);
    };

    if (editingStaff) {
        const title = editingStaff === 'new' ? '신규 스탭 등록' : `${formData.name}님 정보 수정`;
        const permissions: { key: keyof Staff['permissions'], label: string }[] = [
            { key: 'decoction', label: '탕전관리' },
            { key: 'patient', label: '환자관리' },
            { key: 'herbalMedicine', label: '상비약관리' },
            { key: 'payment', label: '수납현황' },
            { key: 'inventory', label: '물품관리' },
            { key: 'board', label: '게시판' },
            { key: 'treatmentRoom', label: '치료실관리' },
        ];
        const ranks: StaffRank[] = ['실장', '팀장', '주임', '사원'];
        const departments: StaffDepartment[] = ['총괄', '데스크', '치료팀', '탕전팀'];
        
        return (
             <form onSubmit={handleSubmit} className="space-y-6">
                <div className="flex items-center justify-between mb-4 -mt-2">
                    <h4 className="text-lg font-semibold text-clinic-text-primary">{title}</h4>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                    <div>
                        <label htmlFor="name" className="block text-sm font-medium text-gray-700">이름</label>
                        <input type="text" id="name" name="name" value={formData.name} onChange={handleFormChange} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-clinic-secondary focus:border-clinic-secondary sm:text-sm" />
                    </div>
                    <div>
                        <label htmlFor="dob" className="block text-sm font-medium text-gray-700">생년월일</label>
                        <input type="date" id="dob" name="dob" value={formData.dob} onChange={handleFormChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-clinic-secondary focus:border-clinic-secondary sm:text-sm" />
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-700">성별</label>
                        <div className="mt-2 flex items-center space-x-6">
                            <label className="inline-flex items-center">
                                <input type="radio" name="gender" value="male" checked={formData.gender === 'male'} onChange={handleRadioChange} className="focus:ring-clinic-secondary h-4 w-4 text-clinic-secondary border-gray-300" />
                                <span className="ml-2 text-sm text-gray-700">남성</span>
                            </label>
                            <label className="inline-flex items-center">
                                <input type="radio" name="gender" value="female" checked={formData.gender === 'female'} onChange={handleRadioChange} className="focus:ring-clinic-secondary h-4 w-4 text-clinic-secondary border-gray-300" />
                                <span className="ml-2 text-sm text-gray-700">여성</span>
                            </label>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">현재 상태</label>
                        <div className="mt-2 flex items-center h-10 px-3 bg-gray-100 rounded-md border text-sm">
                            {formData.fireDate ? (<span className="font-semibold text-red-700">퇴사</span>) : (<span className="font-semibold text-green-700">근무중</span>)}
                        </div>
                    </div>
                    <div>
                        <label htmlFor="hireDate" className="block text-sm font-medium text-gray-700">입사일</label>
                        <input type="date" id="hireDate" name="hireDate" value={formData.hireDate} onChange={handleFormChange} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-clinic-secondary focus:border-clinic-secondary sm:text-sm" />
                    </div>
                     <div>
                        <label htmlFor="fireDate" className="block text-sm font-medium text-gray-700">퇴사일</label>
                        <input type="date" id="fireDate" name="fireDate" value={formData.fireDate || ''} onChange={handleFormChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-clinic-secondary focus:border-clinic-secondary sm:text-sm" />
                    </div>
                    <div>
                        <label htmlFor="rank" className="block text-sm font-medium text-gray-700">등급</label>
                        <select id="rank" name="rank" value={formData.rank} onChange={handleFormChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-clinic-secondary focus:border-clinic-secondary sm:text-sm">
                            {ranks.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                    </div>
                     <div>
                        <label htmlFor="department" className="block text-sm font-medium text-gray-700">파트</label>
                        <select id="department" name="department" value={formData.department} onChange={handleFormChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-clinic-secondary focus:border-clinic-secondary sm:text-sm">
                           {departments.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700">접근권한</label>
                        <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-4 p-4 border rounded-md bg-white">
                            {permissions.map(p => (
                                <label key={p.key} className="flex items-center">
                                    <input
                                        type="checkbox"
                                        name={p.key}
                                        checked={formData.permissions[p.key as keyof typeof formData.permissions]}
                                        onChange={handlePermissionChange}
                                        className="h-4 w-4 rounded border-gray-300 text-clinic-secondary focus:ring-clinic-secondary"
                                    />
                                    <span className="ml-2 text-sm text-gray-700">{p.label}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="flex justify-end pt-4 border-t mt-6 space-x-2">
                    <button type="button" onClick={() => setEditingStaff(null)} className="px-6 py-2 bg-gray-200 text-gray-800 font-semibold rounded-md hover:bg-gray-300 transition-colors">취소</button>
                    <button type="submit" className="px-6 py-2 bg-clinic-primary text-white font-semibold rounded-md hover:bg-clinic-secondary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-clinic-secondary transition-colors">저장하기</button>
                </div>
            </form>
        );
    }

    return (
         <div className="space-y-4">
            <div className="flex justify-between items-center">
                 <div className="flex border-b">
                     <button
                        onClick={() => setActiveTab('working')}
                        className={`px-4 py-2 text-sm font-semibold ${activeTab === 'working' ? 'border-b-2 border-clinic-primary text-clinic-primary' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        근무중
                    </button>
                    <button
                        onClick={() => setActiveTab('retired')}
                        className={`px-4 py-2 text-sm font-semibold ${activeTab === 'retired' ? 'border-b-2 border-clinic-primary text-clinic-primary' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        퇴사
                    </button>
                </div>
                <button
                    onClick={() => setEditingStaff('new')}
                    className="px-4 py-2 bg-clinic-primary text-white font-semibold rounded-md hover:bg-clinic-secondary transition-colors"
                >
                    <i className="fa-solid fa-plus mr-2"></i>
                    스탭 추가
                </button>
            </div>
            <div className="overflow-x-auto border rounded-lg bg-white">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">이름</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">등급</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">파트</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{activeTab === 'working' ? '입사일' : '퇴사일'}</th>
                            <th scope="col" className="relative px-6 py-3"><span className="sr-only">Edit</span></th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {filteredStaffList.map(staff => (
                            <tr key={staff.id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{staff.name}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{staff.rank}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{staff.department}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{activeTab === 'working' ? staff.hireDate : (staff.fireDate || '-')}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <button onClick={() => setEditingStaff(staff)} className="text-clinic-secondary hover:text-clinic-primary">수정</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                 {filteredStaffList.length === 0 && (
                    <div className="text-center py-10 text-gray-500 border-t">
                        해당하는 스탭이 없습니다.
                    </div>
                )}
            </div>
         </div>
    );
};

const UncoveredManagement: React.FC<{
    categories: UncoveredCategories;
    onUpdate: (categories: UncoveredCategories) => void;
}> = ({ categories, onUpdate }) => {
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [draggedItem, setDraggedItem] = useState<{ type: 'main' | 'sub'; name: string } | null>(null);
    
    // Modal states
    const [addModalType, setAddModalType] = useState<'main' | 'sub' | null>(null);
    const [newItemName, setNewItemName] = useState('');
    const [editingItem, setEditingItem] = useState<{ type: 'main' | 'sub', oldName: string } | null>(null);
    const [editedItemName, setEditedItemName] = useState('');
    const [deletingItem, setDeletingItem] = useState<{ type: 'main' | 'sub', name: string } | null>(null);

    useEffect(() => {
        if (selectedCategory && !categories[selectedCategory]) {
            setSelectedCategory(null);
        } else if (!selectedCategory && Object.keys(categories).length > 0) {
            setSelectedCategory(Object.keys(categories)[0]);
        }
    }, [categories, selectedCategory]);
    
    const handleAddCategory = () => {
        setNewItemName('');
        setAddModalType('main');
    };

    const handleEditCategory = (oldName: string) => {
        setEditingItem({ type: 'main', oldName });
        setEditedItemName(oldName);
    };

    const handleDeleteCategory = (name: string) => {
        setDeletingItem({ type: 'main', name });
    };

    const handleAddSubCategory = () => {
        if (!selectedCategory) return;
        setNewItemName('');
        setAddModalType('sub');
    };

    const handleEditSubCategory = (oldName: string) => {
        setEditingItem({ type: 'sub', oldName });
        setEditedItemName(oldName);
    };

    const handleDeleteSubCategory = (name: string) => {
        setDeletingItem({ type: 'sub', name });
    };

    // Modal Handlers
    const handleCloseAddModal = () => {
        setAddModalType(null);
        setNewItemName('');
    };

    const handleSaveNewItem = () => {
        const name = newItemName.trim();
        if (!name) {
            alert("이름을 입력해주세요.");
            return;
        }

        if (addModalType === 'main') {
            if (categories[name]) {
                alert("이미 존재하는 분류 이름입니다.");
                return;
            }
            const newCategories = { ...categories, [name]: [] };
            onUpdate(newCategories);
        } else if (addModalType === 'sub' && selectedCategory) {
            if (categories[selectedCategory].includes(name)) {
                alert("이미 존재하는 항목 이름입니다.");
                return;
            }
            const newCategories = { ...categories };
            newCategories[selectedCategory] = [...newCategories[selectedCategory], name];
            onUpdate(newCategories);
        }
        handleCloseAddModal();
    };
    
    const handleCloseEditModal = () => {
        setEditingItem(null);
        setEditedItemName('');
    };
    
    const handleSaveEditedItem = () => {
        if (!editingItem) return;
        const newName = editedItemName.trim();
        if (!newName) {
            alert("이름을 입력해주세요.");
            return;
        }
        if (newName === editingItem.oldName) {
            handleCloseEditModal();
            return;
        }

        if (editingItem.type === 'main') {
            if (categories[newName]) {
                alert("이미 존재하는 분류 이름입니다.");
                return;
            }
            const newCategories: UncoveredCategories = {};
            for (const key in categories) {
                if (key === editingItem.oldName) {
                    newCategories[newName] = categories[editingItem.oldName];
                } else {
                    newCategories[key] = categories[key];
                }
            }
            onUpdate(newCategories);
            if (selectedCategory === editingItem.oldName) {
                setSelectedCategory(newName);
            }
        } else if (editingItem.type === 'sub' && selectedCategory) {
            if (categories[selectedCategory].includes(newName)) {
                alert("이미 존재하는 항목 이름입니다.");
                return;
            }
            const newCategories = { ...categories };
            newCategories[selectedCategory] = newCategories[selectedCategory].map(item => item === editingItem.oldName ? newName : item);
            onUpdate(newCategories);
        }
        handleCloseEditModal();
    };
    
    const handleCloseDeleteModal = () => {
        setDeletingItem(null);
    };

    const handleConfirmDelete = () => {
        if (!deletingItem) return;

        if (deletingItem.type === 'main') {
            const newCategories = { ...categories };
            delete newCategories[deletingItem.name];
            onUpdate(newCategories);
        } else if (deletingItem.type === 'sub' && selectedCategory) {
            const newCategories = { ...categories };
            newCategories[selectedCategory] = newCategories[selectedCategory].filter(item => item !== deletingItem.name);
            onUpdate(newCategories);
        }
        handleCloseDeleteModal();
    };
    
    // Drag and Drop Handlers
    const handleDragStart = (e: React.DragEvent, type: 'main' | 'sub', name: string) => {
        setDraggedItem({ type, name });
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        const target = e.currentTarget as HTMLElement;
        if (!target.classList.contains('drag-over-indicator')) {
          target.classList.add('drag-over-indicator');
        }
    };

    const handleDragLeave = (e: React.DragEvent) => {
        (e.currentTarget as HTMLElement).classList.remove('drag-over-indicator');
    };

    const handleDragEnd = () => {
        document.querySelectorAll('.drag-over-indicator').forEach(el => el.classList.remove('drag-over-indicator'));
        setDraggedItem(null);
    };

    const handleMainDrop = (targetCat: string) => {
        if (!draggedItem || draggedItem.type !== 'main' || draggedItem.name === targetCat) return;

        const allCats = Object.keys(categories);
        const draggedIndex = allCats.indexOf(draggedItem.name);
        const targetIndex = allCats.indexOf(targetCat);

        if (draggedIndex === -1 || targetIndex === -1) return;

        const newCatOrder = [...allCats];
        const [removed] = newCatOrder.splice(draggedIndex, 1);
        newCatOrder.splice(targetIndex, 0, removed);

        const newCategories: UncoveredCategories = {};
        newCatOrder.forEach(cat => {
            newCategories[cat] = categories[cat];
        });

        onUpdate(newCategories);
    };

    const handleSubDrop = (targetSubCat: string) => {
        if (!draggedItem || draggedItem.type !== 'sub' || draggedItem.name === targetSubCat || !selectedCategory) return;
        
        const subCats = [...categories[selectedCategory]];
        const draggedIndex = subCats.indexOf(draggedItem.name);
        const targetIndex = subCats.indexOf(targetSubCat);

        if (draggedIndex === -1 || targetIndex === -1) return;

        const [removed] = subCats.splice(draggedIndex, 1);
        subCats.splice(targetIndex, 0, removed);

        const newCategories = {
            ...categories,
            [selectedCategory]: subCats
        };
        onUpdate(newCategories);
    };

    return (
        <>
            <div className="flex gap-6 min-h-[400px]">
                {/* Main Categories Panel */}
                <div className="w-1/3 border rounded-lg p-4 bg-gray-50 flex flex-col">
                    <h4 className="font-bold mb-4 text-center">대분류</h4>
                    <div className="flex-grow space-y-2 overflow-y-auto">
                        {Object.keys(categories).map(cat => (
                            <div 
                                key={cat} 
                                className={`group flex items-center justify-between p-2 rounded-md cursor-grab ${selectedCategory === cat ? 'bg-clinic-primary text-white' : 'bg-white hover:bg-blue-50'} ${draggedItem?.type === 'main' && draggedItem.name === cat ? 'opacity-40' : ''}`}
                                onClick={() => setSelectedCategory(cat)}
                                draggable="true"
                                onDragStart={(e) => handleDragStart(e, 'main', cat)}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    (e.currentTarget as HTMLElement).classList.remove('drag-over-indicator');
                                    handleMainDrop(cat);
                                }}
                                onDragEnd={handleDragEnd}
                            >
                                <span className="font-semibold">{cat}</span>
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity space-x-2">
                                    <button onClick={(e) => { e.stopPropagation(); handleEditCategory(cat); }} className={selectedCategory === cat ? 'text-blue-200 hover:text-white' : 'text-gray-400 hover:text-clinic-secondary'}><i className="fas fa-pencil"></i></button>
                                    <button onClick={(e) => { e.stopPropagation(); handleDeleteCategory(cat); }} className={selectedCategory === cat ? 'text-blue-200 hover:text-white' : 'text-gray-400 hover:text-red-500'}><i className="fas fa-trash-can"></i></button>
                                </div>
                            </div>
                        ))}
                    </div>
                    <button onClick={handleAddCategory} className="w-full mt-4 py-2 bg-clinic-accent text-white font-semibold rounded-md hover:opacity-90 transition-opacity">
                        <i className="fas fa-plus mr-2"></i>대분류 추가
                    </button>
                </div>

                {/* Sub Categories Panel */}
                <div className="w-2/3 border rounded-lg p-4 flex flex-col">
                    {selectedCategory ? (
                        <>
                            <h4 className="font-bold mb-4 text-center">'{selectedCategory}' 소분류</h4>
                            <div className="flex-grow space-y-2 overflow-y-auto">
                                {categories[selectedCategory].map(subCat => (
                                    <div 
                                        key={subCat}
                                        className={`group flex items-center justify-between p-2 rounded-md bg-white border cursor-grab ${draggedItem?.type === 'sub' && draggedItem.name === subCat ? 'opacity-40' : ''}`}
                                        draggable="true"
                                        onDragStart={(e) => handleDragStart(e, 'sub', subCat)}
                                        onDragOver={handleDragOver}
                                        onDragLeave={handleDragLeave}
                                        onDrop={(e) => {
                                            e.preventDefault();
                                            (e.currentTarget as HTMLElement).classList.remove('drag-over-indicator');
                                            handleSubDrop(subCat);
                                        }}
                                        onDragEnd={handleDragEnd}
                                    >
                                        <span>{subCat}</span>
                                        <div className="opacity-0 group-hover:opacity-100 transition-opacity space-x-2">
                                            <button onClick={() => handleEditSubCategory(subCat)} className="text-gray-400 hover:text-clinic-secondary"><i className="fas fa-pencil"></i></button>
                                            <button onClick={() => handleDeleteSubCategory(subCat)} className="text-gray-400 hover:text-red-500"><i className="fas fa-trash-can"></i></button>
                                        </div>
                                    </div>
                                ))}
                                {categories[selectedCategory].length === 0 && <p className="text-center text-gray-500 py-4">항목이 없습니다.</p>}
                            </div>
                            <button onClick={handleAddSubCategory} className="w-full mt-4 py-2 bg-clinic-secondary text-white font-semibold rounded-md hover:bg-blue-700 transition-colors">
                                 <i className="fas fa-plus mr-2"></i>소분류 추가
                            </button>
                        </>
                    ) : (
                        <div className="flex items-center justify-center h-full text-gray-500">
                            <p>대분류를 선택하세요.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Add Modal */}
            {addModalType && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
                        <h3 className="text-xl font-semibold mb-4">
                            {addModalType === 'main' ? '새 대분류 추가' : '새 소분류 추가'}
                        </h3>
                        <input
                            type="text"
                            value={newItemName}
                            onChange={(e) => setNewItemName(e.target.value)}
                            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-clinic-secondary focus:border-clinic-secondary sm:text-sm"
                            placeholder="분류 이름"
                            autoFocus
                            onKeyDown={(e) => { if (e.key === 'Enter') handleSaveNewItem(); }}
                        />
                        <div className="flex justify-end space-x-2 mt-6">
                            <button
                                type="button"
                                onClick={handleCloseAddModal}
                                className="px-6 py-2 bg-gray-200 text-gray-800 font-semibold rounded-md hover:bg-gray-300 transition-colors"
                            >
                                취소
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveNewItem}
                                className="px-6 py-2 bg-clinic-primary text-white font-semibold rounded-md hover:bg-clinic-secondary transition-colors"
                            >
                                저장
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Edit Modal */}
            {editingItem && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
                        <h3 className="text-xl font-semibold mb-4">이름 수정</h3>
                        <input
                            type="text"
                            value={editedItemName}
                            onChange={(e) => setEditedItemName(e.target.value)}
                            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-clinic-secondary focus:border-clinic-secondary sm:text-sm"
                            placeholder="새 이름"
                            autoFocus
                            onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEditedItem(); }}
                        />
                        <div className="flex justify-end space-x-2 mt-6">
                            <button
                                type="button"
                                onClick={handleCloseEditModal}
                                className="px-6 py-2 bg-gray-200 text-gray-800 font-semibold rounded-md hover:bg-gray-300 transition-colors"
                            >
                                취소
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveEditedItem}
                                className="px-6 py-2 bg-clinic-primary text-white font-semibold rounded-md hover:bg-clinic-secondary transition-colors"
                            >
                                저장
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deletingItem && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 text-center">
                        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                            <i className="fa-solid fa-triangle-exclamation text-2xl text-red-600"></i>
                        </div>
                        <h3 className="text-lg leading-6 font-semibold text-gray-900">
                            정말로 삭제하시겠습니까?
                        </h3>
                        <div className="mt-2">
                            <p className="text-sm text-gray-600">
                                <span className="font-bold">{deletingItem.name}</span> 항목을 삭제합니다.
                                {deletingItem.type === 'main' && " 포함된 모든 소분류 항목도 함께 삭제됩니다."}
                                <br/>
                                이 작업은 되돌릴 수 없습니다.
                            </p>
                        </div>
                        <div className="flex justify-center space-x-4 mt-6">
                            <button
                                type="button"
                                onClick={handleCloseDeleteModal}
                                className="px-8 py-2 bg-gray-200 text-gray-800 font-semibold rounded-md hover:bg-gray-300 transition-colors"
                            >
                                취소
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmDelete}
                                className="px-8 py-2 bg-red-600 text-white font-semibold rounded-md hover:bg-red-700 transition-colors"
                            >
                                삭제
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

// 환자 DB 동기화 컴포넌트
const PatientDbSync: React.FC = () => {
    const [syncStatus, setSyncStatus] = useState<{
        mssqlCount: number;
        supabaseCount: number;
        isSynced: boolean;
        difference: number;
    } | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastChecked, setLastChecked] = useState<Date | null>(null);

    const checkSyncStatus = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const mssqlApiUrl = import.meta.env.VITE_MSSQL_API_URL || 'http://192.168.0.173:3100';
            const response = await fetch(`${mssqlApiUrl}/api/sync/status`);
            if (!response.ok) throw new Error('동기화 상태 확인 실패');
            const data = await response.json();
            if (data.success) {
                setSyncStatus({
                    mssqlCount: data.mssqlCount,
                    supabaseCount: data.supabaseCount,
                    isSynced: data.isSynced,
                    difference: data.difference
                });
                setLastChecked(new Date());
            } else {
                throw new Error(data.error || '알 수 없는 오류');
            }
        } catch (err: any) {
            setError(err.message || '동기화 상태 확인 중 오류 발생');
        } finally {
            setIsLoading(false);
        }
    };

    const executeSync = async () => {
        if (!window.confirm('차트DB(MSSQL)의 환자 데이터를 운영DB(Supabase)에 동기화하시겠습니까?')) {
            return;
        }
        setIsSyncing(true);
        setError(null);
        try {
            const mssqlApiUrl = import.meta.env.VITE_MSSQL_API_URL || 'http://192.168.0.173:3100';
            const response = await fetch(`${mssqlApiUrl}/api/sync/execute`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            if (!response.ok) throw new Error('동기화 실행 실패');
            const data = await response.json();
            if (data.success) {
                alert(data.message);
                await checkSyncStatus();
            } else {
                throw new Error(data.error || '알 수 없는 오류');
            }
        } catch (err: any) {
            setError(err.message || '동기화 실행 중 오류 발생');
        } finally {
            setIsSyncing(false);
        }
    };

    useEffect(() => {
        checkSyncStatus();
    }, []);

    return (
        <div className="space-y-6">
            {/* 동기화 상태 카드 */}
            <div className="bg-gray-50 p-6 rounded-lg border">
                <div className="flex items-center justify-between mb-4">
                    <h4 className="font-semibold text-gray-800 text-lg">DB 동기화 상태</h4>
                    <button
                        onClick={checkSyncStatus}
                        disabled={isLoading}
                        className="text-sm text-clinic-secondary hover:text-blue-700 flex items-center gap-1"
                    >
                        <i className={`fa-solid fa-rotate ${isLoading ? 'fa-spin' : ''}`}></i>
                        새로고침
                    </button>
                </div>

                {error && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
                        <i className="fa-solid fa-circle-exclamation mr-2"></i>
                        {error}
                    </div>
                )}

                {isLoading && !syncStatus ? (
                    <div className="flex items-center justify-center py-8">
                        <i className="fa-solid fa-spinner fa-spin text-2xl text-gray-400"></i>
                    </div>
                ) : syncStatus && (
                    <>
                        {/* 상태 표시 */}
                        <div className={`mb-6 p-4 rounded-lg border-2 ${
                            syncStatus.isSynced
                                ? 'bg-green-50 border-green-300'
                                : 'bg-yellow-50 border-yellow-300'
                        }`}>
                            <div className="flex items-center gap-3">
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                                    syncStatus.isSynced ? 'bg-green-500' : 'bg-yellow-500'
                                }`}>
                                    <i className={`fa-solid ${syncStatus.isSynced ? 'fa-check' : 'fa-exclamation'} text-white text-xl`}></i>
                                </div>
                                <div>
                                    <p className={`font-bold text-lg ${
                                        syncStatus.isSynced ? 'text-green-700' : 'text-yellow-700'
                                    }`}>
                                        {syncStatus.isSynced ? '동기화 완료' : '동기화 필요'}
                                    </p>
                                    <p className="text-sm text-gray-600">
                                        {syncStatus.isSynced
                                            ? '차트DB와 운영DB가 일치합니다.'
                                            : `${syncStatus.difference}명의 환자가 동기화되지 않았습니다.`}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* 상세 정보 */}
                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div className="bg-white p-4 rounded-lg border">
                                <div className="flex items-center gap-2 mb-2">
                                    <i className="fa-solid fa-database text-blue-500"></i>
                                    <span className="text-sm font-medium text-gray-600">차트DB (MSSQL)</span>
                                </div>
                                <p className="text-3xl font-bold text-gray-800">
                                    {syncStatus.mssqlCount.toLocaleString()}
                                    <span className="text-lg font-medium text-gray-500 ml-1">명</span>
                                </p>
                            </div>
                            <div className="bg-white p-4 rounded-lg border">
                                <div className="flex items-center gap-2 mb-2">
                                    <i className="fa-solid fa-cloud text-green-500"></i>
                                    <span className="text-sm font-medium text-gray-600">운영DB (Supabase)</span>
                                </div>
                                <p className="text-3xl font-bold text-gray-800">
                                    {syncStatus.supabaseCount.toLocaleString()}
                                    <span className="text-lg font-medium text-gray-500 ml-1">명</span>
                                </p>
                            </div>
                        </div>

                        {/* 동기화 버튼 */}
                        {!syncStatus.isSynced && (
                            <button
                                onClick={executeSync}
                                disabled={isSyncing}
                                className={`w-full py-3 rounded-md font-semibold text-white transition-colors ${
                                    isSyncing
                                        ? 'bg-gray-400 cursor-not-allowed'
                                        : 'bg-clinic-secondary hover:bg-blue-700'
                                }`}
                            >
                                {isSyncing ? (
                                    <>
                                        <i className="fa-solid fa-spinner fa-spin mr-2"></i>
                                        동기화 중...
                                    </>
                                ) : (
                                    <>
                                        <i className="fa-solid fa-arrows-rotate mr-2"></i>
                                        지금 동기화하기
                                    </>
                                )}
                            </button>
                        )}

                        {lastChecked && (
                            <p className="text-xs text-gray-400 text-center mt-4">
                                마지막 확인: {lastChecked.toLocaleString('ko-KR')}
                            </p>
                        )}
                    </>
                )}
            </div>

            {/* 안내 문구 */}
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h5 className="font-medium text-blue-800 mb-2">
                    <i className="fa-solid fa-circle-info mr-2"></i>
                    동기화 안내
                </h5>
                <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
                    <li>차트DB(MSSQL)의 환자 데이터가 운영DB(Supabase)에 동기화됩니다.</li>
                    <li>동기화는 차트번호 기준으로 새로운 환자만 추가됩니다.</li>
                    <li>기존 환자 정보는 수정되지 않습니다.</li>
                </ul>
            </div>
        </div>
    );
};

const Settings: React.FC<SettingsProps> = ({
    addBulkPatients, allPatients, deletePatient, deletedPatients, restorePatient,
    medicalStaff, updateMedicalStaff, addMedicalStaff, deleteMedicalStaff,
    staff, updateStaff, addStaff, deleteStaff,
    uncoveredCategories, updateUncoveredCategories,
    consultationItems, addConsultationItem, updateConsultationItem, deleteConsultationItem,
    reorderConsultationItems, addSubItem, updateSubItem, deleteSubItem, reorderSubItems
}) => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [currentView, setCurrentView] = useState<'main' | 'patient' | 'staff' | 'uncovered' | 'patientDelete' | 'treatmentRoom' | 'staffMedical' | 'staffRegular' | 'consultationItems'>('main');
    const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0, message: '' });
    const [patientCount, setPatientCount] = useState<number | null>(null);

    // DB에서 환자 수 조회
    useEffect(() => {
        const loadPatientCount = async () => {
            try {
                const count = await api.fetchPatientCount();
                setPatientCount(count);
            } catch (error) {
                console.error('❌ 환자 수 조회 오류:', error);
                setPatientCount(0);
            }
        };
        loadPatientCount();
    }, [currentView]);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsLoading(true);
        setError('');

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                // Using header: 1 to parse into an array of arrays
                const json: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                
                if (json.length < 2) {
                    throw new Error('엑셀 파일에 데이터가 없습니다 (헤더 포함 최소 2줄 필요).');
                }

                const headers: string[] = json[0].map(h => String(h || '').trim());

                // 필수 헤더 검증 ('이름'만 필수)
                const requiredHeaders = ['이름'];
                const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
                if (missingHeaders.length > 0) {
                    throw new Error(`엑셀 파일에 필수 헤더가 누락되었습니다: ${missingHeaders.join(', ')}`);
                }

                // 지원하는 헤더 매핑 (이 목록에 없는 헤더는 자동으로 무시됨)
                const headerMap: { [key: string]: string } = {
                    '이름': 'name', '차트번호': 'chartNumber', '생년월일': 'dob', '생일': 'dob',
                    '성별': 'gender', '주소': 'address', '등록일': 'registrationDate',
                    '연락처': 'phone', '휴대폰': 'phone', '유입정보': 'referralInfo', '유입경로': 'referralInfo',
                    '키워드1': 'keyword1', '키워드2': 'keyword2', 'URL': 'keyword1',
                    '담당의': 'doctor', '주치의': 'doctor', '소개자': 'referrer'
                };

                // 엑셀 파일의 헤더 중 지원하는 것만 인덱스에 매핑 (나머지는 무시)
                const headerIndices: { [key: string]: number } = {};
                headers.forEach((h, i) => {
                    const mappedKey = Object.keys(headerMap).find(key => key === h);
                    if(mappedKey) headerIndices[headerMap[mappedKey]] = i;
                });

                // 인식된 필드 확인 (디버깅용)
                const recognizedFields = Object.keys(headerIndices);
                console.log('인식된 필드:', recognizedFields);

                const parseExcelDate = (excelDate: any): string | undefined => {
                    if (!excelDate) return undefined;
                    if (typeof excelDate === 'number') {
                        const date = XLSX.SSF.parse_date_code(excelDate);
                        return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
                    }
                    // Handle YYYY.MM.DD or YYYY-MM-DD or YYYY/MM/DD formats
                    const dateStr = String(excelDate).replace(/[.\/]/g, '-');
                    const d = new Date(dateStr);
                    if (!isNaN(d.getTime()) && d.getFullYear() > 1900) {
                        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                    }
                    return String(excelDate);
                };

                const dataRows = json.slice(1);

                const newPatients: BulkPatientData[] = dataRows.map(row => {
                    const detailsParts = [
                        row[headerIndices['referralInfo']],
                        row[headerIndices['keyword1']],
                        row[headerIndices['keyword2']],
                        row[headerIndices['referrer']] ? `소개자:${row[headerIndices['referrer']]}` : null
                    ].filter(part => part && String(part).trim() !== '');

                    const genderValue = row[headerIndices['gender']];
                    let gender: 'male' | 'female' | undefined;
                    if (genderValue === true || String(genderValue).toLowerCase() === 'true' || String(genderValue).trim() === '남성') {
                        gender = 'male';
                    } else if (genderValue === false || String(genderValue).toLowerCase() === 'false' || String(genderValue).trim() === '여성') {
                        gender = 'female';
                    }

                    // 차트번호 처리: 숫자인 경우 6자리로 패딩하여 앞의 0 보존
                    const processChartNumber = (chartNum: any): string => {
                        if (!chartNum) return '';
                        const chartStr = String(chartNum).trim();
                        // 숫자만으로 구성되어 있고 6자리 미만이면 6자리로 패딩
                        if (/^\d+$/.test(chartStr) && chartStr.length < 6) {
                            return chartStr.padStart(6, '0');
                        }
                        return chartStr;
                    };

                    return {
                        name: String(row[headerIndices['name']] || '').trim(),
                        chartNumber: processChartNumber(row[headerIndices['chartNumber']]),
                        dob: parseExcelDate(row[headerIndices['dob']]),
                        gender: gender,
                        address: String(row[headerIndices['address']] || ''),
                        phone: String(row[headerIndices['phone']] || ''),
                        details: detailsParts.join('+'),
                        registrationDate: parseExcelDate(row[headerIndices['registrationDate']]),
                    };
                }).filter(p => p.name);

                if (newPatients.length > 0) {
                    console.log(`📤 일괄 등록 시작: ${newPatients.length}명`);

                    // 프로그레스 바 초기화
                    setUploadProgress({ current: 0, total: newPatients.length, message: '데이터 검증 중...' });

                    // await를 사용하여 DB 저장 완료까지 대기
                    const result = await addBulkPatients(newPatients, (current, total, message) => {
                        console.log(`📊 [프로그레스] ${current}/${total} - ${message}`);
                        setUploadProgress({ current, total, message });
                    });

                    // 성공 메시지에 인식된 필드 정보 포함
                    const fieldNames: { [key: string]: string } = {
                        'name': '이름', 'chartNumber': '차트번호', 'dob': '생년월일',
                        'gender': '성별', 'address': '주소', 'phone': '전화번호',
                        'referralInfo': '유입경로', 'doctor': '담당의', 'referrer': '소개자',
                        'keyword1': '키워드', 'keyword2': '키워드2', 'registrationDate': '등록일'
                    };
                    const recognizedFieldNames = recognizedFields
                        .filter(f => f !== 'keyword2') // keyword2는 표시 안 함
                        .map(f => fieldNames[f] || f)
                        .join(', ');

                    let message = `✅ 일괄 등록 완료!\n\n`;
                    message += `신규 등록: ${result.new}명\n`;
                    message += `정보 업데이트: ${result.updated}명\n`;
                    if (result.failures && result.failures.length > 0) {
                        message += `실패: ${result.failures.length}건\n\n`;
                        message += `실패 목록:\n`;
                        result.failures.slice(0, 5).forEach((f: any) => {
                            message += `- ${f.name} (${f.chartNumber || '차트번호 없음'}): ${f.reason}\n`;
                        });
                        if (result.failures.length > 5) {
                            message += `... 외 ${result.failures.length - 5}건\n`;
                        }
                    }
                    message += `\n인식된 필드: ${recognizedFieldNames}`;

                    console.log(`✅ 일괄 등록 완료: 신규 ${result.new}명, 업데이트 ${result.updated}명`);

                    // 프로그레스 바 초기화
                    setUploadProgress({ current: 0, total: 0, message: '' });

                    alert(message);
                } else {
                    throw new Error('엑셀 파일에서 유효한 환자 데이터를 찾을 수 없습니다.');
                }
            } catch (err: any) {
                const errorMessage = err.message || '파일을 처리하는 중 오류가 발생했습니다.';
                setError(errorMessage);
                setUploadProgress({ current: 0, total: 0, message: '' });
                alert(errorMessage);
            } finally {
                setIsLoading(false);
                if (event.target) event.target.value = '';
            }
        };
        reader.onerror = () => {
            const errorMessage = '파일을 읽는 중 오류가 발생했습니다.';
            setError(errorMessage);
            alert(errorMessage);
            setIsLoading(false);
            if (event.target) event.target.value = '';
        };
        reader.readAsArrayBuffer(file);
    };

    const downloadExampleFile = () => {
        // Create example data with Korean headers matching user's Excel structure
        const exampleData = [
            ['이름', '차트번호', '휴대폰', '생일', '주소', '성별', '유입경로', '주치의', '소개자', 'URL'],
            ['가대순', '001969', '010-9113-2363', '1985-12-25', '천안시 동남구 신방동 초원@ 111-917', true, '', '', '', ''],
            ['가명월', '018537', '010-4801-3527', '1980-04-15', '충청남도 천안시 서북구 불당19로 95 천안불당린스트라우스1단지 104-1703', false, '네이버', '신덕재', '', '불당동 한의원'],
            ['가성훈', '000749', '010-3446-8555', '1967-03-10', '충청남도 천안시 동남구 쌍용동 경동@ 102-407', true, '', '', '', '']
        ];

        // Create workbook and worksheet
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(exampleData);

        // Set column widths for better readability
        ws['!cols'] = [
            { wch: 10 },  // 이름
            { wch: 10 },  // 차트번호
            { wch: 15 },  // 휴대폰
            { wch: 12 },  // 생일
            { wch: 50 },  // 주소
            { wch: 8 },   // 성별 (True/False)
            { wch: 12 },  // 유입경로
            { wch: 10 },  // 주치의
            { wch: 12 },  // 소개자
            { wch: 15 }   // URL
        ];

        // Add worksheet to workbook
        XLSX.utils.book_append_sheet(wb, ws, '환자 일괄등록 예시');

        // Generate and download file
        XLSX.writeFile(wb, '환자_일괄등록_예시파일.xlsx');
    };

    const SettingsPage: React.FC<{title: string, onBack: () => void, children: React.ReactNode}> = ({title, onBack, children}) => (
        <div>
            <div className="flex items-center mb-6 -mt-2">
                <button onClick={onBack} className="flex items-center text-gray-600 hover:text-gray-900 font-semibold text-sm">
                    <i className="fa-solid fa-arrow-left mr-2"></i>
                    <span>설정 메뉴로 돌아가기</span>
                </button>
            </div>
            <h3 className="text-xl font-semibold text-clinic-primary border-b pb-2 mb-4">{title}</h3>
            <div className="space-y-4">
                {children}
            </div>
        </div>
    );

    const SettingsItem: React.FC<{title: string, description: string, children?: React.ReactNode}> = ({title, description, children}) => (
         <div className="bg-gray-50 p-4 rounded-lg border">
            <h4 className="font-semibold text-gray-800">{title}</h4>
            <p className="text-sm text-gray-600 mt-1 mb-3">{description}</p>
            {children}
        </div>
    );
    
    const MenuButton: React.FC<{icon: string, title: string, description: string, onClick: () => void}> = ({icon, title, description, onClick}) => (
        <button onClick={onClick} className="w-full text-left flex items-center p-4 bg-white rounded-lg shadow-sm border hover:bg-gray-50 hover:border-clinic-secondary transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-clinic-secondary">
            <div className="flex items-center justify-center w-12 h-12 bg-clinic-secondary text-white rounded-lg mr-4 flex-shrink-0">
                <i className={`fa-solid ${icon} text-2xl`}></i>
            </div>
            <div className="flex-1">
                <h4 className="font-bold text-lg text-clinic-primary">{title}</h4>
                <p className="text-sm text-clinic-text-secondary mt-1">{description}</p>
            </div>
             <i className="fa-solid fa-chevron-right text-gray-400 ml-4"></i>
        </button>
    );

    // Default: Main View
    return (
        <div className="flex items-center justify-center h-64 text-gray-500">
            <div className="text-center">
                <i className="fas fa-cog text-4xl text-gray-300 mb-3"></i>
                <p>설정 항목이 없습니다.</p>
            </div>
        </div>
    );
};

export default React.memo(Settings);