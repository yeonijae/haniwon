/**
 * 처방전 API - hani-api-server 통합
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

async function fetchAPI<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

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
  getAll: async (params?: { isActive?: boolean }) => {
    const query = new URLSearchParams();
    if (params?.isActive !== undefined) query.set('isActive', String(params.isActive));
    const queryStr = query.toString();

    return fetchAPI<PrescriptionDefinition[]>(`/api/prescriptions/definitions${queryStr ? `?${queryStr}` : ''}`);
  },

  // 최근 처방 정의 조회
  getRecent: async (limit: number = 15) => {
    return fetchAPI<PrescriptionDefinition[]>(`/api/prescriptions/definitions/recent?limit=${limit}`);
  },

  // 처방 정의 생성
  create: async (data: Partial<PrescriptionDefinition>) => {
    return fetchAPI<PrescriptionDefinition>('/api/prescriptions/definitions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // 처방 정의 수정
  update: async (id: number, data: Partial<PrescriptionDefinition>) => {
    return fetchAPI<PrescriptionDefinition>(`/api/prescriptions/definitions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // 처방 정의 삭제 (비활성화)
  delete: async (id: number) => {
    return fetchAPI(`/api/prescriptions/definitions/${id}`, { method: 'DELETE' });
  }
};

// 실제 발행된 처방전 API
export const prescriptionsApi = {
  // 모든 처방전 조회
  getAll: async () => {
    return fetchAPI<Prescription[]>('/api/prescriptions');
  },

  // 최근 처방전 조회
  getRecent: async (limit: number = 15) => {
    return fetchAPI<Prescription[]>(`/api/prescriptions/recent?limit=${limit}`);
  },

  // 처방전 발행
  create: async (data: Partial<Prescription>) => {
    return fetchAPI<Prescription>('/api/prescriptions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // 처방전 수정
  update: async (id: number, data: Partial<Prescription>) => {
    return fetchAPI<Prescription>(`/api/prescriptions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // 처방전 삭제
  delete: async (id: number) => {
    return fetchAPI(`/api/prescriptions/${id}`, { method: 'DELETE' });
  }
};
