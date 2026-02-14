/**
 * 나의 지표 페이지
 * 로그인한 원장 본인의 누적 지표 (입사~현재) 표시
 */

import { useState, useEffect } from 'react';
import {
  getCumulativeStatsAll,
  formatNumber,
  formatPercent,
} from '../api/metricsApi';
import { getStoredSession } from '../lib/auth';

// 지표 항목 정의
const METRIC_SECTIONS = [
  {
    title: '초진수',
    icon: 'fa-user-plus',
    color: 'blue',
    items: [
      { key: 'choojin_chim', label: '침초진' },
      { key: 'choojin_jabo', label: '자보초진' },
      { key: 'choojin_total', label: '총 초진' },
    ],
  },
  {
    title: '평환',
    icon: 'fa-users',
    color: 'emerald',
    items: [
      { key: 'pyunghwan', label: '일평균 환자수' },
    ],
  },
  {
    title: '재진율',
    icon: 'fa-chart-line',
    color: 'purple',
    items: [
      { key: 'revisit_rejin', label: '재진율' },
      { key: 'revisit_samjin', label: '삼진율' },
      { key: 'revisit_ital', label: '이탈율' },
    ],
  },
  {
    title: '매출',
    icon: 'fa-won-sign',
    color: 'amber',
    items: [
      { key: 'revenue_total', label: '총매출' },
      { key: 'revenue_insurance', label: '건보매출' },
      { key: 'revenue_jabo', label: '자보매출' },
      { key: 'revenue_uncovered', label: '비보매출' },
    ],
  },
  {
    title: '객단가',
    icon: 'fa-calculator',
    color: 'rose',
    items: [
      { key: 'avg_insurance', label: '건보 객단가' },
      { key: 'avg_jabo', label: '자보 객단가' },
    ],
  },
];

// 누적 데이터 타입
interface CumulativeData {
  start_date: string;
  total_work_days: number;
  choojin: { total: number; chim: number; jabo: number };
  revisit: {
    total_choojin: number;
    rejin_rate: number;
    samjin_rate: number;
    ital_rate: number;
  };
  revenue: {
    total: number;
    insurance: number;
    jabo: number;
    uncovered: number;
    insurance_patients: number;
    jabo_patients: number;
    insurance_avg: number;
    jabo_avg: number;
  };
}

// 누적 데이터 값 포맷팅
function getFormattedValue(data: CumulativeData, key: string): string {
  switch (key) {
    case 'choojin_total': return formatNumber(data.choojin.total);
    case 'choojin_chim': return formatNumber(data.choojin.chim);
    case 'choojin_jabo': return formatNumber(data.choojin.jabo);
    case 'revisit_rejin': return data.revisit ? formatPercent(data.revisit.rejin_rate) : '-';
    case 'revisit_samjin': return data.revisit ? formatPercent(data.revisit.samjin_rate) : '-';
    case 'revisit_ital': return data.revisit ? formatPercent(data.revisit.ital_rate) : '-';
    case 'revenue_total': return `${formatNumber(Math.round(data.revenue.total / 10000))}만원`;
    case 'revenue_insurance': return `${formatNumber(Math.round(data.revenue.insurance / 10000))}만원`;
    case 'revenue_jabo': return `${formatNumber(Math.round(data.revenue.jabo / 10000))}만원`;
    case 'revenue_uncovered': return `${formatNumber(Math.round(data.revenue.uncovered / 10000))}만원`;
    case 'avg_insurance': {
      const avg = data.revenue.insurance_avg || 0;
      return avg === 0 ? '-' : `${formatNumber(avg)}원`;
    }
    case 'avg_jabo': {
      const avg = data.revenue.jabo_avg || 0;
      return avg === 0 ? '-' : `${formatNumber(avg)}원`;
    }
    case 'pyunghwan': {
      const totalPatients = (data.revenue.insurance_patients || 0) + (data.revenue.jabo_patients || 0);
      const workDays = data.total_work_days || 0;
      if (workDays === 0) return '-';
      return `${(totalPatients / workDays).toFixed(1)}명`;
    }
    default: return '-';
  }
}

// 색상 매핑
const COLOR_MAP: Record<string, { bg: string; border: string; text: string; icon: string }> = {
  blue: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', icon: 'text-blue-500' },
  emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', icon: 'text-emerald-500' },
  purple: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', icon: 'text-purple-500' },
  amber: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', icon: 'text-amber-500' },
  rose: { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700', icon: 'text-rose-500' },
};

export default function MyMetrics() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [doctorName, setDoctorName] = useState<string>('');
  const [data, setData] = useState<CumulativeData | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError(null);

    const session = getStoredSession();
    if (!session) {
      setError('로그인 정보를 찾을 수 없습니다.');
      setLoading(false);
      return;
    }

    setDoctorName(session.name);

    try {
      const res = await getCumulativeStatsAll();
      if (res.success && res.data?.by_doctor) {
        const myData = res.data.by_doctor[session.name];
        if (myData) {
          setData(myData as unknown as CumulativeData);
        } else {
          setError(`"${session.name}" 원장의 누적 데이터를 찾을 수 없습니다.`);
        }
      } else {
        setError('누적 통계 데이터를 불러오지 못했습니다.');
      }
    } catch (err) {
      console.error('누적 통계 로드 실패:', err);
      setError('데이터 로드 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <i className="fas fa-spinner fa-spin text-3xl text-clinic-primary mb-3"></i>
          <p className="text-gray-500">데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <i className="fas fa-exclamation-circle text-3xl text-red-400 mb-3"></i>
          <p className="text-red-600">{error}</p>
          <button
            onClick={loadData}
            className="mt-4 px-4 py-2 bg-clinic-primary text-white rounded-lg hover:bg-opacity-90 transition-colors"
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="h-full overflow-y-auto p-6">
      {/* 헤더 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">
          <i className="fas fa-chart-column text-clinic-primary mr-2"></i>
          나의 지표
        </h1>
        <div className="flex items-center gap-4 text-sm text-gray-500">
          <span className="font-medium text-gray-700">{doctorName} 원장</span>
          <span>|</span>
          <span>입사일: {data.start_date}</span>
          <span>|</span>
          <span>누적 근무일수: {formatNumber(data.total_work_days)}일</span>
        </div>
      </div>

      {/* 지표 섹션 */}
      <div className="space-y-6">
        {METRIC_SECTIONS.map((section) => {
          const colors = COLOR_MAP[section.color];
          return (
            <div key={section.title}>
              <h2 className={`text-sm font-semibold ${colors.text} mb-3 flex items-center gap-2`}>
                <i className={`fas ${section.icon} ${colors.icon}`}></i>
                {section.title}
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {section.items.map((item) => (
                  <div
                    key={item.key}
                    className={`${colors.bg} ${colors.border} border rounded-xl p-4`}
                  >
                    <p className="text-xs text-gray-500 mb-1">{item.label}</p>
                    <p className={`text-xl font-bold ${colors.text}`}>
                      {getFormattedValue(data, item.key)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
