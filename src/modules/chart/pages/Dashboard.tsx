import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [todayActions, setTodayActions] = useState<any[]>([]);
  const [prescriptions, setPrescriptions] = useState<any>({
    submitted: [],
    pending: []
  });
  const [happyCallStats, setHappyCallStats] = useState<any>({
    total: 0,
    completed: 0,
    pending: 0
  });
  const [afterCallStats, setAfterCallStats] = useState<any>({
    total: 0,
    completed: 0,
    pending: 0
  });

  // 진료 요약 데이터
  const [clinicSummary, setClinicSummary] = useState<any>({
    pendingPrescriptions: [],
    consultations: {
      initial: 0,
      followUp: 0
    },
    monthlyAcupunctureAvg: 0,
    monthlyInitialAcupuncture: {
      newPatient: 0,
      reInitial: 0,
      insurance: 0
    }
  });

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      // TODO: 실제 데이터 로드 구현
      // 현재는 더미 데이터로 표시

      // 오늘 날짜
      const today = new Date().toISOString().split('T')[0];

      // 여기에 실제 데이터 로드 로직을 추가할 예정

      setLoading(false);
    } catch (error) {
      console.error('대시보드 데이터 로드 실패:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex flex-col items-center justify-center p-8 text-clinic-text-secondary">
          <div className="border-4 border-clinic-background border-t-clinic-primary rounded-full w-12 h-12 animate-spin mb-4"></div>
          <p>대시보드를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex gap-3 p-4 overflow-hidden">
      {/* 진료 요약 섹션 */}
      <div className="w-80 bg-white rounded-lg shadow-sm flex flex-col overflow-hidden flex-shrink-0">
        {/* 제목 */}
        <div className="flex items-center justify-between p-4 border-b bg-gray-50">
          <h3 className="text-lg font-semibold text-clinic-text-primary flex items-center gap-3">
            <i className="fas fa-clipboard-check text-clinic-primary text-xl"></i>
            진료 요약
          </h3>
        </div>

        {/* 내용 */}
        <div className="flex-1 overflow-y-auto p-2">
          <div className="space-y-3">
            {/* 1. 처방 제출할 환자목록 */}
            <div className="border rounded-lg p-3">
              <h4 className="text-sm font-semibold text-clinic-text-primary mb-2 flex items-center">
                <i className="fas fa-prescription-bottle text-purple-600 mr-2 text-sm"></i>
                처방 제출 대기
              </h4>
              {clinicSummary.pendingPrescriptions.length === 0 ? (
                <p className="text-xs text-clinic-text-secondary">대기 중인 처방이 없습니다</p>
              ) : (
                <div className="space-y-1">
                  {clinicSummary.pendingPrescriptions.slice(0, 5).map((item: any, idx: number) => (
                    <div key={idx} className="text-xs p-2 bg-gray-50 rounded flex items-center justify-between">
                      <span className="font-medium">{item.patientName}</span>
                      <span className="text-clinic-text-secondary">{item.date}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 2. 약상담 분류 */}
            <div className="border rounded-lg p-3">
              <h4 className="text-sm font-semibold text-clinic-text-primary mb-2 flex items-center">
                <i className="fas fa-pills text-green-600 mr-2 text-sm"></i>
                약상담 현황
              </h4>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-blue-50 rounded p-2 text-center border border-blue-200">
                  <p className="text-xs text-clinic-text-secondary mb-1">초진</p>
                  <p className="text-lg font-bold text-blue-600">{clinicSummary.consultations.initial}</p>
                </div>
                <div className="bg-purple-50 rounded p-2 text-center border border-purple-200">
                  <p className="text-xs text-clinic-text-secondary mb-1">재진</p>
                  <p className="text-lg font-bold text-purple-600">{clinicSummary.consultations.followUp}</p>
                </div>
              </div>
            </div>

            {/* 3. 이번달 평균 침환자수 */}
            <div className="border rounded-lg p-3">
              <h4 className="text-sm font-semibold text-clinic-text-primary mb-2 flex items-center">
                <i className="fas fa-chart-line text-orange-600 mr-2 text-sm"></i>
                이번달 평균 침환자
              </h4>
              <div className="bg-orange-50 rounded p-3 text-center border border-orange-200">
                <p className="text-3xl font-bold text-orange-600">{clinicSummary.monthlyAcupunctureAvg}</p>
                <p className="text-xs text-clinic-text-secondary mt-1">명/일</p>
              </div>
            </div>

            {/* 4. 이번달 침초진수 */}
            <div className="border rounded-lg p-3">
              <h4 className="text-sm font-semibold text-clinic-text-primary mb-2 flex items-center">
                <i className="fas fa-user-plus text-teal-600 mr-2 text-sm"></i>
                이번달 침초진
              </h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <span className="text-xs text-clinic-text-secondary">신규환자</span>
                  <span className="text-sm font-bold text-clinic-text-primary">{clinicSummary.monthlyInitialAcupuncture.newPatient}명</span>
                </div>
                <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <span className="text-xs text-clinic-text-secondary">재초진</span>
                  <span className="text-sm font-bold text-clinic-text-primary">{clinicSummary.monthlyInitialAcupuncture.reInitial}명</span>
                </div>
                <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <span className="text-xs text-clinic-text-secondary">자보초진</span>
                  <span className="text-sm font-bold text-clinic-text-primary">{clinicSummary.monthlyInitialAcupuncture.insurance}명</span>
                </div>
                <div className="flex items-center justify-between p-2 bg-teal-50 rounded border border-teal-200 mt-2">
                  <span className="text-xs font-semibold text-teal-700">합계</span>
                  <span className="text-sm font-bold text-teal-700">
                    {clinicSummary.monthlyInitialAcupuncture.newPatient +
                     clinicSummary.monthlyInitialAcupuncture.reInitial +
                     clinicSummary.monthlyInitialAcupuncture.insurance}명
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 오늘 액팅 목록 */}
      <div className="flex-1 bg-white rounded-lg shadow-sm flex flex-col overflow-hidden">
        {/* 제목 */}
        <div className="flex items-center justify-between p-4 border-b bg-gray-50">
          <h3 className="text-lg font-semibold text-clinic-text-primary flex items-center gap-3">
            <i className="fas fa-tasks text-clinic-primary text-xl"></i>
            오늘 액팅 <span className="ml-2 text-clinic-primary font-bold">({todayActions.length})</span>
          </h3>
        </div>

        {/* 목록 */}
        <div className="flex-1 overflow-y-auto p-2">
          <div className="space-y-2">
            {todayActions.length === 0 ? (
              <p className="text-center py-8 text-clinic-text-secondary text-sm">
                오늘 액팅 목록이 없습니다
              </p>
            ) : (
              todayActions.map((action, index) => (
                <div key={index} className="border border-gray-200 rounded p-3 hover:bg-gray-50 cursor-pointer">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm text-clinic-text-primary">{action.title}</span>
                    <span className="text-xs text-clinic-text-secondary">{action.time}</span>
                  </div>
                  <p className="text-xs text-clinic-text-secondary mt-1">{action.description}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 처방 목록 */}
      <div className="flex-1 bg-white rounded-lg shadow-sm flex flex-col overflow-hidden">
        {/* 제목 + 탭 */}
        <div className="border-b bg-gray-50">
          <div className="flex items-center justify-between p-4">
            <h3 className="text-lg font-semibold text-clinic-text-primary flex items-center gap-3">
              <i className="fas fa-prescription text-clinic-primary text-xl"></i>
              처방 현황
            </h3>
          </div>
          <div className="flex space-x-2 px-4 pb-3">
            <button className="px-3 py-1 bg-clinic-primary text-white text-xs rounded flex-1">
              제출 필요 ({prescriptions.pending.length})
            </button>
            <button className="px-3 py-1 bg-gray-200 text-clinic-text-secondary text-xs rounded flex-1">
              제출 완료 ({prescriptions.submitted.length})
            </button>
          </div>
        </div>

        {/* 목록 */}
        <div className="flex-1 overflow-y-auto p-2">
          <div className="space-y-2">
            {prescriptions.pending.length === 0 ? (
              <p className="text-center py-8 text-clinic-text-secondary text-sm">
                제출이 필요한 처방이 없습니다
              </p>
            ) : (
              prescriptions.pending.map((prescription: any, index: number) => (
                <div key={index} className="border border-gray-200 rounded p-3 hover:bg-gray-50 cursor-pointer">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm text-clinic-text-primary">{prescription.patientName}</span>
                    <span className="text-xs px-2 py-1 bg-red-100 text-red-600 rounded">미제출</span>
                  </div>
                  <p className="text-xs text-clinic-text-secondary mt-1">{prescription.content}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 해피콜(복용법) 현황 */}
      <div className="flex-1 bg-white rounded-lg shadow-sm flex flex-col overflow-hidden">
        {/* 제목 */}
        <div className="flex items-center justify-between p-4 border-b bg-gray-50">
          <h3 className="text-lg font-semibold text-clinic-text-primary flex items-center gap-3">
            <i className="fas fa-phone text-clinic-primary text-xl"></i>
            해피콜 현황
          </h3>
          <span className="text-xs text-clinic-text-secondary">복용법</span>
        </div>

        {/* 상세 정보 */}
        <div className="flex-1 overflow-y-auto p-2">
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-2">
              <div className="p-2 bg-gray-50 rounded text-center border">
                <p className="text-xs text-clinic-text-secondary mb-1">전체</p>
                <p className="text-lg font-bold text-clinic-text-primary">{happyCallStats.total}</p>
              </div>
              <div className="p-2 bg-blue-50 rounded text-center border border-blue-200">
                <p className="text-xs text-clinic-text-secondary mb-1">완료</p>
                <p className="text-lg font-bold text-blue-600">{happyCallStats.completed}</p>
              </div>
              <div className="p-2 bg-orange-50 rounded text-center border border-orange-200">
                <p className="text-xs text-clinic-text-secondary mb-1">대기</p>
                <p className="text-lg font-bold text-orange-600">{happyCallStats.pending}</p>
              </div>
            </div>

            {happyCallStats.pending > 0 && (
              <button className="w-full py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors text-xs font-medium">
                해피콜 진행하기
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 에프터콜(사후관리) 현황 */}
      <div className="flex-1 bg-white rounded-lg shadow-sm flex flex-col overflow-hidden">
        {/* 제목 */}
        <div className="flex items-center justify-between p-4 border-b bg-gray-50">
          <h3 className="text-lg font-semibold text-clinic-text-primary flex items-center gap-3">
            <i className="fas fa-user-check text-clinic-primary text-xl"></i>
            에프터콜 현황
          </h3>
          <span className="text-xs text-clinic-text-secondary">사후관리</span>
        </div>

        {/* 상세 정보 */}
        <div className="flex-1 overflow-y-auto p-2">
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-2">
              <div className="p-2 bg-gray-50 rounded text-center border">
                <p className="text-xs text-clinic-text-secondary mb-1">전체</p>
                <p className="text-lg font-bold text-clinic-text-primary">{afterCallStats.total}</p>
              </div>
              <div className="p-2 bg-blue-50 rounded text-center border border-blue-200">
                <p className="text-xs text-clinic-text-secondary mb-1">완료</p>
                <p className="text-lg font-bold text-blue-600">{afterCallStats.completed}</p>
              </div>
              <div className="p-2 bg-orange-50 rounded text-center border border-orange-200">
                <p className="text-xs text-clinic-text-secondary mb-1">대기</p>
                <p className="text-lg font-bold text-orange-600">{afterCallStats.pending}</p>
              </div>
            </div>

            {afterCallStats.pending > 0 && (
              <button className="w-full py-2 bg-purple-500 text-white rounded hover:bg-purple-600 transition-colors text-xs font-medium">
                에프터콜 진행하기
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
