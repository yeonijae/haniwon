/**
 * 콜 완료 모달
 */

import React, { useState } from 'react';
import type { HerbalTask } from '../types';
import { CALL_TYPE_LABELS } from '../types';
import { completeCall, skipCall } from '../api/herbalApi';

interface CallCompleteModalProps {
  task: HerbalTask | null;
  onClose: () => void;
  onSuccess: () => void;
}

const CallCompleteModal: React.FC<CallCompleteModalProps> = ({ task, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [contactMethod, setContactMethod] = useState<'phone' | 'kakao' | 'sms'>('phone');
  const [result, setResult] = useState('');
  const [mode, setMode] = useState<'complete' | 'skip'>('complete');
  const [skipReason, setSkipReason] = useState('');

  if (!task) return null;

  const callType = task.task_type.replace('call_', '') as keyof typeof CALL_TYPE_LABELS;
  const callLabel = CALL_TYPE_LABELS[callType] || '콜';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === 'complete') {
        await completeCall(task.data.call_id, '관리자', contactMethod, result);
      } else {
        await skipCall(task.data.call_id, skipReason);
      }
      onSuccess();
    } catch (error) {
      console.error('콜 처리 실패:', error);
      alert('처리에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* 헤더 */}
        <div className="bg-gradient-to-r from-green-500 to-green-600 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">{callLabel} 처리</h2>
              <p className="text-green-100 text-sm">
                [{task.patient.chart_number}] {task.patient.name}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-green-200 transition-colors"
            >
              <i className="fas fa-times text-xl"></i>
            </button>
          </div>
        </div>

        {/* 과제 정보 */}
        <div className="bg-gray-50 px-6 py-3 border-b">
          <p className="text-sm text-gray-600">{task.task_description}</p>
          {task.patient.phone && (
            <div className="flex items-center gap-2 mt-2">
              <a
                href={`tel:${task.patient.phone}`}
                className="inline-flex items-center px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm hover:bg-green-200 transition-colors"
              >
                <i className="fas fa-phone mr-2"></i>
                {task.patient.phone}
              </a>
            </div>
          )}
        </div>

        {/* 모드 선택 탭 */}
        <div className="flex border-b">
          <button
            type="button"
            onClick={() => setMode('complete')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              mode === 'complete'
                ? 'text-green-600 border-b-2 border-green-500'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <i className="fas fa-check mr-2"></i>
            완료 처리
          </button>
          <button
            type="button"
            onClick={() => setMode('skip')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              mode === 'skip'
                ? 'text-orange-600 border-b-2 border-orange-500'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <i className="fas fa-forward mr-2"></i>
            건너뛰기
          </button>
        </div>

        {/* 폼 */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {mode === 'complete' ? (
            <>
              {/* 연락 방법 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  연락 방법
                </label>
                <div className="flex gap-2">
                  {[
                    { key: 'phone', label: '전화', icon: 'fa-phone' },
                    { key: 'kakao', label: '카카오톡', icon: 'fa-comment' },
                    { key: 'sms', label: '문자', icon: 'fa-sms' }
                  ].map(item => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setContactMethod(item.key as any)}
                      className={`flex-1 py-2 px-3 rounded-lg border-2 font-medium transition-colors ${
                        contactMethod === item.key
                          ? 'border-green-500 bg-green-50 text-green-700'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      <i className={`fas ${item.icon} mr-1`}></i>
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 결과 메모 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  통화/연락 내용
                </label>
                <textarea
                  value={result}
                  onChange={(e) => setResult(e.target.value)}
                  rows={3}
                  placeholder="통화 내용이나 특이사항을 입력해주세요"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 resize-none"
                />
              </div>
            </>
          ) : (
            <>
              {/* 건너뛰기 사유 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  건너뛰기 사유
                </label>
                <select
                  value={skipReason}
                  onChange={(e) => setSkipReason(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                >
                  <option value="">선택해주세요</option>
                  <option value="부재중">부재중 (연락 안 됨)</option>
                  <option value="휴약중">휴약 중</option>
                  <option value="본인요청">본인 요청 (연락 불필요)</option>
                  <option value="기타">기타</option>
                </select>
              </div>

              <div className="p-3 bg-orange-50 rounded-lg">
                <p className="text-sm text-orange-700">
                  <i className="fas fa-info-circle mr-2"></i>
                  건너뛰기 시 해당 콜은 취소되며, 필요시 수동으로 다시 생성해야 합니다.
                </p>
              </div>
            </>
          )}
        </form>

        {/* 푸터 */}
        <div className="px-6 py-4 bg-gray-50 border-t flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 text-gray-600 font-medium rounded-lg hover:bg-gray-100 transition-colors"
            disabled={loading}
          >
            취소
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={loading || (mode === 'skip' && !skipReason)}
            className={`px-6 py-2 text-white font-medium rounded-lg transition-colors disabled:opacity-50 ${
              mode === 'complete'
                ? 'bg-green-500 hover:bg-green-600'
                : 'bg-orange-500 hover:bg-orange-600'
            }`}
          >
            {loading ? (
              <>
                <i className="fas fa-spinner fa-spin mr-2"></i>
                처리 중...
              </>
            ) : mode === 'complete' ? (
              <>
                <i className="fas fa-check mr-2"></i>
                완료
              </>
            ) : (
              <>
                <i className="fas fa-forward mr-2"></i>
                건너뛰기
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CallCompleteModal;
