import { useState, useEffect, useCallback } from 'react';
import type { LocalPatient, MssqlPatient } from '../lib/patientSync';
import type { ContactLog, CallQueueItem, PackageStatusSummary } from '../types/crm';
import type { Reservation } from '../../reservation/types';
import type { ReceiptHistoryItem, PatientReceiptHistoryResponse } from '../../manage/lib/api';
import { searchPatientsOnly } from '../lib/patientSync';
import { getContactLogsByPatient } from '../lib/contactLogApi';
import { getCallQueueByPatient } from '../lib/callQueueApi';
import { getPatientPackageStatusByChartNumber } from '../lib/patientCrmApi';
import { fetchPatientReservations } from '../../reservation/lib/api';
import { fetchPatientReceiptHistory } from '../../manage/lib/api';
import { getHerbalDrafts, getMedicineUsages } from '../lib/api';
import type { HerbalDraft, MedicineUsage } from '../types';

export interface PatientDashboardData {
  mssqlData: MssqlPatient | null;
  receipts: ReceiptHistoryItem[];
  receiptSummary: PatientReceiptHistoryResponse['summary'] | null;
  reservations: Reservation[];
  contactLogs: ContactLog[];
  callQueue: CallQueueItem[];
  packages: PackageStatusSummary | null;
  herbalDrafts: HerbalDraft[];
  medicineUsages: MedicineUsage[];
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

export function usePatientDashboard(patient: LocalPatient): PatientDashboardData {
  const [mssqlData, setMssqlData] = useState<MssqlPatient | null>(null);
  const [receipts, setReceipts] = useState<ReceiptHistoryItem[]>([]);
  const [receiptSummary, setReceiptSummary] = useState<PatientReceiptHistoryResponse['summary'] | null>(null);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [contactLogs, setContactLogs] = useState<ContactLog[]>([]);
  const [callQueue, setCallQueue] = useState<CallQueueItem[]>([]);
  const [packages, setPackages] = useState<PackageStatusSummary | null>(null);
  const [herbalDrafts, setHerbalDrafts] = useState<HerbalDraft[]>([]);
  const [medicineUsages, setMedicineUsages] = useState<MedicineUsage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const results = await Promise.allSettled([
        // MSSQL 환자 상세 (검색 API로 메모 포함 조회)
        patient.chart_number
          ? searchPatientsOnly(patient.chart_number).then(results => {
              const match = patient.mssql_id
                ? results.find(p => p.id === patient.mssql_id)
                : results[0];
              return match || null;
            })
          : Promise.resolve(null),
        // 수납 이력
        patient.mssql_id
          ? fetchPatientReceiptHistory({ patientId: patient.mssql_id, limit: 9999 })
          : Promise.resolve(null),
        // 예약 목록 (서버 엔드포인트 미구현 시 빈 배열 반환)
        patient.mssql_id
          ? fetchPatientReservations(patient.mssql_id).catch(() => [] as Reservation[])
          : Promise.resolve([] as Reservation[]),
        // 인콜/응대 기록
        getContactLogsByPatient(patient.id, 20),
        // 아웃콜 대기열
        getCallQueueByPatient(patient.id, 20),
        // 패키지 현황 (patient_id 불일치 방지를 위해 chart_number로 조회)
        patient.chart_number
          ? getPatientPackageStatusByChartNumber(patient.chart_number)
          : Promise.resolve(null),
        // 한약 기록
        getHerbalDrafts(patient.id).catch(() => [] as HerbalDraft[]),
        // 상비약 기록
        patient.mssql_id
          ? getMedicineUsages(patient.mssql_id).catch(() => [] as MedicineUsage[])
          : Promise.resolve([] as MedicineUsage[]),
      ]);

      // MSSQL 환자 데이터
      if (results[0].status === 'fulfilled' && results[0].value) {
        setMssqlData(results[0].value as MssqlPatient);
      }

      // 수납 이력
      if (results[1].status === 'fulfilled' && results[1].value) {
        const receiptData = results[1].value as PatientReceiptHistoryResponse;
        setReceipts(receiptData.receipts);
        setReceiptSummary(receiptData.summary);
      }

      // 예약
      if (results[2].status === 'fulfilled') {
        setReservations(results[2].value as Reservation[]);
      }

      // 응대 기록
      if (results[3].status === 'fulfilled') {
        setContactLogs(results[3].value as ContactLog[]);
      }

      // 아웃콜
      if (results[4].status === 'fulfilled') {
        setCallQueue(results[4].value as CallQueueItem[]);
      }

      // 패키지
      if (results[5].status === 'fulfilled') {
        setPackages(results[5].value as PackageStatusSummary);
      }

      // 한약 기록
      if (results[6].status === 'fulfilled') {
        setHerbalDrafts(results[6].value as HerbalDraft[]);
      }
      // 상비약 기록
      if (results[7].status === 'fulfilled') {
        setMedicineUsages(results[7].value as MedicineUsage[]);
      }

      // 실패한 항목 확인
      const failures = results.filter(r => r.status === 'rejected');
      if (failures.length > 0) {
        console.warn('일부 데이터 로드 실패:', failures);
      }
    } catch (err) {
      console.error('대시보드 데이터 로드 실패:', err);
      setError('데이터를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [patient.id, patient.mssql_id, patient.chart_number]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  return {
    mssqlData,
    receipts,
    receiptSummary,
    reservations,
    contactLogs,
    callQueue,
    packages,
    herbalDrafts,
    medicineUsages,
    isLoading,
    error,
    refresh: loadAll,
  };
}
