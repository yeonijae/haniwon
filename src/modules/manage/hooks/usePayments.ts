import { useState, useEffect } from 'react';
import { Payment, CompletedPayment, PaymentMethod, TreatmentDetailItem, Patient } from '../types';
import * as api from '../lib/api';
import { supabase } from '@shared/lib/supabase';

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

        const completed = await api.fetchCompletedPayments(100);
        const formattedCompleted = completed.map(payment => ({
          paymentId: payment.id,
          patientId: payment.patientId,
          patientName: payment.patientName,
          patientChartNumber: payment.patientChartNumber,
          totalAmount: payment.totalAmount || 0,
          paidAmount: payment.paidAmount || 0,
          remainingAmount: payment.remainingAmount || 0,
          details: payment.details || '진료비',
          paymentMethods: payment.paymentMethods || [],
          completedDate: payment.completedAt ? new Date(payment.completedAt).toLocaleDateString('ko-KR') : '',
          treatmentItems: payment.treatmentItems || []
        }));
        setCompletedPayments(formattedCompleted);
      } catch (error) {
        console.error('❌ 결제 데이터 로드 오류 (Supabase):', error);
        // 테이블이 없을 수 있으므로 alert 비활성화
        // alert('결제 데이터를 불러오는 중 오류가 발생했습니다.');
      }
    };

    loadPaymentData();
  }, [currentUser]);

  // 실시간 구독
  useEffect(() => {
    if (!currentUser) return;

    const paymentsSubscription = supabase
      .channel('payments-changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'payments' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newPayment = payload.new as any;
            if (!newPayment.isPaid) {
              setPaymentsWaiting(prev => [...prev, newPayment]);
            }
          } else if (payload.eventType === 'UPDATE') {
            const updatedPayment = payload.new as any;

            if (updatedPayment.isPaid) {
              setPaymentsWaiting(prev => prev.filter(p => p.id !== updatedPayment.id));

              const formattedCompleted = {
                paymentId: updatedPayment.id,
                patientId: updatedPayment.patientId,
                patientName: updatedPayment.patientName,
                patientChartNumber: updatedPayment.patientChartNumber,
                totalAmount: updatedPayment.totalAmount || 0,
                paidAmount: updatedPayment.paidAmount || 0,
                remainingAmount: updatedPayment.remainingAmount || 0,
                details: updatedPayment.details || '진료비',
                paymentMethods: updatedPayment.paymentMethods || [],
                completedDate: updatedPayment.completedAt ? new Date(updatedPayment.completedAt).toLocaleDateString('ko-KR') : '',
                treatmentItems: updatedPayment.treatmentItems || []
              };
              setCompletedPayments(prev => [formattedCompleted, ...prev]);
            } else {
              setPaymentsWaiting(prev => prev.map(p =>
                p.id === updatedPayment.id ? updatedPayment : p
              ));
            }
          } else if (payload.eventType === 'DELETE') {
            const deletedId = payload.old.id;
            setPaymentsWaiting(prev => prev.filter(p => p.id !== deletedId));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(paymentsSubscription);
    };
  }, [currentUser]);

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
