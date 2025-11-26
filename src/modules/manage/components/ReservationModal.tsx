
import React, { useState, useMemo, useEffect } from 'react';
import { Patient, ReservationsState, Reservation, Treatment } from '../types';
import NewReservationForm, { NewReservationData } from './NewReservationForm';
import { DOCTORS } from '../constants';

interface ReservationModalProps {
    reservations: ReservationsState;
    addNewReservation: (data: NewReservationData) => void;
    updateReservation: (reservationId: string, data: NewReservationData) => void;
    cancelReservation: (reservationId: string) => void;
    deleteReservation: (reservationId: string) => void;
    closeModal: () => void;
    allPatients: Patient[];
    setModalWide: (isWide: boolean) => void;
    setModalTitle: (title: string) => void;
    initialReservationForEdit?: Reservation | null;
    initialPatientForNew?: Patient | null;
}

// FIX: Define a union type for the view state to allow different data shapes for the form view.
// This addresses an issue where TypeScript inferred a too-narrow type for the state, causing an error on line 147.
type ViewState =
    | { view: 'calendar' }
    | { view: 'form'; data: { reservation: Reservation } }
    | { view: 'form'; data: { doctor: string; time: string } };

const getYYYYMMDD = (d: Date): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// Helper function to determine colors based on treatment
const getReservationColors = (treatments: Treatment[], status: Reservation['status']): { bg: string; border: string; textPrimary: string; textSecondary: string } => {
    if (status === 'canceled') {
        return {
            bg: 'bg-gray-100',
            border: 'border-gray-300',
            textPrimary: 'text-gray-500',
            textSecondary: 'text-gray-400',
        };
    }
    if (treatments.some(t => t.name === '약초진')) {
        return {
            bg: 'bg-pink-100',
            border: 'border-pink-400',
            textPrimary: 'text-pink-800',
            textSecondary: 'text-pink-700',
        };
    }
    if (treatments.some(t => t.name === '약재진')) {
        return {
            bg: 'bg-yellow-100',
            border: 'border-yellow-400',
            textPrimary: 'text-yellow-800',
            textSecondary: 'text-yellow-700',
        };
    }
    return {
        bg: 'bg-blue-100',
        border: 'border-blue-400',
        textPrimary: 'text-blue-800',
        textSecondary: 'text-blue-700',
    };
};


const ReservationModal: React.FC<ReservationModalProps> = ({ 
    reservations, 
    addNewReservation, 
    updateReservation,
    cancelReservation,
    deleteReservation,
    closeModal, 
    allPatients,
    setModalWide,
    setModalTitle,
    initialReservationForEdit,
    initialPatientForNew,
}) => {
    const doctors = DOCTORS;
    const timeSlots = useMemo(() => {
        const slots = [];
        let hour = 9;
        let minute = 30;
        const endHour = 20;

        while (hour < endHour) {
            slots.push(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
            minute += 30;
            if (minute >= 60) {
                hour++;
                minute = 0;
            }
        }
        return slots;
    }, []);
    
    // FIX: Apply the explicit ViewState type to useState to allow for different data shapes.
    const [viewState, setViewState] = useState<ViewState>(() => {
        if (initialReservationForEdit) {
            return { view: 'form', data: { reservation: initialReservationForEdit } };
        }
        return { view: 'calendar' };
    });

    const [currentDate, setCurrentDate] = useState(() => 
        initialReservationForEdit 
            ? new Date(initialReservationForEdit.date.replace(/-/g, '/')) 
            : new Date()
    );

    const [selectedDate, setSelectedDate] = useState(() => 
        initialReservationForEdit
            ? new Date(initialReservationForEdit.date.replace(/-/g, '/'))
            : new Date()
    );
    
    useEffect(() => {
        if (viewState.view === 'form') {
            setModalWide(false); // Request narrow modal
        } else {
            setModalWide(true); // Request wide modal for calendar
        }
    }, [viewState.view, setModalWide]);

    const daysOfWeek = ['일', '월', '화', '수', '목', '금', '토'];

    const getDaysInMonth = (year: number, month: number) => {
        const date = new Date(year, month, 1);
        const days = [];
        while (date.getMonth() === month) {
            days.push(new Date(date));
            date.setDate(date.getDate() + 1);
        }
        return days;
    };

    const handlePrevMonth = () => {
        const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
        setCurrentDate(newDate);
        setSelectedDate(newDate);
    };

    const handleNextMonth = () => {
        const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
        setCurrentDate(newDate);
        setSelectedDate(newDate);
    };

    const handleDateClick = (day: Date) => {
        setSelectedDate(day);
    };

    const handleTimeSlotClick = (doctor: string, time: string) => {
        setModalTitle('새 예약');
        setViewState({ view: 'form', data: { doctor, time } });
    };

    const handleReservationClick = (reservation: Reservation) => {
        setModalTitle('예약 수정');
        setViewState({ view: 'form', data: { reservation } });
    };

    const handleFormSave = (data: NewReservationData) => {
        addNewReservation(data);
        if (initialPatientForNew) {
            closeModal();
        } else {
            setModalTitle('예약 관리');
            setViewState({ view: 'calendar' });
        }
    };

    const handleFormUpdate = (reservationId: string, data: NewReservationData) => {
        updateReservation(reservationId, data);
        setModalTitle('예약 관리');
        setViewState({ view: 'calendar' });
    };
    
    const handleFormCancel = (reservationId: string) => {
        cancelReservation(reservationId);
        setModalTitle('예약 관리');
        setViewState({ view: 'calendar' });
    };

    const handleFormDelete = (reservationId: string) => {
        deleteReservation(reservationId);
        setModalTitle('예약 관리');
        setViewState({ view: 'calendar' });
    };
    
    const handleFormClose = () => {
        if (initialPatientForNew || initialReservationForEdit) {
            closeModal();
        } else {
            setModalTitle('예약 관리');
            setViewState({ view: 'calendar' });
        }
    };

    if (viewState.view === 'form') {
        const existingReservation = ('reservation' in viewState.data)
            ? viewState.data.reservation
            : undefined;
        
        const defaultDoctor = ('doctor' in viewState.data)
            ? viewState.data.doctor
            : '';
            
        const defaultTime = ('time' in viewState.data)
            ? viewState.data.time
            : '';

        return (
            <>
                 { !initialPatientForNew && !initialReservationForEdit && (
                     <div className="flex items-center mb-6 -mt-2">
                        <button onClick={handleFormClose} className="flex items-center text-gray-600 hover:text-gray-900 font-semibold text-sm">
                            <i className="fa-solid fa-arrow-left mr-2"></i>
                            <span>예약 현황으로 돌아가기</span>
                        </button>
                    </div>
                 )}
                <NewReservationForm 
                    doctor={defaultDoctor}
                    time={defaultTime}
                    date={selectedDate}
                    onSave={handleFormSave}
                    onUpdate={handleFormUpdate}
                    onCancelReservation={handleFormCancel}
                    onDeleteReservation={handleFormDelete}
                    onClose={handleFormClose}
                    allPatients={allPatients}
                    existingReservation={existingReservation}
                    doctors={doctors}
                    timeSlots={timeSlots}
                    initialPatient={initialPatientForNew}
                />
            </>
        );
    }


    const days = getDaysInMonth(currentDate.getFullYear(), currentDate.getMonth());
    const year = currentDate.getFullYear();
    const month = (currentDate.getMonth() + 1).toString().padStart(2, '0');
    
    const selectedDateKey = getYYYYMMDD(selectedDate);
    const selectedMonth = (selectedDate.getMonth() + 1).toString().padStart(2, '0');
    const selectedDay = selectedDate.getDate().toString().padStart(2, '0');
    const selectedDayOfWeek = daysOfWeek[selectedDate.getDay()];

    return (
        <div className="w-full text-clinic-text-primary">
            <div className="flex justify-between items-center mb-6 -mt-2">
                <div className="flex items-center space-x-2">
                     <button onClick={handlePrevMonth} className="w-10 h-10 flex items-center justify-center rounded-lg border hover:bg-gray-100 font-bold text-lg focus:outline-none focus:ring-2 focus:ring-clinic-secondary" aria-label="이전 달">
                        &lt;
                    </button>
                    <h2 className="text-2xl font-bold">{`${year}년 ${month}월`}</h2>
                     <button onClick={handleNextMonth} className="w-10 h-10 flex items-center justify-center rounded-lg border border-gray-300 hover:bg-gray-100 font-bold text-lg focus:outline-none focus:ring-2 focus:ring-clinic-secondary" aria-label="다음 달">
                        &gt;
                    </button>
                </div>
                <h3 className="text-xl font-bold">
                    {`선택일자: ${selectedMonth}월 ${selectedDay}일 (${selectedDayOfWeek})`}
                </h3>
            </div>

            <div className="bg-gray-50 p-4 rounded-xl shadow-inner">
                <div className="flex gap-1 pb-2">
                    {days.map(day => {
                        const dayNumber = day.getDate();
                        const dayOfWeekIndex = day.getDay();
                        const isSelected = day.toDateString() === selectedDate.toDateString();
                        
                        let dayColorClass = 'text-gray-500';
                        let dateColorClass = 'text-black';
                        
                        if (dayOfWeekIndex === 0) {
                            dayColorClass = 'text-red-500';
                            dateColorClass = 'text-red-500';
                        } else if (dayOfWeekIndex === 6) {
                            dayColorClass = 'text-blue-500';
                            dateColorClass = 'text-blue-500';
                        }
                        
                        return (
                            <button
                                key={day.toISOString()}
                                onClick={() => handleDateClick(day)}
                                className={`flex-1 flex flex-col items-center justify-center h-16 rounded-lg border transition-colors duration-150
                                    ${isSelected ? 'bg-blue-600 text-white shadow-md' : 'bg-white hover:bg-gray-200 border-gray-200'}
                                `}
                                aria-label={`${month}월 ${dayNumber}일 ${daysOfWeek[dayOfWeekIndex]}요일`}
                                aria-pressed={isSelected}
                            >
                                <span className={`text-base font-medium ${isSelected ? 'text-white' : dateColorClass}`}>{String(dayNumber).padStart(2, '0')}</span>
                                <span className={`text-sm mt-1 ${isSelected ? 'text-blue-100' : dayColorClass}`}>{daysOfWeek[dayOfWeekIndex]}</span>
                            </button>
                        );
                    })}
                </div>
            </div>
            
            <div className="mt-6 border border-gray-200 rounded-lg overflow-hidden bg-white">
                {/* Header Row */}
                <div className="grid grid-cols-[minmax(80px,auto)_repeat(4,minmax(0,1fr))] sticky top-0 bg-gray-100 z-10 shadow-sm font-semibold">
                    <div className="p-3 text-center border-r border-b text-clinic-text-primary">시간</div>
                    {doctors.map(doctor => (
                        <div key={doctor} className="p-3 text-center border-r border-b text-clinic-text-primary">{doctor}</div>
                    ))}
                </div>

                {/* Schedule Body */}
                <div className="max-h-[60vh] overflow-y-auto">
                    {timeSlots.map((time, timeIndex) => (
                        <div key={time} className="grid grid-cols-[minmax(80px,auto)_repeat(4,minmax(0,1fr))] border-b last:border-b-0 min-h-[50px]">
                            {/* Time Cell */}
                            <div className="p-2 text-center text-sm font-medium border-r flex items-center justify-center text-clinic-text-secondary bg-gray-50">{time}</div>
                            
                            {/* Doctor Cells for this time slot */}
                            {doctors.map(doctor => {
                                const reservationsForSlot = reservations[selectedDateKey]?.[doctor]?.[time] || [];
                                const reservationsForNextSlot = timeIndex < timeSlots.length - 1 ? (reservations[selectedDateKey]?.[doctor]?.[timeSlots[timeIndex + 1]] || []) : [];
                                const usedActing = reservationsForSlot.reduce((sum, res) => sum + res.slotActing, 0);
                                const isFull = usedActing >= 6;

                                // Map cell index to reservation info
                                const cellContent: { [index: number]: Reservation } = {};
                                let currentCell = 0;
                                reservationsForSlot.forEach(res => {
                                    if (currentCell < 6) {
                                        cellContent[currentCell] = res;
                                        currentCell += res.slotActing;
                                    }
                                });

                                return (
                                    <div
                                        key={doctor}
                                        className="grid grid-cols-6 border-r last:border-r-0 group relative z-0"
                                    >
                                        {/* Clickable Area for New Reservation */}
                                        {!isFull && (
                                            <button
                                                onClick={() => handleTimeSlotClick(doctor, time)}
                                                className="absolute inset-0 group-hover:bg-blue-50 transition-colors duration-150 z-0 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-clinic-secondary"
                                                aria-label={`새 예약 추가: ${doctor}, ${time}`}
                                            ></button>
                                        )}

                                        {/* Vertical grid lines */}
                                        {Array.from({ length: 6 }).map((_, i) => (
                                            <div key={i} className="border-l border-gray-200 h-full"></div>
                                        ))}
                                        
                                        {/* Render actual reservation blocks */}
                                        {Object.entries(cellContent).map(([startIndexStr, reservation]) => {
                                            const continuesToNext = reservationsForNextSlot.some(r => r.id === reservation.id);
                                            const colors = getReservationColors(reservation.treatments, reservation.status);
                                            
                                            let stylingClasses = `m-0.5 h-auto ${colors.bg} ${colors.border} flex flex-col justify-center p-1.5 text-xs overflow-hidden z-10 cursor-pointer hover:ring-2 hover:ring-offset-1 hover:ring-clinic-primary`;

                                            if (reservation.isContinuation && continuesToNext) {
                                                stylingClasses += ' rounded-none';
                                            } else if (reservation.isContinuation) {
                                                stylingClasses += ' rounded-b-md';
                                            } else if (continuesToNext) {
                                                stylingClasses += ' rounded-t-md';
                                            } else {
                                                stylingClasses += ' rounded-md';
                                            }

                                            return (
                                                <div
                                                    key={reservation.partId}
                                                    style={{ gridColumn: `${parseInt(startIndexStr, 10) + 1} / span ${reservation.slotActing}` }}
                                                    className={stylingClasses}
                                                    onClick={() => handleReservationClick(reservation)}
                                                    title={`${reservation.patientName} - ${reservation.status === 'canceled' ? '취소됨' : reservation.treatments.map(t=>t.name).join(', ')}`}
                                                >
                                                    <p className={`font-bold ${colors.textPrimary} truncate ${reservation.status === 'canceled' ? 'line-through' : ''}`}>
                                                        {reservation.patientName}
                                                    </p>
                                                    {!reservation.isContinuation &&
                                                        <p className={`${colors.textSecondary} text-[10px] truncate ${reservation.status === 'canceled' ? 'line-through' : ''}`}>{reservation.treatments.map(t => t.name).join(', ')}</p>
                                                    }
                                                    {reservation.isContinuation &&
                                                        <p className={`${colors.textSecondary} text-[10px] truncate`}>(이어짐)</p>
                                                    }
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default ReservationModal;
