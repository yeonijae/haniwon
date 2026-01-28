/**
 * 처방 대기 목록 컴포넌트
 * 담당원장에게 처방 입력이 필요한 한약 패키지 목록 표시
 */

import { useState, useEffect, useCallback } from 'react';
import { useTheme } from '../contexts/ThemeContext';
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
};

export function PrescriptionPendingList({
  doctorId,
  doctorName,
  onPatientClick,
  onPrescriptionClick,
}: Props) {
  const [packages, setPackages] = useState<PendingPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const { isDark } = useTheme();

  const loadPackages = useCallback(async () => {
    try {
      const data = await getPendingPrescriptionsByDoctor(doctorId);
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

  // 테마별 스타일
  const t = {
    container: isDark ? 'bg-gray-800' : 'bg-white shadow-sm',
    border: isDark ? 'border-gray-700' : 'border-gray-200',
    text: isDark ? 'text-white' : 'text-gray-900',
    textMuted: isDark ? 'text-gray-400' : 'text-gray-500',
    itemBg: isDark ? 'bg-gray-700/50 hover:bg-gray-700' : 'bg-gray-50 hover:bg-gray-100',
    urgentBg: isDark ? 'bg-red-900/30 hover:bg-red-900/50' : 'bg-red-50 hover:bg-red-100',
    warningBg: isDark ? 'bg-yellow-900/30 hover:bg-yellow-900/50' : 'bg-yellow-50 hover:bg-yellow-100',
  };

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
    if (daysUntil <= 0) return t.urgentBg;
    if (daysUntil === 1) return t.warningBg;
    return t.itemBg;
  };

  if (loading) {
    return (
      <div className={`${t.container} rounded-lg p-4`}>
        <div className="animate-pulse space-y-3">
          <div className={`h-4 ${isDark ? 'bg-gray-700' : 'bg-gray-200'} rounded w-32`} />
          <div className={`h-12 ${isDark ? 'bg-gray-700' : 'bg-gray-200'} rounded`} />
          <div className={`h-12 ${isDark ? 'bg-gray-700' : 'bg-gray-200'} rounded`} />
        </div>
      </div>
    );
  }

  if (packages.length === 0) {
    return (
      <div className={`${t.container} rounded-lg overflow-hidden`}>
        <div className={`px-3 py-2 border-b ${t.border} flex items-center gap-2`}>
          <span className="text-sm">📋</span>
          <span className={`text-sm font-medium ${t.text}`}>처방 대기</span>
        </div>
        <div className="p-4 text-center">
          <span className={`text-sm ${t.textMuted}`}>대기 중인 처방이 없습니다</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`${t.container} rounded-lg overflow-hidden`}>
      {/* 헤더 */}
      <div className={`px-3 py-2 border-b ${t.border} flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <span className="text-sm">📋</span>
          <span className={`text-sm font-medium ${t.text}`}>처방 대기</span>
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
          className={`text-xs ${t.textMuted} hover:${t.text}`}
          title="새로고침"
        >
          🔄
        </button>
      </div>

      {/* 목록 */}
      <div className="max-h-48 overflow-y-auto">
        {packages.map(pkg => {
          const urgency = getUrgencyStyle(pkg.days_until_decoction);
          const rowBg = getRowBg(pkg.days_until_decoction);

          return (
            <div
              key={pkg.id}
              className={`px-3 py-2 border-b ${t.border} last:border-b-0 ${rowBg} cursor-pointer transition-colors`}
              onClick={() => onPrescriptionClick?.(pkg)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {/* 긴급도 배지 */}
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${urgency.bg} ${urgency.text}`}>
                    {urgency.label}
                  </span>

                  {/* 환자명 */}
                  <span
                    className={`text-sm font-medium ${t.text} truncate cursor-pointer hover:underline`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onPatientClick?.(pkg.patient_id, pkg.chart_number);
                    }}
                  >
                    {pkg.patient_name}
                  </span>

                  {/* 약명 */}
                  <span className={`text-xs ${t.textMuted} truncate`}>
                    {pkg.herbal_name}
                  </span>
                </div>

                {/* 탕전일 */}
                <div className="flex items-center gap-2">
                  <span className={`text-xs ${t.textMuted}`}>
                    {pkg.decoction_date}
                  </span>
                  {pkg.prescription_request_count && pkg.prescription_request_count > 0 && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-orange-500 text-white" title="요청 횟수">
                      요청 {pkg.prescription_request_count}회
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 긴급 알림 */}
      {packages.some(p => p.days_until_decoction <= 1) && (
        <div className={`px-3 py-2 ${isDark ? 'bg-red-900/20' : 'bg-red-50'} border-t ${t.border}`}>
          <span className="text-xs text-red-500 font-medium">
            ⚠️ 긴급 처방 입력이 필요합니다 ({packages.filter(p => p.days_until_decoction <= 1).length}건)
          </span>
        </div>
      )}
    </div>
  );
}
