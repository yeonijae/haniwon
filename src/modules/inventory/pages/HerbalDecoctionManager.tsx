/**
 * 한약 탕전 관리 화면
 * 오늘 탕전 예정 패키지 목록 및 상태 관리
 */

import { useState, useEffect, useCallback } from 'react';
import {
  getTodayDecoctionPackages,
  getPendingPrescriptionPackages,
  requestPrescription,
} from '@modules/cs/lib/decoctionApi';
import { sendJandiWebhook } from '@modules/acting/api';
import { query, execute, getCurrentTimestamp, escapeString } from '@shared/lib/postgres';
import type { HerbalPackage, DecoctionStatus } from '@modules/cs/types';
import { DECOCTION_STATUS_LABELS, DELIVERY_METHOD_LABELS } from '@modules/cs/types';

type DecoctionPackage = HerbalPackage & {
  patient_name_full?: string;
};

// 탕전 상태 색상
const STATUS_COLORS: Record<DecoctionStatus, { bg: string; text: string }> = {
  pending: { bg: 'bg-gray-100', text: 'text-gray-700' },
  ready: { bg: 'bg-blue-100', text: 'text-blue-700' },
  in_progress: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  completed: { bg: 'bg-green-100', text: 'text-green-700' },
};

function HerbalDecoctionManager() {
  const [packages, setPackages] = useState<DecoctionPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [requestingId, setRequestingId] = useState<number | null>(null);

  // 데이터 로드
  const loadPackages = useCallback(async () => {
    try {
      setLoading(true);
      const sql = `
        SELECT hp.*
        FROM cs_herbal_packages hp
        WHERE hp.decoction_date = '${selectedDate}'
          AND hp.status = 'active'
        ORDER BY
          CASE hp.decoction_status
            WHEN 'pending' THEN 1
            WHEN 'ready' THEN 2
            WHEN 'in_progress' THEN 3
            WHEN 'completed' THEN 4
            ELSE 5
          END,
          hp.created_at ASC
      `;
      const data = await query<DecoctionPackage>(sql);
      setPackages(data);
    } catch (error) {
      console.error('탕전 목록 로드 오류:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    loadPackages();
    // 1분마다 갱신
    const interval = setInterval(loadPackages, 60 * 1000);
    return () => clearInterval(interval);
  }, [loadPackages]);

  // 상태 변경
  const handleStatusChange = async (pkg: DecoctionPackage, newStatus: DecoctionStatus) => {
    try {
      const now = getCurrentTimestamp();
      let updateSql = `UPDATE cs_herbal_packages SET decoction_status = '${newStatus}', updated_at = '${now}'`;

      if (newStatus === 'in_progress') {
        updateSql += `, decoction_started_at = '${now}'`;
      } else if (newStatus === 'completed') {
        updateSql += `, decoction_completed_at = '${now}'`;
      }

      updateSql += ` WHERE id = ${pkg.id}`;
      await execute(updateSql);
      loadPackages();
    } catch (error) {
      console.error('상태 변경 오류:', error);
      alert('상태 변경에 실패했습니다.');
    }
  };

  // 처방 요청
  const handleRequestPrescription = async (pkg: DecoctionPackage) => {
    if (!pkg.doctor_name) {
      alert('담당 원장이 지정되지 않았습니다.');
      return;
    }

    try {
      setRequestingId(pkg.id || null);

      // 1. DB 업데이트
      await requestPrescription(pkg.id!);

      // 2. 잔디 알림 발송
      await sendJandiWebhook({
        title: `[처방 요청] ${pkg.patient_name}님 한약 처방 입력 요청`,
        description: `약명: ${pkg.herbal_name}\n탕전 예정일: ${pkg.decoction_date}\n담당: ${pkg.doctor_name} 원장님`,
        color: '#FFA500',
      });

      alert(`${pkg.doctor_name} 원장님께 처방 요청을 전송했습니다.`);
      loadPackages();
    } catch (error) {
      console.error('처방 요청 오류:', error);
      alert('처방 요청에 실패했습니다.');
    } finally {
      setRequestingId(null);
    }
  };

  // 통계 계산
  const stats = {
    total: packages.length,
    pending: packages.filter(p => p.decoction_status === 'pending').length,
    inProgress: packages.filter(p => p.decoction_status === 'in_progress').length,
    completed: packages.filter(p => p.decoction_status === 'completed').length,
    noPrescription: packages.filter(p => p.prescription_status === 'pending').length,
  };

  // 오늘인지 확인
  const isToday = selectedDate === new Date().toISOString().split('T')[0];

  return (
    <div className="h-full overflow-auto bg-gray-50">
      {/* 헤더 */}
      <div className="page-header bg-white border-b sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-gray-800">한약 탕전 관리</h1>
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="px-3 py-1.5 border rounded-lg text-sm"
            />
            {isToday && (
              <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                오늘
              </span>
            )}
          </div>
          <button
            onClick={loadPackages}
            className="btn btn-outline"
            disabled={loading}
          >
            <i className="fa-solid fa-refresh mr-2"></i>
            새로고침
          </button>
        </div>

        {/* 통계 */}
        <div className="flex gap-4 mt-4">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500">전체:</span>
            <span className="font-medium">{stats.total}건</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
            <span className="text-gray-500">대기:</span>
            <span className="font-medium">{stats.pending}건</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="w-2 h-2 bg-yellow-400 rounded-full"></span>
            <span className="text-gray-500">진행중:</span>
            <span className="font-medium">{stats.inProgress}건</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="w-2 h-2 bg-green-400 rounded-full"></span>
            <span className="text-gray-500">완료:</span>
            <span className="font-medium">{stats.completed}건</span>
          </div>
          {stats.noPrescription > 0 && (
            <div className="flex items-center gap-2 text-sm text-red-600">
              <i className="fa-solid fa-exclamation-triangle"></i>
              <span>처방 미입력: {stats.noPrescription}건</span>
            </div>
          )}
        </div>
      </div>

      {/* 목록 */}
      <div className="p-4">
        {loading ? (
          <div className="text-center py-12">
            <i className="fa-solid fa-spinner fa-spin text-2xl text-gray-400"></i>
            <p className="mt-2 text-gray-500">로딩 중...</p>
          </div>
        ) : packages.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg">
            <i className="fa-solid fa-check-circle text-4xl text-green-400"></i>
            <p className="mt-2 text-gray-500">
              {selectedDate}에 예정된 탕전이 없습니다.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {packages.map(pkg => (
              <div
                key={pkg.id}
                className={`bg-white rounded-lg shadow-sm border p-4 ${
                  pkg.prescription_status === 'pending' ? 'border-red-300 bg-red-50/30' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  {/* 좌측: 환자 정보 */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      {/* 상태 배지 */}
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded ${
                          STATUS_COLORS[pkg.decoction_status as DecoctionStatus]?.bg || 'bg-gray-100'
                        } ${STATUS_COLORS[pkg.decoction_status as DecoctionStatus]?.text || 'text-gray-700'}`}
                      >
                        {DECOCTION_STATUS_LABELS[pkg.decoction_status as DecoctionStatus] || '대기'}
                      </span>

                      {/* 환자명 */}
                      <span className="font-bold text-gray-800">{pkg.patient_name}</span>

                      {/* 차트번호 */}
                      <span className="text-sm text-gray-500">({pkg.chart_number})</span>

                      {/* 담당원장 */}
                      {pkg.doctor_name && (
                        <span className="text-sm text-blue-600">{pkg.doctor_name}</span>
                      )}
                    </div>

                    {/* 약명 및 상세 */}
                    <div className="mt-2 flex items-center gap-4">
                      <span className="text-gray-700 font-medium">{pkg.herbal_name}</span>

                      {/* 수령방식 */}
                      {pkg.delivery_method && (
                        <span className="text-sm px-2 py-0.5 bg-gray-100 rounded text-gray-600">
                          {DELIVERY_METHOD_LABELS[pkg.delivery_method]}
                        </span>
                      )}
                    </div>

                    {/* 처방/복용법 상태 */}
                    <div className="mt-2 flex items-center gap-4">
                      {pkg.prescription_status === 'pending' ? (
                        <span className="text-sm text-red-600 flex items-center gap-1">
                          <i className="fa-solid fa-exclamation-circle"></i>
                          처방 미입력
                        </span>
                      ) : (
                        <span className="text-sm text-green-600 flex items-center gap-1">
                          <i className="fa-solid fa-check-circle"></i>
                          처방 완료
                        </span>
                      )}

                      {pkg.dosage_instruction ? (
                        <span className="text-sm text-gray-600">
                          복용법: {pkg.dosage_instruction}
                        </span>
                      ) : (
                        <span className="text-sm text-orange-600">
                          복용법 미입력
                        </span>
                      )}
                    </div>

                    {/* 메모 */}
                    {pkg.memo && (
                      <div className="mt-2 text-sm text-gray-500">
                        <i className="fa-solid fa-sticky-note mr-1"></i>
                        {pkg.memo}
                      </div>
                    )}
                  </div>

                  {/* 우측: 액션 버튼 */}
                  <div className="flex flex-col gap-2">
                    {/* 처방 요청 버튼 */}
                    {pkg.prescription_status === 'pending' && pkg.doctor_name && (
                      <button
                        onClick={() => handleRequestPrescription(pkg)}
                        disabled={requestingId === pkg.id}
                        className="px-3 py-1.5 text-sm bg-orange-500 text-white rounded hover:bg-orange-600 disabled:opacity-50"
                      >
                        {requestingId === pkg.id ? (
                          <><i className="fa-solid fa-spinner fa-spin mr-1"></i> 요청중...</>
                        ) : (
                          <><i className="fa-solid fa-bell mr-1"></i> 처방 요청</>
                        )}
                      </button>
                    )}

                    {/* 상태 변경 버튼 */}
                    {pkg.decoction_status === 'pending' && pkg.prescription_status === 'completed' && (
                      <button
                        onClick={() => handleStatusChange(pkg, 'in_progress')}
                        className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
                      >
                        <i className="fa-solid fa-play mr-1"></i> 탕전 시작
                      </button>
                    )}

                    {pkg.decoction_status === 'in_progress' && (
                      <button
                        onClick={() => handleStatusChange(pkg, 'completed')}
                        className="px-3 py-1.5 text-sm bg-green-500 text-white rounded hover:bg-green-600"
                      >
                        <i className="fa-solid fa-check mr-1"></i> 탕전 완료
                      </button>
                    )}

                    {pkg.decoction_status === 'completed' && (
                      <span className="px-3 py-1.5 text-sm text-green-600">
                        <i className="fa-solid fa-check-circle mr-1"></i> 완료
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default HerbalDecoctionManager;
