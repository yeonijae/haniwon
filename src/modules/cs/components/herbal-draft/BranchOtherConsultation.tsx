import React from 'react';
import type { HerbalDraftFormData, ConsultationMethod, OtherSubType, DraftDeliveryMethod } from '../../types';
import { CONSULTATION_METHODS, OTHER_SUB_TYPES, DRAFT_DELIVERY_LABELS } from '../../types';
import SharedChipSelector from './SharedChipSelector';
import DeliveryTimeEstimate from './DeliveryTimeEstimate';
import MedicineSearchSelect from './MedicineSearchSelect';
// DecoctionCalendarPreview removed — calendar modal managed by HerbalDraftModal

interface BranchOtherConsultationProps {
  formData: HerbalDraftFormData;
  onUpdate: (updates: Partial<HerbalDraftFormData>) => void;
}

// 세부유형에 따라 표시할 섹션 결정
function getVisibleSections(subType: OtherSubType | ''): { decoction: boolean; delivery: boolean; medicine: boolean } {
  switch (subType) {
    case '재처방':
      return { decoction: true, delivery: true, medicine: false };
    case '보완처방':
      return { decoction: true, delivery: true, medicine: true };
    case '상비약':
      return { decoction: false, delivery: true, medicine: true };
    case '마무리':
    case '중간점검':
    case '단순문의':
      return { decoction: false, delivery: false, medicine: false };
    default:
      return { decoction: false, delivery: false, medicine: false };
  }
}

// 세부유형별 설명
const SUB_TYPE_DESCRIPTIONS: Record<OtherSubType, string> = {
  '재처방': '선결제 차감 없음 — 이전 처방을 새로 준비',
  '보완처방': '선결제 차감 없음 — 기존 처방에 보완 한약 추가',
  '상비약': '별도 결제 발생 — 상비약 처방',
  '마무리': '차감/결제 없음 — 복용 완료 후 상담',
  '중간점검': '차감 없음 — 담당의 요청 내원 진단',
  '단순문의': '차감 없음 — 환자 요청 상담',
};

export default function BranchOtherConsultation({ formData, onUpdate }: BranchOtherConsultationProps) {
  const sections = getVisibleSections(formData.subType);

  return (
    <>
      {/* 1. 상담방식 */}
      <SharedChipSelector<ConsultationMethod>
        label="상담방식"
        options={CONSULTATION_METHODS}
        selected={formData.consultationMethod}
        onSelect={v => onUpdate({ consultationMethod: v as ConsultationMethod })}
      />

      {/* 2. 세부유형 */}
      <SharedChipSelector<OtherSubType>
        label="세부유형"
        options={OTHER_SUB_TYPES}
        selected={formData.subType}
        onSelect={v => onUpdate({ subType: v as OtherSubType })}
        colorVariant="green"
      />

      {/* 세부유형 설명 */}
      {formData.subType && (
        <div className="herbal-draft-hint">
          {SUB_TYPE_DESCRIPTIONS[formData.subType]}
        </div>
      )}

      {/* 3. 조건부: 상비약 선택 (보완처방, 상비약) */}
      {sections.medicine && (
        <>
          <hr className="herbal-draft-divider" />
          <MedicineSearchSelect
            medicines={formData.medicines}
            onChange={medicines => onUpdate({ medicines })}
          />
        </>
      )}

      {/* 4. 조건부: 탕전 일정 (재처방, 보완처방) */}
      {sections.decoction && (
        <>
          <hr className="herbal-draft-divider" />
          <div className="herbal-draft-field-group">
            <label className="herbal-draft-field-label">탕전 일정</label>
            <button
              type="button"
              className="herbal-draft-decoction-btn"
              onClick={() => onUpdate({ _openCalendar: true } as any)}
            >
              {formData.decoctionDate ? (
                <><i className="fas fa-calendar-check" style={{ marginRight: 6, color: '#10b981' }} />{formatDateLabel(formData.decoctionDate)}</>
              ) : (
                <><i className="fas fa-calendar-plus" style={{ marginRight: 6 }} />탕전 일정 선택</>
              )}
            </button>
          </div>
        </>
      )}

      {/* 4. 조건부: 발송 (재처방, 보완처방, 상비약) */}
      {sections.delivery && (
        <>
          {!sections.decoction && <hr className="herbal-draft-divider" />}
          <SharedChipSelector<DraftDeliveryMethod>
            label="발송"
            options={(['pickup', 'express', 'quick', 'other'] as DraftDeliveryMethod[])}
            selected={formData.deliveryMethod}
            onSelect={v => onUpdate({ deliveryMethod: v as DraftDeliveryMethod })}
            labelMap={DRAFT_DELIVERY_LABELS}
          />
          {sections.decoction && (
            <DeliveryTimeEstimate
              deliveryMethod={formData.deliveryMethod}
              decoctionDate={formData.decoctionDate}
            />
          )}
        </>
      )}

      {/* 5. 메모 (항상 표시) */}
      {(sections.delivery || sections.decoction) && <hr className="herbal-draft-divider" />}
      <div className="herbal-draft-row">
        <label className="herbal-draft-label">메모</label>
        <input
          type="text"
          className="herbal-draft-input"
          value={formData.memo}
          onChange={e => onUpdate({ memo: e.target.value })}
          placeholder="메모 (선택)"
        />
      </div>
    </>
  );
}

function formatDateLabel(dateStr: string): string {
  const [datePart, timePart] = dateStr.split(' ');
  const d = new Date(datePart + 'T00:00:00');
  if (isNaN(d.getTime())) return dateStr;
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  return `${d.getMonth() + 1}/${d.getDate()} (${dayNames[d.getDay()]})${timePart ? ' ' + timePart : ''}`;
}
