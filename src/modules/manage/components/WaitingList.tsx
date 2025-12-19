
import React, { useState, useRef, useEffect } from 'react';
import { Patient } from '../types';
import Quadrant from './Quadrant';

interface WaitingListProps {
  title: string;
  icon: string;
  list: Patient[];
  listType: 'consultation' | 'treatment';
  onPatientClick: (patient: Patient) => void;
  onPatientDrop: (
    draggedPatientId: number,
    sourceListType: 'consultation' | 'treatment' | 'consultation_room',
    destinationListType: 'consultation' | 'treatment',
    targetPatientId: number | null
  ) => void;
  onMoveToPayment?: (patientId: number, sourceList: 'consultation' | 'treatment') => void;
  onCancelRegistration?: (patientId: number) => void;
  onEditConsultationInfo?: (patient: Patient) => void;
  onEditTreatmentInfo?: (patient: Patient) => void;
}

const WaitingListItem: React.FC<{
    patient: Patient;
    onClick: (patient: Patient) => void;
    listType: 'consultation' | 'treatment';
    onPatientDrop: WaitingListProps['onPatientDrop'];
    onMoveToPayment?: WaitingListProps['onMoveToPayment'];
    onCancelRegistration?: WaitingListProps['onCancelRegistration'];
    onEditConsultationInfo?: WaitingListProps['onEditConsultationInfo'];
    onEditTreatmentInfo?: WaitingListProps['onEditTreatmentInfo'];
}> = ({ patient, onClick, listType, onPatientDrop, onMoveToPayment, onCancelRegistration, onEditConsultationInfo, onEditTreatmentInfo }) => {
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    const handleDragStart = (e: React.DragEvent<HTMLLIElement>) => {
        e.dataTransfer.setData('patientId', patient.id.toString());
        e.dataTransfer.setData('sourceListType', listType);
        setTimeout(() => {
            (e.target as HTMLLIElement).style.opacity = '0.4';
        }, 0);
    };

    const handleDragEnd = (e: React.DragEvent<HTMLLIElement>) => {
        (e.target as HTMLLIElement).style.opacity = '1';
        document.querySelectorAll('.drag-over-indicator').forEach(el => el.classList.remove('drag-over-indicator'));
    };

    const handleDragOver = (e: React.DragEvent<HTMLLIElement>) => {
        e.preventDefault();
        if (!e.currentTarget.classList.contains('drag-over-indicator')) {
          e.currentTarget.classList.add('drag-over-indicator');
        }
    };

    const handleDragLeave = (e: React.DragEvent<HTMLLIElement>) => {
        e.currentTarget.classList.remove('drag-over-indicator');
    };

    const handleDrop = (e: React.DragEvent<HTMLLIElement>) => {
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.classList.remove('drag-over-indicator');
        const draggedPatientId = parseInt(e.dataTransfer.getData('patientId'), 10);
        const sourceListType = e.dataTransfer.getData('sourceListType') as 'consultation' | 'treatment' | 'consultation_room';

        console.log('📥 WaitingListItem 드롭:', { draggedPatientId, sourceListType, listType, targetPatientId: patient.id });

        if (draggedPatientId !== patient.id) {
            onPatientDrop(draggedPatientId, sourceListType, listType, patient.id);
        }
    };

    // 우클릭 메뉴
    const handleContextMenu = (event: React.MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();
        setContextMenu({ x: event.clientX, y: event.clientY });
    };

    const handleMoveToPaymentClick = () => {
        if (onMoveToPayment) {
            onMoveToPayment(patient.id, listType);
        }
        setContextMenu(null);
    };

    const handleCancelRegistrationClick = () => {
        if (onCancelRegistration) {
            onCancelRegistration(patient.id);
        }
        setContextMenu(null);
    };

    const handleEditConsultationInfoClick = () => {
        if (onEditConsultationInfo) {
            onEditConsultationInfo(patient);
        }
        setContextMenu(null);
    };

    const handleEditTreatmentInfoClick = () => {
        if (onEditTreatmentInfo) {
            onEditTreatmentInfo(patient);
        }
        setContextMenu(null);
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
          if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
            setContextMenu(null);
          }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
          document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // 차트번호 앞의 0 제거
    const formatChartNumber = (chartNumber?: string) => {
        if (!chartNumber) return '';
        return chartNumber.replace(/^0+/, '') || '0';
    };

    // 나이 계산
    const getAge = (dob?: string) => {
        if (!dob) return '';
        const birthYear = new Date(dob).getFullYear();
        const currentYear = new Date().getFullYear();
        return currentYear - birthYear;
    };

    // 성별 표시
    const getGenderDisplay = (gender?: 'male' | 'female') => {
        if (!gender) return '';
        return gender === 'male' ? '남' : '여';
    };

    const gender = getGenderDisplay(patient.gender);
    const age = getAge(patient.dob);
    const genderAge = gender || age ? `${gender}${gender && age ? '/' : ''}${age}` : '';

    // 대기 시간 계산 (분 단위)
    const getWaitingMinutes = (timeStr?: string): number => {
        if (!timeStr) return 0;
        const [hours, minutes] = timeStr.split(':').map(Number);
        if (isNaN(hours) || isNaN(minutes)) return 0;

        const now = new Date();
        const waitingSince = new Date();
        waitingSince.setHours(hours, minutes, 0, 0);

        // 만약 대기 시작 시간이 현재보다 미래면 (자정 넘김 케이스)
        if (waitingSince > now) {
            waitingSince.setDate(waitingSince.getDate() - 1);
        }

        return Math.max(0, Math.floor((now.getTime() - waitingSince.getTime()) / (1000 * 60)));
    };

    const waitingMinutes = getWaitingMinutes(patient.time);
    const isLongWait = waitingMinutes >= 30; // 30분 이상 대기 시 하이라이트
    const isVeryLongWait = waitingMinutes >= 60; // 60분 이상 대기 시 강한 하이라이트

    return (
        <>
            <li
                className={`flex justify-between items-center p-2 rounded-md cursor-grab transition-colors duration-150 ${
                    isVeryLongWait
                        ? 'bg-red-100 hover:bg-red-150 border-l-4 border-red-500'
                        : isLongWait
                            ? 'bg-orange-50 hover:bg-orange-100 border-l-4 border-orange-400'
                            : 'hover:bg-blue-50'
                }`}
                draggable="true"
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onContextMenu={handleContextMenu}
            >
                <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-1 flex-wrap">
                        <span className="font-bold text-clinic-text-primary">
                            {patient.name}
                        </span>
                        {patient.chartNumber && (
                            <span className="text-xs text-gray-400">{formatChartNumber(patient.chartNumber)}</span>
                        )}
                        {genderAge && (
                            <span className="text-xs text-gray-500">{genderAge}</span>
                        )}
                    </div>
                    {(patient.details || patient.memo) && (
                        <div className="text-sm font-medium truncate" title={`${patient.details || ''}${patient.memo ? ` | ${patient.memo}` : ''}`}>
                            {patient.details && <span className="text-clinic-secondary">{patient.details}</span>}
                            {patient.memo && (
                                <>
                                    {patient.details && <span className="text-gray-400 mx-1">|</span>}
                                    <span className="text-red-500 font-semibold">{patient.memo}</span>
                                </>
                            )}
                        </div>
                    )}
                </div>
                <div className="flex flex-col items-end ml-2 flex-shrink-0">
                    <span className="text-xs text-gray-400">{patient.time}</span>
                    {waitingMinutes > 0 && (
                        <span className={`text-xs font-medium ${
                            isVeryLongWait ? 'text-red-600' : isLongWait ? 'text-orange-600' : 'text-gray-500'
                        }`}>
                            {waitingMinutes}분
                        </span>
                    )}
                </div>
            </li>
            {contextMenu && (
                <div
                    ref={menuRef}
                    className="fixed z-50 w-28 bg-white rounded-md shadow-lg border text-sm"
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                >
                    <ul className="py-1">
                        <li>
                            <button
                                onClick={handleEditConsultationInfoClick}
                                className="block w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100"
                            >
                                <i className="fa-solid fa-clipboard-list mr-2 text-blue-600"></i>
                                진료정보
                            </button>
                        </li>
                        {listType === 'treatment' && (
                            <li>
                                <button
                                    onClick={handleEditTreatmentInfoClick}
                                    className="block w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100"
                                >
                                    <i className="fa-solid fa-syringe mr-2 text-purple-600"></i>
                                    치료정보
                                </button>
                            </li>
                        )}
                        <li>
                            <button
                                onClick={handleMoveToPaymentClick}
                                className="block w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100"
                            >
                                <i className="fa-solid fa-credit-card mr-2 text-green-600"></i>
                                수납
                            </button>
                        </li>
                        <li>
                            <button
                                onClick={handleCancelRegistrationClick}
                                className="block w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100"
                            >
                                <i className="fa-solid fa-xmark mr-2 text-red-500"></i>
                                접수취소
                            </button>
                        </li>
                    </ul>
                </div>
            )}
        </>
    );
};

const WaitingList: React.FC<WaitingListProps> = ({ title, icon, list, listType, onPatientClick, onPatientDrop, onMoveToPayment, onCancelRegistration, onEditConsultationInfo, onEditTreatmentInfo }) => {
    const handleDragOver = (e: React.DragEvent<HTMLUListElement>) => {
        e.preventDefault();
        e.currentTarget.classList.add('bg-blue-50');
    };

    const handleDragLeave = (e: React.DragEvent<HTMLUListElement>) => {
        e.currentTarget.classList.remove('bg-blue-50');
    };

    const handleDrop = (e: React.DragEvent<HTMLUListElement>) => {
        e.preventDefault();
        e.currentTarget.classList.remove('bg-blue-50');

        const draggedPatientId = parseInt(e.dataTransfer.getData('patientId'), 10);
        const sourceListType = e.dataTransfer.getData('sourceListType') as 'consultation' | 'treatment' | 'consultation_room';

        console.log('📥 WaitingList 드롭:', { draggedPatientId, sourceListType, listType });

        // LI 요소(개별 환자 아이템) 위에 드롭된 경우는 WaitingListItem에서 처리
        // 그 외의 경우(빈 공간, 빈 목록 메시지 영역 등)는 여기서 처리
        const targetElement = e.target as HTMLElement;
        if (targetElement.tagName === 'LI' || targetElement.closest('li')) {
            console.log('📥 개별 아이템 위에 드롭 - WaitingListItem에서 처리');
            return;
        }

        console.log('📥 빈 공간에 드롭 - 목록 끝에 추가');
        onPatientDrop(draggedPatientId, sourceListType, listType, null);
    };

    return (
      <Quadrant icon={icon} title={`${title} (${list.length})`} className="flex-1 min-h-0">
        <ul
            className="divide-y divide-gray-200 overflow-y-auto p-2 h-full transition-colors duration-150"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
          {list.length > 0 ? (
            list.map((patient, index) => (
              <WaitingListItem
                key={`${listType}-${patient.id}-${index}`}
                patient={patient}
                onClick={onPatientClick}
                listType={listType}
                onPatientDrop={onPatientDrop}
                onMoveToPayment={onMoveToPayment}
                onCancelRegistration={onCancelRegistration}
                onEditConsultationInfo={onEditConsultationInfo}
                onEditTreatmentInfo={onEditTreatmentInfo}
              />
            ))
           ) : (
            <div className="flex flex-col items-center justify-center h-full text-center text-clinic-text-secondary">
              <i className="fa-regular fa-folder-open text-4xl mb-3"></i>
              <p className="font-semibold">대기 환자가 없습니다.</p>
            </div>
          )}
        </ul>
      </Quadrant>
    );
};

export default WaitingList;
