import { useState, useEffect, useCallback } from 'react';
import { Payment, CompletedPayment, PaymentMethod, TreatmentDetailItem, Patient } from '../types';
import * as api from '../lib/api';

type PaymentItem = { id: number; method: PaymentMethod; amount: string; };

export const usePayments = (currentUser: any) => {
  const [paymentsWaiting, setPaymentsWaiting] = useState<Payment[]>([]);
  const [completedPayments, setCompletedPayments] = useState<CompletedPayment[]>([]);

  // MSSQL 수납대기 환자를 Payment 객체로 변환
  const convertMssqlToPayment = useCallback(async (mssqlPayment: api.MssqlPendingPayment): Promise<Payment> => {
    // PostgreSQL 메모 조회
    let memo: api.PaymentMemo | null = null;
    try {
      memo = await api.fetchPaymentMemo(mssqlPayment.patient_id);
    } catch (error) {
      // 메모가 없을 수 있음
    }

    // 치료 항목을 details 문자열로 변환
    const treatmentParts: string[] = [];
    if (mssqlPayment.treatments.acupuncture) treatmentParts.push('침');
    if (mssqlPayment.treatments.choona) treatmentParts.push('추나');
    if (mssqlPayment.treatments.yakchim) treatmentParts.push('약침');
    if (mssqlPayment.treatments.uncovered.length > 0) {
      treatmentParts.push(...mssqlPayment.treatments.uncovered.map(u => u.name));
    }

    return {
      id: mssqlPayment.id,  // MSSQL Receipt_PK
      patientId: mssqlPayment.patient_id,
      patientName: mssqlPayment.patient_name,
      patientChartNumber: mssqlPayment.chart_no,
      details: treatmentParts.join(', ') || '진료비',
      isPaid: mssqlPayment.unpaid === 0,  // unpaid가 0이면 완납
      status: mssqlPayment.unpaid === null ? 'pending' : (mssqlPayment.unpaid === 0 ? 'paid' : 'pending'),
      // MSSQL 수납 정보
      mssqlReceiptId: mssqlPayment.id,
      insuranceSelf: parseFloat(String(mssqlPayment.insurance_self)) || 0,
      insuranceClaim: parseFloat(String(mssqlPayment.insurance_claim)) || 0,
      generalAmount: parseFloat(String(mssqlPayment.general_amount)) || 0,
      unpaidAmount: mssqlPayment.unpaid !== null ? parseFloat(String(mssqlPayment.unpaid)) : undefined,
      insuranceType: mssqlPayment.insurance_type,
      // PostgreSQL 메모
      packageInfo: memo?.package_info,
      paymentMemo: memo?.memo,
    };
  }, []);

  // 수납대기 환자 로드 (MSSQL API 사용)
  const loadPaymentData = useCallback(async () => {
    try {
      // MSSQL에서 치료실에 있는 수납대기 환자 조회
      const mssqlPending = await api.fetchMssqlPendingPayments();

      // Payment 객체로 변환
      const newPayments: Payment[] = [];
      for (const p of mssqlPending) {
        const payment = await convertMssqlToPayment(p);
        newPayments.push(payment);
      }

      // 기존 수납완료(isPaid=true) 환자는 유지하면서 새 데이터와 병합
      setPaymentsWaiting(prev => {
        // 기존 수납완료 환자 중 예약이 없는 환자 유지
        const paidWithoutReservation = prev.filter(p =>
          p.isPaid && !(p.reservationDate && p.reservationTime)
        );

        // 새 MSSQL 데이터에서 이미 수납완료된 환자 ID 확인
        const newPaymentIds = new Set(newPayments.map(p => p.patientId));

        // 수납완료 환자 중 새 데이터에 없는 환자만 유지 (중복 방지)
        const paidToKeep = paidWithoutReservation.filter(p => !newPaymentIds.has(p.patientId));

        // 새 데이터와 유지할 수납완료 환자 병합
        return [...newPayments, ...paidToKeep];
      });

      // 완료된 결제는 PostgreSQL에서 조회
      const completed = await api.fetchCompletedPayments();
      setCompletedPayments(completed);
    } catch (error) {
      console.error('❌ 결제 데이터 로드 오류:', error);
    }
  }, [convertMssqlToPayment]);

  // 초기 결제 데이터 로드
  useEffect(() => {
    if (!currentUser) return;
    loadPaymentData();
  }, [currentUser, loadPaymentData]);

  useEffect(() => {
    if (!currentUser) return;

    const POLLING_INTERVAL = 2000;
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
        status: 'pending',
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

  // 수납 처리 (isPaid = true로 변경, 목록에서 제거하지 않음)
  const handleMarkPaid = useCallback((paymentId: number) => {
    setPaymentsWaiting(prev =>
      prev.map(p =>
        p.id === paymentId
          ? { ...p, isPaid: true, paidAt: new Date().toISOString() }
          : p
      )
    );
    console.log(`✅ 수납 완료 처리 (paymentId: ${paymentId})`);
  }, []);

  // 수납완료 + 예약완료 → 목록에서 제거
  const checkAndCompletePayment = useCallback(async (paymentId: number) => {
    const payment = paymentsWaiting.find(p => p.id === paymentId);
    if (!payment) return;

    // 수납완료 + 예약있음 → 완전 완료 처리
    if (payment.isPaid && payment.reservationDate && payment.reservationTime) {
      try {
        // DB에서 완료 처리
        await api.completePayment(paymentId, {
          totalAmount: (payment.insuranceSelf || 0) + (payment.generalAmount || 0),
          paidAmount: (payment.insuranceSelf || 0) + (payment.generalAmount || 0),
          remainingAmount: payment.unpaidAmount || 0,
          paymentMethods: [],
          treatmentItems: [],
        });

        // 목록에서 제거
        setPaymentsWaiting(prev => prev.filter(p => p.id !== paymentId));

        const newCompletedPayment: CompletedPayment = {
          id: Date.now(),
          paymentId: payment.id,
          patientId: payment.patientId,
          patientName: payment.patientName,
          patientChartNumber: payment.patientChartNumber,
          treatmentItems: [],
          totalAmount: (payment.insuranceSelf || 0) + (payment.generalAmount || 0),
          paidAmount: (payment.insuranceSelf || 0) + (payment.generalAmount || 0),
          remainingAmount: payment.unpaidAmount || 0,
          paymentMethods: [],
          timestamp: new Date().toISOString(),
        };

        setCompletedPayments(prev => [newCompletedPayment, ...prev]);
        console.log(`✅ 수납+예약 완료 → 목록에서 제거 (${payment.patientName})`);
      } catch (error) {
        console.error('❌ 완료 처리 오류:', error);
      }
    }
  }, [paymentsWaiting]);

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
      // 예약이 있으면 바로 완료 처리 (목록에서 제거)
      if (originalPayment.reservationDate && originalPayment.reservationTime) {
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
      } else {
        // 예약이 없으면 수납만 완료 (isPaid = true, 목록에 유지)
        setPaymentsWaiting(prev =>
          prev.map(p =>
            p.id === originalPayment.id
              ? { ...p, isPaid: true, paidAt: new Date().toISOString() }
              : p
          )
        );
        alert('수납 완료! 예약을 진행해주세요.');
      }
    } catch (error) {
      console.error('❌ 결제 완료 처리 오류:', error);
      alert('결제 처리 중 오류가 발생했습니다.');
      throw error;
    }
  };

  const updatePaymentReservationInfo = useCallback(async (reservationId: string, reservationDate: string, reservationTime: string, patientId: number) => {
    // 먼저 예약 정보 업데이트
    setPaymentsWaiting(prevPayments =>
      prevPayments.map(p =>
        p.patientId === patientId
          ? { ...p, reservationId, reservationDate, reservationTime }
          : p
      )
    );

    // 해당 payment가 이미 수납 완료 상태인지 확인
    const payment = paymentsWaiting.find(p => p.patientId === patientId);
    if (payment?.isPaid) {
      // 수납완료 + 예약완료 → 자동으로 목록에서 제거
      setTimeout(async () => {
        try {
          await api.completePayment(payment.id, {
            totalAmount: (payment.insuranceSelf || 0) + (payment.generalAmount || 0),
            paidAmount: (payment.insuranceSelf || 0) + (payment.generalAmount || 0),
            remainingAmount: payment.unpaidAmount || 0,
            paymentMethods: [],
            treatmentItems: [],
          });

          setPaymentsWaiting(prev => prev.filter(p => p.id !== payment.id));

          const newCompletedPayment: CompletedPayment = {
            id: Date.now(),
            paymentId: payment.id,
            patientId: payment.patientId,
            patientName: payment.patientName,
            patientChartNumber: payment.patientChartNumber,
            treatmentItems: [],
            totalAmount: (payment.insuranceSelf || 0) + (payment.generalAmount || 0),
            paidAmount: (payment.insuranceSelf || 0) + (payment.generalAmount || 0),
            remainingAmount: payment.unpaidAmount || 0,
            paymentMethods: [],
            timestamp: new Date().toISOString(),
          };

          setCompletedPayments(prev => [newCompletedPayment, ...prev]);
          console.log(`✅ 수납+예약 완료 → 자동 제거 (${payment.patientName})`);
        } catch (error) {
          console.error('❌ 자동 완료 처리 오류:', error);
        }
      }, 500); // 짧은 지연으로 상태 업데이트 후 처리
    }
  }, [paymentsWaiting]);

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

  // 메모 저장 핸들러 (로컬 상태 업데이트)
  const handleMemoSave = useCallback((patientId: number, packageInfo: string, memo: string) => {
    setPaymentsWaiting(prev =>
      prev.map(p =>
        p.patientId === patientId
          ? { ...p, packageInfo, paymentMemo: memo }
          : p
      )
    );
    console.log(`✅ 수납 메모 저장 완료 (patientId: ${patientId})`);
  }, []);

  return {
    paymentsWaiting,
    setPaymentsWaiting,
    completedPayments,
    createPayment,
    handleCompletePayment,
    handleMarkPaid,
    checkAndCompletePayment,
    updatePaymentReservationInfo,
    removePaymentReservationInfo,
    movePatientFromPaymentToWaiting,
    deletePaymentFromWaiting,
    handleMemoSave,
  };
};
