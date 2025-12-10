
import React, { useState, useRef, useEffect, useCallback } from 'react';
import Quadrant from './Quadrant';
import { Payment } from '../types';
import * as api from '../lib/api';

interface PaymentCardProps {
  payment: Payment;
  onPatientClick: (payment: Payment) => void;
  onReservationClick: (payment: Payment) => void;
  onMoveToWaiting: (paymentId: number, destination: 'consultation' | 'treatment') => void;
  onDelete: (paymentId: number) => void;
  onMemoSave?: (patientId: number, packageInfo: string, memo: string) => void;
}

// 금액 포맷 (천 단위 콤마)
const formatAmount = (amount?: number) => {
  if (!amount) return '-';
  return amount.toLocaleString() + '원';
};

const PaymentCard: React.FC<PaymentCardProps> = ({ payment, onPatientClick, onReservationClick, onMoveToWaiting, onDelete, onMemoSave }) => {
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
    const [showMemoInput, setShowMemoInput] = useState(false);
    const [packageInfo, setPackageInfo] = useState(payment.packageInfo || '');
    const [paymentMemo, setPaymentMemo] = useState(payment.paymentMemo || '');
    const [isSaving, setIsSaving] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const hasReservation = payment.reservationDate && payment.reservationTime;
    const hasMssqlReceipt = payment.mssqlReceiptId || payment.insuranceSelf || payment.generalAmount;
    const totalAmount = (payment.insuranceSelf || 0) + (payment.generalAmount || 0);
    const isPaid = payment.isPaid || payment.status === 'paid';

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

    const handleMemoToggle = () => {
        setShowMemoInput(!showMemoInput);
    };

    const handleMemoSave = useCallback(async () => {
        if (!payment.patientId) return;

        setIsSaving(true);
        try {
            await api.upsertPaymentMemo({
                patient_id: payment.patientId,
                chart_number: payment.patientChartNumber,
                patient_name: payment.patientName,
                mssql_receipt_id: payment.mssqlReceiptId,
                total_amount: totalAmount,
                insurance_self: payment.insuranceSelf,
                general_amount: payment.generalAmount,
                unpaid_amount: payment.unpaidAmount,
                package_info: packageInfo,
                memo: paymentMemo,
            });
            onMemoSave?.(payment.patientId, packageInfo, paymentMemo);
            setShowMemoInput(false);
        } catch (error) {
            console.error('메모 저장 오류:', error);
            alert('메모 저장에 실패했습니다.');
        } finally {
            setIsSaving(false);
        }
    }, [payment, packageInfo, paymentMemo, totalAmount, onMemoSave]);

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

    // 외부에서 payment가 변경되면 메모 상태도 업데이트
    useEffect(() => {
        setPackageInfo(payment.packageInfo || '');
        setPaymentMemo(payment.paymentMemo || '');
    }, [payment.packageInfo, payment.paymentMemo]);

    return (
        <>
            <div className="w-full text-left bg-white rounded-md mb-2 border border-gray-200">
                {/* 상단: 환자 정보 + 버튼 */}
                <div className="flex justify-between items-center p-3">
                    <div
                        onContextMenu={handleContextMenu}
                        onClick={(e) => { e.stopPropagation(); onPatientClick(payment); }}
                        className="flex-1 min-w-0 cursor-pointer hover:bg-gray-50 rounded p-1 -m-1 transition-colors"
                    >
                        <div className="flex items-center gap-2">
                            <p className="font-bold text-base text-clinic-text-primary hover:text-clinic-primary">
                                {payment.patientName}
                            </p>
                            {payment.patientChartNumber && (
                                <span className="text-xs text-gray-400">{payment.patientChartNumber}</span>
                            )}
                            {/* 수납 상태 표시 */}
                            {isPaid ? (
                                <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded">
                                    수납완료
                                </span>
                            ) : (
                                <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 text-xs font-medium rounded">
                                    수납대기
                                </span>
                            )}
                        </div>
                        <p className="text-sm text-clinic-text-secondary truncate">{payment.details}</p>
                    </div>
                    <div className="flex items-center space-x-2 flex-shrink-0">
                        {/* 메모 버튼 */}
                        <button
                            onClick={(e) => { e.stopPropagation(); handleMemoToggle(); }}
                            className={`${buttonBaseClasses} ${
                                (packageInfo || paymentMemo)
                                    ? 'bg-amber-500 hover:bg-amber-600'
                                    : 'bg-gray-400 hover:bg-gray-500'
                            }`}
                            aria-label="수납 메모"
                            title="수납 메모"
                        >
                            <i className="fa-solid fa-sticky-note"></i>
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

                {/* MSSQL 수납 정보 (있을 때만 표시) */}
                {hasMssqlReceipt && (
                    <div className="px-3 pb-2 border-t border-gray-100 pt-2">
                        <div className="flex items-center gap-3 text-xs">
                            <span className="text-gray-500">
                                <i className="fa-solid fa-receipt mr-1"></i>
                                총 {formatAmount(totalAmount)}
                            </span>
                            {payment.insuranceSelf !== undefined && payment.insuranceSelf > 0 && (
                                <span className="text-blue-600">
                                    급여 {formatAmount(payment.insuranceSelf)}
                                </span>
                            )}
                            {payment.generalAmount !== undefined && payment.generalAmount > 0 && (
                                <span className="text-green-600">
                                    비급여 {formatAmount(payment.generalAmount)}
                                </span>
                            )}
                            {payment.unpaidAmount !== undefined && payment.unpaidAmount > 0 && (
                                <span className="text-red-600 font-medium">
                                    미수 {formatAmount(payment.unpaidAmount)}
                                </span>
                            )}
                        </div>
                    </div>
                )}

                {/* 메모 입력 영역 */}
                {showMemoInput && (
                    <div className="px-3 pb-3 border-t border-gray-100 pt-2 space-y-2">
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">패키지 정보</label>
                            <input
                                type="text"
                                value={packageInfo}
                                onChange={(e) => setPackageInfo(e.target.value)}
                                placeholder="예: 다이어트 패키지 3회차"
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-clinic-primary"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">수납 메모</label>
                            <textarea
                                value={paymentMemo}
                                onChange={(e) => setPaymentMemo(e.target.value)}
                                placeholder="예: 카드 결제 불가로 현금 수납"
                                rows={2}
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-clinic-primary resize-none"
                            />
                        </div>
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => setShowMemoInput(false)}
                                className="px-3 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded"
                            >
                                취소
                            </button>
                            <button
                                onClick={handleMemoSave}
                                disabled={isSaving}
                                className="px-3 py-1 text-xs bg-clinic-primary text-white rounded hover:bg-clinic-primary/90 disabled:opacity-50"
                            >
                                {isSaving ? '저장중...' : '저장'}
                            </button>
                        </div>
                    </div>
                )}
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
  onPatientClick: (payment: Payment) => void;
  onReservationClick: (payment: Payment) => void;
  onMoveToWaiting: (paymentId: number, destination: 'consultation' | 'treatment') => void;
  onDelete: (paymentId: number) => void;
  onMemoSave?: (patientId: number, packageInfo: string, memo: string) => void;
}

const PaymentStatus: React.FC<PaymentStatusProps> = ({
  payments,
  onPatientClick,
  onReservationClick,
  onMoveToWaiting,
  onDelete,
  onMemoSave,
}) => {
  // 수납대기: isPaid가 false인 환자
  const pendingPayments = payments.filter(p => !p.isPaid);
  // 수납완료(예약대기): isPaid가 true이고 예약이 없는 환자
  const paidPayments = payments.filter(p => p.isPaid && !(p.reservationDate && p.reservationTime));

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
      <div className="p-2 h-full overflow-y-auto">
        {/* 수납대기 섹션 */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
              <i className="fa-solid fa-hourglass-half mr-1 text-orange-500"></i>
              수납대기
            </span>
            <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 text-xs font-bold rounded">
              {pendingPayments.length}
            </span>
          </div>
          {pendingPayments.length > 0 ? (
            <div className="space-y-2">
              {pendingPayments.map((payment: Payment) => (
                <PaymentCard
                  key={payment.id}
                  payment={payment}
                  onPatientClick={onPatientClick}
                  onReservationClick={onReservationClick}
                  onMoveToWaiting={onMoveToWaiting}
                  onDelete={onDelete}
                  onMemoSave={onMemoSave}
                />
              ))}
            </div>
          ) : (
            <div className="text-center text-gray-400 text-sm py-3 bg-gray-50 rounded-md">
              수납대기 환자가 없습니다
            </div>
          )}
        </div>

        {/* 수납완료(예약대기) 섹션 */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
              <i className="fa-solid fa-check-circle mr-1 text-green-500"></i>
              수납완료 (예약대기)
            </span>
            <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-xs font-bold rounded">
              {paidPayments.length}
            </span>
          </div>
          {paidPayments.length > 0 ? (
            <div className="space-y-2">
              {paidPayments.map((payment: Payment) => (
                <PaymentCard
                  key={payment.id}
                  payment={{...payment, status: 'paid'}}
                  onPatientClick={onPatientClick}
                  onReservationClick={onReservationClick}
                  onMoveToWaiting={onMoveToWaiting}
                  onDelete={onDelete}
                  onMemoSave={onMemoSave}
                />
              ))}
            </div>
          ) : (
            <div className="text-center text-gray-400 text-sm py-3 bg-gray-50 rounded-md">
              예약대기 환자가 없습니다
            </div>
          )}
        </div>
      </div>
    </Quadrant>
  );
};

export default PaymentStatus;