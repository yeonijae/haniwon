/**
 * 환자 선결제 상태 카드 컴포넌트
 * 차트나 환자 상세 페이지에서 한약/녹용 선결제 정보 표시
 */

import React, { useState, useEffect } from 'react';
import { query } from '@shared/lib/postgres';

interface HerbalPackage {
  id: number;
  herbal_name: string;
  package_type: string;
  total_count: number;
  used_count: number;
  remaining_count: number;
  start_date: string;
  next_delivery_date?: string;
  status: 'active' | 'completed';
}

interface NokryongPackage {
  id: number;
  package_name: string;
  nokryong_type?: string;
  total_months: number;
  remaining_months: number;
  start_date: string;
  status: 'active' | 'completed' | 'expired';
}

interface PatientPrepaidStatusCardProps {
  patientId: number;
  patientName?: string;
}

const PACKAGE_TYPE_LABELS: Record<string, string> = {
  '0.5month': '15일',
  '1month': '1개월',
  '2month': '2개월',
  '3month': '3개월',
  '6month': '6개월',
};

const PatientPrepaidStatusCard: React.FC<PatientPrepaidStatusCardProps> = ({
  patientId,
}) => {
  const [herbalPackages, setHerbalPackages] = useState<HerbalPackage[]>([]);
  const [nokryongPackages, setNokryongPackages] = useState<NokryongPackage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPrepaidData();
  }, [patientId]);

  const loadPrepaidData = async () => {
    try {
      setLoading(true);

      // 활성 한약 선결제 패키지 조회
      const herbalData = await query<HerbalPackage>(
        `SELECT * FROM cs_herbal_packages WHERE patient_id = ${patientId} AND status = 'active' ORDER BY created_at DESC`
      );
      setHerbalPackages(herbalData || []);

      // 활성 녹용 선결제 패키지 조회
      const nokryongData = await query<NokryongPackage>(
        `SELECT * FROM cs_nokryong_packages WHERE patient_id = ${patientId} AND status = 'active' ORDER BY created_at DESC`
      );
      setNokryongPackages(nokryongData || []);
    } catch (error) {
      console.error('선결제 정보 로드 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  // 진행률 계산
  const getProgress = (used: number, total: number): number => {
    if (total === 0) return 0;
    return Math.round((used / total) * 100);
  };

  // 진행률 바 색상
  const getProgressColor = (used: number, total: number): string => {
    const remaining = total - used;
    if (remaining <= 1) return 'bg-red-500';
    if (remaining <= 2) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-3"></div>
          <div className="h-8 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  const hasHerbal = herbalPackages.length > 0;
  const hasNokryong = nokryongPackages.length > 0;

  // 선결제 정보가 없으면 표시하지 않음
  if (!hasHerbal && !hasNokryong) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow">
      {/* 헤더 */}
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <h4 className="font-medium text-gray-900">
          <i className="fas fa-pills text-purple-500 mr-2"></i>
          선결제 현황
        </h4>
        <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-700 rounded">
          {herbalPackages.length + nokryongPackages.length}건
        </span>
      </div>

      <div className="p-4 space-y-4">
        {/* 한약 선결제 */}
        {hasHerbal && (
          <div>
            <div className="text-xs text-gray-500 mb-2 flex items-center">
              <i className="fas fa-mortar-pestle mr-1"></i>
              한약 선결제
            </div>
            <div className="space-y-2">
              {herbalPackages.map((pkg) => (
                <div key={pkg.id} className="bg-green-50 rounded-lg p-3 border border-green-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-green-800 text-sm">
                      {pkg.herbal_name || '약명 미지정'}
                    </span>
                    <span className="text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded">
                      {PACKAGE_TYPE_LABELS[pkg.package_type] || pkg.package_type}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-green-200 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full ${getProgressColor(pkg.used_count, pkg.total_count)} transition-all`}
                        style={{ width: `${getProgress(pkg.used_count, pkg.total_count)}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium text-green-700 whitespace-nowrap">
                      {pkg.used_count}/{pkg.total_count}회
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-green-600 flex justify-between">
                    <span>잔여 {pkg.remaining_count || (pkg.total_count - pkg.used_count)}회</span>
                    {pkg.next_delivery_date && (
                      <span>다음배송: {pkg.next_delivery_date}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 녹용 선결제 */}
        {hasNokryong && (
          <div>
            <div className="text-xs text-gray-500 mb-2 flex items-center">
              <i className="fas fa-deer mr-1"></i>
              녹용 선결제
            </div>
            <div className="space-y-2">
              {nokryongPackages.map((pkg) => {
                const usedMonths = pkg.total_months - pkg.remaining_months;
                return (
                  <div key={pkg.id} className="bg-amber-50 rounded-lg p-3 border border-amber-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-amber-800 text-sm">
                        {pkg.package_name || pkg.nokryong_type || '녹용'}
                      </span>
                      {pkg.nokryong_type && (
                        <span className="text-xs text-amber-600 bg-amber-100 px-2 py-0.5 rounded">
                          {pkg.nokryong_type}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-amber-200 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full ${getProgressColor(usedMonths, pkg.total_months)} transition-all`}
                          style={{ width: `${getProgress(usedMonths, pkg.total_months)}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium text-amber-700 whitespace-nowrap">
                        {usedMonths}/{pkg.total_months}회
                      </span>
                    </div>
                    <div className="mt-2 text-xs text-amber-600">
                      잔여 {pkg.remaining_months}회분
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PatientPrepaidStatusCard;
