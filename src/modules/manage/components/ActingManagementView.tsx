import React, { useState, useRef, useEffect } from 'react';
import { ActingQueueState, Acting, ActingType, TreatmentRoom, Patient } from '../types';
import { DOCTORS, ACTING_TYPE_DETAILS } from '../constants';

const DOCTOR_ACTING_TYPES: ActingType[] = ['침', '추나', '향기', '초음파', '습부', '초진', '약상담', '대기', '기타'];

// New Unified Acting Card Component
const ActingCard: React.FC<{ 
    acting: Acting; 
    isDragging: boolean;
    chartNumber?: string;
    remainingTreatments?: string[];
    bedNumber?: string;
    inTime?: string;
}> = ({ acting, isDragging, chartNumber, remainingTreatments = [], bedNumber, inTime }) => {
    const [elapsedMinutes, setElapsedMinutes] = useState<number | undefined>(undefined);

    useEffect(() => {
        if (!inTime) {
            setElapsedMinutes(undefined);
            return;
        }

        const calculateElapsed = () => {
            const inTimeDate = new Date(inTime);
            const now = new Date();
            const minutes = Math.floor((now.getTime() - inTimeDate.getTime()) / (1000 * 60));
            setElapsedMinutes(minutes);
        };

        calculateElapsed();

        const intervalId = setInterval(calculateElapsed, 60000); // Update every minute

        return () => clearInterval(intervalId);
    }, [inTime]);

    const details = ACTING_TYPE_DETAILS[acting.type];
    const remainingText = remainingTreatments.length > 0 ? remainingTreatments.join(' → ') : '';
    const displayText = acting.type === '침' && bedNumber ? bedNumber : acting.type;

    return (
        <div 
            className={`relative p-3 rounded-lg shadow-sm flex flex-col justify-between items-center text-center transition-opacity min-h-[110px] ${details.color} ${isDragging ? 'opacity-50' : 'opacity-100'}`}
        >
            {elapsedMinutes !== undefined && (
                <div className={`absolute top-1 right-2 text-xs font-bold ${elapsedMinutes > 50 ? 'text-red-600' : 'text-gray-600'}`}>
                    {elapsedMinutes}분
                </div>
            )}
            <div className="pt-2">
                {/* First Line: Treatment Type */}
                <p className="font-extrabold text-3xl text-clinic-text-primary truncate" title={acting.type}>{displayText}</p>
                
                {/* Second Line: Patient Name, Chart Number */}
                <div className="mt-2">
                    <p className="font-bold text-clinic-text-primary truncate" title={`${acting.patientName}${chartNumber ? ` (${chartNumber})` : ''}`}>
                        {acting.patientName}
                        {chartNumber && <span className="font-normal text-xs text-clinic-text-secondary"> ({chartNumber})</span>}
                    </p>
                </div>
            </div>
            
            {/* Third Line: Remaining Treatments */}
            <div className="mt-2 text-xs text-clinic-text-secondary truncate" title={remainingText}>
                <span>{remainingText || <>&nbsp;</>}</span>
            </div>
        </div>
    );
};


// Main View Component
interface ActingManagementViewProps {
    actingQueues: ActingQueueState;
    onQueueUpdate: (newQueues: ActingQueueState) => void;
    onNavigateBack: () => void;
    treatmentRooms: TreatmentRoom[];
    allPatients: Patient[];
    onCompleteActing: (doctorId: string, actingId: string) => void;
    onAddActing: (doctorId: string, type: '대기' | '초진' | '상담') => void;
    onDeleteActing: (doctorId: string, actingId: string) => void;
    onEditActing: (doctorId: string, acting: Acting) => void;
}

const ActingManagementView: React.FC<ActingManagementViewProps> = ({ 
    actingQueues, onQueueUpdate, onNavigateBack, treatmentRooms, allPatients, 
    onCompleteActing, onAddActing, onDeleteActing, onEditActing 
}) => {
    const [draggedItem, setDraggedItem] = useState<{ acting: Acting; sourceDoctor: string } | null>(null);
    const [openDropdown, setOpenDropdown] = useState<string | null>(null);
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setOpenDropdown(null);
            }
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                // Also check if the click was on a trigger, to let the toggle handle it
                if (!(event.target as HTMLElement).closest('[data-acting-id]')) {
                    setOpenMenuId(null);
                }
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleDragStart = (e: React.DragEvent<HTMLDivElement>, acting: Acting, sourceDoctor: string) => {
        setDraggedItem({ acting, sourceDoctor });
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>, targetDoctor: string, targetIndex: number) => {
        e.preventDefault();
        if (!draggedItem) return;

        const { acting: draggedActing, sourceDoctor } = draggedItem;

        // Only allow reordering within the same doctor's queue
        if (sourceDoctor !== targetDoctor) {
            return;
        }
        
        const newQueues = { ...actingQueues };
        const originalQueue = newQueues[sourceDoctor] || [];
        
        // Separate the lists
        const doctorActings = originalQueue.filter(a => DOCTOR_ACTING_TYPES.includes(a.type));
        const otherActings = originalQueue.filter(a => !DOCTOR_ACTING_TYPES.includes(a.type));

        // Reorder within the doctor-only list
        const originalDraggableIndex = doctorActings.findIndex(a => a.id === draggedActing.id);
        if (originalDraggableIndex > -1) {
            const [movedItem] = doctorActings.splice(originalDraggableIndex, 1);
            doctorActings.splice(targetIndex, 0, movedItem);
        }
        
        // Reconstruct and update
        newQueues[targetDoctor] = [...doctorActings, ...otherActings];
        onQueueUpdate(newQueues);
        setDraggedItem(null);
    };
    
    const handleDragEnd = () => {
        setDraggedItem(null);
    };
    
    const handleMenuToggle = (actingId: string) => {
        setOpenMenuId(prev => (prev === actingId ? null : actingId));
    };

    const handleDoctorContextMenu = (e: React.MouseEvent, doctor: string) => {
        e.preventDefault();
        setOpenDropdown(openDropdown === doctor ? null : doctor);
    };

    const handleActingCardContextMenu = (e: React.MouseEvent, actingId: string) => {
        e.preventDefault();
        handleMenuToggle(actingId);
    };

    return (
        <main className="h-screen p-4 lg:p-6 flex flex-col bg-gray-50">
            <div className="flex items-center justify-between mb-4 pb-2 border-b-2 border-gray-200 flex-shrink-0">
                <h2 className="text-3xl font-bold text-clinic-text-primary">
                    액팅 관리
                </h2>
                <button
                    onClick={onNavigateBack}
                    className="flex items-center justify-center w-12 h-12 rounded-full bg-white border border-gray-300 text-clinic-primary hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-clinic-secondary"
                    aria-label="메인 대시보드로 돌아가기"
                >
                    <i className="fa-solid fa-house text-2xl"></i>
                </button>
            </div>

            <div className="flex-grow flex flex-col gap-4 min-h-0 overflow-y-auto p-1">
                {DOCTORS.map(doctor => {
                    const queue = actingQueues[doctor] || [];
                    const doctorActings = queue.filter(acting => DOCTOR_ACTING_TYPES.includes(acting.type));

                    return (
                        <div key={doctor} className="bg-white rounded-lg shadow-sm flex items-stretch border flex-shrink-0">
                            {/* Doctor Info Panel */}
                            <div className="relative flex flex-col items-center justify-center p-4 border-r bg-gray-50 w-32 flex-shrink-0">
                                <div
                                    onContextMenu={(e) => handleDoctorContextMenu(e, doctor)}
                                    className="text-center cursor-context-menu p-2 rounded-md hover:bg-gray-200 transition-colors w-full h-full flex items-center justify-center"
                                    aria-haspopup="true"
                                    aria-expanded={openDropdown === doctor}
                                >
                                    <h3 className="text-6xl font-extrabold text-clinic-text-primary">{doctor.replace('원장', '')}</h3>
                                </div>
                                {openDropdown === doctor && (
                                    <div ref={dropdownRef} className="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-36 bg-white rounded-md shadow-lg z-20 border">
                                        <ul className="py-1">
                                            <li>
                                                <button onClick={() => { onAddActing(doctor, '대기'); setOpenDropdown(null); }} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                                                    {doctor.replace('원장', '')}+대기
                                                </button>
                                            </li>
                                            <li>
                                                <button onClick={() => { onAddActing(doctor, '초진'); setOpenDropdown(null); }} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                                                    {doctor.replace('원장', '')}+초진
                                                </button>
                                            </li>
                                            <li>
                                                <button onClick={() => { onAddActing(doctor, '상담'); setOpenDropdown(null); }} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                                                    {doctor.replace('원장', '')}+상담
                                                </button>
                                            </li>
                                        </ul>
                                    </div>
                                )}
                            </div>
                            
                            {/* Actings Panel */}
                            <div 
                                className="p-3 flex items-center gap-3 flex-grow flex-wrap min-h-[110px]"
                                onDragOver={handleDragOver}
                                onDrop={(e) => handleDrop(e, doctor, doctorActings.length)}
                            >
                                {doctorActings.map((acting, index) => {
                                    const chartNumber = allPatients.find(p => p.id === acting.patientId)?.chartNumber;
                                    const patientRoom = treatmentRooms.find(r => r.patientId === acting.patientId);
                                    
                                    const remainingTreatments = patientRoom?.sessionTreatments
                                        .filter(t => t.status !== 'completed')
                                        .map(t => t.name) || [];

                                    return (
                                        <div 
                                            key={acting.id}
                                            className="relative w-28 flex-shrink-0"
                                            data-acting-id={acting.id}
                                        >
                                            <div
                                                draggable
                                                onDragStart={(e) => handleDragStart(e, acting, doctor)}
                                                onDragEnd={handleDragEnd}
                                                onDrop={(e) => {
                                                    e.stopPropagation();
                                                    handleDrop(e, doctor, index);
                                                }}
                                                onContextMenu={(e) => handleActingCardContextMenu(e, acting.id)}
                                                className="cursor-context-menu active:cursor-grabbing hover:scale-105 hover:shadow-lg transition-transform duration-200"
                                                title={`${acting.patientName}님 ${acting.type} 액션 메뉴 (우클릭)`}
                                            >
                                                <ActingCard 
                                                    acting={acting} 
                                                    isDragging={draggedItem?.acting.id === acting.id}
                                                    chartNumber={chartNumber}
                                                    remainingTreatments={remainingTreatments}
                                                    bedNumber={patientRoom?.name}
                                                    inTime={patientRoom?.inTime}
                                                />
                                            </div>
                                            {openMenuId === acting.id && (
                                                <div ref={menuRef} className="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-28 bg-white rounded-md shadow-lg z-20 border">
                                                    <ul className="py-1">
                                                        <li>
                                                            <button onClick={() => { onDeleteActing(doctor, acting.id); setOpenMenuId(null); }} className="block w-full text-left px-4 py-2 text-sm text-red-700 hover:bg-gray-100">
                                                                액팅삭제
                                                            </button>
                                                        </li>
                                                        <li>
                                                            <button onClick={() => { onEditActing(doctor, acting); setOpenMenuId(null); }} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                                                                액팅편집
                                                            </button>
                                                        </li>
                                                        <li>
                                                            <button onClick={() => { onCompleteActing(doctor, acting.id); setOpenMenuId(null); }} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                                                                액팅완료
                                                            </button>
                                                        </li>
                                                    </ul>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                                {doctorActings.length === 0 && (
                                    <div className="flex items-center justify-center h-full w-full text-center text-clinic-text-secondary p-4">
                                        <p className="font-semibold text-sm">대기중인 액팅이 없습니다.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </main>
    );
};

export default ActingManagementView;