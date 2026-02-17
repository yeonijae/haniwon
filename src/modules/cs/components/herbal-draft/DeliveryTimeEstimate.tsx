import React from 'react';
import type { DraftDeliveryMethod } from '../../types';

interface DeliveryTimeEstimateProps {
  deliveryMethod: DraftDeliveryMethod | '';
  decoctionDate?: string;
}

export default function DeliveryTimeEstimate({ deliveryMethod, decoctionDate }: DeliveryTimeEstimateProps) {
  if (!decoctionDate) return null;

  const dateLabel = formatDateShort(decoctionDate);

  let message = '';
  let style: 'info' | 'warn' = 'info';

  if (deliveryMethod === 'pickup') {
    // 내원수령: 조제→탕전→포장 약 2시간 30분
    message = `${dateLabel} 탕전 시작 후 약 2시간 30분 소요 (조제→탕전→포장)`;
  } else if (deliveryMethod === 'express') {
    // 택배: 14시 픽업 마감
    message = `택배 픽업 마감 14시 — ${dateLabel} 14시 이전 완료 시 당일 발송, 이후 익일 발송`;
    style = 'warn';
  } else if (deliveryMethod === 'quick') {
    message = `${dateLabel} 탕전 완료 후 퀵 배차 (약 2시간 30분 + 퀵 소요시간)`;
  } else {
    return null;
  }

  return (
    <div className={`herbal-draft-estimate ${style}`}>
      <i className={`fa-solid ${style === 'warn' ? 'fa-triangle-exclamation' : 'fa-clock'}`} style={{ marginRight: 6 }} />
      {message}
    </div>
  );
}

function formatDateShort(dateStr: string): string {
  const [datePart, timePart] = dateStr.split(' ');
  const d = new Date(datePart + 'T00:00:00');
  if (isNaN(d.getTime())) return dateStr;
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  return `${d.getMonth() + 1}/${d.getDate()}(${dayNames[d.getDay()]})${timePart ? ' ' + timePart : ''}`;
}
