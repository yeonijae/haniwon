/**
 * 소모품 요청 API - hani-api-server 통합
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

export interface SupplyRequest {
  id: number;
  item_name: string;
  quantity?: string;
  requested_by: string;
  status: 'pending' | 'completed';
  note?: string;
  created_at: string;
  completed_at?: string;
}

export const suppliesApi = {
  getAll: async () => {
    return fetchAPI<SupplyRequest[]>('/api/materials/supply-requests');
  },

  create: async (data: Partial<SupplyRequest>) => {
    return fetchAPI<SupplyRequest>('/api/materials/supply-requests', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update: async (id: number, data: Partial<SupplyRequest>) => {
    return fetchAPI<SupplyRequest>(`/api/materials/supply-requests/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  toggleComplete: async (id: number, currentStatus: string) => {
    const newStatus = currentStatus === 'pending' ? 'completed' : 'pending';
    return fetchAPI<SupplyRequest>(`/api/materials/supply-requests/${id}`, {
      method: 'PUT',
      body: JSON.stringify({
        status: newStatus,
        completed_at: newStatus === 'completed' ? new Date().toISOString() : null,
      }),
    });
  },

  delete: async (id: number) => {
    return fetchAPI(`/api/materials/supply-requests/${id}`, { method: 'DELETE' });
  },

  getStats: async () => {
    return fetchAPI<{ pending: number; completed: number }>('/api/materials/supply-requests/stats');
  }
};
