/**
 * 환자관리 훅
 * 진료내역과 연동하여 자동으로 환자관리 항목 생성
 */

import { useCallback } from 'react';
import * as patientCareApi from '@shared/api/patientCareApi';
import { getCurrentDate } from '@shared/lib/postgres';
import type { ServiceType } from '@shared/types/treatmentRecord';

export function usePatientCare() {
  /**
   * 환자 내원 시 치료 상태 업데이트
   */
  const recordVisit = useCallback(async (patientId: number): Promise<void> => {
    try {
      await patientCareApi.recordPatientVisit(patientId);
      console.log(`✅ [환자관리] 내원 기록 업데이트 (patientId: ${patientId})`);
    } catch (error) {
      console.error('❌ [환자관리] 내원 기록 오류:', error);
    }
  }, []);

  /**
   * 한약 배송 시 해피콜 항목 자동 생성
   */
  const onHerbalDelivery = useCallback(async (
    patientId: number,
    patientName: string,
    deliveryDate: string,
    treatmentRecordId?: number
  ): Promise<void> => {
    try {
      // 배송 해피콜 생성
      await patientCareApi.createDeliveryHappyCall(
        patientId,
        patientName,
        deliveryDate,
        treatmentRecordId
      );
      console.log(`✅ [환자관리] 배송 해피콜 생성 (patientId: ${patientId})`);

      // 복약 해피콜도 생성 (7일차)
      await patientCareApi.createMedicationHappyCall(
        patientId,
        patientName,
        deliveryDate,
        treatmentRecordId
      );
      console.log(`✅ [환자관리] 복약 해피콜 생성 (patientId: ${patientId})`);
    } catch (error) {
      console.error('❌ [환자관리] 한약 배송 처리 오류:', error);
    }
  }, []);

  /**
   * 서비스 기반 환자관리 항목 자동 생성
   */
  const onServiceProvided = useCallback(async (
    patientId: number,
    patientName: string,
    service: ServiceType,
    options?: {
      treatmentRecordId?: number;
      deliveryDate?: string; // 배송 예정일 (한약인 경우)
    }
  ): Promise<void> => {
    try {
      // 서비스별 트리거 이벤트 매핑
      let triggerEvent: string | null = null;

      switch (service) {
        case 'herbal_medicine':
          // 한약 서비스는 배송일 기준으로 해피콜 생성
          if (options?.deliveryDate) {
            await onHerbalDelivery(patientId, patientName, options.deliveryDate, options.treatmentRecordId);
          }
          return;

        case 'acupuncture':
        case 'moxibustion':
        case 'cupping':
        case 'physical_therapy':
          // 치료 서비스 완료 후 follow-up (10회차 체크는 별도 로직)
          // 트리거 생성 안함 (규칙 기반으로 처리)
          break;

        case 'consultation':
          // 상담 후 follow-up 필요할 수 있음
          triggerEvent = 'consultation_complete';
          break;

        default:
          break;
      }

      // 트리거 이벤트가 있으면 규칙 기반 자동 생성
      if (triggerEvent) {
        await patientCareApi.createCareItemsFromTrigger(
          patientId,
          patientName,
          triggerEvent,
          { treatmentRecordId: options?.treatmentRecordId }
        );
      }
    } catch (error) {
      console.error('❌ [환자관리] 서비스 처리 오류:', error);
    }
  }, [onHerbalDelivery]);

  /**
   * 내원 횟수 기반 관리 항목 체크 (10회 종결 상담 등)
   */
  const checkVisitMilestone = useCallback(async (
    patientId: number,
    patientName: string,
    visitCount: number,
    treatmentRecordId?: number
  ): Promise<void> => {
    try {
      // 10회차 도달 시 종결 상담 생성
      if (visitCount === 10) {
        await patientCareApi.createCareItemsFromTrigger(
          patientId,
          patientName,
          'visit_count_10',
          { treatmentRecordId }
        );
        console.log(`✅ [환자관리] 10회차 종결 상담 생성 (patientId: ${patientId})`);
      }
    } catch (error) {
      console.error('❌ [환자관리] 마일스톤 체크 오류:', error);
    }
  }, []);

  /**
   * 예약 리마인더 생성 (예약일 전날)
   */
  const createReservationReminder = useCallback(async (
    patientId: number,
    patientName: string,
    reservationDate: string
  ): Promise<void> => {
    try {
      // 예약 전날에 리마인더 생성
      const reminderDate = new Date(reservationDate);
      reminderDate.setDate(reminderDate.getDate() - 1);

      await patientCareApi.createPatientCareItem({
        patient_id: patientId,
        care_type: 'reservation_reminder',
        title: `${patientName} 예약 리마인더`,
        description: `내일(${reservationDate}) 예약이 있습니다. 확인 전화를 해주세요.`,
        scheduled_date: `${reminderDate.getFullYear()}-${String(reminderDate.getMonth() + 1).padStart(2, '0')}-${String(reminderDate.getDate()).padStart(2, '0')}`,
        trigger_type: 'auto',
        trigger_source: 'reservation_d_minus_1',
      });
      console.log(`✅ [환자관리] 예약 리마인더 생성 (patientId: ${patientId})`);
    } catch (error) {
      console.error('❌ [환자관리] 예약 리마인더 생성 오류:', error);
    }
  }, []);

  /**
   * 수동 환자관리 항목 생성
   */
  const createManualCareItem = useCallback(async (
    patientId: number,
    title: string,
    options?: {
      description?: string;
      scheduledDate?: string;
      careType?: 'custom' | 'treatment_followup' | 'periodic_message';
    }
  ): Promise<void> => {
    try {
      await patientCareApi.createPatientCareItem({
        patient_id: patientId,
        care_type: options?.careType || 'custom',
        title,
        description: options?.description,
        scheduled_date: options?.scheduledDate,
        trigger_type: 'manual',
      });
      console.log(`✅ [환자관리] 수동 항목 생성 (patientId: ${patientId})`);
    } catch (error) {
      console.error('❌ [환자관리] 수동 항목 생성 오류:', error);
    }
  }, []);

  /**
   * 치료 종결 처리
   */
  const closeTreatment = useCallback(async (
    patientId: number,
    closureType: 'natural' | 'planned' | 'patient_request' | 'lost_contact',
    reason?: string
  ): Promise<void> => {
    try {
      await patientCareApi.closeTreatment(patientId, closureType, reason);
      console.log(`✅ [환자관리] 치료 종결 (patientId: ${patientId}, type: ${closureType})`);
    } catch (error) {
      console.error('❌ [환자관리] 치료 종결 오류:', error);
    }
  }, []);

  /**
   * 치료 재개
   */
  const resumeTreatment = useCallback(async (patientId: number): Promise<void> => {
    try {
      await patientCareApi.resumeTreatment(patientId);
      console.log(`✅ [환자관리] 치료 재개 (patientId: ${patientId})`);
    } catch (error) {
      console.error('❌ [환자관리] 치료 재개 오류:', error);
    }
  }, []);

  return {
    // 자동 트리거
    recordVisit,
    onHerbalDelivery,
    onServiceProvided,
    checkVisitMilestone,
    createReservationReminder,

    // 수동 작업
    createManualCareItem,
    closeTreatment,
    resumeTreatment,
  };
}
