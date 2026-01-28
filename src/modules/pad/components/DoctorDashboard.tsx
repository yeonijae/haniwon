/**
 * 의료진 대시보드 통계 컴포넌트
 */

import { useState, useEffect } from 'react';
import type { DashboardStats } from '../types';
import { useTheme } from '../contexts/ThemeContext';

interface Props {
  doctorId: number;
  doctorName: string;
}

// 숫자 포맷팅
const formatNumber = (num: number): string => {
  return num.toLocaleString('ko-KR');
};

// 시간 포맷팅 (분 → H:MM)
const formatMinutes = (minutes: number): string => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}:${m.toString().padStart(2, '0')}` : `${m}분`;
};

// 통계 카드 컴포넌트
function StatCard({
  label,
  value,
  unit,
  icon,
  color = 'blue',
  isDark,
}: {
  label: string;
  value: string | number;
  unit?: string;
  icon: string;
  color?: 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'gray';
  isDark: boolean;
}) {
  const colorStyles = {
    blue: 'bg-blue-500/20 text-blue-500',
    green: 'bg-green-500/20 text-green-500',
    orange: 'bg-orange-500/20 text-orange-500',
    red: 'bg-red-500/20 text-red-500',
    purple: 'bg-purple-500/20 text-purple-500',
    gray: 'bg-gray-500/20 text-gray-500',
  };

  return (
    <div className={`${isDark ? 'bg-gray-800/50' : 'bg-gray-100'} rounded-lg p-2 flex flex-col`}>
      <div className="flex items-center gap-1.5 mb-1">
        <span className={`text-xs px-1.5 py-0.5 rounded ${colorStyles[color]}`}>
          {icon}
        </span>
        <span className={`text-[10px] ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{value}</span>
        {unit && <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{unit}</span>}
      </div>
    </div>
  );
}

export function DoctorDashboard({ doctorId, doctorName }: Props) {
  const [stats, setStats] = useState<DashboardStats>({
    totalPatients: 0,
    reservedPatients: 0,
    walkInPatients: 0,
    canceledPatients: 0,
    totalRevenue: 0,
    avgRevenuePerPatient: 0,
    totalActingMinutes: 0,
    productivity: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();

    // 5분마다 갱신
    const interval = setInterval(loadStats, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [doctorId]);

  const loadStats = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const apiUrl = import.meta.env.VITE_POSTGRES_API_URL || 'http://192.168.0.173:3200';

      // 여러 API 병렬 호출
      const [reservationRes, actingRes] = await Promise.all([
        fetch(`${apiUrl}/api/reservations/stats?date=${today}&doctorId=${doctorId}`).catch(() => null),
        fetch(`${apiUrl}/api/acting/stats?date=${today}&doctorId=${doctorId}`).catch(() => null),
      ]);

      let reservationStats = { total: 0, visited: 0, walkIn: 0, canceled: 0 };
      let actingStats = { totalMinutes: 0, totalRevenue: 0 };

      if (reservationRes?.ok) {
        const data = await reservationRes.json();
        reservationStats = {
          total: data.total || 0,
          visited: data.visited || 0,
          walkIn: data.walkIn || data.onSite || 0,
          canceled: data.canceled || 0,
        };
      }

      if (actingRes?.ok) {
        const data = await actingRes.json();
        actingStats = {
          totalMinutes: data.totalMinutes || data.total_minutes || 0,
          totalRevenue: data.totalRevenue || data.total_revenue || 0,
        };
      }

      // 통계 계산
      const totalPatients = reservationStats.visited;
      const avgRevenue = totalPatients > 0 ? Math.round(actingStats.totalRevenue / totalPatients) : 0;
      const productivity = actingStats.totalMinutes > 0
        ? Math.round(actingStats.totalRevenue / actingStats.totalMinutes)
        : 0;

      setStats({
        totalPatients,
        reservedPatients: reservationStats.total,
        walkInPatients: reservationStats.walkIn,
        canceledPatients: reservationStats.canceled,
        totalRevenue: actingStats.totalRevenue,
        avgRevenuePerPatient: avgRevenue,
        totalActingMinutes: actingStats.totalMinutes,
        productivity,
      });
    } catch (error) {
      console.error('Failed to load dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const { isDark } = useTheme();

  // 테마별 스타일
  const t = {
    container: isDark ? 'bg-gray-800' : 'bg-white shadow-sm',
    border: isDark ? 'border-gray-700' : 'border-gray-200',
    text: isDark ? 'text-white' : 'text-gray-900',
    textMuted: isDark ? 'text-gray-500' : 'text-gray-400',
    skeleton: isDark ? 'bg-gray-700' : 'bg-gray-200',
  };

  if (loading) {
    return (
      <div className={`${t.container} rounded-lg p-4`}>
        <div className="animate-pulse space-y-3">
          <div className={`h-4 ${t.skeleton} rounded w-24`} />
          <div className="grid grid-cols-4 gap-2">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className={`h-16 ${t.skeleton} rounded`} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${t.container} rounded-lg overflow-hidden`}>
      {/* 헤더 */}
      <div className={`px-3 py-2 border-b ${t.border} flex items-center gap-2`}>
        <span className="text-sm">📊</span>
        <span className={`text-sm font-medium ${t.text}`}>오늘의 대시보드</span>
      </div>

      {/* 환자 통계 */}
      <div className="p-3">
        <div className={`text-[10px] ${t.textMuted} uppercase tracking-wider mb-2`}>환자</div>
        <div className="grid grid-cols-4 gap-2">
          <StatCard
            label="환자수"
            value={formatNumber(stats.totalPatients)}
            icon="👤"
            color="blue"
            isDark={isDark}
          />
          <StatCard
            label="예약"
            value={formatNumber(stats.reservedPatients)}
            icon="📅"
            color="green"
            isDark={isDark}
          />
          <StatCard
            label="현장예약"
            value={formatNumber(stats.walkInPatients)}
            icon="🚶"
            color="orange"
            isDark={isDark}
          />
          <StatCard
            label="취소"
            value={formatNumber(stats.canceledPatients)}
            icon="❌"
            color="red"
            isDark={isDark}
          />
        </div>
      </div>

      {/* 매출/생산성 통계 */}
      <div className="px-3 pb-3">
        <div className={`text-[10px] ${t.textMuted} uppercase tracking-wider mb-2`}>생산성</div>
        <div className="grid grid-cols-3 gap-2">
          <StatCard
            label="객단가"
            value={formatNumber(stats.avgRevenuePerPatient)}
            unit="원"
            icon="💰"
            color="purple"
            isDark={isDark}
          />
          <StatCard
            label="액팅시간"
            value={formatMinutes(stats.totalActingMinutes)}
            icon="⏱️"
            color="blue"
            isDark={isDark}
          />
          <StatCard
            label="생산성"
            value={formatNumber(stats.productivity)}
            unit="원/분"
            icon="📈"
            color="green"
            isDark={isDark}
          />
        </div>
      </div>
    </div>
  );
}
