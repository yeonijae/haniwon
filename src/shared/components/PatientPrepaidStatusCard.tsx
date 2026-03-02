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
    <div className="space-y-2">
      {herbalPackages.map((pkg) => (
        <div key={`h-${pkg.id}`} className="bg-green-50 rounded-lg p-3 border border-green-200">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-green-800">
              한약 {pkg.used_count}/{pkg.total_count}회
            </span>
            <span className="text-xs text-green-600 bg-green-100 px-1.5 py-0.5 rounded">
              {PACKAGE_TYPE_LABELS[pkg.package_type] || pkg.package_type}
            </span>
          </div>
          <div className="mt-1.5 bg-green-200 rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-full ${getProgressColor(pkg.used_count, pkg.total_count)} transition-all`}
              style={{ width: `${getProgress(pkg.used_count, pkg.total_count)}%` }}
            />
          </div>
        </div>
      ))}
      {nokryongPackages.map((pkg) => {
        const usedMonths = pkg.total_months - pkg.remaining_months;
        return (
          <div key={`n-${pkg.id}`} className="bg-amber-50 rounded-lg p-3 border border-amber-200">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-amber-800">
                녹용{pkg.nokryong_type ? `(${pkg.nokryong_type})` : ''} {usedMonths}/{pkg.total_months}회
              </span>
            </div>
            <div className="mt-1.5 bg-amber-200 rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-full ${getProgressColor(usedMonths, pkg.total_months)} transition-all`}
                style={{ width: `${getProgress(usedMonths, pkg.total_months)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default PatientPrepaidStatusCard;
