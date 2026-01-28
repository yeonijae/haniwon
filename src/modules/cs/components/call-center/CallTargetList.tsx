/**
 * 콜 대상자 목록 컴포넌트
 */

import React from 'react';
import { CALL_TYPE_LABELS } from '../../types/crm';
import type { CallTargetPatient } from '../../lib/callQueueApi';

interface CallTargetListProps {
  targets: CallTargetPatient[];
  onPatientClick: (patientId: number) => void;
  onAddToQueue: (target: CallTargetPatient) => void;
  onSendMessage?: (target: CallTargetPatient) => void;
}

const CallTargetList: React.FC<CallTargetListProps> = ({
  targets,
  onPatientClick,
  onAddToQueue,
  onSendMessage,
}) => {
  if (targets.length === 0) {
    return (
      <div className="empty-state">
        <i className="fa-solid fa-users-slash"></i>
        <span>조건에 해당하는 대상자가 없습니다.</span>
      </div>
    );
  }

  // 우선순위별 정렬 (높은 순)
  const sortedTargets = [...targets].sort((a, b) => b.priority - a.priority);

  return (
    <div className="target-list">
      {sortedTargets.map((target, index) => (
        <div key={`${target.patient_id}-${target.call_type}-${index}`} className="target-item">
          <div className="target-left">
            <span className={`call-type-badge ${target.call_type}`}>
              {CALL_TYPE_LABELS[target.call_type]}
            </span>
            <div
              className="patient-info"
              onClick={() => onPatientClick(target.patient_id)}
            >
              <span className="patient-name">{target.name}</span>
              <span className="patient-chart">({target.chart_number})</span>
            </div>
            {target.phone && (
              <a
                href={`tel:${target.phone}`}
                className="patient-phone"
                onClick={e => e.stopPropagation()}
              >
                <i className="fa-solid fa-phone"></i>
                {target.phone}
              </a>
            )}
          </div>

          <div className="target-center">
            <span className="target-reason">{target.reason}</span>
            {target.extra_info && (
              <div className="target-extra">
                {target.extra_info.herbal_name && (
                  <span className="extra-tag herbal">
                    {target.extra_info.herbal_name}
                  </span>
                )}
                {target.extra_info.remaining && (
                  <span className="extra-tag remaining">
                    잔여 {target.extra_info.remaining}첩
                  </span>
                )}
                {target.extra_info.days_since && (
                  <span className="extra-tag days">
                    {target.extra_info.days_since}일 경과
                  </span>
                )}
                {target.extra_info.total_visits && (
                  <span className="extra-tag visits">
                    {target.extra_info.total_visits}회 방문
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="target-right">
            <button
              className="btn-add-queue"
              onClick={() => onAddToQueue(target)}
              title="콜 큐에 추가"
            >
              <i className="fa-solid fa-plus"></i>
              큐 추가
            </button>
            {onSendMessage && target.phone && (
              <button
                className="btn-send-message"
                onClick={() => onSendMessage(target)}
                title="문자 발송"
              >
                <i className="fa-solid fa-message"></i>
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default CallTargetList;
