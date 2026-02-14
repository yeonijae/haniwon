import React from 'react';
import type { HerbalDraftFormData, ConsultationMethod, PaymentMonth, DraftDeliveryMethod } from '../../types';
import { CONSULTATION_METHODS, PAYMENT_MONTHS, DRAFT_DELIVERY_LABELS } from '../../types';
import SharedChipSelector from './SharedChipSelector';
import NokryongAdditionSection from './NokryongAdditionSection';
import DeliveryTimeEstimate from './DeliveryTimeEstimate';
import DecoctionCalendarPreview from '../DecoctionCalendarPreview';

interface BranchFollowUpPaymentProps {
  formData: HerbalDraftFormData;
  onUpdate: (updates: Partial<HerbalDraftFormData>) => void;
}

export default function BranchFollowUpPayment({ formData, onUpdate }: BranchFollowUpPaymentProps) {
  return (
    <>
      {/* 1. 상담방식 */}
      <SharedChipSelector<ConsultationMethod>
        label="상담방식"
        options={CONSULTATION_METHODS}
        selected={formData.consultationMethod}
        onSelect={v => onUpdate({ consultationMethod: v as ConsultationMethod })}
      />

      <hr className="herbal-draft-divider" />

      {/* 2. 결제 개월수 */}
      <SharedChipSelector<PaymentMonth>
        label="추가 결제"
        options={PAYMENT_MONTHS}
        selected={formData.paymentMonth}
        onSelect={v => onUpdate({ paymentMonth: v as PaymentMonth })}
        colorVariant={formData.paymentMonth === '결제실패' ? 'red' : 'green'}
      />

      {/* 3. 녹용추가 */}
      <NokryongAdditionSection
        grade={formData.nokryongGrade}
        count={formData.nokryongCount}
        onGradeChange={g => onUpdate({ nokryongGrade: g })}
        onCountChange={c => onUpdate({ nokryongCount: c })}
      />

      <hr className="herbal-draft-divider" />

      {/* 4. 탕전 일정 */}
      <DecoctionCalendarPreview
        selectedDate={formData.decoctionDate}
        onDateSelect={d => onUpdate({ decoctionDate: d })}
      />
      {formData.decoctionDate && (
        <div className="herbal-draft-selected-info">
          탕전 예정: {formatDateLabel(formData.decoctionDate)}
        </div>
      )}

      {/* 5. 발송 + 예상시간 */}
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

      {/* 6. 메모 */}
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
