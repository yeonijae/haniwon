/**
 * 초진 메시지 발송 모달
 */

import React, { useState } from 'react';
import type { HerbalTask, FirstVisitTemplateType } from '../types';
import { FIRST_VISIT_TEMPLATES } from '../types';

interface FirstVisitModalProps {
  task: HerbalTask | null;
  onClose: () => void;
  onSend: (task: HerbalTask, templateType: FirstVisitTemplateType, notes?: string) => void;
}

const FirstVisitModal: React.FC<FirstVisitModalProps> = ({ task, onClose, onSend }) => {
  const [selectedTemplate, setSelectedTemplate] = useState<FirstVisitTemplateType>('general');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  if (!task) return null;

  const template = FIRST_VISIT_TEMPLATES[selectedTemplate];
  const messageContent = template.content.replace('{patient_name}', task.patient.name);

  async function handleSend() {
    setLoading(true);
    try {
      await onSend(task, selectedTemplate, notes);
    } finally {
      setLoading(false);
    }
  }

  function handleCopyMessage() {
    navigator.clipboard.writeText(messageContent);
    alert('메시지가 클립보드에 복사되었습니다.');
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden">
        {/* 헤더 */}
        <div className="bg-gradient-to-r from-pink-500 to-pink-600 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">초진 감사 메시지</h2>
              <p className="text-pink-100 text-sm">
                [{task.patient.chart_number}] {task.patient.name}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-pink-200 transition-colors"
            >
              <i className="fas fa-times text-xl"></i>
            </button>
          </div>
        </div>

        {/* 환자 정보 */}
        <div className="bg-gray-50 px-6 py-3 border-b">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">
              진료일: {task.data.treatment_date}
            </span>
            {task.data.doctor_name && (
              <span className="text-gray-500">
                담당: {task.data.doctor_name}
              </span>
            )}
          </div>
          {task.patient.phone && (
            <div className="flex items-center gap-2 mt-2">
              <a
                href={`tel:${task.patient.phone}`}
                className="inline-flex items-center px-3 py-1 bg-pink-100 text-pink-700 rounded-full text-sm hover:bg-pink-200 transition-colors"
              >
                <i className="fas fa-phone mr-2"></i>
                {task.patient.phone}
              </a>
            </div>
          )}
        </div>

        {/* 템플릿 선택 */}
        <div className="px-6 py-4 border-b">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            메시지 템플릿
          </label>
          <div className="grid grid-cols-4 gap-2">
            {(Object.entries(FIRST_VISIT_TEMPLATES) as [FirstVisitTemplateType, typeof template][]).map(([key, tmpl]) => (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedTemplate(key)}
                className={`flex flex-col items-center p-3 rounded-lg border-2 transition-colors ${
                  selectedTemplate === key
                    ? 'border-pink-500 bg-pink-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className={`w-8 h-8 rounded-full ${tmpl.color} flex items-center justify-center mb-1`}>
                  <i className={`fas ${tmpl.icon} text-white text-sm`}></i>
                </div>
                <span className="text-xs text-gray-700">{tmpl.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 메시지 미리보기 */}
        <div className="px-6 py-4 border-b">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700">
              메시지 미리보기
            </label>
            <button
              onClick={handleCopyMessage}
              className="text-xs text-pink-600 hover:text-pink-700"
            >
              <i className="fas fa-copy mr-1"></i>
              복사
            </button>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-line max-h-40 overflow-y-auto">
            {messageContent}
          </div>
        </div>

        {/* 메모 */}
        <div className="px-6 py-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            메모 (선택)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="발송 관련 메모를 입력해주세요"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500 resize-none"
          />
        </div>

        {/* 푸터 */}
        <div className="px-6 py-4 bg-gray-50 border-t flex justify-between">
          <div className="text-xs text-gray-500">
            <i className="fas fa-info-circle mr-1"></i>
            카카오톡으로 메시지를 발송해주세요
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 text-gray-600 font-medium rounded-lg hover:bg-gray-100 transition-colors"
              disabled={loading}
            >
              취소
            </button>
            <button
              onClick={handleSend}
              disabled={loading}
              className="px-6 py-2 bg-pink-500 text-white font-medium rounded-lg hover:bg-pink-600 transition-colors disabled:opacity-50"
            >
              {loading ? (
                <>
                  <i className="fas fa-spinner fa-spin mr-2"></i>
                  처리 중...
                </>
              ) : (
                <>
                  <i className="fas fa-check mr-2"></i>
                  발송 완료
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FirstVisitModal;
