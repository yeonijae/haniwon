import { useState, useEffect } from 'react';
import type { PortalUser } from '@shared/types';

const API_BASE = 'http://192.168.0.173:3100';

interface PatientsData {
  period: string;
  start_date: string;
  end_date: string;
  work_days: number;
  chim_chojin: number;
  chim_rechojin: number;
  jabo_chojin: number;
  jabo_rechojin: number;
  yak_chojin: number;
  yak_rechojin: number;
  avg_chim_daily: number;
}

interface ChunaData {
  period: string;
  start_date: string;
  end_date: string;
  insurance_simple: number;
  insurance_complex: number;
  jabo: number;
  uncovered: number;
}

interface ReservationsData {
  period: string;
  start_date: string;
  end_date: string;
  total_chim_patients: number;
  reserved_count: number;
  reservation_rate: number;
  onsite_count: number;
  onsite_rate: number;
}

interface RevenueData {
  period: string;
  start_date: string;
  end_date: string;
  insurance: number;
  jabo: number;
  uncovered: number;
  total: number;
}

interface StatisticsData {
  period: string;
  start_date: string;
  end_date: string;
  work_days: number;
  patients: {
    chim_chojin: number;
    chim_rechojin: number;
    jabo_chojin: number;
    jabo_rechojin: number;
    yak_chojin: number;
    yak_rechojin: number;
    avg_chim_daily: number;
  };
  chuna: {
    insurance_simple: number;
    insurance_complex: number;
    jabo: number;
    uncovered: number;
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
    jabo: number;
    uncovered: number;
    total: number;
  };
}

interface StatisticsAppProps {
  user: PortalUser;
}

type PeriodType = 'daily' | 'weekly' | 'monthly';

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
  const [data, setData] = useState<StatisticsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStatistics();
  }, [period, selectedDate]);

  async function fetchStatistics() {
    setLoading(true);
    setError(null);
    try {
      // 4개의 개별 API를 병렬로 호출
      const [patientsRes, chunaRes, reservationsRes, revenueRes] = await Promise.all([
        fetch(`${API_BASE}/api/stats/patients?period=${period}&date=${selectedDate}`),
        fetch(`${API_BASE}/api/stats/chuna?period=${period}&date=${selectedDate}`),
        fetch(`${API_BASE}/api/stats/reservations?period=${period}&date=${selectedDate}`),
        fetch(`${API_BASE}/api/stats/revenue?period=${period}&date=${selectedDate}`)
      ]);

      // 응답 체크
      if (!patientsRes.ok || !chunaRes.ok || !reservationsRes.ok || !revenueRes.ok) {
        throw new Error('데이터를 불러오는데 실패했습니다');
      }

      // JSON 파싱
      const [patientsData, chunaData, reservationsData, revenueData] = await Promise.all([
        patientsRes.json() as Promise<PatientsData>,
        chunaRes.json() as Promise<ChunaData>,
        reservationsRes.json() as Promise<ReservationsData>,
        revenueRes.json() as Promise<RevenueData>
      ]);

      // 기존 StatisticsData 형태로 변환
      const result: StatisticsData = {
        period: patientsData.period,
        start_date: patientsData.start_date,
        end_date: patientsData.end_date,
        work_days: patientsData.work_days,
        patients: {
          chim_chojin: patientsData.chim_chojin,
          chim_rechojin: patientsData.chim_rechojin,
          jabo_chojin: patientsData.jabo_chojin,
          jabo_rechojin: patientsData.jabo_rechojin,
          yak_chojin: patientsData.yak_chojin,
          yak_rechojin: patientsData.yak_rechojin,
          avg_chim_daily: patientsData.avg_chim_daily
        },
        chuna: {
          insurance_simple: chunaData.insurance_simple,
          insurance_complex: chunaData.insurance_complex,
          jabo: chunaData.jabo,
          uncovered: chunaData.uncovered
        },
        reservations: {
          total_chim_patients: reservationsData.total_chim_patients,
          reserved_count: reservationsData.reserved_count,
          reservation_rate: reservationsData.reservation_rate,
          onsite_count: reservationsData.onsite_count,
          onsite_rate: reservationsData.onsite_rate
        },
        revenue: {
          insurance: revenueData.insurance,
          jabo: revenueData.jabo,
          uncovered: revenueData.uncovered,
          total: revenueData.total
        }
      };

      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류');
    } finally {
      setLoading(false);
    }
  }

  function getPeriodLabel(): string {
    if (!data) return '';
    if (period === 'daily') return data.start_date;
    return `${data.start_date} ~ ${data.end_date}`;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-2xl">📊</span>
            <div>
              <h1 className="text-xl font-bold text-gray-800">통계 대시보드</h1>
              <p className="text-sm text-gray-500">연이재한의원 운영 통계</p>
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
            {/* Date Picker */}
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={fetchStatistics}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? '조회중...' : '조회'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {loading && !data && (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}

        {data && (
          <>
            {/* Period Label */}
            <div className="mb-6 text-center">
              <span className="inline-block px-4 py-2 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                {getPeriodLabel()} ({data.work_days}영업일)
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 환자 현황 */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <span className="text-xl">👥</span> 환자 현황
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-2 text-sm font-medium text-gray-500"></th>
                        <th className="text-center py-2 text-sm font-medium text-gray-500">침환자</th>
                        <th className="text-center py-2 text-sm font-medium text-gray-500">자보환자</th>
                        <th className="text-center py-2 text-sm font-medium text-gray-500">약환자</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-gray-100">
                        <td className="py-3 text-sm text-gray-600">초진</td>
                        <td className="py-3 text-center">
                          <span className="text-lg font-bold text-blue-600">{data.patients.chim_chojin}</span>
                          <span className="text-sm text-gray-500">명</span>
                        </td>
                        <td className="py-3 text-center">
                          <span className="text-lg font-bold text-orange-600">{data.patients.jabo_chojin}</span>
                          <span className="text-sm text-gray-500">명</span>
                        </td>
                        <td className="py-3 text-center">
                          <span className="text-lg font-bold text-green-600">{data.patients.yak_chojin}</span>
                          <span className="text-sm text-gray-500">명</span>
                        </td>
                      </tr>
                      <tr>
                        <td className="py-3 text-sm text-gray-600">재초진</td>
                        <td className="py-3 text-center">
                          <span className="text-lg font-bold text-blue-600">{data.patients.chim_rechojin}</span>
                          <span className="text-sm text-gray-500">명</span>
                        </td>
                        <td className="py-3 text-center">
                          <span className="text-lg font-bold text-orange-600">{data.patients.jabo_rechojin}</span>
                          <span className="text-sm text-gray-500">명</span>
                        </td>
                        <td className="py-3 text-center">
                          <span className="text-lg font-bold text-green-600">{data.patients.yak_rechojin}</span>
                          <span className="text-sm text-gray-500">명</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">일평균 침환자</span>
                    <span className="text-xl font-bold text-blue-600">{data.patients.avg_chim_daily}명</span>
                  </div>
                </div>
              </div>

              {/* 추나 현황 */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <span className="text-xl">💪</span> 추나 현황
                </h2>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-blue-50 rounded-lg p-4">
                    <div className="text-sm text-blue-600 font-medium mb-1">건보 단순추나</div>
                    <div className="text-2xl font-bold text-blue-700">{data.chuna.insurance_simple}회</div>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-4">
                    <div className="text-sm text-blue-600 font-medium mb-1">건보 복잡추나</div>
                    <div className="text-2xl font-bold text-blue-700">{data.chuna.insurance_complex}회</div>
                  </div>
                  <div className="bg-orange-50 rounded-lg p-4">
                    <div className="text-sm text-orange-600 font-medium mb-1">자보 추나</div>
                    <div className="text-2xl font-bold text-orange-700">{data.chuna.jabo}회</div>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-4">
                    <div className="text-sm text-purple-600 font-medium mb-1">비급여 추나</div>
                    <div className="text-2xl font-bold text-purple-700">{data.chuna.uncovered}회</div>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">총 추나</span>
                    <span className="text-xl font-bold text-gray-800">
                      {data.chuna.insurance_simple + data.chuna.insurance_complex + data.chuna.jabo + data.chuna.uncovered}회
                    </span>
                  </div>
                </div>
              </div>

              {/* 예약 현황 */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <span className="text-xl">📅</span> 예약 현황
                </h2>
                <div className="space-y-4">
                  {/* 예약율 */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-600">예약율</span>
                      <span className="text-sm font-medium text-gray-800">
                        {data.reservations.reserved_count}/{data.reservations.total_chim_patients}명
                      </span>
                    </div>
                    <div className="relative h-8 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full"
                        style={{ width: `${Math.min(data.reservations.reservation_rate, 100)}%` }}
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-sm font-bold text-white drop-shadow">
                          {data.reservations.reservation_rate}%
                        </span>
                      </div>
                    </div>
                  </div>
                  {/* 현장예약율 */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-600">현장예약율</span>
                      <span className="text-sm font-medium text-gray-800">
                        {data.reservations.onsite_count}/{data.reservations.total_chim_patients}명
                      </span>
                    </div>
                    <div className="relative h-8 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="absolute inset-y-0 left-0 bg-gradient-to-r from-green-500 to-green-600 rounded-full"
                        style={{ width: `${Math.min(data.reservations.onsite_rate, 100)}%` }}
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-sm font-bold text-white drop-shadow">
                          {data.reservations.onsite_rate}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-200 text-xs text-gray-500">
                  * 침환자 기준 (자보 + 건보청구 환자)
                </div>
              </div>

              {/* 매출 현황 */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <span className="text-xl">💰</span> 매출 현황
                </h2>
                <div className="space-y-3">
                  {/* 급여매출 */}
                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                    <span className="text-sm text-blue-700 font-medium">급여매출</span>
                    <div className="text-right">
                      <div className="text-lg font-bold text-blue-700">{formatMoney(data.revenue.insurance)}원</div>
                      <div className="text-xs text-blue-500">
                        {data.revenue.total > 0 ? ((data.revenue.insurance / data.revenue.total) * 100).toFixed(1) : 0}%
                      </div>
                    </div>
                  </div>
                  {/* 자보매출 */}
                  <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                    <span className="text-sm text-orange-700 font-medium">자보매출</span>
                    <div className="text-right">
                      <div className="text-lg font-bold text-orange-700">{formatMoney(data.revenue.jabo)}원</div>
                      <div className="text-xs text-orange-500">
                        {data.revenue.total > 0 ? ((data.revenue.jabo / data.revenue.total) * 100).toFixed(1) : 0}%
                      </div>
                    </div>
                  </div>
                  {/* 비급여매출 */}
                  <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                    <span className="text-sm text-purple-700 font-medium">비급여매출</span>
                    <div className="text-right">
                      <div className="text-lg font-bold text-purple-700">{formatMoney(data.revenue.uncovered)}원</div>
                      <div className="text-xs text-purple-500">
                        {data.revenue.total > 0 ? ((data.revenue.uncovered / data.revenue.total) * 100).toFixed(1) : 0}%
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 font-medium">총 매출</span>
                    <span className="text-2xl font-bold text-gray-800">{formatMoney(data.revenue.total)}원</span>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default StatisticsApp;
