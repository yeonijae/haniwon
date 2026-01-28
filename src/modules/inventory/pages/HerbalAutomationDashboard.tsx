/**
 * 한약 워크플로우 자동화 대시보드
 * 배치 실행, 상태 모니터링, 알림 관리
 */

import { useState, useEffect, useCallback } from 'react';
import {
  getD2PrescriptionReminders,
  getD1PrescriptionReminders,
  getDDayPrescriptionReminders,
  getOverduePackages,
  runPrescriptionReminderBatch,
  runStatusTransitionBatch,
  runAllBatches,
  type BatchResult,
} from '@modules/cs/lib/automationApi';
import type { HerbalPackage } from '@modules/cs/types';

function HerbalAutomationDashboard() {
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [lastBatchResult, setLastBatchResult] = useState<BatchResult | null>(null);

  // 현재 상태
  const [d2Packages, setD2Packages] = useState<HerbalPackage[]>([]);
  const [d1Packages, setD1Packages] = useState<HerbalPackage[]>([]);
  const [dDayPackages, setDDayPackages] = useState<HerbalPackage[]>([]);
  const [overduePackages, setOverduePackages] = useState<HerbalPackage[]>([]);

  // 데이터 로드
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [d2, d1, dDay, overdue] = await Promise.all([
        getD2PrescriptionReminders(),
        getD1PrescriptionReminders(),
        getDDayPrescriptionReminders(),
        getOverduePackages(),
      ]);
      setD2Packages(d2);
      setD1Packages(d1);
      setDDayPackages(dDay);
      setOverduePackages(overdue);
    } catch (error) {
      console.error('데이터 로드 오류:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 전체 배치 실행
  const handleRunAllBatches = async () => {
    if (!confirm('모든 자동화 배치를 실행하시겠습니까?\n(D-2, D-1, D-Day 리마인더 + 상태 전이)')) return;

    try {
      setRunning(true);
      const result = await runAllBatches();
      setLastBatchResult(result);
      alert('배치 실행이 완료되었습니다.');
      loadData();
    } catch (error) {
      console.error('배치 실행 오류:', error);
      alert('배치 실행에 실패했습니다.');
    } finally {
      setRunning(false);
    }
  };

  // 리마인더만 실행
  const handleRunReminders = async () => {
    if (!confirm('처방 리마인더 알림을 발송하시겠습니까?')) return;

    try {
      setRunning(true);
      const result = await runPrescriptionReminderBatch();
      alert(
        `리마인더 발송 완료:\n` +
        `- D-2: ${result.d2.count}건 (${result.d2.sent}명 원장에게 발송)\n` +
        `- D-1: ${result.d1.count}건 (${result.d1.sent}명 원장에게 발송)\n` +
        `- D-Day: ${result.dDay.count}건 (${result.dDay.sent}명 원장에게 발송)`
      );
      loadData();
    } catch (error) {
      console.error('리마인더 실행 오류:', error);
      alert('리마인더 발송에 실패했습니다.');
    } finally {
      setRunning(false);
    }
  };

  // 상태 전이만 실행
  const handleRunStatusTransition = async () => {
    if (!confirm('상태 자동 전이를 실행하시겠습니까?\n(탕전일 도래 패키지를 "준비완료" 상태로 변경)')) return;

    try {
      setRunning(true);
      const result = await runStatusTransitionBatch();
      alert(
        `상태 전이 완료:\n` +
        `- 준비완료로 전환: ${result.readyTransition}건\n` +
        `- 지연 패키지: ${result.overdueCount}건`
      );
      loadData();
    } catch (error) {
      console.error('상태 전이 오류:', error);
      alert('상태 전이에 실패했습니다.');
    } finally {
      setRunning(false);
    }
  };

  // 패키지 카드 렌더링
  const renderPackageCard = (pkg: HerbalPackage, urgency: 'normal' | 'warning' | 'danger') => {
    const bgColor = {
      normal: 'bg-green-50 border-green-200',
      warning: 'bg-yellow-50 border-yellow-200',
      danger: 'bg-red-50 border-red-200',
    }[urgency];

    return (
      <div key={pkg.id} className={`p-3 rounded-lg border ${bgColor}`}>
        <div className="flex items-center justify-between">
          <div>
            <span className="font-medium">{pkg.patient_name}</span>
            <span className="text-sm text-gray-500 ml-2">({pkg.chart_number})</span>
          </div>
          <span className="text-sm text-gray-600">{pkg.doctor_name || '미지정'}</span>
        </div>
        <div className="mt-1 text-sm text-gray-600">
          {pkg.herbal_name} - 탕전일: {pkg.decoction_date}
        </div>
      </div>
    );
  };

  return (
    <div className="h-full overflow-auto bg-gray-50">
      {/* 헤더 */}
      <div className="page-header bg-white border-b sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-gray-800">자동화 대시보드</h1>
            {running && (
              <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                <i className="fa-solid fa-spinner fa-spin mr-2"></i>
                실행 중...
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              className="btn btn-outline"
              disabled={loading || running}
            >
              <i className="fa-solid fa-refresh mr-2"></i>
              새로고침
            </button>
            <button
              onClick={handleRunAllBatches}
              className="btn btn-primary"
              disabled={loading || running}
            >
              <i className="fa-solid fa-play mr-2"></i>
              전체 배치 실행
            </button>
          </div>
        </div>

        {/* 요약 통계 */}
        <div className="flex gap-4 mt-4">
          <div className="flex items-center gap-2 px-3 py-2 bg-green-50 rounded-lg">
            <span className="w-3 h-3 bg-green-400 rounded-full"></span>
            <span className="text-sm text-gray-600">D-2:</span>
            <span className="font-bold text-green-700">{d2Packages.length}건</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 bg-yellow-50 rounded-lg">
            <span className="w-3 h-3 bg-yellow-400 rounded-full"></span>
            <span className="text-sm text-gray-600">D-1:</span>
            <span className="font-bold text-yellow-700">{d1Packages.length}건</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 bg-red-50 rounded-lg">
            <span className="w-3 h-3 bg-red-400 rounded-full"></span>
            <span className="text-sm text-gray-600">D-Day:</span>
            <span className="font-bold text-red-700">{dDayPackages.length}건</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 bg-purple-50 rounded-lg">
            <span className="w-3 h-3 bg-purple-400 rounded-full"></span>
            <span className="text-sm text-gray-600">지연:</span>
            <span className="font-bold text-purple-700">{overduePackages.length}건</span>
          </div>
        </div>
      </div>

      {/* 본문 */}
      <div className="p-4">
        {loading ? (
          <div className="text-center py-12">
            <i className="fa-solid fa-spinner fa-spin text-2xl text-gray-400"></i>
            <p className="mt-2 text-gray-500">로딩 중...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 배치 실행 패널 */}
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">
                <i className="fa-solid fa-robot text-blue-500 mr-2"></i>
                배치 작업
              </h2>

              <div className="space-y-3">
                <button
                  onClick={handleRunReminders}
                  disabled={running}
                  className="w-full flex items-center justify-between p-3 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50"
                >
                  <div className="flex items-center gap-3">
                    <i className="fa-solid fa-bell text-blue-500"></i>
                    <div className="text-left">
                      <div className="font-medium text-gray-800">처방 리마인더 발송</div>
                      <div className="text-sm text-gray-500">D-2, D-1, D-Day 원장에게 잔디 알림</div>
                    </div>
                  </div>
                  <i className="fa-solid fa-chevron-right text-gray-400"></i>
                </button>

                <button
                  onClick={handleRunStatusTransition}
                  disabled={running}
                  className="w-full flex items-center justify-between p-3 bg-green-50 rounded-lg hover:bg-green-100 transition-colors disabled:opacity-50"
                >
                  <div className="flex items-center gap-3">
                    <i className="fa-solid fa-arrows-rotate text-green-500"></i>
                    <div className="text-left">
                      <div className="font-medium text-gray-800">상태 자동 전이</div>
                      <div className="text-sm text-gray-500">탕전일 도래 패키지 → 준비완료</div>
                    </div>
                  </div>
                  <i className="fa-solid fa-chevron-right text-gray-400"></i>
                </button>
              </div>

              {/* 마지막 실행 결과 */}
              {lastBatchResult && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <div className="text-sm font-medium text-gray-600 mb-2">
                    마지막 실행: {new Date(lastBatchResult.timestamp).toLocaleString('ko-KR')}
                  </div>
                  <div className="text-sm text-gray-500">
                    리마인더: D-2 {lastBatchResult.prescriptionReminder.d2.count}건,
                    D-1 {lastBatchResult.prescriptionReminder.d1.count}건,
                    D-Day {lastBatchResult.prescriptionReminder.dDay.count}건
                  </div>
                  <div className="text-sm text-gray-500">
                    상태전이: {lastBatchResult.statusTransition.readyTransition}건 전환,
                    {lastBatchResult.statusTransition.overdueCount}건 지연
                  </div>
                </div>
              )}

              {/* 자동 실행 안내 */}
              <div className="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
                <div className="flex items-start gap-2">
                  <i className="fa-solid fa-lightbulb text-amber-500 mt-0.5"></i>
                  <div className="text-sm text-amber-800">
                    <strong>자동 실행 권장 시간</strong>
                    <p className="mt-1">매일 오전 8시, 오후 2시에 배치를 실행하면 적시에 리마인더가 발송됩니다.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* 처방 미입력 현황 */}
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">
                <i className="fa-solid fa-clipboard-list text-orange-500 mr-2"></i>
                처방 미입력 현황
              </h2>

              {d2Packages.length === 0 && d1Packages.length === 0 && dDayPackages.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <i className="fa-solid fa-check-circle text-3xl text-green-400 mb-2"></i>
                  <p>처방 미입력 패키지가 없습니다.</p>
                </div>
              ) : (
                <div className="space-y-4 max-h-[400px] overflow-y-auto">
                  {/* D-Day */}
                  {dDayPackages.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded">D-Day</span>
                        <span className="text-sm text-gray-600">{dDayPackages.length}건</span>
                      </div>
                      <div className="space-y-2">
                        {dDayPackages.map(pkg => renderPackageCard(pkg, 'danger'))}
                      </div>
                    </div>
                  )}

                  {/* D-1 */}
                  {d1Packages.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-0.5 bg-yellow-500 text-white text-xs font-bold rounded">D-1</span>
                        <span className="text-sm text-gray-600">{d1Packages.length}건</span>
                      </div>
                      <div className="space-y-2">
                        {d1Packages.map(pkg => renderPackageCard(pkg, 'warning'))}
                      </div>
                    </div>
                  )}

                  {/* D-2 */}
                  {d2Packages.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-0.5 bg-green-500 text-white text-xs font-bold rounded">D-2</span>
                        <span className="text-sm text-gray-600">{d2Packages.length}건</span>
                      </div>
                      <div className="space-y-2">
                        {d2Packages.map(pkg => renderPackageCard(pkg, 'normal'))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 지연 패키지 */}
            {overduePackages.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm border p-4 lg:col-span-2">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">
                  <i className="fa-solid fa-exclamation-triangle text-red-500 mr-2"></i>
                  지연 패키지 ({overduePackages.length}건)
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {overduePackages.map(pkg => (
                    <div key={pkg.id} className="p-3 bg-red-50 border border-red-200 rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-red-800">{pkg.patient_name}</span>
                        <span className="text-xs px-2 py-0.5 bg-red-200 text-red-800 rounded">
                          {pkg.decoction_status === 'pending' ? '탕전대기' :
                           pkg.decoction_status === 'ready' ? '준비완료' :
                           pkg.decoction_status === 'in_progress' ? '탕전중' : pkg.decoction_status}
                        </span>
                      </div>
                      <div className="mt-1 text-sm text-red-600">
                        탕전일: {pkg.decoction_date}
                        {pkg.prescription_status === 'pending' && (
                          <span className="ml-2 text-red-700 font-medium">(처방미입력)</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default HerbalAutomationDashboard;
