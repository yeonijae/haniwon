
import React, { useState, useRef, useEffect } from 'react';
import Quadrant from './Quadrant';
import { Payment } from '../types';

interface PaymentCardProps {
  payment: Payment;
  onPaymentClick: (payment: Payment) => void;
  onReservationClick: (payment: Payment) => void;
  onMoveToWaiting: (paymentId: number, destination: 'consultation' | 'treatment') => void;
  onDelete: (paymentId: number) => void;
}

const PaymentCard: React.FC<PaymentCardProps> = ({ payment, onPaymentClick, onReservationClick, onMoveToWaiting, onDelete }) => {
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const hasReservation = payment.reservationDate && payment.reservationTime;

    const formatReservationDate = (dateStr?: string) => {
        if (!dateStr) return '';
        const parts = dateStr.split('-'); // YYYY-MM-DD
        return parts.length === 3 ? `${parts[1]}/${parts[2]}` : dateStr; // MM.DD
    };
    
    const buttonBaseClasses = "w-10 h-10 text-white text-lg rounded-md transition-colors flex items-center justify-center";

    const handleContextMenu = (event: React.MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();
        setContextMenu({ x: event.clientX, y: event.clientY });
    };

    const handleMoveClick = (destination: 'consultation' | 'treatment') => {
        onMoveToWaiting(payment.id, destination);
        setContextMenu(null);
    };

    const handleDeleteClick = () => {
        if (window.confirm(`${payment.patientName}님을 수납 대기 목록에서 삭제하시겠습니까?`)) {
            onDelete(payment.id);
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
            <div
                className="w-full text-left p-3 bg-white rounded-md mb-2 border border-gray-200 flex justify-between items-center"
            >
                <div onContextMenu={handleContextMenu}>
                    <p className="font-bold text-base text-clinic-text-primary">
                        {payment.patientName}
                    </p>
                    <p className="text-sm text-clinic-text-secondary">{payment.details}</p>
                </div>
                <div className="flex items-center space-x-2 flex-shrink-0">
                    <button
                        onClick={(e) => { e.stopPropagation(); onPaymentClick(payment); }}
                        className={`${buttonBaseClasses} bg-clinic-secondary hover:bg-blue-700`}
                        aria-label={`${payment.patientName}님 수납 처리`}
                        title="수납"
                    >
                        <i className="fa-solid fa-credit-card"></i>
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); onReservationClick(payment); }}
                        className={`${buttonBaseClasses} ${
                            hasReservation
                                ? 'bg-gray-500 hover:bg-gray-600'
                                : 'bg-clinic-accent hover:bg-green-700'
                        }`}
                        aria-label={`${payment.patientName}님 예약`}
                        title={hasReservation ? `${formatReservationDate(payment.reservationDate)} ${payment.reservationTime}` : '예약'}
                    >
                        {hasReservation ? (
                            <div className="text-center text-[10px] leading-tight font-medium">
                                <div>{formatReservationDate(payment.reservationDate)}</div>
                                <div>{payment.reservationTime}</div>
                            </div>
                        ) : (
                            <i className="fa-solid fa-calendar-plus"></i>
                        )}
                    </button>
                </div>
            </div>
            {contextMenu && (
                <div
                    ref={menuRef}
                    className="fixed z-50 w-28 bg-white rounded-md shadow-lg border text-sm"
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                >
                    <ul className="py-1">
                        <li>
                            <button
                                onClick={() => handleMoveClick('consultation')}
                                className="block w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100"
                            >
                                진료대기
                            </button>
                        </li>
                        <li>
                            <button
                                onClick={() => handleMoveClick('treatment')}
                                className="block w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100"
                            >
                                치료대기
                            </button>
                        </li>
                        <li className="border-t border-gray-200">
                            <button
                                onClick={handleDeleteClick}
                                className="block w-full text-left px-4 py-2 text-red-600 hover:bg-red-50"
                            >
                                삭제
                            </button>
                        </li>
                    </ul>
                </div>
            )}
        </>
    );
};

interface PaymentStatusProps {
  payments: Payment[];
  onPaymentClick: (payment: Payment) => void;
  onReservationClick: (payment: Payment) => void;
  onMoveToWaiting: (paymentId: number, destination: 'consultation' | 'treatment') => void;
  onDelete: (paymentId: number) => void;
}

const PaymentStatus: React.FC<PaymentStatusProps> = ({ payments, onPaymentClick, onReservationClick, onMoveToWaiting, onDelete }) => {
  const titleWithCount = (
    <>
      수납 및 예약
      <span className="ml-2 px-2 py-0.5 bg-clinic-primary text-white text-sm font-bold rounded-full">
        {payments.length}명
      </span>
    </>
  );

  return (
    <Quadrant icon="fa-solid fa-credit-card" title={titleWithCount} className="flex-1 min-h-0">
      <div className="space-y-2 p-2 h-full">
        {payments.length > 0 ? (
          payments.map((payment: Payment) => (
            <PaymentCard
                key={payment.id}
                payment={payment}
                onPaymentClick={onPaymentClick}
                onReservationClick={onReservationClick}
                onMoveToWaiting={onMoveToWaiting}
                onDelete={onDelete}
            />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center text-clinic-text-secondary">
            <i className="fa-regular fa-credit-card text-4xl mb-3"></i>
            <p className="font-semibold">수납 대기중인 환자가 없습니다.</p>
          </div>
        )}
      </div>
    </Quadrant>
  );
};

export default PaymentStatus;