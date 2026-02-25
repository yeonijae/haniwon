import React from 'react';
import type { HerbalDraftFormData, TreatmentMonth } from '../../types';
import {
  TREATMENT_MONTHS,
  DRAFT_VISIT_PATTERNS,
  NOKRYONG_RECOMMENDATIONS,
  PAYMENT_MONTHS,
  DRAFT_DELIVERY_LABELS,
} from '../../types';
import type { DraftDeliveryMethod, NokryongRecommendation, PaymentMonth, DraftVisitPattern } from '../../types';
import SharedChipSelector from './SharedChipSelector';
import NokryongAdditionSection from './NokryongAdditionSection';
import DeliveryTimeEstimate from './DeliveryTimeEstimate';
// DecoctionCalendarPreview removed — calendar modal managed by HerbalDraftModal

interface BranchInitialHerbalProps {
  formData: HerbalDraftFormData;
  onUpdate: (updates: Partial<HerbalDraftFormData>) => void;
}

const VISIT_PATTERN_LABELS: Record<DraftVisitPattern, string> = {
  '15일': '15일마다',
  '30일': '30일마다',
};

// 치료개월수 다중선택 → 범위 문자열로 변환
function formatTreatmentRange(months: TreatmentMonth[]): string {
  if (months.length === 0) return '';
  if (months.length === 1) return months[0];
  const sorted = [...months].sort((a, b) =>
    TREATMENT_MONTHS.indexOf(a) - TREATMENT_MONTHS.indexOf(b)
  );
  return `${sorted[0]} ~ ${sorted[sorted.length - 1]}`;
}

export default function BranchInitialHerbal({ formData, onUpdate }: BranchInitialHerbalProps) {
  return (
    <>
      {/* 1. 치료개월수 (다중선택) */}
      <SharedChipSelector<TreatmentMonth>
        label="치료개월수"
        options={TREATMENT_MONTHS}
        selected={formData.treatmentMonths}
        onSelect={v => onUpdate({ treatmentMonths: v as TreatmentMonth[] })}
        multi
        colorVariant="blue"
      />
      {formData.treatmentMonths.length >= 2 && (
        <div className="herbal-draft-hint">
          {formatTreatmentRange(formData.treatmentMonths)}
        </div>
      )}

      {/* 2. 내원패턴 */}
      <SharedChipSelector<DraftVisitPattern>
        label="내원패턴"
        options={DRAFT_VISIT_PATTERNS}
        selected={formData.visitPattern}
        onSelect={v => onUpdate({ visitPattern: v as DraftVisitPattern })}
        labelMap={VISIT_PATTERN_LABELS}
      />

      {/* 3. 녹용권유 */}
      <SharedChipSelector<NokryongRecommendation>
        label="녹용권유"
        options={NOKRYONG_RECOMMENDATIONS}
        selected={formData.nokryongRecommendation}
        onSelect={v => onUpdate({ nokryongRecommendation: v as NokryongRecommendation })}
        colorVariant="amber"
      />

      <hr className="herbal-draft-divider" />

      {/* 4. 결제 개월수 */}
      <SharedChipSelector<PaymentMonth>
        label="맞춤한약 결제"
        options={PAYMENT_MONTHS}
        selected={formData.paymentMonth}
        onSelect={v => onUpdate({ paymentMonth: v as PaymentMonth })}
        colorVariant={formData.paymentMonth === '결제실패' ? 'red' : 'green'}
      />

      {/* 5. 녹용추가 */}
      <NokryongAdditionSection
        grade={formData.nokryongGrade}
        count={formData.nokryongCount}
        onGradeChange={g => onUpdate({ nokryongGrade: g })}
        onCountChange={c => onUpdate({ nokryongCount: c })}
      />

      <hr className="herbal-draft-divider" />

      {/* 7. 발송 */}
      <SharedChipSelector<DraftDeliveryMethod>
        label="발송"
        options={(['pickup', 'express', 'quick', 'other'] as DraftDeliveryMethod[])}
        selected={formData.deliveryMethod}
        onSelect={v => onUpdate({ deliveryMethod: v as DraftDeliveryMethod })}
        labelMap={DRAFT_DELIVERY_LABELS}
      />
      {formData.deliveryMethod && (
        <div className="herbal-draft-row" style={{ marginBottom: 6 }}>
          <label className="herbal-draft-label">발송일</label>
          <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <input
              type="date"
              value={formData.shippingDate || ''}
              onChange={e => onUpdate({ shippingDate: e.target.value })}
              className="herbal-draft-input"
              style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
              id={"shipping-date-picker-" + (formData.branch || 'x')}
            />
            <button
              type="button"
              className="herbal-draft-input"
              style={{ cursor: 'pointer', textAlign: 'left', minWidth: 160 }}
              onClick={() => (document.getElementById("shipping-date-picker-" + (formData.branch || 'x')) as HTMLInputElement)?.showPicker?.()}
            >
              {formData.shippingDate ? (() => {
                const d = new Date(formData.shippingDate + 'T00:00:00');
                const days = ['일','월','화','수','목','금','토'];
                return `${d.getFullYear()}. ${String(d.getMonth()+1).padStart(2,'0')}. ${String(d.getDate()).padStart(2,'0')}. (${days[d.getDay()]})`;
              })() : '날짜 선택'}
            </button>
          </div>
          {(() => {
            const today = new Date();
            const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
            const tmr = new Date(today); tmr.setDate(tmr.getDate()+1);
            return (<>
              <button type="button" className="herbal-draft-chip" style={{ marginLeft: 4, fontSize: 12, padding: '3px 10px' }} onClick={() => onUpdate({ shippingDate: fmt(today) })}>오늘</button>
              <button type="button" className="herbal-draft-chip" style={{ fontSize: 12, padding: '3px 10px' }} onClick={() => onUpdate({ shippingDate: fmt(tmr) })}>내일</button>
            </>);
          })()}
        </div>
      )}

      {/* 8. 메모 */}
      <div className="herbal-draft-row">
        <label className="herbal-draft-label">메모</label>
        <input
          type="text"
          className="herbal-draft-input"
          value={formData.memo}
          onChange={e => onUpdate({ memo: e.target.value })}
          placeholder="예: 출장 다녀오셔서 10일뒤에 받기를 원하심"
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
