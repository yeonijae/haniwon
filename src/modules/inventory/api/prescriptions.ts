/**
 * 처방전 API - Supabase 직접 연결
 */

import { supabase } from '@shared/lib/supabase';

// 처방 정의 (마스터 데이터)
export interface PrescriptionDefinition {
  id: number;
  name: string;
  alias?: string;
  category?: string;
  source?: string;
  composition: string; // "약재명:용량/약재명:용량/..." 형식
  created_at: string;
  created_by: string;
  is_active: boolean;
}

// 실제 발행된 처방전
export interface Prescription {
  id: number;
  prescription_definition_id?: number;
  patient_name?: string;
  prescription_name: string;
  composition: string;
  issued_date: string;
  issued_by: string;
  notes?: string;
  created_at: string;
}

export const prescriptionDefinitionsApi = {
  // 모든 처방 정의 조회
  getAll: async (params?: { isActive?: boolean }): Promise<PrescriptionDefinition[]> => {
    let query = supabase
      .from('prescription_definitions')
      .select('*')
      .order('name', { ascending: true });

    if (params?.isActive !== undefined) {
      query = query.eq('is_active', params.isActive);
    }

    const { data, error } = await query;

    if (error) throw new Error(error.message);
    return data || [];
  },

  // 최근 처방 정의 조회
  getRecent: async (limit: number = 15): Promise<PrescriptionDefinition[]> => {
    const { data, error } = await supabase
      .from('prescription_definitions')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw new Error(error.message);
    return data || [];
  },

  // 처방 정의 생성
  create: async (prescriptionData: Partial<PrescriptionDefinition>): Promise<PrescriptionDefinition> => {
    const { data, error } = await supabase
      .from('prescription_definitions')
      .insert({
        name: prescriptionData.name,
        alias: prescriptionData.alias,
        category: prescriptionData.category,
        source: prescriptionData.source,
        composition: prescriptionData.composition,
        created_by: prescriptionData.created_by || '관리자',
        is_active: prescriptionData.is_active !== undefined ? prescriptionData.is_active : true,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  },

  // 처방 정의 수정
  update: async (id: number, prescriptionData: Partial<PrescriptionDefinition>): Promise<PrescriptionDefinition> => {
    const { data, error } = await supabase
      .from('prescription_definitions')
      .update({
        name: prescriptionData.name,
        alias: prescriptionData.alias,
        category: prescriptionData.category,
        source: prescriptionData.source,
        composition: prescriptionData.composition,
        is_active: prescriptionData.is_active
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  },

  // 처방 정의 삭제 (비활성화)
  delete: async (id: number): Promise<void> => {
    const { error } = await supabase
      .from('prescription_definitions')
      .update({ is_active: false })
      .eq('id', id);

    if (error) throw new Error(error.message);
  }
};

// 실제 발행된 처방전 API
export const prescriptionsApi = {
  // 모든 처방전 조회
  getAll: async (): Promise<Prescription[]> => {
    const { data, error } = await supabase
      .from('prescriptions')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
  },

  // 최근 처방전 조회
  getRecent: async (limit: number = 15): Promise<Prescription[]> => {
    const { data, error } = await supabase
      .from('prescriptions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw new Error(error.message);
    return data || [];
  },

  // 처방전 발행
  create: async (prescriptionData: Partial<Prescription>): Promise<Prescription> => {
    const { data, error } = await supabase
      .from('prescriptions')
      .insert({
        prescription_definition_id: prescriptionData.prescription_definition_id,
        patient_name: prescriptionData.patient_name,
        prescription_name: prescriptionData.prescription_name,
        composition: prescriptionData.composition,
        issued_date: prescriptionData.issued_date || new Date().toISOString().split('T')[0],
        issued_by: prescriptionData.issued_by || '관리자',
        notes: prescriptionData.notes,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  },

  // 처방전 수정
  update: async (id: number, prescriptionData: Partial<Prescription>): Promise<Prescription> => {
    const { data, error } = await supabase
      .from('prescriptions')
      .update({
        prescription_definition_id: prescriptionData.prescription_definition_id,
        patient_name: prescriptionData.patient_name,
        prescription_name: prescriptionData.prescription_name,
        composition: prescriptionData.composition,
        issued_date: prescriptionData.issued_date,
        issued_by: prescriptionData.issued_by,
        notes: prescriptionData.notes
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  },

  // 처방전 삭제
  delete: async (id: number): Promise<void> => {
    const { error } = await supabase
      .from('prescriptions')
      .delete()
      .eq('id', id);

    if (error) throw new Error(error.message);
  }
};
