
import React from 'react';
import Quadrant from './Quadrant';
import { TreatmentRoom, RoomStatus } from '../types';

const getStatusClasses = (status: RoomStatus): string => {
  switch (status) {
    case RoomStatus.IN_USE:
      return 'bg-red-50 border-red-500';
    case RoomStatus.AVAILABLE:
      return 'bg-green-50 border-green-500';
    case RoomStatus.NEED_CLEAN:
      return 'bg-blue-50 border-blue-500';
    case RoomStatus.CLEANING:
      return 'bg-yellow-50 border-yellow-500';
    default:
      return 'bg-gray-100 border-gray-500';
  }
};

const getStatusBadgeBgColor = (status: RoomStatus): string => {
    switch (status) {
      case RoomStatus.IN_USE:
        return 'bg-red-500';
      case RoomStatus.AVAILABLE:
        return 'bg-green-500';
      case RoomStatus.NEED_CLEAN:
        return 'bg-blue-500';
      case RoomStatus.CLEANING:
        return 'bg-yellow-500';
      default:
        return 'bg-gray-500';
    }
}

const RoomCard: React.FC<{ room: TreatmentRoom }> = ({ room }) => {
  const statusClasses = getStatusClasses(room.status);
  const badgeBgColor = getStatusBadgeBgColor(room.status);
  
  const getDoctorInitial = (name?: string) => {
    if (!name) return '?';
    const parts = name.split(' ');
    return parts[0].charAt(0);
  };

  const { totalRemainingTime, currentTreatmentName } = React.useMemo(() => {
    if (room.status !== RoomStatus.IN_USE) {
      return { totalRemainingTime: 0, currentTreatmentName: '' };
    }

    let remainingTime = 0;
    let currentTreatment = null;

    for (const treat of room.sessionTreatments) {
      if (treat.status === 'running') {
        currentTreatment = treat;
        const elapsed = (Date.now() - new Date(treat.startTime!).getTime()) / 1000;
        remainingTime += Math.max(0, treat.duration * 60 - elapsed);
      } else if (treat.status === 'paused') {
        if (!currentTreatment) currentTreatment = treat;
        remainingTime += Math.max(0, treat.duration * 60 - treat.elapsedSeconds);
      } else if (treat.status === 'pending') {
         if (!currentTreatment) currentTreatment = treat;
        remainingTime += treat.duration * 60;
      }
    }
    return { 
      totalRemainingTime: Math.ceil(remainingTime / 60), 
      currentTreatmentName: currentTreatment?.name || ''
    };
  }, [room]);


  const renderTreatments = () => {
    if (room.status !== RoomStatus.IN_USE) return null;
    
    const treatmentElements = room.sessionTreatments.map(t => {
      if(t.status === 'completed') return <s key={t.id}>{t.name}</s>;
      if(t.status === 'running') return <span key={t.id} className="font-bold text-clinic-secondary">{t.name}</span>;
      return <span key={t.id}>{t.name}</span>
    });
    
    if (treatmentElements.length === 0) return <div className="h-[17px]">&nbsp;</div>;

    return (
        <div className="flex flex-nowrap items-center gap-x-1 text-[11px] text-clinic-text-secondary truncate">
            {treatmentElements.map((treatment, index) => (
                <React.Fragment key={index}>
                    {treatment}
                    {index < treatmentElements.length - 1 && <i className="fa-solid fa-angle-right text-gray-300 scale-50 mx-0.5"></i>}
                </React.Fragment>
            ))}
        </div>
    );
  };

  return (
    <div className={`p-1.5 rounded-lg border-l-4 ${statusClasses} flex flex-col justify-center h-full`}>
      {room.status === RoomStatus.IN_USE ? (
        <>
          {/* Line 1: Bed, Doctor, Patient, Chart# */}
          <div className="flex items-center space-x-1.5 min-w-0">
            <h4 className="font-bold text-sm text-clinic-text-primary flex-shrink-0">{room.name}</h4>
            <span className="flex-shrink-0 flex items-center justify-center w-4 h-4 bg-gray-200 text-clinic-text-primary text-[10px] font-bold rounded-full" title={room.doctorName}>
              {getDoctorInitial(room.doctorName)}
            </span>
            <p className="font-semibold text-xs text-clinic-text-primary truncate" title={room.patientName}>
              {room.patientName}
              <span className="text-[10px] font-normal text-clinic-text-secondary ml-1">({room.patientChartNumber})</span>
            </p>
          </div>

          {/* Line 2: Treatments and Remaining Time */}
          <div className="flex justify-between items-center mt-1 min-w-0">
            <div className="truncate">
              {renderTreatments()}
            </div>
            {totalRemainingTime > 0 && (
              <div className="flex items-baseline flex-shrink-0 ml-2">
                <p className="text-base font-bold text-red-600 leading-none">{totalRemainingTime}</p>
                <p className="text-[10px] text-red-500 font-medium leading-none ml-0.5">분</p>
              </div>
            )}
          </div>
        </>
      ) : (
        // Available / Cleaning Card Layout
        <div className="flex justify-between items-center h-full">
          <h4 className="font-bold text-base text-clinic-text-primary">{room.name}</h4>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full text-white ${badgeBgColor}`}>{room.status}</span>
        </div>
      )}
    </div>
  );
};

interface TreatmentRoomStatusProps {
  treatmentRooms: TreatmentRoom[];
}

const TreatmentRoomStatus: React.FC<TreatmentRoomStatusProps> = ({ treatmentRooms }) => {
  return (
    <Quadrant icon="fa-solid fa-bed" title="치료실 현황" className="flex-1">
      <div className="grid grid-cols-2 grid-rows-9 gap-1.5 h-full">
        {treatmentRooms.map((room) => (
          <RoomCard key={room.id} room={room} />
        ))}
      </div>
    </Quadrant>
  );
};

export default TreatmentRoomStatus;
