import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { PortalUser } from '@shared/types';

const API_BASE = 'http://192.168.0.173:3100';

interface UncoveredItem {
  name: string;
  cnt: number;
  amount: number;
}

interface UncoveredCategory {
  total_cnt: number;
  total_amount: number;
  items: UncoveredItem[];
}

interface UncoveredByDoctor {
  doctor: string;
  total: number;
  categories: Record<string, number>;
}

interface UncoveredDetail {
  total_cnt: number;
  total_amount: number;
  categories: {
    녹용: UncoveredCategory;
    맞춤한약: UncoveredCategory;
    상비한약: UncoveredCategory;
    공진단: UncoveredCategory;
    경옥고: UncoveredCategory;
    약침: UncoveredCategory;
    기타: UncoveredCategory;
  };
  doctors?: string[];
  by_doctor?: UncoveredByDoctor[];
}

interface VisitRouteItem {
  name: string;
  cnt: number;
}

interface VisitRouteCategory {
  total: number;
  items: VisitRouteItem[];
}

interface VisitRouteDetail {
  total: number;
  categories: {
    소개: VisitRouteCategory;
    검색: VisitRouteCategory;
    간판: VisitRouteCategory;
    기타: VisitRouteCategory;
  };
}

interface YakChojinByDoctor {
  doctor: string;
  existing_same: number;   // 기존-담당
  existing_other: number;  // 기존-다른
  new_direct: number;      // 약생초
  referral_same: number;   // 소개-담당
  referral_other: number;  // 소개-다른
  total: number;
}

interface YakChojinDetail {
  doctors: string[];
  by_doctor: YakChojinByDoctor[];
  totals: {
    existing_same: number;
    existing_other: number;
    new_direct: number;
    referral_same: number;
    referral_other: number;
    total: number;
  };
}

interface YakChojinRawPatient {
  chart_no: string;
  patient_name: string;
  doctor: string;
  category: string;
  date: string;
  items?: string;
  referrer?: {
    name: string;
    chart_no: string;
    main_doctor: string;
    suggest?: string;
    cust_url?: string;
  };
}

interface DoctorStats {
  doctor: string;
  work_days?: number;
  patients: {
    chim_chojin: number;
    chim_rechojin: number;
    chim_rejin: number;
    jabo_chojin: number;
    jabo_rechojin: number;
    jabo_rejin: number;
    yak_chojin: number;
    yak_rechojin: number;
    total_chim: number;
  };
  chuna: {
    insurance_simple: number;
    insurance_complex: number;
    jabo: number;
    uncovered: number;
    total: number;
  };
  reservations: {
    total_chim_patients: number;
    reserved_count: number;
    reservation_rate: number;
    onsite_count: number;
    onsite_rate: number;
  };
  revenue: {
    insurance: number;
    chuna_revenue: number;
    jabo: number;
    uncovered: number;
    total: number;
  };
}

interface StatisticsAppProps {
  user: PortalUser;
}

type PeriodType = 'daily' | 'weekly' | 'monthly';

// 원장 입사순서 정렬 함수 (동적 순서 사용)
function sortByDoctorOrder<T extends { doctor: string }>(items: T[], doctorOrder: string[]): T[] {
  return [...items].sort((a, b) => {
    const aIdx = doctorOrder.indexOf(a.doctor);
    const bIdx = doctorOrder.indexOf(b.doctor);
    // 목록에 없으면 맨 뒤로
    const aOrder = aIdx === -1 ? 999 : aIdx;
    const bOrder = bIdx === -1 ? 999 : bIdx;
    return aOrder - bOrder;
  });
}

function formatMoney(amount: number): string {
  if (amount >= 100000000) {
    return (amount / 100000000).toFixed(1) + '억';
  }
  if (amount >= 10000) {
    return (amount / 10000).toFixed(0) + '만';
  }
  return amount.toLocaleString();
}

function StatisticsApp({ user }: StatisticsAppProps) {
  const [period, setPeriod] = useState<PeriodType>('daily');
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  // 월간용 연/월 선택
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1);

  const [doctors, setDoctors] = useState<string[]>([]);
  const [doctorOrder, setDoctorOrder] = useState<string[]>([]);  // 원장 입사순서
  const [doctorStats, setDoctorStats] = useState<DoctorStats[]>([]);
  const [totalStats, setTotalStats] = useState<DoctorStats | null>(null);
  const [uncoveredDetail, setUncoveredDetail] = useState<UncoveredDetail | null>(null);
  const [visitRouteDetail, setVisitRouteDetail] = useState<VisitRouteDetail | null>(null);
  const [yakChojinDetail, setYakChojinDetail] = useState<YakChojinDetail | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [expandedRouteCategories, setExpandedRouteCategories] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState({ start: '', end: '', workDays: 0 });

  // 전월/전년 비교 데이터
  const [comparisonData, setComparisonData] = useState<{
    prevMonth: { total: number; workDays: number } | null;
    prevYear: { total: number; workDays: number } | null;
  }>({ prevMonth: null, prevYear: null });

  // 18개월 매출 추이 데이터
  const [revenueTrend, setRevenueTrend] = useState<{
    month: string;
    insurance: number;
    chuna: number;
    jabo: number;
    uncovered: number;
  }[]>([]);

  // 검색어 상세 데이터
  const [searchKeywords, setSearchKeywords] = useState<{
    total: number;
    keywords: { keyword: string; cnt: number; ratio: number }[];
  } | null>(null);

  // 18개월 침초진 추이 데이터
  const [visitRouteTrend, setVisitRouteTrend] = useState<{
    month: string;
    intro: number;
    search: number;
    signboard: number;
    other: number;
    total: number;
  }[]>([]);

  // 18개월 침환자 추이 데이터
  const [chimPatientTrend, setChimPatientTrend] = useState<{
    month: string;
    avg_daily: number;
    chim_chojin: number;
    chim_rechojin: number;
    chim_total: number;
    jabo_chojin: number;
    jabo_rechojin: number;
    jabo_total: number;
  }[]>([]);

  // 약초진 Raw Data 모달
  const [yakRawModal, setYakRawModal] = useState<{
    open: boolean;
    doctor: string;
    category: string;
    categoryLabel: string;
    patients: YakChojinRawPatient[];
    loading: boolean;
  }>({ open: false, doctor: '', category: '', categoryLabel: '', patients: [], loading: false });

  // 컴포넌트 마운트 시 원장 입사순서 가져오기
  useEffect(() => {
    async function fetchDoctorOrder() {
      try {
        const res = await fetch(`${API_BASE}/api/doctor-order`);
        const data = await res.json();
        if (data.doctors && data.doctors.length > 0) {
          setDoctorOrder(data.doctors.map((d: { name: string }) => d.name));
        } else {
          // API 응답은 성공했지만 데이터가 없는 경우 - fallback
          setDoctorOrder(['_fallback_']);
        }
      } catch (e) {
        console.error('원장 순서 조회 실패:', e);
        // API 실패 시 fallback (정렬 없이 원래 순서 사용)
        setDoctorOrder(['_fallback_']);
      }
    }
    fetchDoctorOrder();
  }, []);

  // 월간일 때는 연/월 변경 시, 아닐 때는 날짜 변경 시 조회
  // doctorOrder가 로드된 후에만 통계 조회
  useEffect(() => {
    if (doctorOrder.length > 0) {
      fetchAllStats();
    }
  }, [period, selectedDate, selectedYear, selectedMonth, doctorOrder]);

  // API 호출에 사용할 날짜 계산
  function getQueryDate(): string {
    if (period === 'monthly') {
      // 월간: 해당 월의 1일 사용
      return `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
    }
    return selectedDate;
  }

  // 전월/전년 날짜 계산
  function getComparisonDates(): { prevMonth: string; prevYear: string } {
    if (period === 'monthly') {
      // 전월
      const prevM = new Date(selectedYear, selectedMonth - 2, 1);
      const prevMonthDate = `${prevM.getFullYear()}-${String(prevM.getMonth() + 1).padStart(2, '0')}-01`;
      // 전년 동월
      const prevYearDate = `${selectedYear - 1}-${String(selectedMonth).padStart(2, '0')}-01`;
      return { prevMonth: prevMonthDate, prevYear: prevYearDate };
    }
    // daily/weekly는 비교 데이터 없음
    return { prevMonth: '', prevYear: '' };
  }

  async function fetchAllStats() {
    setLoading(true);
    setError(null);
    try {
      const queryDate = getQueryDate();
      const { prevMonth, prevYear } = getComparisonDates();

      // 통합 API + 비급여 상세 API + 내원경로 API + 약초진 API + 매출추이 API + 검색어 API + 침초진추이 API + 침환자추이 API 병렬 호출
      const fetchPromises: Promise<Response>[] = [
        fetch(`${API_BASE}/api/stats/all?period=${period}&date=${queryDate}`),
        fetch(`${API_BASE}/api/stats/uncovered-detail?period=${period}&date=${queryDate}`),
        fetch(`${API_BASE}/api/stats/visit-route?period=${period}&date=${queryDate}`),
        fetch(`${API_BASE}/api/stats/yak-chojin-detail?period=${period}&date=${queryDate}`),
        fetch(`${API_BASE}/api/stats/revenue-trend?end_date=${queryDate}`),
        fetch(`${API_BASE}/api/stats/search-keywords?period=${period}&date=${queryDate}`),
        fetch(`${API_BASE}/api/stats/visit-route-trend?end_date=${queryDate}`),
        fetch(`${API_BASE}/api/stats/chim-patient-trend?end_date=${queryDate}`)
      ];

      // 월간일 때만 전월/전년 데이터 추가 요청
      if (period === 'monthly' && prevMonth && prevYear) {
        fetchPromises.push(fetch(`${API_BASE}/api/stats/all?period=monthly&date=${prevMonth}`));
        fetchPromises.push(fetch(`${API_BASE}/api/stats/all?period=monthly&date=${prevYear}`));
      }

      const responses = await Promise.all(fetchPromises);
      const [statsRes, uncoveredRes, visitRouteRes, yakChojinRes, trendRes, searchKeywordsRes, visitRouteTrendRes, chimPatientTrendRes, ...comparisonRes] = responses;

      const data = await statsRes.json();
      const uncoveredData = await uncoveredRes.json();
      const visitRouteData = await visitRouteRes.json();
      const yakChojinData = await yakChojinRes.json();
      const trendData = await trendRes.json();
      const searchKeywordsData = await searchKeywordsRes.json();
      const visitRouteTrendData = await visitRouteTrendRes.json();
      const chimPatientTrendData = await chimPatientTrendRes.json();

      if (data.error) {
        throw new Error(data.error);
      }

      // doctors 배열도 입사순서대로 정렬
      const sortedDoctors = [...(data.doctors || [])].sort((a: string, b: string) => {
        const aIdx = doctorOrder.indexOf(a);
        const bIdx = doctorOrder.indexOf(b);
        const aOrder = aIdx === -1 ? 999 : aIdx;
        const bOrder = bIdx === -1 ? 999 : bIdx;
        return aOrder - bOrder;
      });
      setDoctors(sortedDoctors);
      setDoctorStats(sortByDoctorOrder(data.doctor_stats || [], doctorOrder));
      setTotalStats(data.total_stats || null);
      // 비급여 상세 - by_doctor 정렬
      if (!uncoveredData.error && uncoveredData.by_doctor) {
        uncoveredData.by_doctor = sortByDoctorOrder(uncoveredData.by_doctor, doctorOrder);
      }
      setUncoveredDetail(uncoveredData.error ? null : uncoveredData);
      setVisitRouteDetail(visitRouteData.error ? null : visitRouteData);
      // 약초진 상세 - by_doctor 정렬
      if (!yakChojinData.error && yakChojinData.by_doctor) {
        yakChojinData.by_doctor = sortByDoctorOrder(yakChojinData.by_doctor, doctorOrder);
      }
      setYakChojinDetail(yakChojinData.error ? null : yakChojinData);
      // 18개월 매출 추이 데이터 설정
      if (!trendData.error && trendData.data) {
        setRevenueTrend(trendData.data);
      } else {
        setRevenueTrend([]);
      }
      // 검색어 상세 데이터 설정
      if (!searchKeywordsData.error) {
        setSearchKeywords(searchKeywordsData);
      } else {
        setSearchKeywords(null);
      }
      // 18개월 침초진 추이 데이터 설정
      if (!visitRouteTrendData.error && visitRouteTrendData.data) {
        setVisitRouteTrend(visitRouteTrendData.data);
      } else {
        setVisitRouteTrend([]);
      }
      // 18개월 침환자 추이 데이터 설정
      if (!chimPatientTrendData.error && chimPatientTrendData.data) {
        setChimPatientTrend(chimPatientTrendData.data);
      } else {
        setChimPatientTrend([]);
      }
      setDateRange({
        start: data.start_date || queryDate,
        end: data.end_date || queryDate,
        workDays: data.work_days || 1
      });

      // 전월/전년 비교 데이터 설정
      if (period === 'monthly' && comparisonRes.length >= 2) {
        const prevMonthData = await comparisonRes[0].json();
        const prevYearData = await comparisonRes[1].json();
        setComparisonData({
          prevMonth: prevMonthData.error ? null : {
            total: prevMonthData.total_stats?.revenue?.total || 0,
            workDays: prevMonthData.work_days || 0
          },
          prevYear: prevYearData.error ? null : {
            total: prevYearData.total_stats?.revenue?.total || 0,
            workDays: prevYearData.work_days || 0
          }
        });
      } else {
        setComparisonData({ prevMonth: null, prevYear: null });
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류');
    } finally {
      setLoading(false);
    }
  }

  // 약초진 Raw Data 조회
  const categoryLabels: Record<string, string> = {
    existing_same: '기존-담당',
    existing_other: '기존-다른',
    new_direct: '신규',
    referral_same: '소개-담당',
    referral_other: '소개-다른',
    yak_saeng_cho: '약생초'
  };

  async function fetchYakChojinRaw(doctor: string, category: string) {
    const categoryLabel = category ? (categoryLabels[category] || category) : '전체';
    setYakRawModal({ open: true, doctor, category, categoryLabel, patients: [], loading: true });

    try {
      const queryDate = getQueryDate();
      const res = await fetch(
        `${API_BASE}/api/stats/yak-chojin-raw?period=${period}&date=${queryDate}&doctor=${encodeURIComponent(doctor)}&category=${category}`
      );
      const data = await res.json();

      if (data.error) {
        throw new Error(data.error);
      }

      // 날짜순 정렬
      const sortedPatients = (data.patients || []).sort((a: YakChojinRawPatient, b: YakChojinRawPatient) =>
        a.date.localeCompare(b.date)
      );
      setYakRawModal(prev => ({ ...prev, patients: sortedPatients, loading: false }));
    } catch (err) {
      console.error('약초진 Raw Data 조회 오류:', err);
      setYakRawModal(prev => ({ ...prev, loading: false }));
    }
  }

  function toggleCategory(category: string) {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }

  function toggleRouteCategory(category: string) {
    setExpandedRouteCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }

  // 연도 옵션 생성 (현재 연도 기준 -5년 ~ +1년)
  const yearOptions = Array.from({ length: 7 }, (_, i) => now.getFullYear() - 5 + i);

  // 날짜 이동 함수
  function movePeriod(direction: -1 | 1) {
    if (period === 'monthly') {
      // 월간: 전달/다음달
      let newMonth = selectedMonth + direction;
      let newYear = selectedYear;
      if (newMonth < 1) {
        newMonth = 12;
        newYear -= 1;
      } else if (newMonth > 12) {
        newMonth = 1;
        newYear += 1;
      }
      setSelectedYear(newYear);
      setSelectedMonth(newMonth);
    } else {
      // 일간/주간: 전날/다음날 (주간은 7일씩)
      const current = new Date(selectedDate);
      const days = period === 'weekly' ? 7 : 1;
      current.setDate(current.getDate() + (days * direction));
      setSelectedDate(current.toISOString().split('T')[0]);
    }
  }

  function getPeriodLabel(): string {
    if (period === 'daily') return dateRange.start;
    return `${dateRange.start} ~ ${dateRange.end}`;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="w-full px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-2xl">📊</span>
            <div>
              <h1 className="text-xl font-bold text-gray-800">통계 대시보드</h1>
              <p className="text-sm text-gray-500">연이재한의원 원장별 통계</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {/* Period Selector */}
            <div className="flex bg-gray-100 rounded-lg p-1">
              {(['daily', 'weekly', 'monthly'] as PeriodType[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    period === p
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  {p === 'daily' ? '일간' : p === 'weekly' ? '주간' : '월간'}
                </button>
              ))}
            </div>
            {/* Date Picker with Navigation */}
            <div className="flex items-center gap-1">
              {/* 이전 버튼 */}
              <button
                onClick={() => movePeriod(-1)}
                className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title={period === 'monthly' ? '전달' : period === 'weekly' ? '전주' : '전날'}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              {period === 'monthly' ? (
                <div className="flex items-center gap-1">
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {yearOptions.map((year) => (
                      <option key={year} value={year}>{year}년</option>
                    ))}
                  </select>
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(Number(e.target.value))}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                      <option key={month} value={month}>{month}월</option>
                    ))}
                  </select>
                </div>
              ) : (
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              )}

              {/* 다음 버튼 */}
              <button
                onClick={() => movePeriod(1)}
                className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title={period === 'monthly' ? '다음달' : period === 'weekly' ? '다음주' : '다음날'}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
            <button
              onClick={fetchAllStats}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? '조회중...' : '조회'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="w-full px-6 py-6">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}

        {!loading && totalStats && (
          <>
            {/* Period Label */}
            <div className="mb-6 text-center">
              <span className="inline-block px-4 py-2 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                {getPeriodLabel()} ({dateRange.workDays}영업일)
              </span>
            </div>

            {/* 원장별 통계 테이블 */}
            <div className="space-y-6">
              {/* 매출 현황 + 전월/전년 비교 (같은 줄에 배치) */}
              <div className="grid grid-cols-2 gap-6">
                {/* 매출 현황 */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                    <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                      <span>💰</span> 매출 현황
                    </h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 border-b">원장</th>
                          <th className="px-3 py-3 text-right text-xs font-semibold text-blue-700 border-b">급여</th>
                          <th className="px-3 py-3 text-right text-xs font-semibold text-cyan-700 border-b">(추나)</th>
                          <th className="px-3 py-3 text-right text-xs font-semibold text-orange-700 border-b">자보</th>
                          <th className="px-3 py-3 text-right text-xs font-semibold text-purple-700 border-b">비급여</th>
                          <th className="px-3 py-3 text-right text-xs font-semibold text-gray-800 border-b bg-gray-100">총매출</th>
                        </tr>
                      </thead>
                      <tbody>
                        {doctorStats.map((stat, idx) => (
                          <tr key={stat.doctor} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="px-3 py-2 text-sm font-medium text-gray-900">{stat.doctor}</td>
                            <td className="px-3 py-2 text-right text-sm text-blue-600">{formatMoney(stat.revenue.insurance)}</td>
                            <td className="px-3 py-2 text-right text-sm text-cyan-600">({formatMoney(stat.revenue.chuna_revenue)})</td>
                            <td className="px-3 py-2 text-right text-sm text-orange-600">{formatMoney(stat.revenue.jabo)}</td>
                            <td className="px-3 py-2 text-right text-sm text-purple-600">{formatMoney(stat.revenue.uncovered)}</td>
                            <td className="px-3 py-2 text-right text-sm font-bold text-gray-800 bg-gray-100">{formatMoney(stat.revenue.total)}</td>
                          </tr>
                        ))}
                        <tr className="bg-blue-50 border-t-2 border-blue-200">
                          <td className="px-3 py-2 text-sm font-bold text-blue-800">전체</td>
                          <td className="px-3 py-2 text-right text-sm text-blue-800 font-bold">{formatMoney(totalStats.revenue.insurance)}</td>
                          <td className="px-3 py-2 text-right text-sm text-cyan-800 font-bold">({formatMoney(totalStats.revenue.chuna_revenue)})</td>
                          <td className="px-3 py-2 text-right text-sm text-blue-800 font-bold">{formatMoney(totalStats.revenue.jabo)}</td>
                          <td className="px-3 py-2 text-right text-sm text-blue-800 font-bold">{formatMoney(totalStats.revenue.uncovered)}</td>
                          <td className="px-3 py-2 text-right text-sm font-bold text-blue-900 bg-blue-100">{formatMoney(totalStats.revenue.total)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 18개월 매출 추이 */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  {revenueTrend.length > 0 ? (
                    <div className="p-4">
                      <ResponsiveContainer width="100%" height={280}>
                        <LineChart data={revenueTrend} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis
                            dataKey="month"
                            tick={{ fontSize: 11, fill: '#6b7280' }}
                            tickLine={{ stroke: '#d1d5db' }}
                          />
                          <YAxis
                            tick={{ fontSize: 11, fill: '#6b7280' }}
                            tickFormatter={(value) => formatMoney(value)}
                            tickLine={{ stroke: '#d1d5db' }}
                            width={55}
                          />
                          <Tooltip
                            formatter={(value: number, name: string) => [formatMoney(value) + '원', name]}
                            labelStyle={{ fontWeight: 'bold' }}
                            contentStyle={{ fontSize: 12, borderRadius: 8 }}
                          />
                          <Legend
                            wrapperStyle={{ fontSize: 12, paddingTop: 10 }}
                          />
                          <Line
                            type="monotone"
                            dataKey="insurance"
                            name="급여"
                            stroke="#3b82f6"
                            strokeWidth={2}
                            dot={{ r: 3 }}
                            activeDot={{ r: 5 }}
                          />
                          <Line
                            type="monotone"
                            dataKey="chuna"
                            name="추나"
                            stroke="#06b6d4"
                            strokeWidth={2}
                            dot={{ r: 3 }}
                            activeDot={{ r: 5 }}
                          />
                          <Line
                            type="monotone"
                            dataKey="jabo"
                            name="자보"
                            stroke="#f97316"
                            strokeWidth={2}
                            dot={{ r: 3 }}
                            activeDot={{ r: 5 }}
                          />
                          <Line
                            type="monotone"
                            dataKey="uncovered"
                            name="비급여"
                            stroke="#a855f7"
                            strokeWidth={2}
                            dot={{ r: 3 }}
                            activeDot={{ r: 5 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="p-6 text-center text-gray-400 text-sm">
                      데이터 없음
                    </div>
                  )}
                </div>
              </div>

              {/* 침환자 유입내역 (3열: 현황표 + 검색어 상세 + 18개월 추이) */}
              <div className="grid grid-cols-3 gap-4">
                {/* 침환자 유입내역 현황표 */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="bg-teal-50 px-4 py-3 border-b border-gray-200">
                    <h2 className="text-base font-bold text-teal-800 flex items-center gap-2">
                      <span>🚶</span> 침환자 유입내역
                      {visitRouteDetail && (
                        <span className="ml-1 text-sm font-normal text-teal-600">
                          ({visitRouteDetail.total}명)
                        </span>
                      )}
                    </h2>
                  </div>
                  {visitRouteDetail && (
                    <div className="overflow-y-auto" style={{ maxHeight: '220px' }}>
                      <table className="w-full">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b">경로</th>
                            <th className="px-2 py-2 text-right text-xs font-semibold text-gray-700 border-b">인원</th>
                            <th className="px-3 py-2 text-right text-xs font-semibold text-gray-700 border-b">비율</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(['소개', '검색', '간판', '기타'] as const).map((categoryName) => {
                            const cat = visitRouteDetail.categories[categoryName];
                            if (!cat || cat.total === 0) return null;
                            const isExpanded = expandedRouteCategories.has(categoryName);
                            const categoryColors: Record<string, { bg: string; text: string; icon: string }> = {
                              '소개': { bg: 'bg-pink-50', text: 'text-pink-700', icon: '👥' },
                              '검색': { bg: 'bg-blue-50', text: 'text-blue-700', icon: '🔍' },
                              '간판': { bg: 'bg-amber-50', text: 'text-amber-700', icon: '🏪' },
                              '기타': { bg: 'bg-gray-50', text: 'text-gray-700', icon: '📋' }
                            };
                            const colors = categoryColors[categoryName] || { bg: 'bg-gray-50', text: 'text-gray-700', icon: '📋' };
                            const percentage = visitRouteDetail.total > 0
                              ? Math.round((cat.total / visitRouteDetail.total) * 100)
                              : 0;
                            return (
                              <React.Fragment key={categoryName}>
                                <tr
                                  className={`cursor-pointer hover:bg-gray-100 ${colors.bg}`}
                                  onClick={() => toggleRouteCategory(categoryName)}
                                >
                                  <td className="px-3 py-1.5 text-sm">
                                    <span className="text-gray-400 mr-1">{isExpanded ? '▼' : '▶'}</span>
                                    <span className="mr-1">{colors.icon}</span>
                                    <span className={`font-medium ${colors.text}`}>{categoryName}</span>
                                  </td>
                                  <td className={`px-2 py-1.5 text-right text-sm ${colors.text}`}>{cat.total}</td>
                                  <td className={`px-3 py-1.5 text-right text-sm font-medium ${colors.text}`}>{percentage}%</td>
                                </tr>
                                {isExpanded && cat.items.map((item, idx) => (
                                  <tr key={`${categoryName}-${idx}`} className="bg-white hover:bg-gray-50">
                                    <td className="px-3 py-1 text-xs text-gray-500 pl-8 truncate" title={item.name} colSpan={2}>
                                      {item.name.length > 20 ? item.name.slice(0, 20) + '...' : item.name}
                                    </td>
                                    <td className="px-3 py-1 text-right text-xs text-gray-500">{item.cnt}</td>
                                  </tr>
                                ))}
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {!visitRouteDetail && (
                    <div className="px-4 py-6 text-center text-sm text-gray-400">
                      데이터 없음
                    </div>
                  )}
                </div>

                {/* 검색어 상세표 */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="bg-blue-50 px-4 py-3 border-b border-gray-200">
                    <h2 className="text-base font-bold text-blue-800 flex items-center gap-2">
                      <span>🔍</span> 검색어 상세
                      {searchKeywords && (
                        <span className="ml-1 text-sm font-normal text-blue-600">
                          ({searchKeywords.total}명)
                        </span>
                      )}
                    </h2>
                  </div>
                  {searchKeywords && searchKeywords.keywords.length > 0 ? (
                    <div className="overflow-y-auto" style={{ maxHeight: '220px' }}>
                      <table className="w-full">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b">검색어</th>
                            <th className="px-2 py-2 text-right text-xs font-semibold text-gray-700 border-b">인원</th>
                            <th className="px-3 py-2 text-right text-xs font-semibold text-gray-700 border-b">비율</th>
                          </tr>
                        </thead>
                        <tbody>
                          {searchKeywords.keywords.map((kw, idx) => (
                            <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                              <td className="px-3 py-1.5 text-sm text-gray-700 truncate" title={kw.keyword}>
                                {kw.keyword.length > 15 ? kw.keyword.slice(0, 15) + '...' : kw.keyword}
                              </td>
                              <td className="px-2 py-1.5 text-right text-sm text-blue-600">{kw.cnt}</td>
                              <td className="px-3 py-1.5 text-right text-sm font-medium text-blue-700">{kw.ratio}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="px-4 py-6 text-center text-sm text-gray-400">
                      데이터 없음
                    </div>
                  )}
                </div>

                {/* 18개월 침초진 추이 */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="bg-indigo-50 px-4 py-3 border-b border-gray-200">
                    <h2 className="text-base font-bold text-indigo-800 flex items-center gap-2">
                      <span>📈</span> 18개월 추이
                    </h2>
                  </div>
                  {visitRouteTrend.length > 0 ? (
                    <div className="p-2">
                      <ResponsiveContainer width="100%" height={210}>
                        <LineChart data={visitRouteTrend} margin={{ top: 5, right: 15, left: -10, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis
                            dataKey="month"
                            tick={{ fontSize: 10, fill: '#6b7280' }}
                            tickLine={{ stroke: '#d1d5db' }}
                          />
                          <YAxis
                            tick={{ fontSize: 10, fill: '#6b7280' }}
                            tickLine={{ stroke: '#d1d5db' }}
                            width={30}
                          />
                          <Tooltip
                            formatter={(value: number, name: string) => [value + '명', name]}
                            labelStyle={{ fontWeight: 'bold', fontSize: 11 }}
                            contentStyle={{ fontSize: 11, borderRadius: 8 }}
                          />
                          <Legend
                            wrapperStyle={{ fontSize: 10, paddingTop: 5 }}
                          />
                          <Line
                            type="monotone"
                            dataKey="intro"
                            name="소개"
                            stroke="#ec4899"
                            strokeWidth={2}
                            dot={{ r: 2 }}
                            activeDot={{ r: 4 }}
                          />
                          <Line
                            type="monotone"
                            dataKey="search"
                            name="검색"
                            stroke="#3b82f6"
                            strokeWidth={2}
                            dot={{ r: 2 }}
                            activeDot={{ r: 4 }}
                          />
                          <Line
                            type="monotone"
                            dataKey="signboard"
                            name="간판"
                            stroke="#f59e0b"
                            strokeWidth={2}
                            dot={{ r: 2 }}
                            activeDot={{ r: 4 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="px-4 py-6 text-center text-sm text-gray-400">
                      데이터 없음
                    </div>
                  )}
                </div>
              </div>

              {/* 침환자 현황 + 18개월 추이 */}
              <div className="grid grid-cols-2 gap-6">
                {/* 침환자 현황 */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                    <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                      <span>👥</span> 침환자 현황
                    </h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-2 py-2 text-left text-xs font-semibold text-gray-700 border-b">원장</th>
                          <th className="px-1 py-2 text-center text-xs font-semibold text-blue-700 border-b">초진</th>
                          <th className="px-1 py-2 text-center text-xs font-semibold text-blue-700 border-b">재초</th>
                          <th className="px-1 py-2 text-center text-xs font-semibold text-blue-700 border-b">재진</th>
                          <th className="px-1 py-2 text-center text-xs font-semibold text-blue-700 border-b bg-blue-50">소계</th>
                          <th className="px-1 py-2 text-center text-xs font-semibold text-orange-700 border-b">자초</th>
                          <th className="px-1 py-2 text-center text-xs font-semibold text-orange-700 border-b">자재초</th>
                          <th className="px-1 py-2 text-center text-xs font-semibold text-orange-700 border-b">자재</th>
                          <th className="px-1 py-2 text-center text-xs font-semibold text-orange-700 border-b bg-orange-50">소계</th>
                          <th className="px-1 py-2 text-center text-xs font-semibold text-gray-800 border-b bg-gray-100">합계</th>
                          {period === 'monthly' && dateRange.workDays > 1 && (
                            <th className="px-1 py-2 text-center text-xs font-semibold text-green-700 border-b bg-green-50">평균</th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {doctorStats.map((stat, idx) => (
                          <tr key={stat.doctor} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="px-2 py-2 text-xs font-medium text-gray-900">{stat.doctor}</td>
                            <td className="px-1 py-2 text-center text-xs text-blue-600">{stat.patients.chim_chojin}</td>
                            <td className="px-1 py-2 text-center text-xs text-blue-600">{stat.patients.chim_rechojin}</td>
                            <td className="px-1 py-2 text-center text-xs text-blue-600">{stat.patients.chim_rejin}</td>
                            <td className="px-1 py-2 text-center text-xs text-blue-700 font-semibold bg-blue-50">{stat.patients.chim_chojin + stat.patients.chim_rechojin + stat.patients.chim_rejin}</td>
                            <td className="px-1 py-2 text-center text-xs text-orange-600">{stat.patients.jabo_chojin}</td>
                            <td className="px-1 py-2 text-center text-xs text-orange-600">{stat.patients.jabo_rechojin}</td>
                            <td className="px-1 py-2 text-center text-xs text-orange-600">{stat.patients.jabo_rejin}</td>
                            <td className="px-1 py-2 text-center text-xs text-orange-700 font-semibold bg-orange-50">{stat.patients.jabo_chojin + stat.patients.jabo_rechojin + stat.patients.jabo_rejin}</td>
                            <td className="px-1 py-2 text-center text-xs font-bold text-gray-800 bg-gray-100">{stat.patients.total_chim}</td>
                            {period === 'monthly' && dateRange.workDays > 1 && (
                              <td className="px-1 py-2 text-center text-xs font-bold text-green-700 bg-green-50">
                                {((stat.work_days || 1) > 0 ? (stat.patients.total_chim / (stat.work_days || 1)).toFixed(1) : '0')}
                              </td>
                            )}
                          </tr>
                        ))}
                        <tr className="bg-blue-50 border-t-2 border-blue-200">
                          <td className="px-2 py-2 text-xs font-bold text-blue-800">전체</td>
                          <td className="px-1 py-2 text-center text-xs text-blue-800 font-bold">{totalStats.patients.chim_chojin}</td>
                          <td className="px-1 py-2 text-center text-xs text-blue-800 font-bold">{totalStats.patients.chim_rechojin}</td>
                          <td className="px-1 py-2 text-center text-xs text-blue-800 font-bold">{totalStats.patients.chim_rejin}</td>
                          <td className="px-1 py-2 text-center text-xs text-blue-900 font-bold bg-blue-100">{totalStats.patients.chim_chojin + totalStats.patients.chim_rechojin + totalStats.patients.chim_rejin}</td>
                          <td className="px-1 py-2 text-center text-xs text-blue-800 font-bold">{totalStats.patients.jabo_chojin}</td>
                          <td className="px-1 py-2 text-center text-xs text-blue-800 font-bold">{totalStats.patients.jabo_rechojin}</td>
                          <td className="px-1 py-2 text-center text-xs text-blue-800 font-bold">{totalStats.patients.jabo_rejin}</td>
                          <td className="px-1 py-2 text-center text-xs text-orange-800 font-bold bg-orange-100">{totalStats.patients.jabo_chojin + totalStats.patients.jabo_rechojin + totalStats.patients.jabo_rejin}</td>
                          <td className="px-1 py-2 text-center text-xs font-bold text-blue-900 bg-gray-200">{totalStats.patients.total_chim}</td>
                          {period === 'monthly' && dateRange.workDays > 1 && (
                            <td className="px-1 py-2 text-center text-xs font-bold text-green-800 bg-green-100">{(totalStats.patients.total_chim / dateRange.workDays).toFixed(1)}</td>
                          )}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 18개월 침환자 추이 */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                    <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                      <span>📈</span> 18개월 침환자 추이
                    </h2>
                  </div>
                  {chimPatientTrend.length > 0 ? (() => {
                    // 첫 달 기준으로 정규화 (100 = 기준점)
                    const baseAvg = chimPatientTrend[0]?.avg_daily || 1;
                    const baseChim = chimPatientTrend[0]?.chim_total || 1;
                    const baseJabo = chimPatientTrend[0]?.jabo_total || 1;

                    const normalizedData = chimPatientTrend.map((item, idx) => ({
                      month: item.month,
                      평환: Math.round((item.avg_daily / baseAvg) * 100),
                      '침초진+재초': Math.round((item.chim_total / baseChim) * 100),
                      '자보초진+재초': Math.round((item.jabo_total / baseJabo) * 100),
                      // 원본 값 (툴팁용)
                      raw_avg: item.avg_daily,
                      raw_chim: item.chim_total,
                      raw_jabo: item.jabo_total,
                    }));

                    return (
                    <div className="p-4">
                      <div className="text-xs text-gray-500 mb-2 text-center">
                        기준: {chimPatientTrend[0]?.month} (평환 {baseAvg}명, 침초진+재초 {baseChim}명, 자보 {baseJabo}명) = 100
                      </div>
                      <ResponsiveContainer width="100%" height={260}>
                        <LineChart data={normalizedData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis
                            dataKey="month"
                            tick={{ fontSize: 11, fill: '#6b7280' }}
                            tickLine={{ stroke: '#d1d5db' }}
                          />
                          <YAxis
                            tick={{ fontSize: 11, fill: '#6b7280' }}
                            tickLine={{ stroke: '#d1d5db' }}
                            width={40}
                            domain={['auto', 'auto']}
                            tickFormatter={(value) => `${value}%`}
                          />
                          <Tooltip
                            formatter={(value: number, name: string, props: any) => {
                              const raw = name === '평환' ? props.payload.raw_avg
                                : name === '침초진+재초' ? props.payload.raw_chim
                                : props.payload.raw_jabo;
                              return [`${value}% (${raw}명)`, name];
                            }}
                            labelStyle={{ fontWeight: 'bold' }}
                            contentStyle={{ fontSize: 12, borderRadius: 8 }}
                          />
                          <Legend
                            wrapperStyle={{ fontSize: 12, paddingTop: 10 }}
                          />
                          <Line
                            type="monotone"
                            dataKey="평환"
                            stroke="#10b981"
                            strokeWidth={2}
                            dot={{ r: 3 }}
                            activeDot={{ r: 5 }}
                          />
                          <Line
                            type="monotone"
                            dataKey="침초진+재초"
                            stroke="#3b82f6"
                            strokeWidth={2}
                            dot={{ r: 3 }}
                            activeDot={{ r: 5 }}
                          />
                          <Line
                            type="monotone"
                            dataKey="자보초진+재초"
                            stroke="#f97316"
                            strokeWidth={2}
                            dot={{ r: 3 }}
                            activeDot={{ r: 5 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                    );
                  })() : (
                    <div className="p-6 text-center text-gray-400 text-sm">
                      데이터 없음
                    </div>
                  )}
                </div>
              </div>

              {/* 약초진 현황 + 비급여 매출 (같은 줄에 배치) */}
              <div className="grid grid-cols-2 gap-6">
                {/* 약초진 현황 */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="bg-green-50 px-6 py-4 border-b border-gray-200">
                    <h2 className="text-lg font-bold text-green-800 flex items-center gap-2">
                      <span>💊</span> 약초진 현황
                      {yakChojinDetail && (
                        <span className="ml-2 text-sm font-normal text-green-600">
                          (총 {yakChojinDetail.totals.total}명)
                        </span>
                      )}
                    </h2>
                  </div>
                  {yakChojinDetail && yakChojinDetail.by_doctor.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b">원장</th>
                            <th className="px-2 py-2 text-center text-xs font-semibold text-green-700 border-b bg-green-50">약생초</th>
                            <th className="px-2 py-2 text-center text-xs font-semibold text-purple-700 border-b">신규</th>
                            <th className="px-2 py-2 text-center text-xs font-semibold text-blue-700 border-b">기존-다른</th>
                            <th className="px-2 py-2 text-center text-xs font-semibold text-orange-700 border-b">소개-다른</th>
                            <th className="px-2 py-2 text-center text-xs font-semibold text-blue-700 border-b">기존-담당</th>
                            <th className="px-2 py-2 text-center text-xs font-semibold text-orange-700 border-b">소개-담당</th>
                            <th className="px-2 py-2 text-center text-xs font-semibold text-gray-800 border-b bg-gray-100">합계</th>
                          </tr>
                        </thead>
                        <tbody>
                          {yakChojinDetail.by_doctor.map((stat, idx) => {
                            const yakSaengCho = stat.new_direct + stat.existing_other + stat.referral_other;
                            return (
                            <tr key={stat.doctor} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                              <td
                                className={`px-3 py-2 text-sm font-medium text-gray-900 ${stat.total > 0 ? 'cursor-pointer hover:bg-gray-100 hover:underline' : ''}`}
                                onClick={() => stat.total > 0 && fetchYakChojinRaw(stat.doctor, '')}
                              >{stat.doctor}</td>
                              <td
                                className={`px-2 py-2 text-center text-sm font-bold text-green-700 bg-green-50 ${yakSaengCho > 0 ? 'cursor-pointer hover:bg-green-100 hover:underline' : ''}`}
                                onClick={() => yakSaengCho > 0 && fetchYakChojinRaw(stat.doctor, 'yak_saeng_cho')}
                              >{yakSaengCho || '-'}</td>
                              <td
                                className={`px-2 py-2 text-center text-sm text-purple-600 ${stat.new_direct > 0 ? 'cursor-pointer hover:bg-purple-100 hover:underline' : ''}`}
                                onClick={() => stat.new_direct > 0 && fetchYakChojinRaw(stat.doctor, 'new_direct')}
                              >{stat.new_direct || '-'}</td>
                              <td
                                className={`px-2 py-2 text-center text-sm text-blue-600 ${stat.existing_other > 0 ? 'cursor-pointer hover:bg-blue-100 hover:underline' : ''}`}
                                onClick={() => stat.existing_other > 0 && fetchYakChojinRaw(stat.doctor, 'existing_other')}
                              >{stat.existing_other || '-'}</td>
                              <td
                                className={`px-2 py-2 text-center text-sm text-orange-600 ${stat.referral_other > 0 ? 'cursor-pointer hover:bg-orange-100 hover:underline' : ''}`}
                                onClick={() => stat.referral_other > 0 && fetchYakChojinRaw(stat.doctor, 'referral_other')}
                              >{stat.referral_other || '-'}</td>
                              <td
                                className={`px-2 py-2 text-center text-sm text-blue-600 ${stat.existing_same > 0 ? 'cursor-pointer hover:bg-blue-100 hover:underline' : ''}`}
                                onClick={() => stat.existing_same > 0 && fetchYakChojinRaw(stat.doctor, 'existing_same')}
                              >{stat.existing_same || '-'}</td>
                              <td
                                className={`px-2 py-2 text-center text-sm text-orange-600 ${stat.referral_same > 0 ? 'cursor-pointer hover:bg-orange-100 hover:underline' : ''}`}
                                onClick={() => stat.referral_same > 0 && fetchYakChojinRaw(stat.doctor, 'referral_same')}
                              >{stat.referral_same || '-'}</td>
                              <td className="px-2 py-2 text-center text-sm font-bold text-gray-800 bg-gray-100">{stat.total}</td>
                            </tr>
                          )})}
                          <tr className="bg-green-50 border-t-2 border-green-200">
                            <td className="px-3 py-2 text-sm font-bold text-green-800">전체</td>
                            <td
                              className={`px-2 py-2 text-center text-sm font-bold text-green-900 bg-green-100 ${(yakChojinDetail.totals.new_direct + yakChojinDetail.totals.existing_other + yakChojinDetail.totals.referral_other) > 0 ? 'cursor-pointer hover:bg-green-200 hover:underline' : ''}`}
                              onClick={() => (yakChojinDetail.totals.new_direct + yakChojinDetail.totals.existing_other + yakChojinDetail.totals.referral_other) > 0 && fetchYakChojinRaw('', 'yak_saeng_cho')}
                            >{(yakChojinDetail.totals.new_direct + yakChojinDetail.totals.existing_other + yakChojinDetail.totals.referral_other) || '-'}</td>
                            <td className="px-2 py-2 text-center text-sm font-bold text-green-700">{yakChojinDetail.totals.new_direct || '-'}</td>
                            <td className="px-2 py-2 text-center text-sm font-bold text-green-700">{yakChojinDetail.totals.existing_other || '-'}</td>
                            <td className="px-2 py-2 text-center text-sm font-bold text-green-700">{yakChojinDetail.totals.referral_other || '-'}</td>
                            <td className="px-2 py-2 text-center text-sm font-bold text-green-700">{yakChojinDetail.totals.existing_same || '-'}</td>
                            <td className="px-2 py-2 text-center text-sm font-bold text-green-700">{yakChojinDetail.totals.referral_same || '-'}</td>
                            <td className="px-2 py-2 text-center text-sm font-bold text-green-900 bg-green-100">{yakChojinDetail.totals.total}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                  {(!yakChojinDetail || yakChojinDetail.by_doctor.length === 0) && (
                    <div className="px-6 py-8 text-center text-sm text-gray-400">
                      데이터 없음
                    </div>
                  )}
                </div>

                {/* 비급여 매출 */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="bg-purple-50 px-6 py-4 border-b border-gray-200">
                    <h2 className="text-lg font-bold text-purple-800 flex items-center gap-2">
                      <span>💰</span> 비급여 매출
                      {uncoveredDetail && (
                        <span className="ml-2 text-sm font-normal text-purple-600">
                          ({uncoveredDetail.total_cnt}건 / {formatMoney(uncoveredDetail.total_amount)}원)
                        </span>
                      )}
                    </h2>
                  </div>
                  {uncoveredDetail && (
                    <div className="overflow-x-auto">
                      {(() => {
                        const categoryList = (['녹용', '맞춤한약', '상비한약', '공진단', '경옥고', '약침', '기타'] as const)
                          .filter(cat => uncoveredDetail.categories[cat]?.total_amount > 0);
                        const categoryColors: Record<string, string> = {
                          '녹용': 'text-amber-700',
                          '맞춤한약': 'text-emerald-700',
                          '상비한약': 'text-cyan-700',
                          '공진단': 'text-rose-700',
                          '경옥고': 'text-violet-700',
                          '약침': 'text-blue-700',
                          '기타': 'text-gray-700'
                        };
                        return (
                          <table className="w-full">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b">원장</th>
                                {categoryList.map((cat) => (
                                  <th key={cat} className={`px-2 py-2 text-right text-xs font-semibold border-b ${categoryColors[cat]}`}>{cat}</th>
                                ))}
                                <th className="px-3 py-2 text-right text-xs font-semibold text-gray-800 border-b bg-gray-100">합계</th>
                              </tr>
                            </thead>
                            <tbody>
                              {uncoveredDetail.by_doctor?.map((docData, idx) => (
                                <tr key={docData.doctor} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                  <td className="px-3 py-2 text-sm font-medium text-gray-900">{docData.doctor}</td>
                                  {categoryList.map((cat) => {
                                    const amount = docData.categories[cat] || 0;
                                    return (
                                      <td key={cat} className="px-2 py-2 text-right text-sm text-gray-600">
                                        {amount > 0 ? formatMoney(amount) : '-'}
                                      </td>
                                    );
                                  })}
                                  <td className="px-3 py-2 text-right text-sm font-bold text-gray-800 bg-gray-100">
                                    {formatMoney(docData.total)}
                                  </td>
                                </tr>
                              ))}
                              {/* 합계 행 */}
                              <tr className="bg-purple-50 border-t-2 border-purple-200">
                                <td className="px-3 py-2 text-sm font-bold text-purple-800">합계</td>
                                {categoryList.map((cat) => (
                                  <td key={cat} className="px-2 py-2 text-right text-sm font-bold text-purple-700">
                                    {formatMoney(uncoveredDetail.categories[cat]?.total_amount || 0)}
                                  </td>
                                ))}
                                <td className="px-3 py-2 text-right text-sm font-bold text-purple-900 bg-purple-100">
                                  {formatMoney(uncoveredDetail.total_amount)}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        );
                      })()}
                    </div>
                  )}
                  {!uncoveredDetail && (
                    <div className="px-6 py-8 text-center text-sm text-gray-400">
                      데이터 없음
                    </div>
                  )}
                </div>
              </div>

              {/* 추나 현황 + 예약 현황 (같은 줄에 배치) */}
              <div className="grid grid-cols-2 gap-6">
                {/* 추나 현황 */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                    <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                      <span>💪</span> 추나 현황
                    </h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 border-b">원장</th>
                          <th className="px-3 py-3 text-center text-xs font-semibold text-blue-700 border-b">단순</th>
                          <th className="px-3 py-3 text-center text-xs font-semibold text-blue-700 border-b">복잡</th>
                          <th className="px-3 py-3 text-center text-xs font-semibold text-orange-700 border-b">자보</th>
                          <th className="px-3 py-3 text-center text-xs font-semibold text-purple-700 border-b">비급여</th>
                          <th className="px-3 py-3 text-center text-xs font-semibold text-gray-800 border-b bg-gray-100">합계</th>
                          <th className="px-3 py-3 text-center text-xs font-semibold text-green-700 border-b">일평균</th>
                          <th className="px-3 py-3 text-right text-xs font-semibold text-cyan-700 border-b">매출</th>
                        </tr>
                      </thead>
                      <tbody>
                        {doctorStats.map((stat, idx) => (
                          <tr key={stat.doctor} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="px-3 py-2 text-sm font-medium text-gray-900">{stat.doctor}</td>
                            <td className="px-3 py-2 text-center text-sm text-blue-600">{stat.chuna.insurance_simple}</td>
                            <td className="px-3 py-2 text-center text-sm text-blue-600">{stat.chuna.insurance_complex}</td>
                            <td className="px-3 py-2 text-center text-sm text-orange-600">{stat.chuna.jabo}</td>
                            <td className="px-3 py-2 text-center text-sm text-purple-600">{stat.chuna.uncovered}</td>
                            <td className="px-3 py-2 text-center text-sm font-bold text-gray-800 bg-gray-100">{stat.chuna.total}</td>
                            <td className="px-3 py-2 text-center text-sm text-green-600 font-semibold">
                              {(stat.work_days || 0) > 0 ? (stat.chuna.total / stat.work_days!).toFixed(1) : '-'}
                            </td>
                            <td className="px-3 py-2 text-right text-sm text-cyan-600">{formatMoney(stat.revenue.chuna_revenue)}</td>
                          </tr>
                        ))}
                        <tr className="bg-blue-50 border-t-2 border-blue-200">
                          <td className="px-3 py-2 text-sm font-bold text-blue-800">전체</td>
                          <td className="px-3 py-2 text-center text-sm text-blue-800 font-bold">{totalStats.chuna.insurance_simple}</td>
                          <td className="px-3 py-2 text-center text-sm text-blue-800 font-bold">{totalStats.chuna.insurance_complex}</td>
                          <td className="px-3 py-2 text-center text-sm text-blue-800 font-bold">{totalStats.chuna.jabo}</td>
                          <td className="px-3 py-2 text-center text-sm text-blue-800 font-bold">{totalStats.chuna.uncovered}</td>
                          <td className="px-3 py-2 text-center text-sm font-bold text-blue-900 bg-blue-100">{totalStats.chuna.total}</td>
                          <td className="px-3 py-2 text-center text-sm text-green-700 font-bold">
                            {dateRange.workDays > 0 ? (totalStats.chuna.total / dateRange.workDays).toFixed(1) : '-'}
                          </td>
                          <td className="px-3 py-2 text-right text-sm font-bold text-cyan-800">{formatMoney(totalStats.revenue.chuna_revenue)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 예약 현황 */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                    <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                      <span>📅</span> 예약 현황
                    </h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 border-b">원장</th>
                          <th className="px-3 py-3 text-center text-xs font-semibold text-gray-700 border-b">침환자</th>
                          <th className="px-3 py-3 text-center text-xs font-semibold text-blue-700 border-b">예약</th>
                          <th className="px-3 py-3 text-center text-xs font-semibold text-blue-700 border-b">예약율</th>
                          <th className="px-3 py-3 text-center text-xs font-semibold text-green-700 border-b">현장</th>
                          <th className="px-3 py-3 text-center text-xs font-semibold text-green-700 border-b">현장율</th>
                        </tr>
                      </thead>
                      <tbody>
                        {doctorStats.map((stat, idx) => (
                          <tr key={stat.doctor} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="px-3 py-2 text-sm font-medium text-gray-900">{stat.doctor}</td>
                            <td className="px-3 py-2 text-center text-sm text-gray-600">{stat.reservations.total_chim_patients}</td>
                            <td className="px-3 py-2 text-center text-sm text-blue-600">{stat.reservations.reserved_count}</td>
                            <td className="px-3 py-2 text-center text-sm text-blue-600 font-semibold">{stat.reservations.reservation_rate}%</td>
                            <td className="px-3 py-2 text-center text-sm text-green-600">{stat.reservations.onsite_count}</td>
                            <td className="px-3 py-2 text-center text-sm text-green-600 font-semibold">{stat.reservations.onsite_rate}%</td>
                          </tr>
                        ))}
                        <tr className="bg-blue-50 border-t-2 border-blue-200">
                          <td className="px-3 py-2 text-sm font-bold text-blue-800">전체</td>
                          <td className="px-3 py-2 text-center text-sm text-blue-800 font-bold">{totalStats.reservations.total_chim_patients}</td>
                          <td className="px-3 py-2 text-center text-sm text-blue-800 font-bold">{totalStats.reservations.reserved_count}</td>
                          <td className="px-3 py-2 text-center text-sm text-blue-800 font-bold">{totalStats.reservations.reservation_rate}%</td>
                          <td className="px-3 py-2 text-center text-sm text-blue-800 font-bold">{totalStats.reservations.onsite_count}</td>
                          <td className="px-3 py-2 text-center text-sm text-blue-800 font-bold">{totalStats.reservations.onsite_rate}%</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

            </div>
          </>
        )}

        {/* 약초진 Raw Data 모달 */}
        {yakRawModal.open && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-xl max-w-6xl w-full mx-4 max-h-[85vh] flex flex-col">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-800">
                  {yakRawModal.doctor} - {yakRawModal.categoryLabel}
                  <span className="ml-2 text-sm font-normal text-gray-500">
                    ({yakRawModal.patients.length}명)
                  </span>
                </h3>
                <button
                  onClick={() => setYakRawModal(prev => ({ ...prev, open: false }))}
                  className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
                >
                  ×
                </button>
              </div>
              <div className="overflow-y-auto flex-1">
                {yakRawModal.loading ? (
                  <div className="px-6 py-8 text-center text-gray-500">
                    로딩 중...
                  </div>
                ) : yakRawModal.patients.length === 0 ? (
                  <div className="px-6 py-8 text-center text-gray-400">
                    데이터 없음
                  </div>
                ) : (
                  <table className="w-full">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b">날짜</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b">차트번호</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b">환자명</th>
                        {(!yakRawModal.category || yakRawModal.category === 'yak_saeng_cho') && (
                          <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b">분류</th>
                        )}
                        {(yakRawModal.category === 'referral_same' || yakRawModal.category === 'referral_other' || yakRawModal.category === 'new_direct' || yakRawModal.category === 'yak_saeng_cho' || !yakRawModal.category) && (
                          <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b">소개자/메모</th>
                        )}
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b">항목</th>
                      </tr>
                    </thead>
                    <tbody>
                      {yakRawModal.patients.map((p, idx) => (
                        <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="px-3 py-2 text-sm text-gray-500">{p.date}</td>
                          <td className="px-3 py-2 text-sm text-gray-600">{p.chart_no}</td>
                          <td className="px-3 py-2 text-sm font-medium text-gray-900">{p.patient_name}</td>
                          {(!yakRawModal.category || yakRawModal.category === 'yak_saeng_cho') && (
                            <td className="px-3 py-2 text-sm text-gray-500">{categoryLabels[p.category] || p.category}</td>
                          )}
                          {(yakRawModal.category === 'referral_same' || yakRawModal.category === 'referral_other' || yakRawModal.category === 'new_direct' || yakRawModal.category === 'yak_saeng_cho' || !yakRawModal.category) && (
                            <td className="px-3 py-2 text-sm text-gray-500">
                              {p.referrer ? (
                                p.referrer.name ? (
                                  <span>
                                    {p.referrer.name}({p.referrer.chart_no})
                                    <span className="text-xs text-gray-400 ml-1">
                                      담당:{p.referrer.main_doctor || '없음'}
                                    </span>
                                    {p.referrer.cust_url && (
                                      <span className="block text-xs text-blue-500">{p.referrer.cust_url}</span>
                                    )}
                                  </span>
                                ) : p.referrer.suggest ? (
                                  <span>
                                    <span className="text-green-600">{p.referrer.suggest}</span>
                                    {p.referrer.cust_url && (
                                      <span className="text-blue-500 ml-1">({p.referrer.cust_url})</span>
                                    )}
                                  </span>
                                ) : p.referrer.cust_url ? (
                                  <span className="text-blue-500">{p.referrer.cust_url}</span>
                                ) : p.referrer.chart_no ? (
                                  <span className="text-gray-400">({p.referrer.chart_no}) 조회불가</span>
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                          )}
                          <td className="px-3 py-2 text-sm text-purple-600" title={p.items}>{p.items || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              <div className="px-6 py-3 border-t border-gray-200 flex justify-end">
                <button
                  onClick={() => setYakRawModal(prev => ({ ...prev, open: false }))}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default StatisticsApp;
