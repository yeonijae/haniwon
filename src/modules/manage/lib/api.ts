/**
 * 한의원 운영 관리 시스템 - API 클라이언트
 * Supabase 직접 연결
 */

import { Patient, Reservation, Payment, DefaultTreatment, Acting, CompletedPayment, MedicalStaff, Staff, UncoveredCategories, TreatmentRoom, SessionTreatment, TreatmentItem, ConsultationItem, ConsultationSubItem } from '../types';
import { supabase } from '@shared/lib/supabase';

/**
 * 환자 관련 API
 * Supabase에는 id, chart_number, name만 저장
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

// 모든 환자 조회 (삭제되지 않은) - 1000명씩 페이지네이션
export async function fetchPatients(
  onProgress?: (loaded: number, message: string) => void
): Promise<Patient[]> {
  console.log('🔍 환자 데이터 로드 시작 (페이지네이션)');

  const PAGE_SIZE = 1000;
  const allPatients: Patient[] = [];
  let page = 0;
  let hasMore = true;

  while (hasMore) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    console.log(`📄 페이지 ${page + 1} 로드 중... (${from} ~ ${to})`);

    const { data, error } = await supabase
      .from('patients')
      .select('id, name, chart_number, deletion_date')
      .is('deletion_date', null)
      .order('id', { ascending: true })
      .range(from, to);

    if (error) {
      console.error('❌ 환자 조회 오류:', error);
      throw error;
    }

    if (data && data.length > 0) {
      const patients = data.map(mapDbToPatient);
      allPatients.push(...patients);
      console.log(`✅ 페이지 ${page + 1} 완료: ${data.length}명 로드 (총 ${allPatients.length}명)`);

      if (onProgress) {
        onProgress(allPatients.length, `환자 데이터 로드 중... (${allPatients.length}명)`);
      }

      hasMore = data.length === PAGE_SIZE;
    } else {
      hasMore = false;
    }

    page++;
  }

  console.log('✅ 전체 데이터 로드 완료:', allPatients.length, '명');
  return allPatients;
}

// 개별 환자 조회 (ID로)
export async function fetchPatientById(patientId: number): Promise<Patient | null> {
  const { data, error } = await supabase
    .from('patients')
    .select('id, name, chart_number, deletion_date')
    .eq('id', patientId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('❌ 환자 조회 오류:', error);
    throw error;
  }

  if (!data) return null;
  return mapDbToPatient(data);
}

// 차트번호로 여러 환자 조회
export async function fetchPatientsByChartNumbers(chartNumbers: string[]): Promise<Patient[]> {
  if (chartNumbers.length === 0) return [];

  const { data, error } = await supabase
    .from('patients')
    .select('id, name, chart_number, deletion_date')
    .in('chart_number', chartNumbers);

  if (error) {
    console.error('❌ 환자 조회 오류:', error);
    throw error;
  }

  return (data || []).map(mapDbToPatient);
}

// MSSQL API 기본 URL
const MSSQL_API_BASE_URL = 'http://localhost:3100';

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
    // MSSQL API 실패 시 Supabase 폴백
    console.log('⚠️ Supabase로 폴백 시도...');
    const { data, error: supabaseError } = await supabase
      .from('patients')
      .select('id, name, chart_number, deletion_date')
      .is('deletion_date', null)
      .or(`name.ilike.%${searchTerm}%,chart_number.ilike.%${searchTerm}%`)
      .order('id', { ascending: true });

    if (supabaseError) {
      console.error('❌ Supabase 폴백도 실패:', supabaseError);
      throw supabaseError;
    }

    console.log('✅ Supabase 폴백 결과:', data?.length || 0, '명');
    return (data || []).map(mapDbToPatient);
  }
}

// 삭제된 환자 조회
export async function fetchDeletedPatients(): Promise<Patient[]> {
  const { data, error } = await supabase
    .from('patients')
    .select('id, name, chart_number, deletion_date')
    .not('deletion_date', 'is', null)
    .order('deletion_date', { ascending: false });

  if (error) {
    console.error('❌ 삭제된 환자 조회 오류:', error);
    throw error;
  }

  return (data || []).map(mapDbToPatient);
}

// 환자 생성 (chart_number, name만 저장)
export async function createPatient(patient: Omit<Patient, 'id'>): Promise<Patient> {
  const { data, error } = await supabase
    .from('patients')
    .insert({
      name: patient.name,
      chart_number: patient.chartNumber || null,
    })
    .select('id, name, chart_number, deletion_date')
    .single();

  if (error) {
    console.error('❌ 환자 생성 오류:', error);
    throw error;
  }

  return {
    ...mapDbToPatient(data),
    status: patient.status,
    time: patient.time,
    details: patient.details,
  };
}

// 환자 정보 수정 (name, chart_number만)
export async function updatePatient(patientId: number, updates: Partial<Patient>): Promise<void> {
  const updateData: any = {};
  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.chartNumber !== undefined) updateData.chart_number = updates.chartNumber || null;

  if (Object.keys(updateData).length === 0) return;

  const { error } = await supabase
    .from('patients')
    .update(updateData)
    .eq('id', patientId);

  if (error) {
    console.error('❌ 환자 정보 수정 오류:', error);
    throw error;
  }
}

// 환자 삭제 (soft delete)
export async function deletePatient(patientId: number): Promise<void> {
  const { error } = await supabase
    .from('patients')
    .update({ deletion_date: new Date().toISOString() })
    .eq('id', patientId);

  if (error) {
    console.error('❌ 환자 삭제 오류:', error);
    throw error;
  }
}

// 환자 복구
export async function restorePatient(patientId: number): Promise<void> {
  const { error } = await supabase
    .from('patients')
    .update({ deletion_date: null })
    .eq('id', patientId);

  if (error) {
    console.error('❌ 환자 복구 오류:', error);
    throw error;
  }
}

// 등록된 환자 수 조회 (삭제되지 않은 환자만)
export async function fetchPatientCount(): Promise<number> {
  const { count, error } = await supabase
    .from('patients')
    .select('*', { count: 'exact', head: true })
    .is('deletion_date', null);

  if (error) {
    console.error('❌ 환자 수 조회 오류:', error);
    throw error;
  }

  return count || 0;
}

/**
 * 환자 기본 치료 관련 API
 */

// 환자의 기본 치료 조회
export async function fetchPatientDefaultTreatments(patientId: number): Promise<DefaultTreatment[]> {
  const { data, error } = await supabase
    .from('patient_default_treatments')
    .select('*')
    .eq('patient_id', patientId)
    .order('id', { ascending: true });

  if (error) {
    console.error('❌ 기본 치료 조회 오류:', error);
    throw error;
  }

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
  const { error: deleteError } = await supabase
    .from('patient_default_treatments')
    .delete()
    .eq('patient_id', patientId);

  if (deleteError) {
    console.error('❌ 기본 치료 삭제 오류:', deleteError);
    throw deleteError;
  }

  // 새 치료 추가
  if (treatments.length > 0) {
    const { error: insertError } = await supabase
      .from('patient_default_treatments')
      .insert(
        treatments.map((t) => ({
          patient_id: patientId,
          treatment_name: t.name,
          duration: t.duration,
          memo: t.memo || null,
        }))
      );

    if (insertError) {
      console.error('❌ 기본 치료 추가 오류:', insertError);
      throw insertError;
    }
  }
}

/**
 * 예약 관련 API
 */

// 예약 조회 (특정 기간)
export async function fetchReservations(params: { startDate: string; endDate: string }): Promise<any[]> {
  const { data, error } = await supabase
    .from('reservations')
    .select(`
      *,
      patients (id, name, chart_number),
      reservation_treatments (*)
    `)
    .gte('reservation_date', params.startDate)
    .lte('reservation_date', params.endDate)
    .order('reservation_date', { ascending: true })
    .order('reservation_time', { ascending: true });

  if (error) {
    console.error('❌ 예약 조회 오류:', error);
    throw error;
  }

  return (data || []).map((r) => ({
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
    patientName: r.patients?.name,
    patientChartNumber: r.patients?.chart_number,
    treatments: (r.reservation_treatments || []).map((t: any) => ({
      name: t.treatment_name,
      acting: t.acting || 0,
    })),
  }));
}

// 예약 생성
export async function createReservation(reservation: any): Promise<string> {
  console.log('🔍 예약 생성 시도:', reservation);

  const { data, error } = await supabase
    .from('reservations')
    .insert({
      patient_id: reservation.patientId,
      doctor: reservation.doctor,
      reservation_date: reservation.reservationDate,
      reservation_time: reservation.reservationTime,
      status: reservation.status || 'confirmed',
      memo: reservation.memo || null,
    })
    .select()
    .single();

  if (error) {
    console.error('❌ 예약 생성 오류:', error);
    throw error;
  }

  console.log('✅ 예약 생성 성공, ID:', data.id);
  return data.id;
}

// 예약 상태 변경
export async function updateReservationStatus(reservationId: string, status: string): Promise<void> {
  const { error } = await supabase
    .from('reservations')
    .update({ status })
    .eq('id', reservationId);

  if (error) {
    console.error('❌ 예약 상태 변경 오류:', error);
    throw error;
  }
}

// 예약 삭제
export async function deleteReservation(reservationId: string): Promise<void> {
  // 먼저 치료 항목 삭제
  await supabase
    .from('reservation_treatments')
    .delete()
    .eq('reservation_id', reservationId);

  const { error } = await supabase
    .from('reservations')
    .delete()
    .eq('id', reservationId);

  if (error) {
    console.error('❌ 예약 삭제 오류:', error);
    throw error;
  }
}

// 예약 업데이트 (일반)
export async function updateReservation(reservationId: string, updates: any): Promise<void> {
  const { error } = await supabase
    .from('reservations')
    .update({
      patient_id: updates.patientId,
      doctor: updates.doctor,
      reservation_date: updates.reservationDate,
      reservation_time: updates.reservationTime,
      status: updates.status,
      memo: updates.memo,
    })
    .eq('id', reservationId);

  if (error) {
    console.error('❌ 예약 업데이트 오류:', error);
    throw error;
  }
}

// 예약의 치료 항목 조회
export async function fetchReservationTreatments(reservationId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from('reservation_treatments')
    .select('*')
    .eq('reservation_id', reservationId);

  if (error) {
    console.error('❌ 예약 치료 항목 조회 오류:', error);
    throw error;
  }

  return (data || []).map((item: any) => ({
    name: item.treatment_name,
    acting: item.acting || 0,
  }));
}

// 예약에 치료 항목 추가
export async function addReservationTreatments(reservationId: string, treatments: any[]): Promise<void> {
  console.log('🔍 치료 항목 추가 시도:', reservationId, treatments);

  // 기존 치료 항목 삭제
  await supabase
    .from('reservation_treatments')
    .delete()
    .eq('reservation_id', reservationId);

  // 새 치료 항목 추가
  if (treatments.length > 0) {
    const { error } = await supabase
      .from('reservation_treatments')
      .insert(
        treatments.map((t) => ({
          reservation_id: reservationId,
          treatment_name: t.name,
          acting: t.acting,
        }))
      );

    if (error) {
      console.error('❌ 치료 항목 추가 오류:', error);
      throw error;
    }
  }

  console.log('✅ 치료 항목 추가 성공');
}

// 예약의 치료 항목 삭제
export async function deleteReservationTreatments(reservationId: string): Promise<void> {
  const { error } = await supabase
    .from('reservation_treatments')
    .delete()
    .eq('reservation_id', reservationId);

  if (error) {
    console.error('❌ 치료 항목 삭제 오류:', error);
    throw error;
  }
}

/**
 * 결제 관련 API
 */

// 대기 중인 결제 조회
export async function fetchPendingPayments(): Promise<Payment[]> {
  const { data, error } = await supabase
    .from('payments')
    .select(`
      *,
      patients (id, name, chart_number)
    `)
    .eq('is_completed', false)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('❌ 대기 결제 조회 오류:', error);
    throw error;
  }

  return (data || []).map((p) => ({
    id: p.id,
    patientId: p.patient_id,
    patientName: p.patients?.name || '',
    patientChartNumber: p.patients?.chart_number || '',
    details: '진료비',
    isPaid: false,
    reservationId: p.reservation_id || undefined,
  }));
}

// 완료된 결제 조회
export async function fetchCompletedPayments(): Promise<CompletedPayment[]> {
  const { data, error } = await supabase
    .from('payments')
    .select(`
      *,
      patients (id, name, chart_number)
    `)
    .eq('is_completed', true)
    .order('payment_date', { ascending: false });

  if (error) {
    console.error('❌ 완료 결제 조회 오류:', error);
    throw error;
  }

  return (data || []).map((p) => ({
    id: p.id,
    paymentId: p.id,
    patientId: p.patient_id,
    patientName: p.patients?.name || '',
    patientChartNumber: p.patients?.chart_number || '',
    treatmentItems: p.treatment_items || [],
    totalAmount: p.total_amount || 0,
    paidAmount: p.paid_amount || 0,
    remainingAmount: p.remaining_amount || 0,
    paymentMethods: p.payment_methods || [],
    timestamp: p.payment_date,
  }));
}

// 결제 생성 (대기)
export async function createPayment(payment: Omit<Payment, 'id'>): Promise<number> {
  console.log('🔍 결제 생성 시도 - patientId:', payment.patientId);

  const { data, error } = await supabase
    .from('payments')
    .insert({
      patient_id: payment.patientId,
      reservation_id: payment.reservationId || null,
      total_amount: 0,
      paid_amount: 0,
      remaining_amount: 0,
      payment_methods: [],
      treatment_items: [],
      is_completed: false,
    })
    .select()
    .single();

  if (error) {
    console.error('❌ 결제 생성 오류:', error);
    throw error;
  }

  return data.id;
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
  const { error } = await supabase
    .from('payments')
    .update({
      total_amount: details.totalAmount,
      paid_amount: details.paidAmount,
      remaining_amount: details.remainingAmount,
      payment_methods: details.paymentMethods,
      treatment_items: details.treatmentItems,
      is_completed: true,
      payment_date: new Date().toISOString(),
    })
    .eq('id', paymentId);

  if (error) {
    console.error('❌ 결제 완료 처리 오류:', error);
    throw error;
  }
}

// 수납 대기 삭제
export async function deletePayment(paymentId: number): Promise<void> {
  const { error } = await supabase
    .from('payments')
    .delete()
    .eq('id', paymentId);

  if (error) {
    console.error('❌ 결제 삭제 오류:', error);
    throw error;
  }
}

/**
 * Acting Queue 관련 API
 */

// 특정 의사의 Acting Queue 조회
export async function fetchActingQueue(doctor: string): Promise<Acting[]> {
  const { data, error } = await supabase
    .from('acting_queue_items')
    .select('*')
    .eq('doctor', doctor)
    .order('position', { ascending: true });

  if (error) {
    console.error('Acting Queue 조회 오류:', error);
    throw error;
  }

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
  const { data: maxData } = await supabase
    .from('acting_queue_items')
    .select('position')
    .eq('doctor', doctor)
    .order('position', { ascending: false })
    .limit(1);

  const nextPosition = maxData && maxData.length > 0 ? maxData[0].position + 1 : 0;

  const { data, error } = await supabase
    .from('acting_queue_items')
    .insert({
      doctor,
      patient_id: acting.patientId,
      acting_type: acting.type,
      duration: acting.duration,
      source: acting.source,
      memo: acting.memo || null,
      position: nextPosition,
    })
    .select()
    .single();

  if (error) {
    console.error('Acting 추가 오류:', error);
    throw error;
  }

  return data.id;
}

// Acting 삭제
export async function deleteActing(actingId: string): Promise<void> {
  const { error } = await supabase.from('acting_queue_items').delete().eq('id', actingId);

  if (error) {
    console.error('Acting 삭제 오류:', error);
    throw error;
  }
}

// Acting 순서 재정렬
export async function reorderActingQueue(doctor: string, actingIds: string[]): Promise<void> {
  for (let i = 0; i < actingIds.length; i++) {
    await supabase
      .from('acting_queue_items')
      .update({ position: i })
      .eq('id', actingIds[i]);
  }
}

/**
 * 의료진 관리 API
 */

// 모든 의료진 조회
export async function fetchMedicalStaff(): Promise<MedicalStaff[]> {
  const { data, error } = await supabase
    .from('medical_staff')
    .select('*')
    .order('id', { ascending: true });

  if (error) {
    console.error('❌ 의료진 조회 오류:', error);
    throw error;
  }

  return (data || []).map((staff) => ({
    id: staff.id,
    name: staff.name,
    dob: staff.dob,
    gender: staff.gender,
    hireDate: staff.hire_date,
    fireDate: staff.fire_date,
    status: staff.status,
    permissions: staff.permissions,
    workPatterns: staff.work_patterns,
    consultationRoom: staff.consultation_room,
  }));
}

// 의료진 추가
export async function createMedicalStaff(staff: Omit<MedicalStaff, 'id'>): Promise<MedicalStaff> {
  const { data, error } = await supabase
    .from('medical_staff')
    .insert({
      name: staff.name,
      dob: staff.dob || null,
      gender: staff.gender,
      hire_date: staff.hireDate || null,
      status: staff.status,
      permissions: staff.permissions,
      work_patterns: staff.workPatterns,
    })
    .select()
    .single();

  if (error) {
    console.error('❌ 의료진 추가 오류:', error);
    throw error;
  }

  return {
    id: data.id,
    name: data.name,
    dob: data.dob,
    gender: data.gender,
    hireDate: data.hire_date,
    fireDate: data.fire_date,
    status: data.status,
    permissions: data.permissions,
    workPatterns: data.work_patterns,
    consultationRoom: data.consultation_room,
  };
}

// 의료진 수정
export async function updateMedicalStaff(staffId: number, updates: Partial<MedicalStaff>): Promise<void> {
  const updateData: any = {};
  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.dob !== undefined) updateData.dob = updates.dob;
  if (updates.gender !== undefined) updateData.gender = updates.gender;
  if (updates.hireDate !== undefined) updateData.hire_date = updates.hireDate;
  if (updates.fireDate !== undefined) updateData.fire_date = updates.fireDate;
  if (updates.status !== undefined) updateData.status = updates.status;
  if (updates.permissions !== undefined) updateData.permissions = updates.permissions;
  if (updates.workPatterns !== undefined) updateData.work_patterns = updates.workPatterns;
  if (updates.consultationRoom !== undefined) updateData.consultation_room = updates.consultationRoom;

  const { error } = await supabase
    .from('medical_staff')
    .update(updateData)
    .eq('id', staffId);

  if (error) {
    console.error('❌ 의료진 수정 오류:', error);
    throw error;
  }
}

// 의료진 삭제
export async function deleteMedicalStaff(staffId: number): Promise<void> {
  const { error } = await supabase
    .from('medical_staff')
    .delete()
    .eq('id', staffId);

  if (error) {
    console.error('❌ 의료진 삭제 오류:', error);
    throw error;
  }
}

/**
 * 스태프 관리 API
 */

// 모든 스태프 조회
export async function fetchStaff(): Promise<Staff[]> {
  const { data, error } = await supabase
    .from('staff')
    .select('*')
    .order('id', { ascending: true });

  if (error) {
    console.error('❌ 스태프 조회 오류:', error);
    throw error;
  }

  return (data || []).map((staff) => ({
    id: staff.id,
    name: staff.name,
    dob: staff.dob,
    gender: staff.gender,
    hireDate: staff.hire_date,
    fireDate: staff.fire_date,
    status: staff.status,
    rank: staff.rank,
    department: staff.department,
    permissions: staff.permissions,
  }));
}

// 스태프 추가
export async function createStaff(staff: Omit<Staff, 'id'>): Promise<Staff> {
  const { data, error } = await supabase
    .from('staff')
    .insert({
      name: staff.name,
      dob: staff.dob || null,
      gender: staff.gender,
      hire_date: staff.hireDate || null,
      status: staff.status,
      rank: staff.rank,
      department: staff.department,
      permissions: staff.permissions,
    })
    .select()
    .single();

  if (error) {
    console.error('❌ 스태프 추가 오류:', error);
    throw error;
  }

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
    permissions: data.permissions,
  };
}

// 스태프 수정
export async function updateStaff(staffId: number, updates: Partial<Staff>): Promise<void> {
  const updateData: any = {};
  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.dob !== undefined) updateData.dob = updates.dob;
  if (updates.gender !== undefined) updateData.gender = updates.gender;
  if (updates.hireDate !== undefined) updateData.hire_date = updates.hireDate;
  if (updates.fireDate !== undefined) updateData.fire_date = updates.fireDate;
  if (updates.status !== undefined) updateData.status = updates.status;
  if (updates.rank !== undefined) updateData.rank = updates.rank;
  if (updates.department !== undefined) updateData.department = updates.department;
  if (updates.permissions !== undefined) updateData.permissions = updates.permissions;

  const { error } = await supabase
    .from('staff')
    .update(updateData)
    .eq('id', staffId);

  if (error) {
    console.error('❌ 스태프 수정 오류:', error);
    throw error;
  }
}

// 스태프 삭제
export async function deleteStaff(staffId: number): Promise<void> {
  const { error } = await supabase
    .from('staff')
    .delete()
    .eq('id', staffId);

  if (error) {
    console.error('❌ 스태프 삭제 오류:', error);
    throw error;
  }
}

/**
 * 비급여 카테고리 관리 API
 */

// 모든 비급여 카테고리 조회
export async function fetchUncoveredCategories(): Promise<UncoveredCategories> {
  const { data, error } = await supabase
    .from('uncovered_categories')
    .select('*')
    .order('id', { ascending: true });

  if (error) {
    console.error('❌ 비급여 카테고리 조회 오류:', error);
    throw error;
  }

  const categories: UncoveredCategories = {};
  (data || []).forEach((row) => {
    categories[row.category_name] = row.items;
  });

  return categories;
}

// 비급여 카테고리 저장 (전체 업데이트)
export async function saveUncoveredCategories(categories: UncoveredCategories): Promise<void> {
  // 기존 카테고리 삭제
  await supabase.from('uncovered_categories').delete().neq('id', 0);

  // 새 카테고리 추가
  const entries = Object.entries(categories);
  if (entries.length > 0) {
    const { error } = await supabase
      .from('uncovered_categories')
      .insert(
        entries.map(([categoryName, items]) => ({
          category_name: categoryName,
          items,
        }))
      );

    if (error) {
      console.error('❌ 비급여 카테고리 저장 오류:', error);
      throw error;
    }
  }
}

/**
 * 치료실 관리 API
 */

// 모든 치료실 조회 (session_treatments 별도 테이블에서 조인)
export async function fetchTreatmentRooms(): Promise<TreatmentRoom[]> {
  const { data, error } = await supabase
    .from('treatment_rooms')
    .select(`
      *,
      session_treatments (*)
    `)
    .order('id', { ascending: true });

  if (error) {
    console.error('❌ 치료실 조회 오류:', error);
    throw error;
  }

  return (data || []).map((room) => ({
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
    sessionTreatments: (room.session_treatments || []).map((st: any) => ({
      id: st.id,
      name: st.name,
      status: st.status,
      duration: st.duration,
      // Supabase TIMESTAMP는 시간대 없이 저장되므로 UTC로 명시적 파싱
      startTime: st.start_time ? st.start_time + 'Z' : null,
      elapsedSeconds: st.elapsed_seconds || 0,
      memo: st.memo,
    })),
  }));
}

// 세션 치료 항목 조회
export async function fetchSessionTreatments(sessionId: string): Promise<SessionTreatment[]> {
  const { data, error } = await supabase
    .from('session_treatments')
    .select('*')
    .eq('session_id', sessionId)
    .order('id', { ascending: true });

  if (error) {
    console.error('❌ 세션 치료 항목 조회 오류:', error);
    throw error;
  }

  return (data || []).map((st) => ({
    id: st.id,
    name: st.name,
    status: st.status,
    duration: st.duration,
    // Supabase TIMESTAMP는 시간대 없이 저장되므로 UTC로 명시적 파싱
    startTime: st.start_time ? st.start_time + 'Z' : null,
    elapsedSeconds: st.elapsed_seconds || 0,
    memo: st.memo,
  }));
}

// 치료실 업데이트 (전체) - session_treatments는 별도 처리
export async function updateTreatmentRoom(roomId: number, room: Partial<TreatmentRoom>): Promise<void> {
  // 1. 치료실 기본 정보 업데이트
  const updateData: any = {};
  if (room.status !== undefined) updateData.status = room.status;
  if (room.sessionId !== undefined) updateData.session_id = room.sessionId;
  if (room.patientId !== undefined) updateData.patient_id = room.patientId;
  if (room.patientName !== undefined) updateData.patient_name = room.patientName;
  if (room.patientChartNumber !== undefined) updateData.patient_chart_number = room.patientChartNumber;
  if (room.patientGender !== undefined) updateData.patient_gender = room.patientGender;
  if (room.patientDob !== undefined) updateData.patient_dob = room.patientDob;
  if (room.doctorName !== undefined) updateData.doctor_name = room.doctorName;
  if (room.inTime !== undefined) updateData.in_time = room.inTime;

  if (Object.keys(updateData).length > 0) {
    const { error } = await supabase
      .from('treatment_rooms')
      .update(updateData)
      .eq('id', roomId);

    if (error) {
      console.error('❌ 치료실 업데이트 오류:', error);
      throw error;
    }
  }

  // 2. session_treatments 업데이트 (별도 테이블) - UPSERT 사용
  if (room.sessionTreatments !== undefined && room.sessionId) {
    if (room.sessionTreatments.length > 0) {
      const treatmentsToUpsert = room.sessionTreatments.map((st) => ({
        id: st.id,
        session_id: room.sessionId,
        room_id: roomId,
        name: st.name,
        status: st.status,
        duration: st.duration,
        start_time: st.startTime || null,
        elapsed_seconds: st.elapsedSeconds || 0,
        memo: st.memo || null,
      }));

      // UPSERT: 있으면 업데이트, 없으면 추가 (삭제 없이 처리)
      const { error: upsertError } = await supabase
        .from('session_treatments')
        .upsert(treatmentsToUpsert, { onConflict: 'id' });

      if (upsertError) {
        console.error('❌ 세션 치료 항목 업서트 오류:', upsertError);
        throw upsertError;
      }
    }
  }
}

// 세션 치료 항목 개별 업데이트 (타이머 동기화용)
export async function updateSessionTreatment(treatmentId: string, updates: Partial<SessionTreatment>): Promise<void> {
  const updateData: any = {};
  if (updates.status !== undefined) updateData.status = updates.status;
  if (updates.startTime !== undefined) updateData.start_time = updates.startTime;
  if (updates.elapsedSeconds !== undefined) updateData.elapsed_seconds = updates.elapsedSeconds;
  if (updates.memo !== undefined) updateData.memo = updates.memo;

  const { error } = await supabase
    .from('session_treatments')
    .update(updateData)
    .eq('id', treatmentId);

  if (error) {
    console.error('❌ 세션 치료 항목 업데이트 오류:', error);
    throw error;
  }
}

// 치료실 초기화 (환자 배정 해제)
export async function clearTreatmentRoom(roomId: number): Promise<void> {
  // 세션 치료 항목 먼저 삭제
  await supabase
    .from('session_treatments')
    .delete()
    .eq('room_id', roomId);

  // 치료실 초기화
  const { error } = await supabase
    .from('treatment_rooms')
    .update({
      status: '사용가능',
      session_id: null,
      patient_id: null,
      patient_name: null,
      patient_chart_number: null,
      doctor_name: null,
      in_time: null,
    })
    .eq('id', roomId);

  if (error) {
    console.error('❌ 치료실 초기화 오류:', error);
    throw error;
  }
}

// 치료실 추가 (초기 설정용)
export async function createTreatmentRoom(name: string): Promise<TreatmentRoom> {
  const { data, error } = await supabase
    .from('treatment_rooms')
    .insert({ name, status: '사용가능' })
    .select()
    .single();

  if (error) {
    console.error('치료실 추가 오류:', error);
    throw error;
  }

  return {
    id: data.id,
    name: data.name,
    status: data.status,
    sessionTreatments: [],
  };
}

// 치료실 삭제
export async function deleteTreatmentRoom(roomId: number): Promise<void> {
  const { error } = await supabase.from('treatment_rooms').delete().eq('id', roomId);

  if (error) {
    console.error('치료실 삭제 오류:', error);
    throw error;
  }
}

/**
 * 치료항목 관리 API
 */

// 치료항목 조회
export async function fetchTreatmentItems(): Promise<TreatmentItem[]> {
  const { data, error } = await supabase
    .from('treatment_items')
    .select('*')
    .order('display_order', { ascending: true })
    .order('id', { ascending: true });

  if (error) {
    console.error('치료항목 조회 오류:', error);
    throw error;
  }

  return (data || []).map((item) => ({
    id: item.id,
    name: item.name,
    defaultDuration: item.default_duration,
    displayOrder: item.display_order ?? 0,
  }));
}

// 치료항목 생성
export async function createTreatmentItem(item: Omit<TreatmentItem, 'id'>): Promise<TreatmentItem> {
  const { data, error } = await supabase
    .from('treatment_items')
    .insert({
      name: item.name,
      default_duration: item.defaultDuration,
      display_order: item.displayOrder,
    })
    .select()
    .single();

  if (error) {
    console.error('치료항목 추가 오류:', error);
    throw error;
  }

  return {
    id: data.id,
    name: data.name,
    defaultDuration: data.default_duration,
    displayOrder: data.display_order ?? 0,
  };
}

// 치료항목 수정
export async function updateTreatmentItem(id: number, item: Omit<TreatmentItem, 'id'>): Promise<TreatmentItem> {
  const { data, error } = await supabase
    .from('treatment_items')
    .update({
      name: item.name,
      default_duration: item.defaultDuration,
      display_order: item.displayOrder,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('치료항목 수정 오류:', error);
    throw error;
  }

  return {
    id: data.id,
    name: data.name,
    defaultDuration: data.default_duration,
    displayOrder: data.display_order ?? 0,
  };
}

// 치료항목 삭제
export async function deleteTreatmentItem(id: number): Promise<void> {
  const { data, error } = await supabase.from('treatment_items').delete().eq('id', id).select();

  if (error) {
    console.error('❌ 치료항목 삭제 오류:', error);
    throw error;
  }

  if (!data || data.length === 0) {
    throw new Error('치료항목 삭제 권한이 없거나 해당 항목이 존재하지 않습니다.');
  }
}

// 치료항목 순서 일괄 업데이트
export async function updateTreatmentItemsOrder(
  items: Array<{ id: number; displayOrder: number }>
): Promise<void> {
  const updatePromises = items.map((item) =>
    supabase.from('treatment_items').update({ display_order: item.displayOrder }).eq('id', item.id)
  );

  const results = await Promise.all(updatePromises);
  const errors = results.filter((r) => r.error).map((r) => r.error);

  if (errors.length > 0) {
    console.error('❌ 치료항목 순서 업데이트 오류:', errors);
    throw errors[0];
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
  const { data, error } = await supabase
    .from('waiting_queue')
    .select('*')
    .eq('queue_type', queueType)
    .order('position', { ascending: true });

  if (error) {
    console.error(`❌ ${queueType} 대기 목록 조회 오류:`, error);
    throw error;
  }

  return data || [];
}

// 대기 목록에 환자 추가
export async function addToWaitingQueue(item: Omit<WaitingQueueItem, 'id' | 'created_at'>): Promise<WaitingQueueItem> {
  // 먼저 같은 큐에 이미 있는지 확인하고 있으면 삭제
  await supabase
    .from('waiting_queue')
    .delete()
    .eq('patient_id', item.patient_id)
    .eq('queue_type', item.queue_type);

  // 현재 최대 position 조회
  const { data: maxData } = await supabase
    .from('waiting_queue')
    .select('position')
    .eq('queue_type', item.queue_type)
    .order('position', { ascending: false })
    .limit(1);

  const nextPosition = maxData && maxData.length > 0 ? maxData[0].position + 1 : 0;

  const { data, error } = await supabase
    .from('waiting_queue')
    .insert({
      patient_id: item.patient_id,
      queue_type: item.queue_type,
      details: item.details,
      position: nextPosition,
    })
    .select()
    .single();

  if (error) {
    console.error('❌ 대기 목록 추가 오류:', error);
    throw error;
  }

  return data;
}

// 대기 목록에서 환자 제거
export async function removeFromWaitingQueue(patientId: number, queueType: 'consultation' | 'treatment'): Promise<void> {
  const { error } = await supabase
    .from('waiting_queue')
    .delete()
    .eq('patient_id', patientId)
    .eq('queue_type', queueType);

  if (error) {
    console.error('❌ 대기 목록 제거 오류:', error);
    throw error;
  }
}

// 대기 목록 순서 업데이트
export async function updateWaitingQueueOrder(
  queueType: 'consultation' | 'treatment',
  patientIds: number[]
): Promise<void> {
  const updatePromises = patientIds.map((patientId, index) =>
    supabase
      .from('waiting_queue')
      .update({ position: index })
      .eq('patient_id', patientId)
      .eq('queue_type', queueType)
  );

  const results = await Promise.all(updatePromises);
  const errors = results.filter((r) => r.error).map((r) => r.error);

  if (errors.length > 0) {
    console.error('❌ 대기 목록 순서 업데이트 오류:', errors);
    throw errors[0];
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
  const { data: historyData, error: historyError } = await supabase
    .from('treatment_history')
    .select('details, memo')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false })
    .limit(1);

  if (!historyError && historyData && historyData.length > 0) {
    return historyData[0];
  }

  // treatment_history가 없으면 waiting_queue에서 마지막 기록 조회
  const { data: queueData, error: queueError } = await supabase
    .from('waiting_queue')
    .select('details, memo')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false })
    .limit(1);

  if (!queueError && queueData && queueData.length > 0) {
    return queueData[0];
  }

  return null;
}

/**
 * 진료항목 관리 API
 * consultation_items, consultation_sub_items 테이블 사용
 */

// 진료항목 전체 조회 (세부항목 포함)
export async function fetchConsultationItems(): Promise<ConsultationItem[]> {
  const { data, error } = await supabase
    .from('consultation_items')
    .select(`
      *,
      consultation_sub_items (*)
    `)
    .order('display_order', { ascending: true });

  if (error) {
    console.error('❌ 진료항목 조회 오류:', error);
    throw error;
  }

  return (data || []).map((item) => ({
    id: item.id,
    name: item.name,
    displayOrder: item.display_order ?? 0,
    subItems: (item.consultation_sub_items || [])
      .sort((a: any, b: any) => (a.display_order ?? 0) - (b.display_order ?? 0))
      .map((sub: any) => ({
        id: sub.id,
        name: sub.name,
        displayOrder: sub.display_order ?? 0,
      })),
  }));
}

// 진료항목 생성
export async function createConsultationItem(item: Omit<ConsultationItem, 'id' | 'subItems'>): Promise<ConsultationItem> {
  const { data, error } = await supabase
    .from('consultation_items')
    .insert({
      name: item.name,
      display_order: item.displayOrder,
    })
    .select()
    .single();

  if (error) {
    console.error('❌ 진료항목 생성 오류:', error);
    throw error;
  }

  return {
    id: data.id,
    name: data.name,
    displayOrder: data.display_order ?? 0,
    subItems: [],
  };
}

// 진료항목 수정
export async function updateConsultationItem(id: number, item: { name: string; displayOrder: number }): Promise<void> {
  const { error } = await supabase
    .from('consultation_items')
    .update({
      name: item.name,
      display_order: item.displayOrder,
    })
    .eq('id', id);

  if (error) {
    console.error('❌ 진료항목 수정 오류:', error);
    throw error;
  }
}

// 진료항목 삭제 (세부항목도 함께 삭제됨 - CASCADE)
export async function deleteConsultationItem(id: number): Promise<void> {
  const { error } = await supabase
    .from('consultation_items')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('❌ 진료항목 삭제 오류:', error);
    throw error;
  }
}

// 진료항목 순서 일괄 업데이트
export async function updateConsultationItemsOrder(
  items: Array<{ id: number; displayOrder: number }>
): Promise<void> {
  const updatePromises = items.map((item) =>
    supabase.from('consultation_items').update({ display_order: item.displayOrder }).eq('id', item.id)
  );

  const results = await Promise.all(updatePromises);
  const errors = results.filter((r) => r.error).map((r) => r.error);

  if (errors.length > 0) {
    console.error('❌ 진료항목 순서 업데이트 오류:', errors);
    throw new Error('진료항목 순서 업데이트 중 오류가 발생했습니다.');
  }
}

// 세부항목 생성
export async function createConsultationSubItem(
  parentId: number,
  subItem: Omit<ConsultationSubItem, 'id'>
): Promise<ConsultationSubItem> {
  const { data, error } = await supabase
    .from('consultation_sub_items')
    .insert({
      parent_id: parentId,
      name: subItem.name,
      display_order: subItem.displayOrder,
    })
    .select()
    .single();

  if (error) {
    console.error('❌ 세부항목 생성 오류:', error);
    throw error;
  }

  return {
    id: data.id,
    name: data.name,
    displayOrder: data.display_order ?? 0,
  };
}

// 세부항목 수정
export async function updateConsultationSubItem(id: number, subItem: { name: string; displayOrder: number }): Promise<void> {
  const { error } = await supabase
    .from('consultation_sub_items')
    .update({
      name: subItem.name,
      display_order: subItem.displayOrder,
    })
    .eq('id', id);

  if (error) {
    console.error('❌ 세부항목 수정 오류:', error);
    throw error;
  }
}

// 세부항목 삭제
export async function deleteConsultationSubItem(id: number): Promise<void> {
  const { error } = await supabase
    .from('consultation_sub_items')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('❌ 세부항목 삭제 오류:', error);
    throw error;
  }
}

// 세부항목 순서 일괄 업데이트
export async function updateConsultationSubItemsOrder(
  items: Array<{ id: number; displayOrder: number }>
): Promise<void> {
  const updatePromises = items.map((item) =>
    supabase.from('consultation_sub_items').update({ display_order: item.displayOrder }).eq('id', item.id)
  );

  const results = await Promise.all(updatePromises);
  const errors = results.filter((r) => r.error).map((r) => r.error);

  if (errors.length > 0) {
    console.error('❌ 세부항목 순서 업데이트 오류:', errors);
    throw new Error('세부항목 순서 업데이트 중 오류가 발생했습니다.');
  }
}
