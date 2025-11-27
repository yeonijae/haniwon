/**
 * 환자관리 페이지
 * 해피콜, 치료 종결 관리, 정기 관리 메시지 등
 */

import React, { useState } from 'react';
import PatientCareList from '@shared/components/PatientCareList';
import PatientCareWidget from '@shared/components/PatientCareWidget';
import TreatmentRecordList from '@shared/components/TreatmentRecordList';
import ClinicDashboard from '@shared/components/ClinicDashboard';

type ViewMode = 'dashboard' | 'care' | 'records';

const PatientCareManagement: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard');

  const handleNavigate = (section: 'tasks' | 'care' | 'records') => {
    if (section === 'care') {
      setViewMode('care');
    } else if (section === 'records') {
      setViewMode('records');
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* 탭 네비게이션 */}
      <div className="bg-white border-b px-4 py-2 flex items-center gap-4 flex-shrink-0">
        <button
          onClick={() => setViewMode('dashboard')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            viewMode === 'dashboard'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          <i className="fas fa-chart-line mr-2"></i>
          대시보드
        </button>
        <button
          onClick={() => setViewMode('care')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            viewMode === 'care'
              ? 'bg-orange-500 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          <i className="fas fa-phone mr-2"></i>
          환자관리
        </button>
        <button
          onClick={() => setViewMode('records')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            viewMode === 'records'
              ? 'bg-green-500 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          <i className="fas fa-clipboard-list mr-2"></i>
          진료내역
        </button>
      </div>

      {/* 컨텐츠 영역 */}
      <div className="flex-1 overflow-hidden">
        {viewMode === 'dashboard' && (
          <ClinicDashboard onNavigate={handleNavigate} />
        )}

        {viewMode === 'care' && (
          <div className="h-full flex">
            {/* 메인 목록 */}
            <div className="flex-1 border-r">
              <PatientCareList />
            </div>
            {/* 사이드바 */}
            <div className="w-80 p-4 bg-gray-50 overflow-y-auto">
              <div className="mb-4">
                <h3 className="font-medium text-gray-700 mb-2">빠른 통계</h3>
                <PatientCareWidget maxItems={3} />
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <h4 className="font-medium text-gray-700 mb-2">도움말</h4>
                <ul className="text-sm text-gray-500 space-y-2">
                  <li>• <span className="text-green-600 font-medium">배송 해피콜</span>: 한약 배송 다음날</li>
                  <li>• <span className="text-blue-600 font-medium">복약 해피콜</span>: 복약 7일차</li>
                  <li>• <span className="text-orange-600 font-medium">종결 상담</span>: 10회 치료 후</li>
                  <li>• <span className="text-cyan-600 font-medium">정기 관리</span>: 30일 미방문</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {viewMode === 'records' && (
          <div className="h-full">
            <TreatmentRecordList />
          </div>
        )}
      </div>
    </div>
  );
};

export default PatientCareManagement;
