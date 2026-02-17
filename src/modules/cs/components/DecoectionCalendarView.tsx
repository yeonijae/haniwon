/**
 * 탕전 캘린더 뷰 (주간 캘린더)
 * - 월~토, 09:00~18:00 시간 슬롯
 * - 구글캘린더 스타일 CSS Grid
 */
import React, { useState, useEffect, useCallback } from 'react';
import type { DecoctionOrder, DecoctionOrderStatus } from '../types';
import { DECOCTION_ORDER_STATUS_LABELS, DECOCTION_ORDER_STATUS_COLORS } from '../types';
import {
  getDecoctionOrders,
  getDecoctionOrdersByWeek,
  createDecoctionOrder,
  updateDecoctionOrder,
  deleteDecoctionOrder,
} from '../lib/api';

interface DecoectionCalendarViewProps {
  refreshKey?: number;
}

const DAYS = ['월', '화', '수', '목', '금', '토', '일'] as const;
const TIME_SLOTS = Array.from({ length: 10 }, (_, i) => {
  const h = 9 + i;
  return `${String(h).padStart(2, '0')}:00`;
});

const STATUS_ORDER: DecoctionOrderStatus[] = ['pending', 'compounding', 'decocting', 'packaging', 'done', 'cancelled'];

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function DecoectionCalendarView({ refreshKey }: DecoectionCalendarViewProps) {
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const [orders, setOrders] = useState<DecoctionOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editOrder, setEditOrder] = useState<DecoctionOrder | null>(null);
  const [formData, setFormData] = useState({
    patient_id: '',
    patient_name: '',
    scheduled_date: '',
    scheduled_slot: '09:00',
    recipe_name: '',
    delivery_method: '',
    assigned_to: '',
    notes: '',
    status: 'pending' as DecoctionOrderStatus,
  });

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getDecoctionOrdersByWeek(formatDateStr(weekStart));
      setOrders(data);
    } catch (err) {
      console.error('탕전 주문 조회 오류:', err);
    } finally {
      setLoading(false);
    }
  }, [weekStart]);

  useEffect(() => { loadOrders(); }, [loadOrders, refreshKey]);

  const weekDates = DAYS.map((_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const today = formatDateStr(new Date());

  const goToday = () => setWeekStart(getMonday(new Date()));
  const goPrev = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() - 7);
    setWeekStart(d);
  };
  const goNext = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    setWeekStart(d);
  };

  const getOrdersForCell = (date: string, slot: string) =>
    orders.filter(o => o.scheduled_date === date && o.scheduled_slot === slot);

  const openNewOrder = (date: string, slot: string) => {
    setEditOrder(null);
    setFormData({
      patient_id: '',
      patient_name: '',
      scheduled_date: date,
      scheduled_slot: slot,
      recipe_name: '',
      delivery_method: '',
      assigned_to: '',
      notes: '',
      status: 'pending',
    });
    setModalOpen(true);
  };

  const openEditOrder = (order: DecoctionOrder) => {
    setEditOrder(order);
    setFormData({
      patient_id: order.patient_id,
      patient_name: order.patient_name,
      scheduled_date: order.scheduled_date,
      scheduled_slot: order.scheduled_slot,
      recipe_name: order.recipe_name || '',
      delivery_method: order.delivery_method || '',
      assigned_to: order.assigned_to || '',
      notes: order.notes || '',
      status: order.status,
    });
    setModalOpen(true);
  };

  const cycleStatus = async (order: DecoctionOrder, e: React.MouseEvent) => {
    e.stopPropagation();
    const currentIdx = STATUS_ORDER.indexOf(order.status);
    const nextIdx = (currentIdx + 1) % STATUS_ORDER.length;
    const nextStatus = STATUS_ORDER[nextIdx];
    setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: nextStatus } : o));
    try {
      await updateDecoctionOrder(order.id!, { status: nextStatus });
    } catch (err) {
      console.error('상태 변경 오류:', err);
      loadOrders();
    }
  };

  const handleSave = async () => {
    if (!formData.patient_name || !formData.scheduled_date || !formData.scheduled_slot) return;
    try {
      if (editOrder?.id) {
        await updateDecoctionOrder(editOrder.id, formData);
      } else {
        await createDecoctionOrder(formData);
      }
      setModalOpen(false);
      loadOrders();
    } catch (err) {
      console.error('저장 오류:', err);
    }
  };

  const handleDelete = async () => {
    if (!editOrder?.id || !confirm('삭제하시겠습니까?')) return;
    try {
      await deleteDecoctionOrder(editOrder.id);
      setModalOpen(false);
      loadOrders();
    } catch (err) {
      console.error('삭제 오류:', err);
    }
  };

  const weekLabel = (() => {
    const s = weekDates[0];
    const e = weekDates[6];
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    return `${s.getMonth() + 1}/${s.getDate()} (${dayNames[s.getDay()]}) ~ ${e.getMonth() + 1}/${e.getDate()} (${dayNames[e.getDay()]})`;
  })();

  return (
    <div className="dec-calendar">
      {/* 주간 네비게이션 */}
      <div className="dec-nav">
        <button className="dec-nav-btn" onClick={goPrev}><i className="fas fa-chevron-left" /></button>
        <button className="dec-nav-today" onClick={goToday}>오늘</button>
        <button className="dec-nav-btn" onClick={goNext}><i className="fas fa-chevron-right" /></button>
        <span className="dec-nav-label">{weekLabel}</span>
        {loading && <i className="fas fa-spinner fa-spin" style={{ marginLeft: 8, color: '#94a3b8' }} />}
      </div>

      {/* 캘린더 그리드 */}
      <div className="dec-grid-wrapper">
      <div className="dec-grid">
        {/* 헤더: 빈 셀 + 요일 */}
        <div className="dec-header-corner" />
        {weekDates.map((d, i) => {
          const dateStr = formatDateStr(d);
          const isToday = dateStr === today;
          return (
            <div key={i} className={`dec-header-day ${isToday ? 'today' : ''}`}>
              <span className="dec-day-name">{DAYS[i]}</span>
              <span className={`dec-day-num ${isToday ? 'today' : ''}`}>{d.getDate()}</span>
            </div>
          );
        })}

        {/* 시간 슬롯 행 */}
        {TIME_SLOTS.map(slot => (
          <React.Fragment key={slot}>
            <div className="dec-time-label">{slot}</div>
            {weekDates.map((d, dayIdx) => {
              const dateStr = formatDateStr(d);
              const cellOrders = getOrdersForCell(dateStr, slot);
              return (
                <div
                  key={dayIdx}
                  className={`dec-cell ${formatDateStr(d) === today ? 'today-col' : ''}`}
                  onClick={() => cellOrders.length === 0 && openNewOrder(dateStr, slot)}
                >
                  {cellOrders.map(order => (
                    <div
                      key={order.id}
                      className="dec-order"
                      style={{ backgroundColor: DECOCTION_ORDER_STATUS_COLORS[order.status] + '22', borderLeft: `3px solid ${DECOCTION_ORDER_STATUS_COLORS[order.status]}` }}
                      onClick={(e) => { e.stopPropagation(); openEditOrder(order); }}
                    >
                      <div className="dec-order-top">
                        <span className="dec-order-patient">{order.patient_name}</span>
                        <span
                          className="dec-order-status"
                          style={{ backgroundColor: DECOCTION_ORDER_STATUS_COLORS[order.status] }}
                          onClick={(e) => cycleStatus(order, e)}
                          title="클릭하여 상태 변경"
                        >
                          {DECOCTION_ORDER_STATUS_LABELS[order.status]}
                        </span>
                      </div>
                      <div className="dec-order-meta">
                        {order.patient_id && <span>{order.patient_id}</span>}
                        {order.delivery_method && <span>· {order.delivery_method}</span>}
                        {order.assigned_to && <span>· {order.assigned_to}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
      </div>

      {/* 모달 */}
      {modalOpen && (
        <div className="dec-modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="dec-modal" onClick={e => e.stopPropagation()}>
            <div className="dec-modal-header">
              <h3>{editOrder ? '탕전 주문 수정' : '새 탕전 주문'}</h3>
              <button className="dec-modal-close" onClick={() => setModalOpen(false)}>×</button>
            </div>
            <div className="dec-modal-body">
              <div className="dec-form-row">
                <label>환자명 *</label>
                <input value={formData.patient_name} onChange={e => setFormData(f => ({ ...f, patient_name: e.target.value }))} />
              </div>
              <div className="dec-form-row">
                <label>차트번호</label>
                <input value={formData.patient_id} onChange={e => setFormData(f => ({ ...f, patient_id: e.target.value }))} />
              </div>
              <div className="dec-form-row-2">
                <div className="dec-form-row">
                  <label>날짜 *</label>
                  <input type="date" value={formData.scheduled_date} onChange={e => setFormData(f => ({ ...f, scheduled_date: e.target.value }))} />
                </div>
                <div className="dec-form-row">
                  <label>시간 *</label>
                  <select value={formData.scheduled_slot} onChange={e => setFormData(f => ({ ...f, scheduled_slot: e.target.value }))}>
                    {TIME_SLOTS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="dec-form-row">
                <label>처방명</label>
                <input value={formData.recipe_name} onChange={e => setFormData(f => ({ ...f, recipe_name: e.target.value }))} />
              </div>
              <div className="dec-form-row-2">
                <div className="dec-form-row">
                  <label>배송방법</label>
                  <select value={formData.delivery_method} onChange={e => setFormData(f => ({ ...f, delivery_method: e.target.value }))}>
                    <option value="">선택</option>
                    <option value="내원">내원</option>
                    <option value="퀵">퀵</option>
                    <option value="택배">택배</option>
                  </select>
                </div>
                <div className="dec-form-row">
                  <label>담당자</label>
                  <input value={formData.assigned_to} onChange={e => setFormData(f => ({ ...f, assigned_to: e.target.value }))} />
                </div>
              </div>
              {editOrder && (
                <div className="dec-form-row">
                  <label>상태</label>
                  <select value={formData.status} onChange={e => setFormData(f => ({ ...f, status: e.target.value as DecoctionOrderStatus }))}>
                    {STATUS_ORDER.map(s => <option key={s} value={s}>{DECOCTION_ORDER_STATUS_LABELS[s]}</option>)}
                  </select>
                </div>
              )}
              <div className="dec-form-row">
                <label>메모</label>
                <textarea value={formData.notes} onChange={e => setFormData(f => ({ ...f, notes: e.target.value }))} rows={2} />
              </div>
            </div>
            <div className="dec-modal-footer">
              {editOrder && <button className="dec-btn-delete" onClick={handleDelete}>삭제</button>}
              <div style={{ flex: 1 }} />
              <button className="dec-btn-cancel" onClick={() => setModalOpen(false)}>취소</button>
              <button className="dec-btn-save" onClick={handleSave}>저장</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .dec-calendar {
          display: flex;
          flex-direction: column;
          gap: 12px;
          flex: 1;
          min-height: 0;
          overflow: hidden;
        }

        .dec-nav {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .dec-nav-btn {
          width: 32px; height: 32px;
          border: 1px solid var(--border-color, #e2e8f0);
          border-radius: 6px;
          background: var(--bg-primary, #fff);
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          color: var(--text-secondary, #64748b);
          transition: all 0.15s;
        }
        .dec-nav-btn:hover { background: var(--bg-secondary, #f1f5f9); }

        .dec-nav-today {
          padding: 4px 12px;
          border: 1px solid var(--border-color, #e2e8f0);
          border-radius: 6px;
          background: var(--bg-primary, #fff);
          cursor: pointer;
          font-size: 13px;
          color: var(--text-primary, #1e293b);
          font-weight: 600;
        }
        .dec-nav-today:hover { background: var(--bg-secondary, #f1f5f9); }

        .dec-nav-label {
          font-size: 16px;
          font-weight: 700;
          color: var(--text-primary, #1e293b);
          margin-left: 4px;
        }

        /* Grid wrapper - scrollable */
        .dec-grid-wrapper {
          flex: 1;
          overflow: auto;
          min-height: 0;
          border-radius: 8px;
        }

        /* Grid */
        .dec-grid {
          display: grid;
          grid-template-columns: 60px repeat(7, minmax(100px, 1fr));
          min-width: 760px;
          border: 1px solid var(--border-color, #e2e8f0);
          border-radius: 8px;
          background: var(--bg-primary, #fff);
        }

        .dec-header-corner {
          background: var(--bg-secondary, #f8fafc);
          border-bottom: 1px solid var(--border-color, #e2e8f0);
          border-right: 1px solid var(--border-color, #e2e8f0);
        }

        .dec-header-day {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 8px 4px;
          background: var(--bg-secondary, #f8fafc);
          border-bottom: 1px solid var(--border-color, #e2e8f0);
          border-right: 1px solid var(--border-color, #f1f5f9);
          gap: 2px;
        }
        .dec-header-day:last-child { border-right: none; }
        .dec-header-day.today { background: #eff6ff; }

        .dec-day-name {
          font-size: 12px;
          font-weight: 600;
          color: var(--text-muted, #94a3b8);
        }

        .dec-day-num {
          font-size: 14px;
          font-weight: 700;
          color: var(--text-primary, #1e293b);
          width: 28px; height: 28px;
          display: flex; align-items: center; justify-content: center;
          border-radius: 50%;
        }
        .dec-day-num.today {
          background: #3b82f6;
          color: #fff;
        }

        .dec-time-label {
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding: 8px 4px 0;
          font-size: 11px;
          font-weight: 600;
          color: var(--text-muted, #94a3b8);
          border-right: 1px solid var(--border-color, #e2e8f0);
          border-bottom: 1px solid var(--border-color, #f1f5f9);
          min-height: 60px;
        }

        .dec-cell {
          border-right: 1px solid var(--border-color, #f1f5f9);
          border-bottom: 1px solid var(--border-color, #f1f5f9);
          min-height: 60px;
          padding: 2px;
          cursor: pointer;
          transition: background 0.1s;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .dec-cell:hover { background: #f8fafc; }
        .dec-cell.today-col { background: #fafbff; }

        .dec-order {
          padding: 4px 6px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 11px;
          transition: all 0.15s;
        }
        .dec-order:hover { opacity: 0.85; transform: translateY(-1px); }

        .dec-order-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 4px;
        }

        .dec-order-patient {
          font-weight: 700;
          font-size: 14px;
          color: var(--text-primary, #1e293b);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .dec-order-status {
          font-size: 11px;
          padding: 1px 5px;
          border-radius: 8px;
          color: #fff;
          font-weight: 600;
          white-space: nowrap;
          cursor: pointer;
          flex-shrink: 0;
        }
        .dec-order-status:hover { filter: brightness(0.9); }

        .dec-order-meta {
          display: flex;
          gap: 4px;
          color: var(--text-muted, #94a3b8);
          font-size: 12px;
          margin-top: 1px;
        }

        /* Modal */
        .dec-modal-overlay {
          position: fixed; inset: 0;
          background: rgba(0,0,0,0.4);
          display: flex; align-items: center; justify-content: center;
          z-index: 10000;
        }

        .dec-modal {
          background: var(--bg-primary, #fff);
          border-radius: 12px;
          width: 440px; max-width: 90vw;
          box-shadow: 0 20px 60px rgba(0,0,0,0.2);
          overflow: hidden;
        }

        .dec-modal-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 16px 20px;
          border-bottom: 1px solid var(--border-color, #e2e8f0);
        }
        .dec-modal-header h3 {
          margin: 0; font-size: 16px; font-weight: 700;
          color: var(--text-primary, #1e293b);
        }
        .dec-modal-close {
          background: none; border: none; font-size: 22px;
          color: var(--text-muted, #94a3b8); cursor: pointer;
          width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;
          border-radius: 6px;
        }
        .dec-modal-close:hover { background: #fee2e2; color: #ef4444; }

        .dec-modal-body {
          padding: 20px;
          display: flex; flex-direction: column; gap: 12px;
        }

        .dec-form-row {
          display: flex; flex-direction: column; gap: 4px;
        }
        .dec-form-row label {
          font-size: 12px; font-weight: 600;
          color: var(--text-muted, #64748b);
        }
        .dec-form-row input, .dec-form-row select, .dec-form-row textarea {
          padding: 8px 10px;
          border: 1px solid var(--border-color, #d1d5db);
          border-radius: 6px;
          font-size: 13px;
          background: var(--bg-primary, #fff);
          color: var(--text-primary, #1e293b);
          outline: none;
          font-family: inherit;
        }
        .dec-form-row input:focus, .dec-form-row select:focus, .dec-form-row textarea:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 2px rgba(59,130,246,0.15);
        }

        .dec-form-row-2 {
          display: grid; grid-template-columns: 1fr 1fr; gap: 12px;
        }

        .dec-modal-footer {
          display: flex; align-items: center; gap: 8px;
          padding: 12px 20px;
          border-top: 1px solid var(--border-color, #e2e8f0);
        }

        .dec-btn-save {
          padding: 8px 20px; border: none; border-radius: 6px;
          background: #3b82f6; color: #fff; font-size: 13px;
          font-weight: 600; cursor: pointer;
        }
        .dec-btn-save:hover { background: #2563eb; }

        .dec-btn-cancel {
          padding: 8px 16px; border: 1px solid var(--border-color, #d1d5db);
          border-radius: 6px; background: var(--bg-primary, #fff);
          color: var(--text-secondary, #6b7280); font-size: 13px; cursor: pointer;
        }
        .dec-btn-cancel:hover { background: var(--bg-secondary, #f1f5f9); }

        .dec-btn-delete {
          padding: 8px 16px; border: none; border-radius: 6px;
          background: #fee2e2; color: #dc2626; font-size: 13px;
          font-weight: 600; cursor: pointer;
        }
        .dec-btn-delete:hover { background: #fecaca; }
      `}</style>
    </div>
  );
}

export default DecoectionCalendarView;
