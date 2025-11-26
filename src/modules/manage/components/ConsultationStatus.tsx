import React, { useState, useRef, useEffect } from 'react';
import Quadrant from './Quadrant';
import { ConsultationRoom } from '../types';

interface ConsultationRoomPanelProps {
  room: ConsultationRoom;
  onFinishConsultation: (patientId: number, destination: 'treatment' | 'payment') => void;
  onAssignPatient: (patientId: number, roomId: number, sourceListType: 'consultation' | 'treatment') => void;
}

const ConsultationRoomPanel: React.FC<ConsultationRoomPanelProps> = ({ room, onFinishConsultation, onAssignPatient }) => {
  const { roomName, doctorName, patientName, patientDetails, status, patientId } = room;
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const statusInfo = {
    available: { text: '대기중', color: 'text-green-600', bgColor: 'bg-green-100' },
    in_consultation: { text: '진료중', color: 'text-red-600', bgColor: 'bg-red-100' },
    waiting: { text: '입실대기', color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
  }[status];

  const handleNameClick = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (!patientId) return;

    // Toggle context menu on name click
    if (contextMenu) {
      setContextMenu(null);
    } else {
      setContextMenu({ x: event.clientX, y: event.clientY });
    }
  };

  const handleAction = (destination: 'treatment' | 'payment') => {
    if (patientId) {
      onFinishConsultation(patientId, destination);
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
    
    const sourceListType = event.dataTransfer.getData('sourceListType') as 'consultation' | 'treatment';
    const droppedPatientId = parseInt(event.dataTransfer.getData('patientId'), 10);

    if ((sourceListType === 'consultation' || sourceListType === 'treatment') && room.status === 'available' && droppedPatientId) {
      onAssignPatient(droppedPatientId, room.id, sourceListType);
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
        <div className={`rounded-md p-2 text-center flex flex-col justify-center ${statusInfo.bgColor}`}>
          {patientName ? (
            <>
              <p
                className={`font-bold text-base truncate ${statusInfo.color} cursor-pointer hover:opacity-70`}
                onClick={handleNameClick}
              >
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
                onClick={() => handleAction('treatment')} 
                className="block w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100"
              >
                치료대기
              </button>
            </li>
            <li>
              <button 
                onClick={() => handleAction('payment')} 
                className="block w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100"
              >
                수납
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
  onAssignPatient: (patientId: number, roomId: number, sourceListType: 'consultation' | 'treatment') => void;
}

const ConsultationStatus: React.FC<ConsultationStatusProps> = ({ rooms, onFinishConsultation, onAssignPatient }) => {
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
          />
        ))}
      </div>
    </Quadrant>
  );
};

export default ConsultationStatus;