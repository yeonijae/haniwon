





import React, { useState, useEffect, useRef, useMemo, memo, useCallback } from 'react';
import { TreatmentRoom, RoomStatus, Patient, SessionTreatment, DefaultTreatment, TreatmentItem, TreatmentTypeCode } from '../types';
import TreatmentInfoModal from './TreatmentInfoModal';
import DefaultTreatmentEditModal from './DefaultTreatmentEditModal';
import * as api from '../lib/api';
import { loadSessionTreatmentsForRoom, logTreatmentStart, logTreatmentEnd, fetchActiveTreatmentTimeLog } from '../lib/treatmentApi';

const getStatusClasses = (status: RoomStatus): { border: string, bg: string, text: string } => {
  switch (status) {
    case RoomStatus.IN_USE:
      return { border: 'border-blue-500', bg: 'bg-blue-50', text: 'text-blue-700' };
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

const useTimer = (treatment: SessionTreatment) => {
    const [remainingSeconds, setRemainingSeconds] = useState(0);
    const [progress, setProgress] = useState(0);

    // 개별 속성을 추출하여 의존성 배열에 사용 (객체 참조 변경으로 인한 불필요한 리렌더링 방지)
    const { status, duration, startTime, elapsedSeconds } = treatment;

    useEffect(() => {
        const calculateState = () => {
            const totalSeconds = duration * 60;
            if (totalSeconds <= 0) {
                setRemainingSeconds(0);
                setProgress(status === 'completed' ? 100 : 0);
                return;
            }

            let elapsed = 0;
            let currentSessionElapsed = 0;

            if (status === 'completed') {
                // 완료된 치료는 100% 진행
                elapsed = totalSeconds;
            } else if (status === 'running' && startTime) {
                // 실행 중: startTime부터 현재까지의 경과 시간 + 누적된 시간
                const now = Date.now();
                const start = new Date(startTime).getTime();
                currentSessionElapsed = (now - start) / 1000;
                elapsed = currentSessionElapsed + (elapsedSeconds || 0);
            } else if (status === 'paused') {
                // 일시정지: 저장된 누적 경과 시간 사용
                elapsed = elapsedSeconds || 0;
            }
            // pending 상태는 elapsed = 0

            const clampedElapsed = Math.max(0, Math.min(totalSeconds, elapsed));
            const calculatedRemaining = totalSeconds - clampedElapsed;

            setRemainingSeconds(calculatedRemaining);
            setProgress((clampedElapsed / totalSeconds) * 100);
        };

        calculateState();

        if (status === 'running') {
            const interval = setInterval(calculateState, 1000);
            return () => clearInterval(interval);
        }
    }, [status, duration, startTime, elapsedSeconds]);

    return { remainingSeconds, progress };
};

interface TreatmentProgressItemProps {
    treatment: SessionTreatment;
    roomId: number;
    onTreatmentAction: (roomId: number, treatmentId: string, action: 'start' | 'pause' | 'complete' | 'reset') => void;
    onTimeChange: (roomId: number, treatmentId: string, minutes: number) => void;
    onDelete: (roomId: number, treatmentId: string) => void;
    // Drag and Drop props
    isBeingDragged: boolean;
    draggedTreatmentRoomId: number | undefined;
    onDragStart: (roomId: number, treatmentId: string) => void;
    onDragEnd: () => void;
    onDrop: (roomId: number, treatmentId: string) => void;
}

const TreatmentProgressItem: React.FC<TreatmentProgressItemProps> = memo(({ treatment, roomId, onTreatmentAction, onTimeChange, onDelete, isBeingDragged, draggedTreatmentRoomId, onDragStart, onDragEnd, onDrop }) => {
    console.log(`[TreatmentProgressItem] Room ${roomId} - ${treatment.name} (${treatment.status})`);
    const { remainingSeconds, progress } = useTimer(treatment);
    const [isDragOver, setIsDragOver] = useState(false);

    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = Math.floor(remainingSeconds % 60);

    // 완료 상태만 "완료"로 표시 (running 중 시간이 0이 되어도 수동 완료 필요)
    const isFinished = treatment.status === 'completed';

    const handleTimerClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        if (isFinished) return;
        if (treatment.status === 'running') {
            onTreatmentAction(roomId, treatment.id, 'pause');
        } else if (treatment.status === 'paused' || treatment.status === 'pending') {
            onTreatmentAction(roomId, treatment.id, 'start');
        }
    }, [isFinished, treatment.status, treatment.id, roomId, onTreatmentAction]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
    }, []);

    const handleDragEnter = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        if (draggedTreatmentRoomId === roomId) {
            setIsDragOver(true);
        }
    }, [draggedTreatmentRoomId, roomId]);

    const handleDragLeave = useCallback(() => {
        setIsDragOver(false);
    }, []);

    const handleDropInternal = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        onDrop(roomId, treatment.id);
    }, [onDrop, roomId, treatment.id]);

    const handleDragEnd = useCallback(() => {
        setIsDragOver(false);
        onDragEnd();
    }, [onDragEnd]);

    const handleDragStart = useCallback(() => {
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
        >
            <div
                className="absolute top-0 left-0 h-full bg-blue-200 transition-all duration-300"
                style={{ width: `${progress}%` }}
            ></div>
            <div className="relative w-full flex items-center justify-between pl-3 pr-2">
                <span className={`text-base font-semibold truncate ${isFinished ? 'text-gray-400 line-through' : 'text-clinic-text-primary'}`} title={treatment.memo}>
                    {treatment.name}
                </span>
                <div className="flex items-center gap-2 flex-grow min-w-0 justify-end">
                    {treatment.status === 'running' && !isFinished ? (
                        <>
                            <button onClick={(e) => { e.stopPropagation(); onTimeChange(roomId, treatment.id, -1); }} className="text-red-600 hover:text-red-700 w-7 h-7 flex items-center justify-center rounded-full bg-white shadow hover:shadow-md transition-all" aria-label="1분 감소">
                                <i className="fa-solid fa-minus"></i>
                            </button>
                            <span
                                className={`text-xl font-mono font-semibold tabular-nums w-16 text-center cursor-pointer ${remainingSeconds <= 0 ? 'text-red-600 animate-pulse' : 'text-gray-700'}`}
                                onClick={handleTimerClick}
                                aria-label="타이머 일시정지"
                                title={remainingSeconds <= 0 ? '시간이 종료되었습니다. 정지 후 완료 처리하세요.' : ''}
                            >
                                {remainingSeconds <= 0 ? '00:00' : `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`}
                            </span>
                            <button onClick={(e) => { e.stopPropagation(); onTimeChange(roomId, treatment.id, 5); }} className="text-green-600 hover:text-green-700 w-7 h-7 flex items-center justify-center rounded-full bg-white shadow hover:shadow-md transition-all" aria-label="5분 증가">
                                <i className="fa-solid fa-plus"></i>
                            </button>
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
                                        className="text-xs text-gray-500 hover:text-clinic-primary truncate cursor-pointer h-full flex items-center justify-center"
                                        title={treatment.memo || `${treatment.duration}분 예정`}
                                        aria-label={`${treatment.name} 치료 시작`}
                                    >
                                        {treatment.memo || `${treatment.duration}분 예정`}
                                    </div>
                                ) : (
                                    <span className="text-xl font-mono font-semibold tabular-nums w-16 text-center flex items-center justify-center text-green-600" aria-label="완료됨">
                                        <i className="fa-solid fa-check"></i>
                                    </span>
                                )}
                            </div>
                             <div className="w-7 h-7 flex items-center justify-center flex-shrink-0">
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center">
                                    {(treatment.status === 'completed' || isFinished) && <button onClick={(e) => { e.stopPropagation(); onTreatmentAction(roomId, treatment.id, 'reset'); }} className="text-gray-400 hover:text-gray-600 w-5 h-5 flex items-center justify-center" aria-label="타이머 초기화"><i className="fa-solid fa-rotate-left"></i></button>}
                                    {treatment.status === 'pending' && <button onClick={(e) => { e.stopPropagation(); onDelete(roomId, treatment.id); }} className="text-red-500 hover:text-red-700 w-5 h-5 flex items-center justify-center" aria-label="치료 삭제"><i className="fa-solid fa-trash-can"></i></button>}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}, (prevProps, nextProps) => {
    // treatment 객체의 실제 값 비교
    const prevTx = prevProps.treatment;
    const nextTx = nextProps.treatment;

    if (prevTx.id !== nextTx.id) return false;
    if (prevTx.status !== nextTx.status) return false;
    if (prevTx.duration !== nextTx.duration) return false;
    if (prevTx.startTime !== nextTx.startTime) return false;
    if (prevTx.elapsedSeconds !== nextTx.elapsedSeconds) return false;
    if (prevTx.name !== nextTx.name) return false;
    if (prevTx.memo !== nextTx.memo) return false;

    // 다른 props 비교
    if (prevProps.roomId !== nextProps.roomId) return false;
    if (prevProps.isBeingDragged !== nextProps.isBeingDragged) return false;
    if (prevProps.draggedTreatmentRoomId !== nextProps.draggedTreatmentRoomId) return false;

    // 함수 props는 비교하지 않음 (동일한 참조라고 가정)
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
    // Drag and Drop props
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
    console.log(`[TreatmentBedCard] Room ${room.id} (${room.name}) - ${room.patientName || 'empty'}`);
    const roomId = room.id;
    const [isDragOver, setIsDragOver] = useState(false);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
    const addMenuRef = useRef<HTMLDivElement>(null);

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

    const { border, bg } = getStatusClasses(room.status);

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        // drop 이벤트가 발생하려면 dragover에서 항상 preventDefault 필요
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

    return (
        <>
            <div 
                className={`rounded-lg border py-3 shadow-sm flex flex-col justify-between h-full transition-all duration-200 ${border} ${bg} ${getCursorClass()}`}
                onClick={handleCardClick}
                onContextMenu={handleContextMenu}
                onDragOver={handleDragOver}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
              {room.status === RoomStatus.IN_USE ? (
                <>
                  {/* Patient Info Header - Compact Layout */}
                  <div className="relative px-2 py-1">
                    {/* 첫째 줄: 환자이름(큰폰트) + 성별/나이 + 차트번호 */}
                    <div className="flex items-baseline gap-1.5 flex-wrap">
                      <span
                        className="font-bold text-xl text-clinic-text-primary cursor-pointer hover:underline leading-tight"
                        title={`${room.patientName}님 치료정보 수정 (우클릭)`}
                        onContextMenu={handlePatientNameRightClick}
                      >
                        {room.patientName}
                      </span>
                      {(room.patientGender || room.patientDob) && (
                        <span className="text-xs text-gray-500">
                          {room.patientGender === 'male' ? 'M' : room.patientGender === 'female' ? 'F' : ''}
                          {room.patientDob && `/${new Date().getFullYear() - new Date(room.patientDob).getFullYear()}`}
                        </span>
                      )}
                      {room.patientChartNumber && (
                        <span className="text-xs text-gray-400">#{room.patientChartNumber}</span>
                      )}
                    </div>
                    {/* 둘째 줄: 베드번호 + 담당의 + 입실시간 */}
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500">
                      <span
                        className="font-semibold text-clinic-primary cursor-pointer hover:text-clinic-secondary"
                        onClick={(e) => { e.stopPropagation(); setIsAddMenuOpen(prev => !prev); }}
                        role="button"
                        aria-expanded={isAddMenuOpen}
                        aria-haspopup="true"
                        aria-label={`${room.name} 치료 추가`}
                      >
                        {room.name}
                      </span>
                      {room.doctorName && (
                        <span>{room.doctorName.replace(' 원장', '')}</span>
                      )}
                      {room.inTime && (
                        <span className="flex items-center">
                          <i className="fa-regular fa-clock mr-0.5"></i>
                          {new Date(room.inTime).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })}
                        </span>
                      )}
                    </div>
                    {/* 치료 추가 메뉴 */}
                    {isAddMenuOpen && (
                      <div ref={addMenuRef} className="absolute top-full left-0 mt-1 w-48 bg-white rounded-lg shadow-lg border z-20 max-h-48 overflow-y-auto">
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
                                  className="w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 flex justify-between"
                                >
                                  <span>{t.name}</span>
                                  <span className="text-gray-500">{t.duration}분</span>
                                </button>
                              </li>
                            ))
                          ) : (
                            <li className="px-3 py-1.5 text-sm text-center text-gray-500">
                              추가할 치료 항목이 없습니다.
                            </li>
                          )}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Treatment List */}
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
                         {/* Treatment info is now accessed by right-clicking patient name */}
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
    // room 객체가 다르면 리렌더링 필요 (상태 변경됨)
    if (prevProps.room !== nextProps.room) return false;
    // draggedTreatment 상태 비교
    if (prevProps.draggedTreatment !== nextProps.draggedTreatment) return false;
    // treatmentItems 비교 (길이만)
    if (prevProps.treatmentItems.length !== nextProps.treatmentItems.length) return false;
    // 함수 props는 useCallback으로 메모이제이션되었으므로 비교 생략
    return true;
});

TreatmentBedCard.displayName = 'TreatmentBedCard';

interface TreatmentViewProps {
    treatmentRooms: TreatmentRoom[];
    waitingList: Patient[];
    onNavigateBack: () => void;
    onUpdateRooms: (rooms: TreatmentRoom[]) => void;
    onSaveRoomToDB: (roomId: number, room: TreatmentRoom) => void;
    onUpdateWaitingList: (patients: Patient[]) => void;
    onRemoveFromWaitingList: (patientId: number) => void;
    onAddToWaitingList: (patient: Patient) => void;
    onMovePatientToPayment: (patientId: number) => void;
    allPatients: Patient[];
    onUpdatePatientDefaultTreatments: (patientId: number, treatments: DefaultTreatment[]) => void;
    treatmentItems: TreatmentItem[];
}

const TreatmentView: React.FC<TreatmentViewProps> = ({
    treatmentRooms, waitingList, onNavigateBack, onUpdateRooms, onSaveRoomToDB, onUpdateWaitingList, onRemoveFromWaitingList, onAddToWaitingList, onMovePatientToPayment, allPatients, onUpdatePatientDefaultTreatments, treatmentItems
}) => {
    console.log(`[TreatmentView] Rooms: ${treatmentRooms.length}, Waiting: ${waitingList.length}`);
    const [draggedTreatment, setDraggedTreatment] = useState<{ roomId: number; treatmentId: string } | null>(null);
    const [infoModalRoom, setInfoModalRoom] = useState<TreatmentRoom | null>(null);
    const [hoveredPatient, setHoveredPatient] = useState<Patient | null>(null);
    const [popoverPosition, setPopoverPosition] = useState<{ x: number, y: number }>({ x: 0, y: 0 });
    const [editingPatient, setEditingPatient] = useState<Patient | null>(null);

    // stale closure 문제 방지를 위한 refs
    const treatmentRoomsRef = useRef(treatmentRooms);
    const waitingListRef = useRef(waitingList);
    const allPatientsRef = useRef(allPatients);

    // 매 렌더링마다 최신 값으로 업데이트
    treatmentRoomsRef.current = treatmentRooms;
    waitingListRef.current = waitingList;
    allPatientsRef.current = allPatients;

    const handlePatientMouseEnter = (e: React.MouseEvent<HTMLLIElement>, patient: Patient) => {
        if (patient.defaultTreatments && patient.defaultTreatments.length > 0) {
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
        setEditingPatient(patient);
    };
    
    const handlePatientDropOnBed = useCallback(async (patientId: number, roomId: number) => {
        console.log(`[handlePatientDropOnBed] 시작 - patientId: ${patientId}, roomId: ${roomId}`);
        const currentWaitingList = waitingListRef.current;
        const currentAllPatients = allPatientsRef.current;
        const currentTreatmentRooms = treatmentRoomsRef.current;
        console.log(`[handlePatientDropOnBed] waitingList: ${currentWaitingList.length}명, allPatients: ${currentAllPatients.length}명`);

        // 먼저 waitingList에서 찾고, 없으면 allPatients에서 찾기
        let patient = currentWaitingList.find(p => p.id === patientId);
        console.log(`[handlePatientDropOnBed] waitingList에서 환자 찾기: ${patient ? patient.name : '못찾음'}`);

        if (!patient) {
            patient = currentAllPatients.find(p => p.id === patientId);
            console.log(`[handlePatientDropOnBed] allPatients에서 환자 찾기: ${patient ? patient.name : '못찾음'}`);
        }
        if (!patient) {
            console.error(`[handlePatientDropOnBed] 환자를 찾을 수 없음! patientId: ${patientId}`);
            return;
        }
        console.log(`[handlePatientDropOnBed] 환자 찾음: ${patient.name} (id: ${patient.id})`);
        console.log(`[handlePatientDropOnBed] 환자 gender: ${patient.gender}, dob: ${patient.dob}`);

        // SQLite에서 환자의 치료 정보 로드
        let sessionTreatments: SessionTreatment[];
        let dailyRecordId: number | undefined;

        try {
            const result = await loadSessionTreatmentsForRoom(
                patientId,
                patient.name,
                patient.chartNumber
            );
            sessionTreatments = result.sessionTreatments;
            dailyRecordId = result.dailyRecord.id;
            console.log(`[handlePatientDropOnBed] SQLite에서 치료 정보 로드 완료: ${sessionTreatments.length}개 항목`);
        } catch (error) {
            console.error(`[handlePatientDropOnBed] SQLite 치료 정보 로드 실패, 폴백 사용:`, error);
            // 폴백: 기존 방식 사용
            const treatmentsToApply =
                (patient.defaultTreatments && patient.defaultTreatments.length > 0)
                ? patient.defaultTreatments
                : treatmentItems.slice(0, 3).map(ti => ({ name: ti.name, duration: ti.defaultDuration }));

            sessionTreatments = treatmentsToApply.map((dt, index) => ({
                id: `tx-${patientId}-${Date.now()}-${index}`,
                name: dt.name,
                duration: dt.duration,
                status: 'pending' as const,
                elapsedSeconds: 0,
                memo: 'memo' in dt ? (dt.memo as string | undefined) : undefined,
            }));
        }

        let updatedRoom: TreatmentRoom | null = null;
        const newRooms = currentTreatmentRooms.map(room => {
            if (room.id === roomId) {
                updatedRoom = {
                    ...room,
                    status: RoomStatus.IN_USE,
                    sessionId: `sess-${patientId}-${Date.now()}`,
                    patientId: patient.id,
                    patientName: patient.name,
                    patientChartNumber: patient.chartNumber,
                    patientGender: patient.gender,
                    patientDob: patient.dob,
                    doctorName: patient.doctor, // MSSQL 접수 시 담당의
                    inTime: new Date().toISOString(),
                    sessionTreatments,
                    dailyRecordId,
                };
                return updatedRoom;
            }
            return room;
        });

        console.log(`[handlePatientDropOnBed] 룸 업데이트 전 - treatmentRooms: ${currentTreatmentRooms.length}개`);
        onUpdateRooms(newRooms);

        // 대기 목록에서 제거 (DB 연동)
        console.log(`[handlePatientDropOnBed] 대기 목록에서 제거 - patientId: ${patientId}`);
        onRemoveFromWaitingList(patientId);

        // 환자 입실 - DB에 저장
        if (updatedRoom) {
            console.log(`[handlePatientDropOnBed] DB 저장 시작 - roomId: ${roomId}, patient: ${updatedRoom.patientName}`);
            onSaveRoomToDB(roomId, updatedRoom);
        }
    }, [treatmentItems, onUpdateRooms, onRemoveFromWaitingList, onSaveRoomToDB]);

    // updateRoom을 useCallback으로 감싸지 않고, 각 핸들러에서 직접 treatmentRooms를 사용하도록 변경
    // 대신, 핸들러에서 함수형 업데이트 패턴을 사용하여 최신 상태를 보장
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

    const handleTreatmentAction = useCallback(async (roomId: number, treatmentId: string, action: 'start' | 'pause' | 'complete' | 'reset') => {
        // 타이머 시작, 정지, 완료 시 DB에 저장 (reset은 로컬만)
        const shouldSave = action === 'start' || action === 'pause' || action === 'complete';

        // 현재 룸 정보 가져오기
        const currentRoom = treatmentRoomsRef.current.find(r => r.id === roomId);
        const currentTreatment = currentRoom?.sessionTreatments.find(tx => tx.id === treatmentId);

        // 타이머 시작 시 time_logs 기록
        let newTimeLogId: number | undefined;
        if (action === 'start' && currentRoom?.patientId && currentRoom?.dailyRecordId && currentTreatment?.treatmentType) {
            try {
                // 이미 진행 중인 로그가 있는지 확인
                const existingLog = await fetchActiveTreatmentTimeLog(
                    currentRoom.patientId,
                    currentTreatment.treatmentType
                );

                if (!existingLog) {
                    newTimeLogId = await logTreatmentStart(
                        currentRoom.dailyRecordId,
                        currentRoom.patientId,
                        currentTreatment.treatmentType,
                        currentTreatment.name,
                        roomId
                    );
                    console.log(`[타이머 시작] ${currentTreatment.name} - timeLogId: ${newTimeLogId}`);
                } else {
                    newTimeLogId = existingLog.id;
                    console.log(`[타이머 시작] ${currentTreatment.name} - 기존 로그 사용: ${newTimeLogId}`);
                }
            } catch (error) {
                console.error(`[타이머 시작] 시간 로그 기록 실패:`, error);
            }
        }

        // 타이머 완료 시 time_logs 종료 기록
        if (action === 'complete' && currentTreatment?.timeLogId) {
            try {
                await logTreatmentEnd(currentTreatment.timeLogId);
                console.log(`[타이머 완료] ${currentTreatment.name} - timeLogId: ${currentTreatment.timeLogId}`);
            } catch (error) {
                console.error(`[타이머 완료] 시간 로그 기록 실패:`, error);
            }
        }

        updateRoom(roomId, room => {
            const newTreatments = room.sessionTreatments.map(tx => {
                if (tx.id === treatmentId) {
                    switch(action) {
                        case 'start':
                            // 시작 또는 재개: startTime은 항상 현재 시간
                            // elapsedSeconds는 이전에 누적된 시간 (paused였다면)
                            const newStartTime = new Date().toISOString();
                            const newElapsedSeconds = tx.status === 'paused' ? (tx.elapsedSeconds || 0) : 0;
                            return {
                                ...tx,
                                status: 'running' as const,
                                startTime: newStartTime,
                                elapsedSeconds: newElapsedSeconds,
                                timeLogId: newTimeLogId ?? tx.timeLogId,
                            };
                        case 'pause':
                            if (!tx.startTime) return tx;
                            // 실행 → 일시정지: 경과 시간을 누적하여 저장
                            const currentElapsed = (Date.now() - new Date(tx.startTime).getTime()) / 1000;
                            const totalElapsed = Math.round((tx.elapsedSeconds || 0) + currentElapsed);
                            return {
                                ...tx,
                                status: 'paused' as const,
                                elapsedSeconds: totalElapsed,
                                startTime: null
                            };
                        case 'complete':
                            // 완료: 모두 초기화
                            return { ...tx, status: 'completed' as const, startTime: null, elapsedSeconds: 0, timeLogId: undefined };
                        case 'reset':
                            // 리셋: 대기 상태로, 모두 초기화
                            return { ...tx, status: 'pending' as const, startTime: null, elapsedSeconds: 0, timeLogId: undefined };
                    }
                }
                return tx;
            });
            return { ...room, sessionTreatments: newTreatments };
        }, shouldSave);
    }, [updateRoom]);

    const handleTimeChange = useCallback((roomId: number, treatmentId: string, minutes: number) => {
        // 타이머 시간 변경도 DB에 저장
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
            // 세션 완료 - DB에 저장
            updateRoom(roomId, r => ({ ...r, status: RoomStatus.NEED_CLEAN }), true);
        }
    }, [onMovePatientToPayment, updateRoom]);

    const handleReturnToWaiting = useCallback(async (roomId: number) => {
        const room = treatmentRoomsRef.current.find(r => r.id === roomId);
        const patient = allPatientsRef.current.find(p => p.id === room?.patientId);
        if (room && patient) {
            // 대기 목록에 추가 (DB 연동)
            onAddToWaitingList(patient);

            // DB에서 세션 치료 항목 먼저 삭제 (sessionId가 있는 경우)
            if (room.sessionId) {
                try {
                    await api.clearTreatmentRoom(roomId);
                } catch (error) {
                    console.error('❌ 치료실 정리 오류:', error);
                }
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
            }), false); // DB는 이미 clearTreatmentRoom으로 처리했으므로 false
        }
    }, [onAddToWaitingList, updateRoom]);

    const handleClean = useCallback((roomId: number) => {
        // 청소 시작 - DB에 저장
        updateRoom(roomId, r => ({...r, status: RoomStatus.CLEANING}), true);
    }, [updateRoom]);

    const handleFinishCleaning = useCallback(async (roomId: number) => {
        const room = treatmentRoomsRef.current.find(r => r.id === roomId);

        // DB에서 세션 치료 항목 먼저 삭제 (sessionId가 있는 경우)
        if (room?.sessionId) {
            try {
                await api.clearTreatmentRoom(roomId);
            } catch (error) {
                console.error('❌ 치료실 정리 오류:', error);
            }
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
        }), false); // DB는 이미 clearTreatmentRoom으로 처리했으므로 false
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
        });
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
        });
    }, [updateRoom]);

    const handleOpenInfoModal = useCallback((room: TreatmentRoom) => {
        setInfoModalRoom(room);
    }, []);

    const handleSaveTreatmentInfo = (roomId: number, updatedTreatments: SessionTreatment[]) => {
        updateRoom(roomId, room => ({
            ...room,
            sessionTreatments: updatedTreatments,
        }));
        setInfoModalRoom(null);
    };

    const handleSaveDefaultTreatments = (patientId: number, treatments: DefaultTreatment[]) => {
        onUpdatePatientDefaultTreatments(patientId, treatments);
        setEditingPatient(null);
    };

    return (
        <main className="h-screen p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-8 gap-6 bg-gray-50">
          {/* Sidebar: Waiting List */}
          <div className="lg:col-span-1 bg-white rounded-lg shadow-sm flex flex-col overflow-hidden border">
             <div className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
                <div className="flex items-center">
                    <i className="fa-solid fa-user-clock text-clinic-secondary text-xl mr-3"></i>
                    <h2 className="text-lg font-bold text-clinic-text-primary">
                        치료 대기
                    </h2>
                </div>
                <button
                  onClick={onNavigateBack}
                  className="flex items-center justify-center w-10 h-10 rounded-lg bg-white border border-gray-300 text-clinic-primary hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-clinic-secondary"
                  aria-label="메인 대시보드로 돌아가기"
                >
                  <i className="fa-solid fa-house text-xl"></i>
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

          {/* Main Content: Treatment Rooms */}
          <div className="lg:col-span-7 flex flex-col min-h-0">
            <div className="flex-grow overflow-y-auto p-1">
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-1 h-full auto-rows-fr">
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
                  onSave={handleSaveTreatmentInfo}
                  treatmentItems={treatmentItems}
              />
          )}
           {hoveredPatient && (
                <div 
                    className="fixed z-50 w-64 p-3 bg-white rounded-lg shadow-xl border border-gray-200"
                    style={{ top: popoverPosition.y, left: popoverPosition.x, pointerEvents: 'none' }}
                >
                    <h4 className="font-bold text-clinic-primary mb-2 border-b pb-1">
                        {hoveredPatient.name}님 예정 치료
                    </h4>
                    <ul className="space-y-1">
                        {hoveredPatient.defaultTreatments?.map((tx, index) => (
                            <li key={index} className="text-sm">
                                <strong className="text-clinic-text-primary">{tx.name}</strong>
                                {tx.memo && <span className="text-clinic-text-secondary ml-2">- {tx.memo}</span>}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            {editingPatient && (
                <DefaultTreatmentEditModal
                    isOpen={!!editingPatient}
                    onClose={() => setEditingPatient(null)}
                    patient={editingPatient}
                    onSave={handleSaveDefaultTreatments}
                />
            )}
        </main>
    );
};

export default TreatmentView;