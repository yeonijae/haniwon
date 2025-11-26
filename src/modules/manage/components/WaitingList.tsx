
import React, { useState, useRef, useEffect } from 'react';
import { Patient } from '../types';
import Quadrant from './Quadrant';

interface WaitingListProps {
  title: string;
  icon: string;
  list: Patient[];
  listType: 'consultation' | 'treatment';
  onPatientClick: (patient: Patient) => void;
  onPatientDrop: (
    draggedPatientId: number,
    sourceListType: 'consultation' | 'treatment',
    destinationListType: 'consultation' | 'treatment',
    targetPatientId: number | null
  ) => void;
  onMoveToPayment?: (patientId: number, sourceList: 'consultation' | 'treatment') => void;
}

const WaitingListItem: React.FC<{ 
    patient: Patient; 
    onClick: (patient: Patient) => void; 
    listType: 'consultation' | 'treatment';
    onPatientDrop: WaitingListProps['onPatientDrop'];
    onMoveToPayment?: WaitingListProps['onMoveToPayment'];
}> = ({ patient, onClick, listType, onPatientDrop, onMoveToPayment }) => {
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    const handleDragStart = (e: React.DragEvent<HTMLLIElement>) => {
        e.dataTransfer.setData('patientId', patient.id.toString());
        e.dataTransfer.setData('sourceListType', listType);
        setTimeout(() => {
            (e.target as HTMLLIElement).style.opacity = '0.4';
        }, 0);
    };

    const handleDragEnd = (e: React.DragEvent<HTMLLIElement>) => {
        (e.target as HTMLLIElement).style.opacity = '1';
        document.querySelectorAll('.drag-over-indicator').forEach(el => el.classList.remove('drag-over-indicator'));
    };
    
    const handleDragOver = (e: React.DragEvent<HTMLLIElement>) => {
        e.preventDefault();
        if (!e.currentTarget.classList.contains('drag-over-indicator')) {
          e.currentTarget.classList.add('drag-over-indicator');
        }
    };

    const handleDragLeave = (e: React.DragEvent<HTMLLIElement>) => {
        e.currentTarget.classList.remove('drag-over-indicator');
    };
    
    const handleDrop = (e: React.DragEvent<HTMLLIElement>) => {
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.classList.remove('drag-over-indicator');
        const draggedPatientId = parseInt(e.dataTransfer.getData('patientId'), 10);
        const sourceListType = e.dataTransfer.getData('sourceListType') as 'consultation' | 'treatment';
        
        if (draggedPatientId !== patient.id) {
            onPatientDrop(draggedPatientId, sourceListType, listType, patient.id);
        }
    };

    const handleNameClick = (event: React.MouseEvent) => {
        if (!onMoveToPayment) return;

        event.preventDefault();
        event.stopPropagation();

        // Toggle context menu on name click
        if (contextMenu) {
            setContextMenu(null);
        } else {
            setContextMenu({ x: event.clientX, y: event.clientY });
        }
    };

    const handleMoveToPaymentClick = () => {
        if (onMoveToPayment) {
            onMoveToPayment(patient.id, listType);
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
    
    return (
        <>
            <li
                className="flex justify-between items-center p-3 hover:bg-blue-50 rounded-md cursor-pointer transition-colors duration-150"
                draggable="true"
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                <div>
                <span
                    className="font-bold text-clinic-text-primary cursor-pointer hover:text-clinic-primary"
                    onClick={handleNameClick}
                >
                    {patient.name}
                </span>
                <span className="text-sm text-clinic-text-secondary ml-2">{patient.details}</span>
                </div>
                <span className="text-sm text-gray-500">{patient.time}</span>
            </li>
            {contextMenu && (
                <div
                    ref={menuRef}
                    className="fixed z-50 w-28 bg-white rounded-md shadow-lg border text-sm"
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                >
                    <ul className="py-1">
                        <li>
                            <button 
                                onClick={handleMoveToPaymentClick} 
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

const WaitingList: React.FC<WaitingListProps> = ({ title, icon, list, listType, onPatientClick, onPatientDrop, onMoveToPayment }) => {
    const handleDragOver = (e: React.DragEvent<HTMLUListElement>) => {
        e.preventDefault();
        e.currentTarget.classList.add('bg-blue-50');
    };
    
    const handleDragLeave = (e: React.DragEvent<HTMLUListElement>) => {
        e.currentTarget.classList.remove('bg-blue-50');
    };

    const handleDrop = (e: React.DragEvent<HTMLUListElement>) => {
        e.preventDefault();
        e.currentTarget.classList.remove('bg-blue-50');
        // This condition ensures drop event on UL fires only when dropping in empty space
        if (e.target !== e.currentTarget) {
            return;
        }

        const draggedPatientId = parseInt(e.dataTransfer.getData('patientId'), 10);
        const sourceListType = e.dataTransfer.getData('sourceListType') as 'consultation' | 'treatment';
        
        onPatientDrop(draggedPatientId, sourceListType, listType, null);
    };

    return (
      <Quadrant icon={icon} title={`${title} (${list.length})`} className="flex-1 min-h-0">
        <ul 
            className="divide-y divide-gray-200 overflow-y-auto p-2 h-full transition-colors duration-150"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
          {list.length > 0 ? (
            list.map(patient => (
              <WaitingListItem 
                key={`${patient.id}-${patient.name}`} 
                patient={patient} 
                onClick={onPatientClick} 
                listType={listType} 
                onPatientDrop={onPatientDrop} 
                onMoveToPayment={onMoveToPayment}
              />
            ))
           ) : (
            <div className="flex flex-col items-center justify-center h-full text-center text-clinic-text-secondary">
              <i className="fa-regular fa-folder-open text-4xl mb-3"></i>
              <p className="font-semibold">대기 환자가 없습니다.</p>
            </div>
          )}
        </ul>
      </Quadrant>
    );
};

export default WaitingList;
