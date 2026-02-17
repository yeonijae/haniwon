import React, { useState, useEffect, useCallback } from 'react';
import { createDecoctionOrder, getDecoctionOrders, type DecoctionOrder } from '../../lib/api';

const DECOCTION_ORDER_STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b', compounding: '#3b82f6', decocting: '#ec4899', packaging: '#8b5cf6', done: '#10b981',
};

const DAY_NAMES = ['일','월','화','수','목','금','토'];
const HOURS = Array.from({ length: 10 }, (_, i) => 9 + i);
const DELIVERY_OPTIONS = ['내원수령', '택배', '퀵', '기타'];

interface Props {
  patientId: number;
  chartNumber: string;
  patientName: string;
  onClose: () => void;
  onSuccess: () => void;
}

function getCurrentDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmtDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

export default function DecocionRegistModal({ patientId, chartNumber, patientName, onClose, onSuccess }: Props) {
  const [decoctionDate, setDecoctionDate] = useState<string | undefined>();
  const [delivery, setDelivery] = useState('내원수령');
  const [memo, setMemo] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // 캘린더 상태
  const [viewStart, setViewStart] = useState(() => {
    const d = new Date(); d.setHours(0,0,0,0); return d;
  });
  const [orders, setOrders] = useState<DecoctionOrder[]>([]);
  const [pendingSlot, setPendingSlot] = useState<{ date: string; slot: string } | null>(null);

  const viewDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(viewStart); d.setDate(d.getDate() + i); return d;
  });
  const todayStr = fmtDate(new Date());

  useEffect(() => {
    (async () => {
      const from = fmtDate(viewDates[0]);
      const to = fmtDate(viewDates[6]);
      try {
        const data = await getDecoctionOrders({ dateFrom: from, dateTo: to });
        setOrders(data);
      } catch {}
    })();
  }, [viewStart]);

  const isDirty = !!decoctionDate || memo.trim() !== '';

  const handleClose = useCallback(() => {
    if (isDirty) {
      if (!window.confirm('저장하지 않고 닫으시겠습니까?')) return;
    }
    onClose();
  }, [isDirty, onClose]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKey, true);
    return () => window.removeEventListener('keydown', handleKey, true);
  }, [handleClose]);

  const handleCellClick = (dateStr: string, slot: string) => {
    setPendingSlot(prev => prev?.date === dateStr && prev?.slot === slot ? null : { date: dateStr, slot });
  };

  const confirmSlot = () => {
    if (!pendingSlot) return;
    setDecoctionDate(`${pendingSlot.date} ${pendingSlot.slot}`);
    setPendingSlot(null);
  };

  const handleSave = async () => {
    if (!decoctionDate) {
      alert('탕전 일정을 선택해주세요.');
      return;
    }
    setIsSaving(true);
    try {
      const [datePart, timePart] = decoctionDate.split(' ');
      await createDecoctionOrder({
        patient_id: patientId,
        patient_name: patientName,
        status: 'pending',
        scheduled_date: datePart,
        scheduled_slot: timePart || '09:00',
        delivery_method: delivery,
        notes: memo || undefined,
        created_by: '',
      });
      onSuccess();
      onClose();
    } catch (err) {
      console.error('탕약 등록 오류:', err);
      alert('저장 실패');
    } finally {
      setIsSaving(false);
    }
  };

  const goPrev = () => { const d = new Date(viewStart); d.setDate(d.getDate() - 7); setViewStart(d); };
  const goNext = () => { const d = new Date(viewStart); d.setDate(d.getDate() + 7); setViewStart(d); };
  const goToday = () => { const d = new Date(); d.setHours(0,0,0,0); setViewStart(d); };

  const weekLabel = (() => {
    const s = viewDates[0], e = viewDates[6];
    return `${s.getMonth()+1}/${s.getDate()} (${DAY_NAMES[s.getDay()]}) ~ ${e.getMonth()+1}/${e.getDate()} (${DAY_NAMES[e.getDay()]})`;
  })();

  const selectedDatePart = decoctionDate?.split(' ')[0];
  const selectedTimePart = decoctionDate?.split(' ')[1];

  return (
    <div className="pkg-modal-overlay herbal-draft-overlay">
      <div className="herbal-consult-modal" style={{ width: '620px' }}>
        <div className="hcm-header">
          <h3>탕약 등록</h3>
          <span className="hcm-patient">{patientName} ({chartNumber.replace(/^0+/, '')})</span>
          <button className="btn-close" onClick={handleClose}><i className="fa-solid fa-xmark" /></button>
        </div>

        <div className="hcm-body">
          {/* 탕전 일정 */}
          <div className="hcm-section">
            <h4>탕전 일정</h4>
            {decoctionDate ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <span className="hc-tag payment" style={{ fontSize: '14px', padding: '4px 10px' }}>
                  <i className="fas fa-calendar-check" style={{ marginRight: 6 }} />
                  {(() => {
                    const [dp, tp] = decoctionDate.split(' ');
                    const [, m, d] = dp.split('-');
                    const dt = new Date(dp + 'T00:00:00');
                    return `${Number(m)}/${Number(d)}(${DAY_NAMES[dt.getDay()]}) ${tp || ''}`;
                  })()}
                </span>
                <button
                  className="hcm-btn"
                  style={{ fontSize: '12px', padding: '3px 8px' }}
                  onClick={() => setDecoctionDate(undefined)}
                >변경</button>
              </div>
            ) : (
              <div style={{ marginBottom: '8px', fontSize: '13px', color: '#6b7280' }}>
                아래 캘린더에서 시간을 선택하세요
              </div>
            )}

            {/* 캘린더 그리드 */}
            <div className="hcg-container">
              <div className="hcg-nav">
                <button type="button" onClick={goPrev}><i className="fas fa-chevron-left" /></button>
                <button type="button" className="hcg-today" onClick={goToday}>오늘</button>
                <button type="button" onClick={goNext}><i className="fas fa-chevron-right" /></button>
                <span className="hcg-label">{weekLabel}</span>
              </div>
              <div className="hcg-grid-wrapper">
                <div className="hcg-grid" style={{ gridTemplateColumns: '55px repeat(7, 1fr)' }}>
                  <div className="hcg-corner">시간</div>
                  {viewDates.map((d, i) => {
                    const ds = fmtDate(d);
                    return (
                      <div key={i} className={`hcg-day-header ${ds === todayStr ? 'today' : ''}`}>
                        <span>{DAY_NAMES[d.getDay()]}</span>
                        <span className="hcg-day-num">{d.getDate()}</span>
                      </div>
                    );
                  })}
                  {HOURS.map(hour => {
                    const slotStr = `${String(hour).padStart(2, '0')}:00`;
                    const isAlt = (hour - 9) % 2 === 1;
                    return (
                      <React.Fragment key={hour}>
                        <div className={`hcg-time ${isAlt ? 'alt' : ''}`}>{slotStr}</div>
                        {viewDates.map((d, dayIdx) => {
                          const dateStr = fmtDate(d);
                          const cellOrders = orders.filter(o => o.scheduled_date === dateStr && o.scheduled_slot === slotStr);
                          const isSelected = selectedDatePart === dateStr && selectedTimePart === slotStr;
                          const isPending = pendingSlot?.date === dateStr && pendingSlot?.slot === slotStr;
                          return (
                            <div
                              key={dayIdx}
                              className={`hcg-cell ${isAlt ? 'alt' : ''} ${isSelected ? 'selected' : ''} ${isPending ? 'pending' : ''}`}
                              onClick={() => handleCellClick(dateStr, slotStr)}
                            >
                              {cellOrders.map(o => (
                                <div
                                  key={o.id}
                                  className="hcg-order"
                                  style={{ backgroundColor: DECOCTION_ORDER_STATUS_COLORS[o.status] + '30', borderLeft: `3px solid ${DECOCTION_ORDER_STATUS_COLORS[o.status]}` }}
                                >
                                  <span className="hcg-order-name">{o.patient_name}</span>
                                </div>
                              ))}
                            </div>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
              {pendingSlot && (
                <div className="hcg-confirm-bar">
                  <div className="hcg-confirm-info">
                    <span className="hcg-to">{(() => {
                      const [, m, d] = pendingSlot.date.split('-');
                      const dt = new Date(pendingSlot.date + 'T00:00:00');
                      return `${Number(m)}/${Number(d)}(${DAY_NAMES[dt.getDay()]}) ${pendingSlot.slot}`;
                    })()}</span>
                    <span className="hcg-change-label">에 배정</span>
                  </div>
                  <div className="hcg-confirm-actions">
                    <button type="button" onClick={() => setPendingSlot(null)}>취소</button>
                    <button type="button" className="confirm" onClick={confirmSlot}>확정</button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '12px 0' }} />

          {/* 발송 */}
          <div className="hcm-row">
            <label>발송</label>
            <div className="hcm-btn-group">
              {DELIVERY_OPTIONS.map(d => (
                <button key={d} className={`hcm-btn ${delivery === d ? 'active' : ''}`} onClick={() => setDelivery(d)}>{d}</button>
              ))}
            </div>
          </div>

          {/* 메모 */}
          <div className="hcm-row">
            <label>메모</label>
            <input
              type="text"
              value={memo}
              onChange={e => setMemo(e.target.value)}
              placeholder="예: 출장 다녀오셔서 10일뒤에 받기를 원하심"
            />
          </div>
        </div>

        <div className="hcm-footer">
          <button className="hcm-cancel" onClick={handleClose}>취소</button>
          <button className="hcm-save" onClick={handleSave} disabled={isSaving || !decoctionDate}>
            {isSaving ? '저장중...' : '등록'}
          </button>
        </div>
      </div>
    </div>
  );
}
