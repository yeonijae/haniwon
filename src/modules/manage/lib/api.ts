/**
 * 한의원 운영 관리 시스템 - API 클라이언트
 * SQLite 직접 연결
 */

import { Patient, Reservation, Payment, DefaultTreatment, Acting, CompletedPayment, MedicalStaff, MedicalStaffPermissions, Staff, StaffPermissions, UncoveredCategories, TreatmentRoom, SessionTreatment, TreatmentItem, ConsultationItem, ConsultationSubItem, RoomStatus } from '../types';
import { query, queryOne, execute, insert, escapeString, getCurrentTimestamp, toSqlValue } from '@shared/lib/sqlite';

/**
 * 환자 관련 API
 * SQLite에는 id, chart_number, name만 저장
 * 상세정보(전화번호, 생년월일 등)는 MSSQL에서 실시간 조회
 */

// DB 레코드를 Patient 객체로 변환하는 헬퍼 함수
const mapDbToPatient = (p: any): Patient => ({
  id: p.id,
  name: p.name,
  chartNumber: p.chart_number || '',
  status: 'COMPLETED' as any,
  time: '',
  details: '',
  deletionDate: p.deletion_date || undefined,
});

// 모든 환자 조회 (삭제되지 않은) - 페이지네이션
export async function fetchPatients(
  onProgress?: (loaded: number, message: string) => void
): Promise<Patient[]> {
  console.log('🔍 환자 데이터 로드 시작');

  const PAGE_SIZE = 1000;
  const allPatients: Patient[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    console.log(`📄 페이지 로드 중... (offset: ${offset})`);

    const data = await query<any>(`
      SELECT id, name, chart_number, deletion_date
      FROM patients
      WHERE deletion_date IS NULL
      ORDER BY id ASC
      LIMIT ${PAGE_SIZE} OFFSET ${offset}
    `);

    if (data && data.length > 0) {
      const patients = data.map(mapDbToPatient);
      allPatients.push(...patients);
      console.log(`✅ 페이지 완료: ${data.length}명 로드 (총 ${allPatients.length}명)`);

      if (onProgress) {
        onProgress(allPatients.length, `환자 데이터 로드 중... (${allPatients.length}명)`);
      }

      hasMore = data.length === PAGE_SIZE;
    } else {
      hasMore = false;
    }

    offset += PAGE_SIZE;
  }

  console.log('✅ 전체 데이터 로드 완료:', allPatients.length, '명');
  return allPatients;
}

// 개별 환자 조회 (ID로)
export async function fetchPatientById(patientId: number): Promise<Patient | null> {
  const data = await queryOne<any>(`
    SELECT id, name, chart_number, deletion_date
    FROM patients
    WHERE id = ${patientId}
  `);

  if (!data) return null;
  return mapDbToPatient(data);
}

// 차트번호로 여러 환자 조회
export async function fetchPatientsByChartNumbers(chartNumbers: string[]): Promise<Patient[]> {
  if (chartNumbers.length === 0) return [];

  const chartNumbersStr = chartNumbers.map(c => escapeString(c)).join(',');
  const data = await query<any>(`
    SELECT id, name, chart_number, deletion_date
    FROM patients
    WHERE chart_number IN (${chartNumbersStr})
  `);

  return (data || []).map(mapDbToPatient);
}

// MSSQL API 기본 URL
const MSSQL_API_BASE_URL = 'http://192.168.0.173:3100';

// MSSQL API 응답을 Patient 객체로 변환
interface MssqlPatientResponse {
  id: number;
  chart_no: string;
  name: string;
  phone: string | null;
  birth: string | null;
  sex: string | null;  // 'M' or 'F'
  address: string | null;
  reg_date: string | null;
  last_visit: string | null;
  main_doctor: string | null;
  treat_type: string | null;
  nurse_memo: string | null;
  referral_source: string | null;  // 조합된 유입경로
  referral_type: string | null;    // 유입경로 분류
  referral_detail: string | null;  // 상세 (검색키워드 또는 미등록 소개자)
  referrer_info: string | null;    // 소개자 정보 (이름[차트번호])
}

const mapMssqlToPatient = (p: MssqlPatientResponse): Patient => ({
  id: p.id,
  name: p.name,
  chartNumber: p.chart_no || '',
  phone: p.phone || undefined,
  dob: p.birth || undefined,
  gender: p.sex === 'M' ? 'male' : p.sex === 'F' ? 'female' : undefined,
  address: p.address || undefined,
  registrationDate: p.reg_date || undefined,
  referralPath: p.referral_source || undefined,
  status: 'COMPLETED' as any,
  time: '',
  details: '',
});

// 환자 검색 (MSSQL API 사용)
export async function searchPatients(searchTerm: string): Promise<Patient[]> {
  if (!searchTerm || searchTerm.trim().length === 0) {
    return [];
  }

  console.log('🔍 환자 검색 시작 (MSSQL):', searchTerm);

  try {
    const response = await fetch(
      `${MSSQL_API_BASE_URL}/api/patients/search?q=${encodeURIComponent(searchTerm)}`
    );

    if (!response.ok) {
      throw new Error(`MSSQL API 오류: ${response.status}`);
    }

    const data: MssqlPatientResponse[] = await response.json();
    console.log('✅ 검색 결과 (MSSQL):', data?.length || 0, '명');
    return (data || []).map(mapMssqlToPatient);
  } catch (error) {
    console.error('❌ 환자 검색 오류 (MSSQL):', error);
    // MSSQL API 실패 시 SQLite 폴백
    console.log('⚠️ SQLite로 폴백 시도...');
    const escapedTerm = searchTerm.replace(/'/g, "''");
    const data = await query<any>(`
      SELECT id, name, chart_number, deletion_date
      FROM patients
      WHERE deletion_date IS NULL
      AND (name LIKE '%${escapedTerm}%' OR chart_number LIKE '%${escapedTerm}%')
      ORDER BY id ASC
    `);

    console.log('✅ SQLite 폴백 결과:', data?.length || 0, '명');
    return (data || []).map(mapDbToPatient);
  }
}

// 삭제된 환자 조회
export async function fetchDeletedPatients(): Promise<Patient[]> {
  const data = await query<any>(`
    SELECT id, name, chart_number, deletion_date
    FROM patients
    WHERE deletion_date IS NOT NULL
    ORDER BY deletion_date DESC
  `);

  return (data || []).map(mapDbToPatient);
}

// 환자 생성 (chart_number, name만 저장)
export async function createPatient(patient: Omit<Patient, 'id'>): Promise<Patient> {
  const id = await insert(`
    INSERT INTO patients (name, chart_number)
    VALUES (${escapeString(patient.name)}, ${patient.chartNumber ? escapeString(patient.chartNumber) : 'NULL'})
  `);

  const data = await queryOne<any>(`SELECT id, name, chart_number, deletion_date FROM patients WHERE id = ${id}`);

  return {
    ...mapDbToPatient(data),
    status: patient.status,
    time: patient.time,
    details: patient.details,
  };
}

// 환자 정보 수정 (name, chart_number만)
export async function updatePatient(patientId: number, updates: Partial<Patient>): Promise<void> {
  const updateParts: string[] = [];
  if (updates.name !== undefined) updateParts.push(`name = ${escapeString(updates.name)}`);
  if (updates.chartNumber !== undefined) updateParts.push(`chart_number = ${updates.chartNumber ? escapeString(updates.chartNumber) : 'NULL'}`);

  if (updateParts.length === 0) return;

  await execute(`UPDATE patients SET ${updateParts.join(', ')} WHERE id = ${patientId}`);
}

// 환자 삭제 (soft delete)
export async function deletePatient(patientId: number): Promise<void> {
  const now = getCurrentTimestamp();
  await execute(`UPDATE patients SET deletion_date = ${escapeString(now)} WHERE id = ${patientId}`);
}

// 환자 복구
export async function restorePatient(patientId: number): Promise<void> {
  await execute(`UPDATE patients SET deletion_date = NULL WHERE id = ${patientId}`);
}

// 등록된 환자 수 조회 (삭제되지 않은 환자만)
export async function fetchPatientCount(): Promise<number> {
  const data = await queryOne<{ cnt: number }>(`
    SELECT COUNT(*) as cnt FROM patients WHERE deletion_date IS NULL
  `);
  return data?.cnt || 0;
}

/**
 * 환자 기본 치료 관련 API
 */

// 환자의 기본 치료 조회
export async function fetchPatientDefaultTreatments(patientId: number): Promise<DefaultTreatment[]> {
  const data = await query<any>(`
    SELECT * FROM patient_default_treatments
    WHERE patient_id = ${patientId}
    ORDER BY id ASC
  `);

  return (data || []).map((t) => ({
    name: t.treatment_name,
    duration: t.duration,
    memo: t.memo || '',
  }));
}

// 환자 기본 치료 저장
export async function savePatientDefaultTreatments(
  patientId: number,
  treatments: DefaultTreatment[]
): Promise<void> {
  // 기존 치료 삭제
  await execute(`DELETE FROM patient_default_treatments WHERE patient_id = ${patientId}`);

  // 새 치료 추가
  for (const t of treatments) {
    await insert(`
      INSERT INTO patient_default_treatments (patient_id, treatment_name, duration, memo)
      VALUES (${patientId}, ${escapeString(t.name)}, ${t.duration}, ${t.memo ? escapeString(t.memo) : 'NULL'})
    `);
  }
}

/**
 * 예약 관련 API
 */

// 예약 조회 (특정 기간)
export async function fetchReservations(params: { startDate: string; endDate: string }): Promise<any[]> {
  const data = await query<any>(`
    SELECT r.*, p.id as patient_id_ref, p.name as patient_name, p.chart_number as patient_chart_number
    FROM reservations r
    LEFT JOIN patients p ON r.patient_id = p.id
    WHERE r.reservation_date >= ${escapeString(params.startDate)}
    AND r.reservation_date <= ${escapeString(params.endDate)}
    ORDER BY r.reservation_date ASC, r.reservation_time ASC
  `);

  // 각 예약의 치료 항목 조회
  const results = [];
  for (const r of data || []) {
    const treatments = await query<any>(`
      SELECT * FROM reservation_treatments WHERE reservation_id = ${r.id}
    `);

    results.push({
      id: r.id,
      patient_id: r.patient_id,
      patientId: r.patient_id,
      doctor: r.doctor,
      reservation_date: r.reservation_date,
      reservationDate: r.reservation_date,
      reservation_time: r.reservation_time,
      reservationTime: r.reservation_time,
      status: r.status,
      memo: r.memo,
      patientName: r.patient_name,
      patientChartNumber: r.patient_chart_number,
      treatments: (treatments || []).map((t: any) => ({
        name: t.treatment_name,
        acting: t.acting || 0,
      })),
    });
  }

  return results;
}

// 예약 생성
export async function createReservation(reservation: any): Promise<string> {
  console.log('🔍 예약 생성 시도:', reservation);

  const id = await insert(`
    INSERT INTO reservations (patient_id, doctor, reservation_date, reservation_time, status, memo)
    VALUES (${reservation.patientId}, ${escapeString(reservation.doctor || '')},
            ${escapeString(reservation.reservationDate)}, ${escapeString(reservation.reservationTime)},
            ${escapeString(reservation.status || 'confirmed')}, ${reservation.memo ? escapeString(reservation.memo) : 'NULL'})
  `);

  console.log('✅ 예약 생성 성공, ID:', id);
  return String(id);
}

// 예약 상태 변경
export async function updateReservationStatus(reservationId: string, status: string): Promise<void> {
  await execute(`UPDATE reservations SET status = ${escapeString(status)} WHERE id = ${reservationId}`);
}

// 예약 삭제
export async function deleteReservation(reservationId: string): Promise<void> {
  // 먼저 치료 항목 삭제
  await execute(`DELETE FROM reservation_treatments WHERE reservation_id = ${reservationId}`);
  await execute(`DELETE FROM reservations WHERE id = ${reservationId}`);
}

// 예약 업데이트 (일반)
export async function updateReservation(reservationId: string, updates: any): Promise<void> {
  await execute(`
    UPDATE reservations SET
      patient_id = ${updates.patientId},
      doctor = ${escapeString(updates.doctor || '')},
      reservation_date = ${escapeString(updates.reservationDate)},
      reservation_time = ${escapeString(updates.reservationTime)},
      status = ${escapeString(updates.status || '')},
      memo = ${updates.memo ? escapeString(updates.memo) : 'NULL'}
    WHERE id = ${reservationId}
  `);
}

// 예약의 치료 항목 조회
export async function fetchReservationTreatments(reservationId: string): Promise<any[]> {
  const data = await query<any>(`
    SELECT * FROM reservation_treatments WHERE reservation_id = ${reservationId}
  `);

  return (data || []).map((item: any) => ({
    name: item.treatment_name,
    acting: item.acting || 0,
  }));
}

// 예약에 치료 항목 추가
export async function addReservationTreatments(reservationId: string, treatments: any[]): Promise<void> {
  console.log('🔍 치료 항목 추가 시도:', reservationId, treatments);

  // 기존 치료 항목 삭제
  await execute(`DELETE FROM reservation_treatments WHERE reservation_id = ${reservationId}`);

  // 새 치료 항목 추가
  for (const t of treatments) {
    await insert(`
      INSERT INTO reservation_treatments (reservation_id, treatment_name, acting)
      VALUES (${reservationId}, ${escapeString(t.name)}, ${t.acting || 0})
    `);
  }

  console.log('✅ 치료 항목 추가 성공');
}

// 예약의 치료 항목 삭제
export async function deleteReservationTreatments(reservationId: string): Promise<void> {
  await execute(`DELETE FROM reservation_treatments WHERE reservation_id = ${reservationId}`);
}

/**
 * 결제 관련 API
 */

// 대기 중인 결제 조회
export async function fetchPendingPayments(): Promise<Payment[]> {
  const data = await query<any>(`
    SELECT p.*, pt.name as patient_name, pt.chart_number as patient_chart_number
    FROM payments p
    LEFT JOIN patients pt ON p.patient_id = pt.id
    WHERE p.is_completed = 0
    ORDER BY p.created_at ASC
  `);

  return (data || []).map((p) => ({
    id: p.id,
    patientId: p.patient_id,
    patientName: p.patient_name || '',
    patientChartNumber: p.patient_chart_number || '',
    details: '진료비',
    isPaid: false,
    reservationId: p.reservation_id || undefined,
  }));
}

// 완료된 결제 조회
export async function fetchCompletedPayments(): Promise<CompletedPayment[]> {
  const data = await query<any>(`
    SELECT p.*, pt.name as patient_name, pt.chart_number as patient_chart_number
    FROM payments p
    LEFT JOIN patients pt ON p.patient_id = pt.id
    WHERE p.is_completed = 1
    ORDER BY p.payment_date DESC
  `);

  return (data || []).map((p) => {
    let treatmentItems = [];
    let paymentMethods = [];
    try {
      treatmentItems = p.treatment_items ? JSON.parse(p.treatment_items) : [];
    } catch {}
    try {
      paymentMethods = p.payment_methods ? JSON.parse(p.payment_methods) : [];
    } catch {}

    return {
      id: p.id,
      paymentId: p.id,
      patientId: p.patient_id,
      patientName: p.patient_name || '',
      patientChartNumber: p.patient_chart_number || '',
      treatmentItems,
      totalAmount: p.total_amount || 0,
      paidAmount: p.paid_amount || 0,
      remainingAmount: p.remaining_amount || 0,
      paymentMethods,
      timestamp: p.payment_date,
    };
  });
}

// 결제 생성 (대기)
export async function createPayment(payment: Omit<Payment, 'id'>): Promise<number> {
  console.log('🔍 결제 생성 시도 - patientId:', payment.patientId);

  const id = await insert(`
    INSERT INTO payments (patient_id, reservation_id, total_amount, paid_amount, remaining_amount, payment_methods, treatment_items, is_completed)
    VALUES (${payment.patientId}, ${payment.reservationId ? escapeString(payment.reservationId) : 'NULL'},
            0, 0, 0, '[]', '[]', 0)
  `);

  return id;
}

// 결제 완료 처리
export async function completePayment(
  paymentId: number,
  details: {
    totalAmount: number;
    paidAmount: number;
    remainingAmount: number;
    paymentMethods: any[];
    treatmentItems: any[];
  }
): Promise<void> {
  const now = getCurrentTimestamp();
  await execute(`
    UPDATE payments SET
      total_amount = ${details.totalAmount},
      paid_amount = ${details.paidAmount},
      remaining_amount = ${details.remainingAmount},
      payment_methods = ${escapeString(JSON.stringify(details.paymentMethods))},
      treatment_items = ${escapeString(JSON.stringify(details.treatmentItems))},
      is_completed = 1,
      payment_date = ${escapeString(now)}
    WHERE id = ${paymentId}
  `);
}

// 수납 대기 삭제
export async function deletePayment(paymentId: number): Promise<void> {
  await execute(`DELETE FROM payments WHERE id = ${paymentId}`);
}

/**
 * Acting Queue 관련 API
 */

// 특정 의사의 Acting Queue 조회
export async function fetchActingQueue(doctor: string): Promise<Acting[]> {
  const data = await query<any>(`
    SELECT * FROM acting_queue_items
    WHERE doctor = ${escapeString(doctor)}
    ORDER BY position ASC
  `);

  return (data || []).map((a) => ({
    id: a.id,
    patientId: a.patient_id,
    patientName: '',
    type: a.acting_type as any,
    duration: a.duration,
    source: a.source as any,
    memo: a.memo || undefined,
  }));
}

// Acting 추가
export async function addActing(doctor: string, acting: Omit<Acting, 'id'>): Promise<string> {
  const maxData = await queryOne<{ max_pos: number }>(`
    SELECT MAX(position) as max_pos FROM acting_queue_items WHERE doctor = ${escapeString(doctor)}
  `);

  const nextPosition = (maxData?.max_pos ?? -1) + 1;

  const id = await insert(`
    INSERT INTO acting_queue_items (doctor, patient_id, acting_type, duration, source, memo, position)
    VALUES (${escapeString(doctor)}, ${acting.patientId}, ${escapeString(acting.type)},
            ${acting.duration}, ${escapeString(acting.source)}, ${acting.memo ? escapeString(acting.memo) : 'NULL'}, ${nextPosition})
  `);

  return String(id);
}

// Acting 삭제
export async function deleteActing(actingId: string): Promise<void> {
  await execute(`DELETE FROM acting_queue_items WHERE id = ${actingId}`);
}

// Acting 순서 재정렬
export async function reorderActingQueue(doctor: string, actingIds: string[]): Promise<void> {
  for (let i = 0; i < actingIds.length; i++) {
    await execute(`UPDATE acting_queue_items SET position = ${i} WHERE id = ${actingIds[i]}`);
  }
}

/**
 * 의료진 관리 API
 */

// 기본 의료진 권한
const defaultMedicalStaffPermissions: MedicalStaffPermissions = {
  prescription: false,
  chart: false,
  payment: false,
  statistics: false,
};

// 모든 의료진 조회
export async function fetchMedicalStaff(): Promise<MedicalStaff[]> {
  const data = await query<any>(`
    SELECT * FROM medical_staff ORDER BY id ASC
  `);

  return (data || []).map((staff) => {
    let permissions: MedicalStaffPermissions = defaultMedicalStaffPermissions;
    let workPatterns = [];
    try {
      const parsed = staff.permissions ? JSON.parse(staff.permissions) : null;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        permissions = { ...defaultMedicalStaffPermissions, ...parsed };
      }
    } catch {}
    try {
      workPatterns = staff.work_patterns ? JSON.parse(staff.work_patterns) : [];
    } catch {}

    return {
      id: staff.id,
      name: staff.name,
      dob: staff.dob,
      gender: staff.gender,
      hireDate: staff.hire_date,
      fireDate: staff.fire_date,
      status: staff.status,
      permissions,
      workPatterns,
      consultationRoom: staff.consultation_room,
    };
  });
}

// 의료진 추가
export async function createMedicalStaff(staff: Omit<MedicalStaff, 'id'>): Promise<MedicalStaff> {
  const id = await insert(`
    INSERT INTO medical_staff (name, dob, gender, hire_date, status, permissions, work_patterns)
    VALUES (${escapeString(staff.name)}, ${staff.dob ? escapeString(staff.dob) : 'NULL'},
            ${escapeString(staff.gender)}, ${staff.hireDate ? escapeString(staff.hireDate) : 'NULL'},
            ${escapeString(staff.status)}, ${escapeString(JSON.stringify(staff.permissions || []))},
            ${escapeString(JSON.stringify(staff.workPatterns || []))})
  `);

  const data = await queryOne<any>(`SELECT * FROM medical_staff WHERE id = ${id}`);

  let permissions: MedicalStaffPermissions = defaultMedicalStaffPermissions;
  let workPatterns = [];
  try {
    const parsed = data.permissions ? JSON.parse(data.permissions) : null;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      permissions = { ...defaultMedicalStaffPermissions, ...parsed };
    }
  } catch {}
  try {
    workPatterns = data.work_patterns ? JSON.parse(data.work_patterns) : [];
  } catch {}

  return {
    id: data.id,
    name: data.name,
    dob: data.dob,
    gender: data.gender,
    hireDate: data.hire_date,
    fireDate: data.fire_date,
    status: data.status,
    permissions,
    workPatterns,
    consultationRoom: data.consultation_room,
  };
}

// 의료진 수정
export async function updateMedicalStaff(staffId: number, updates: Partial<MedicalStaff>): Promise<void> {
  const updateParts: string[] = [];
  if (updates.name !== undefined) updateParts.push(`name = ${escapeString(updates.name)}`);
  if (updates.dob !== undefined) updateParts.push(`dob = ${updates.dob ? escapeString(updates.dob) : 'NULL'}`);
  if (updates.gender !== undefined) updateParts.push(`gender = ${escapeString(updates.gender)}`);
  if (updates.hireDate !== undefined) updateParts.push(`hire_date = ${updates.hireDate ? escapeString(updates.hireDate) : 'NULL'}`);
  if (updates.fireDate !== undefined) updateParts.push(`fire_date = ${updates.fireDate ? escapeString(updates.fireDate) : 'NULL'}`);
  if (updates.status !== undefined) updateParts.push(`status = ${escapeString(updates.status)}`);
  if (updates.permissions !== undefined) updateParts.push(`permissions = ${escapeString(JSON.stringify(updates.permissions))}`);
  if (updates.workPatterns !== undefined) updateParts.push(`work_patterns = ${escapeString(JSON.stringify(updates.workPatterns))}`);
  if (updates.consultationRoom !== undefined) updateParts.push(`consultation_room = ${updates.consultationRoom ? escapeString(updates.consultationRoom) : 'NULL'}`);

  if (updateParts.length === 0) return;

  await execute(`UPDATE medical_staff SET ${updateParts.join(', ')} WHERE id = ${staffId}`);
}

// 의료진 삭제
export async function deleteMedicalStaff(staffId: number): Promise<void> {
  await execute(`DELETE FROM medical_staff WHERE id = ${staffId}`);
}

/**
 * 스태프 관리 API
 */

// 기본 스태프 권한
const defaultStaffPermissions: StaffPermissions = {
  decoction: false,
  patient: false,
  herbalMedicine: false,
  payment: false,
  inventory: false,
  board: false,
  treatmentRoom: false,
};

// 모든 스태프 조회
export async function fetchStaff(): Promise<Staff[]> {
  const data = await query<any>(`
    SELECT * FROM staff ORDER BY id ASC
  `);

  return (data || []).map((staff) => {
    let permissions: StaffPermissions = defaultStaffPermissions;
    try {
      const parsed = staff.permissions ? JSON.parse(staff.permissions) : null;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        permissions = { ...defaultStaffPermissions, ...parsed };
      }
    } catch {}

    return {
      id: staff.id,
      name: staff.name,
      dob: staff.dob,
      gender: staff.gender,
      hireDate: staff.hire_date,
      fireDate: staff.fire_date,
      status: staff.status,
      rank: staff.rank,
      department: staff.department,
      permissions,
    };
  });
}

// 스태프 추가
export async function createStaff(staff: Omit<Staff, 'id'>): Promise<Staff> {
  const id = await insert(`
    INSERT INTO staff (name, dob, gender, hire_date, status, rank, department, permissions)
    VALUES (${escapeString(staff.name)}, ${staff.dob ? escapeString(staff.dob) : 'NULL'},
            ${escapeString(staff.gender)}, ${staff.hireDate ? escapeString(staff.hireDate) : 'NULL'},
            ${escapeString(staff.status)}, ${staff.rank ? escapeString(staff.rank) : 'NULL'},
            ${staff.department ? escapeString(staff.department) : 'NULL'},
            ${escapeString(JSON.stringify(staff.permissions || []))})
  `);

  const data = await queryOne<any>(`SELECT * FROM staff WHERE id = ${id}`);

  let permissions: StaffPermissions = defaultStaffPermissions;
  try {
    const parsed = data.permissions ? JSON.parse(data.permissions) : null;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      permissions = { ...defaultStaffPermissions, ...parsed };
    }
  } catch {}

  return {
    id: data.id,
    name: data.name,
    dob: data.dob,
    gender: data.gender,
    hireDate: data.hire_date,
    fireDate: data.fire_date,
    status: data.status,
    rank: data.rank,
    department: data.department,
    permissions,
  };
}

// 스태프 수정
export async function updateStaff(staffId: number, updates: Partial<Staff>): Promise<void> {
  const updateParts: string[] = [];
  if (updates.name !== undefined) updateParts.push(`name = ${escapeString(updates.name)}`);
  if (updates.dob !== undefined) updateParts.push(`dob = ${updates.dob ? escapeString(updates.dob) : 'NULL'}`);
  if (updates.gender !== undefined) updateParts.push(`gender = ${escapeString(updates.gender)}`);
  if (updates.hireDate !== undefined) updateParts.push(`hire_date = ${updates.hireDate ? escapeString(updates.hireDate) : 'NULL'}`);
  if (updates.fireDate !== undefined) updateParts.push(`fire_date = ${updates.fireDate ? escapeString(updates.fireDate) : 'NULL'}`);
  if (updates.status !== undefined) updateParts.push(`status = ${escapeString(updates.status)}`);
  if (updates.rank !== undefined) updateParts.push(`rank = ${updates.rank ? escapeString(updates.rank) : 'NULL'}`);
  if (updates.department !== undefined) updateParts.push(`department = ${updates.department ? escapeString(updates.department) : 'NULL'}`);
  if (updates.permissions !== undefined) updateParts.push(`permissions = ${escapeString(JSON.stringify(updates.permissions))}`);

  if (updateParts.length === 0) return;

  await execute(`UPDATE staff SET ${updateParts.join(', ')} WHERE id = ${staffId}`);
}

// 스태프 삭제
export async function deleteStaff(staffId: number): Promise<void> {
  await execute(`DELETE FROM staff WHERE id = ${staffId}`);
}

/**
 * 비급여 카테고리 관리 API
 */

// 모든 비급여 카테고리 조회
export async function fetchUncoveredCategories(): Promise<UncoveredCategories> {
  const data = await query<any>(`
    SELECT * FROM uncovered_categories ORDER BY id ASC
  `);

  const categories: UncoveredCategories = {};
  (data || []).forEach((row) => {
    let items = [];
    try {
      items = row.items ? JSON.parse(row.items) : [];
    } catch {}
    categories[row.category_name] = items;
  });

  return categories;
}

// 비급여 카테고리 저장 (전체 업데이트)
export async function saveUncoveredCategories(categories: UncoveredCategories): Promise<void> {
  // 기존 카테고리 삭제
  await execute(`DELETE FROM uncovered_categories WHERE id > 0`);

  // 새 카테고리 추가
  const entries = Object.entries(categories);
  for (const [categoryName, items] of entries) {
    await insert(`
      INSERT INTO uncovered_categories (category_name, items)
      VALUES (${escapeString(categoryName)}, ${escapeString(JSON.stringify(items))})
    `);
  }
}

/**
 * 치료실 관리 API
 */

// 모든 치료실 조회 (session_treatments 별도 테이블에서 조인)
export async function fetchTreatmentRooms(): Promise<TreatmentRoom[]> {
  const data = await query<any>(`
    SELECT * FROM treatment_rooms ORDER BY id ASC
  `);

  const rooms: TreatmentRoom[] = [];
  for (const room of data || []) {
    const treatments = await query<any>(`
      SELECT * FROM session_treatments WHERE room_id = ${room.id} ORDER BY id ASC
    `);

    rooms.push({
      id: room.id,
      name: room.name,
      status: room.status,
      sessionId: room.session_id,
      patientId: room.patient_id,
      patientName: room.patient_name,
      patientChartNumber: room.patient_chart_number,
      patientGender: room.patient_gender,
      patientDob: room.patient_dob,
      doctorName: room.doctor_name,
      inTime: room.in_time,
      sessionTreatments: (treatments || []).map((st: any) => ({
        id: st.id,
        name: st.treatment_name || st.name,
        status: st.status,
        duration: st.duration,
        startTime: st.started_at || st.start_time || null,
        elapsedSeconds: st.elapsed_seconds || 0,
        memo: st.memo,
      })),
    });
  }

  return rooms;
}

// 세션 치료 항목 조회
export async function fetchSessionTreatments(sessionId: string): Promise<SessionTreatment[]> {
  const data = await query<any>(`
    SELECT * FROM session_treatments WHERE session_id = ${escapeString(sessionId)} ORDER BY id ASC
  `);

  return (data || []).map((st) => ({
    id: st.id,
    name: st.name,
    status: st.status,
    duration: st.duration,
    startTime: st.start_time || null,
    elapsedSeconds: st.elapsed_seconds || 0,
    memo: st.memo,
  }));
}

// 치료실 업데이트 (전체) - session_treatments는 별도 처리
export async function updateTreatmentRoom(roomId: number, room: Partial<TreatmentRoom>): Promise<void> {
  // 1. 치료실 기본 정보 업데이트
  const updateParts: string[] = [];
  if (room.status !== undefined) updateParts.push(`status = ${escapeString(room.status)}`);
  if (room.sessionId !== undefined) updateParts.push(`session_id = ${room.sessionId ? escapeString(room.sessionId) : 'NULL'}`);
  if (room.patientId !== undefined) updateParts.push(`patient_id = ${room.patientId || 'NULL'}`);
  if (room.patientName !== undefined) updateParts.push(`patient_name = ${room.patientName ? escapeString(room.patientName) : 'NULL'}`);
  if (room.patientChartNumber !== undefined) updateParts.push(`patient_chart_number = ${room.patientChartNumber ? escapeString(room.patientChartNumber) : 'NULL'}`);
  if (room.patientGender !== undefined) updateParts.push(`patient_gender = ${room.patientGender ? escapeString(room.patientGender) : 'NULL'}`);
  if (room.patientDob !== undefined) updateParts.push(`patient_dob = ${room.patientDob ? escapeString(room.patientDob) : 'NULL'}`);
  if (room.doctorName !== undefined) updateParts.push(`doctor_name = ${room.doctorName ? escapeString(room.doctorName) : 'NULL'}`);
  if (room.inTime !== undefined) updateParts.push(`in_time = ${room.inTime ? escapeString(room.inTime) : 'NULL'}`);

  if (updateParts.length > 0) {
    await execute(`UPDATE treatment_rooms SET ${updateParts.join(', ')} WHERE id = ${roomId}`);
  }

  // 2. session_treatments 업데이트 (별도 테이블) - UPSERT 처리
  if (room.sessionTreatments !== undefined && room.sessionId) {
    for (const st of room.sessionTreatments) {
      if (st.id) {
        // 기존 항목 업데이트
        await execute(`
          UPDATE session_treatments SET
            session_id = ${escapeString(room.sessionId)},
            room_id = ${roomId},
            name = ${escapeString(st.name)},
            status = ${escapeString(st.status)},
            duration = ${st.duration},
            start_time = ${st.startTime ? escapeString(st.startTime) : 'NULL'},
            elapsed_seconds = ${st.elapsedSeconds || 0},
            memo = ${st.memo ? escapeString(st.memo) : 'NULL'}
          WHERE id = ${st.id}
        `);
      } else {
        // 새 항목 추가
        await insert(`
          INSERT INTO session_treatments (session_id, room_id, name, status, duration, start_time, elapsed_seconds, memo)
          VALUES (${escapeString(room.sessionId)}, ${roomId}, ${escapeString(st.name)}, ${escapeString(st.status)},
                  ${st.duration}, ${st.startTime ? escapeString(st.startTime) : 'NULL'}, ${st.elapsedSeconds || 0},
                  ${st.memo ? escapeString(st.memo) : 'NULL'})
        `);
      }
    }
  }
}

// 세션 치료 항목 개별 업데이트 (타이머 동기화용)
export async function updateSessionTreatment(treatmentId: string, updates: Partial<SessionTreatment>): Promise<void> {
  const updateParts: string[] = [];
  if (updates.status !== undefined) updateParts.push(`status = ${escapeString(updates.status)}`);
  if (updates.startTime !== undefined) updateParts.push(`start_time = ${updates.startTime ? escapeString(updates.startTime) : 'NULL'}`);
  if (updates.elapsedSeconds !== undefined) updateParts.push(`elapsed_seconds = ${updates.elapsedSeconds}`);
  if (updates.memo !== undefined) updateParts.push(`memo = ${updates.memo ? escapeString(updates.memo) : 'NULL'}`);

  if (updateParts.length === 0) return;

  await execute(`UPDATE session_treatments SET ${updateParts.join(', ')} WHERE id = ${treatmentId}`);
}

// 치료실 초기화 (환자 배정 해제)
export async function clearTreatmentRoom(roomId: number): Promise<void> {
  // 세션 치료 항목 먼저 삭제
  await execute(`DELETE FROM session_treatments WHERE room_id = ${roomId}`);

  // 치료실 초기화
  await execute(`
    UPDATE treatment_rooms SET
      status = '사용가능',
      session_id = NULL,
      patient_id = NULL,
      patient_name = NULL,
      patient_chart_number = NULL,
      doctor_name = NULL,
      in_time = NULL
    WHERE id = ${roomId}
  `);
}

// 치료실 추가 (초기 설정용)
export async function createTreatmentRoom(name: string): Promise<TreatmentRoom> {
  const id = await insert(`
    INSERT INTO treatment_rooms (name, status) VALUES (${escapeString(name)}, '사용가능')
  `);

  return {
    id,
    name,
    status: RoomStatus.AVAILABLE,
    sessionTreatments: [],
  };
}

// 치료실 삭제
export async function deleteTreatmentRoom(roomId: number): Promise<void> {
  await execute(`DELETE FROM session_treatments WHERE room_id = ${roomId}`);
  await execute(`DELETE FROM treatment_rooms WHERE id = ${roomId}`);
}

/**
 * 치료항목 관리 API
 */

// 치료항목 조회
export async function fetchTreatmentItems(): Promise<TreatmentItem[]> {
  const data = await query<any>(`
    SELECT * FROM treatment_items ORDER BY display_order ASC, id ASC
  `);

  return (data || []).map((item) => ({
    id: item.id,
    name: item.name,
    defaultDuration: item.default_duration,
    displayOrder: item.display_order ?? 0,
  }));
}

// 치료항목 생성
export async function createTreatmentItem(item: Omit<TreatmentItem, 'id'>): Promise<TreatmentItem> {
  const id = await insert(`
    INSERT INTO treatment_items (name, default_duration, display_order)
    VALUES (${escapeString(item.name)}, ${item.defaultDuration}, ${item.displayOrder})
  `);

  return {
    id,
    name: item.name,
    defaultDuration: item.defaultDuration,
    displayOrder: item.displayOrder ?? 0,
  };
}

// 치료항목 수정
export async function updateTreatmentItem(id: number, item: Omit<TreatmentItem, 'id'>): Promise<TreatmentItem> {
  await execute(`
    UPDATE treatment_items SET
      name = ${escapeString(item.name)},
      default_duration = ${item.defaultDuration},
      display_order = ${item.displayOrder}
    WHERE id = ${id}
  `);

  return {
    id,
    name: item.name,
    defaultDuration: item.defaultDuration,
    displayOrder: item.displayOrder ?? 0,
  };
}

// 치료항목 삭제
export async function deleteTreatmentItem(id: number): Promise<void> {
  await execute(`DELETE FROM treatment_items WHERE id = ${id}`);
}

// 치료항목 순서 일괄 업데이트
export async function updateTreatmentItemsOrder(
  items: Array<{ id: number; displayOrder: number }>
): Promise<void> {
  for (const item of items) {
    await execute(`UPDATE treatment_items SET display_order = ${item.displayOrder} WHERE id = ${item.id}`);
  }
}

/**
 * 대기 목록 관리 API
 * waiting_queue 테이블 사용
 */

export interface WaitingQueueItem {
  id?: number;
  patient_id: number;
  queue_type: 'consultation' | 'treatment';
  details: string;
  memo?: string;
  position: number;
  created_at?: string;
}

// 대기 목록 조회
export async function fetchWaitingQueue(queueType: 'consultation' | 'treatment'): Promise<WaitingQueueItem[]> {
  const data = await query<any>(`
    SELECT * FROM waiting_queue
    WHERE queue_type = ${escapeString(queueType)}
    ORDER BY position ASC
  `);

  return data || [];
}

// 대기 목록에 환자 추가
export async function addToWaitingQueue(item: Omit<WaitingQueueItem, 'id' | 'created_at'>): Promise<WaitingQueueItem> {
  // 먼저 같은 큐에 이미 있는지 확인하고 있으면 삭제
  await execute(`
    DELETE FROM waiting_queue
    WHERE patient_id = ${item.patient_id} AND queue_type = ${escapeString(item.queue_type)}
  `);

  // 현재 최대 position 조회
  const maxData = await queryOne<{ max_pos: number }>(`
    SELECT MAX(position) as max_pos FROM waiting_queue WHERE queue_type = ${escapeString(item.queue_type)}
  `);

  const nextPosition = (maxData?.max_pos ?? -1) + 1;

  const id = await insert(`
    INSERT INTO waiting_queue (patient_id, queue_type, details, position)
    VALUES (${item.patient_id}, ${escapeString(item.queue_type)}, ${escapeString(item.details)}, ${nextPosition})
  `);

  const data = await queryOne<any>(`SELECT * FROM waiting_queue WHERE id = ${id}`);
  return data;
}

// 대기 목록에서 환자 제거
export async function removeFromWaitingQueue(patientId: number, queueType: 'consultation' | 'treatment'): Promise<void> {
  await execute(`
    DELETE FROM waiting_queue
    WHERE patient_id = ${patientId} AND queue_type = ${escapeString(queueType)}
  `);
}

// 대기 목록 순서 업데이트
export async function updateWaitingQueueOrder(
  queueType: 'consultation' | 'treatment',
  patientIds: number[]
): Promise<void> {
  for (let i = 0; i < patientIds.length; i++) {
    await execute(`
      UPDATE waiting_queue SET position = ${i}
      WHERE patient_id = ${patientIds[i]} AND queue_type = ${escapeString(queueType)}
    `);
  }
}

// 대기 목록 간 환자 이동 (consultation <-> treatment)
export async function movePatientBetweenQueues(
  patientId: number,
  fromQueue: 'consultation' | 'treatment',
  toQueue: 'consultation' | 'treatment',
  details: string,
  memo?: string
): Promise<void> {
  // 기존 대기열에서 제거
  await removeFromWaitingQueue(patientId, fromQueue);

  // 새 대기열에 추가
  await addToWaitingQueue({
    patient_id: patientId,
    queue_type: toQueue,
    details,
    memo,
    position: 0, // addToWaitingQueue에서 자동 계산됨
  });
}

// 환자의 마지막 진료정보 조회 (treatment_history 또는 waiting_queue에서)
export async function getLastTreatmentInfo(patientId: number): Promise<{ details: string; memo?: string } | null> {
  // 먼저 treatment_history 테이블에서 조회 시도
  const historyData = await queryOne<any>(`
    SELECT details, memo FROM treatment_history
    WHERE patient_id = ${patientId}
    ORDER BY created_at DESC
    LIMIT 1
  `);

  if (historyData) {
    return historyData;
  }

  // treatment_history가 없으면 waiting_queue에서 마지막 기록 조회
  const queueData = await queryOne<any>(`
    SELECT details, memo FROM waiting_queue
    WHERE patient_id = ${patientId}
    ORDER BY created_at DESC
    LIMIT 1
  `);

  return queueData || null;
}

/**
 * 진료항목 관리 API
 * consultation_items, consultation_sub_items 테이블 사용
 */

// 진료항목 전체 조회 (세부항목 포함)
export async function fetchConsultationItems(): Promise<ConsultationItem[]> {
  const data = await query<any>(`
    SELECT * FROM consultation_items ORDER BY display_order ASC
  `);

  const items: ConsultationItem[] = [];
  for (const item of data || []) {
    const subItems = await query<any>(`
      SELECT * FROM consultation_sub_items
      WHERE parent_id = ${item.id}
      ORDER BY display_order ASC
    `);

    items.push({
      id: item.id,
      name: item.name,
      displayOrder: item.display_order ?? 0,
      subItems: (subItems || []).map((sub: any) => ({
        id: sub.id,
        name: sub.name,
        displayOrder: sub.display_order ?? 0,
      })),
    });
  }

  return items;
}

// 진료항목 생성
export async function createConsultationItem(item: Omit<ConsultationItem, 'id' | 'subItems'>): Promise<ConsultationItem> {
  const id = await insert(`
    INSERT INTO consultation_items (name, display_order)
    VALUES (${escapeString(item.name)}, ${item.displayOrder})
  `);

  return {
    id,
    name: item.name,
    displayOrder: item.displayOrder ?? 0,
    subItems: [],
  };
}

// 진료항목 수정
export async function updateConsultationItem(id: number, item: { name: string; displayOrder: number }): Promise<void> {
  await execute(`
    UPDATE consultation_items SET
      name = ${escapeString(item.name)},
      display_order = ${item.displayOrder}
    WHERE id = ${id}
  `);
}

// 진료항목 삭제 (세부항목도 함께 삭제됨 - CASCADE)
export async function deleteConsultationItem(id: number): Promise<void> {
  await execute(`DELETE FROM consultation_sub_items WHERE parent_id = ${id}`);
  await execute(`DELETE FROM consultation_items WHERE id = ${id}`);
}

// 진료항목 순서 일괄 업데이트
export async function updateConsultationItemsOrder(
  items: Array<{ id: number; displayOrder: number }>
): Promise<void> {
  for (const item of items) {
    await execute(`UPDATE consultation_items SET display_order = ${item.displayOrder} WHERE id = ${item.id}`);
  }
}

// 세부항목 생성
export async function createConsultationSubItem(
  parentId: number,
  subItem: Omit<ConsultationSubItem, 'id'>
): Promise<ConsultationSubItem> {
  const id = await insert(`
    INSERT INTO consultation_sub_items (parent_id, name, display_order)
    VALUES (${parentId}, ${escapeString(subItem.name)}, ${subItem.displayOrder})
  `);

  return {
    id,
    name: subItem.name,
    displayOrder: subItem.displayOrder ?? 0,
  };
}

// 세부항목 수정
export async function updateConsultationSubItem(id: number, subItem: { name: string; displayOrder: number }): Promise<void> {
  await execute(`
    UPDATE consultation_sub_items SET
      name = ${escapeString(subItem.name)},
      display_order = ${subItem.displayOrder}
    WHERE id = ${id}
  `);
}

// 세부항목 삭제
export async function deleteConsultationSubItem(id: number): Promise<void> {
  await execute(`DELETE FROM consultation_sub_items WHERE id = ${id}`);
}

// 세부항목 순서 일괄 업데이트
export async function updateConsultationSubItemsOrder(
  items: Array<{ id: number; displayOrder: number }>
): Promise<void> {
  for (const item of items) {
    await execute(`UPDATE consultation_sub_items SET display_order = ${item.displayOrder} WHERE id = ${item.id}`);
  }
}
