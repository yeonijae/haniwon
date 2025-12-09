/**
 * 액팅 관리 API
 */

import { query, queryOne, execute, insert, escapeString, getCurrentDate, getCurrentTimestamp, toSqlValue } from '@shared/lib/sqlite';

// MSSQL API 서버 URL
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://192.168.0.173:3100';

import type {
  ActingType,
  ActingQueueItem,
  DoctorStatus,
  DoctorStatusType,
  ActingRecord,
  DoctorActingStats,
  DailyActingStats,
  AddActingRequest,
  DoctorQueueGroup,
} from './types';

// DB 응답을 타입으로 변환하는 헬퍼
const mapQueueItem = (row: any): ActingQueueItem => ({
  id: row.id,
  patientId: row.patient_id,
  patientName: row.patient_name,
  chartNo: row.chart_no || '',
  doctorId: row.doctor_id,
  doctorName: row.doctor_name,
  actingType: row.acting_type,
  orderNum: row.order_num,
  status: row.status,
  source: row.source,
  sourceId: row.source_id,
  memo: row.memo,
  createdAt: row.created_at,
  startedAt: row.started_at,
  completedAt: row.completed_at,
  durationSec: row.duration_sec,
  workDate: row.work_date,
});

const mapDoctorStatus = (row: any): DoctorStatus => ({
  doctorId: row.doctor_id,
  doctorName: row.doctor_name,
  status: row.status,
  currentActingId: row.current_acting_id,
  statusUpdatedAt: row.status_updated_at,
});

// ==================== 액팅 종류 ====================

// 액팅 종류 목록 조회
export async function fetchActingTypes(): Promise<ActingType[]> {
  const data = await query<any>(`
    SELECT * FROM acting_types WHERE is_active = 1 ORDER BY display_order
  `);

  return data.map(row => ({
    id: row.id,
    name: row.name,
    category: row.category,
    standardMin: row.standard_min,
    slotUsage: row.slot_usage,
    displayOrder: row.display_order,
    isActive: row.is_active === 1,
  }));
}

// ==================== 액팅 대기열 ====================

// 오늘 날짜의 대기열 조회
export async function fetchTodayQueue(): Promise<ActingQueueItem[]> {
  const today = getCurrentDate();

  const data = await query<any>(`
    SELECT * FROM acting_queue
    WHERE work_date = ${escapeString(today)}
    AND status IN ('waiting', 'in_progress')
    ORDER BY doctor_id, order_num
  `);

  return data.map(mapQueueItem);
}

// 특정 원장의 대기열 조회
export async function fetchDoctorQueue(doctorId: number): Promise<ActingQueueItem[]> {
  const today = getCurrentDate();

  const data = await query<any>(`
    SELECT * FROM acting_queue
    WHERE doctor_id = ${doctorId}
    AND work_date = ${escapeString(today)}
    AND status IN ('waiting', 'in_progress')
    ORDER BY order_num
  `);

  return data.map(mapQueueItem);
}

// 액팅 추가
export async function addActing(request: AddActingRequest): Promise<ActingQueueItem> {
  const today = getCurrentDate();

  // orderNum이 없으면 맨 뒤로
  let orderNum = request.orderNum;
  if (orderNum === undefined) {
    const maxData = await queryOne<{ order_num: number }>(`
      SELECT MAX(order_num) as order_num FROM acting_queue
      WHERE doctor_id = ${request.doctorId}
      AND work_date = ${escapeString(today)}
      AND status IN ('waiting', 'in_progress')
    `);
    orderNum = (maxData?.order_num || 0) + 1;
  }

  const id = await insert(`
    INSERT INTO acting_queue (patient_id, patient_name, chart_no, doctor_id, doctor_name, acting_type, order_num, source, source_id, memo, work_date)
    VALUES (${toSqlValue(request.patientId)}, ${escapeString(request.patientName)}, ${escapeString(request.chartNo || '')},
            ${request.doctorId}, ${escapeString(request.doctorName)}, ${escapeString(request.actingType)},
            ${orderNum}, ${escapeString(request.source || 'manual')}, ${toSqlValue(request.sourceId)},
            ${escapeString(request.memo || '')}, ${escapeString(today)})
  `);

  const data = await queryOne<any>(`SELECT * FROM acting_queue WHERE id = ${id}`);
  return mapQueueItem(data);
}

// 액팅 순서 변경 (같은 원장 내에서 드래그 앤 드롭)
export async function reorderActing(
  actingId: number,
  doctorId: number,
  fromIndex: number,
  toIndex: number
): Promise<void> {
  const today = getCurrentDate();

  // 해당 원장의 대기 중인 액팅 목록 조회
  const queue = await query<{ id: number; order_num: number }>(`
    SELECT id, order_num FROM acting_queue
    WHERE doctor_id = ${doctorId}
    AND work_date = ${escapeString(today)}
    AND status IN ('waiting', 'in_progress')
    ORDER BY order_num ASC
  `);

  if (queue.length === 0) return;

  // 순서 재배열
  const items = [...queue];
  const [movedItem] = items.splice(fromIndex, 1);
  items.splice(toIndex, 0, movedItem);

  // 새 순서로 업데이트
  for (let i = 0; i < items.length; i++) {
    await execute(`UPDATE acting_queue SET order_num = ${i + 1} WHERE id = ${items[i].id}`);
  }
}

// 액팅 삭제 (취소)
export async function cancelActing(actingId: number): Promise<void> {
  await execute(`UPDATE acting_queue SET status = 'cancelled' WHERE id = ${actingId}`);
}

// 액팅 수정 (제목, 메모)
export async function updateActing(
  actingId: number,
  updates: { actingType?: string; patientName?: string; memo?: string }
): Promise<void> {
  const updateParts: string[] = [];

  if (updates.actingType !== undefined) {
    updateParts.push(`acting_type = ${escapeString(updates.actingType)}`);
  }
  if (updates.patientName !== undefined) {
    updateParts.push(`patient_name = ${escapeString(updates.patientName)}`);
  }
  if (updates.memo !== undefined) {
    updateParts.push(`memo = ${escapeString(updates.memo)}`);
  }

  if (updateParts.length === 0) return;

  await execute(`UPDATE acting_queue SET ${updateParts.join(', ')} WHERE id = ${actingId}`);
}

// 액팅을 다른 원장에게 이동
export async function moveActingToDoctor(
  actingId: number,
  newDoctorId: number,
  newDoctorName: string
): Promise<void> {
  const today = getCurrentDate();

  // 새 원장의 맨 뒤 순서 조회
  const maxData = await queryOne<{ order_num: number }>(`
    SELECT MAX(order_num) as order_num FROM acting_queue
    WHERE doctor_id = ${newDoctorId}
    AND work_date = ${escapeString(today)}
    AND status IN ('waiting', 'in_progress')
  `);

  const newOrderNum = (maxData?.order_num || 0) + 1;

  await execute(`
    UPDATE acting_queue
    SET doctor_id = ${newDoctorId}, doctor_name = ${escapeString(newDoctorName)}, order_num = ${newOrderNum}
    WHERE id = ${actingId}
  `);
}

// ==================== 원장 상태 ====================

// 모든 원장 상태 조회
export async function fetchAllDoctorStatus(): Promise<DoctorStatus[]> {
  const data = await query<any>(`SELECT * FROM doctor_status ORDER BY doctor_name`);
  return data.map(mapDoctorStatus);
}

// 원장 상태 조회
export async function fetchDoctorStatus(doctorId: number): Promise<DoctorStatus | null> {
  const data = await queryOne<any>(`SELECT * FROM doctor_status WHERE doctor_id = ${doctorId}`);
  if (!data) return null;
  return mapDoctorStatus(data);
}

// 원장 상태 업데이트/생성
export async function upsertDoctorStatus(
  doctorId: number,
  doctorName: string,
  status: DoctorStatusType,
  currentActingId?: number
): Promise<DoctorStatus> {
  const now = getCurrentTimestamp();

  // 먼저 존재 여부 확인
  const existing = await queryOne<any>(`SELECT doctor_id FROM doctor_status WHERE doctor_id = ${doctorId}`);

  if (existing) {
    await execute(`
      UPDATE doctor_status
      SET doctor_name = ${escapeString(doctorName)},
          status = ${escapeString(status)},
          current_acting_id = ${toSqlValue(currentActingId)},
          status_updated_at = ${escapeString(now)}
      WHERE doctor_id = ${doctorId}
    `);
  } else {
    await execute(`
      INSERT INTO doctor_status (doctor_id, doctor_name, status, current_acting_id, status_updated_at)
      VALUES (${doctorId}, ${escapeString(doctorName)}, ${escapeString(status)}, ${toSqlValue(currentActingId)}, ${escapeString(now)})
    `);
  }

  const data = await queryOne<any>(`SELECT * FROM doctor_status WHERE doctor_id = ${doctorId}`);
  return mapDoctorStatus(data);
}

// ==================== 진료 시작/완료 ====================

// 진료 시작
export async function startActing(actingId: number, doctorId: number, doctorName: string): Promise<ActingQueueItem> {
  const now = getCurrentTimestamp();

  // 1. 액팅 상태 업데이트
  await execute(`
    UPDATE acting_queue
    SET status = 'in_progress', started_at = ${escapeString(now)}
    WHERE id = ${actingId}
  `);

  // 2. 원장 상태 업데이트
  await upsertDoctorStatus(doctorId, doctorName, 'in_progress', actingId);

  const data = await queryOne<any>(`SELECT * FROM acting_queue WHERE id = ${actingId}`);
  return mapQueueItem(data);
}

// 진료 완료
export async function completeActing(actingId: number, doctorId: number, doctorName: string): Promise<ActingQueueItem> {
  const now = getCurrentTimestamp();

  // 1. 현재 액팅 조회
  const acting = await queryOne<any>(`SELECT * FROM acting_queue WHERE id = ${actingId}`);
  if (!acting) throw new Error('Acting not found');

  // 2. 소요시간 계산
  const startedAt = new Date(acting.started_at);
  const completedAt = new Date(now);
  const durationSec = Math.round((completedAt.getTime() - startedAt.getTime()) / 1000);

  // 3. 액팅 상태 업데이트
  await execute(`
    UPDATE acting_queue
    SET status = 'completed', completed_at = ${escapeString(now)}, duration_sec = ${durationSec}
    WHERE id = ${actingId}
  `);

  // 4. 액팅 기록 저장 (통계용)
  await execute(`
    INSERT INTO acting_records (patient_id, patient_name, chart_no, doctor_id, doctor_name, acting_type, started_at, completed_at, duration_sec, work_date)
    VALUES (${acting.patient_id}, ${escapeString(acting.patient_name)}, ${escapeString(acting.chart_no || '')},
            ${acting.doctor_id}, ${escapeString(acting.doctor_name)}, ${escapeString(acting.acting_type)},
            ${escapeString(acting.started_at)}, ${escapeString(now)}, ${durationSec}, ${escapeString(acting.work_date)})
  `);

  // 5. 다음 대기 액팅 확인 후 원장 상태 업데이트
  const queue = await fetchDoctorQueue(doctorId);
  const waitingQueue = queue.filter(q => q.status === 'waiting');

  if (waitingQueue.length > 0) {
    await upsertDoctorStatus(doctorId, doctorName, 'waiting');
  } else {
    await upsertDoctorStatus(doctorId, doctorName, 'office');
  }

  const data = await queryOne<any>(`SELECT * FROM acting_queue WHERE id = ${actingId}`);
  return mapQueueItem(data);
}

// 원장실 대기 상태로 변경
export async function setDoctorOffice(doctorId: number, doctorName: string): Promise<void> {
  await upsertDoctorStatus(doctorId, doctorName, 'office');
}

// ==================== 통계 ====================

// 원장별 액팅 통계 조회
export async function fetchDoctorStats(doctorId?: number): Promise<DoctorActingStats[]> {
  let sql = `
    SELECT doctor_id, doctor_name, acting_type,
           COUNT(*) as total_count,
           AVG(duration_sec) as avg_duration_sec,
           AVG(duration_sec / 60.0) as avg_duration_min,
           MIN(duration_sec) as min_duration_sec,
           MAX(duration_sec) as max_duration_sec
    FROM acting_records
  `;

  if (doctorId) {
    sql += ` WHERE doctor_id = ${doctorId}`;
  }

  sql += ` GROUP BY doctor_id, doctor_name, acting_type`;

  const data = await query<any>(sql);

  return data.map(row => ({
    doctorId: row.doctor_id,
    doctorName: row.doctor_name,
    actingType: row.acting_type,
    totalCount: row.total_count,
    avgDurationSec: row.avg_duration_sec,
    avgDurationMin: row.avg_duration_min,
    minDurationSec: row.min_duration_sec,
    maxDurationSec: row.max_duration_sec,
  }));
}

// 일별 통계 조회
export async function fetchDailyStats(
  startDate: string,
  endDate: string,
  doctorId?: number
): Promise<DailyActingStats[]> {
  let sql = `
    SELECT work_date, doctor_id, doctor_name,
           COUNT(*) as total_count,
           SUM(duration_sec) as total_duration_sec,
           SUM(duration_sec) / 60.0 as total_duration_min,
           AVG(duration_sec) as avg_duration_sec
    FROM acting_records
    WHERE work_date >= ${escapeString(startDate)} AND work_date <= ${escapeString(endDate)}
  `;

  if (doctorId) {
    sql += ` AND doctor_id = ${doctorId}`;
  }

  sql += ` GROUP BY work_date, doctor_id, doctor_name ORDER BY work_date DESC`;

  const data = await query<any>(sql);

  return data.map(row => ({
    workDate: row.work_date,
    doctorId: row.doctor_id,
    doctorName: row.doctor_name,
    totalCount: row.total_count,
    totalDurationSec: row.total_duration_sec,
    totalDurationMin: row.total_duration_min,
    avgDurationSec: row.avg_duration_sec,
  }));
}

// ==================== 종합 데이터 (치료관리시스템용) ====================

// 원장별 대기열 그룹 조회 (액팅 관리 화면용)
export async function fetchDoctorQueueGroups(doctors: { id: number; name: string; color?: string }[]): Promise<DoctorQueueGroup[]> {
  const [queue, statuses] = await Promise.all([
    fetchTodayQueue(),
    fetchAllDoctorStatus(),
  ]);

  return doctors.map(doctor => {
    const doctorQueue = queue.filter(q => q.doctorId === doctor.id);
    const waitingQueue = doctorQueue.filter(q => q.status === 'waiting');
    const currentActing = doctorQueue.find(q => q.status === 'in_progress');

    let status = statuses.find(s => s.doctorId === doctor.id);

    // 상태가 없으면 기본값 생성
    if (!status) {
      status = {
        doctorId: doctor.id,
        doctorName: doctor.name,
        status: waitingQueue.length > 0 ? 'waiting' : 'office',
        statusUpdatedAt: new Date().toISOString(),
      };
    }

    // 현재 액팅 정보 추가
    if (currentActing) {
      status.currentActing = currentActing;
    }

    return {
      doctor,
      status,
      currentActing,
      queue: waitingQueue.sort((a, b) => a.orderNum - b.orderNum),
      totalWaiting: waitingQueue.length,
    };
  });
}

// ==================== 환자 정보 (MSSQL에서 조회) ====================

// 원장 별명(alias) → ID 매핑
// MSSQL의 MAINDOCTOR 컬럼에는 "김", "강", "임", "전" 같은 별명이 저장됨
// 성씨가 겹치면 입사가 늦은 사람의 끝글자를 사용 (예: 김대현=김, 김철수=수)
const DOCTOR_ALIAS_TO_ID: Record<string, { id: number; displayName: string }> = {
  '김': { id: 1, displayName: '김대현' },  // 김대현 원장
  '강': { id: 2, displayName: '강희종' },  // 강희종 원장
  '임': { id: 3, displayName: '임세열' },  // 임세열 원장
  '전': { id: 4, displayName: '전인태' },  // 전인태 원장
};

export interface PatientMemo {
  doctorMemo?: string;    // 원장 메모 (NOTEFORDOC)
  nurseMemo?: string;     // 간호 메모 (NOTEFORNURSE)
  mainDisease?: string;   // 주요 질환 (MAINDISEASE)
  mainDoctor?: string;    // 담당 원장 (MAINDOCTOR)
  treatType?: string;     // 진료 유형 (TreatCurrent)
  etcMemo?: string;       // 기타 메모 (ETCMemo)
}

// 담당 원장 정보
export interface MainDoctorInfo {
  doctorId: number;
  doctorName: string;
}

// 환자의 담당 원장 정보 조회
export async function fetchPatientMainDoctor(patientId: number): Promise<MainDoctorInfo | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/patients/${patientId}`);
    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const doctorAlias = data.main_doctor?.trim();

    if (!doctorAlias) {
      // 담당 원장이 없으면 기본값 (첫 번째 원장)
      console.log('[fetchPatientMainDoctor] 담당 원장 없음, 기본값 사용');
      return { doctorId: 1, doctorName: '김대현' };
    }

    // 별명(alias)에서 원장 정보 찾기
    const doctorInfo = DOCTOR_ALIAS_TO_ID[doctorAlias];
    if (doctorInfo) {
      console.log(`[fetchPatientMainDoctor] 원장 매칭 성공: ${doctorAlias} → ${doctorInfo.displayName} (ID: ${doctorInfo.id})`);
      return { doctorId: doctorInfo.id, doctorName: doctorInfo.displayName };
    }

    // 매칭되지 않으면 기본값
    console.warn(`[fetchPatientMainDoctor] 알 수 없는 원장 별명: ${doctorAlias}`);
    return { doctorId: 1, doctorName: '김대현' };
  } catch (error) {
    console.error('환자 담당 원장 조회 오류:', error);
    return null;
  }
}

// 환자 메모 정보 조회 (MSSQL API 서버 경유)
export async function fetchPatientMemo(patientId: number): Promise<PatientMemo | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/patients/${patientId}`);
    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    return {
      doctorMemo: data.doctor_memo,
      nurseMemo: data.nurse_memo,
      mainDisease: data.main_disease,
      mainDoctor: data.main_doctor,
      treatType: data.treat_type,
      etcMemo: data.etc_memo,
    };
  } catch (error) {
    console.error('환자 메모 조회 오류:', error);
    return null;
  }
}

// 환자 최근 진료 내역 조회
export interface TreatmentHistory {
  id: number;
  date: string;
  time?: string;
  item?: string;
  diagnosis?: string;
  treatment?: string;
  doctor?: string;
  note?: string;
}

export async function fetchPatientTreatments(patientId: number, limit = 5): Promise<TreatmentHistory[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/patients/${patientId}/treatments?limit=${limit}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.map((t: any) => ({
      id: t.id,
      date: t.date,
      time: t.time,
      item: t.item,
      diagnosis: t.diagnosis,
      treatment: t.treatment,
      doctor: t.doctor,
      note: t.note,
    }));
  } catch (error) {
    console.error('환자 진료내역 조회 오류:', error);
    return [];
  }
}
