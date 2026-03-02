/**
 * RecordingContext - 녹음/변환 상태를 앱 전역에서 관리
 * DoctorApp에서 Provider로 감싸고, InitialChartView에서 상태 업데이트,
 * DoctorTaskSidebar에서 현황 표시
 */
import React, { createContext, useContext, useState, useCallback } from 'react';

export type RecordingStatus = 'recording' | 'saving' | 'transcribing' | 'analyzing' | 'completed' | 'error';

export interface RecordingEntry {
  id: string;                 // 고유 ID (timestamp 기반)
  patientName: string;
  chartNumber: string;
  patientId: number;
  status: RecordingStatus;
  startedAt: number;          // timestamp ms
  duration?: number;          // seconds
  transcript?: string;        // 변환된 텍스트 미리보기
  errorMessage?: string;
  transcriptId?: number;      // DB 저장 후 ID
}

interface RecordingContextType {
  entries: RecordingEntry[];
  addEntry: (entry: Omit<RecordingEntry, 'id' | 'startedAt'>) => string;
  updateEntry: (id: string, updates: Partial<RecordingEntry>) => void;
  removeEntry: (id: string) => void;
  clearCompleted: () => void;
}

const RecordingContext = createContext<RecordingContextType | undefined>(undefined);

export const RecordingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [entries, setEntries] = useState<RecordingEntry[]>([]);

  const addEntry = useCallback((entry: Omit<RecordingEntry, 'id' | 'startedAt'>) => {
    const id = `rec_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const newEntry: RecordingEntry = { ...entry, id, startedAt: Date.now() };
    setEntries(prev => [newEntry, ...prev]);
    return id;
  }, []);

  const updateEntry = useCallback((id: string, updates: Partial<RecordingEntry>) => {
    setEntries(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
  }, []);

  const removeEntry = useCallback((id: string) => {
    setEntries(prev => prev.filter(e => e.id !== id));
  }, []);

  const clearCompleted = useCallback(() => {
    setEntries(prev => prev.filter(e => e.status !== 'completed'));
  }, []);

  return (
    <RecordingContext.Provider value={{ entries, addEntry, updateEntry, removeEntry, clearCompleted }}>
      {children}
    </RecordingContext.Provider>
  );
};

export function useRecordingContext() {
  const ctx = useContext(RecordingContext);
  if (!ctx) throw new Error('useRecordingContext must be used within RecordingProvider');
  return ctx;
}
