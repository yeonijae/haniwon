/**
 * 액팅 대기열 관리 컴포넌트 (치료관리시스템용)
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import type { DoctorQueueGroup, ActingQueueItem, AddActingRequest } from '../types';

// 원장 상태 표시 색상
const STATUS_COLORS: Record<string, string> = {
  in_progress: 'bg-green-500',
  waiting: 'bg-yellow-500',
  office: 'bg-gray-400',
  away: 'bg-red-500',
};

const STATUS_LABELS: Record<string, string> = {
  in_progress: '진료중',
  waiting: '대기중',
  office: '원장실',
  away: '부재',
};

// 액팅 타입별 색상
const ACTING_TYPE_COLORS: Record<string, string> = {
  '침': 'bg-teal-100 border-teal-500',
  '추나': 'bg-sky-100 border-sky-500',
  '부항': 'bg-amber-100 border-amber-500',
  '뜸': 'bg-orange-100 border-orange-500',
  '약침': 'bg-lime-100 border-lime-500',
  '초음파': 'bg-purple-100 border-purple-500',
  '상담': 'bg-indigo-100 border-indigo-500',
  '재초진': 'bg-pink-100 border-pink-500',
  '신규약상담': 'bg-rose-100 border-rose-500',
  '약재진': 'bg-yellow-100 border-yellow-500',
};

interface ActingCardProps {
  acting: ActingQueueItem;
  isDragging: boolean;
  onContextMenu: (e: React.MouseEvent) => void;
}

const ActingCard: React.FC<ActingCardProps> = ({ acting, isDragging, onContextMenu }) => {
  const [elapsedMinutes, setElapsedMinutes] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (acting.status !== 'acting' || !acting.startedAt) {
      setElapsedMinutes(undefined);
      return;
    }

    const calculateElapsed = () => {
      const startTime = new Date(acting.startedAt!);
      const now = new Date();
      const minutes = Math.floor((now.getTime() - startTime.getTime()) / (1000 * 60));
      setElapsedMinutes(minutes);
    };

    calculateElapsed();
    const intervalId = setInterval(calculateElapsed, 60000);

    return () => clearInterval(intervalId);
  }, [acting.startedAt, acting.status]);

  const colorClass = ACTING_TYPE_COLORS[acting.actingType] || 'bg-gray-100 border-gray-400';

  return (
    <div
      className={`relative p-3 rounded-lg shadow-sm flex flex-col justify-between items-center text-center transition-opacity min-h-[100px] border-l-4 ${colorClass} ${isDragging ? 'opacity-50' : 'opacity-100'}`}
      onContextMenu={onContextMenu}
    >
      {elapsedMinutes !== undefined && (
        <div className={`absolute top-1 right-2 text-xs font-bold ${elapsedMinutes > 20 ? 'text-red-600' : 'text-gray-600'}`}>
          {elapsedMinutes}분
        </div>
      )}
      {acting.status === 'acting' && (
        <div className="absolute top-1 left-2">
          <span className="inline-flex h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
        </div>
      )}
      <div className="pt-2">
        <p className="font-extrabold text-2xl text-gray-800 truncate">{acting.actingType}</p>
        <div className="mt-1">
          <p className="font-bold text-gray-800 truncate">{acting.patientName}</p>
          {acting.chartNo && (
            <p className="text-xs text-gray-500">{acting.chartNo}</p>
          )}
        </div>
      </div>
      {acting.memo && (
        <div className="mt-1 text-xs text-gray-500 truncate w-full" title={acting.memo}>
          {acting.memo}
        </div>
      )}
    </div>
  );
};

interface DoctorColumnProps {
  group: DoctorQueueGroup;
  onAddActing: (doctorId: number, doctorName: string, actingType: string) => void;
  onCancelActing: (actingId: number) => void;
  onStartActing: (actingId: number, doctorId: number, doctorName: string) => void;
  onCompleteActing: (actingId: number, doctorId: number, doctorName: string) => void;
  onMoveActing: (actingId: number, targetDoctorId: number, targetDoctorName: string) => void;
  allDoctors: { id: number; name: string }[];
  draggedItem: ActingQueueItem | null;
  onDragStart: (acting: ActingQueueItem) => void;
  onDragEnd: () => void;
  onDrop: (targetDoctorId: number, targetDoctorName: string, targetIndex: number) => void;
}

const DoctorColumn: React.FC<DoctorColumnProps> = ({
  group,
  onAddActing,
  onCancelActing,
  onStartActing,
  onCompleteActing,
  onMoveActing,
  allDoctors,
  draggedItem,
  onDragStart,
  onDragEnd,
  onDrop,
}) => {
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ acting: ActingQueueItem; x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const addMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
        setShowAddMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedItem) {
      onDrop(group.doctor.id, group.doctor.name, index);
    }
  };

  const handleActingContextMenu = (e: React.MouseEvent, acting: ActingQueueItem) => {
    e.preventDefault();
    setContextMenu({ acting, x: e.clientX, y: e.clientY });
  };

  const statusColor = STATUS_COLORS[group.status.status] || 'bg-gray-400';
  const statusLabel = STATUS_LABELS[group.status.status] || group.status.status;

  // 현재 진료중인 액팅과 대기중인 액팅 분리
  const inProgressActing = group.currentActing;
  const waitingQueue = group.queue;

  return (
    <div className="bg-white rounded-lg shadow-sm border flex flex-col min-w-[180px]">
      {/* 원장 헤더 */}
      <div className="p-3 border-b bg-gray-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${statusColor}`}></div>
          <h3 className="text-xl font-bold text-gray-800">{group.doctor.name}</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">{statusLabel}</span>
          <div className="relative">
            <button
              onClick={() => setShowAddMenu(!showAddMenu)}
              className="w-6 h-6 rounded-full bg-clinic-primary text-white flex items-center justify-center text-sm hover:bg-clinic-primary-dark"
            >
              +
            </button>
            {showAddMenu && (
              <div
                ref={addMenuRef}
                className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border z-20 w-32"
              >
                {['침', '추나', '상담', '재초진', '신규약상담'].map(type => (
                  <button
                    key={type}
                    onClick={() => {
                      onAddActing(group.doctor.id, group.doctor.name, type);
                      setShowAddMenu(false);
                    }}
                    className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-100"
                  >
                    {type}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 현재 진료중 */}
      {inProgressActing && (
        <div className="p-2 border-b bg-green-50">
          <div className="text-xs text-green-600 font-medium mb-1">진료중</div>
          <div
            onContextMenu={(e) => handleActingContextMenu(e, inProgressActing)}
            className="cursor-context-menu"
          >
            <ActingCard
              acting={inProgressActing}
              isDragging={false}
              onContextMenu={(e) => handleActingContextMenu(e, inProgressActing)}
            />
          </div>
        </div>
      )}

      {/* 대기열 */}
      <div
        className="flex-1 p-2 space-y-2 min-h-[200px]"
        onDragOver={handleDragOver}
        onDrop={(e) => handleDrop(e, waitingQueue.length)}
      >
        {waitingQueue.length > 0 ? (
          waitingQueue.map((acting, index) => (
            <div
              key={acting.id}
              draggable
              onDragStart={() => onDragStart(acting)}
              onDragEnd={onDragEnd}
              onDrop={(e) => {
                e.stopPropagation();
                handleDrop(e, index);
              }}
              className="cursor-grab active:cursor-grabbing"
            >
              <ActingCard
                acting={acting}
                isDragging={draggedItem?.id === acting.id}
                onContextMenu={(e) => handleActingContextMenu(e, acting)}
              />
            </div>
          ))
        ) : (
          <div className="h-full flex items-center justify-center text-gray-400 text-sm">
            대기 없음
          </div>
        )}
      </div>

      {/* 대기 수 */}
      <div className="p-2 border-t bg-gray-50 text-center">
        <span className="text-sm text-gray-600">대기 {group.totalWaiting}명</span>
      </div>

      {/* 컨텍스트 메뉴 */}
      {contextMenu && (
        <div
          ref={menuRef}
          className="fixed bg-white rounded-lg shadow-lg border z-50 py-1 w-36"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {contextMenu.acting.status === 'waiting' && (
            <button
              onClick={() => {
                onStartActing(contextMenu.acting.id, group.doctor.id, group.doctor.name);
                setContextMenu(null);
              }}
              className="block w-full text-left px-4 py-2 text-sm text-green-600 hover:bg-gray-100"
            >
              진료 시작
            </button>
          )}
          {contextMenu.acting.status === 'acting' && (
            <button
              onClick={() => {
                onCompleteActing(contextMenu.acting.id, group.doctor.id, group.doctor.name);
                setContextMenu(null);
              }}
              className="block w-full text-left px-4 py-2 text-sm text-blue-600 hover:bg-gray-100"
            >
              진료 완료
            </button>
          )}
          <div className="border-t my-1"></div>
          <div className="px-3 py-1 text-xs text-gray-500">다른 원장으로 이동</div>
          {allDoctors
            .filter(d => d.id !== group.doctor.id)
            .map(doctor => (
              <button
                key={doctor.id}
                onClick={() => {
                  onMoveActing(contextMenu.acting.id, doctor.id, doctor.name);
                  setContextMenu(null);
                }}
                className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
              >
                {doctor.name}
              </button>
            ))}
          <div className="border-t my-1"></div>
          <button
            onClick={() => {
              onCancelActing(contextMenu.acting.id);
              setContextMenu(null);
            }}
            className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
          >
            취소
          </button>
        </div>
      )}
    </div>
  );
};

interface ActingQueueManagerProps {
  queueGroups: DoctorQueueGroup[];
  loading: boolean;
  onAddActing: (request: AddActingRequest) => Promise<void>;
  onCancelActing: (actingId: number) => Promise<void>;
  onStartActing: (actingId: number, doctorId: number, doctorName: string) => Promise<void>;
  onCompleteActing: (actingId: number, doctorId: number, doctorName: string) => Promise<void>;
  onMoveActing: (actingId: number, targetDoctorId: number, targetDoctorName: string) => Promise<void>;
  onReorderActing: (actingId: number, newOrderNum: number) => Promise<void>;
}

const ActingQueueManager: React.FC<ActingQueueManagerProps> = ({
  queueGroups,
  loading,
  onAddActing,
  onCancelActing,
  onStartActing,
  onCompleteActing,
  onMoveActing,
  onReorderActing,
}) => {
  const [draggedItem, setDraggedItem] = useState<ActingQueueItem | null>(null);

  const allDoctors = useMemo(() =>
    queueGroups.map(g => ({ id: g.doctor.id, name: g.doctor.name })),
    [queueGroups]
  );

  const handleAddActing = async (doctorId: number, doctorName: string, actingType: string) => {
    // 임시 환자 정보로 추가 (실제로는 환자 검색 모달이 필요)
    const patientName = prompt('환자 이름을 입력하세요:');
    if (!patientName) return;

    await onAddActing({
      patientId: 0, // 임시
      patientName,
      doctorId,
      doctorName,
      actingType,
      source: 'manual',
    });
  };

  const handleDrop = async (targetDoctorId: number, targetDoctorName: string, targetIndex: number) => {
    if (!draggedItem) return;

    const sourceGroup = queueGroups.find(g => g.queue.some(q => q.id === draggedItem.id));

    if (sourceGroup && sourceGroup.doctor.id !== targetDoctorId) {
      // 다른 원장으로 이동
      await onMoveActing(draggedItem.id, targetDoctorId, targetDoctorName);
    } else {
      // 같은 원장 내 순서 변경
      await onReorderActing(draggedItem.id, targetIndex + 1);
    }

    setDraggedItem(null);
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-gray-500">로딩중...</div>
      </div>
    );
  }

  return (
    <div className="h-full p-4">
      <div className="flex gap-4 h-full overflow-x-auto pb-4">
        {queueGroups.map(group => (
          <DoctorColumn
            key={group.doctor.id}
            group={group}
            onAddActing={handleAddActing}
            onCancelActing={onCancelActing}
            onStartActing={onStartActing}
            onCompleteActing={onCompleteActing}
            onMoveActing={onMoveActing}
            allDoctors={allDoctors}
            draggedItem={draggedItem}
            onDragStart={setDraggedItem}
            onDragEnd={() => setDraggedItem(null)}
            onDrop={handleDrop}
          />
        ))}
      </div>
    </div>
  );
};

export default ActingQueueManager;
