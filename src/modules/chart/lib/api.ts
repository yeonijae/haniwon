/**
 * 진료 관리 시스템 - API 클라이언트
 * 통합 API 서버(hani-api-server)를 통해 DB에 접근
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// 공통 fetch 래퍼
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
    console.error(`API Error [${response.status}]:`, error);
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * 환자 관련 API
 */

// 환자 목록 조회
export async function fetchPatients(search?: string): Promise<any[]> {
  const query = search ? `?search=${encodeURIComponent(search)}` : '';
  return fetchAPI<any[]>(`/api/patients${query}`);
}

// 환자 상세 조회
export async function fetchPatientById(patientId: number): Promise<any> {
  return fetchAPI<any>(`/api/patients/${patientId}`);
}

/**
 * 차트 관련 API
 */

// 환자 전체 차트 정보 조회
export async function fetchPatientFullChart(patientId: number): Promise<any> {
  return fetchAPI<any>(`/api/charts/patient/${patientId}`);
}

// 초진차트 목록 조회
export async function fetchInitialCharts(patientId?: number): Promise<any[]> {
  const query = patientId ? `?patientId=${patientId}` : '';
  return fetchAPI<any[]>(`/api/charts/initial${query}`);
}

// 초진차트 상세 조회
export async function fetchInitialChartById(chartId: number): Promise<any> {
  return fetchAPI<any>(`/api/charts/initial/${chartId}`);
}

// 초진차트 생성
export async function createInitialChart(data: any): Promise<any> {
  return fetchAPI<any>('/api/charts/initial', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// 초진차트 수정
export async function updateInitialChart(chartId: number, data: any): Promise<any> {
  return fetchAPI<any>(`/api/charts/initial/${chartId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// 초진차트 삭제
export async function deleteInitialChart(chartId: number): Promise<void> {
  await fetchAPI(`/api/charts/initial/${chartId}`, { method: 'DELETE' });
}

/**
 * 진단기록 API
 */

// 진단기록 목록 조회
export async function fetchDiagnoses(params?: { patientId?: number; status?: string }): Promise<any[]> {
  const query = new URLSearchParams();
  if (params?.patientId) query.set('patientId', String(params.patientId));
  if (params?.status) query.set('status', params.status);
  const queryStr = query.toString();
  return fetchAPI<any[]>(`/api/charts/diagnoses${queryStr ? `?${queryStr}` : ''}`);
}

// 진단기록 생성
export async function createDiagnosis(data: any): Promise<any> {
  return fetchAPI<any>('/api/charts/diagnoses', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// 진단기록 수정
export async function updateDiagnosis(diagnosisId: number, data: any): Promise<any> {
  return fetchAPI<any>(`/api/charts/diagnoses/${diagnosisId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// 진단기록 삭제
export async function deleteDiagnosis(diagnosisId: number): Promise<void> {
  await fetchAPI(`/api/charts/diagnoses/${diagnosisId}`, { method: 'DELETE' });
}

/**
 * 경과기록 API (SOAP)
 */

// 경과기록 목록 조회
export async function fetchProgressNotes(patientId?: number): Promise<any[]> {
  const query = patientId ? `?patientId=${patientId}` : '';
  return fetchAPI<any[]>(`/api/charts/progress-notes${query}`);
}

// 경과기록 생성
export async function createProgressNote(data: any): Promise<any> {
  return fetchAPI<any>('/api/charts/progress-notes', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// 경과기록 수정
export async function updateProgressNote(noteId: number, data: any): Promise<any> {
  return fetchAPI<any>(`/api/charts/progress-notes/${noteId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// 경과기록 삭제
export async function deleteProgressNote(noteId: number): Promise<void> {
  await fetchAPI(`/api/charts/progress-notes/${noteId}`, { method: 'DELETE' });
}

/**
 * 처방전 관련 API
 */

// 처방전 목록 조회
export async function fetchPrescriptions(params?: { patientId?: number; status?: string }): Promise<any[]> {
  const query = new URLSearchParams();
  if (params?.patientId) query.set('patientId', String(params.patientId));
  if (params?.status) query.set('status', params.status);
  const queryStr = query.toString();
  return fetchAPI<any[]>(`/api/prescriptions${queryStr ? `?${queryStr}` : ''}`);
}

// 처방전 상세 조회
export async function fetchPrescriptionById(prescriptionId: number): Promise<any> {
  return fetchAPI<any>(`/api/prescriptions/${prescriptionId}`);
}

// 처방전 생성
export async function createPrescription(data: any): Promise<any> {
  return fetchAPI<any>('/api/prescriptions', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// 처방전 수정
export async function updatePrescription(prescriptionId: number, data: any): Promise<any> {
  return fetchAPI<any>(`/api/prescriptions/${prescriptionId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

/**
 * 하위 호환을 위한 Supabase 스타일 API
 * 기존 코드에서 supabase를 직접 사용하던 부분을 점진적으로 마이그레이션
 */

// supabase 스타일의 체이닝을 위한 헬퍼
export const api = {
  patients: {
    getAll: () => fetchPatients(),
    search: (term: string) => fetchPatients(term),
    getById: (id: number) => fetchPatientById(id),
  },
  charts: {
    initial: {
      getByPatientId: (patientId: number) => fetchInitialCharts(patientId),
      create: (data: any) => createInitialChart(data),
      update: (id: number, data: any) => updateInitialChart(id, data),
      delete: (id: number) => deleteInitialChart(id),
    },
    diagnoses: {
      getByPatientId: (patientId: number) => fetchDiagnoses({ patientId }),
      create: (data: any) => createDiagnosis(data),
      update: (id: number, data: any) => updateDiagnosis(id, data),
      delete: (id: number) => deleteDiagnosis(id),
    },
    progressNotes: {
      getByPatientId: (patientId: number) => fetchProgressNotes(patientId),
      create: (data: any) => createProgressNote(data),
      update: (id: number, data: any) => updateProgressNote(id, data),
      delete: (id: number) => deleteProgressNote(id),
    },
    getFullChart: (patientId: number) => fetchPatientFullChart(patientId),
  },
  prescriptions: {
    getAll: (params?: { patientId?: number; status?: string }) => fetchPrescriptions(params),
    getById: (id: number) => fetchPrescriptionById(id),
    create: (data: any) => createPrescription(data),
    update: (id: number, data: any) => updatePrescription(id, data),
  },
};

export default api;
