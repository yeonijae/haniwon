/**
 * 처방 대기 패널
 * 담당 원장에게 처방 입력이 필요한 한약 패키지 목록
 */

import { useState, useEffect, useCallback } from 'react';
import { getPendingPrescriptionsByDoctor } from '@modules/cs/lib/decoctionApi';
import type { HerbalPackage } from '@modules/cs/types';

interface Props {
  doctorId: number;
  doctorName: string;
  onPatientClick?: (patientId: number, chartNumber: string) => void;
  onPrescriptionClick?: (pkg: HerbalPackage) => void;
}

type PendingPackage = HerbalPackage & {
  days_until_decoction: number;
  source_type?: 'package' | 'draft';
};

const CONSULT_TYPE_LABELS: Record<string, string> = {
  initial_herbal: '초진 탕약',
  followup_deduct: '재진 차감',
  followup_payment: '재진 결제',
  other: '기타 상담',
};

export function PrescriptionPendingPanel({
  doctorId,
  doctorName,
  onPatientClick,
  onPrescriptionClick,
}: Props) {
  const [packages, setPackages] = useState<PendingPackage[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPackages = useCallback(async () => {
    try {
      const data = await getPendingPrescriptionsByDoctor(doctorId, doctorName);
      setPackages(data);
    } catch (error) {
      console.error('처방 대기 목록 로드 오류:', error);
    } finally {
      setLoading(false);
    }
  }, [doctorId]);

  useEffect(() => {
    loadPackages();
    // 1분마다 갱신
    const interval = setInterval(loadPackages, 60 * 1000);
    return () => clearInterval(interval);
  }, [loadPackages]);

  // 긴급도에 따른 배지 스타일
  const getUrgencyStyle = (daysUntil: number) => {
    if (daysUntil <= 0) {
      return {
        bg: 'bg-red-500',
        text: 'text-white',
        label: 'D-Day',
      };
    } else if (daysUntil === 1) {
      return {
        bg: 'bg-orange-500',
        text: 'text-white',
        label: 'D-1',
      };
    } else if (daysUntil === 2) {
      return {
        bg: 'bg-yellow-500',
        text: 'text-gray-900',
        label: 'D-2',
      };
    }
    return {
      bg: 'bg-gray-400',
      text: 'text-white',
      label: `D-${daysUntil}`,
    };
  };

  // 행 배경색
  const getRowBg = (daysUntil: number) => {
    if (daysUntil <= 0) return 'bg-red-50 hover:bg-red-100';
    if (daysUntil === 1) return 'bg-yellow-50 hover:bg-yellow-100';
    return 'bg-gray-50 hover:bg-gray-100';
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm h-full flex flex-col">
        <div className="px-4 py-3 border-b bg-gray-50 flex items-center gap-2">
          <span className="text-lg">💊</span>
          <span className="font-semibold text-gray-800">처방 대기</span>
        </div>
        <div className="flex-1 p-4">
          <div className="animate-pulse space-y-3">
            <div className="h-12 bg-gray-200 rounded" />
            <div className="h-12 bg-gray-200 rounded" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm h-full flex flex-col">
      {/* 헤더 */}
      <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">💊</span>
          <span className="font-semibold text-gray-800">처방 대기</span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            packages.some(p => p.days_until_decoction <= 1)
              ? 'bg-red-500 text-white'
              : 'bg-blue-500 text-white'
          }`}>
            {packages.length}건
          </span>
        </div>
        <button
          onClick={loadPackages}
          className="text-gray-400 hover:text-gray-600 text-sm"
          title="새로고침"
        >
          🔄
        </button>
      </div>

      {/* 목록 */}
      <div className="flex-1 overflow-y-auto">
        {packages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
            대기 중인 처방이 없습니다
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {packages.map(pkg => {
              const urgency = getUrgencyStyle(pkg.days_until_decoction);
              const rowBg = getRowBg(pkg.days_until_decoction);

              return (
                <div
                  key={pkg.id}
                  className={`px-4 py-3 ${rowBg} cursor-pointer transition-colors`}
                  onClick={() => onPrescriptionClick?.(pkg)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {/* 긴급도 배지 */}
                      <span className={`text-xs px-2 py-0.5 rounded font-bold ${urgency.bg} ${urgency.text} whitespace-nowrap`}>
                        {urgency.label}
                      </span>

                      {/* 환자 정보 */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className="font-medium text-gray-800 hover:text-clinic-primary hover:underline cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              onPatientClick?.(pkg.patient_id, pkg.chart_number);
                            }}
                          >
                            {pkg.patient_name}
                          </span>
                          <span className="text-xs text-gray-400">
                            {pkg.chart_number}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 truncate">
                          {pkg.source_type === 'draft'
                            ? (CONSULT_TYPE_LABELS[pkg.herbal_name] || '탕약기록')
                            : pkg.herbal_name}
                          {pkg.source_type === 'draft' && (
                            <span className="ml-1 px-1 py-0.5 rounded bg-purple-100 text-purple-600 text-[10px]">탕약기록</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* 탕전일 */}
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-xs text-gray-500">
                        {pkg.decoction_date}
                      </span>
                      {pkg.prescription_request_count && pkg.prescription_request_count > 0 && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-orange-500 text-white">
                          요청 {pkg.prescription_request_count}회
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 긴급 알림 */}
      {packages.some(p => p.days_until_decoction <= 1) && (
        <div className="px-4 py-2 bg-red-50 border-t border-red-200">
          <span className="text-xs text-red-600 font-medium">
            ⚠️ 긴급 처방 입력 필요 ({packages.filter(p => p.days_until_decoction <= 1).length}건)
          </span>
        </div>
      )}
    </div>
  );
}

export default PrescriptionPendingPanel;
