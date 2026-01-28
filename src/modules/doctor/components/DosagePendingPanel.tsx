/**
 * 복용법 대기 패널
 * 복용법 입력이 필요한 한약 패키지 목록
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDosagePendingByDoctor } from '../lib/dashboardApi';
import type { HerbalPackage } from '@modules/cs/types';

interface Props {
  doctorId: number;
  doctorName: string;
  onPatientClick?: (patientId: number, chartNumber: string) => void;
  onDosageClick?: (pkg: HerbalPackage) => void;
}

type DosagePackage = HerbalPackage & {
  days_until_decoction: number;
};

export function DosagePendingPanel({
  doctorId,
  doctorName,
  onPatientClick,
  onDosageClick,
}: Props) {
  const navigate = useNavigate();
  const [packages, setPackages] = useState<DosagePackage[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPackages = useCallback(async () => {
    try {
      const data = await getDosagePendingByDoctor(doctorId);
      setPackages(data as DosagePackage[]);
    } catch (error) {
      console.error('복용법 대기 목록 로드 오류:', error);
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

  // 복용법 작성 페이지로 이동
  const handleDosageClick = (pkg: HerbalPackage) => {
    if (onDosageClick) {
      onDosageClick(pkg);
    } else {
      // 기본 동작: 복용법 작성 페이지로 이동
      navigate(`/doctor/dosage-instruction/create?packageId=${pkg.id}`);
    }
  };

  // 긴급도 스타일
  const getUrgencyStyle = (daysUntil: number) => {
    if (daysUntil <= 0) {
      return { bg: 'bg-red-500', text: 'text-white', label: 'D-Day' };
    } else if (daysUntil === 1) {
      return { bg: 'bg-orange-500', text: 'text-white', label: 'D-1' };
    } else if (daysUntil === 2) {
      return { bg: 'bg-yellow-500', text: 'text-gray-900', label: 'D-2' };
    }
    return { bg: 'bg-gray-400', text: 'text-white', label: `D-${daysUntil}` };
  };

  // 행 배경색
  const getRowBg = (daysUntil: number) => {
    if (daysUntil <= 0) return 'bg-red-50 hover:bg-red-100';
    if (daysUntil <= 2) return 'bg-yellow-50 hover:bg-yellow-100';
    return 'bg-gray-50 hover:bg-gray-100';
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm h-full flex flex-col">
        <div className="px-4 py-3 border-b bg-gray-50 flex items-center gap-2">
          <span className="text-lg">📝</span>
          <span className="font-semibold text-gray-800">복용법 대기</span>
        </div>
        <div className="flex-1 p-4">
          <div className="animate-pulse space-y-3">
            <div className="h-10 bg-gray-200 rounded" />
            <div className="h-10 bg-gray-200 rounded" />
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
          <span className="text-lg">📝</span>
          <span className="font-semibold text-gray-800">복용법 대기</span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            packages.some(p => p.days_until_decoction <= 1)
              ? 'bg-red-500 text-white'
              : 'bg-green-500 text-white'
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

      {/* 목록 - 가로 스크롤 형태 */}
      <div className="flex-1 overflow-x-auto p-3">
        {packages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
            복용법 입력 대기 중인 패키지가 없습니다
          </div>
        ) : (
          <div className="flex gap-3 min-w-max">
            {packages.map(pkg => {
              const urgency = getUrgencyStyle(pkg.days_until_decoction);
              const rowBg = getRowBg(pkg.days_until_decoction);

              return (
                <div
                  key={pkg.id}
                  className={`flex-shrink-0 w-56 rounded-lg border border-gray-200 ${rowBg} cursor-pointer transition-all hover:shadow-md`}
                  onClick={() => handleDosageClick(pkg)}
                >
                  <div className="p-3">
                    {/* 상단: 긴급도 + 탕전일 */}
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-xs px-2 py-0.5 rounded font-bold ${urgency.bg} ${urgency.text}`}>
                        {urgency.label}
                      </span>
                      <span className="text-xs text-gray-500">
                        {pkg.decoction_date}
                      </span>
                    </div>

                    {/* 환자 정보 */}
                    <div className="mb-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="font-medium text-gray-800 hover:text-clinic-primary hover:underline"
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
                    </div>

                    {/* 약명 */}
                    <div className="text-sm text-gray-600 truncate">
                      {pkg.herbal_name}
                    </div>

                    {/* 패키지 정보 */}
                    <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                      <span className="px-1.5 py-0.5 bg-gray-100 rounded">
                        {pkg.package_type === '0.5month' ? '15일' :
                         pkg.package_type === '1month' ? '1개월' :
                         pkg.package_type === '2month' ? '2개월' :
                         pkg.package_type === '3month' ? '3개월' :
                         pkg.package_type === '6month' ? '6개월' : pkg.package_type}
                      </span>
                      <span>
                        {pkg.total_count}회분
                      </span>
                    </div>
                  </div>

                  {/* 작성 버튼 */}
                  <div className="px-3 pb-3">
                    <button
                      className="w-full py-1.5 text-xs bg-clinic-primary text-white rounded hover:bg-clinic-primary-dark transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDosageClick(pkg);
                      }}
                    >
                      복용법 작성
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 긴급 알림 */}
      {packages.some(p => p.days_until_decoction <= 1) && (
        <div className="px-4 py-2 bg-orange-50 border-t border-orange-200">
          <span className="text-xs text-orange-600 font-medium">
            ⚠️ 긴급 복용법 작성 필요 ({packages.filter(p => p.days_until_decoction <= 1).length}건)
          </span>
        </div>
      )}
    </div>
  );
}

export default DosagePendingPanel;
