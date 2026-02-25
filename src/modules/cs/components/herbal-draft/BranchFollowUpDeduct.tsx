import React, { useEffect } from 'react';
import type { HerbalDraftFormData, ConsultationMethod, DraftDeliveryMethod } from '../../types';
import { CONSULTATION_METHODS, DRAFT_DELIVERY_LABELS } from '../../types';
import SharedChipSelector from './SharedChipSelector';
import DeliveryTimeEstimate from './DeliveryTimeEstimate';

// 한국 공휴일 (고정)
const KR_HOLIDAYS_2025_2026 = [
  '2025-01-01','2025-01-28','2025-01-29','2025-01-30','2025-03-01','2025-05-05','2025-05-06','2025-06-06','2025-08-15','2025-10-03','2025-10-05','2025-10-06','2025-10-07','2025-10-09','2025-12-25',
  '2026-01-01','2026-02-16','2026-02-17','2026-02-18','2026-03-01','2026-05-05','2026-05-24','2026-06-06','2026-08-15','2026-09-24','2026-09-25','2026-09-26','2026-10-03','2026-10-09','2026-12-25',
];

function isShippableDate(dateStr: string): boolean {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay();
  if (day === 0 || day === 6) return false; // 토/일
  if (KR_HOLIDAYS_2025_2026.includes(dateStr)) return false;
  return true;
}

function getNextShippableDate(fromDate: string): string {
  const d = new Date(fromDate + 'T00:00:00');
  for (let i = 0; i < 14; i++) {
    const str = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    if (isShippableDate(str)) return str;
    d.setDate(d.getDate() + 1);
  }
  return fromDate;
}

function calcMedicationStart(delivery: string, shippingDate: string, decoctionDate?: string): string {
  if (delivery === 'pickup' || delivery === 'quick') {
    // 내원수령/퀵: 탕전일 당일
    return decoctionDate?.split(' ')[0] || shippingDate;
  }
  // 택배: 발송일 +1
  const d = new Date(shippingDate + 'T00:00:00');
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function formatShortDate(dateStr: string): string {
  const [,m,d] = dateStr.split('-');
  const dt = new Date(dateStr + 'T00:00:00');
  const dn = ['일','월','화','수','목','금','토'][dt.getDay()];
  return `${Number(m)}/${Number(d)}(${dn})`;
}
// DecoctionCalendarPreview removed — calendar modal managed by HerbalDraftModal

interface BranchFollowUpDeductProps {
  formData: HerbalDraftFormData;
  onUpdate: (updates: Partial<HerbalDraftFormData>) => void;
  mode?: 'tangya' | 'jaboyak';
}

export default function BranchFollowUpDeduct({ formData, onUpdate, mode = 'tangya' }: BranchFollowUpDeductProps) {
  // 탕전일/배송방식 변경 시 배송일 자동 계산
  useEffect(() => {
    if (!formData.decoctionDate || !formData.deliveryMethod) return;
    const decDate = formData.decoctionDate.split(' ')[0];
    if (formData.deliveryMethod === 'express') {
      // 택배: 탕전일 이후 첫 발송 가능일
      const ship = getNextShippableDate(decDate);
      if (ship !== formData.shippingDate) onUpdate({ shippingDate: ship });
    } else {
      // 내원/퀵/기타: 탕전일 당일
      if (decDate !== formData.shippingDate) onUpdate({ shippingDate: decDate });
    }
  }, [formData.decoctionDate, formData.deliveryMethod]);

  const medicationStart = formData.shippingDate && formData.deliveryMethod
    ? calcMedicationStart(formData.deliveryMethod, formData.shippingDate, formData.decoctionDate)
    : '';

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

      {/* 3. 발송 */}
      <SharedChipSelector<DraftDeliveryMethod>
        label="발송"
        options={(mode === 'jaboyak' ? ['pickup', 'express'] : ['pickup', 'express', 'quick', 'other']) as DraftDeliveryMethod[]}
        selected={formData.deliveryMethod}
        onSelect={v => onUpdate({ deliveryMethod: v as DraftDeliveryMethod })}
        labelMap={DRAFT_DELIVERY_LABELS}
      />

      {/* 발송일자 */}
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

      {/* 4. 복약일수 */}
      <div className="herbal-draft-row" style={{ marginBottom: 6 }}>
        <label className="herbal-draft-label">복약일수</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {(mode === 'jaboyak' ? [7] : [10, 15, 20, 30]).map(d => (
            <button
              key={d}
              type="button"
              className={`herbal-draft-chip${formData.medicationDays === d ? ' active' : ''}`}
              onClick={() => onUpdate({ medicationDays: d })}
            >{d}일</button>
          ))}
          <input
            type="number"
            value={formData.medicationDays}
            onChange={e => onUpdate({ medicationDays: Math.max(1, parseInt(e.target.value) || (mode === 'jaboyak' ? 7 : 15)) })}
            style={{ width: 50, padding: '4px 6px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, textAlign: 'center' }}
          />
          <span style={{ fontSize: 12, color: '#6b7280' }}>일</span>
        </div>
      </div>

      {/* 복약 시작 예상일 */}
      {medicationStart && formData.deliveryMethod && (
        <div className="herbal-draft-row" style={{ marginBottom: 6 }}>
          <label className="herbal-draft-label">복약시작</label>
          <span style={{ fontSize: 13, color: '#2563eb', fontWeight: 600 }}>
            {formatShortDate(medicationStart)}
          </span>
          <span style={{ fontSize: 11, color: '#6b7280', marginLeft: 4 }}>
            ~ {(() => {
              const end = new Date(medicationStart + 'T00:00:00');
              end.setDate(end.getDate() + (formData.medicationDays || 15) - 1);
              return formatShortDate(`${end.getFullYear()}-${String(end.getMonth()+1).padStart(2,'0')}-${String(end.getDate()).padStart(2,'0')}`);
            })()} ({formData.medicationDays}일)
          </span>
        </div>
      )}

      {/* 5. 메모 */}
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
