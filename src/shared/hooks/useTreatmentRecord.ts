/**
 * 진료내역 관리 훅
 * 환자 동선에 따라 자동으로 타임라인 이벤트를 기록
 */

import { useCallback, useRef } from 'react';
import * as treatmentRecordApi from '@shared/api/treatmentRecordApi';
import * as taskApi from '@shared/api/taskApi';
import * as patientCareApi from '@shared/api/patientCareApi';
import type {
  TreatmentRecord,
  TimelineEventType,
  ServiceType,
  VisitType,
} from '@shared/types/treatmentRecord';

// 현재 진행 중인 진료내역 캐시 (patient_id -> treatment_record_id)
const activeRecordsCache = new Map<number, number>();

export function useTreatmentRecord() {
  // 마지막 업데이트 시간 (중복 이벤트 방지)
  const lastEventRef = useRef<Map<string, number>>(new Map());

  /**
   * 중복 이벤트 방지 (같은 이벤트가 2초 이내 연속 발생 시 무시)
   */
  const isDuplicateEvent = useCallback((patientId: number, eventType: TimelineEventType): boolean => {
    const key = `${patientId}-${eventType}`;
    const lastTime = lastEventRef.current.get(key);
    const now = Date.now();

    if (lastTime && now - lastTime < 2000) {
      return true;
    }

    lastEventRef.current.set(key, now);
    return false;
  }, []);

  /**
   * 환자의 오늘 진행 중인 진료내역 ID 가져오기 (없으면 생성)
   */
  const getOrCreateActiveRecord = useCallback(async (
    patientId: number,
    options?: {
      doctorName?: string;
      visitType?: VisitType;
      reservationId?: string;
    }
  ): Promise<number> => {
    // 캐시 확인
    if (activeRecordsCache.has(patientId)) {
      return activeRecordsCache.get(patientId)!;
    }

    // DB에서 진행 중인 진료내역 조회
    const existingRecord = await treatmentRecordApi.fetchActiveRecordForPatient(patientId);

    if (existingRecord) {
      activeRecordsCache.set(patientId, existingRecord.id);
      return existingRecord.id;
    }

    // 없으면 새로 생성 (체크인 이벤트 포함)
    try {
      const newRecord = await treatmentRecordApi.checkInPatient(patientId, options);
      activeRecordsCache.set(patientId, newRecord.id);

      // 환자 내원 기록 업데이트 (치료 상태 테이블)
      try {
        await patientCareApi.recordPatientVisit(patientId);
      } catch (error) {
        console.error('❌ [환자관리] 내원 기록 오류:', error);
      }

      return newRecord.id;
    } catch (error) {
      console.error('❌ [진료내역] 체크인 생성 오류 (무시하고 진행):', error);
      // 에러 발생해도 0을 반환하여 이후 로직이 중단되지 않도록 함
      // 진료내역은 선택적 기록이므로 핵심 기능(베드 배정)은 계속 진행되어야 함
      return 0;
    }
  }, []);

  /**
   * 타임라인 이벤트 기록
   */
  const recordEvent = useCallback(async (
    patientId: number,
    eventType: TimelineEventType,
    options?: {
      location?: string;
      staffName?: string;
      memo?: string;
      // 진료내역 생성 옵션 (check_in 시)
      doctorName?: string;
      visitType?: VisitType;
      reservationId?: string;
    }
  ): Promise<void> => {
    try {
      // 중복 이벤트 방지
      if (isDuplicateEvent(patientId, eventType)) {
        console.log(`[진료내역] 중복 이벤트 무시: ${eventType} (patientId: ${patientId})`);
        return;
      }

      // check_in은 getOrCreateActiveRecord에서 처리됨
      if (eventType === 'check_in') {
        await getOrCreateActiveRecord(patientId, {
          doctorName: options?.doctorName,
          visitType: options?.visitType,
          reservationId: options?.reservationId,
        });
        return;
      }

      // 진료내역 ID 가져오기
      const recordId = await getOrCreateActiveRecord(patientId, {
        doctorName: options?.doctorName,
        visitType: options?.visitType,
      });

      // recordId가 0이면 진료내역 생성 실패 - 이벤트 추가 생략
      if (recordId === 0) {
        console.log(`⚠️ [진료내역] 이벤트 기록 생략 (진료내역 없음): ${eventType} (patientId: ${patientId})`);
        return;
      }

      // 이벤트 추가
      await treatmentRecordApi.addTimelineEvent({
        treatment_record_id: recordId,
        event_type: eventType,
        location: options?.location,
        staff_name: options?.staffName,
        memo: options?.memo,
      });

      console.log(`✅ [진료내역] 이벤트 기록: ${eventType} (patientId: ${patientId}, recordId: ${recordId})`);

      // check_out 시 캐시 제거 및 진료내역 완료 처리
      if (eventType === 'check_out') {
        await treatmentRecordApi.completeTreatmentRecord(recordId);
        activeRecordsCache.delete(patientId);
        console.log(`✅ [진료내역] 진료 완료 처리 (patientId: ${patientId})`);
      }
    } catch (error) {
      console.error(`❌ [진료내역] 이벤트 기록 오류:`, error);
    }
  }, [isDuplicateEvent, getOrCreateActiveRecord]);

  /**
   * 환자 체크인 (내원)
   */
  const checkIn = useCallback(async (
    patientId: number,
    options?: {
      doctorName?: string;
      visitType?: VisitType;
      reservationId?: string;
    }
  ) => {
    await recordEvent(patientId, 'check_in', options);
  }, [recordEvent]);

  /**
   * 진료 대기 시작
   */
  const startWaitingConsultation = useCallback(async (patientId: number) => {
    await recordEvent(patientId, 'waiting_consultation');
  }, [recordEvent]);

  /**
   * 진료 시작
   */
  const startConsultation = useCallback(async (
    patientId: number,
    options?: { location?: string; staffName?: string }
  ) => {
    await recordEvent(patientId, 'consultation_start', options);
  }, [recordEvent]);

  /**
   * 진료 종료
   */
  const endConsultation = useCallback(async (patientId: number) => {
    await recordEvent(patientId, 'consultation_end');
  }, [recordEvent]);

  /**
   * 치료 대기 시작
   */
  const startWaitingTreatment = useCallback(async (patientId: number) => {
    await recordEvent(patientId, 'waiting_treatment');
  }, [recordEvent]);

  /**
   * 치료 시작
   */
  const startTreatment = useCallback(async (
    patientId: number,
    options?: { location?: string; staffName?: string }
  ) => {
    await recordEvent(patientId, 'treatment_start', options);
  }, [recordEvent]);

  /**
   * 치료 종료
   */
  const endTreatment = useCallback(async (patientId: number) => {
    await recordEvent(patientId, 'treatment_end');
  }, [recordEvent]);

  /**
   * 수납 대기 시작
   */
  const startWaitingPayment = useCallback(async (patientId: number) => {
    await recordEvent(patientId, 'waiting_payment');
  }, [recordEvent]);

  /**
   * 수납 완료
   */
  const completePayment = useCallback(async (patientId: number, paymentId?: number) => {
    await recordEvent(patientId, 'payment_complete');

    // 수납 ID 연결
    if (paymentId) {
      const recordId = activeRecordsCache.get(patientId);
      if (recordId) {
        await treatmentRecordApi.updateTreatmentRecord(recordId, { payment_id: paymentId });
      }
    }
  }, [recordEvent]);

  /**
   * 환자 퇴원 (체크아웃)
   */
  const checkOut = useCallback(async (patientId: number) => {
    await recordEvent(patientId, 'check_out');
  }, [recordEvent]);

  /**
   * 서비스 추가 (진료내역에 받은 서비스 기록 + 자동 할일 생성)
   */
  const addService = useCallback(async (
    patientId: number,
    service: ServiceType,
    options?: {
      patientName?: string;
      assignedTo?: string;
      createTasks?: boolean;  // 기본값 true
      createCareItems?: boolean;  // 환자관리 항목 생성 (기본값 true)
      deliveryDate?: string;  // 한약 배송일 (한약인 경우)
    }
  ) => {
    const recordId = activeRecordsCache.get(patientId);
    if (!recordId) return;

    try {
      const record = await treatmentRecordApi.fetchTreatmentRecordById(recordId);
      if (record) {
        // 진료내역에 서비스 추가
        const updatedServices = [...new Set([...record.services, service])];
        await treatmentRecordApi.updateTreatmentRecord(recordId, { services: updatedServices });

        const patientName = options?.patientName || record.patient_name || '환자';

        // 자동 할일 생성 (기본 활성화)
        if (options?.createTasks !== false) {
          await taskApi.createTasksFromService(patientId, patientName, service, {
            treatmentRecordId: recordId,
            assignedTo: options?.assignedTo,
          });
        }

        // 환자관리 항목 자동 생성 (한약 배송 해피콜 등)
        if (options?.createCareItems !== false && service === 'herbal_medicine' && options?.deliveryDate) {
          try {
            // 배송 해피콜 (배송 다음날)
            await patientCareApi.createDeliveryHappyCall(
              patientId,
              patientName,
              options.deliveryDate,
              recordId
            );
            // 복약 해피콜 (7일차)
            await patientCareApi.createMedicationHappyCall(
              patientId,
              patientName,
              options.deliveryDate,
              recordId
            );
            console.log(`✅ [환자관리] 한약 해피콜 생성 (patientId: ${patientId})`);
          } catch (error) {
            console.error('❌ [환자관리] 해피콜 생성 오류:', error);
          }
        }
      }
    } catch (error) {
      console.error('❌ [진료내역] 서비스 추가 오류:', error);
    }
  }, []);

  /**
   * 치료 항목 업데이트
   */
  const updateTreatmentItems = useCallback(async (
    patientId: number,
    items: { name: string; duration: number }[]
  ) => {
    const recordId = activeRecordsCache.get(patientId);
    if (!recordId) return;

    try {
      await treatmentRecordApi.updateTreatmentRecord(recordId, { treatment_items: items });
    } catch (error) {
      console.error('❌ [진료내역] 치료 항목 업데이트 오류:', error);
    }
  }, []);

  return {
    // 개별 이벤트 기록
    checkIn,
    startWaitingConsultation,
    startConsultation,
    endConsultation,
    startWaitingTreatment,
    startTreatment,
    endTreatment,
    startWaitingPayment,
    completePayment,
    checkOut,

    // 추가 기능
    addService,
    updateTreatmentItems,
    recordEvent,
    getOrCreateActiveRecord,
  };
}
