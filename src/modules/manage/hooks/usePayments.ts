import { useState, useEffect, useCallback } from 'react';
import { Payment, CompletedPayment, PaymentMethod, TreatmentDetailItem, Patient } from '../types';
import * as api from '../lib/api';

type PaymentItem = { id: number; method: PaymentMethod; amount: string; };

export const usePayments = (currentUser: any) => {
  const [paymentsWaiting, setPaymentsWaiting] = useState<Payment[]>([]);
  const [completedPayments, setCompletedPayments] = useState<CompletedPayment[]>([]);

  // 초기 결제 데이터 로드
  useEffect(() => {
    if (!currentUser) return;

    const loadPaymentData = async () => {
      try {
        const pendingPayments = await api.fetchPendingPayments();
        setPaymentsWaiting(pendingPayments);

        const completed = await api.fetchCompletedPayments();
        setCompletedPayments(completed);
      } catch (error) {
        console.error('❌ 결제 데이터 로드 오류 (Supabase):', error);
        // 테이블이 없을 수 있으므로 alert 비활성화
        // alert('결제 데이터를 불러오는 중 오류가 발생했습니다.');
      }
    };

    loadPaymentData();
  }, [currentUser]);

  // 결제 데이터 폴링 (5초마다)
  const loadPaymentData = useCallback(async () => {
    try {
      const pendingPayments = await api.fetchPendingPayments();
      setPaymentsWaiting(pendingPayments);

      const completed = await api.fetchCompletedPayments();
      setCompletedPayments(completed);
    } catch (error) {
      console.error('❌ 결제 데이터 로드 오류:', error);
    }
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    const POLLING_INTERVAL = 5000;
    const intervalId = setInterval(loadPaymentData, POLLING_INTERVAL);

    return () => {
      clearInterval(intervalId);
    };
  }, [currentUser, loadPaymentData]);

  const createPayment = async (patient: Patient, details: string = '진료비') => {
    try {
      const newPayment: Payment = {
        id: 0,
        patientId: patient.id,
        patientName: patient.name,
        patientChartNumber: patient.chartNumber,
        details,
        isPaid: false,
      };

      const paymentId = await api.createPayment(newPayment);
      setPaymentsWaiting(prev => [...prev, { ...newPayment, id: paymentId }]);
      return paymentId;
    } catch (error) {
      console.error('❌ 결제 생성 오류:', error);
      alert('수납 대기 추가 중 오류가 발생했습니다.');
      throw error;
    }
  };

  const handleCompletePayment = async (
    originalPayment: Payment,
    details: {
      totalAmount: number;
      items: PaymentItem[];
      remainingAmount: number;
      treatmentItems: TreatmentDetailItem[];
    }
  ) => {
    try {
      await api.completePayment(originalPayment.id, {
        totalAmount: details.totalAmount,
        paidAmount: details.totalAmount - details.remainingAmount,
        remainingAmount: details.remainingAmount,
        paymentMethods: details.items.map(item => ({
          method: item.method,
          amount: parseInt(item.amount, 10) || 0,
        })),
        treatmentItems: details.treatmentItems,
      });

      setPaymentsWaiting(prev => prev.filter(p => p.id !== originalPayment.id));

      const newCompletedPayment: CompletedPayment = {
        id: Date.now(),
        paymentId: originalPayment.id,
        patientId: originalPayment.patientId,
        patientName: originalPayment.patientName,
        patientChartNumber: originalPayment.patientChartNumber,
        treatmentItems: details.treatmentItems,
        totalAmount: details.totalAmount,
        paidAmount: details.totalAmount - details.remainingAmount,
        remainingAmount: details.remainingAmount,
        paymentMethods: details.items.map(item => ({
          method: item.method,
          amount: parseInt(item.amount, 10) || 0,
        })),
        timestamp: new Date().toISOString(),
      };

      setCompletedPayments(prev => [newCompletedPayment, ...prev]);

      const alertMessage = details.remainingAmount > 0
        ? `수납 처리가 완료되었습니다. 미수금: ${details.remainingAmount.toLocaleString()}원`
        : '수납 처리가 완료되었습니다.';
      alert(alertMessage);
    } catch (error) {
      console.error('❌ 결제 완료 처리 오류:', error);
      alert('결제 처리 중 오류가 발생했습니다.');
      throw error;
    }
  };

  const updatePaymentReservationInfo = (reservationId: string, reservationDate: string, reservationTime: string, patientId: number) => {
    setPaymentsWaiting(prevPayments =>
      prevPayments.map(p =>
        p.patientId === patientId
          ? { ...p, reservationId, reservationDate, reservationTime }
          : p
      )
    );
  };

  const removePaymentReservationInfo = (reservationId: string) => {
    setPaymentsWaiting(prevPayments =>
      prevPayments.map(p => {
        if (p.reservationId === reservationId) {
          const { reservationId, reservationDate, reservationTime, ...rest } = p;
          return rest;
        }
        return p;
      })
    );
  };

  const movePatientFromPaymentToWaiting = (paymentId: number) => {
    const paymentToMove = paymentsWaiting.find(p => p.id === paymentId);
    if (paymentToMove) {
      setPaymentsWaiting(prev => prev.filter(p => p.id !== paymentId));
      return paymentToMove;
    }
    return null;
  };

  const deletePaymentFromWaiting = async (paymentId: number) => {
    try {
      // 로컬 상태 먼저 업데이트 (낙관적 업데이트)
      setPaymentsWaiting(prev => prev.filter(p => p.id !== paymentId));

      // DB에서 삭제
      await api.deletePayment(paymentId);
      console.log(`✅ 수납 대기 항목 삭제 완료 (id: ${paymentId})`);
    } catch (error) {
      console.error('❌ 수납 대기 삭제 오류:', error);
      alert('수납 대기 삭제 중 오류가 발생했습니다.');
      // 실패 시 데이터 다시 로드
      const pendingPayments = await api.fetchPendingPayments();
      setPaymentsWaiting(pendingPayments);
    }
  };

  return {
    paymentsWaiting,
    setPaymentsWaiting,
    completedPayments,
    createPayment,
    handleCompletePayment,
    updatePaymentReservationInfo,
    removePaymentReservationInfo,
    movePatientFromPaymentToWaiting,
    deletePaymentFromWaiting,
  };
};
