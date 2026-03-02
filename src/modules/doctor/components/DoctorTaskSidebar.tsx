/**
 * DoctorTaskSidebar - 처방·복용법 대기 + 녹취현황 (컨텐츠 오른쪽)
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPendingPrescriptionsByDoctor } from '@modules/cs/lib/decoctionApi';
import { getDosagePendingByDoctor } from '../lib/dashboardApi';
import { useRecordingContext, type RecordingStatus } from '../contexts/RecordingContext';
import type { HerbalPackage } from '@modules/cs/types';

type PendingItem = HerbalPackage & {
  days_until_decoction: number;
  source_type?: string;
  pending_type?: 'prescription' | 'dosage';
};

interface Props {
  doctorId: number;
  doctorName: string;
  onPatientClick?: (patientId: string, chartNumber: string) => void;
}

const STATUS_CONFIG: Record<RecordingStatus, { label: string; color: string; icon: string; animate?: boolean }> = {
  recording:    { label: '녹음중',   color: 'bg-red-100 text-red-700',      icon: '🔴', animate: true },
  saving:       { label: '저장중',   color: 'bg-yellow-100 text-yellow-700', icon: '💾' },
  transcribing: { label: '변환중',   color: 'bg-blue-100 text-blue-700',     icon: '🔄', animate: true },
  analyzing:    { label: '분석중',   color: 'bg-purple-100 text-purple-700', icon: '🧠', animate: true },
  completed:    { label: '완료',     color: 'bg-green-100 text-green-700',   icon: '✅' },
  error:        { label: '오류',     color: 'bg-red-100 text-red-700',       icon: '❌' },
};

export default function DoctorTaskSidebar({ doctorId, doctorName, onPatientClick }: Props) {
  const navigate = useNavigate();
  const [items, setItems] = useState<PendingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [recTab, setRecTab] = useState<'active' | 'completed'>('active');
  const { entries, removeEntry, clearCompleted } = useRecordingContext();

  const load = useCallback(async () => {
    try {
      const [rxData, dosageData] = await Promise.all([
        getPendingPrescriptionsByDoctor(doctorId, doctorName),
        getDosagePendingByDoctor(doctorId),
      ]);
      const rx = (rxData as PendingItem[]).map(p => ({ ...p, pending_type: 'prescription' as const }));
      const dos = (dosageData as PendingItem[]).map(p => ({ ...p, pending_type: 'dosage' as const }));
      setItems([...rx, ...dos].sort((a, b) => (a.days_until_decoction ?? 999) - (b.days_until_decoction ?? 999)));
    } catch (e) {
      console.error('업무대기 로드 오류:', e);
    } finally {
      setLoading(false);
    }
  }, [doctorId, doctorName]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  const handleClick = (item: PendingItem) => {
    if (onPatientClick) {
      onPatientClick(String(item.patient_id), item.chart_number);
    } else {
      navigate(`/doctor/patients/${item.patient_id}?chartNo=${item.chart_number}`);
    }
  };

  const getUrgencyBadge = (days: number) => {
    if (days >= 999) return { cls: '', label: '미정' };
    if (days <= 0) return { cls: 'd-day', label: 'D-Day' };
    if (days === 1) return { cls: 'd-1', label: 'D-1' };
    if (days === 2) return { cls: 'd-2', label: 'D-2' };
    return { cls: '', label: `D-${days}` };
  };

  const hasUrgent = items.some(p => p.days_until_decoction <= 1);

  // 녹취 엔트리 분류
  const activeEntries = entries.filter(e => e.status !== 'completed');
  const completedEntries = entries.filter(e => e.status === 'completed');
  const displayEntries = recTab === 'active' ? activeEntries : completedEntries;
  const hasActiveRecording = activeEntries.length > 0;

  const formatDuration = (startedAt: number, duration?: number) => {
    const sec = duration || Math.floor((Date.now() - startedAt) / 1000);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  return (
    <aside className="doctor-sidebar doctor-sidebar-right" style={{ display: 'flex', flexDirection: 'column' }}>
      {/* 업무 대기 */}
      <div className="doctor-sidebar-section" style={{ flex: '1 1 auto', overflow: 'auto' }}>
        <div className="doctor-sidebar-section-header">
          <span className="doctor-sidebar-section-title">💊 업무 대기</span>
          <span className={`doctor-sidebar-section-count ${hasUrgent ? 'urgent' : ''}`}>
            {items.length}
          </span>
        </div>
        <ul className="doctor-sidebar-list">
          {loading && <li className="doctor-sidebar-empty">로딩 중...</li>}
          {!loading && items.length === 0 && (
            <li className="doctor-sidebar-empty">대기 항목 없음</li>
          )}
          {!loading && items.map(item => {
            const badge = getUrgencyBadge(item.days_until_decoction);
            return (
              <li
                key={`${item.pending_type}-${item.id}`}
                className={`doctor-sidebar-card ${item.days_until_decoction <= 1 ? 'urgent' : ''}`}
                onClick={() => handleClick(item)}
              >
                <div className="doctor-sidebar-card-row">
                  <span className="doctor-sidebar-card-name">{item.patient_name}</span>
                  <span className={`doctor-sidebar-card-badge ${badge.cls}`}>{badge.label}</span>
                </div>
                <div className="doctor-sidebar-card-sub">
                  <span className={`doctor-task-type ${item.pending_type}`}>
                    {item.pending_type === 'prescription' ? '처방전' : '복용법'}
                  </span>
                  {item.source_type === 'draft' && (
                    <span className="doctor-task-draft">탕약기록</span>
                  )}
                  <span>{item.herbal_name || item.chart_number}</span>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* 녹취 현황 */}
      <div style={{ flex: '0 0 auto', borderTop: '1px solid #e5e7eb' }}>
        <div className="doctor-sidebar-section-header" style={{ padding: '8px 12px' }}>
          <span className="doctor-sidebar-section-title" style={{ fontSize: '0.8rem' }}>
            🎙️ 녹취현황
            {hasActiveRecording && (
              <span style={{
                display: 'inline-block',
                width: 6, height: 6,
                borderRadius: '50%',
                backgroundColor: '#ef4444',
                marginLeft: 6,
                animation: 'pulse 1.5s infinite',
              }} />
            )}
          </span>
          <span className="doctor-sidebar-section-count">
            {activeEntries.length + completedEntries.length}
          </span>
        </div>

        {/* 탭 */}
        <div style={{ display: 'flex', padding: '0 8px', gap: 4, marginBottom: 4 }}>
          <button
            onClick={() => setRecTab('active')}
            style={{
              flex: 1, padding: '4px 0', fontSize: '0.7rem', fontWeight: 600,
              border: 'none', borderRadius: 4, cursor: 'pointer',
              backgroundColor: recTab === 'active' ? '#eff6ff' : 'transparent',
              color: recTab === 'active' ? '#2563eb' : '#9ca3af',
            }}
          >
            진행중 ({activeEntries.length})
          </button>
          <button
            onClick={() => setRecTab('completed')}
            style={{
              flex: 1, padding: '4px 0', fontSize: '0.7rem', fontWeight: 600,
              border: 'none', borderRadius: 4, cursor: 'pointer',
              backgroundColor: recTab === 'completed' ? '#f0fdf4' : 'transparent',
              color: recTab === 'completed' ? '#16a34a' : '#9ca3af',
            }}
          >
            완료 ({completedEntries.length})
          </button>
        </div>

        {/* 엔트리 목록 */}
        <div style={{ maxHeight: 200, overflowY: 'auto', padding: '0 8px 8px' }}>
          {displayEntries.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: '0.7rem', padding: '12px 0' }}>
              {recTab === 'active' ? '진행중인 녹취 없음' : '완료된 녹취 없음'}
            </div>
          ) : (
            displayEntries.map(entry => {
              const cfg = STATUS_CONFIG[entry.status];
              return (
                <div
                  key={entry.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '6px 8px', marginBottom: 4,
                    borderRadius: 6, backgroundColor: '#f9fafb',
                    fontSize: '0.75rem',
                  }}
                >
                  <span style={{ fontSize: '0.85rem', flexShrink: 0 }}>
                    {cfg.animate ? (
                      <span style={{ animation: 'pulse 1.5s infinite' }}>{cfg.icon}</span>
                    ) : cfg.icon}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, color: '#374151', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {entry.patientName}
                      <span style={{ fontWeight: 400, color: '#9ca3af', marginLeft: 4 }}>#{entry.chartNumber}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${cfg.color}`}
                        style={{ fontSize: '0.65rem' }}>
                        {cfg.label}
                      </span>
                      <span style={{ color: '#6b7280', fontSize: '0.65rem' }}>
                        {formatDuration(entry.startedAt, entry.duration)}
                      </span>
                    </div>
                    {entry.status === 'completed' && entry.transcript && (
                      <div style={{
                        marginTop: 2, color: '#6b7280', fontSize: '0.65rem',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {entry.transcript.substring(0, 40)}...
                      </div>
                    )}
                    {entry.status === 'error' && entry.errorMessage && (
                      <div style={{ marginTop: 2, color: '#dc2626', fontSize: '0.65rem' }}>
                        {entry.errorMessage}
                      </div>
                    )}
                  </div>
                  {entry.status === 'completed' && (
                    <button
                      onClick={(e) => { e.stopPropagation(); removeEntry(entry.id); }}
                      style={{ color: '#9ca3af', cursor: 'pointer', border: 'none', background: 'none', fontSize: '0.7rem' }}
                      title="삭제"
                    >✕</button>
                  )}
                </div>
              );
            })
          )}
          {recTab === 'completed' && completedEntries.length > 0 && (
            <button
              onClick={clearCompleted}
              style={{
                width: '100%', padding: '4px 0', fontSize: '0.65rem',
                color: '#9ca3af', border: 'none', background: 'none', cursor: 'pointer',
                marginTop: 4,
              }}
            >
              모두 지우기
            </button>
          )}
        </div>
      </div>

      {/* pulse animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </aside>
  );
}
