/**
 * 치료관리 모듈 - API 클라이언트
 * Supabase 직접 연결
 */

import { Patient, TreatmentRoom, TreatmentItem, SessionTreatment, DefaultTreatment } from '../types';
import { supabase } from '@shared/lib/supabase';

/**
 * 환자 관련 API
 */

// 환자 검색 (서버사이드)
export async function searchPatients(searchTerm: string): Promise<Patient[]> {
  if (!searchTerm || searchTerm.trim().length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from('patients')
    .select('*')
    .is('deletion_date', null)
    .or(`name.ilike.%${searchTerm}%,chart_number.ilike.%${searchTerm}%`)
    .order('id', { ascending: true });

  if (error) {
    console.error('❌ 환자 검색 오류:', error);
    throw error;
  }

  return (data || []).map((p) => ({
    id: p.id,
    name: p.name,
    chartNumber: p.chart_number || '',
    status: 'COMPLETED' as any,
    time: '',
    details: '',
    dob: p.dob || undefined,
    gender: p.gender as 'male' | 'female' | undefined,
    phone: p.phone || undefined,
    address: p.address || undefined,
    referralPath: p.referral_path || undefined,
    registrationDate: p.registration_date || undefined,
  }));
}

// 개별 환자 조회 (ID로)
export async function fetchPatientById(patientId: number): Promise<Patient | null> {
  const { data, error } = await supabase
    .from('patients')
    .select('*')
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

  return {
    id: data.id,
    name: data.name,
    chartNumber: data.chart_number || '',
    status: 'COMPLETED' as any,
    time: '',
    details: '',
    dob: data.dob || undefined,
    gender: data.gender as 'male' | 'female' | undefined,
    phone: data.phone || undefined,
    address: data.address || undefined,
    referralPath: data.referral_path || undefined,
    registrationDate: data.registration_date || undefined,
  };
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
    doctorName: room.doctor_name,
    inTime: room.in_time,
    sessionTreatments: (room.session_treatments || []).map((st: any) => ({
      id: st.id,
      name: st.name,
      status: st.status,
      duration: st.duration,
      startTime: st.start_time ? st.start_time + 'Z' : null,
      elapsedSeconds: st.elapsed_seconds || 0,
      memo: st.memo,
    })),
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

/**
 * 대기 목록 관리 API
 * waiting_queue 테이블 사용
 */

export interface WaitingQueueItem {
  id?: number;
  patient_id: number;
  queue_type: 'consultation' | 'treatment';
  details: string;
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
