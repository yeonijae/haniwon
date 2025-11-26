/**
 * Supabase 데이터베이스 타입 정의
 * 실제 테이블 구조에 맞춰 자동 생성되거나 수동으로 관리
 */

export interface Database {
  public: {
    Tables: {
      patients: {
        Row: {
          id: number;
          name: string;
          chart_number: string | null;
          dob: string | null;
          gender: string | null;
          phone: string | null;
          address: string | null;
          referral_path: string | null;
          registration_date: string | null;
          deletion_date: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          name: string;
          chart_number?: string | null;
          dob?: string | null;
          gender?: string | null;
          phone?: string | null;
          address?: string | null;
          referral_path?: string | null;
          registration_date?: string | null;
          deletion_date?: string | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          name?: string;
          chart_number?: string | null;
          dob?: string | null;
          gender?: string | null;
          phone?: string | null;
          address?: string | null;
          referral_path?: string | null;
          registration_date?: string | null;
          deletion_date?: string | null;
          created_at?: string;
        };
      };
      reservations: {
        Row: {
          id: string;
          patient_id: number;
          doctor: string;
          reservation_date: string;
          reservation_time: string;
          status: string;
          memo: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          patient_id: number;
          doctor: string;
          reservation_date: string;
          reservation_time: string;
          status?: string;
          memo?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          patient_id?: number;
          doctor?: string;
          reservation_date?: string;
          reservation_time?: string;
          status?: string;
          memo?: string | null;
          created_at?: string;
        };
      };
      reservation_treatments: {
        Row: {
          id: number;
          reservation_id: string;
          treatment_name: string;
          acting: number;
          created_at: string;
        };
        Insert: {
          id?: number;
          reservation_id: string;
          treatment_name: string;
          acting: number;
          created_at?: string;
        };
        Update: {
          id?: number;
          reservation_id?: string;
          treatment_name?: string;
          acting?: number;
          created_at?: string;
        };
      };
      payments: {
        Row: {
          id: number;
          patient_id: number;
          reservation_id: string | null;
          total_amount: number | null;
          paid_amount: number | null;
          remaining_amount: number | null;
          payment_methods: any; // JSONB
          treatment_items: any; // JSONB
          payment_date: string;
          is_completed: boolean;
        };
        Insert: {
          id?: number;
          patient_id: number;
          reservation_id?: string | null;
          total_amount?: number | null;
          paid_amount?: number | null;
          remaining_amount?: number | null;
          payment_methods?: any;
          treatment_items?: any;
          payment_date?: string;
          is_completed?: boolean;
        };
        Update: {
          id?: number;
          patient_id?: number;
          reservation_id?: string | null;
          total_amount?: number | null;
          paid_amount?: number | null;
          remaining_amount?: number | null;
          payment_methods?: any;
          treatment_items?: any;
          payment_date?: string;
          is_completed?: boolean;
        };
      };
      patient_default_treatments: {
        Row: {
          id: number;
          patient_id: number;
          treatment_name: string;
          duration: number;
          memo: string | null;
        };
        Insert: {
          id?: number;
          patient_id: number;
          treatment_name: string;
          duration: number;
          memo?: string | null;
        };
        Update: {
          id?: number;
          patient_id?: number;
          treatment_name?: string;
          duration?: number;
          memo?: string | null;
        };
      };
      acting_queue_items: {
        Row: {
          id: string;
          doctor: string;
          patient_id: number;
          acting_type: string;
          duration: number;
          source: string;
          memo: string | null;
          position: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          doctor: string;
          patient_id: number;
          acting_type: string;
          duration: number;
          source: string;
          memo?: string | null;
          position: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          doctor?: string;
          patient_id?: number;
          acting_type?: string;
          duration?: number;
          source?: string;
          memo?: string | null;
          position?: number;
          created_at?: string;
        };
      };
    };
  };
}
