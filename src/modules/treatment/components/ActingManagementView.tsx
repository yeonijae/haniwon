import React, { useState, useRef, useEffect, useCallback } from 'react';
import { TreatmentRoom, Patient } from '../types';
import { supabase } from '@shared/lib/supabase';
import * as actingApi from '@acting/api';
import type { ActingQueueItem } from '@acting/types';

// 원장 정보 (DB doctor_id와 매칭)
const DOCTORS = [
  { id: 1, name: '김대현', alias: '김' },
  { id: 2, name: '강희종', alias: '강' },
  { id: 3, name: '임세열', alias: '임' },
  { id: 4, name: '전인태', alias: '전' },
];

// 액팅 타입 템플릿 (수동 추가 시 선택 가능)
const ACTING_TYPES = ['침', '추나', '초음파', '향기', '약초진', '약재진', '대기', '상비약'];

// 액팅 타입별 스타일
const ACTING_TYPE_STYLES: Record<string, { color: string }> = {
  '침': { color: 'bg-teal-100 border-teal-500' },
  '추나': { color: 'bg-sky-100 border-sky-500' },
  '초음파': { color: 'bg-purple-100 border-purple-500' },
  '향기': { color: 'bg-violet-100 border-violet-500' },
  '약초진': { color: 'bg-orange-100 border-orange-500' },
  '약재진': { color: 'bg-yellow-100 border-yellow-500' },
  '대기': { color: 'bg-gray-100 border-gray-400' },
  '상비약': { color: 'bg-green-100 border-green-500' },
};

const getActingStyle = (actingType: string) => {
  return ACTING_TYPE_STYLES[actingType] || { color: 'bg-gray-100 border-gray-400' };
};

// 액팅 추가/수정 모달
interface ActingModalProps {
  isOpen: boolean;
  mode: 'add' | 'edit';
  doctorId: number;
  doctorAlias: string;
  initialData?: {
    id?: number;
    actingType: string;
    patientName: string;
    memo: string;
  };
  onClose: () => void;
  onSave: (data: { actingType: string; patientName: string; memo: string }) => void;
}

const ActingModal: React.FC<ActingModalProps> = ({
  isOpen,
  mode,
  doctorId,
  doctorAlias,
  initialData,
  onClose,
  onSave,
}) => {
  const [actingType, setActingType] = useState(initialData?.actingType || '');
  const [customType, setCustomType] = useState('');
  const [patientName, setPatientName] = useState(initialData?.patientName || '');
  const [memo, setMemo] = useState(initialData?.memo || '');

  useEffect(() => {
    if (isOpen) {
      const initialType = initialData?.actingType || '';
      // 템플릿에 있는 타입인지 확인
      if (ACTING_TYPES.includes(initialType)) {
        setActingType(initialType);
        setCustomType('');
      } else {
        setActingType('');
        setCustomType(initialType);
      }
      setPatientName(initialData?.patientName || '');
      setMemo(initialData?.memo || '');
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalType = actingType || customType.trim();
    if (!finalType) {
      alert('액팅 종류를 선택하거나 입력해주세요.');
      return;
    }
    onSave({ actingType: finalType, patientName: patientName.trim(), memo: memo.trim() });
  };

  const handleTypeSelect = (type: string) => {
    setActingType(type);
    setCustomType('');
  };

  const handleCustomTypeChange = (value: string) => {
    setCustomType(value);
    setActingType('');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
        <div className="px-6 py-4 border-b bg-gray-50 rounded-t-xl">
          <h3 className="text-xl font-bold text-gray-800">
            {mode === 'add' ? `${doctorAlias} 원장 액팅 추가` : '액팅 수정'}
          </h3>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* 액팅 타입 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">액팅 종류 <span className="text-red-500">*</span></label>
            <div className="flex flex-wrap gap-2 mb-3">
              {ACTING_TYPES.map(type => {
                const style = getActingStyle(type);
                const isSelected = actingType === type;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => handleTypeSelect(type)}
                    className={`px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                      isSelected
                        ? `${style.color} ring-2 ring-offset-1 ring-blue-500`
                        : 'bg-white border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {type}
                  </button>
                );
              })}
            </div>
            <input
              type="text"
              value={customType}
              onChange={(e) => handleCustomTypeChange(e.target.value)}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                customType ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
              }`}
              placeholder="또는 직접 입력..."
            />
          </div>

          {/* 환자 이름 (선택) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">환자 이름 <span className="text-gray-400 text-xs">(선택)</span></label>
            <input
              type="text"
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
              placeholder="환자 이름"
            />
          </div>

          {/* 메모 (선택) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">메모 <span className="text-gray-400 text-xs">(선택)</span></label>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={2}
              placeholder="메모"
            />
          </div>

          {/* 버튼 */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
            >
              취소
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              {mode === 'add' ? '추가' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// 액팅 카드 컴포넌트
const ActingCard: React.FC<{
  acting: ActingQueueItem;
  isDragging: boolean;
  bedNumber?: string;
  inTime?: string;
  remainingTreatments?: string[];
}> = ({ acting, isDragging, bedNumber, inTime, remainingTreatments = [] }) => {
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
    const intervalId = setInterval(calculateElapsed, 60000);

    return () => clearInterval(intervalId);
  }, [inTime]);

  const style = getActingStyle(acting.actingType);
  const remainingText = remainingTreatments.length > 0 ? remainingTreatments.join(' → ') : '';
  const displayText = acting.actingType === '침' && bedNumber ? bedNumber : acting.actingType;
  const memoText = acting.memo || '';

  return (
    <div
      className={`relative p-3 rounded-lg shadow-sm flex flex-col justify-between items-center text-center transition-opacity min-h-[110px] border-2 ${style.color} ${isDragging ? 'opacity-50' : 'opacity-100'}`}
    >
      {elapsedMinutes !== undefined && (
        <div className={`absolute top-1 right-2 text-xs font-bold ${elapsedMinutes > 50 ? 'text-red-600' : 'text-gray-600'}`}>
          {elapsedMinutes}분
        </div>
      )}
      <div className="pt-2">
        <p className="font-extrabold text-3xl text-clinic-text-primary truncate" title={acting.actingType}>
          {displayText}
        </p>

        <div className="mt-2">
          <p className="font-bold text-clinic-text-primary truncate" title={`${acting.patientName}${acting.chartNo ? ` (${acting.chartNo})` : ''}`}>
            {acting.patientName}
            {acting.chartNo && <span className="font-normal text-xs text-clinic-text-secondary"> ({acting.chartNo})</span>}
          </p>
        </div>
      </div>

      <div className="mt-2 text-xs text-clinic-text-secondary truncate" title={memoText || remainingText}>
        <span>{memoText || remainingText || <>&nbsp;</>}</span>
      </div>
    </div>
  );
};

interface ActingManagementViewProps {
  treatmentRooms: TreatmentRoom[];
  allPatients: Patient[];
}

const ActingManagementView: React.FC<ActingManagementViewProps> = ({
  treatmentRooms,
  allPatients,
}) => {
  // DB에서 가져온 액팅 대기열 (원장별로 그룹화)
  const [actingsByDoctor, setActingsByDoctor] = useState<Record<number, ActingQueueItem[]>>({});
  const [loading, setLoading] = useState(true);
  const [draggedItem, setDraggedItem] = useState<{ acting: ActingQueueItem; sourceDoctorId: number; sourceIndex: number } | null>(null);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; doctorId: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  // 모달 상태
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    mode: 'add' | 'edit';
    doctorId: number;
    doctorAlias: string;
    editingActing?: ActingQueueItem;
  }>({
    isOpen: false,
    mode: 'add',
    doctorId: 0,
    doctorAlias: '',
  });

  // 데이터 로드
  const loadActings = useCallback(async () => {
    try {
      const allQueue = await actingApi.fetchTodayQueue();

      // 원장별로 그룹화
      const grouped: Record<number, ActingQueueItem[]> = {};
      DOCTORS.forEach(d => {
        grouped[d.id] = [];
      });

      allQueue.forEach(item => {
        if (grouped[item.doctorId]) {
          grouped[item.doctorId].push(item);
        }
      });

      // 각 그룹 내에서 orderNum으로 정렬
      Object.keys(grouped).forEach(doctorId => {
        grouped[Number(doctorId)].sort((a, b) => a.orderNum - b.orderNum);
      });

      setActingsByDoctor(grouped);
    } catch (error) {
      console.error('액팅 대기열 로드 오류:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadActings();
  }, [loadActings]);

  // 실시간 구독
  useEffect(() => {
    const subscription = supabase
      .channel('acting-management-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'acting_queue' }, () => {
        loadActings();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [loadActings]);

  // 클릭 외부 감지
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        if (!(event.target as HTMLElement).closest('[data-acting-id]')) {
          setOpenMenuId(null);
        }
      }
      if (contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
        setContextMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // 드롭 대상 인덱스 상태
  const [dropTarget, setDropTarget] = useState<{ doctorId: number; index: number } | null>(null);

  // 드래그 핸들러
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, acting: ActingQueueItem, sourceDoctorId: number, sourceIndex: number) => {
    setDraggedItem({ acting, sourceDoctorId, sourceIndex });
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, doctorId: number, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTarget({ doctorId, index });
  };

  const handleDragLeave = () => {
    setDropTarget(null);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>, targetDoctorId: number, targetIndex: number) => {
    e.preventDefault();
    setDropTarget(null);
    if (!draggedItem) return;

    const { acting, sourceDoctorId, sourceIndex } = draggedItem;

    // 같은 위치에 드롭하면 무시
    if (sourceDoctorId === targetDoctorId && sourceIndex === targetIndex) {
      setDraggedItem(null);
      return;
    }

    try {
      if (sourceDoctorId === targetDoctorId) {
        // 같은 원장 내에서 순서 변경
        await actingApi.reorderActing(acting.id, targetDoctorId, sourceIndex, targetIndex);
      } else {
        // 다른 원장으로 이동
        const targetDoctor = DOCTORS.find(d => d.id === targetDoctorId);
        if (targetDoctor) {
          await actingApi.moveActingToDoctor(acting.id, targetDoctorId, targetDoctor.name);
        }
      }

      await loadActings();
    } catch (error) {
      console.error('액팅 이동 오류:', error);
    }

    setDraggedItem(null);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDropTarget(null);
  };

  // 패널 빈 곳 우클릭 - 컨텍스트 메뉴 표시
  const handlePanelContextMenu = (e: React.MouseEvent, doctorId: number) => {
    // 액팅 카드 위에서 우클릭한 경우 무시
    if ((e.target as HTMLElement).closest('[data-acting-id]')) {
      return;
    }
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, doctorId });
    setOpenMenuId(null);
  };

  // 액팅 추가 모달 열기
  const openAddModal = (doctorId: number) => {
    const doctor = DOCTORS.find(d => d.id === doctorId);
    if (!doctor) return;

    setModalState({
      isOpen: true,
      mode: 'add',
      doctorId,
      doctorAlias: doctor.alias,
    });
    setContextMenu(null);
  };

  // 액팅 수정 모달 열기
  const openEditModal = (acting: ActingQueueItem) => {
    const doctor = DOCTORS.find(d => d.id === acting.doctorId);
    if (!doctor) return;

    setModalState({
      isOpen: true,
      mode: 'edit',
      doctorId: acting.doctorId,
      doctorAlias: doctor.alias,
      editingActing: acting,
    });
    setOpenMenuId(null);
  };

  // 모달 닫기
  const closeModal = () => {
    setModalState(prev => ({ ...prev, isOpen: false, editingActing: undefined }));
  };

  // 액팅 저장 (추가 또는 수정)
  const handleSaveActing = async (data: { actingType: string; patientName: string; memo: string }) => {
    try {
      if (modalState.mode === 'add') {
        const doctor = DOCTORS.find(d => d.id === modalState.doctorId);
        if (!doctor) return;

        await actingApi.addActing({
          patientId: 0,
          patientName: data.patientName,
          doctorId: modalState.doctorId,
          doctorName: doctor.name,
          actingType: data.actingType,
          memo: data.memo,
          source: 'manual',
        });
      } else if (modalState.mode === 'edit' && modalState.editingActing) {
        await actingApi.updateActing(modalState.editingActing.id, {
          actingType: data.actingType,
          patientName: data.patientName,
          memo: data.memo,
        });
      }

      await loadActings();
      closeModal();
    } catch (error) {
      console.error('액팅 저장 오류:', error);
      alert('액팅 저장 중 오류가 발생했습니다.');
    }
  };

  // 액팅 완료
  const handleCompleteActing = async (actingId: number, doctorId: number) => {
    try {
      const doctor = DOCTORS.find(d => d.id === doctorId);
      if (doctor) {
        await actingApi.completeActing(actingId, doctorId, doctor.name);
        await loadActings();
      }
    } catch (error) {
      console.error('액팅 완료 오류:', error);
    }
    setOpenMenuId(null);
  };

  // 액팅 삭제
  const handleDeleteActing = async (actingId: number) => {
    try {
      await actingApi.cancelActing(actingId);
      await loadActings();
    } catch (error) {
      console.error('액팅 삭제 오류:', error);
    }
    setOpenMenuId(null);
  };

  const handleMenuToggle = (actingId: number) => {
    setOpenMenuId(prev => (prev === actingId ? null : actingId));
    setContextMenu(null);
  };

  const handleActingCardContextMenu = (e: React.MouseEvent, actingId: number) => {
    e.preventDefault();
    e.stopPropagation();
    handleMenuToggle(actingId);
  };

  if (loading) {
    return (
      <main className="h-screen p-4 lg:p-6 flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">액팅 대기열 로딩중...</div>
      </main>
    );
  }

  return (
    <main className="h-screen p-4 lg:p-6 flex flex-col bg-gray-50">
      <div className="flex-grow flex flex-col gap-4 min-h-0 overflow-y-auto p-1">
        {DOCTORS.map(doctor => {
          const queue = actingsByDoctor[doctor.id] || [];
          const waitingQueue = queue.filter(a => a.status === 'waiting');

          return (
            <div key={doctor.id} className="bg-white rounded-lg shadow-sm flex items-stretch border flex-shrink-0">
              {/* 원장 이름 영역 */}
              <div
                className="relative flex flex-col items-center justify-center p-4 border-r bg-gray-50 w-32 flex-shrink-0 cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => openAddModal(doctor.id)}
                title={`${doctor.alias} 원장 액팅 추가 (클릭)`}
              >
                <h3 className="text-6xl font-extrabold text-clinic-text-primary">{doctor.alias}</h3>
              </div>

              {/* 액팅 카드 영역 */}
              <div
                className="p-3 flex items-center gap-1 flex-grow flex-wrap min-h-[110px]"
                onDragOver={(e) => handleDragOver(e, doctor.id, waitingQueue.length)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, doctor.id, waitingQueue.length)}
                onContextMenu={(e) => handlePanelContextMenu(e, doctor.id)}
              >
                {waitingQueue.map((acting, index) => {
                  const patientRoom = treatmentRooms.find(r => r.patientId === acting.patientId);
                  const remainingTreatments = patientRoom?.sessionTreatments
                    .filter(t => t.status !== 'completed')
                    .map(t => t.name) || [];
                  const isDropTarget = dropTarget?.doctorId === doctor.id && dropTarget?.index === index;

                  return (
                    <div
                      key={acting.id}
                      className="relative flex items-center flex-shrink-0"
                      data-acting-id={acting.id}
                    >
                      {/* 드롭 위치 표시 (왼쪽) */}
                      {isDropTarget && draggedItem && draggedItem.acting.id !== acting.id && (
                        <div className="w-1 h-24 bg-blue-500 rounded-full mr-1 animate-pulse" />
                      )}
                      <div
                        className="w-28"
                        draggable
                        onDragStart={(e) => handleDragStart(e, acting, doctor.id, index)}
                        onDragEnd={handleDragEnd}
                        onDragOver={(e) => {
                          e.stopPropagation();
                          handleDragOver(e, doctor.id, index);
                        }}
                        onDrop={(e) => {
                          e.stopPropagation();
                          handleDrop(e, doctor.id, index);
                        }}
                        onContextMenu={(e) => handleActingCardContextMenu(e, acting.id)}
                      >
                        <div
                          className={`cursor-grab active:cursor-grabbing hover:scale-105 hover:shadow-lg transition-transform duration-200 ${
                            draggedItem?.acting.id === acting.id ? 'opacity-50' : ''
                          }`}
                          title={`${acting.patientName}님 ${acting.actingType} (드래그하여 순서 변경, 우클릭: 메뉴)`}
                        >
                          <ActingCard
                            acting={acting}
                            isDragging={draggedItem?.acting.id === acting.id}
                            bedNumber={patientRoom?.name}
                            inTime={patientRoom?.inTime}
                            remainingTreatments={remainingTreatments}
                          />
                        </div>
                      </div>
                      {openMenuId === acting.id && (
                        <div ref={menuRef} className="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-28 bg-white rounded-md shadow-lg z-20 border">
                          <ul className="py-1">
                            <li>
                              <button
                                onClick={() => openEditModal(acting)}
                                className="block w-full text-left px-4 py-2 text-sm text-blue-700 hover:bg-gray-100"
                              >
                                수정
                              </button>
                            </li>
                            <li>
                              <button
                                onClick={() => handleCompleteActing(acting.id, doctor.id)}
                                className="block w-full text-left px-4 py-2 text-sm text-green-700 hover:bg-gray-100"
                              >
                                완료
                              </button>
                            </li>
                            <li>
                              <button
                                onClick={() => handleDeleteActing(acting.id)}
                                className="block w-full text-left px-4 py-2 text-sm text-red-700 hover:bg-gray-100"
                              >
                                삭제
                              </button>
                            </li>
                          </ul>
                        </div>
                      )}
                    </div>
                  );
                })}
                {/* 맨 끝 드롭 위치 표시 */}
                {waitingQueue.length > 0 && dropTarget?.doctorId === doctor.id && dropTarget?.index === waitingQueue.length && draggedItem && (
                  <div className="w-1 h-24 bg-blue-500 rounded-full ml-1 animate-pulse flex-shrink-0" />
                )}
                {waitingQueue.length === 0 && (
                  <div
                    className="flex items-center justify-center h-full w-full text-center text-clinic-text-secondary p-4 cursor-pointer"
                    onClick={() => openAddModal(doctor.id)}
                  >
                    <p className="font-semibold text-sm">클릭하여 액팅 추가</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 패널 빈 곳 우클릭 컨텍스트 메뉴 */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed bg-white rounded-md shadow-lg z-50 border"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <ul className="py-1">
            <li>
              <button
                onClick={() => openAddModal(contextMenu.doctorId)}
                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                액팅 추가
              </button>
            </li>
          </ul>
        </div>
      )}

      {/* 액팅 추가/수정 모달 */}
      <ActingModal
        isOpen={modalState.isOpen}
        mode={modalState.mode}
        doctorId={modalState.doctorId}
        doctorAlias={modalState.doctorAlias}
        initialData={
          modalState.editingActing
            ? {
                id: modalState.editingActing.id,
                actingType: modalState.editingActing.actingType,
                patientName: modalState.editingActing.patientName,
                memo: modalState.editingActing.memo || '',
              }
            : undefined
        }
        onClose={closeModal}
        onSave={handleSaveActing}
      />
    </main>
  );
};

export default ActingManagementView;
