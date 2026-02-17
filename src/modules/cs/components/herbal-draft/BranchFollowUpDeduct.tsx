import React from 'react';
import type { HerbalDraftFormData, ConsultationMethod, DraftDeliveryMethod } from '../../types';
import { CONSULTATION_METHODS, DRAFT_DELIVERY_LABELS } from '../../types';
import SharedChipSelector from './SharedChipSelector';
import DeliveryTimeEstimate from './DeliveryTimeEstimate';
// DecoctionCalendarPreview removed — calendar modal managed by HerbalDraftModal

interface BranchFollowUpDeductProps {
  formData: HerbalDraftFormData;
  onUpdate: (updates: Partial<HerbalDraftFormData>) => void;
}

export default function BranchFollowUpDeduct({ formData, onUpdate }: BranchFollowUpDeductProps) {
  return (
    <>
      {/* 1. 상담방식 */}
      <SharedChipSelector<ConsultationMethod>
        label="상담방식"
        options={CONSULTATION_METHODS}
        selected={formData.consultationMethod}
        onSelect={v => onUpdate({ consultationMethod: v as ConsultationMethod })}
      />

      <div className="herbal-draft-hint" style={{ color: '#6b7280' }}>
        선결제분 차감 상담
      </div>

      <hr className="herbal-draft-divider" />

      {/* 2. 탕전 일정 — 캘린더 모달은 HerbalDraftModal에서 관리 */}
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

      {/* 3. 발송 + 예상시간 */}
      <SharedChipSelector<DraftDeliveryMethod>
        label="발송"
        options={(['pickup', 'express', 'quick', 'other'] as DraftDeliveryMethod[])}
        selected={formData.deliveryMethod}
        onSelect={v => onUpdate({ deliveryMethod: v as DraftDeliveryMethod })}
        labelMap={DRAFT_DELIVERY_LABELS}
      />
      <DeliveryTimeEstimate
        deliveryMethod={formData.deliveryMethod}
        decoctionDate={formData.decoctionDate}
      />

      {/* 4. 메모 */}
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
