import React, { useState, useEffect, useRef } from 'react';
import { Reservation } from '../types';

interface PatientCardProps {
  reservation: Reservation;
  onEdit: (reservation: Reservation) => void;
  onPatientArrival: (reservation: Reservation, destination: 'consultation' | 'treatment') => void;
}

const PatientCard: React.FC<PatientCardProps> = ({ reservation, onEdit, onPatientArrival }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const details = reservation.treatments.map(t => t.name).join(', ');
  const isArrived = reservation.status === 'arrived';

  const cardClasses = `flex items-center justify-between p-3 rounded-md mb-2 transition-colors duration-150 border border-gray-200 relative ${isArrived ? 'bg-gray-100' : 'bg-white hover:bg-blue-50'}`;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className={cardClasses}>
      <div className="flex items-center min-w-0">
        <div className="text-center w-16 mr-3 flex-shrink-0">
          <p className={`font-bold text-lg ${isArrived ? 'text-gray-400 line-through' : 'text-clinic-primary'}`}>{reservation.time}</p>
        </div>
        <div className="truncate">
          {/* Line 1: Patient, Chart#, Doctor, Treatments */}
          <p 
            className={`text-sm truncate ${isArrived ? 'text-gray-500 line-through' : ''}`}
            title={`${reservation.patientName} (${reservation.patientChartNumber}) | ${reservation.doctor} | ${details}`}
          >
            <span className={`font-bold ${isArrived ? 'text-gray-500' : 'text-clinic-text-primary'}`}>{reservation.patientName}</span>
            <span className={`font-normal text-xs ml-1 ${isArrived ? 'text-gray-400' : 'text-clinic-text-secondary'}`}>
              ({reservation.patientChartNumber})
            </span>
            <span className="mx-1.5 text-gray-300">|</span>
            <span className={`font-medium ${isArrived ? 'text-gray-400' : 'text-clinic-text-secondary'}`}>{reservation.doctor}</span>
            <span className="mx-1.5 text-gray-300">|</span>
            <span className={isArrived ? 'text-gray-400' : 'text-clinic-text-secondary'}>{details}</span>
          </p>
          
          {/* Line 2: Memo */}
          <p className={`text-xs truncate mt-1 ${isArrived ? 'text-gray-400 line-through' : 'text-clinic-text-secondary'}`}>
            {reservation.memo ? (
              <>
                <i className="fa-regular fa-note-sticky mr-1.5 text-gray-400"></i>
                <span className="italic">{reservation.memo}</span>
              </>
            ) : (
              <span className="italic text-gray-400">메모 없음</span>
            )}
          </p>
        </div>
      </div>
      <div className="flex items-center space-x-2 flex-shrink-0 ml-2">
        <button
          onClick={() => onEdit(reservation)}
          disabled={isArrived}
          className={`text-gray-400 ${isArrived ? 'cursor-not-allowed' : 'hover:text-clinic-secondary'}`}
          aria-label={`${reservation.patientName}님 예약 수정`}
        >
          <i className="fa-solid fa-pencil"></i>
        </button>
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsDropdownOpen(prev => !prev)}
            disabled={isArrived}
            className={`text-gray-400 ${isArrived ? 'cursor-not-allowed' : 'hover:text-green-500'}`}
            aria-label={`${reservation.patientName}님 접수`}
          >
            <i className="fa-solid fa-check"></i>
          </button>
          {isDropdownOpen && !isArrived && (
            <div className="absolute right-0 mt-2 w-32 bg-white rounded-md shadow-lg z-20 border">
              <ul className="py-1">
                <li>
                  <button onClick={() => { onPatientArrival(reservation, 'consultation'); setIsDropdownOpen(false); }} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                    진료대기
                  </button>
                </li>
                <li>
                  <button onClick={() => { onPatientArrival(reservation, 'treatment'); setIsDropdownOpen(false); }} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                    치료대기
                  </button>
                </li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PatientCard;
