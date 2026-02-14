import React from 'react';
import type { HerbalDraftFormData, ConsultationMethod, DraftDeliveryMethod } from '../../types';
import { CONSULTATION_METHODS, DRAFT_DELIVERY_LABELS } from '../../types';
import SharedChipSelector from './SharedChipSelector';
import DeliveryTimeEstimate from './DeliveryTimeEstimate';
import DecoctionCalendarPreview from '../DecoctionCalendarPreview';

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

      {/* 2. 탕전 일정 */}
      <DecoctionCalendarPreview
        selectedDate={formData.decoctionDate}
        onDateSelect={d => onUpdate({ decoctionDate: d })}
      />
      {formData.decoctionDate && (
        <div className="herbal-draft-selected-info">
          탕전 예정: {formatDateLabel(formData.decoctionDate)}
        </div>
      )}

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
  const d = new Date(dateStr + 'T00:00:00');
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  return `${d.getMonth() + 1}/${d.getDate()} (${dayNames[d.getDay()]})`;
}
