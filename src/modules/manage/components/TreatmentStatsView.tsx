/**
 * 치료 통계 대시보드
 * 일별/주별/월별 치료 현황 리포트
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  fetchTreatmentSummaryStats,
  fetchDailyTreatmentStats,
  type TreatmentSummaryStats,
  type DailyTreatmentStats,
} from '../lib/treatmentApi';

type PeriodType = 'today' | 'week' | 'month' | 'custom';

// 날짜 포맷 함수
const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

// 날짜 범위 계산
const getDateRange = (period: PeriodType, customStart?: string, customEnd?: string): { start: string; end: string } => {
  const today = new Date();
  const end = formatDate(today);

  switch (period) {
    case 'today':
      return { start: end, end };
    case 'week': {
      const weekAgo = new Date(today);
      weekAgo.setDate(today.getDate() - 6);
      return { start: formatDate(weekAgo), end };
    }
    case 'month': {
      const monthAgo = new Date(today);
      monthAgo.setDate(today.getDate() - 29);
      return { start: formatDate(monthAgo), end };
    }
    case 'custom':
      return { start: customStart || end, end: customEnd || end };
    default:
      return { start: end, end };
  }
};

interface StatCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: string;
  color: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, subtitle, icon, color }) => (
  <div className={`bg-white rounded-xl shadow-sm border p-5 ${color}`}>
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm text-gray-500 mb-1">{title}</p>
        <p className="text-3xl font-bold text-gray-800">{value}</p>
        {subtitle && <p className="text-sm text-gray-400 mt-1">{subtitle}</p>}
      </div>
      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${color.replace('border-l-4', 'bg-opacity-10')}`}>
        <i className={`fa-solid ${icon} text-xl`} style={{ color: color.includes('blue') ? '#3B82F6' : color.includes('green') ? '#10B981' : color.includes('purple') ? '#8B5CF6' : '#F59E0B' }}></i>
      </div>
    </div>
  </div>
);

interface TreatmentBarProps {
  name: string;
  count: number;
  maxCount: number;
  color: string;
}

const TreatmentBar: React.FC<TreatmentBarProps> = ({ name, count, maxCount, color }) => {
  const percentage = maxCount > 0 ? (count / maxCount) * 100 : 0;

  return (
    <div className="flex items-center gap-3">
      <span className="w-16 text-sm text-gray-600 text-right">{name}</span>
      <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} transition-all duration-500 flex items-center justify-end pr-2`}
          style={{ width: `${Math.max(percentage, 5)}%` }}
        >
          {count > 0 && <span className="text-xs font-medium text-white">{count}</span>}
        </div>
      </div>
    </div>
  );
};

const TreatmentStatsView: React.FC = () => {
  const [period, setPeriod] = useState<PeriodType>('week');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<TreatmentSummaryStats | null>(null);
  const [dailyStats, setDailyStats] = useState<DailyTreatmentStats[]>([]);

  const dateRange = useMemo(() => {
    return getDateRange(period, customStartDate, customEndDate);
  }, [period, customStartDate, customEndDate]);

  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      const [summaryData, dailyData] = await Promise.all([
        fetchTreatmentSummaryStats(dateRange.start, dateRange.end),
        fetchDailyTreatmentStats(dateRange.start, dateRange.end),
      ]);
      setSummary(summaryData);
      setDailyStats(dailyData);
    } catch (error) {
      console.error('통계 로드 오류:', error);
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // 치료 항목 색상
  const treatmentColors = [
    'bg-blue-500',
    'bg-green-500',
    'bg-purple-500',
    'bg-orange-500',
    'bg-pink-500',
    'bg-teal-500',
    'bg-indigo-500',
    'bg-amber-500',
  ];

  const maxTreatmentCount = summary ? Math.max(...summary.topTreatments.map(t => t.count), 1) : 1;
  const maxActingCount = summary ? Math.max(...summary.topActings.map(a => a.count), 1) : 1;

  return (
    <div className="h-full flex flex-col bg-gray-50 overflow-hidden">
      {/* 헤더 */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-800">치료 통계</h2>
            <p className="text-sm text-gray-500">
              {period === 'custom' ? `${customStartDate} ~ ${customEndDate}` : summary?.period || ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPeriod('today')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                period === 'today' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              오늘
            </button>
            <button
              onClick={() => setPeriod('week')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                period === 'week' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              최근 7일
            </button>
            <button
              onClick={() => setPeriod('month')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                period === 'month' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              최근 30일
            </button>
            <div className="border-l h-6 mx-2"></div>
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => {
                setCustomStartDate(e.target.value);
                setPeriod('custom');
              }}
              className="px-3 py-2 border rounded-lg text-sm"
            />
            <span className="text-gray-400">~</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => {
                setCustomEndDate(e.target.value);
                setPeriod('custom');
              }}
              className="px-3 py-2 border rounded-lg text-sm"
            />
            <button
              onClick={loadStats}
              className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <i className="fa-solid fa-rotate text-gray-600"></i>
            </button>
          </div>
        </div>
      </div>

      {/* 본문 */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <i className="fa-solid fa-spinner fa-spin text-3xl text-blue-500"></i>
          </div>
        ) : summary ? (
          <div className="space-y-6">
            {/* 요약 카드 */}
            <div className="grid grid-cols-4 gap-4">
              <StatCard
                title="총 환자 수"
                value={summary.totalPatients}
                subtitle="명"
                icon="fa-users"
                color="border-l-4 border-blue-500"
              />
              <StatCard
                title="총 치료 횟수"
                value={summary.totalTreatments}
                subtitle="회"
                icon="fa-hand-holding-medical"
                color="border-l-4 border-green-500"
              />
              <StatCard
                title="총 액팅 횟수"
                value={summary.totalActings}
                subtitle="회"
                icon="fa-user-doctor"
                color="border-l-4 border-purple-500"
              />
              <StatCard
                title="환자당 평균 치료"
                value={summary.avgTreatmentsPerPatient}
                subtitle="회"
                icon="fa-chart-line"
                color="border-l-4 border-orange-500"
              />
            </div>

            {/* 치료 항목 및 액팅 통계 */}
            <div className="grid grid-cols-2 gap-6">
              {/* 치료 항목별 통계 */}
              <div className="bg-white rounded-xl shadow-sm border p-5">
                <h3 className="text-lg font-bold text-gray-800 mb-4">
                  <i className="fa-solid fa-chart-bar mr-2 text-blue-500"></i>
                  치료 항목별 현황
                </h3>
                <div className="space-y-3">
                  {summary.topTreatments.length > 0 ? (
                    summary.topTreatments.map((treatment, index) => (
                      <TreatmentBar
                        key={treatment.name}
                        name={treatment.name}
                        count={treatment.count}
                        maxCount={maxTreatmentCount}
                        color={treatmentColors[index % treatmentColors.length]}
                      />
                    ))
                  ) : (
                    <p className="text-center text-gray-400 py-4">데이터가 없습니다</p>
                  )}
                </div>
              </div>

              {/* 액팅별 통계 */}
              <div className="bg-white rounded-xl shadow-sm border p-5">
                <h3 className="text-lg font-bold text-gray-800 mb-4">
                  <i className="fa-solid fa-user-doctor mr-2 text-purple-500"></i>
                  원장 액팅별 현황
                </h3>
                <div className="space-y-3">
                  {summary.topActings.length > 0 ? (
                    summary.topActings.map((acting, index) => (
                      <TreatmentBar
                        key={acting.name}
                        name={acting.name}
                        count={acting.count}
                        maxCount={maxActingCount}
                        color={treatmentColors[(index + 3) % treatmentColors.length]}
                      />
                    ))
                  ) : (
                    <p className="text-center text-gray-400 py-4">데이터가 없습니다</p>
                  )}
                </div>
              </div>
            </div>

            {/* 일별 현황 테이블 */}
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <div className="px-5 py-4 border-b">
                <h3 className="text-lg font-bold text-gray-800">
                  <i className="fa-solid fa-calendar-days mr-2 text-green-500"></i>
                  일별 상세 현황
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">날짜</th>
                      <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">환자 수</th>
                      <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">총 치료</th>
                      <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">침</th>
                      <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">물치</th>
                      <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">핫팩</th>
                      <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">추나</th>
                      <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">초음파</th>
                      <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">습부항</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {dailyStats.length > 0 ? (
                      dailyStats.map((day) => (
                        <tr key={day.date} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-medium text-gray-800">
                            {day.date}
                            <span className="ml-2 text-xs text-gray-400">
                              ({new Date(day.date).toLocaleDateString('ko-KR', { weekday: 'short' })})
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center text-sm">
                            <span className="font-bold text-blue-600">{day.totalPatients}</span>
                          </td>
                          <td className="px-4 py-3 text-center text-sm">
                            <span className="font-bold text-gray-800">{day.totalTreatments}</span>
                          </td>
                          <td className="px-4 py-3 text-center text-sm text-gray-600">
                            {day.treatmentCounts.acupuncture || '-'}
                          </td>
                          <td className="px-4 py-3 text-center text-sm text-gray-600">
                            {day.treatmentCounts.moxa || '-'}
                          </td>
                          <td className="px-4 py-3 text-center text-sm text-gray-600">
                            {day.treatmentCounts.hotpack || '-'}
                          </td>
                          <td className="px-4 py-3 text-center text-sm text-gray-600">
                            {day.treatmentCounts.chuna || '-'}
                          </td>
                          <td className="px-4 py-3 text-center text-sm text-gray-600">
                            {day.treatmentCounts.ultrasound || '-'}
                          </td>
                          <td className="px-4 py-3 text-center text-sm text-gray-600">
                            {day.treatmentCounts.cupping || '-'}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={9} className="px-4 py-8 text-center text-gray-400">
                          해당 기간의 데이터가 없습니다
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-64 text-gray-400">
            데이터를 불러올 수 없습니다
          </div>
        )}
      </div>
    </div>
  );
};

export default TreatmentStatsView;
