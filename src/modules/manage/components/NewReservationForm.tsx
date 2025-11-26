import React, { useState, useEffect } from 'react';
import { Patient, Treatment, Reservation } from '../types';
import { TREATMENTS } from '../constants';
import Modal from './Modal';

export interface NewReservationData {
    patient: Patient;
    doctor: string;
    date: Date;
    time: string;
    treatments: Treatment[];
    memo?: string;
}

interface NewReservationFormProps {
    doctor: string;
    time: string;
    date: Date;
    onSave: (data: NewReservationData) => void;
    onUpdate: (reservationId: string, data: NewReservationData) => void;
    onCancelReservation: (reservationId: string) => void;
    onDeleteReservation: (reservationId: string) => void;
    onClose: () => void;
    allPatients: Patient[];
    existingReservation?: Reservation;
    doctors: string[];
    timeSlots: string[];
    initialPatient?: Patient | null;
}

const getYYYYMMDD = (d: Date): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const NewReservationForm: React.FC<NewReservationFormProps> = ({ 
    doctor, time, date, onSave, onUpdate, onCancelReservation, onDeleteReservation, 
    onClose, allPatients, existingReservation, doctors, timeSlots, initialPatient
}) => {
    const isEditMode = !!existingReservation;
    
    const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<Patient[]>([]);
    const [isDeleteConfirmVisible, setIsDeleteConfirmVisible] = useState(false);
    
    const [formData, setFormData] = useState({
        doctor: isEditMode ? existingReservation.doctor : doctor,
        date: isEditMode ? new Date(existingReservation.date.replace(/-/g, '/')) : date, // Handles timezone correctly
        time: isEditMode ? existingReservation.time : time,
        treatments: isEditMode ? existingReservation.treatments : [],
        memo: isEditMode ? existingReservation.memo || '' : '',
    });

    useEffect(() => {
        if (isEditMode) {
            const patient = allPatients.find(p => p.id === existingReservation.patientId);
            setSelectedPatient(patient || null);
        } else if (initialPatient) {
            setSelectedPatient(initialPatient);
        }
    }, [isEditMode, existingReservation, allPatients, initialPatient]);

    useEffect(() => {
        if (!isEditMode && searchTerm.trim() !== '') {
            const filtered = allPatients.filter(p => 
                p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                (p.chartNumber && p.chartNumber.includes(searchTerm))
            );
            setSearchResults(filtered);
        } else {
            setSearchResults([]);
        }
    }, [searchTerm, allPatients, isEditMode]);

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        if (name === 'date') {
            setFormData(prev => ({ ...prev, date: new Date(value.replace(/-/g, '/')) }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleTreatmentChange = (treatment: Treatment, isChecked: boolean) => {
        let newTreatments;
        if (isChecked) {
            newTreatments = [...formData.treatments, treatment];
        } else {
            newTreatments = formData.treatments.filter(t => t.name !== treatment.name);
        }
        setFormData(prev => ({ ...prev, treatments: newTreatments }));
    };
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedPatient) {
            alert('환자를 선택해주세요.');
            return;
        }
        if (formData.treatments.length === 0) {
            alert('치료 항목을 하나 이상 선택해주세요.');
            return;
        }
        const submissionData: NewReservationData = {
            patient: selectedPatient,
            doctor: formData.doctor,
            date: formData.date,
            time: formData.time,
            treatments: formData.treatments,
            memo: formData.memo,
        };

        if (isEditMode) {
            onUpdate(existingReservation.id, submissionData);
        } else {
            onSave(submissionData);
        }
    };
    
    const handleDelete = () => {
        if (isEditMode) {
            setIsDeleteConfirmVisible(true);
        }
    };

    const handleConfirmDelete = () => {
        if (isEditMode) {
            onDeleteReservation(existingReservation.id);
        }
        setIsDeleteConfirmVisible(false);
    };

    const handleCancel = () => {
        if (isEditMode) {
            onCancelReservation(existingReservation.id);
        }
    };

    const totalActing = formData.treatments.reduce((sum, t) => sum + t.acting, 0);

    return (
        <>
            <form onSubmit={handleSubmit} className="space-y-6">
                {isEditMode || initialPatient ? (
                    <div className="bg-gray-100 p-4 rounded-lg border">
                        <h4 className="text-sm font-medium text-gray-500">예약환자</h4>
                        <p className="font-semibold text-xl text-clinic-primary">{selectedPatient?.name} <span className="text-lg font-normal text-gray-600">({selectedPatient?.chartNumber})</span></p>
                    </div>
                ) : (
                    <div>
                        <label htmlFor="patient-search" className="block text-sm font-medium text-gray-700">환자 검색</label>
                        {selectedPatient ? (
                            <div className="mt-1 flex items-center justify-between bg-blue-50 p-3 rounded-md border border-blue-200">
                                <p className="font-semibold text-clinic-primary">{selectedPatient.name} <span className="font-normal text-gray-600">({selectedPatient.chartNumber})</span></p>
                                <button type="button" onClick={() => setSelectedPatient(null)} className="text-xs text-red-600 hover:underline">환자 변경</button>
                            </div>
                        ) : (
                            <div className="relative">
                                <input
                                    type="text"
                                    id="patient-search"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="mt-1 block w-full pl-4 pr-10 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-clinic-secondary focus:border-clinic-secondary sm:text-sm"
                                    placeholder="이름 또는 차트번호로 검색..."
                                    autoComplete="off"
                                />
                                <i className="fa-solid fa-magnifying-glass absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                                {searchResults.length > 0 && (
                                    <ul className="absolute z-10 mt-1 w-full border border-gray-200 rounded-md max-h-40 overflow-y-auto bg-white shadow-lg">
                                        {searchResults.map(p => (
                                            <li 
                                                key={p.id} 
                                                className="p-3 hover:bg-blue-50 cursor-pointer border-b last:border-b-0"
                                                onClick={() => { setSelectedPatient(p); setSearchTerm(''); setSearchResults([]); }}
                                            >
                                                <span className="font-semibold">{p.name}</span>
                                                <span className="text-sm text-gray-500 ml-2">({p.chartNumber})</span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        )}
                    </div>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label htmlFor="doctor" className="block text-sm font-medium text-gray-700">담당원장</label>
                        <select id="doctor" name="doctor" value={formData.doctor} onChange={handleFormChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-clinic-secondary focus:border-clinic-secondary sm:text-sm">
                            {doctors.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="date" className="block text-sm font-medium text-gray-700">예약일</label>
                        <input type="date" id="date" name="date" value={getYYYYMMDD(formData.date)} onChange={handleFormChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-clinic-secondary focus:border-clinic-secondary sm:text-sm" />
                    </div>
                    <div>
                        <label htmlFor="time" className="block text-sm font-medium text-gray-700">예약시간</label>
                        <select id="time" name="time" value={formData.time} onChange={handleFormChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-clinic-secondary focus:border-clinic-secondary sm:text-sm">
                            {timeSlots.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>
                </div>

                <div>
                    <h4 className="block text-sm font-medium text-gray-700 mb-2">치료 내역</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {TREATMENTS.map(treatment => (
                            <label key={treatment.name} className="flex items-center p-3 border rounded-lg hover:bg-gray-50 cursor-pointer has-[:checked]:bg-blue-50 has-[:checked]:border-blue-400">
                                <input
                                    type="checkbox"
                                    checked={formData.treatments.some(t => t.name === treatment.name)}
                                    className="h-5 w-5 rounded border-gray-300 text-clinic-secondary focus:ring-clinic-secondary"
                                    onChange={(e) => handleTreatmentChange(treatment, e.target.checked)}
                                />
                                <span className="ml-3 text-sm font-medium text-gray-800">{treatment.name}</span>
                                <span className="ml-auto text-xs font-mono bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">
                                    {treatment.acting}
                                </span>
                            </label>
                        ))}
                    </div>
                    <div className="text-right mt-2 font-semibold text-gray-700">
                        총 액팅: <span className="text-clinic-primary text-lg">{totalActing}</span>
                    </div>
                </div>

                <div>
                    <label htmlFor="memo" className="block text-sm font-medium text-gray-700">메모</label>
                    <textarea 
                        id="memo" 
                        name="memo" 
                        rows={3} 
                        value={formData.memo}
                        onChange={handleFormChange}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-clinic-secondary focus:border-clinic-secondary sm:text-sm"
                        placeholder="예약 관련 참고사항을 입력하세요... (예: 20분 일찍 도착 예정)"
                    ></textarea>
                </div>

                <div className="flex justify-between items-center pt-4 border-t mt-6">
                    <div>
                    {isEditMode && (
                        <div className="flex space-x-2">
                            <button type="button" onClick={handleCancel} className="px-4 py-2 bg-yellow-500 text-white font-semibold rounded-md hover:bg-yellow-600 transition-colors">예약 취소</button>
                            <button type="button" onClick={handleDelete} className="px-4 py-2 bg-red-600 text-white font-semibold rounded-md hover:bg-red-700 transition-colors">예약 삭제</button>
                        </div>
                    )}
                    </div>
                    <div className="flex">
                        <button type="button" onClick={onClose} className="mr-2 px-6 py-2 bg-gray-200 text-gray-800 font-semibold rounded-md hover:bg-gray-300 transition-colors">닫기</button>
                        <button type="submit" className="px-6 py-2 bg-clinic-primary text-white font-semibold rounded-md hover:bg-clinic-secondary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-clinic-secondary transition-colors">
                            {isEditMode ? '예약 수정' : '예약 저장'}
                        </button>
                    </div>
                </div>
            </form>

            {isEditMode && (
                <Modal
                    isOpen={isDeleteConfirmVisible}
                    onClose={() => setIsDeleteConfirmVisible(false)}
                    title="예약 삭제 확인"
                >
                    <div className="text-center p-4">
                        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                            <i className="fa-solid fa-triangle-exclamation text-2xl text-red-600"></i>
                        </div>
                        <h3 className="text-lg leading-6 font-semibold text-gray-900">
                            정말로 삭제하시겠습니까?
                        </h3>
                        <div className="mt-2">
                            <p className="text-sm text-gray-600">
                                <span className="font-bold">{existingReservation.patientName}</span>님의 
                                <span className="font-bold">
                                    {' '}{new Date(existingReservation.date.replace(/-/g, '/')).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}
                                    {' '}{existingReservation.time}
                                </span>
                                {' '}예약을 정말 삭제하시겠습니까?
                            </p>
                        </div>
                        <div className="flex justify-center space-x-4 mt-6">
                            <button
                                type="button"
                                onClick={() => setIsDeleteConfirmVisible(false)}
                                className="px-8 py-2 bg-gray-200 text-gray-800 font-semibold rounded-md hover:bg-gray-300 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400"
                            >
                                취소
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmDelete}
                                className="px-8 py-2 bg-red-600 text-white font-semibold rounded-md hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                            >
                                삭제
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </>
    );
};

export default NewReservationForm;