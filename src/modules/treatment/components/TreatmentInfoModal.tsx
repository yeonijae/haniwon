import React, { useState, useEffect, useRef } from 'react';
import { TreatmentRoom, SessionTreatment, TreatmentItem } from '../types';
import Modal from './Modal';

interface TreatmentInfoModalProps {
    isOpen: boolean;
    onClose: () => void;
    room: TreatmentRoom;
    onSave: (roomId: number, updatedTreatments: SessionTreatment[]) => void;
    treatmentItems: TreatmentItem[];
}

const TreatmentInfoModal: React.FC<TreatmentInfoModalProps> = ({ isOpen, onClose, room, onSave, treatmentItems }) => {
    const [treatments, setTreatments] = useState<SessionTreatment[]>([]);
    const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
    const addMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (room) {
            const initialTreatments = (room.sessionTreatments && room.sessionTreatments.length > 0)
                ? room.sessionTreatments
                : treatmentItems.slice(0, 3).map((dt, index) => ({
                    id: `tx-${room.patientId}-${Date.now()}-${index}`,
                    name: dt.name,
                    duration: dt.defaultDuration,
                    status: 'pending' as const,
                    elapsedSeconds: 0,
                }));

            setTreatments(JSON.parse(JSON.stringify(initialTreatments)));
        }
    }, [room, treatmentItems]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
          if (addMenuRef.current && !addMenuRef.current.contains(event.target as Node)) {
            setIsAddMenuOpen(false);
          }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
          document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleUpdateTreatment = (treatmentId: string, field: 'duration' | 'memo', value: string | number) => {
        setTreatments(currentTreatments =>
            currentTreatments.map(t =>
                t.id === treatmentId ? { ...t, [field]: value } : t
            )
        );
    };

    const handleAddTreatment = (treatment: { name: string, duration: number }) => {
        if (!treatments.some(t => t.name === treatment.name)) {
            const newTreatment: SessionTreatment = {
                id: `tx-${room.patientId}-${Date.now()}`,
                name: treatment.name,
                duration: treatment.duration,
                status: 'pending',
                elapsedSeconds: 0,
            };
            setTreatments(prev => [...prev, newTreatment]);
        }
        setIsAddMenuOpen(false);
    };

    const handleRemoveTreatment = (treatmentId: string) => {
        setTreatments(prev => prev.filter(t => t.id !== treatmentId));
    };

    const handleSave = () => {
        onSave(room.id, treatments);
    };

    const treatmentsToAdd = treatmentItems
        .filter(ti => !treatments.some(lt => lt.name === ti.name))
        .map(ti => ({ name: ti.name, duration: ti.defaultDuration }));

    if (!room) return null;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`${room.patientName}님 치료 정보 수정`}
        >
            <div className="space-y-4 p-1">
                {treatments.map(treatment => (
                    <div key={treatment.id} className="p-3 bg-white rounded-md border border-gray-200">
                        <div className="flex items-center justify-between">
                            <p className="font-semibold text-clinic-text-primary">{treatment.name}</p>
                            {treatment.status === 'pending' && (
                                <button
                                    type="button"
                                    onClick={() => handleRemoveTreatment(treatment.id)}
                                    className="text-gray-400 hover:text-red-500 px-1"
                                    aria-label={`${treatment.name} 치료 삭제`}
                                >
                                    <i className="fa-solid fa-trash-can"></i>
                                </button>
                            )}
                        </div>
                        <div className="grid grid-cols-[1fr_auto] gap-2 items-center mt-2">
                            <textarea
                                id={`memo-${treatment.id}`}
                                rows={2}
                                value={treatment.memo || ''}
                                onChange={(e) => handleUpdateTreatment(treatment.id, 'memo', e.target.value)}
                                className="block w-full px-3 py-1.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-clinic-secondary focus:border-clinic-secondary sm:text-sm"
                                placeholder="메모 (예: 오른쪽 어깨)"
                            />
                             <div className="relative w-28">
                                <input
                                    type="number"
                                    value={treatment.duration}
                                    min="1"
                                    onChange={(e) => handleUpdateTreatment(treatment.id, 'duration', parseInt(e.target.value, 10) || 1)}
                                    className="block w-full text-right px-3 py-1.5 pr-8 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-clinic-secondary focus:border-clinic-secondary sm:text-sm"
                                    placeholder="시간(분)"
                                    disabled={treatment.status === 'running' || treatment.status === 'completed'}
                                />
                                <span className="absolute inset-y-0 right-0 pr-2 flex items-center text-sm text-gray-500">분</span>
                            </div>
                        </div>
                    </div>
                ))}

                <div className="relative">
                    <button
                        type="button"
                        onClick={() => setIsAddMenuOpen(prev => !prev)}
                        className="w-full mt-2 px-4 py-2 border-2 border-dashed border-gray-300 text-gray-500 font-semibold rounded-md hover:bg-gray-100 hover:border-gray-400 transition-colors"
                        aria-expanded={isAddMenuOpen}
                        aria-haspopup="true"
                    >
                        <i className="fa-solid fa-plus mr-2"></i>치료 항목 추가
                    </button>
                    {isAddMenuOpen && (
                        <div ref={addMenuRef} className="absolute bottom-full left-0 mb-2 w-full bg-white rounded-lg shadow-lg border z-20 max-h-48 overflow-y-auto">
                           <ul className="py-1">
                                {treatmentsToAdd.length > 0 ? (
                                    treatmentsToAdd.map(t => (
                                        <li key={t.name}>
                                            <button
                                                onClick={() => handleAddTreatment(t)}
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
                </div>
            </div>

            <div className="flex justify-end pt-6 border-t mt-4">
                <button type="button" onClick={onClose} className="mr-2 px-6 py-2 bg-gray-200 text-gray-800 font-semibold rounded-md hover:bg-gray-300 transition-colors">취소</button>
                <button type="button" onClick={handleSave} className="px-6 py-2 bg-clinic-primary text-white font-semibold rounded-md hover:bg-clinic-secondary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-clinic-secondary transition-colors">저장하기</button>
            </div>
        </Modal>
    );
};

export default TreatmentInfoModal;
