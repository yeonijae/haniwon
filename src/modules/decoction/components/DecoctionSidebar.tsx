import { useState, useEffect, useCallback } from 'react';
import type { WaitingDraft } from '../lib/api';
import { getWaitingDrafts } from '../lib/api';

const DELIVERY_MAP: Record<string, { bg: string; color: string; label: string }> = {
  pickup: { bg: '#dcfce7', color: '#16a34a', label: '내원' },
  express: { bg: '#dbeafe', color: '#2563eb', label: '택배' },
  quick: { bg: '#ffedd5', color: '#ea580c', label: '퀵' },
  other: { bg: '#f1f5f9', color: '#64748b', label: '기타' },
};

function deliveryBadge(method: string | null) {
  const s = DELIVERY_MAP[method ?? ''] ?? { bg: '#f1f5f9', color: '#64748b', label: method || '-' };
  return (
    <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

const TYPE_LABELS: Record<string, string> = {
  initial_herbal: '초진',
  followup_deduct: '재진(차감)',
  followup_payment: '재진(결제)',
  other: '기타상담',
};

interface Props {
  onSelectItem?: (item: WaitingDraft) => void;
  selectedId?: number | null;
  refreshKey?: number;
}

export default function DecoctionSidebar({ onSelectItem, selectedId, refreshKey }: Props) {
  const [waiting, setWaiting] = useState<WaitingDraft[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const w = await getWaitingDrafts();
      setWaiting(w);
    } catch (err) {
      console.error('대기목록 로드 실패:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => { setLoading(true); load(); }, [load, refreshKey]);

  useEffect(() => {
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, [load]);

  return (
    <div className="decoction-sidebar">
      <div className="decoction-sidebar-header">
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>⏳ 탕전 대기</h3>
        <span style={{ background: '#3b82f6', color: '#fff', borderRadius: 10, padding: '2px 10px', fontSize: 12, fontWeight: 600 }}>{waiting.length}</span>
      </div>
      <div className="decoction-sidebar-body">
        {loading && waiting.length === 0 && <div style={{ textAlign: 'center', color: '#94a3b8', padding: 16 }}>로딩...</div>}
        {!loading && waiting.length === 0 && (
          <div style={{ textAlign: 'center', color: '#94a3b8', padding: 32, fontSize: 13 }}>대기 중인 건이 없습니다</div>
        )}
        {waiting.map((d) => (
          <div
            key={d.id}
            className={`decoction-sidebar-card ${selectedId === d.id ? 'selected' : ''} ${d.delivery_method === 'express' ? 'urgent' : ''}`}
            onClick={() => onSelectItem?.(d)}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>{d.patient_name || '미상'}</span>
              {deliveryBadge(d.delivery_method)}
            </div>
            <div style={{ display: 'flex', gap: 6, fontSize: 12, color: '#6b7280', flexWrap: 'wrap' }}>
              {d.chart_number && <span>{d.chart_number}</span>}
              {d.consultation_type && <span style={{ color: '#8b5cf6' }}>{TYPE_LABELS[d.consultation_type] || d.consultation_type}</span>}
              {d.doctor && <span style={{ color: '#1e40af' }}>{d.doctor}</span>}
            </div>
            {/* TODO: 원장실 처방전 연동 후 조건부 표시 (현재는 항상 표시) */}
            <div style={{ marginTop: 3 }}>
              <span style={{ fontSize: 11, fontWeight: 600, padding: '1px 6px', borderRadius: 4, background: '#fef3c7', color: '#b45309' }}>⚠ 처방전 대기</span>
            </div>
            {d.memo && <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.memo}</div>}
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
              {d.receipt_date || (d.created_at ? new Date(d.created_at).toLocaleDateString('ko-KR') : '')}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
