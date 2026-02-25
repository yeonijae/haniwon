import { useState, useEffect, useCallback, useRef } from 'react';
import type { PortalUser } from '@shared/types';
import type { DecoctionQueue, DecoctionCapacity } from '../types';
import {
  getQueueByStatus,
  getQueueByDate,
  getCompletedByDate,
  assignQueue,
  completeQueue,
  revertToWaiting,
  getCapacityByDate,
  getSlotCounts,
} from '../lib/api';
import '../../cs/components/call-center/OutboundCallCenter.css';

interface Props {
  user: PortalUser;
}

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatDisplayDate(d: Date): string {
  return `${d.getFullYear()}. ${String(d.getMonth() + 1).padStart(2, '0')}. ${String(d.getDate()).padStart(2, '0')}. (${DAY_NAMES[d.getDay()]})`;
}

function isWeekend(d: Date): boolean {
  return d.getDay() === 0 || d.getDay() === 6;
}

function deliveryBadge(method: string | null) {
  const m = method ?? '기타';
  const map: Record<string, { bg: string; color: string }> = {
    택배: { bg: '#dbeafe', color: '#2563eb' },
    내원: { bg: '#dcfce7', color: '#16a34a' },
    퀵: { bg: '#ffedd5', color: '#ea580c' },
  };
  const s = map[m] ?? { bg: '#f1f5f9', color: '#64748b' };
  return (
    <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: s.bg, color: s.color }}>
      {m}
    </span>
  );
}

function prescriptionSummary(p: Record<string, any> | null): string {
  if (!p) return '';
  if (typeof p === 'string') return p;
  if (p.name) return p.name as string;
  if (Array.isArray(p.items)) return (p.items as { name: string }[]).map((i) => i.name).join(', ');
  return JSON.stringify(p).slice(0, 60);
}

export default function DecoctionQueueView({ user }: Props) {
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [waiting, setWaiting] = useState<DecoctionQueue[]>([]);
  const [assigned, setAssigned] = useState<DecoctionQueue[]>([]);
  const [completed, setCompleted] = useState<DecoctionQueue[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [capacity, setCapacity] = useState<DecoctionCapacity | null>(null);
  const [counts, setCounts] = useState<{ am: number; pm: number }>({ am: 0, pm: 0 });
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; id: number } | null>(null);

  const dateStr = formatDate(selectedDate);
  const holiday = capacity?.is_holiday ?? false;
  const weekend = isWeekend(selectedDate);
  const isAlldayMode = weekend || holiday;
  const amCap = capacity?.am_capacity ?? 4;
  const pmCap = capacity?.pm_capacity ?? 4;

  const reload = useCallback(async () => {
    const [w, a, c, cap, sc] = await Promise.all([
      getQueueByStatus('waiting'),
      getQueueByDate(dateStr),
      getCompletedByDate(dateStr),
      getCapacityByDate(dateStr),
      getSlotCounts(dateStr),
    ]);
    setWaiting(w);
    setAssigned(a);
    setCompleted(c);
    setCapacity(cap);
    setCounts(sc);
  }, [dateStr]);

  useEffect(() => { reload(); }, [reload]);

  // 30초마다 자동 갱신
  useEffect(() => {
    const interval = setInterval(reload, 3000);
    return () => clearInterval(interval);
  }, [reload]);

  // Close context menu on click
  useEffect(() => {
    const handler = () => setContextMenu(null);
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, []);

  const moveDate = (delta: number) => {
    setSelectedDate((d) => { const n = new Date(d); n.setDate(n.getDate() + delta); return n; });
  };

  const handleAssign = async (slot: 'am' | 'pm' | 'allday') => {
    if (selectedId == null) return;
    await assignQueue(selectedId, dateStr, slot);
    setSelectedId(null);
    reload();
  };

  const handleComplete = async (id: number) => {
    await completeQueue(id);
    reload();
  };

  const handleRevert = async (id: number) => {
    await revertToWaiting(id);
    setContextMenu(null);
    reload();
  };

  const isUrgentDelivery = (q: DecoctionQueue) => q.delivery_method === '택배';

  // Card component for queue items
  const QueueCard = ({ q, onClick, selected }: { q: DecoctionQueue; onClick?: () => void; selected?: boolean }) => (
    <div
      onClick={onClick}
      style={{
        background: '#fff',
        borderRadius: 8,
        padding: 12,
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        cursor: onClick ? 'pointer' : 'default',
        border: selected ? '2px solid #8b5cf6' : '1px solid #e2e8f0',
        borderLeft: isUrgentDelivery(q) ? '3px solid #ef4444' : undefined,
        transition: 'border 0.15s',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>{q.patient_name ?? '(미상)'}</span>
        {deliveryBadge(q.delivery_method)}
      </div>
      {q.chart_number && <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>차트 #{q.chart_number}</div>}
      {q.prescription && <div style={{ fontSize: 12, color: '#475569', marginBottom: 4 }}>{prescriptionSummary(q.prescription)}</div>}
      {q.memo && <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>💬 {q.memo}</div>}
      <div style={{ fontSize: 11, color: '#94a3b8' }}>{new Date(q.created_at).toLocaleDateString('ko-KR')}</div>
    </div>
  );

  // Assigned card with action buttons
  const AssignedCard = ({ q }: { q: DecoctionQueue }) => (
    <div
      style={{
        background: '#fff',
        borderRadius: 8,
        padding: 12,
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        border: '1px solid #e2e8f0',
        borderLeft: isUrgentDelivery(q) ? '3px solid #ef4444' : undefined,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>{q.patient_name ?? '(미상)'}</span>
        {deliveryBadge(q.delivery_method)}
      </div>
      {q.chart_number && <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>차트 #{q.chart_number}</div>}
      {q.prescription && <div style={{ fontSize: 12, color: '#475569', marginBottom: 6 }}>{prescriptionSummary(q.prescription)}</div>}
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={() => handleComplete(q.id)} style={{ flex: 1, padding: '4px 0', fontSize: 12, fontWeight: 600, border: 'none', borderRadius: 4, background: '#10b981', color: '#fff', cursor: 'pointer' }}>
          ✅ 완료
        </button>
        <button onClick={() => handleRevert(q.id)} style={{ flex: 1, padding: '4px 0', fontSize: 12, fontWeight: 600, border: 'none', borderRadius: 4, background: '#f1f5f9', color: '#64748b', cursor: 'pointer' }}>
          ↩ 대기로
        </button>
      </div>
    </div>
  );

  const amItems = assigned.filter((q) => q.assigned_slot === 'am' || q.assigned_slot === 'allday');
  const pmItems = assigned.filter((q) => q.assigned_slot === 'pm' || q.assigned_slot === 'allday');
  const alldayItems = assigned; // in allday mode, show all

  const SlotArea = ({ label, items, slot, bg, cap: slotCap, count }: { label: string; items: DecoctionQueue[]; slot: 'am' | 'pm' | 'allday'; bg: string; cap: number; count: number }) => (
    <div style={{ background: bg, borderRadius: 8, padding: 12, minHeight: 120 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>{label}</span>
        <span style={{ fontSize: 12, color: '#64748b' }}>{count}/{slotCap}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map((q) => <AssignedCard key={q.id} q={q} />)}
        {selectedId != null && (
          <div
            onClick={() => handleAssign(slot)}
            style={{
              border: '2px dashed #cbd5e1',
              borderRadius: 8,
              padding: 16,
              textAlign: 'center',
              color: '#94a3b8',
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            + 여기에 배정하기
          </div>
        )}
        {items.length === 0 && selectedId == null && (
          <div style={{ border: '2px dashed #e2e8f0', borderRadius: 8, padding: 16, textAlign: 'center', color: '#cbd5e1', fontSize: 13 }}>
            배정된 건이 없습니다
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', gap: 16, height: '100%', minHeight: 0 }}>
      {/* 좌측: 배정 뷰 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* 날짜 네비게이션 */}
        <div className="occ-date-nav" style={{ justifyContent: 'center', marginBottom: 8 }}>
          <button className="occ-date-btn" onClick={() => moveDate(-1)}>◀</button>
          <span className="occ-date-display">{formatDisplayDate(selectedDate)}</span>
          <button className="occ-date-btn" onClick={() => moveDate(1)}>▶</button>
          <button className="occ-date-btn" onClick={() => setSelectedDate(new Date())} style={{ marginLeft: 8, fontSize: 12, padding: '4px 10px', background: '#f1f5f9', borderRadius: 4 }}>
            오늘
          </button>
        </div>

        {/* 용량 표시 */}
        {!isAlldayMode && (
          <div style={{ textAlign: 'center', fontSize: 13, color: '#64748b', marginBottom: 12 }}>
            오전 <b>{counts.am}/{amCap}</b> | 오후 <b>{counts.pm}/{pmCap}</b>
          </div>
        )}
        {isAlldayMode && (
          <div style={{ textAlign: 'center', fontSize: 13, color: '#ef4444', marginBottom: 12, fontWeight: 600 }}>
            {holiday ? '🎌 공휴일' : '🗓 주말'} — 종일 운영
          </div>
        )}

        {selectedId != null && (
          <div style={{ textAlign: 'center', fontSize: 12, color: '#8b5cf6', marginBottom: 8 }}>
            ✨ 카드가 선택됨 — 아래 슬롯을 클릭하여 배정하세요
          </div>
        )}

        {/* 슬롯 영역 */}
        <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {isAlldayMode ? (
            <SlotArea label="종일" items={alldayItems} slot="allday" bg="#f5f3ff" cap={amCap + pmCap} count={assigned.length} />
          ) : (
            <>
              <SlotArea label="🌅 오전" items={amItems} slot="am" bg="#eff6ff" cap={amCap} count={counts.am} />
              <SlotArea label="🌇 오후" items={pmItems} slot="pm" bg="#fff7ed" cap={pmCap} count={counts.pm} />
            </>
          )}
        </div>
      </div>

      {/* 우측: 완료목록 */}
      <div style={{ width: 280, minWidth: 280, display: 'flex', flexDirection: 'column', background: '#f8fafc', borderRadius: 8, padding: '0 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', marginBottom: 8 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>✅ 완료</h3>
          <span style={{ background: '#10b981', color: '#fff', borderRadius: 10, padding: '2px 10px', fontSize: 12, fontWeight: 600 }}>{completed.length}</span>
        </div>
        <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {completed.map((q) => (
            <div
              key={q.id}
              onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, id: q.id }); }}
              style={{
                background: '#fff',
                borderRadius: 8,
                padding: 12,
                boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                border: '1px solid #e2e8f0',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontWeight: 700, fontSize: 14 }}>{q.patient_name ?? '(미상)'}</span>
                {deliveryBadge(q.delivery_method)}
              </div>
              {q.completed_at && (
                <div style={{ fontSize: 11, color: '#94a3b8' }}>
                  완료: {new Date(q.completed_at).toLocaleString('ko-KR')}
                </div>
              )}
            </div>
          ))}
          {completed.length === 0 && (
            <div style={{ textAlign: 'center', color: '#94a3b8', padding: 32, fontSize: 14 }}>완료된 건이 없습니다</div>
          )}
        </div>
      </div>

      {/* 우클릭 컨텍스트 메뉴 */}
      {contextMenu && (
        <div
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            padding: 4,
            zIndex: 9999,
          }}
        >
          <button
            onClick={() => handleRevert(contextMenu.id)}
            style={{
              display: 'block',
              width: '100%',
              padding: '8px 16px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontSize: 13,
              textAlign: 'left',
              borderRadius: 4,
            }}
            onMouseEnter={(e) => { (e.target as HTMLButtonElement).style.background = '#f1f5f9'; }}
            onMouseLeave={(e) => { (e.target as HTMLButtonElement).style.background = 'none'; }}
          >
            ↩ 대기로 되돌리기
          </button>
        </div>
      )}
    </div>
  );
}
