import React, { useState, useEffect, useCallback } from 'react';
import type { PortalUser } from '@shared/types';
import { query, getCurrentDate } from '@shared/lib/postgres';
import type { HerbalDraft, DraftBranchType, DraftStatus, DraftDeliveryMethod, JourneyStatus } from '../types';
import { DRAFT_BRANCH_TYPES, DRAFT_STATUS_LABELS, DRAFT_DELIVERY_LABELS, JOURNEY_STEPS, PAYMENT_MONTHS } from '../types';
import { updateHerbalDraft, updateHerbalDraftJourney, getDecoctionOrders, createDecoctionOrder, updateDecoctionOrder, deleteDecoctionOrder } from '../lib/api';
import type { DecoctionOrder } from '../types';
import { DECOCTION_ORDER_STATUS_LABELS, DECOCTION_ORDER_STATUS_COLORS } from '../types';
import { getLocalPatientByChartNo, type LocalPatient } from '../lib/patientSync';
import PatientDashboard from './PatientDashboard';

interface HerbalConsultationViewProps {
  user: PortalUser;
  searchTerm: string;
  dateFrom: string;
  dateTo: string;
  filterBranch: string;
  filterStatus: string;
  sortField: string;
  refreshKey: number;
}

interface GroupedDrafts {
  date: string;
  drafts: HerbalDraft[];
}

function HerbalConsultationView({ user, searchTerm, dateFrom, dateTo, filterBranch, filterStatus, sortField, refreshKey }: HerbalConsultationViewProps) {
  const [drafts, setDrafts] = useState<HerbalDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editingDeliveryId, setEditingDeliveryId] = useState<number | null>(null);
  const [editingDecoctionId, setEditingDecoctionId] = useState<number | null>(null);
  const [calendarDraft, setCalendarDraft] = useState<HerbalDraft | null>(null);
  const [calendarWeekStart, setCalendarWeekStart] = useState<Date>(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
  });
  const [calendarOrders, setCalendarOrders] = useState<DecoctionOrder[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [pendingSlot, setPendingSlot] = useState<{ date: string; slot: string } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; order: DecoctionOrder } | null>(null);
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
  const [tableEditingDelivery, setTableEditingDelivery] = useState<number | null>(null);
  const [tableEditingPayment, setTableEditingPayment] = useState<number | null>(null);
  const [dashboardPatient, setDashboardPatient] = useState<LocalPatient | null>(null);

  const openPatientDashboard = useCallback(async (chartNumber?: string) => {
    if (!chartNumber) return;
    try {
      const patient = await getLocalPatientByChartNo(chartNumber);
      if (patient) setDashboardPatient(patient);
    } catch (err) {
      console.error('환자 조회 오류:', err);
    }
  }, []);

  const formatDateLocal = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  };

  const loadCalendarOrders = useCallback(async (weekStart: Date) => {
    setCalendarLoading(true);
    try {
      const endDate = new Date(weekStart);
      endDate.setDate(endDate.getDate() + 6); // 월~일
      const orders = await getDecoctionOrders({
        dateFrom: formatDateLocal(weekStart),
        dateTo: formatDateLocal(endDate),
      });
      setCalendarOrders(orders);
    } catch (err) {
      console.error('탕전 일정 로드 오류:', err);
    } finally {
      setCalendarLoading(false);
    }
  }, []);

  const openCalendarPicker = useCallback((draft: HerbalDraft) => {
    setCalendarDraft(draft);
    setEditingDecoctionId(null);
    setPendingSlot(null);
    loadCalendarOrders(calendarWeekStart);
  }, [calendarWeekStart, loadCalendarOrders]);

  const calendarWeekNav = useCallback((dir: number) => {
    setCalendarWeekStart(prev => {
      const next = new Date(prev);
      next.setDate(next.getDate() + dir * 7);
      loadCalendarOrders(next);
      return next;
    });
  }, [loadCalendarOrders]);

  const selectPendingSlot = useCallback((date: string, slot: string) => {
    setPendingSlot(prev => prev?.date === date && prev?.slot === slot ? null : { date, slot });
  }, []);

  const confirmAssignment = useCallback(async () => {
    if (!calendarDraft?.id || !pendingSlot) return;
    try {
      const dateTimeStr = `${pendingSlot.date} ${pendingSlot.slot}`;
      await updateHerbalDraft(calendarDraft.id, { decoction_date: dateTimeStr, status: 'scheduled' as DraftStatus });

      // 기존 탕전 주문이 있으면 수정, 없으면 생성
      const existingOrder = calendarOrders.find(o => o.herbal_draft_id === String(calendarDraft.id));
      if (existingOrder) {
        await updateDecoctionOrder(existingOrder.id, {
          scheduled_date: pendingSlot.date,
          scheduled_slot: pendingSlot.slot,
        });
      } else {
        await createDecoctionOrder({
          herbal_draft_id: String(calendarDraft.id),
          patient_id: calendarDraft.chart_number || '',
          patient_name: calendarDraft.patient_name || '',
          status: 'pending',
          scheduled_date: pendingSlot.date,
          scheduled_slot: pendingSlot.slot,
          recipe_name: calendarDraft.consultation_type || '',
          delivery_method: calendarDraft.delivery_method || '',
          assigned_to: '',
          notes: '',
          created_by: user.name || '',
        });
      }

      setDrafts(prev => prev.map(d =>
        d.id === calendarDraft.id ? { ...d, decoction_date: dateTimeStr, status: 'scheduled' as DraftStatus } : d
      ));
      setPendingSlot(null);
      setCalendarDraft(null);
    } catch (err) {
      console.error('탕전일 배정 오류:', err);
    }
  }, [calendarDraft, pendingSlot, calendarOrders, user.name]);

  const cancelPendingSlot = useCallback(() => {
    setPendingSlot(null);
  }, []);

  const handleOrderContextMenu = useCallback((e: React.MouseEvent, order: DecoctionOrder) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, order });
  }, []);

  const handleDeleteOrder = useCallback(async () => {
    if (!contextMenu) return;
    const { order } = contextMenu;
    try {
      await deleteDecoctionOrder(order.id);
      // herbal draft의 decoction_date도 초기화
      if (order.herbal_draft_id) {
        await updateHerbalDraft(Number(order.herbal_draft_id), { decoction_date: '', status: 'draft' as DraftStatus });
        setDrafts(prev => prev.map(d =>
          String(d.id) === order.herbal_draft_id ? { ...d, decoction_date: undefined, status: 'draft' as DraftStatus } : d
        ));
      }
      // 캘린더에서 제거
      setCalendarOrders(prev => prev.filter(o => o.id !== order.id));
      setContextMenu(null);
    } catch (err) {
      console.error('탕전 주문 삭제 오류:', err);
    }
  }, [contextMenu]);

  const loadDrafts = useCallback(async () => {
    setLoading(true);
    try {
      let sql = `SELECT * FROM cs_herbal_drafts WHERE 1=1`;

      if (searchTerm) {
        sql += ` AND (patient_name LIKE '%${searchTerm}%' OR chart_number LIKE '%${searchTerm}%')`;
      }
      if (filterBranch !== 'all') {
        sql += ` AND consultation_type = '${filterBranch}'`;
      }
      if (filterStatus !== 'all') {
        sql += ` AND status = '${filterStatus}'`;
      }
      if (dateFrom) {
        sql += ` AND receipt_date >= '${dateFrom}'`;
      }
      if (dateTo) {
        sql += ` AND receipt_date <= '${dateTo}'`;
      }

      const orderField = sortField === 'created_at' ? 'receipt_date' : sortField;
      sql += ` ORDER BY ${orderField} DESC NULLS LAST LIMIT 200`;

      const data = await query<HerbalDraft>(sql);
      setDrafts(data);
    } catch (error) {
      console.error('약상담 기록 조회 오류:', error);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, filterBranch, filterStatus, sortField, dateFrom, dateTo, refreshKey]);

  useEffect(() => {
    loadDrafts();
  }, [loadDrafts]);

  const extractDate = (dateStr?: string): string => {
    if (!dateStr) return '알수없음';
    const isoMatch = dateStr.match(/(\d{4}-\d{2}-\d{2})/);
    if (isoMatch) return isoMatch[1];
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    return '알수없음';
  };

  const parseJourney = (j: any): JourneyStatus => {
    if (!j) return {};
    if (typeof j === 'string') try { return JSON.parse(j); } catch { return {}; }
    return j;
  };

  const handleJourneyToggle = async (draft: HerbalDraft, stepKey: keyof JourneyStatus, currentJourney: JourneyStatus) => {
    const draftId = draft.id!;
    const done = !!currentJourney[stepKey];
    if (stepKey === 'received' && !done) {
      const method = draft.delivery_method;
      let msg = '수령 완료 처리하시겠습니까?';
      if (method === 'quick') msg = '퀵 배송 — 당일 수령 확인되었나요?';
      else if (method === 'express') msg = '택배 — 환자에게 도착 확인되었나요?';
      if (!confirm(msg)) return;
    }
    const newJourney = { ...currentJourney, [stepKey]: !done };
    setDrafts(prev => prev.map(d => d.id === draftId ? { ...d, journey_status: newJourney } : d));
    try {
      await updateHerbalDraftJourney(draftId, newJourney);
    } catch (err) {
      console.error('여정 업데이트 오류:', err);
      setDrafts(prev => prev.map(d => d.id === draftId ? { ...d, journey_status: currentJourney } : d));
    }
  };

  const groupedDrafts: GroupedDrafts[] = drafts.reduce((acc: GroupedDrafts[], draft) => {
    const dateKey = sortField === 'decoction_date'
      ? (draft.decoction_date ? extractDate(draft.decoction_date) : '미정')
      : (draft.receipt_date || extractDate(draft.created_at));
    const existing = acc.find(g => g.date === dateKey);
    if (existing) {
      existing.drafts.push(draft);
    } else {
      acc.push({ date: dateKey, drafts: [draft] });
    }
    return acc;
  }, []);

  const formatDate = (dateStr: string) => {
    if (dateStr === '미정' || dateStr === '알수없음') return dateStr;
    const today = getCurrentDate();
    if (dateStr === today) return '오늘';
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
    if (dateStr === yStr) return '어제';
    const parts = dateStr.split('-');
    const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
    return `${date.getMonth() + 1}/${date.getDate()} (${weekdays[date.getDay()]})`;
  };

  const getBranchColor = (branch?: string): string => {
    switch (branch) {
      case '약초진': return '#10b981';
      case '약재진_N차': return '#3b82f6';
      case '약재진_재결제': return '#f59e0b';
      case '기타상담': return '#8b5cf6';
      default: return '#64748b';
    }
  };

  const getBranchLabel = (branch?: string): string => {
    const found = DRAFT_BRANCH_TYPES.find(b => b.value === branch);
    return found?.label || branch || '-';
  };

  const getBranchShortLabel = (branch?: string): string => {
    if (branch === '약재진_N차' || branch === '약재진_재결제') return '약재진';
    if (branch === '약초진') return '약초진';
    if (branch === '기타상담') return '기타상담';
    return branch || '-';
  };

  const getBranchSuffix = (branch?: string): string => {
    if (branch === '약재진_N차') return 'N차';
    if (branch === '약재진_재결제') return '재결제';
    return '';
  };

  const getStatusBadge = (status: DraftStatus) => {
    const label = DRAFT_STATUS_LABELS[status] || status;
    const color = status === 'scheduled' ? '#10b981' : '#f59e0b';
    return <span className="herbal-status-badge" style={{ backgroundColor: color }}>{label}</span>;
  };

  const parseMedicines = (items?: string): { name: string; quantity: number }[] => {
    if (!items) return [];
    try { return JSON.parse(items); } catch { return []; }
  };

  const getVisibleSteps = (draft: HerbalDraft) => {
    let steps = [...JOURNEY_STEPS];
    if (draft.consultation_type !== '약초진') {
      steps = steps.filter(s => s.key !== 'dosage');
    }
    if (draft.delivery_method === 'pickup' || !draft.delivery_method) {
      steps = steps.filter(s => s.key !== 'shipping');
    }
    return steps;
  };

  const formatDecDate = (d?: string) => {
    if (!d) return '미정';
    const [date, time] = d.split(' ');
    const [, m, dd] = date.split('-');
    return `${Number(m)}/${Number(dd)}${time ? ' ' + time : ''}`;
  };

  return (
    <div className="herbal-consultation-view">
      {/* 뷰 전환 */}
      <div className="hc-view-toggle">
        <button className={`hc-toggle-btn ${viewMode === 'card' ? 'active' : ''}`} onClick={() => setViewMode('card')}>
          <i className="fas fa-th-large" /> 카드
        </button>
        <button className={`hc-toggle-btn ${viewMode === 'table' ? 'active' : ''}`} onClick={() => setViewMode('table')}>
          <i className="fas fa-table" /> 표
        </button>
      </div>

      {/* 표 보기 */}
      {viewMode === 'table' && (
        <div className="hc-table-wrap">
          {loading ? (
            <div className="timeline-loading"><i className="fas fa-spinner fa-spin"></i> 로딩 중...</div>
          ) : drafts.length === 0 ? (
            <div className="timeline-empty"><i className="fas fa-mortar-pestle"></i><p>약상담 기록이 없습니다</p></div>
          ) : (
            <table className="hc-table">
              <thead>
                <tr>
                  <th className="hc-th-date">진료일</th>
                  <th className="hc-th-time">시간</th>
                  <th className="hc-th-name">환자</th>
                  <th className="hc-th-chart">차트</th>
                  <th className="hc-th-doc">담당의</th>
                  <th className="hc-th-branch">진료</th>
                  <th className="hc-th-sub">추가</th>
                  <th className="hc-th-pay">결제</th>
                  <th className="hc-th-dec">탕전일정</th>
                  <th className="hc-th-delivery">배송방법</th>
                  <th className="hc-th-journey">진행</th>
                  <th className="hc-th-memo">메모</th>
                </tr>
              </thead>
              <tbody>
                {drafts.map(draft => {
                  const visibleSteps = getVisibleSteps(draft);
                  const journey = parseJourney(draft.journey_status);
                  return (
                  <tr key={draft.id} onClick={() => setExpandedId(expandedId === draft.id ? null : (draft.id ?? null))}>
                    <td className="hc-td-compact">{draft.receipt_date ? (() => { const [,m,d] = draft.receipt_date.split('-'); return `${Number(m)}/${Number(d)}`; })() : ''}</td>
                    <td className="hc-td-compact">{draft.created_at ? new Date(draft.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }) : ''}</td>
                    <td className="hc-table-patient" onClick={(e) => { e.stopPropagation(); openPatientDashboard(draft.chart_number); }}>{draft.patient_name}</td>
                    <td className="hc-td-compact">{draft.chart_number}</td>
                    <td className="hc-td-compact">{draft.doctor || ''}</td>
                    <td><span className="hc-info-branch" style={{ color: getBranchColor(draft.consultation_type), fontSize: 11 }}>{getBranchShortLabel(draft.consultation_type)}</span></td>
                    <td className="hc-td-compact">{draft.nokryong_grade ? `🦌${draft.nokryong_grade}${draft.nokryong_count && draft.nokryong_count > 1 ? ` ×${draft.nokryong_count}` : ''}` : ''}{draft.sub_type ? (draft.nokryong_grade ? ` ${draft.sub_type}` : draft.sub_type) : ''}</td>
                    <td className="hc-td-compact" onClick={e => e.stopPropagation()}>
                      {tableEditingPayment === draft.id ? (
                        <div className="hc-table-dropdown">
                          {PAYMENT_MONTHS.map(pm => (
                            <button key={pm} className={`hc-table-dd-item ${draft.payment_type === pm ? 'active' : ''}`}
                              onClick={async () => {
                                setDrafts(prev => prev.map(d => d.id === draft.id ? { ...d, payment_type: pm } : d));
                                try { await updateHerbalDraft(draft.id!, { payment_type: pm }); } catch (err) { console.error(err); }
                                setTableEditingPayment(null);
                              }}>{pm}</button>
                          ))}
                        </div>
                      ) : (
                        <span className="hc-table-editable" onClick={() => { setTableEditingPayment(draft.id ?? null); setTableEditingDelivery(null); }}>
                          {getBranchSuffix(draft.consultation_type) && <span style={{ fontSize: 10, color: '#6b7280', marginRight: 3 }}>{getBranchSuffix(draft.consultation_type)}</span>}
                          {draft.payment_type || <span className="hc-table-placeholder">미정</span>}
                        </span>
                      )}
                    </td>
                    <td>
                      <span className="hc-decoction-value" onClick={(e) => { e.stopPropagation(); openCalendarPicker(draft); }}>
                        {formatDecDate(draft.decoction_date)} <i className="fas fa-calendar-alt" style={{ fontSize: 9, opacity: 0.5 }} />
                      </span>
                    </td>
                    <td className="hc-td-compact" onClick={e => e.stopPropagation()}>
                      {tableEditingDelivery === draft.id ? (
                        <div className="hc-table-dropdown">
                          {(Object.entries(DRAFT_DELIVERY_LABELS) as [DraftDeliveryMethod, string][]).map(([key, label]) => (
                            <button key={key} className={`hc-table-dd-item ${draft.delivery_method === key ? 'active' : ''}`}
                              onClick={async () => {
                                setDrafts(prev => prev.map(d => d.id === draft.id ? { ...d, delivery_method: key } : d));
                                try { await updateHerbalDraft(draft.id!, { delivery_method: key }); } catch (err) { console.error(err); }
                                setTableEditingDelivery(null);
                              }}>{label}</button>
                          ))}
                        </div>
                      ) : (
                        <span className="hc-table-editable" onClick={() => { setTableEditingDelivery(draft.id ?? null); setTableEditingPayment(null); }}>
                          {DRAFT_DELIVERY_LABELS[draft.delivery_method as DraftDeliveryMethod] || draft.delivery_method || <span className="hc-table-placeholder">미정</span>}
                        </span>
                      )}
                    </td>
                    <td className="hc-td-journey" onClick={e => e.stopPropagation()}>
                      <div className="hc-table-journey">
                        {visibleSteps.map((step, idx) => {
                          const done = !!journey[step.key];
                          return (
                            <React.Fragment key={step.key}>
                              <span
                                className={`hc-tj-dot ${done ? 'done' : ''}`}
                                title={`${step.label} (클릭하여 ${done ? '취소' : '완료'})`}
                                style={{ cursor: 'pointer' }}
                                onClick={() => handleJourneyToggle(draft, step.key, journey)}
                              >{step.label.slice(0, 2)}</span>
                              {idx < visibleSteps.length - 1 && <span className={`hc-tj-line ${done ? 'done' : ''}`} />}
                            </React.Fragment>
                          );
                        })}
                      </div>
                    </td>
                    <td className="hc-table-memo">{draft.memo || ''}</td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* 카드 보기 */}
      {viewMode === 'card' && (
      <div className="herbal-grid-container">
        {loading ? (
          <div className="timeline-loading">
            <i className="fas fa-spinner fa-spin"></i> 로딩 중...
          </div>
        ) : groupedDrafts.length === 0 ? (
          <div className="timeline-empty">
            <i className="fas fa-mortar-pestle"></i>
            <p>약상담 기록이 없습니다</p>
          </div>
        ) : (
          groupedDrafts.map((group) => (
            <div key={group.date} className="hc-date-section">
              <div className="hc-date-divider">
                <span className="hc-date-label">{formatDate(group.date)}</span>
                <span className="hc-date-full">{group.date}</span>
                <span className="hc-date-count">{group.drafts.length}건</span>
                <div className="hc-date-line" />
              </div>
              <div className="herbal-card-grid">
                {group.drafts.map((draft) => {
                  const medicines = parseMedicines(draft.medicine_items);
                  const isExpanded = expandedId === draft.id;

                  return (
                    <div
                      key={draft.id}
                      className={`hc-card ${isExpanded ? 'expanded' : ''}`}
                      onClick={() => setExpandedId(isExpanded ? null : (draft.id ?? null))}
                    >
                      <div
                        className="hc-card-accent"
                        style={{ backgroundColor: getBranchColor(draft.consultation_type) }}
                      />
                      <div className="hc-card-body">
                        {/* 1줄: 환자 / 담당의 / 분기 / 결제 / 녹용 / 상태 */}
                        <div className="hc-card-info-line">
                          {draft.created_at && (
                            <span className="hc-time-badge">{new Date(draft.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
                          )}
                          <span className="hc-patient-name">{draft.patient_name}</span>
                          <span className="hc-patient-chart">({draft.chart_number})</span>
                          {draft.doctor && <span className="hc-info-doctor"><i className="fas fa-user-md"></i> {draft.doctor}</span>}
                          <span className="hc-info-branch" style={{ color: getBranchColor(draft.consultation_type) }}>{getBranchLabel(draft.consultation_type)}</span>
                          {draft.payment_type && <span className="hc-tag">{draft.payment_type}</span>}
                          {draft.nokryong_grade && (
                            <span className="hc-tag">🦌 {draft.nokryong_grade}{draft.nokryong_count && draft.nokryong_count > 1 ? ` ×${draft.nokryong_count}` : ''}</span>
                          )}
                          {draft.sub_type && <span className="hc-tag">{draft.sub_type}</span>}
                          <span style={{ marginLeft: 'auto' }}>{getStatusBadge(draft.status)}</span>
                        </div>

                        {/* 2줄: 배송 */}
                        <div className="hc-card-row" onClick={e => e.stopPropagation()}>
                          <span className="hc-row-label">배송</span>
                          <span 
                            className="hc-tag hc-tag-editable"
                            onClick={() => { setEditingDeliveryId(editingDeliveryId === draft.id ? null : (draft.id ?? null)); setEditingDecoctionId(null); }}
                          >
                            {DRAFT_DELIVERY_LABELS[draft.delivery_method as DraftDeliveryMethod] || draft.delivery_method || '미정'}
                            <i className="fas fa-chevron-right" style={{ fontSize: 8, marginLeft: 4 }} />
                          </span>
                          {editingDeliveryId === draft.id && (
                            <div className="hc-delivery-chips">
                              {(Object.entries(DRAFT_DELIVERY_LABELS) as [DraftDeliveryMethod, string][]).map(([key, label]) => (
                                <button
                                  key={key}
                                  className={`hc-delivery-chip ${draft.delivery_method === key ? 'active' : ''}`}
                                  onClick={async () => {
                                    setDrafts(prev => prev.map(d => d.id === draft.id ? { ...d, delivery_method: key } : d));
                                    setEditingDeliveryId(null);
                                    try {
                                      await updateHerbalDraft(draft.id!, { delivery_method: key });
                                    } catch (err) {
                                      console.error('배송방식 수정 오류:', err);
                                    }
                                  }}
                                >
                                  {label}{draft.delivery_method === key ? ' ✓' : ''}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* 3줄: 탕전 */}
                        <div className="hc-card-row" onClick={e => e.stopPropagation()}>
                          <span className="hc-row-label">탕전</span>
                          <span 
                            className="hc-decoction-value"
                            onClick={() => { openCalendarPicker(draft); setEditingDeliveryId(null); }}
                          >
                            {draft.decoction_date
                              ? (() => { const [d, t] = draft.decoction_date.split(' '); const [, m, dd] = d.split('-'); return `${Number(m)}/${Number(dd)}${t ? ' ' + t : ''}`; })()
                              : '미정'
                            } <i className="fas fa-calendar-alt" style={{ fontSize: 9, marginLeft: 4, opacity: 0.5 }} />
                          </span>
                        </div>

                        {/* 4줄: 여정 파이프라인 */}
                        <div className="hc-journey" onClick={e => e.stopPropagation()}>
                          {(() => {
                            const visibleSteps = getVisibleSteps(draft);
                            return visibleSteps.map((step, idx) => {
                              const journey = parseJourney(draft.journey_status);
                              const done = !!journey[step.key];
                              const isLast = idx === visibleSteps.length - 1;
                              return (
                                <React.Fragment key={step.key}>
                                  <button
                                    className={`hc-journey-step ${done ? 'done' : ''}`}
                                    onClick={() => handleJourneyToggle(draft, step.key, journey)}
                                    title={`${step.label} ${done ? '(완료)' : '(미완료)'} - 클릭하여 토글`}
                                  >
                                    <span className="hc-journey-dot">{done ? '●' : '○'}</span>
                                    <span className="hc-journey-label">{step.label}</span>
                                  </button>
                                  {!isLast && <span className={`hc-journey-line ${done ? 'done' : ''}`} />}
                                </React.Fragment>
                              );
                            });
                          })()}
                        </div>
                        {isExpanded && (
                          <div className="hc-card-detail" onClick={e => e.stopPropagation()}>
                            {draft.treatment_months && (
                              <div className="hc-detail-row"><span className="hc-detail-label">치료기간</span><span>{draft.treatment_months}</span></div>
                            )}
                            {draft.visit_pattern && (
                              <div className="hc-detail-row"><span className="hc-detail-label">내원패턴</span><span>{draft.visit_pattern}</span></div>
                            )}
                            {draft.nokryong_type && (
                              <div className="hc-detail-row"><span className="hc-detail-label">녹용권유</span><span>{draft.nokryong_type}</span></div>
                            )}
                            {draft.consultation_method && (
                              <div className="hc-detail-row"><span className="hc-detail-label">상담방법</span><span>{draft.consultation_method}</span></div>
                            )}
                            {medicines.length > 0 && (
                              <div className="hc-detail-medicines">
                                <span className="hc-detail-label">약재</span>
                                <div className="herbal-medicine-chips">
                                  {medicines.map((m, i) => (
                                    <span key={i} className="herbal-medicine-chip">{m.name} ×{m.quantity}</span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
      )}

      {/* 탕전 달력 프리뷰 모달 */}
      {calendarDraft && (
        <div className="hc-cal-overlay" onClick={() => setCalendarDraft(null)}>
          <div className="hc-cal-modal" onClick={e => e.stopPropagation()}>
            <div className="hc-cal-header">
              <span className="hc-cal-title">
                탕전일 배정 — {calendarDraft.patient_name}
              </span>
              <button className="hc-cal-close" onClick={() => setCalendarDraft(null)}>
                <i className="fas fa-times" />
              </button>
            </div>
            <div className="hc-cal-nav">
              <button onClick={() => calendarWeekNav(-1)}><i className="fas fa-chevron-left" /></button>
              <span>
                {(() => {
                  const s = calendarWeekStart;
                  const e = new Date(s);
                  e.setDate(e.getDate() + 5);
                  const dn = ['일', '월', '화', '수', '목', '금', '토'];
                  return `${s.getMonth() + 1}/${s.getDate()} (${dn[s.getDay()]}) ~ ${e.getMonth() + 1}/${e.getDate()} (${dn[e.getDay()]})`;
                })()}
              </span>
              <button onClick={() => calendarWeekNav(1)}><i className="fas fa-chevron-right" /></button>
              {calendarLoading && <i className="fas fa-spinner fa-spin" style={{ marginLeft: 8, color: '#94a3b8' }} />}
            </div>
            <div className="hc-cal-grid">
              {/* 헤더 */}
              <div className="hc-cal-corner">시간</div>
              {Array.from({ length: 7 }, (_, i) => {
                const d = new Date(calendarWeekStart);
                d.setDate(d.getDate() + i);
                const dateStr = formatDateLocal(d);
                const isToday = dateStr === getCurrentDate();
                const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
                return (
                  <div key={i} className={`hc-cal-day-header ${isToday ? 'today' : ''}`}>
                    <span>{dayNames[d.getDay()]}</span>
                    <span className="hc-cal-day-num">{d.getDate()}</span>
                  </div>
                );
              })}
              {/* 시간 슬롯 */}
              {Array.from({ length: 10 }, (_, h) => h + 9).map(hour => (
                <React.Fragment key={hour}>
                  <div className={`hc-cal-time ${(hour - 9) % 2 === 1 ? 'alt' : ''}`}>{`${hour}:00`}</div>
                  {Array.from({ length: 7 }, (_, dayIdx) => {
                    const d = new Date(calendarWeekStart);
                    d.setDate(d.getDate() + dayIdx);
                    const dateStr = formatDateLocal(d);
                    const slotStr = `${String(hour).padStart(2, '0')}:00`;
                    const slotOrders = calendarOrders.filter(o => o.scheduled_date === dateStr && o.scheduled_slot === slotStr);
                    return (
                      <div
                        key={dayIdx}
                        className={`hc-cal-cell ${(hour - 9) % 2 === 1 ? 'alt' : ''} ${calendarDraft.decoction_date?.startsWith(dateStr) && calendarDraft.decoction_date?.includes(slotStr) ? 'selected' : ''} ${pendingSlot?.date === dateStr && pendingSlot?.slot === slotStr ? 'pending' : ''}`}
                        onClick={() => selectPendingSlot(dateStr, slotStr)}
                      >
                        {slotOrders.map(o => (
                          <div
                            key={o.id}
                            className="hc-cal-order"
                            style={{ backgroundColor: DECOCTION_ORDER_STATUS_COLORS[o.status] + '30', borderLeft: `3px solid ${DECOCTION_ORDER_STATUS_COLORS[o.status]}` }}
                            onContextMenu={(e) => handleOrderContextMenu(e, o)}
                          >
                            <span className="hc-cal-order-name">{o.patient_name}</span>
                            <span className="hc-cal-order-meta">{o.patient_id}{o.delivery_method ? ` · ${DRAFT_DELIVERY_LABELS[o.delivery_method as DraftDeliveryMethod] || o.delivery_method}` : ''}</span>
                          </div>
                        ))}
                        {pendingSlot?.date === dateStr && pendingSlot?.slot === slotStr && calendarDraft && (
                          <div className="hc-cal-order hc-cal-preview">
                            <span className="hc-cal-order-name">{calendarDraft.patient_name}</span>
                            <span className="hc-cal-order-meta">{calendarDraft.chart_number}{calendarDraft.delivery_method ? ` · ${DRAFT_DELIVERY_LABELS[calendarDraft.delivery_method as DraftDeliveryMethod] || calendarDraft.delivery_method}` : ''}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
            {/* 우클릭 컨텍스트 메뉴 */}
            {contextMenu && (
              <>
                <div className="hc-ctx-backdrop" onClick={() => setContextMenu(null)} />
                <div className="hc-ctx-menu" style={{ top: contextMenu.y, left: contextMenu.x }}>
                  <div className="hc-ctx-header">
                    {contextMenu.order.patient_name} ({contextMenu.order.patient_id})
                  </div>
                  <button className="hc-ctx-item delete" onClick={handleDeleteOrder}>
                    <i className="fas fa-trash" /> 탕전 배정 삭제
                  </button>
                </div>
              </>
            )}
            {/* 확인/취소 바 */}
            {pendingSlot && calendarDraft && (
              <div className="hc-cal-confirm-bar">
                <div className="hc-cal-confirm-info">
                  <i className="fas fa-user" style={{ marginRight: 6 }} />
                  <strong>{calendarDraft.patient_name}</strong>
                  <span style={{ margin: '0 8px' }}>:</span>
                  {calendarDraft.decoction_date ? (
                    <>
                      <span className="hc-cal-from">{formatDecDate(calendarDraft.decoction_date)}</span>
                      <span style={{ margin: '0 6px', color: '#94a3b8' }}>→</span>
                    </>
                  ) : null}
                  <span className="hc-cal-to">
                    {(() => { const [,m,d] = pendingSlot.date.split('-'); return `${Number(m)}/${Number(d)}`; })()} {pendingSlot.slot}
                  </span>
                  {calendarDraft.decoction_date ? (
                    <span className="hc-cal-change-label">으로 변경</span>
                  ) : (
                    <span className="hc-cal-change-label">에 배정</span>
                  )}
                </div>
                <div className="hc-cal-confirm-actions">
                  <button className="hc-cal-confirm-btn cancel" onClick={cancelPendingSlot}>취소</button>
                  <button className="hc-cal-confirm-btn confirm" onClick={confirmAssignment}>
                    {calendarDraft.decoction_date ? '변경 확정' : '배정 확정'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 환자 통합 대시보드 */}
      {dashboardPatient && (
        <PatientDashboard
          isOpen={true}
          patient={dashboardPatient}
          user={user}
          onClose={() => setDashboardPatient(null)}
        />
      )}

      <style>{`
        .herbal-consultation-view {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        /* 뷰 전환 토글 */
        .hc-view-toggle {
          display: flex;
          gap: 4px;
          align-self: flex-end;
        }
        .hc-toggle-btn {
          padding: 4px 10px;
          border: 1px solid #d1d5db;
          background: #fff;
          border-radius: 6px;
          font-size: 11px;
          color: #6b7280;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 4px;
          transition: all 0.15s;
        }
        .hc-toggle-btn.active {
          background: #3b82f6;
          color: #fff;
          border-color: #3b82f6;
        }
        .hc-toggle-btn:hover:not(.active) {
          background: #f3f4f6;
        }

        /* 표 보기 */
        .hc-table-wrap {
          overflow-x: auto;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          background: #fff;
        }
        .hc-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 14px;
          white-space: nowrap;
        }
        .hc-table thead {
          background: #f8fafc;
          position: sticky;
          top: 0;
          z-index: 1;
        }
        .hc-table th {
          padding: 10px 14px;
          text-align: left;
          font-weight: 600;
          color: #374151;
          border-bottom: 2px solid #e5e7eb;
          font-size: 13px;
        }
        .hc-table td {
          padding: 8px 14px;
          border-bottom: 1px solid #f0f0f0;
          color: #374151;
          font-size: 13px;
        }
        .hc-table tbody tr {
          cursor: pointer;
          transition: background 0.1s;
        }
        .hc-table tbody tr:hover {
          background: #f8fafc;
        }
        .hc-table-patient {
          font-weight: 600;
          white-space: nowrap;
          cursor: pointer;
          color: #2563eb;
        }
        .hc-table-patient:hover {
          text-decoration: underline;
        }
        .hc-td-compact {
          white-space: nowrap;
          font-size: 13px;
        }
        .hc-th-date, .hc-th-time, .hc-th-chart, .hc-th-doc, .hc-th-pay { width: 1%; white-space: nowrap; }
        .hc-th-name { width: 1%; white-space: nowrap; }
        .hc-th-branch, .hc-th-delivery, .hc-th-dec { width: 1%; white-space: nowrap; }
        .hc-th-journey { width: 1%; white-space: nowrap; }
        .hc-th-memo { width: auto; }
        .hc-th-memo { min-width: 120px; max-width: 250px; }
        .hc-table-memo {
          overflow: hidden;
          text-overflow: ellipsis;
          color: #6b7280;
          font-size: 13px;
          max-width: 250px;
          white-space: nowrap;
        }
        .hc-td-journey { white-space: nowrap; }
        .hc-table-journey {
          display: flex;
          align-items: center;
          gap: 2px;
        }
        .hc-tj-dot {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 30px;
          height: 22px;
          border-radius: 11px;
          font-size: 11px;
          font-weight: 700;
          background: #f3f4f6;
          color: #9ca3af;
          cursor: default;
          flex-shrink: 0;
        }
        .hc-tj-dot.done {
          background: #d1fae5;
          color: #059669;
        }
        .hc-tj-line {
          width: 12px;
          height: 2px;
          background: #d1d5db;
          display: inline-block;
          border-radius: 1px;
        }
        .hc-tj-line.done {
          background: #10b981;
        }
        .hc-tj-dot:hover {
          opacity: 0.7;
          transform: scale(1.1);
          transition: all 0.1s;
        }
        .hc-table-editable {
          cursor: pointer;
          padding: 2px 6px;
          border-radius: 4px;
          transition: background 0.1s;
        }
        .hc-table-editable:hover {
          background: #f0f0f0;
        }
        .hc-table-placeholder {
          color: #d1d5db;
          font-style: italic;
        }
        .hc-table-dropdown {
          display: flex;
          flex-wrap: wrap;
          gap: 3px;
          max-width: 200px;
        }
        .hc-table-dd-item {
          padding: 3px 8px;
          border: 1px solid #e5e7eb;
          border-radius: 4px;
          background: #fff;
          font-size: 11px;
          cursor: pointer;
          white-space: nowrap;
          color: #374151;
          transition: all 0.1s;
        }
        .hc-table-dd-item:hover {
          background: #eff6ff;
          border-color: #93c5fd;
        }
        .hc-table-dd-item.active {
          background: #3b82f6;
          color: #fff;
          border-color: #3b82f6;
        }

        .herbal-grid-container {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .hc-date-section {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .hc-date-divider {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .hc-date-label {
          font-size: 14px;
          font-weight: 700;
          color: var(--text-primary, #1e293b);
          white-space: nowrap;
        }

        .hc-date-full {
          font-size: 12px;
          color: var(--text-muted, #94a3b8);
          white-space: nowrap;
        }

        .hc-date-count {
          font-size: 12px;
          color: var(--text-muted, #94a3b8);
          white-space: nowrap;
        }

        .hc-date-line {
          flex: 1;
          height: 1px;
          background: var(--border-color, #e2e8f0);
        }

        .herbal-card-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 12px;
        }

        .hc-card {
          background: var(--bg-primary, #fff);
          border: 1px solid var(--border-color, #e2e8f0);
          border-radius: 10px;
          overflow: hidden;
          cursor: pointer;
          transition: all 0.15s;
          display: flex;
          flex-direction: column;
        }

        .hc-card:hover {
          border-color: var(--accent-color, #3b82f6);
          box-shadow: 0 2px 8px rgba(0,0,0,0.07);
          transform: translateY(-1px);
        }

        .hc-card.expanded {
          border-color: var(--accent-color, #3b82f6);
          box-shadow: 0 2px 12px rgba(59,130,246,0.12);
        }

        .hc-card-accent {
          height: 4px;
          width: 100%;
          flex-shrink: 0;
        }

        .hc-card-body {
          padding: 12px 14px 10px;
          display: flex;
          flex-direction: column;
          gap: 6px;
          flex: 1;
        }

        /* 1줄: 환자정보 한 줄 */
        .hc-card-info-line {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
        }

        .hc-time-badge {
          font-size: 11px;
          font-weight: 600;
          color: #6b7280;
          background: #f3f4f6;
          padding: 1px 6px;
          border-radius: 4px;
          font-variant-numeric: tabular-nums;
        }
        .hc-patient-name {
          font-weight: 700;
          font-size: 13px;
          white-space: nowrap;
        }

        .hc-patient-chart {
          font-size: 11px;
          color: var(--text-muted, #94a3b8);
          white-space: nowrap;
        }

        .hc-info-doctor {
          font-size: 11px;
          color: #3b82f6;
          display: flex;
          align-items: center;
          gap: 3px;
          white-space: nowrap;
        }

        .hc-info-doctor i {
          font-size: 10px;
        }

        .hc-info-branch {
          font-size: 12px;
          font-weight: 700;
          white-space: nowrap;
        }

        .herbal-status-badge {
          font-size: 10px;
          padding: 1px 7px;
          border-radius: 10px;
          color: #fff;
          font-weight: 600;
          white-space: nowrap;
          flex-shrink: 0;
        }

        /* 행 (배송/탕전) */
        .hc-card-row {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
          font-size: 11px;
        }

        .hc-row-label {
          font-size: 11px;
          font-weight: 600;
          color: var(--text-muted, #94a3b8);
          white-space: nowrap;
          min-width: 28px;
        }

        .hc-tag {
          font-size: 11px;
          padding: 2px 8px;
          background: var(--bg-secondary, #f1f5f9);
          border-radius: 4px;
          color: var(--text-secondary, #64748b);
          white-space: nowrap;
        }

        /* 여정 파이프라인 */
        .hc-journey {
          display: flex;
          align-items: center;
          gap: 0;
          padding: 8px 0 4px;
          border-top: 1px solid var(--border-color, #f1f5f9);
          margin-top: 6px;
        }

        .hc-journey-step {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          background: none;
          border: none;
          cursor: pointer;
          padding: 2px 4px;
          transition: all 0.15s;
        }

        .hc-journey-step:hover {
          transform: scale(1.1);
        }

        .hc-journey-dot {
          font-size: 14px;
          color: var(--text-muted, #cbd5e1);
          line-height: 1;
        }

        .hc-journey-step.done .hc-journey-dot {
          color: #10b981;
        }

        .hc-journey-label {
          font-size: 9px;
          color: var(--text-muted, #94a3b8);
          white-space: nowrap;
        }

        .hc-journey-step.done .hc-journey-label {
          color: #10b981;
          font-weight: 600;
        }

        .hc-journey-line {
          flex: 1;
          height: 2px;
          min-width: 8px;
          background: var(--border-color, #e2e8f0);
          margin-bottom: 14px;
        }

        .hc-journey-line.done {
          background: #10b981;
        }

        .hc-card-detail {
          margin-top: 8px;
          padding-top: 8px;
          border-top: 1px solid var(--border-color, #e2e8f0);
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .hc-detail-row {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
        }

        .hc-detail-label {
          font-size: 11px;
          color: var(--text-muted, #94a3b8);
          font-weight: 600;
        }

        .hc-detail-medicines {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .herbal-medicine-chips {
          display: flex;
          gap: 4px;
          flex-wrap: wrap;
        }

        .herbal-medicine-chip {
          font-size: 12px;
          padding: 2px 8px;
          background: var(--bg-secondary, #f1f5f9);
          border-radius: 4px;
        }

        .hc-tag-editable {
          cursor: pointer;
          transition: all 0.15s;
        }

        .hc-tag-editable:hover {
          background: color-mix(in srgb, var(--accent-color, #3b82f6) 15%, transparent);
          border-color: var(--accent-color, #3b82f6);
        }

        .hc-delivery-chips {
          display: flex;
          gap: 4px;
          flex-wrap: wrap;
        }

        .hc-delivery-chip {
          font-size: 11px;
          padding: 2px 8px;
          border-radius: 4px;
          border: 1px solid var(--border-color, #e2e8f0);
          background: var(--bg-primary, #fff);
          cursor: pointer;
          transition: all 0.15s;
        }

        .hc-delivery-chip:hover {
          border-color: var(--accent-color, #3b82f6);
          background: color-mix(in srgb, var(--accent-color, #3b82f6) 10%, transparent);
        }

        .hc-delivery-chip.active {
          background: #3b82f6;
          color: #fff;
          border-color: #3b82f6;
        }

        .hc-decoction-input {
          padding: 2px 6px;
          border: 1px solid #3b82f6;
          border-radius: 4px;
          font-size: 12px;
          outline: none;
          background: var(--bg-primary, #fff);
          color: var(--text-primary, #1e293b);
        }

        .hc-decoction-value {
          cursor: pointer;
          transition: all 0.15s;
          font-size: 11px;
          color: var(--text-secondary, #64748b);
        }

        .hc-decoction-value:hover {
          color: #3b82f6;
        }

        /* 탕전 달력 프리뷰 */
        .hc-cal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.4);
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .hc-cal-modal {
          background: #fff;
          border-radius: 12px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.2);
          width: 90vw;
          max-width: 1000px;
          max-height: 85vh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .hc-cal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          border-bottom: 1px solid #e5e7eb;
        }
        .hc-cal-title {
          font-weight: 700;
          font-size: 16px;
          color: #1e293b;
        }
        .hc-cal-close {
          background: none;
          border: none;
          font-size: 18px;
          color: #94a3b8;
          cursor: pointer;
          padding: 4px 8px;
          border-radius: 6px;
        }
        .hc-cal-close:hover { background: #f1f5f9; color: #475569; }
        .hc-cal-nav {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 20px;
          font-size: 14px;
          font-weight: 600;
          color: #374151;
        }
        .hc-cal-nav button {
          background: none;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          padding: 4px 10px;
          cursor: pointer;
          color: #374151;
        }
        .hc-cal-nav button:hover { background: #f3f4f6; }
        .hc-cal-grid {
          display: grid;
          grid-template-columns: 55px repeat(7, 1fr);
          overflow-y: auto;
          flex: 1;
          border-top: 1px solid #e5e7eb;
        }
        .hc-cal-corner {
          background: #f8fafc;
          border-bottom: 1px solid #e5e7eb;
          border-right: 1px solid #e5e7eb;
          padding: 8px 4px;
          font-size: 10px;
          color: #94a3b8;
          text-align: center;
          position: sticky;
          top: 0;
          z-index: 2;
        }
        .hc-cal-day-header {
          background: #f8fafc;
          border-bottom: 1px solid #e5e7eb;
          border-right: 1px solid #f0f0f0;
          padding: 6px 4px;
          text-align: center;
          font-size: 12px;
          font-weight: 600;
          color: #374151;
          position: sticky;
          top: 0;
          z-index: 2;
        }
        .hc-cal-day-header.today {
          background: #eff6ff;
          color: #2563eb;
        }
        .hc-cal-day-num {
          display: block;
          font-size: 16px;
          font-weight: 700;
        }
        .hc-cal-time {
          border-bottom: 1px solid #f0f0f0;
          border-right: 1px solid #e5e7eb;
          padding: 4px 6px;
          font-size: 10px;
          color: #94a3b8;
          text-align: right;
          min-height: 50px;
          display: flex;
          align-items: flex-start;
          justify-content: flex-end;
        }
        .hc-cal-cell {
          border-bottom: 1px solid #f0f0f0;
          border-right: 1px solid #f0f0f0;
          min-height: 50px;
          padding: 2px;
          cursor: pointer;
          transition: background 0.15s;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .hc-cal-time.alt { background: #f8fafc; }
        .hc-cal-cell.alt { background: #f8fafc; }
        .hc-cal-cell:hover { background: #eff6ff; }
        .hc-cal-cell.selected { background: #dbeafe; }
        .hc-cal-cell.pending { background: #e0f2fe; box-shadow: inset 0 0 0 2px #38bdf8; }
        .hc-cal-order {
          padding: 3px 5px;
          border-radius: 4px;
          font-size: 12px;
          line-height: 1.3;
          overflow: hidden;
        }
        .hc-cal-order-name {
          font-weight: 600;
          display: block;
          font-size: 13px;
        }
        .hc-cal-order-id, .hc-cal-order-meta {
          font-size: 11px;
          opacity: 0.7;
        }
        .hc-cal-preview {
          background: rgba(59, 130, 246, 0.15) !important;
          border: 1.5px dashed #3b82f6;
          color: #3b82f6;
          opacity: 0.7;
          animation: hc-cal-pulse 1.5s ease-in-out infinite;
        }
        @keyframes hc-cal-pulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 0.9; }
        }
        .hc-ctx-backdrop {
          position: fixed;
          inset: 0;
          z-index: 1001;
        }
        .hc-ctx-menu {
          position: fixed;
          z-index: 1002;
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.15);
          min-width: 180px;
          overflow: hidden;
        }
        .hc-ctx-header {
          padding: 8px 12px;
          font-size: 12px;
          font-weight: 600;
          color: #64748b;
          background: #f8fafc;
          border-bottom: 1px solid #e2e8f0;
        }
        .hc-ctx-item {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          padding: 10px 14px;
          border: none;
          background: none;
          font-size: 13px;
          cursor: pointer;
          color: #374151;
          transition: background 0.1s;
        }
        .hc-ctx-item:hover {
          background: #f1f5f9;
        }
        .hc-ctx-item.delete {
          color: #dc2626;
        }
        .hc-ctx-item.delete:hover {
          background: #fef2f2;
        }
        .hc-cal-confirm-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 20px;
          background: #f0f9ff;
          border-top: 1px solid #bae6fd;
        }
        .hc-cal-confirm-info {
          font-size: 14px;
          color: #0c4a6e;
          display: flex;
          align-items: center;
        }
        .hc-cal-from {
          text-decoration: line-through;
          color: #94a3b8;
        }
        .hc-cal-to {
          font-weight: 700;
          color: #2563eb;
        }
        .hc-cal-change-label {
          margin-left: 6px;
          font-size: 12px;
          color: #64748b;
        }
        .hc-cal-confirm-actions {
          display: flex;
          gap: 8px;
        }
        .hc-cal-confirm-btn {
          padding: 6px 16px;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          border: none;
          transition: all 0.15s;
        }
        .hc-cal-confirm-btn.cancel {
          background: #f1f5f9;
          color: #64748b;
        }
        .hc-cal-confirm-btn.cancel:hover {
          background: #e2e8f0;
        }
        .hc-cal-confirm-btn.confirm {
          background: #3b82f6;
          color: #fff;
        }
        .hc-cal-confirm-btn.confirm:hover {
          background: #2563eb;
        }
      `}</style>
    </div>
  );
}

export default HerbalConsultationView;
