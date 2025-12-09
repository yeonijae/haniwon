import React, { useState, useEffect, useRef } from 'react';
import { MssqlReservation } from '../hooks/useMssqlReservations';

interface MssqlReservationCardProps {
  reservation: MssqlReservation;
  formatTime: (time: string | null) => string;
  onPatientArrival?: (reservation: MssqlReservation, destination: 'consultation' | 'treatment') => void;
}

const MssqlReservationCard: React.FC<MssqlReservationCardProps> = ({
  reservation,
  formatTime,
  onPatientArrival
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isArrived = reservation.visited;
  const chartNo = reservation.chart_no?.replace(/^0+/, '') || '';

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
          <p className={`font-bold text-lg ${isArrived ? 'text-gray-400 line-through' : 'text-clinic-primary'}`}>
            {formatTime(reservation.time)}
          </p>
        </div>
        <div className="truncate">
          {/* Line 1: Patient, Chart#, Doctor, Item */}
          <p
            className={`text-sm truncate ${isArrived ? 'text-gray-500 line-through' : ''}`}
            title={`${reservation.patient_name} (${chartNo}) | ${reservation.doctor} | ${reservation.item || ''}`}
          >
            <span className={`font-bold ${isArrived ? 'text-gray-500' : 'text-clinic-text-primary'}`}>
              {reservation.patient_name}
            </span>
            {chartNo && (
              <span className={`font-normal text-xs ml-1 ${isArrived ? 'text-gray-400' : 'text-clinic-text-secondary'}`}>
                ({chartNo})
              </span>
            )}
            {reservation.doctor && (
              <>
                <span className="mx-1.5 text-gray-300">|</span>
                <span className={`font-medium ${isArrived ? 'text-gray-400' : 'text-clinic-text-secondary'}`}>
                  {reservation.doctor}
                </span>
              </>
            )}
            {reservation.item && (
              <>
                <span className="mx-1.5 text-gray-300">|</span>
                <span className={isArrived ? 'text-gray-400' : 'text-clinic-text-secondary'}>
                  {reservation.item}
                </span>
              </>
            )}
            {reservation.type && (
              <span className={`ml-2 px-1.5 py-0.5 text-xs rounded ${
                reservation.type === '초진'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-blue-100 text-blue-700'
              }`}>
                {reservation.type}
              </span>
            )}
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
      {onPatientArrival && (
        <div className="flex items-center space-x-2 flex-shrink-0 ml-2">
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsDropdownOpen(prev => !prev)}
              disabled={isArrived}
              className={`text-gray-400 ${isArrived ? 'cursor-not-allowed' : 'hover:text-green-500'}`}
              aria-label={`${reservation.patient_name}님 접수`}
            >
              <i className="fa-solid fa-check"></i>
            </button>
            {isDropdownOpen && !isArrived && (
              <div className="absolute right-0 mt-2 w-32 bg-white rounded-md shadow-lg z-20 border">
                <ul className="py-1">
                  <li>
                    <button
                      onClick={() => {
                        onPatientArrival(reservation, 'consultation');
                        setIsDropdownOpen(false);
                      }}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      진료대기
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => {
                        onPatientArrival(reservation, 'treatment');
                        setIsDropdownOpen(false);
                      }}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      치료대기
                    </button>
                  </li>
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MssqlReservationCard;
