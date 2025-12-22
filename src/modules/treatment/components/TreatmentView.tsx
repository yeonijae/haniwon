import React, { useState, useEffect, useRef, useMemo, memo, useCallback } from 'react';
import { TreatmentRoom, RoomStatus, Patient, PatientStatus, SessionTreatment, DefaultTreatment, TreatmentItem } from '../types';
import TreatmentInfoModal from './TreatmentInfoModal';
import * as api from '../lib/api';
import * as actingApi from '@acting/api';

const getStatusClasses = (status: RoomStatus, gender?: 'male' | 'female'): { border: string, bg: string, text: string } => {
  switch (status) {
    case RoomStatus.IN_USE:
      // 성별에 따른 배경색: 남자 - 연한 하늘색, 여자 - 연한 분홍색
      const genderBg = gender === 'male' ? 'bg-sky-50' : gender === 'female' ? 'bg-[#fff8f9]' : 'bg-white';
      return { border: 'border-blue-500', bg: genderBg, text: 'text-blue-700' };
    case RoomStatus.AVAILABLE:
      return { border: 'border-gray-300', bg: 'bg-white', text: 'text-gray-700' };
    case RoomStatus.NEED_CLEAN:
        return { border: 'border-yellow-500', bg: 'bg-yellow-50', text: 'text-yellow-700' };
    case RoomStatus.CLEANING:
      return { border: 'border-indigo-500', bg: 'bg-indigo-50', text: 'text-indigo-700' };
    default:
      return { border: 'border-gray-500', bg: 'bg-gray-100', text: 'text-gray-700' };
  }
};

const colorMap: { [key: string]: string } = {
    'blue-500': '#3B82F6',
    'gray-300': '#D1D5DB',
    'yellow-500': '#EAB308',
    'indigo-500': '#6366F1',
    'gray-500': '#6B7280'
};

const getHexColor = (borderColorClass: string): string => {
    const colorName = borderColorClass.replace('border-', '');
    return colorMap[colorName as keyof typeof colorMap] || '#6B7280';
};

// 치료 타이머가 만료되었는지 확인 (running 상태이면서 시간이 다 된 경우)
const isTimerExpired = (treatment: SessionTreatment): boolean => {
    if (treatment.status !== 'running' || !treatment.startTime) return false;

    const totalSeconds = treatment.duration * 60;
    const now = Date.now();
    const start = new Date(treatment.startTime).getTime();
    const currentSessionElapsed = (now - start) / 1000;
    const elapsed = currentSessionElapsed + (treatment.elapsedSeconds || 0);

    return elapsed >= totalSeconds;
};

// 베드에 만료된 타이머가 있는지 확인하는 훅
const useHasExpiredTimer = (treatments: SessionTreatment[]) => {
    const [hasExpired, setHasExpired] = useState(false);

    useEffect(() => {
        const checkExpired = () => {
            const expired = treatments.some(tx => isTimerExpired(tx));
            setHasExpired(expired);
        };

        checkExpired();
        const interval = setInterval(checkExpired, 1000);
        return () => clearInterval(interval);
    }, [treatments]);

    return hasExpired;
};

const useTimer = (treatment: SessionTreatment) => {
    const [remainingSeconds, setRemainingSeconds] = useState(0);
    const [currentElapsedSeconds, setCurrentElapsedSeconds] = useState(0);
    const [progress, setProgress] = useState(0);

    const { status, duration, startTime, elapsedSeconds } = treatment;

    useEffect(() => {
        const calculateState = () => {
            const totalSeconds = duration * 60;
            if (totalSeconds <= 0) {
                setRemainingSeconds(0);
                setCurrentElapsedSeconds(0);
                setProgress(status === 'completed' ? 100 : 0);
                return;
            }

            let elapsed = 0;

            if (status === 'completed') {
                elapsed = totalSeconds;
            } else if (status === 'running' && startTime) {
                const now = Date.now();
                const start = new Date(startTime).getTime();
                const currentSessionElapsed = (now - start) / 1000;
                elapsed = currentSessionElapsed + (elapsedSeconds || 0);
            } else if (status === 'paused') {
                elapsed = elapsedSeconds || 0;
            }

            const clampedElapsed = Math.max(0, Math.min(totalSeconds, elapsed));
            const calculatedRemaining = totalSeconds - clampedElapsed;

            setRemainingSeconds(calculatedRemaining);
            setCurrentElapsedSeconds(elapsed);
            setProgress((clampedElapsed / totalSeconds) * 100);
        };

        calculateState();

        if (status === 'running') {
            const interval = setInterval(calculateState, 1000);
            return () => clearInterval(interval);
        }
    }, [status, duration, startTime, elapsedSeconds]);

    return { remainingSeconds, currentElapsedSeconds, progress };
};

interface TreatmentProgressItemProps {
    treatment: SessionTreatment;
    roomId: number;
    onTreatmentAction: (roomId: number, treatmentId: string, action: 'start' | 'pause' | 'complete' | 'reset') => void;
    onTimeChange: (roomId: number, treatmentId: string, minutes: number) => void;
    onDelete: (roomId: number, treatmentId: string) => void;
    isBeingDragged: boolean;
    draggedTreatmentRoomId: number | undefined;
    onDragStart: (roomId: number, treatmentId: string) => void;
    onDragEnd: () => void;
    onDrop: (roomId: number, treatmentId: string) => void;
}

const TreatmentProgressItem: React.FC<TreatmentProgressItemProps> = memo(({ treatment, roomId, onTreatmentAction, onTimeChange, onDelete, isBeingDragged, draggedTreatmentRoomId, onDragStart, onDragEnd, onDrop }) => {
    const { remainingSeconds, currentElapsedSeconds, progress } = useTimer(treatment);
    const [isDragOver, setIsDragOver] = useState(false);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    // 컨텍스트 메뉴 외부 클릭 감지
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setContextMenu(null);
            }
        };
        if (contextMenu) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [contextMenu]);

    const handleContextMenu = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({ x: e.clientX, y: e.clientY });
    }, []);

    // 침 치료는 경과 시간 표시, 그 외는 남은 시간 표시
    const isAcupuncture = treatment.name === '침' || treatment.name === '자침';
    const displaySeconds = isAcupuncture ? currentElapsedSeconds : remainingSeconds;
    const minutes = Math.floor(displaySeconds / 60);
    const seconds = Math.floor(displaySeconds % 60);

    const isFinished = treatment.status === 'completed';

    const handleTimerClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        // 침/자침 치료는 닥터패드에서 제어하므로 클릭 비활성화
        if (isAcupuncture) return;
        if (isFinished) return;
        if (treatment.status === 'running') {
            onTreatmentAction(roomId, treatment.id, 'pause');
        } else if (treatment.status === 'paused' || treatment.status === 'pending') {
            onTreatmentAction(roomId, treatment.id, 'start');
        }
    }, [isAcupuncture, isFinished, treatment.status, treatment.id, roomId, onTreatmentAction]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);

    const handleDragEnter = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (draggedTreatmentRoomId === roomId) {
            setIsDragOver(true);
        }
    }, [draggedTreatmentRoomId, roomId]);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.stopPropagation();
        setIsDragOver(false);
    }, []);

    const handleDropInternal = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
        onDrop(roomId, treatment.id);
    }, [onDrop, roomId, treatment.id]);

    const handleDragEnd = useCallback(() => {
        setIsDragOver(false);
        onDragEnd();
    }, [onDragEnd]);

    const handleDragStart = useCallback((e: React.DragEvent) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', treatment.id);
        onDragStart(roomId, treatment.id);
    }, [onDragStart, roomId, treatment.id]);


    return (
        <div
            className={`group relative w-full bg-gray-200 rounded-lg h-10 overflow-hidden flex items-center cursor-grab active:cursor-grabbing transition-all duration-150 ${isBeingDragged ? 'opacity-40 shadow-lg' : ''} ${isDragOver ? 'drag-over-indicator' : ''}`}
            draggable
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDrop={handleDropInternal}
            onContextMenu={handleContextMenu}
        >
            <div
                className="absolute top-0 left-0 h-full bg-blue-200 transition-all duration-300"
                style={{ width: `${progress}%` }}
            ></div>
            <div className="relative w-full flex items-center justify-between pl-3 pr-[2px]">
                <span className={`text-base font-semibold truncate ${
                    isFinished ? 'text-gray-400 line-through' :
                    treatment.name === '핫팩' ? 'text-red-600' :
                    treatment.name === '물치' ? 'text-blue-600' :
                    'text-clinic-text-primary'
                }`} title={treatment.memo}>
                    {treatment.name}
                </span>
                <div className="flex items-center gap-2 flex-grow min-w-0 justify-end">
                    {treatment.status === 'running' && !isFinished ? (
                        <>
                            {!isAcupuncture && (
                                <button onClick={(e) => { e.stopPropagation(); onTimeChange(roomId, treatment.id, -1); }} className="text-red-600 hover:text-red-700 w-7 h-7 flex items-center justify-center rounded-full bg-white shadow hover:shadow-md transition-all" aria-label="1분 감소">
                                    <i className="fa-solid fa-minus"></i>
                                </button>
                            )}
                            <span
                                className={`text-xl font-mono font-semibold tabular-nums w-16 text-center ${isAcupuncture ? 'cursor-default text-blue-600' : remainingSeconds <= 0 ? 'cursor-pointer text-red-600 animate-pulse' : 'cursor-pointer text-gray-700'}`}
                                onClick={isAcupuncture ? undefined : handleTimerClick}
                                aria-label={isAcupuncture ? '침 치료 경과 시간 (닥터패드에서 제어)' : '타이머 일시정지'}
                                title={isAcupuncture ? '침 치료는 닥터패드에서 제어됩니다' : (remainingSeconds <= 0 ? '시간이 종료되었습니다. 정지 후 완료 처리하세요.' : '')}
                            >
                                {`${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`}
                            </span>
                            {!isAcupuncture && (
                                <button onClick={(e) => { e.stopPropagation(); onTimeChange(roomId, treatment.id, 5); }} className="text-green-600 hover:text-green-700 w-7 h-7 flex items-center justify-center rounded-full bg-white shadow hover:shadow-md transition-all" aria-label="5분 증가">
                                    <i className="fa-solid fa-plus"></i>
                                </button>
                            )}
                        </>
                    ) : treatment.status === 'paused' && !isFinished ? (
                        <>
                            <button onClick={(e) => { e.stopPropagation(); onTreatmentAction(roomId, treatment.id, 'start'); }} className="text-green-600 hover:text-green-700 w-7 h-7 flex items-center justify-center rounded-full bg-white shadow hover:shadow-md transition-all" aria-label="타이머 재개">
                                <i className="fa-solid fa-play"></i>
                            </button>
                            <span className="text-xl font-mono font-semibold tabular-nums text-gray-700 w-16 text-center">
                                {`${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`}
                            </span>
                            <button onClick={(e) => { e.stopPropagation(); onTreatmentAction(roomId, treatment.id, 'complete'); }} className="text-blue-600 hover:text-blue-700 w-7 h-7 flex items-center justify-center rounded-full bg-white shadow hover:shadow-md transition-all" aria-label="치료 완료">
                                <i className="fa-solid fa-check-double"></i>
                            </button>
                        </>
                    ) : (
                        <>
                            <div className="flex-grow text-center" onClick={treatment.status === 'pending' ? handleTimerClick : undefined}>
                                {treatment.status === 'pending' ? (
                                    <div
                                        className="text-xs text-gray-500 hover:text-clinic-primary truncate cursor-pointer h-full flex items-center justify-center gap-1"
                                        title={treatment.memo ? `${treatment.duration}분 - ${treatment.memo}` : `${treatment.duration}분 예정`}
                                        aria-label={`${treatment.name} 치료 시작`}
                                    >
                                        <span className="flex-shrink-0">{treatment.duration}분</span>
                                        {treatment.memo && <span className="truncate">- {treatment.memo}</span>}
                                    </div>
                                ) : (
                                    <span className="text-xl font-mono font-semibold tabular-nums w-16 text-center flex items-center justify-center text-green-600" aria-label="완료됨">
                                        <i className="fa-solid fa-check"></i>
                                    </span>
                                )}
                            </div>
                            {(treatment.status === 'completed' || isFinished) && (
                                <div className="w-7 h-7 flex items-center justify-center flex-shrink-0">
                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center">
                                        <button onClick={(e) => { e.stopPropagation(); onTreatmentAction(roomId, treatment.id, 'reset'); }} className="text-gray-400 hover:text-gray-600 w-5 h-5 flex items-center justify-center" aria-label="타이머 초기화"><i className="fa-solid fa-rotate-left"></i></button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
            {/* 컨텍스트 메뉴 */}
            {contextMenu && (
                <div
                    ref={menuRef}
                    className="fixed bg-white rounded-lg shadow-lg border z-50 py-1 min-w-[120px]"
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                >
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete(roomId, treatment.id);
                            setContextMenu(null);
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                    >
                        <i className="fa-solid fa-trash-can"></i>
                        삭제
                    </button>
                </div>
            )}
        </div>
    );
}, (prevProps, nextProps) => {
    const prevTx = prevProps.treatment;
    const nextTx = nextProps.treatment;

    if (prevTx.id !== nextTx.id) return false;
    if (prevTx.status !== nextTx.status) return false;
    if (prevTx.duration !== nextTx.duration) return false;
    if (prevTx.startTime !== nextTx.startTime) return false;
    if (prevTx.elapsedSeconds !== nextTx.elapsedSeconds) return false;
    if (prevTx.name !== nextTx.name) return false;
    if (prevTx.memo !== nextTx.memo) return false;

    if (prevProps.roomId !== nextProps.roomId) return false;
    if (prevProps.isBeingDragged !== nextProps.isBeingDragged) return false;
    if (prevProps.draggedTreatmentRoomId !== nextProps.draggedTreatmentRoomId) return false;

    return true;
});

TreatmentProgressItem.displayName = 'TreatmentProgressItem';

interface TreatmentBedCardProps {
    room: TreatmentRoom;
    onTreatmentAction: (roomId: number, treatmentId: string, action: 'start' | 'pause' | 'complete' | 'reset') => void;
    onTimeChange: (roomId: number, treatmentId: string, minutes: number) => void;
    onDeleteTreatment: (roomId: number, treatmentId: string) => void;
    onFinishSession: (roomId: number) => void;
    onReturnToWaiting: (roomId: number) => void;
    onClean: (roomId: number) => void;
    onFinishCleaning: (roomId: number) => void;
    onDrop: (patientId: number, roomId: number) => void;
    onAddTreatment: (roomId: number, treatment: { name: string; duration: number }) => void;
    onOpenInfoModal: (room: TreatmentRoom) => void;
    treatmentItems: TreatmentItem[];
    draggedTreatment: { roomId: number; treatmentId: string } | null;
    onTreatmentDragStart: (roomId: number, treatmentId: string) => void;
    onTreatmentDragEnd: () => void;
    onTreatmentDrop: (targetRoomId: number, targetTreatmentId: string) => void;
}

const TreatmentBedCard: React.FC<TreatmentBedCardProps> = memo(({
    room, onTreatmentAction, onTimeChange, onDeleteTreatment,
    onFinishSession, onReturnToWaiting, onClean, onFinishCleaning, onDrop, onAddTreatment, onOpenInfoModal, treatmentItems,
    draggedTreatment, onTreatmentDragStart, onTreatmentDragEnd, onTreatmentDrop
}) => {
    const roomId = room.id;
    const [isDragOver, setIsDragOver] = useState(false);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
    const addMenuRef = useRef<HTMLDivElement>(null);
    const [showClothingSnackbar, setShowClothingSnackbar] = useState(false);

    // 타이머 만료 확인
    const hasExpiredTimer = useHasExpiredTimer(room.sessionTreatments);

    // 환자복 스낵바: 입실시간 기준 1분 이내면 표시
    useEffect(() => {
        if (!room.inTime || !room.patientClothing) {
            setShowClothingSnackbar(false);
            return;
        }

        const checkSnackbar = () => {
            const inTime = new Date(room.inTime!).getTime();
            const now = Date.now();
            const elapsedMs = now - inTime;
            const oneMinute = 60 * 1000;

            if (elapsedMs < oneMinute) {
                setShowClothingSnackbar(true);
                // 남은 시간 후 자동 숨김
                const remainingMs = oneMinute - elapsedMs;
                return setTimeout(() => {
                    setShowClothingSnackbar(false);
                }, remainingMs);
            } else {
                setShowClothingSnackbar(false);
            }
        };

        const timerId = checkSnackbar();
        return () => {
            if (timerId) clearTimeout(timerId);
        };
    }, [room.inTime, room.patientClothing]);

    const availableTreatmentsToAdd = useMemo(() => {
        if (room.status !== RoomStatus.IN_USE) return [];
        const existingTreatmentNames = new Set(room.sessionTreatments.map(tx => tx.name));
        return treatmentItems
            .filter(t => !existingTreatmentNames.has(t.name))
            .map(t => ({ name: t.name, duration: t.defaultDuration }));
    }, [room.status, room.sessionTreatments, treatmentItems]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
          if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
            setContextMenu(null);
          }
          if (addMenuRef.current && !addMenuRef.current.contains(event.target as Node)) {
            setIsAddMenuOpen(false);
          }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
          document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const { border, bg } = getStatusClasses(room.status, room.patientGender);

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        if (room.status === RoomStatus.AVAILABLE) {
            e.dataTransfer.dropEffect = 'move';
        } else {
            e.dataTransfer.dropEffect = 'none';
        }
    };

    const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        if (room.status === RoomStatus.AVAILABLE) {
            setIsDragOver(true);
        }
    };

    const handleDragLeave = () => {
        setIsDragOver(false);
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        if (room.status === RoomStatus.AVAILABLE) {
            const patientId = e.dataTransfer.getData('patientId');
            if (patientId) {
                onDrop(parseInt(patientId, 10), roomId);
            }
        }
        setIsDragOver(false);
    };

    const handleCardClick = () => {
        if (room.status === RoomStatus.NEED_CLEAN) onClean(roomId);
        if (room.status === RoomStatus.CLEANING) onFinishCleaning(roomId);
    };

    const handlePatientNameRightClick = (event: React.MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();
        onOpenInfoModal(room);
    };

    const handleContextMenu = (event: React.MouseEvent) => {
        if (room.status !== RoomStatus.IN_USE) return;
        event.preventDefault();
        setContextMenu({ x: event.clientX, y: event.clientY });
    };

    const getCursorClass = () => {
        if (room.status === RoomStatus.IN_USE) return 'cursor-context-menu';
        if (room.status === RoomStatus.NEED_CLEAN || room.status === RoomStatus.CLEANING) return 'cursor-pointer';
        return '';
    };

    // 타이머 만료 시 깜박임 효과
    const blinkClass = hasExpiredTimer ? 'animate-timer-expired' : '';

    return (
        <>
            <style>
                {`
                    @keyframes timerExpiredBlink {
                        0%, 100% { background-color: inherit; }
                        50% { background-color: rgb(254 215 170); }
                    }
                    .animate-timer-expired {
                        animation: timerExpiredBlink 1s ease-in-out infinite;
                    }
                    @keyframes fadeIn {
                        from { opacity: 0; transform: translateY(-5px); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                    .animate-fade-in {
                        animation: fadeIn 0.3s ease-out;
                    }
                `}
            </style>
            <div
                className={`rounded-lg border py-3 shadow-sm flex flex-col justify-between h-full transition-all duration-200 ${border} ${bg} ${getCursorClass()} ${blinkClass}`}
                onClick={handleCardClick}
                onContextMenu={handleContextMenu}
                onDragOver={handleDragOver}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
              {room.status === RoomStatus.IN_USE ? (
                <>
                  <div className="relative flex flex-wrap items-baseline gap-x-3 gap-y-1 px-3">
                    <h4
                        className="font-extrabold text-2xl text-clinic-text-primary cursor-pointer hover:text-clinic-secondary transition-colors"
                        onClick={(e) => { e.stopPropagation(); setIsAddMenuOpen(prev => !prev); }}
                        role="button"
                        aria-expanded={isAddMenuOpen}
                        aria-haspopup="true"
                        aria-label={`${room.name} 치료 추가`}
                    >
                        {room.name}
                    </h4>
                     {isAddMenuOpen && (
                        <div ref={addMenuRef} className="absolute top-full left-0 mt-2 w-52 bg-white rounded-lg shadow-lg border z-20 max-h-48 overflow-y-auto">
                            <ul className="py-1">
                                {availableTreatmentsToAdd.length > 0 ? (
                                    availableTreatmentsToAdd.map(t => (
                                        <li key={t.name}>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onAddTreatment(room.id, t);
                                                    setIsAddMenuOpen(false);
                                                }}
                                                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex justify-between"
                                            >
                                                <span>{t.name}</span>
                                                <span className="text-gray-500">{t.duration}분</span>
                                            </button>
                                        </li>
                                    ))
                                ) : (
                                    <li className="px-4 py-2 text-sm text-center text-gray-500">
                                        추가할 치료 항목이 없습니다.
                                    </li>
                                )}
                            </ul>
                        </div>
                    )}
                    <p
                      className="font-bold text-lg text-clinic-text-primary cursor-pointer hover:underline"
                      title={`${room.patientName}님 치료정보 수정 (우클릭)`}
                      onContextMenu={handlePatientNameRightClick}
                    >
                        {room.patientName}
                    </p>
                    <p className="text-sm text-clinic-text-secondary">
                        {room.doctorName?.replace(' 원장', '')}
                    </p>
                    {room.inTime && (
                        <p className="text-sm text-gray-500 flex items-center">
                            <i className="fa-regular fa-clock mr-1"></i>
                            {new Date(room.inTime).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })}
                        </p>
                    )}
                  </div>

                  {/* 환자복 스낵바 (배정 직후 5초간 표시) */}
                  {showClothingSnackbar && room.patientClothing && (
                    <div className="mx-2 mt-2 px-3 py-2 bg-amber-100 border border-amber-300 rounded-lg text-sm animate-fade-in">
                      <div className="flex items-center gap-2">
                        <i className="fa-solid fa-shirt text-amber-600"></i>
                        <span className="font-medium text-amber-800">{room.patientClothing}</span>
                      </div>
                    </div>
                  )}

                  <div className="flex-grow my-2 flex flex-col gap-1 px-2 overflow-y-auto">
                    {room.sessionTreatments.map(tx => (
                        <TreatmentProgressItem
                            key={tx.id}
                            treatment={tx}
                            roomId={roomId}
                            onTreatmentAction={onTreatmentAction}
                            onTimeChange={onTimeChange}
                            onDelete={onDeleteTreatment}
                            isBeingDragged={draggedTreatment?.treatmentId === tx.id}
                            draggedTreatmentRoomId={draggedTreatment?.roomId}
                            onDragStart={onTreatmentDragStart}
                            onDragEnd={onTreatmentDragEnd}
                            onDrop={onTreatmentDrop}
                        />
                    ))}
                  </div>

                  {/* 주의사항 (하단 고정) */}
                  {room.patientNotes && (
                    <div className="mx-2 -mb-2 px-2 py-1 text-xs text-red-600 font-medium flex items-center gap-1 bg-red-50 rounded border border-red-200">
                      <i className="fa-solid fa-triangle-exclamation"></i>
                      <span>{room.patientNotes}</span>
                    </div>
                  )}
                </>
              ) : room.status === RoomStatus.AVAILABLE ? (
                <div className={`flex flex-col items-center justify-center h-full text-center rounded-lg transition-colors ${isDragOver ? 'bg-blue-100' : ''}`}>
                    <h4 className="font-extrabold text-2xl text-gray-400">{room.name}</h4>
                    <i className={`fa-solid fa-plus text-2xl mt-2 mb-1 ${isDragOver ? 'text-clinic-primary' : 'text-gray-400'}`}></i>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <h4 className="font-extrabold text-3xl text-gray-500">{room.name}</h4>
                  <span className={`mt-2 text-base font-semibold px-3 py-1 rounded-full text-white`} style={{ backgroundColor: getHexColor(border) }}>
                    {room.status}
                  </span>
                </div>
              )}
            </div>

            {contextMenu && (
                <div
                    ref={menuRef}
                    className="fixed z-50 w-28 bg-white rounded-md shadow-lg border text-sm"
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                >
                    <ul className="py-1">
                        <li>
                            <button
                                onClick={() => { onReturnToWaiting(roomId); setContextMenu(null); }}
                                className="block w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100"
                            >
                                대기실로
                            </button>
                        </li>
                        <li>
                            <button
                                onClick={() => { onFinishSession(roomId); setContextMenu(null); }}
                                className="block w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100"
                            >
                                치료완료
                            </button>
                        </li>
                    </ul>
                </div>
            )}
        </>
    );
}, (prevProps, nextProps) => {
    if (prevProps.room !== nextProps.room) return false;
    if (prevProps.draggedTreatment !== nextProps.draggedTreatment) return false;
    if (prevProps.treatmentItems.length !== nextProps.treatmentItems.length) return false;
    return true;
});

TreatmentBedCard.displayName = 'TreatmentBedCard';

interface TreatmentViewProps {
    treatmentRooms: TreatmentRoom[];
    waitingList: Patient[];
    onNavigateBack: () => void;
    onNavigateToSettings: () => void;
    onUpdateRooms: (rooms: TreatmentRoom[]) => void;
    onSaveRoomToDB: (roomId: number, room: TreatmentRoom) => void;
    onUpdateWaitingList: (patients: Patient[]) => void;
    onRemoveFromWaitingList: (patientId: number) => void;
    onAddToWaitingList: (patient: Patient) => void;
    onMovePatientToPayment: (patientId: number) => void;
    allPatients: Patient[];
    onUpdatePatientDefaultTreatments: (patientId: number, treatments: DefaultTreatment[], settings?: { clothing?: string; notes?: string }) => void;
    treatmentItems: TreatmentItem[];
    onTreatmentStart?: (patientId: number, roomName: string) => void;
}

const TreatmentView: React.FC<TreatmentViewProps> = ({
    treatmentRooms, waitingList, onNavigateBack, onNavigateToSettings, onUpdateRooms, onSaveRoomToDB, onUpdateWaitingList, onRemoveFromWaitingList, onAddToWaitingList, onMovePatientToPayment, allPatients, onUpdatePatientDefaultTreatments, treatmentItems, onTreatmentStart
}) => {
    const [draggedTreatment, setDraggedTreatment] = useState<{ roomId: number; treatmentId: string } | null>(null);
    const [infoModalRoom, setInfoModalRoom] = useState<TreatmentRoom | null>(null);
    const [hoveredPatient, setHoveredPatient] = useState<Patient | null>(null);
    const [popoverPosition, setPopoverPosition] = useState<{ x: number, y: number }>({ x: 0, y: 0 });

    const treatmentRoomsRef = useRef(treatmentRooms);
    const waitingListRef = useRef(waitingList);
    const allPatientsRef = useRef(allPatients);

    treatmentRoomsRef.current = treatmentRooms;
    waitingListRef.current = waitingList;
    allPatientsRef.current = allPatients;

    const handlePatientMouseEnter = (e: React.MouseEvent<HTMLLIElement>, patient: Patient) => {
        // 기본치료 정보, 환자복, 주의사항 중 하나라도 있으면 팝오버 표시
        const hasInfo = (patient.defaultTreatments && patient.defaultTreatments.length > 0) ||
                        patient.treatmentClothing ||
                        patient.treatmentNotes;
        if (hasInfo) {
            const rect = e.currentTarget.getBoundingClientRect();
            setPopoverPosition({ x: rect.right + 5, y: rect.top });
            setHoveredPatient(patient);
        }
    };
    const handlePatientMouseLeave = () => {
        setHoveredPatient(null);
    };

    const handlePatientContextMenu = (e: React.MouseEvent, patient: Patient) => {
        e.preventDefault();
        // 대기열 환자를 위한 가상 TreatmentRoom 생성
        const virtualRoom: TreatmentRoom = {
            id: 0, // 가상 룸 표시 (실제 룸이 아님)
            name: '',
            status: RoomStatus.AVAILABLE,
            patientId: patient.id,
            patientName: patient.name,
            patientChartNumber: patient.chartNumber,
            patientGender: patient.gender,
            patientDob: patient.dob,
            doctorName: patient.doctor,
            sessionTreatments: (patient.defaultTreatments || []).map((dt, index) => ({
                id: `tx-${patient.id}-${Date.now()}-${index}`,
                name: dt.name,
                duration: dt.duration,
                status: 'pending' as const,
                elapsedSeconds: 0,
                memo: dt.memo,
            })),
            patientClothing: patient.treatmentClothing,
            patientNotes: patient.treatmentNotes,
        };
        setInfoModalRoom(virtualRoom);
    };

    // 베드 배정 시 액팅 항목 자동 추가 (자침, 추나, 초음파, 향기요법)
    // 약침은 자침과 함께 진행되므로 별도 액팅 불필요
    // 침 → 자침으로 변경: 원장이 침 놓는 시간(1~3분)과 환자 유침 시간(10~15분)을 분리하기 위함
    const ACTING_TREATMENT_NAMES = ['자침', '침', '추나', '초음파', '향기']; // '침'도 호환성 위해 유지
    const EXCLUDED_TREATMENTS = ['약침']; // 제외할 치료 항목

    const addActingForTreatments = useCallback(async (
        patientId: number,
        patientName: string,
        chartNo: string | undefined,
        treatments: { name: string; duration: number; memo?: string }[],
        doctorNameFromQueue?: string
    ) => {
        // 액팅 대상 치료 항목 필터링
        const actingTreatments = treatments.filter(t => {
            if (EXCLUDED_TREATMENTS.some(excluded => t.name.includes(excluded))) {
                return false;
            }
            return ACTING_TREATMENT_NAMES.some(actingName => t.name.includes(actingName));
        });

        if (actingTreatments.length === 0) return;

        // 담당 원장 정보 결정
        let doctorInfo: { doctorId: number; doctorName: string };

        if (doctorNameFromQueue) {
            try {
                const dbDoctorInfo = await api.findDoctorIdByNameOrAlias(doctorNameFromQueue);
                if (dbDoctorInfo) {
                    doctorInfo = dbDoctorInfo;
                } else {
                    const mssqlDoctorInfo = await actingApi.fetchPatientMainDoctor(patientId);
                    if (mssqlDoctorInfo) {
                        doctorInfo = mssqlDoctorInfo;
                    } else {
                        doctorInfo = { doctorId: 3, doctorName: '김대현' };
                    }
                }
            } catch {
                doctorInfo = { doctorId: 3, doctorName: '김대현' };
            }
        } else {
            try {
                const mssqlDoctorInfo = await actingApi.fetchPatientMainDoctor(patientId);
                if (mssqlDoctorInfo) {
                    doctorInfo = mssqlDoctorInfo;
                } else {
                    doctorInfo = { doctorId: 3, doctorName: '김대현' };
                }
            } catch {
                doctorInfo = { doctorId: 3, doctorName: '김대현' };
            }
        }

        // 각 액팅 항목을 대기열에 추가
        for (const treatment of actingTreatments) {
            try {
                await actingApi.addActing({
                    patientId,
                    patientName,
                    chartNo,
                    doctorId: doctorInfo.doctorId,
                    doctorName: doctorInfo.doctorName,
                    actingType: treatment.name,
                    memo: treatment.memo,
                    source: 'manual',
                });
            } catch (error) {
                console.error(`액팅 추가 실패 (${treatment.name}):`, error);
            }
        }
    }, []);

    const handlePatientDropOnBed = useCallback((patientId: number, roomId: number) => {
        const currentWaitingList = waitingListRef.current;
        const currentAllPatients = allPatientsRef.current;
        const currentTreatmentRooms = treatmentRoomsRef.current;

        let patient = currentWaitingList.find(p => p.id === patientId);

        if (!patient) {
            patient = currentAllPatients.find(p => p.id === patientId);
        }
        if (!patient) {
            console.error(`[handlePatientDropOnBed] 환자를 찾을 수 없음! patientId: ${patientId}`);
            return;
        }

        let updatedRoom: TreatmentRoom | null = null;
        const newRooms = currentTreatmentRooms.map(room => {
            if (room.id === roomId) {
                const treatmentsToApply =
                    (patient.defaultTreatments && patient.defaultTreatments.length > 0)
                    ? patient.defaultTreatments
                    : treatmentItems.slice(0, 3).map(ti => ({ name: ti.name, duration: ti.defaultDuration }));

                const sessionTreatments: SessionTreatment[] = treatmentsToApply.map((dt, index) => ({
                    id: `tx-${patientId}-${Date.now()}-${index}`,
                    name: dt.name,
                    duration: dt.duration,
                    status: 'pending' as const,
                    elapsedSeconds: 0,
                    memo: 'memo' in dt ? (dt.memo as string | undefined) : undefined,
                }));

                updatedRoom = {
                    ...room,
                    status: RoomStatus.IN_USE,
                    sessionId: `sess-${patientId}-${Date.now()}`,
                    patientId: patient.id,
                    patientName: patient.name,
                    patientChartNumber: patient.chartNumber,
                    patientGender: patient.gender,
                    patientDob: patient.dob,
                    doctorName: patient.doctor || '',
                    inTime: new Date().toISOString(),
                    sessionTreatments,
                    patientClothing: patient.treatmentClothing,
                    patientNotes: patient.treatmentNotes,
                };

                // 액팅 자동 추가 (비동기로 실행 - 담당 원장은 patient.doctor 우선 사용)
                addActingForTreatments(
                    patient.id,
                    patient.name,
                    patient.chartNumber,
                    treatmentsToApply,
                    patient.doctor
                );

                return updatedRoom;
            }
            return room;
        });

        onUpdateRooms(newRooms);
        onRemoveFromWaitingList(patientId);

        if (updatedRoom) {
            onSaveRoomToDB(roomId, updatedRoom);
            // 진료내역: 치료 시작 이벤트
            onTreatmentStart?.(patientId, updatedRoom.name);
        }
    }, [treatmentItems, onUpdateRooms, onRemoveFromWaitingList, onSaveRoomToDB, onTreatmentStart, addActingForTreatments]);

    const updateRoomRef = useRef<(roomId: number, updateFn: (room: TreatmentRoom) => TreatmentRoom, shouldSaveToDB?: boolean) => void>();

    updateRoomRef.current = (roomId: number, updateFn: (room: TreatmentRoom) => TreatmentRoom, shouldSaveToDB = false) => {
        let updatedRoom: TreatmentRoom | null = null;
        const newRooms = treatmentRooms.map(r => {
            if (r.id === roomId) {
                updatedRoom = updateFn(r);
                return updatedRoom;
            }
            return r;
        });
        onUpdateRooms(newRooms);

        if (shouldSaveToDB && updatedRoom) {
            onSaveRoomToDB(roomId, updatedRoom);
        }
    };

    const updateRoom = useCallback((roomId: number, updateFn: (room: TreatmentRoom) => TreatmentRoom, shouldSaveToDB = false) => {
        updateRoomRef.current?.(roomId, updateFn, shouldSaveToDB);
    }, []);

    const handleTreatmentAction = useCallback((roomId: number, treatmentId: string, action: 'start' | 'pause' | 'complete' | 'reset') => {
        const shouldSave = action === 'start' || action === 'pause' || action === 'complete';

        updateRoom(roomId, room => {
            const newTreatments = room.sessionTreatments.map(tx => {
                if (tx.id === treatmentId) {
                    switch(action) {
                        case 'start':
                            const newStartTime = new Date().toISOString();
                            const newElapsedSeconds = tx.status === 'paused' ? (tx.elapsedSeconds || 0) : 0;
                            return {
                                ...tx,
                                status: 'running' as const,
                                startTime: newStartTime,
                                elapsedSeconds: newElapsedSeconds
                            };
                        case 'pause':
                            if (!tx.startTime) return tx;
                            const currentElapsed = (Date.now() - new Date(tx.startTime).getTime()) / 1000;
                            const totalElapsed = Math.round((tx.elapsedSeconds || 0) + currentElapsed);
                            return {
                                ...tx,
                                status: 'paused' as const,
                                elapsedSeconds: totalElapsed,
                                startTime: null
                            };
                        case 'complete':
                            return { ...tx, status: 'completed' as const, startTime: null, elapsedSeconds: 0 };
                        case 'reset':
                            return { ...tx, status: 'pending' as const, startTime: null, elapsedSeconds: 0 };
                    }
                }
                return tx;
            });
            return { ...room, sessionTreatments: newTreatments };
        }, shouldSave);
    }, [updateRoom]);

    const handleTimeChange = useCallback((roomId: number, treatmentId: string, minutes: number) => {
        updateRoom(roomId, room => ({
            ...room,
            sessionTreatments: room.sessionTreatments.map(tx =>
                tx.id === treatmentId ? { ...tx, duration: Math.max(1, tx.duration + minutes) } : tx
            )
        }), true);
    }, [updateRoom]);

    const handleDeleteTreatment = useCallback((roomId: number, treatmentId: string) => {
        updateRoom(roomId, room => ({
            ...room,
            sessionTreatments: room.sessionTreatments.filter(tx => tx.id !== treatmentId),
        }));
    }, [updateRoom]);

    const handleFinishSession = useCallback((roomId: number) => {
        const room = treatmentRoomsRef.current.find(r => r.id === roomId);
        if (room && room.patientId) {
            onMovePatientToPayment(room.patientId);
            updateRoom(roomId, r => ({ ...r, status: RoomStatus.NEED_CLEAN }), true);
        }
    }, [onMovePatientToPayment, updateRoom]);

    const handleReturnToWaiting = useCallback(async (roomId: number) => {
        const room = treatmentRoomsRef.current.find(r => r.id === roomId);
        if (!room || !room.patientId) {
            console.error('❌ [handleReturnToWaiting] 룸 또는 환자 ID를 찾을 수 없음');
            return;
        }

        // allPatients에서 먼저 찾고, 없으면 room 정보로 Patient 객체 생성
        let patient = allPatientsRef.current.find(p => p.id === room.patientId);

        // 기존 환자 details 복원 (MSSQL에서 가져온 "담당의 예약/시간" 형식 유지)
        // 기존 details가 없을 때만 room 정보로 생성
        const fallbackDetails = (() => {
            const parts: string[] = [];
            if (room.doctorName) parts.push(room.doctorName);
            if (room.inTime) {
                const inTimeDate = new Date(room.inTime);
                const timeStr = inTimeDate.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
                parts.push(`예약/${timeStr}`);
            }
            return parts.length > 0 ? parts.join(' ') : '';
        })();

        if (!patient) {
            patient = {
                id: room.patientId,
                name: room.patientName || '알 수 없음',
                chartNumber: room.patientChartNumber,
                status: PatientStatus.WAITING_TREATMENT,
                time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }),
                details: fallbackDetails,
                gender: room.patientGender,
                dob: room.patientDob,
                doctor: room.doctorName,
            };
        } else {
            // 기존 환자 정보 유지 (원래 MSSQL에서 가져온 details 복원)
            patient = {
                ...patient,
                status: PatientStatus.WAITING_TREATMENT,
                time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }),
                details: patient.details || fallbackDetails,  // 기존 details 우선
                doctor: patient.doctor || room.doctorName,    // 기존 doctor 우선
            };
        }

        // 대기 목록에 추가
        onAddToWaitingList(patient);

        // DB에서 세션 치료 항목 삭제
        if (room.sessionId) {
            try {
                await api.clearTreatmentRoom(roomId);
            } catch (error) {
                console.error('❌ 치료실 정리 오류:', error);
            }
        }

        // 액팅큐에서 해당 환자의 대기 중/진행 중 액팅 취소
        try {
            await actingApi.cancelActingsByPatientId(room.patientId);
        } catch (error) {
            console.error('❌ 액팅 취소 오류:', error);
        }

        // 로컬 상태 업데이트
        updateRoom(roomId, r => ({
            ...r,
            status: RoomStatus.AVAILABLE,
            sessionId: undefined,
            patientId: undefined,
            patientName: undefined,
            patientChartNumber: undefined,
            patientGender: undefined,
            patientDob: undefined,
            doctorName: undefined,
            inTime: undefined,
            sessionTreatments: []
        }), false);
    }, [onAddToWaitingList, updateRoom]);

    const handleClean = useCallback((roomId: number) => {
        updateRoom(roomId, r => ({...r, status: RoomStatus.CLEANING}), true);
    }, [updateRoom]);

    const handleFinishCleaning = useCallback(async (roomId: number) => {
        const room = treatmentRoomsRef.current.find(r => r.id === roomId);

        if (room?.sessionId) {
            try {
                await api.clearTreatmentRoom(roomId);
            } catch (error) {
                console.error('치료실 정리 오류:', error);
            }
        }

        // DB에도 상태 저장 (shouldSaveToDB = true)
        updateRoom(roomId, r => ({
            ...r,
            status: RoomStatus.AVAILABLE,
            sessionId: undefined,
            patientId: undefined,
            patientName: undefined,
            patientChartNumber: undefined,
            patientGender: undefined,
            patientDob: undefined,
            doctorName: undefined,
            inTime: undefined,
            sessionTreatments: []
        }), true);
    }, [updateRoom]);

    const handlePatientDragStart = useCallback((e: React.DragEvent<HTMLLIElement>, patientId: number) => {
        e.dataTransfer.setData('patientId', patientId.toString());
        e.dataTransfer.setData('text/plain', patientId.toString());
        e.dataTransfer.effectAllowed = 'move';
    }, []);

    const handleTreatmentDragStart = useCallback((roomId: number, treatmentId: string) => {
        setDraggedTreatment({ roomId, treatmentId });
    }, []);

    const handleTreatmentDragEnd = useCallback(() => {
        setDraggedTreatment(null);
    }, []);

    const handleTreatmentDrop = useCallback((targetRoomId: number, targetTreatmentId: string) => {
        if (!draggedTreatment || draggedTreatment.roomId !== targetRoomId || draggedTreatment.treatmentId === targetTreatmentId) {
            return;
        }

        const { roomId: sourceRoomId, treatmentId: sourceTreatmentId } = draggedTreatment;

        updateRoom(sourceRoomId, room => {
            const treatments = [...room.sessionTreatments];
            const sourceIndex = treatments.findIndex(t => t.id === sourceTreatmentId);
            const targetIndex = treatments.findIndex(t => t.id === targetTreatmentId);

            if (sourceIndex > -1 && targetIndex > -1) {
                const [movedItem] = treatments.splice(sourceIndex, 1);
                treatments.splice(targetIndex, 0, movedItem);
            }
            return { ...room, sessionTreatments: treatments };
        }, true);
    }, [draggedTreatment, updateRoom]);

    const handleAddTreatment = useCallback((roomId: number, treatment: { name: string; duration: number; }) => {
        updateRoom(roomId, room => {
            const newTreatment: SessionTreatment = {
                id: `tx-${room.patientId}-${Date.now()}`,
                name: treatment.name,
                duration: treatment.duration,
                status: 'pending',
                elapsedSeconds: 0,
            };
            return {
                ...room,
                sessionTreatments: [...room.sessionTreatments, newTreatment]
            };
        }, true); // DB에 저장
    }, [updateRoom]);

    const handleOpenInfoModal = useCallback((room: TreatmentRoom) => {
        setInfoModalRoom(room);
    }, []);

    const handleSaveTreatmentInfo = (roomId: number, updatedTreatments: SessionTreatment[], settings: { clothing?: string; notes?: string }) => {
        // roomId가 0이면 가상 룸 (대기열 환자) - 룸 업데이트 건너뜀
        if (roomId === 0) {
            // 대기열 환자는 기본치료로 저장만 처리 (onSaveDefault에서 처리됨)
            setInfoModalRoom(null);
            return;
        }
        updateRoom(roomId, room => ({
            ...room,
            sessionTreatments: updatedTreatments,
            patientClothing: settings.clothing,
            patientNotes: settings.notes,
        }), true); // DB에 저장
        setInfoModalRoom(null);
    };

    const handleSaveDefaultTreatmentsFromModal = (patientId: number, treatments: { name: string; duration: number; memo?: string }[], settings: { clothing?: string; notes?: string }) => {
        onUpdatePatientDefaultTreatments(patientId, treatments as DefaultTreatment[], settings);
        // 대기열 환자의 경우 waitingList 상태도 업데이트
        if (infoModalRoom?.id === 0) {
            onUpdateWaitingList(waitingList.map(p =>
                p.id === patientId
                    ? { ...p, defaultTreatments: treatments as DefaultTreatment[], treatmentClothing: settings.clothing, treatmentNotes: settings.notes }
                    : p
            ));
        }
        setInfoModalRoom(null);
    };

    return (
        <main className="h-full p-2 grid grid-cols-1 lg:grid-cols-8 gap-2 bg-gray-50 overflow-hidden">
          <div className="lg:col-span-1 bg-white rounded-lg shadow-sm flex flex-col overflow-hidden border">
             <div className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
                <div className="flex items-center">
                    <i className="fa-solid fa-user-clock text-clinic-secondary text-xl mr-3"></i>
                    <h2 className="text-lg font-bold text-clinic-text-primary">
                        치료관리
                    </h2>
                </div>
                <button
                  onClick={onNavigateToSettings}
                  className="flex items-center justify-center w-10 h-10 rounded-lg bg-white border border-gray-300 text-gray-600 hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-clinic-secondary"
                  aria-label="설정"
                >
                  <i className="fa-solid fa-gear text-lg"></i>
                </button>
             </div>
             <div className="flex-grow overflow-y-auto p-2">
                {waitingList.length > 0 ? (
                    <ul className="divide-y divide-gray-200">
                    {waitingList.map(patient => (
                        <li key={patient.id}
                            className="flex justify-between items-center p-2 cursor-grab active:cursor-grabbing"
                            draggable="true"
                            onDragStart={(e) => handlePatientDragStart(e, patient.id)}
                            onMouseEnter={(e) => handlePatientMouseEnter(e, patient)}
                            onMouseLeave={handlePatientMouseLeave}
                            onContextMenu={(e) => handlePatientContextMenu(e, patient)}
                        >
                            <div>
                                <span className="font-bold text-clinic-text-primary text-sm">{patient.name}</span>
                                <span className="text-xs text-clinic-text-secondary ml-2">{patient.details}</span>
                            </div>
                            <span className="text-xs text-gray-500">{patient.time}</span>
                        </li>
                    ))}
                    </ul>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center text-clinic-text-secondary p-4">
                        <i className="fa-regular fa-folder-open text-5xl mb-4"></i>
                        <p className="font-semibold text-base">대기 환자가 없습니다.</p>
                    </div>
                )}
             </div>
          </div>

          <div className="lg:col-span-7 flex flex-col min-h-0 overflow-hidden">
            <div className="flex-grow p-1 h-full">
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 grid-rows-3 gap-1 h-full">
                {treatmentRooms.map(room => (
                  <React.Fragment key={room.id}>
                    <TreatmentBedCard room={room}
                      onTreatmentAction={handleTreatmentAction}
                      onTimeChange={handleTimeChange}
                      onDeleteTreatment={handleDeleteTreatment}
                      onFinishSession={handleFinishSession}
                      onReturnToWaiting={handleReturnToWaiting}
                      onClean={handleClean}
                      onFinishCleaning={handleFinishCleaning}
                      onDrop={handlePatientDropOnBed}
                      onAddTreatment={handleAddTreatment}
                      onOpenInfoModal={handleOpenInfoModal}
                      treatmentItems={treatmentItems}
                      draggedTreatment={draggedTreatment}
                      onTreatmentDragStart={handleTreatmentDragStart}
                      onTreatmentDragEnd={handleTreatmentDragEnd}
                      onTreatmentDrop={handleTreatmentDrop}
                    />
                    {room.name === '1-5' && <div />}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>
          {infoModalRoom && (
              <TreatmentInfoModal
                  isOpen={true}
                  onClose={() => setInfoModalRoom(null)}
                  room={infoModalRoom}
                  onSaveToday={handleSaveTreatmentInfo}
                  onSaveDefault={handleSaveDefaultTreatmentsFromModal}
                  treatmentItems={treatmentItems}
              />
          )}
           {hoveredPatient && (
                <div
                    className="fixed z-50 w-72 p-3 bg-white rounded-lg shadow-xl border border-gray-200"
                    style={{ top: popoverPosition.y, left: popoverPosition.x, pointerEvents: 'none' }}
                >
                    <h4 className="font-bold text-clinic-primary mb-2 border-b pb-1">
                        {hoveredPatient.name}님 치료 정보
                    </h4>
                    {/* 환자복 & 주의사항 */}
                    {(hoveredPatient.treatmentClothing || hoveredPatient.treatmentNotes) && (
                        <div className="mb-2 pb-2 border-b border-gray-100 text-sm space-y-1">
                            {hoveredPatient.treatmentClothing && (
                                <div className="flex gap-2">
                                    <span className="text-gray-500">환자복:</span>
                                    <span className="font-medium">{hoveredPatient.treatmentClothing}</span>
                                </div>
                            )}
                            {hoveredPatient.treatmentNotes && (
                                <div className="flex gap-2">
                                    <span className="text-gray-500">주의:</span>
                                    <span className="font-medium text-red-600">{hoveredPatient.treatmentNotes}</span>
                                </div>
                            )}
                        </div>
                    )}
                    {/* 치료 항목 */}
                    <ul className="space-y-1">
                        {hoveredPatient.defaultTreatments?.map((tx, index) => (
                            <li key={index} className="text-sm flex justify-between gap-2">
                                <span>
                                    <strong className="text-clinic-text-primary">{tx.name}</strong>
                                    {tx.memo && <span className="text-clinic-text-secondary ml-1">- {tx.memo}</span>}
                                </span>
                                <span className="text-gray-500">{tx.duration}분</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </main>
    );
};

export default TreatmentView;
