/**
 * 환자 치료 정보 모달
 * 환자의 기본 치료 정보 및 당일 치료 기록을 조회/편집하는 모달
 */

import React, { useEffect, useState } from 'react';
import TreatmentInfoEditor from './TreatmentInfoEditor';
import { useTreatmentInfo, TREATMENT_CHECKBOX_ITEMS, YAKCHIM_SELECT_ITEMS } from '../hooks/useTreatmentInfo';
import type { Patient, PatientDefaultTreatments } from '../types';

interface PatientTreatmentInfoModalProps {
  /** 환자 정보 */
  patient: Patient;
  /** 모달 닫기 */
  onClose: () => void;
  /** 저장 완료 후 콜백 */
  onSaved?: () => void;
}

const PatientTreatmentInfoModal: React.FC<PatientTreatmentInfoModalProps> = ({
  patient,
  onClose,
  onSaved,
}) => {
  const {
    isLoading,
    error,
    defaultTreatments,
    dailyRecord,
    loadDefaultTreatments,
    saveDefaultTreatments,
    loadDailyRecord,
  } = useTreatmentInfo();

  const [activeTab, setActiveTab] = useState<'default' | 'daily'>('default');

  // 초기 데이터 로드
  useEffect(() => {
    loadDefaultTreatments(patient.id);
    loadDailyRecord(patient.id);
  }, [patient.id, loadDefaultTreatments, loadDailyRecord]);

  // 저장 핸들러
  const handleSave = async (patientId: number, data: Partial<PatientDefaultTreatments>) => {
    await saveDefaultTreatments(patientId, data);
    onSaved?.();
  };

  // 시간 포맷
  const formatTime = (timeStr: string | undefined) => {
    if (!timeStr) return '-';
    const date = new Date(timeStr);
    return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  // 당일 치료 기록 표시
  const renderDailyRecord = () => {
    if (!dailyRecord) {
      return (
        <div className="text-center text-gray-500 py-8">
          <i className="fa-regular fa-calendar-xmark text-4xl mb-3"></i>
          <p>오늘 치료 기록이 없습니다.</p>
        </div>
      );
    }

    // 선택된 치료 항목 목록
    const selectedTreatments = TREATMENT_CHECKBOX_ITEMS
      .filter(item => dailyRecord[item.key])
      .map(item => item.label);

    // 약침 정보
    const yakchimInfo = dailyRecord.yakchim_type
      ? `${YAKCHIM_SELECT_ITEMS.find(y => y.value === dailyRecord.yakchim_type)?.label || dailyRecord.yakchim_type} ${dailyRecord.yakchim_quantity}cc`
      : null;

    return (
      <div className="space-y-4">
        {/* 타임라인 */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-medium text-gray-700 mb-3">진료 타임라인</h4>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">접수</span>
              <span className="font-medium">{formatTime(dailyRecord.reception_time)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">진료대기</span>
              <span className="font-medium">{formatTime(dailyRecord.consultation_wait_start)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">진료시작</span>
              <span className="font-medium">{formatTime(dailyRecord.consultation_start)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">진료종료</span>
              <span className="font-medium">{formatTime(dailyRecord.consultation_end)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">치료대기</span>
              <span className="font-medium">{formatTime(dailyRecord.treatment_wait_start)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">치료시작</span>
              <span className="font-medium">{formatTime(dailyRecord.treatment_start)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">치료종료</span>
              <span className="font-medium">{formatTime(dailyRecord.treatment_end)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">수납</span>
              <span className="font-medium">{formatTime(dailyRecord.payment_time)}</span>
            </div>
          </div>
        </div>

        {/* 치료 항목 */}
        <div className="bg-blue-50 rounded-lg p-4">
          <h4 className="font-medium text-gray-700 mb-3">오늘 치료 항목</h4>
          {selectedTreatments.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {selectedTreatments.map(treatment => (
                <span
                  key={treatment}
                  className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm"
                >
                  {treatment}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">설정된 치료 항목이 없습니다.</p>
          )}
        </div>

        {/* 약침 */}
        {yakchimInfo && (
          <div className="bg-purple-50 rounded-lg p-4">
            <h4 className="font-medium text-gray-700 mb-2">약침</h4>
            <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm">
              {yakchimInfo}
            </span>
          </div>
        )}

        {/* 메모 */}
        {dailyRecord.memo && (
          <div className="bg-yellow-50 rounded-lg p-4">
            <h4 className="font-medium text-gray-700 mb-2">메모</h4>
            <p className="text-gray-600 text-sm whitespace-pre-wrap">{dailyRecord.memo}</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-xl font-bold text-gray-800">
              {patient.name}
              {patient.chartNumber && (
                <span className="text-sm font-normal text-gray-500 ml-2">
                  ({patient.chartNumber})
                </span>
              )}
            </h2>
            <p className="text-sm text-gray-500">치료 정보 관리</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <i className="fa-solid fa-xmark text-gray-500"></i>
          </button>
        </div>

        {/* 탭 */}
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab('default')}
            className={`flex-1 py-3 text-center font-medium transition-colors ${
              activeTab === 'default'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <i className="fa-solid fa-sliders mr-2"></i>
            기본 치료 설정
          </button>
          <button
            onClick={() => setActiveTab('daily')}
            className={`flex-1 py-3 text-center font-medium transition-colors ${
              activeTab === 'daily'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <i className="fa-solid fa-calendar-day mr-2"></i>
            오늘 치료 기록
          </button>
        </div>

        {/* 컨텐츠 */}
        <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 180px)' }}>
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              <i className="fa-solid fa-circle-exclamation mr-2"></i>
              {error}
            </div>
          )}

          {isLoading && !defaultTreatments && !dailyRecord ? (
            <div className="flex items-center justify-center py-12">
              <i className="fa-solid fa-spinner fa-spin text-2xl text-blue-500 mr-3"></i>
              <span className="text-gray-500">로딩 중...</span>
            </div>
          ) : activeTab === 'default' ? (
            <TreatmentInfoEditor
              patientId={patient.id}
              patientName={patient.name}
              initialData={defaultTreatments}
              onSave={handleSave}
              onCancel={onClose}
              isLoading={isLoading}
            />
          ) : (
            renderDailyRecord()
          )}
        </div>
      </div>
    </div>
  );
};

export default PatientTreatmentInfoModal;
