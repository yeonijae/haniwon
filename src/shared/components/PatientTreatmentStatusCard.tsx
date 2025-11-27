/**
 * 환자 치료 상태 카드 컴포넌트
 * 차트나 환자 상세 페이지에서 사용
 */

import React, { useState, useEffect } from 'react';
import * as patientCareApi from '@shared/api/patientCareApi';
import type { PatientTreatmentStatus, ClosureType } from '@shared/types/patientCare';
import { TREATMENT_STATUS_LABELS, CLOSURE_TYPE_LABELS } from '@shared/types/patientCare';

interface PatientTreatmentStatusCardProps {
  patientId: number;
  patientName?: string;
  onStatusChange?: () => void;
}

const PatientTreatmentStatusCard: React.FC<PatientTreatmentStatusCardProps> = ({
  patientId,
  patientName,
  onStatusChange,
}) => {
  const [status, setStatus] = useState<PatientTreatmentStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [showClosureModal, setShowClosureModal] = useState(false);
  const [closureType, setClosureType] = useState<ClosureType>('natural');
  const [closureReason, setClosureReason] = useState('');

  useEffect(() => {
    loadStatus();
  }, [patientId]);

  const loadStatus = async () => {
    try {
      setLoading(true);
      const data = await patientCareApi.fetchPatientTreatmentStatus(patientId);
      setStatus(data);
    } catch (error) {
      console.error('치료 상태 로드 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCloseTreatment = async () => {
    try {
      await patientCareApi.closeTreatment(patientId, closureType, closureReason);
      await loadStatus();
      setShowClosureModal(false);
      setClosureReason('');
      onStatusChange?.();
    } catch (error) {
      console.error('치료 종결 오류:', error);
    }
  };

  const handleResumeTreatment = async () => {
    try {
      await patientCareApi.resumeTreatment(patientId);
      await loadStatus();
      onStatusChange?.();
    } catch (error) {
      console.error('치료 재개 오류:', error);
    }
  };

  const getStatusColor = (statusType: string) => {
    switch (statusType) {
      case 'active':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'paused':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'completed':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'lost':
        return 'bg-red-100 text-red-700 border-red-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-3"></div>
          <div className="h-8 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  // 치료 상태가 없으면 신규 환자
  if (!status) {
    return (
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-medium text-gray-900">치료 상태</h4>
          <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded border border-gray-200">
            신규 환자
          </span>
        </div>
        <p className="text-sm text-gray-500">
          아직 내원 기록이 없습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      {/* 헤더 */}
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <h4 className="font-medium text-gray-900">치료 상태</h4>
        <span className={`px-2 py-1 text-xs font-medium rounded border ${getStatusColor(status.status)}`}>
          {TREATMENT_STATUS_LABELS[status.status]}
        </span>
      </div>

      {/* 통계 */}
      <div className="p-4 grid grid-cols-3 gap-4 text-center border-b">
        <div>
          <div className="text-lg font-bold text-gray-900">{status.total_visits}</div>
          <div className="text-xs text-gray-500">총 내원</div>
        </div>
        <div>
          <div className="text-sm font-medium text-gray-900">
            {status.start_date || '-'}
          </div>
          <div className="text-xs text-gray-500">치료 시작</div>
        </div>
        <div>
          <div className="text-sm font-medium text-gray-900">
            {status.last_visit_date || '-'}
          </div>
          <div className="text-xs text-gray-500">마지막 내원</div>
        </div>
      </div>

      {/* 종결 정보 (종결된 경우) */}
      {status.status === 'completed' && (
        <div className="p-4 bg-blue-50 border-b">
          <div className="text-sm">
            <span className="text-gray-600">종결 유형:</span>{' '}
            <span className="font-medium">
              {status.closure_type ? CLOSURE_TYPE_LABELS[status.closure_type] : '-'}
            </span>
          </div>
          {status.closure_reason && (
            <div className="text-sm mt-1">
              <span className="text-gray-600">종결 사유:</span>{' '}
              <span className="font-medium">{status.closure_reason}</span>
            </div>
          )}
          {status.end_date && (
            <div className="text-sm mt-1">
              <span className="text-gray-600">종결일:</span>{' '}
              <span className="font-medium">{status.end_date}</span>
            </div>
          )}
        </div>
      )}

      {/* 메모 */}
      {status.notes && (
        <div className="p-4 border-b">
          <div className="text-xs text-gray-500 mb-1">메모</div>
          <div className="text-sm text-gray-700">{status.notes}</div>
        </div>
      )}

      {/* 액션 버튼 */}
      <div className="p-4">
        {status.status === 'active' || status.status === 'paused' ? (
          <button
            onClick={() => setShowClosureModal(true)}
            className="w-full py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 font-medium text-sm"
          >
            치료 종결 처리
          </button>
        ) : status.status === 'completed' ? (
          <button
            onClick={handleResumeTreatment}
            className="w-full py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium text-sm"
          >
            치료 재개
          </button>
        ) : null}
      </div>

      {/* 종결 모달 */}
      {showClosureModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="px-4 py-3 border-b">
              <h3 className="font-medium text-gray-900">치료 종결 처리</h3>
            </div>
            <div className="p-4 space-y-4">
              {patientName && (
                <div className="text-sm text-gray-600">
                  <span className="font-medium">{patientName}</span> 환자의 치료를 종결합니다.
                </div>
              )}

              {/* 종결 유형 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  종결 유형
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.entries(CLOSURE_TYPE_LABELS) as [ClosureType, string][]).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setClosureType(key)}
                      className={`py-2 px-3 rounded border text-sm font-medium transition-colors ${
                        closureType === key
                          ? 'bg-blue-500 text-white border-blue-500'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 종결 사유 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  종결 사유 (선택)
                </label>
                <textarea
                  value={closureReason}
                  onChange={(e) => setClosureReason(e.target.value)}
                  placeholder="종결 사유를 입력하세요..."
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  rows={3}
                />
              </div>
            </div>
            <div className="px-4 py-3 border-t bg-gray-50 flex gap-2">
              <button
                onClick={() => {
                  setShowClosureModal(false);
                  setClosureReason('');
                }}
                className="flex-1 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
              >
                취소
              </button>
              <button
                onClick={handleCloseTreatment}
                className="flex-1 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 font-medium"
              >
                종결 확정
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientTreatmentStatusCard;
