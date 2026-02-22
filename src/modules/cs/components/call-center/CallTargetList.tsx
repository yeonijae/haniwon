/**
 * 콜 대상자 목록 컴포넌트 (선택 + 드래그앤드롭)
 */

import React from 'react';
import { CALL_TYPE_LABELS } from '../../types/crm';
import type { CallTargetPatient } from '../../lib/callQueueApi';

function fmtDate(s: string): string {
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return `${String(d.getFullYear()).slice(2)}/${d.getMonth()+1}/${d.getDate()}`;
}

/** 콜 유형별 예정일 계산 */
function calcTargetDueDate(target: CallTargetPatient): string | null {
  const start = target.extra_info?.medication_start;
  const days = parseInt(target.extra_info?.medication_days || '15', 10);
  if (!start) return null;
  const startDate = new Date(start + 'T00:00:00');
  if (isNaN(startDate.getTime())) return null;

  if (target.call_type === 'delivery_call') {
    // 배송콜: 복약시작 + 2일
    const d = new Date(startDate);
    d.setDate(d.getDate() + 2);
    return fmt(d);
  } else if (target.call_type === 'visit_call') {
    // 내원콜: 복약시작 + 복약일수 - 5
    const d = new Date(startDate);
    d.setDate(d.getDate() + days - 5);
    return fmt(d);
  } else if (target.call_type === 'after_call') {
    // 애프터콜: 복약시작 + 복약일수 + 1
    const d = new Date(startDate);
    d.setDate(d.getDate() + days + 1);
    return fmt(d);
  }
  return null;
}

function fmt(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

interface CallTargetListProps {
  targets: CallTargetPatient[];
  selected: Set<number>;
  onToggleSelect: (idx: number) => void;
  onPatientClick: (patientId: number) => void;
  onAddToQueue: (target: CallTargetPatient) => void;
  onSendMessage?: (target: CallTargetPatient) => void;
  onDragStart: (e: React.DragEvent, index: number) => void;
}

const CallTargetList: React.FC<CallTargetListProps> = ({
  targets,
  selected,
  onToggleSelect,
  onPatientClick,
  onAddToQueue,
  onSendMessage,
  onDragStart,
}) => {
  if (targets.length === 0) {
    return (
      <div className="occ-empty">조건에 해당하는 대상자가 없습니다.</div>
    );
  }

  return (
    <div className="ct-list">
      {targets.map((target, index) => (
        <div
          key={`${target.patient_id}-${target.call_type}-${index}`}
          className={`ct-card ${selected.has(index) ? 'ct-selected' : ''}`}
          draggable
          onDragStart={e => onDragStart(e, index)}
        >
          <div className="ct-row1">
            <input
              type="checkbox"
              className="ct-checkbox"
              checked={selected.has(index)}
              onChange={() => onToggleSelect(index)}
            />
            <span className={`call-type-badge sm ${target.call_type}`}>
              {CALL_TYPE_LABELS[target.call_type]}
            </span>
            {target.extra_info?.herbal_name && (
              <span className="ct-tag">{target.extra_info.herbal_name}</span>
            )}
            <span className="ct-name" onClick={() => onPatientClick(target.patient_id)}>
              {target.name}
            </span>
            <span className="ct-chart">{target.chart_number}</span>
            {target.phone && (
              <a href={`tel:${target.phone}`} className="ct-phone" onClick={e => e.stopPropagation()}>
                {target.phone}
              </a>
            )}
          </div>
          <div className="ct-row2">
            {(() => {
              const dueDate = calcTargetDueDate(target);
              return dueDate ? <span className="ct-due">{fmtDate(dueDate)}</span> : null;
            })()}
            <span className="ct-reason">{target.reason}</span>
            <div className="ct-actions">
              <button className="ct-btn-add" onClick={() => onAddToQueue(target)} title="큐 추가">
                <i className="fa-solid fa-plus"></i>
              </button>
              {onSendMessage && target.phone && (
                <button className="ct-btn-msg" onClick={() => onSendMessage(target)} title="문자">
                  <i className="fa-solid fa-message"></i>
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default CallTargetList;
