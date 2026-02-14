import React, { useState, useCallback, useEffect, useRef } from 'react';
import type { PortalUser } from '@shared/types';
import type { LocalPatient } from '../lib/patientSync';
import type { HerbalDraftFormData, DraftBranchType, HerbalDraft, TreatmentMonth, DraftVisitPattern, NokryongRecommendation, ConsultationMethod, OtherSubType, PaymentMonth, NokryongGrade, DraftDeliveryMethod } from '../types';
import { DRAFT_BRANCH_TYPES, INITIAL_DRAFT_FORM_DATA } from '../types';
import { createHerbalDraft, updateHerbalDraft, useMedicineStock } from '../lib/api';
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
    memo: form.memo.trim() || undefined,
    medicine_items: form.medicines.length > 0
      ? JSON.stringify(form.medicines.map(m => ({ id: m.inventoryId, name: m.name, qty: m.quantity })))
      : undefined,
    receipt_date: undefined,  // api.ts에서 getCurrentDate()로 자동 설정
    status: form.decoctionDate ? 'scheduled' as const : 'draft' as const,
    created_by: user.name,
  };
}

// 폼이 변경되었는지 확인
function isDirty(form: HerbalDraftFormData): boolean {
  return form.branch !== '' ||
    form.treatmentMonths.length > 0 ||
    form.medicines.length > 0 ||
    form.memo.trim() !== '';
}

export default function HerbalDraftModal({ isOpen, patient, user, onClose, onSuccess, editDraft }: HerbalDraftModalProps) {
  const [formData, setFormData] = useState<HerbalDraftFormData>({ ...INITIAL_DRAFT_FORM_DATA });
  const [isSaving, setIsSaving] = useState(false);

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
      } else {
        setFormData({ ...INITIAL_DRAFT_FORM_DATA });
      }
    }
  }, [isOpen, editDraft]);

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
    if (isDirty(formData)) {
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
    if (!formData.branch) return;
    setIsSaving(true);
    try {
      if (editDraft?.id) {
        // 수정 모드
        await updateHerbalDraft(editDraft.id, formDataToRecord(formData, patient, user));
      } else {
        // 신규 모드
        await createHerbalDraft(formDataToRecord(formData, patient, user));

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
      console.error('한약 기록 저장 오류:', err);
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
            <h3>{editDraft ? '한약 기록 수정' : '한약 기록'} — {patient.name}</h3>
            <button className="pkg-modal-close-btn" onClick={handleClose}>
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
          <div className="pkg-modal-body">
            <div className="herbal-draft-form">

              {/* 분기 선택 */}
              <div className="herbal-draft-branch-selector">
                {DRAFT_BRANCH_TYPES.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    className={`herbal-draft-branch-chip${formData.branch === value ? ' active' : ''}`}
                    onClick={() => handleBranchChange(value)}
                  >
                    {label.includes('(') ? (
                      <>
                        {label.replace(/\s*\(.*/, '')}
                        <span className="herbal-draft-branch-sub">({label.split('(')[1]}</span>
                      </>
                    ) : label}
                  </button>
                ))}
              </div>

              {/* 분기별 컴포넌트 */}
              {formData.branch && <hr className="herbal-draft-divider" />}

              {formData.branch === '약초진' && (
                <BranchInitialHerbal formData={formData} onUpdate={handleUpdate} />
              )}
              {formData.branch === '약재진_N차' && (
                <BranchFollowUpDeduct formData={formData} onUpdate={handleUpdate} />
              )}
              {formData.branch === '약재진_재결제' && (
                <BranchFollowUpPayment formData={formData} onUpdate={handleUpdate} />
              )}
              {formData.branch === '기타상담' && (
                <BranchOtherConsultation formData={formData} onUpdate={handleUpdate} />
              )}

              {/* 저장 버튼 */}
              {formData.branch && (
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
              )}
            </div>
          </div>
        </div>
      </div>
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
    max-width: 560px;
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
    flex-direction: column;
    gap: 6px;
  }
  .herbal-draft-section-label {
    font-size: 12px;
    font-weight: 700;
    color: #6b7280;
    letter-spacing: 0.5px;
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
  }
  .herbal-draft-label {
    font-size: 13px;
    font-weight: 600;
    min-width: 60px;
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
`;
