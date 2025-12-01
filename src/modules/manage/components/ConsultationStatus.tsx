import React, { useState, useRef, useEffect } from 'react';
import Quadrant from './Quadrant';
import { ConsultationRoom } from '../types';

interface ConsultationRoomPanelProps {
  room: ConsultationRoom;
  onFinishConsultation: (patientId: number, destination: 'treatment' | 'payment') => void;
  onAssignPatient: (patientId: number, roomId: number, sourceListType: 'consultation' | 'treatment' | 'consultation_room', sourceRoomId?: number) => void;
  onCancelRegistration?: (patientId: number) => void;
}

const ConsultationRoomPanel: React.FC<ConsultationRoomPanelProps> = ({ room, onFinishConsultation, onAssignPatient, onCancelRegistration }) => {
  const { roomName, doctorName, patientName, patientDetails, status, patientId } = room;
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const statusInfo = {
    available: { text: '대기중', color: 'text-green-600', bgColor: 'bg-green-100' },
    in_consultation: { text: '진료중', color: 'text-red-600', bgColor: 'bg-red-100' },
    waiting: { text: '입실대기', color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
  }[status];

  // 우클릭 메뉴
  const handleContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (!patientId) return;

    setContextMenu({ x: event.clientX, y: event.clientY });
  };

  const handlePayment = () => {
    if (patientId) {
      onFinishConsultation(patientId, 'payment');
    }
    setContextMenu(null);
  };

  const handleCancelRegistration = () => {
    if (patientId && onCancelRegistration) {
      onCancelRegistration(patientId);
    }
    setContextMenu(null);
  };

  // 드래그 시작 (진료실에서 환자를 드래그)
  const handleDragStart = (e: React.DragEvent) => {
    console.log('🚀 진료실 드래그 시작:', { patientId, roomId: room.id, patientName });
    if (!patientId) return;
    e.dataTransfer.setData('patientId', patientId.toString());
    e.dataTransfer.setData('sourceListType', 'consultation_room');
    e.dataTransfer.setData('roomId', room.id.toString());
    e.dataTransfer.effectAllowed = 'move';
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

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
  };

  const handleDragEnter = (event: React.DragEvent) => {
    event.preventDefault();
    if (room.status === 'available') {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);

    const sourceListType = event.dataTransfer.getData('sourceListType') as 'consultation' | 'treatment' | 'consultation_room';
    const droppedPatientId = parseInt(event.dataTransfer.getData('patientId'), 10);
    const sourceRoomId = event.dataTransfer.getData('roomId') ? parseInt(event.dataTransfer.getData('roomId'), 10) : undefined;

    console.log('📥 진료실 드롭:', { droppedPatientId, sourceListType, sourceRoomId, targetRoomId: room.id, roomStatus: room.status });

    // 같은 진료실로 드롭하면 무시
    if (sourceListType === 'consultation_room' && sourceRoomId === room.id) {
      console.log('📥 같은 진료실로 드롭 - 무시');
      return;
    }

    // 빈 진료실에만 드롭 가능
    if (room.status !== 'available') {
      console.log('📥 진료실이 사용 중 - 드롭 불가');
      return;
    }

    if (droppedPatientId) {
      onAssignPatient(droppedPatientId, room.id, sourceListType, sourceRoomId);
    }
  };


  return (
    <>
      <div
        className={`bg-white rounded-lg border border-gray-200 p-2 flex flex-col shadow-sm transition-all duration-150 ${isDragOver ? 'ring-2 ring-clinic-secondary ring-offset-2' : ''}`}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="flex justify-between items-center mb-1">
          <h3 className="text-sm font-bold text-clinic-primary">{roomName}</h3>
          <span className="text-xs text-clinic-text-secondary">{doctorName}</span>
        </div>
        <div
          className={`rounded-md p-2 text-center flex flex-col justify-center ${statusInfo.bgColor} ${patientId ? 'cursor-grab' : ''}`}
          draggable={!!patientId}
          onDragStart={handleDragStart}
          onContextMenu={handleContextMenu}
        >
          {patientName ? (
            <>
              <p className={`font-bold text-base truncate ${statusInfo.color}`}>
                {patientName}
              </p>
              <p className="text-xs text-gray-600 mt-0.5 truncate">{patientDetails}</p>
            </>
          ) : (
            <>
              <p className={`font-bold text-base truncate ${statusInfo.color}`}>{statusInfo.text}</p>
              <p className="text-xs text-gray-600 mt-0.5 truncate">&nbsp;</p>
            </>
          )}
        </div>
      </div>

      {contextMenu && patientId && (
        <div
          ref={menuRef}
          className="fixed z-50 w-28 bg-white rounded-md shadow-lg border text-sm"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <ul className="py-1">
            <li>
              <button
                onClick={handlePayment}
                className="block w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100"
              >
                <i className="fa-solid fa-credit-card mr-2 text-green-600"></i>
                수납
              </button>
            </li>
            <li>
              <button
                onClick={handleCancelRegistration}
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

interface ConsultationStatusProps {
  rooms: ConsultationRoom[];
  onFinishConsultation: (patientId: number, destination: 'treatment' | 'payment') => void;
  onAssignPatient: (patientId: number, roomId: number, sourceListType: 'consultation' | 'treatment' | 'consultation_room', sourceRoomId?: number) => void;
  onCancelRegistration?: (patientId: number) => void;
}

const ConsultationStatus: React.FC<ConsultationStatusProps> = ({ rooms, onFinishConsultation, onAssignPatient, onCancelRegistration }) => {
  const title = (
    <>
      <span>진료실 현황</span>
    </>
  );

  return (
    <Quadrant icon="fa-solid fa-stethoscope" title={title}>
      <div className="grid grid-cols-2 gap-2">
        {rooms.map(room => (
          <ConsultationRoomPanel
            key={room.id}
            room={room}
            onFinishConsultation={onFinishConsultation}
            onAssignPatient={onAssignPatient}
            onCancelRegistration={onCancelRegistration}
          />
        ))}
      </div>
    </Quadrant>
  );
};

export default ConsultationStatus;