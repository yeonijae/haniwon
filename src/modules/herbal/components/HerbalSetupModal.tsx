/**
 * 복약관리 설정 모달
 */

import React, { useState, useEffect } from 'react';
import type { HerbalTask, HerbalSetupFormData, HerbalType, DeliveryMethod, HerbalEvent } from '../types';
import { HERBAL_TYPE_LABELS, DELIVERY_METHOD_LABELS } from '../types';
import { createHerbalPurchase, fetchEvents } from '../api/herbalApi';

interface HerbalSetupModalProps {
  task: HerbalTask | null;
  onClose: () => void;
  onSuccess: () => void;
}

const HerbalSetupModal: React.FC<HerbalSetupModalProps> = ({ task, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<HerbalEvent[]>([]);

  // 폼 상태
  const [herbalType, setHerbalType] = useState<HerbalType>('tang');
  const [herbalName, setHerbalName] = useState('');
  const [sequenceCode, setSequenceCode] = useState('');
  const [totalCount, setTotalCount] = useState(30);
  const [dosePerDay, setDosePerDay] = useState(3);
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>('pickup');
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().split('T')[0]);
  const [eventId, setEventId] = useState<number | undefined>();
  const [memo, setMemo] = useState('');

  useEffect(() => {
    loadEvents();
  }, []);

  useEffect(() => {
    // 한약 종류에 따른 기본값 설정
    if (herbalType === 'tang') {
      setTotalCount(30);
      setDosePerDay(3);
    } else if (herbalType === 'hwan') {
      setTotalCount(10);
      setDosePerDay(1);
    } else if (herbalType === 'go') {
      setTotalCount(2);
      setDosePerDay(1);
    }
  }, [herbalType]);

  async function loadEvents() {
    try {
      const data = await fetchEvents();
      setEvents(data);
    } catch (error) {
      console.error('이벤트 조회 실패:', error);
    }
  }

  if (!task) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!herbalName.trim()) {
      alert('한약명을 입력해주세요.');
      return;
    }

    setLoading(true);
    try {
      const formData: HerbalSetupFormData = {
        receipt_pk: task.data.receipt_pk,
        customer_pk: task.data.customer_pk,
        patient_chart_number: task.patient.chart_number,
        patient_name: task.patient.name,
        patient_phone: task.patient.phone,
        okc_tx_date: task.data.tx_date,
        okc_tx_money: task.data.total_amount,
        herbal_type: herbalType,
        herbal_name: herbalName,
        sequence_code: sequenceCode || undefined,
        total_count: totalCount,
        dose_per_day: dosePerDay,
        delivery_method: deliveryMethod,
        delivery_date: deliveryDate,
        event_id: eventId,
        memo: memo || undefined
      };

      await createHerbalPurchase(formData);
      onSuccess();
    } catch (error) {
      console.error('복약관리 등록 실패:', error);
      alert('등록에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden">
        {/* 헤더 */}
        <div className="bg-gradient-to-r from-green-500 to-green-600 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">복약관리 설정</h2>
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

        {/* 결제 정보 */}
        <div className="bg-gray-50 px-6 py-3 border-b">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">결제일: {task.data.tx_date}</span>
            <span className="font-semibold text-gray-800">
              {task.data.total_amount?.toLocaleString()}원
            </span>
          </div>
          {task.data.tx_doctor && (
            <div className="text-xs text-gray-400 mt-1">
              담당: {task.data.tx_doctor}
            </div>
          )}
        </div>

        {/* 폼 */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto max-h-[60vh]">
          {/* 한약 종류 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              한약 종류
            </label>
            <div className="flex gap-2">
              {(Object.entries(HERBAL_TYPE_LABELS) as [HerbalType, string][]).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setHerbalType(key)}
                  className={`flex-1 py-2 px-3 rounded-lg border-2 font-medium transition-colors ${
                    herbalType === key
                      ? 'border-green-500 bg-green-50 text-green-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* 한약명 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              한약명 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={herbalName}
              onChange={(e) => setHerbalName(e.target.value)}
              placeholder={herbalType === 'tang' ? '예: 보약, 다이어트한약' : herbalType === 'hwan' ? '공진단' : '경옥고'}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              required
            />
          </div>

          {/* 차수 (탕약만) */}
          {herbalType === 'tang' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                차수
              </label>
              <input
                type="text"
                value={sequenceCode}
                onChange={(e) => setSequenceCode(e.target.value)}
                placeholder="예: 6차, 7차"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>
          )}

          {/* 수량 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {herbalType === 'tang' ? '총 복용 횟수' : '총 개수'}
              </label>
              <input
                type="number"
                value={totalCount}
                onChange={(e) => setTotalCount(parseInt(e.target.value) || 0)}
                min={1}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>
            {herbalType === 'tang' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  하루 복용 횟수
                </label>
                <select
                  value={dosePerDay}
                  onChange={(e) => setDosePerDay(parseInt(e.target.value))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                >
                  <option value={2}>2회 (2첩2포)</option>
                  <option value={3}>3회 (2첩3포)</option>
                </select>
              </div>
            )}
          </div>

          {/* 수령 방법 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              수령 방법
            </label>
            <div className="flex gap-2">
              {(Object.entries(DELIVERY_METHOD_LABELS) as [DeliveryMethod, string][]).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setDeliveryMethod(key)}
                  className={`flex-1 py-2 px-3 rounded-lg border-2 font-medium transition-colors ${
                    deliveryMethod === key
                      ? 'border-green-500 bg-green-50 text-green-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <i className={`fas ${key === 'pickup' ? 'fa-hospital' : 'fa-truck'} mr-2`}></i>
                  {label}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {deliveryMethod === 'pickup'
                ? '복용 시작: 수령 당일부터'
                : '복용 시작: 발송일 다음날부터'}
            </p>
          </div>

          {/* 수령/발송일 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {deliveryMethod === 'pickup' ? '수령일' : '발송일'}
            </label>
            <input
              type="date"
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
            />
          </div>

          {/* 이벤트 연결 (공진단/경옥고) */}
          {(herbalType === 'hwan' || herbalType === 'go') && events.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                이벤트 연결 (선택)
              </label>
              <select
                value={eventId || ''}
                onChange={(e) => setEventId(e.target.value ? parseInt(e.target.value) : undefined)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              >
                <option value="">선택 안 함</option>
                {events.map(event => (
                  <option key={event.id} value={event.id}>
                    {event.name} (~{event.end_date})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 메모 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              메모
            </label>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              rows={2}
              placeholder="특이사항이 있으면 입력해주세요"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 resize-none"
            />
          </div>
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
            disabled={loading}
            className="px-6 py-2 bg-green-500 text-white font-medium rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50"
          >
            {loading ? (
              <>
                <i className="fas fa-spinner fa-spin mr-2"></i>
                저장 중...
              </>
            ) : (
              <>
                <i className="fas fa-check mr-2"></i>
                저장
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default HerbalSetupModal;
