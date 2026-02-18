import React, { useState, useCallback, useEffect, useRef } from 'react';
import type { PortalUser } from '@shared/types';
import type { LocalPatient } from '../lib/patientSync';
import type { HerbalDraftFormData, DraftBranchType, HerbalDraft, TreatmentMonth, DraftVisitPattern, NokryongRecommendation, ConsultationMethod, OtherSubType, PaymentMonth, NokryongGrade, DraftDeliveryMethod } from '../types';
import { DRAFT_BRANCH_TYPES, INITIAL_DRAFT_FORM_DATA } from '../types';
import { createHerbalDraft, updateHerbalDraft, useMedicineStock, getDecoctionOrders, getActiveHerbalPackages, getActiveNokryongPackages } from '../lib/api';
import type { HerbalPackage, NokryongPackage } from '../types';
import type { DecoctionOrder } from '../types';
import { DECOCTION_ORDER_STATUS_COLORS } from '../types';
import BranchInitialHerbal from './herbal-draft/BranchInitialHerbal';
import BranchFollowUpDeduct from './herbal-draft/BranchFollowUpDeduct';
import BranchFollowUpPayment from './herbal-draft/BranchFollowUpPayment';
import BranchOtherConsultation from './herbal-draft/BranchOtherConsultation';

interface HerbalDraftModalProps {
  isOpen: boolean;
  patient: LocalPatient;
  user: PortalUser;
  onClose: () => void;
  onSuccess: () => void;
  editDraft?: HerbalDraft | null;
  defaultReceiptDate?: string;
  defaultDoctor?: string;
  mode?: 'tangya' | 'jaboyak';
}

function recordToFormData(draft: HerbalDraft): HerbalDraftFormData {
  let medicines: HerbalDraftFormData['medicines'] = [];
  if (draft.medicine_items) {
    try {
      medicines = JSON.parse(draft.medicine_items).map((m: any) => ({
        inventoryId: m.id, name: m.name, quantity: m.qty, currentStock: 0, unit: ''
      }));
    } catch {}
  }
  return {
    branch: (draft.consultation_type || '') as DraftBranchType | '',
    treatmentMonths: draft.treatment_months ? draft.treatment_months.split(',') as TreatmentMonth[] : [],
    visitPattern: (draft.visit_pattern || '') as DraftVisitPattern | '',
    nokryongRecommendation: (draft.nokryong_type || '') as NokryongRecommendation | '',
    consultationMethod: (draft.consultation_method || '') as ConsultationMethod | '',
    subType: (draft.sub_type || '') as OtherSubType | '',
    paymentMonth: (draft.payment_type || '') as PaymentMonth | '',
    nokryongGrade: (draft.nokryong_grade || '') as NokryongGrade | '',
    nokryongCount: draft.nokryong_count || 1,
    deliveryMethod: (draft.delivery_method || '') as DraftDeliveryMethod | '',
    decoctionDate: draft.decoction_date || undefined,
    shippingDate: draft.shipping_date || '',
    medicationDays: draft.journey_status?.medication_days || 15,
    memo: draft.memo || '',
    medicines,
  };
}

// 폼 데이터 → DB 레코드 변환
function formDataToRecord(form: HerbalDraftFormData, patient: LocalPatient, user: PortalUser) {
  return {
    patient_id: patient.id,
    chart_number: patient.chart_number || undefined,
    patient_name: patient.name,
    consultation_type: form.branch || undefined,
    herbal_name: undefined as string | undefined,
    treatment_months: form.treatmentMonths.length > 0 ? form.treatmentMonths.join(',') : undefined,
    visit_pattern: form.visitPattern || undefined,
    nokryong_type: form.nokryongRecommendation || undefined,
    consultation_method: form.consultationMethod || undefined,
    sub_type: form.subType || undefined,
    payment_type: form.paymentMonth || undefined,
    nokryong_grade: form.nokryongGrade || undefined,
    nokryong_count: form.nokryongGrade ? form.nokryongCount : undefined,
    delivery_method: form.deliveryMethod || undefined,
    decoction_date: form.decoctionDate,
    shipping_date: form.shippingDate || undefined,
    memo: form.memo.trim() || undefined,
    medicine_items: form.medicines.length > 0
      ? JSON.stringify(form.medicines.map(m => ({ id: m.inventoryId, name: m.name, qty: m.quantity })))
      : undefined,
    doctor: undefined as string | undefined,  // handleSave에서 설정
    receipt_date: undefined as string | undefined,  // handleSave에서 설정
    journey_status: {
      medication_days: form.medicationDays || 15,
      ...(form.shippingDate && form.deliveryMethod ? {
        medication_start: form.deliveryMethod === 'pickup' || form.deliveryMethod === 'quick'
          ? form.decoctionDate?.split(' ')[0] || form.shippingDate
          : (() => { const d = new Date(form.shippingDate + 'T00:00:00'); d.setDate(d.getDate()+1); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })()
      } : {}),
    },
    status: form.decoctionDate ? 'scheduled' as const : 'draft' as const,
    created_by: user.name,
  };
}

// 폼이 변경되었는지 확인
function isDirty(form: HerbalDraftFormData, herbalPkgId?: number | null, nokryongPkgId?: number | null): boolean {
  return form.consultationMethod !== '' ||
    (form.decoctionDate != null && form.decoctionDate !== '') ||
    form.deliveryMethod !== '' ||
    form.treatmentMonths.length > 0 ||
    form.medicines.length > 0 ||
    form.memo.trim() !== '' ||
    !!herbalPkgId ||
    !!nokryongPkgId;
}

/* ─── 탕전 캘린더 그리드 (시간표 방식) ─── */
function CalendarGrid({ selectedDate, onDateSelect, patientName, chartNumber }: { selectedDate?: string; onDateSelect: (d: string) => void; patientName?: string; chartNumber?: string }) {
  const [viewStart, setViewStart] = useState(() => {
    const d = new Date(); d.setHours(0,0,0,0); return d;
  });
  const [orders, setOrders] = useState<DecoctionOrder[]>([]);
  const [pendingSlot, setPendingSlot] = useState<{ date: string; slot: string } | null>(null);

  const HOURS = Array.from({ length: 10 }, (_, i) => 9 + i); // 9~18
  const DAY_NAMES = ['일','월','화','수','목','금','토'];

  const viewDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(viewStart); d.setDate(d.getDate() + i); return d;
  });

  const fmtDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
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

  const goPrev = () => { const d = new Date(viewStart); d.setDate(d.getDate() - 7); setViewStart(d); };
  const goNext = () => { const d = new Date(viewStart); d.setDate(d.getDate() + 7); setViewStart(d); };
  const goToday = () => { const d = new Date(); d.setHours(0,0,0,0); setViewStart(d); };

  const handleCellClick = (dateStr: string, slot: string) => {
    setPendingSlot(prev => prev?.date === dateStr && prev?.slot === slot ? null : { date: dateStr, slot });
  };

  const confirmSlot = () => {
    if (!pendingSlot) return;
    onDateSelect(`${pendingSlot.date} ${pendingSlot.slot}`);
    setPendingSlot(null);
  };

  const weekLabel = (() => {
    const s = viewDates[0], e = viewDates[6];
    return `${s.getMonth()+1}/${s.getDate()} (${DAY_NAMES[s.getDay()]}) ~ ${e.getMonth()+1}/${e.getDate()} (${DAY_NAMES[e.getDay()]})`;
  })();

  // 기존 선택 날짜 파싱
  const selectedDatePart = selectedDate?.split(' ')[0];
  const selectedTimePart = selectedDate?.split(' ')[1];

  return (
    <div className="hcg-container">
      <div className="hcg-nav">
        <button type="button" onClick={goPrev}><i className="fas fa-chevron-left" /></button>
        <button type="button" className="hcg-today" onClick={goToday}>오늘</button>
        <button type="button" onClick={goNext}><i className="fas fa-chevron-right" /></button>
        <span className="hcg-label">{weekLabel}</span>
      </div>
      <div className="hcg-grid-wrapper">
        <div className="hcg-grid" style={{ gridTemplateColumns: `55px repeat(7, 1fr)` }}>
          {/* 헤더 */}
          <div className="hcg-corner">시간</div>
          {viewDates.map((d, i) => {
            const ds = fmtDate(d);
            const isToday = ds === todayStr;
            return (
              <div key={i} className={`hcg-day-header ${isToday ? 'today' : ''}`}>
                <span>{DAY_NAMES[d.getDay()]}</span>
                <span className="hcg-day-num">{d.getDate()}</span>
              </div>
            );
          })}
          {/* 시간 슬롯 */}
          {HOURS.map(hour => {
            const slotStr = `${String(hour).padStart(2,'0')}:00`;
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
                          <span className="hcg-order-meta">{o.patient_id}</span>
                        </div>
                      ))}
                      {isPending && patientName && (
                        <div className="hcg-order hcg-preview">
                          <span className="hcg-order-name">{patientName}</span>
                          {chartNumber && <span className="hcg-order-meta">{chartNumber.replace(/^0+/, '')}</span>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </React.Fragment>
            );
          })}
        </div>
      </div>
      {/* 확인 바 */}
      {pendingSlot && (
        <div className="hcg-confirm-bar">
          <div className="hcg-confirm-info">
            {selectedDate && (
              <>
                <span className="hcg-from">{(() => { const [dp, tp] = selectedDate.split(' '); const [,m,d] = dp.split('-'); const dt = new Date(dp+'T00:00:00'); return `${Number(m)}/${Number(d)}(${DAY_NAMES[dt.getDay()]}) ${tp || ''}`; })()}</span>
                <span style={{ margin: '0 6px', color: '#94a3b8' }}>→</span>
              </>
            )}
            <span className="hcg-to">{(() => { const [,m,d] = pendingSlot.date.split('-'); const dt = new Date(pendingSlot.date+'T00:00:00'); return `${Number(m)}/${Number(d)}(${DAY_NAMES[dt.getDay()]}) ${pendingSlot.slot}`; })()}</span>
            <span className="hcg-change-label">{selectedDate ? '으로 변경' : '에 배정'}</span>
          </div>
          <div className="hcg-confirm-actions">
            <button type="button" onClick={() => setPendingSlot(null)}>취소</button>
            <button type="button" className="confirm" onClick={confirmSlot}>{selectedDate ? '변경 확정' : '배정 확정'}</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function HerbalDraftModal({ isOpen, patient, user, onClose, onSuccess, editDraft, defaultReceiptDate, defaultDoctor, mode = 'tangya' }: HerbalDraftModalProps) {
  const [formData, setFormData] = useState<HerbalDraftFormData>({ ...INITIAL_DRAFT_FORM_DATA });
  const [receiptDate, setReceiptDate] = useState(defaultReceiptDate || '');
  const DOCTOR_LIST = ['강희종', '김대현', '임세열', '전인태'];
  const [doctor, setDoctor] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [herbalPackages, setHerbalPackages] = useState<HerbalPackage[]>([]);
  const [nokryongPackages, setNokryongPackages] = useState<NokryongPackage[]>([]);
  const [selectedHerbalPkgId, setSelectedHerbalPkgId] = useState<number | null>(null);
  const [selectedNokryongPkgId, setSelectedNokryongPkgId] = useState<number | null>(null);

  // 드래그 상태
  const containerRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  // 모달 열릴 때 위치 초기화 + 수정 모드 폼 초기화
  useEffect(() => {
    if (isOpen) {
      setPos(null);
      if (editDraft) {
        setFormData(recordToFormData(editDraft));
        setReceiptDate(editDraft.receipt_date || '');
        setDoctor(editDraft.doctor || '');
        setSelectedHerbalPkgId(editDraft.herbal_package_id || null);
        setSelectedNokryongPkgId(editDraft.nokryong_package_id || null);
      } else {
        setFormData({ ...INITIAL_DRAFT_FORM_DATA, ...(mode === 'jaboyak' ? { medicationDays: 7 } : {}) });
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
        setReceiptDate(defaultReceiptDate || todayStr);
        setDoctor(defaultDoctor || patient?.main_doctor || '');
        setSelectedHerbalPkgId(null);
        setSelectedNokryongPkgId(null);
      }
      // 선결제 패키지 조회
      if (patient?.mssql_id) {
        getActiveHerbalPackages(patient.mssql_id).then(setHerbalPackages).catch(() => {});
        getActiveNokryongPackages(patient.mssql_id).then(setNokryongPackages).catch(() => {});
      }
    }
  }, [isOpen, editDraft, defaultReceiptDate]);

  // 드래그 핸들러
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    dragState.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: rect.left,
      origY: rect.top,
    };

    const handleMouseMove = (ev: MouseEvent) => {
      if (!dragState.current) return;
      const dx = ev.clientX - dragState.current.startX;
      const dy = ev.clientY - dragState.current.startY;
      setPos({ x: dragState.current.origX + dx, y: dragState.current.origY + dy });
    };

    const handleMouseUp = () => {
      dragState.current = null;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, []);

  const handleUpdate = useCallback((updates: Partial<HerbalDraftFormData>) => {
    if ((updates as any)._openCalendar) {
      setShowCalendarModal(true);
      return;
    }
    setFormData(prev => ({ ...prev, ...updates }));
  }, []);

  const handleBranchChange = useCallback((branch: DraftBranchType) => {
    setFormData(prev =>
      prev.branch === branch
        ? { ...INITIAL_DRAFT_FORM_DATA }
        : { ...INITIAL_DRAFT_FORM_DATA, branch }
    );
  }, []);

  const handleClose = useCallback(() => {
    if (isDirty(formData, selectedHerbalPkgId, selectedNokryongPkgId)) {
      if (!window.confirm('저장하지 않고 닫으시겠습니까?')) return;
    }
    setFormData({ ...INITIAL_DRAFT_FORM_DATA });
    onClose();
  }, [formData, onClose]);

  // ESC 키로 닫기 — 이벤트 전파 차단하여 상위 모달이 같이 닫히지 않도록
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, handleClose]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const record = formDataToRecord(formData, patient, user);
      record.receipt_date = receiptDate || undefined;
      record.doctor = doctor || undefined;
      if (mode === 'jaboyak') record.herbal_name = '자보약';
      (record as any).herbal_package_id = selectedHerbalPkgId || undefined;
      (record as any).nokryong_package_id = selectedNokryongPkgId || undefined;

      if (editDraft?.id) {
        // 수정 모드
        await updateHerbalDraft(editDraft.id, record);
      } else {
        // 신규 모드
        await createHerbalDraft(record);

        // 상비약/보완처방: 재고 차감 (신규만)
        const today = new Date().toISOString().slice(0, 10);
        const purpose = formData.subType || '상비약';
        for (const med of formData.medicines) {
          await useMedicineStock(
            med.inventoryId,
            patient.id,
            patient.chart_number || '',
            patient.name,
            med.quantity,
            purpose,
            today,
          );
        }
      }

      setFormData({ ...INITIAL_DRAFT_FORM_DATA });
      onSuccess();
    } catch (err: any) {
      console.error('탕약 기록 저장 오류:', err);
      alert(err.message || '저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  const posStyle = pos
    ? { position: 'fixed' as const, left: pos.x, top: pos.y, transform: 'none' }
    : {};

  return (
    <>
      <style>{MODAL_STYLES}</style>
      <div className="pkg-modal-overlay herbal-draft-overlay">
        <div
          ref={containerRef}
          className="pkg-modal-container herbal-draft-modal-wide"
          style={posStyle}
        >
          <div
            className="pkg-modal-header herbal-draft-drag-handle"
            onMouseDown={handleMouseDown}
          >
            <h3>{editDraft ? `${mode === 'jaboyak' ? '자보약' : '탕약'} 기록 수정` : `${mode === 'jaboyak' ? '자보약' : '탕약'} 기록`} — {patient.name}</h3>
            <button className="pkg-modal-close-btn" onClick={handleClose}>
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
          <div className="pkg-modal-body">
            <div className="herbal-draft-form">

              {/* 진료일 + 담당의 */}
              <div className="herbal-draft-row" style={{ marginBottom: 6 }}>
                <label className="herbal-draft-label">진료일</label>
                <input
                  type="date"
                  className="herbal-draft-input"
                  value={receiptDate}
                  onChange={(e) => setReceiptDate(e.target.value)}
                />
              </div>
              <div className="herbal-draft-section" style={{ marginBottom: 6 }}>
                <span className="herbal-draft-section-label">담당의</span>
                <div className="herbal-draft-chips">
                  {DOCTOR_LIST.map(d => (
                    <button
                      key={d}
                      type="button"
                      className={`herbal-draft-chip${doctor === d ? ' active' : ''}`}
                      onClick={() => setDoctor(d)}
                    >{d}</button>
                  ))}
                </div>
              </div>

              {/* 선결제 차감 */}
              {(herbalPackages.length > 0 || nokryongPackages.length > 0) && (
                <>
                  <hr className="herbal-draft-divider" />
                  {herbalPackages.length > 0 && (
                    <div className="herbal-draft-row" style={{ marginBottom: 6 }}>
                      <label className="herbal-draft-label">한약 차감</label>
                      <div className="herbal-draft-chips">
                        <button
                          type="button"
                          className={`herbal-draft-chip${selectedHerbalPkgId === null ? ' active' : ''}`}
                          onClick={() => setSelectedHerbalPkgId(null)}
                        >없음</button>
                        {herbalPackages.map(p => (
                          <button
                            key={p.id}
                            type="button"
                            className={`herbal-draft-chip${selectedHerbalPkgId === p.id ? ' active' : ''}`}
                            onClick={() => setSelectedHerbalPkgId(selectedHerbalPkgId === p.id ? null : p.id!)}
                          >
                            {p.herbal_name || '한약'} {p.total_count}팩 (잔여 {p.remaining_count}/{p.total_count})
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {nokryongPackages.length > 0 && (
                    <div className="herbal-draft-row" style={{ marginBottom: 6 }}>
                      <label className="herbal-draft-label">녹용 차감</label>
                      <div className="herbal-draft-chips">
                        <button
                          type="button"
                          className={`herbal-draft-chip${selectedNokryongPkgId === null ? ' active' : ''}`}
                          onClick={() => setSelectedNokryongPkgId(null)}
                        >없음</button>
                        {nokryongPackages.map(p => (
                          <button
                            key={p.id}
                            type="button"
                            className={`herbal-draft-chip${selectedNokryongPkgId === p.id ? ' active' : ''}`}
                            onClick={() => setSelectedNokryongPkgId(selectedNokryongPkgId === p.id ? null : p.id!)}
                          >
                            {p.nokryong_type || '녹용'} {p.total_months}회 (잔여 {p.remaining_months}/{p.total_months})
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <hr className="herbal-draft-divider" />
                </>
              )}

              <BranchFollowUpDeduct formData={formData} onUpdate={handleUpdate} mode={mode} />

              {/* 저장 버튼 */}
              <div className="herbal-draft-actions">
                <button className="herbal-draft-btn-cancel" onClick={handleClose}>
                  취소
                </button>
                <button
                  className="herbal-draft-btn-save"
                  onClick={handleSave}
                  disabled={isSaving}
                >
                  {isSaving ? '저장 중...' : '등록'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* 탕전 캘린더 모달 */}
      {showCalendarModal && (
        <div className="herbal-cal-modal-overlay" onClick={() => setShowCalendarModal(false)}>
          <div className="herbal-cal-modal" onClick={e => e.stopPropagation()}>
            <div className="herbal-cal-modal-header">
              <h3>탕전 일정 선택 — {patient?.name}</h3>
              <button className="herbal-cal-modal-close" onClick={() => setShowCalendarModal(false)}>
                <i className="fas fa-times" />
              </button>
            </div>
            <CalendarGrid
              selectedDate={formData.decoctionDate}
              patientName={patient?.name}
              chartNumber={patient?.chart_number}
              onDateSelect={(date) => {
                setFormData(prev => ({ ...prev, decoctionDate: date }));
                setShowCalendarModal(false);
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}

const MODAL_STYLES = `
  .herbal-draft-overlay {
    pointer-events: none;
  }
  .herbal-draft-overlay .herbal-draft-modal-wide {
    pointer-events: auto;
  }
  .herbal-draft-modal-wide {
    max-width: 500px;
  }
  .herbal-draft-drag-handle {
    cursor: grab;
    user-select: none;
  }
  .herbal-draft-drag-handle:active {
    cursor: grabbing;
  }
  .herbal-draft-form {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .herbal-draft-branch-selector {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .herbal-draft-branch-chip {
    padding: 8px 16px;
    border: 2px solid #e5e7eb;
    border-radius: 8px;
    background: white;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
    flex: 1;
    min-width: 100px;
    text-align: center;
  }
  .herbal-draft-branch-sub {
    display: block;
    font-size: 11px;
    font-weight: 500;
    opacity: 0.7;
    margin-top: 2px;
  }
  .herbal-draft-branch-chip:hover {
    border-color: #9ca3af;
    background: #f9fafb;
  }
  .herbal-draft-branch-chip.active {
    border-color: #3b82f6;
    background: #eff6ff;
    color: #1d4ed8;
  }
  .herbal-draft-section {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 10px;
    margin-bottom: 6px;
  }
  .herbal-draft-section-label {
    font-size: 15px;
    font-weight: 600;
    color: #4b5563;
    min-width: 70px;
    flex-shrink: 0;
  }
  .herbal-draft-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .herbal-draft-chip {
    padding: 5px 12px;
    border: 1px solid #d1d5db;
    border-radius: 16px;
    background: white;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.15s;
    user-select: none;
  }
  .herbal-draft-chip:hover {
    border-color: #9ca3af;
    background: #f9fafb;
  }
  .herbal-draft-chip.active {
    border-color: #3b82f6;
    background: #eff6ff;
    color: #1d4ed8;
    font-weight: 600;
  }
  .herbal-draft-chip.active-green {
    border-color: #10b981;
    background: #ecfdf5;
    color: #065f46;
    font-weight: 600;
  }
  .herbal-draft-chip.active-amber {
    border-color: #f59e0b;
    background: #fffbeb;
    color: #92400e;
    font-weight: 600;
  }
  .herbal-draft-chip.active-red {
    border-color: #ef4444;
    background: #fef2f2;
    color: #991b1b;
    font-weight: 600;
  }
  .herbal-draft-row {
    display: flex;
    gap: 12px;
    align-items: center;
    margin-bottom: 6px;
  }
  .herbal-draft-label {
    font-size: 15px;
    font-weight: 600;
    color: #4b5563;
    min-width: 70px;
    flex-shrink: 0;
  }
  .herbal-draft-input {
    flex: 1;
    padding: 6px 10px;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 13px;
  }
  .herbal-draft-hint {
    padding: 6px 10px;
    background: #f8fafc;
    border-radius: 6px;
    font-size: 12px;
    color: #475569;
  }
  .herbal-draft-selected-info {
    padding: 8px 12px;
    background: #f0fdf4;
    border: 1px solid #86efac;
    border-radius: 6px;
    font-size: 13px;
    color: #166534;
  }
  .herbal-draft-estimate {
    padding: 6px 10px;
    border-radius: 6px;
    font-size: 12px;
  }
  .herbal-draft-estimate.info {
    background: #f0f9ff;
    color: #0369a1;
  }
  .herbal-draft-estimate.warn {
    background: #fffbeb;
    color: #92400e;
  }
  .herbal-draft-divider {
    border: none;
    border-top: 1px solid #e5e7eb;
    margin: 2px 0;
  }
  .herbal-draft-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 8px;
  }
  .herbal-draft-btn-cancel {
    padding: 6px 16px;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    background: white;
    font-size: 13px;
    cursor: pointer;
  }
  .herbal-draft-btn-cancel:hover {
    background: #f9fafb;
  }
  .herbal-draft-btn-save {
    padding: 6px 16px;
    background: #10b981;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
  }
  .herbal-draft-btn-save:hover {
    background: #059669;
  }
  .herbal-draft-btn-save:disabled {
    background: #9ca3af;
    cursor: not-allowed;
  }

  /* 탕전 일정 선택 버튼 */
  .herbal-draft-decoction-btn {
    display: flex;
    align-items: center;
    padding: 8px 14px;
    border: 1px dashed #d1d5db;
    border-radius: 8px;
    background: #f9fafb;
    font-size: 13px;
    color: #374151;
    cursor: pointer;
    transition: all 0.15s;
    width: 100%;
  }
  .herbal-draft-decoction-btn:hover {
    border-color: #3b82f6;
    background: #eff6ff;
    color: #1d4ed8;
  }

  /* 캘린더 모달 */
  .herbal-cal-modal-overlay {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.4);
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: auto;
  }
  .herbal-cal-modal {
    background: white;
    border-radius: 12px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    width: 95vw;
    max-width: 1000px;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .herbal-cal-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 20px;
    border-bottom: 1px solid #e5e7eb;
  }
  .herbal-cal-modal-header h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 700;
  }
  .herbal-cal-modal-close {
    border: none;
    background: none;
    font-size: 18px;
    color: #9ca3af;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 4px;
  }
  .herbal-cal-modal-close:hover { background: #f3f4f6; color: #374151; }

  /* CalendarGrid */
  .hcg-container { padding: 12px 16px; flex: 1; display: flex; flex-direction: column; min-height: 0; }
  .hcg-nav { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
  .hcg-nav button { border: 1px solid #e5e7eb; background: white; border-radius: 6px; padding: 4px 10px; cursor: pointer; font-size: 13px; }
  .hcg-nav button:hover { background: #f3f4f6; }
  .hcg-today { font-weight: 600; color: #2563eb; }
  .hcg-label { font-weight: 600; font-size: 14px; color: #334155; margin-left: 8px; }
  .hcg-grid-wrapper { flex: 1; overflow: auto; min-height: 0; border-radius: 8px; }
  .hcg-grid { display: grid; border: 1px solid #e2e8f0; border-radius: 8px; background: white; min-width: 760px; }
  .hcg-corner { padding: 6px 4px; font-size: 11px; color: #94a3b8; text-align: center; border-bottom: 1px solid #e2e8f0; border-right: 1px solid #e5e7eb; background: #f8fafc; }
  .hcg-day-header { padding: 6px 4px; text-align: center; font-size: 12px; font-weight: 600; color: #374151; border-bottom: 1px solid #e2e8f0; border-right: 1px solid #f0f0f0; background: #f8fafc; }
  .hcg-day-header.today { background: #eff6ff; color: #2563eb; }
  .hcg-day-num { display: block; font-size: 16px; font-weight: 700; }
  .hcg-time { padding: 4px 6px; font-size: 11px; color: #94a3b8; text-align: right; border-bottom: 1px solid #f0f0f0; border-right: 1px solid #e5e7eb; min-height: 50px; display: flex; align-items: flex-start; justify-content: flex-end; }
  .hcg-time.alt { background: #f8fafc; }
  .hcg-cell { border-bottom: 1px solid #f0f0f0; border-right: 1px solid #f0f0f0; min-height: 50px; padding: 2px; cursor: pointer; transition: background 0.15s; display: flex; flex-direction: column; gap: 2px; }
  .hcg-cell.alt { background: #f8fafc; }
  .hcg-cell:hover { background: #eff6ff; }
  .hcg-cell.selected { background: #dbeafe; }
  .hcg-cell.pending { background: #e0f2fe; box-shadow: inset 0 0 0 2px #38bdf8; }
  .hcg-order.hcg-preview { opacity: 0.45; background: #dbeafe; border-left: 3px solid #60a5fa; animation: hcg-fade-in 0.2s ease; }
  @keyframes hcg-fade-in { from { opacity: 0; } to { opacity: 0.45; } }
  .hcg-order { padding: 3px 5px; border-radius: 4px; font-size: 12px; line-height: 1.3; overflow: hidden; }
  .hcg-order-name { font-weight: 600; display: block; font-size: 13px; }
  .hcg-order-meta { font-size: 11px; opacity: 0.7; }
  .hcg-confirm-bar { display: flex; align-items: center; justify-content: space-between; padding: 10px 16px; background: #f0f9ff; border-top: 1px solid #bae6fd; }
  .hcg-confirm-info { display: flex; align-items: center; gap: 4px; font-size: 13px; }
  .hcg-from { text-decoration: line-through; color: #94a3b8; }
  .hcg-to { font-weight: 700; color: #2563eb; }
  .hcg-change-label { margin-left: 6px; font-size: 12px; color: #64748b; }
  .hcg-confirm-actions { display: flex; gap: 8px; }
  .hcg-confirm-actions button { padding: 6px 14px; border: 1px solid #e5e7eb; border-radius: 6px; background: white; cursor: pointer; font-size: 13px; }
  .hcg-confirm-actions button.confirm { background: #2563eb; color: white; border-color: #2563eb; font-weight: 600; }
  .hcg-confirm-actions button.confirm:hover { background: #1d4ed8; }
`;
