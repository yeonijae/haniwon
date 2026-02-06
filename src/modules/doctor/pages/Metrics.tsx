/**
 * 지표관리 페이지
 * 초진수, 재진율, 삼진율, 이탈율, 객단가 지표 관리
 */

import { useState, useEffect, useMemo } from 'react';
import {
  getChoojinList,
  getRevisitRate,
  getRevenuePerPatient,
  formatNumber,
  formatPercent,
  getISOWeek,
  getWeekDates,
  type ChoojinListResponse,
  type RevisitRateResponse,
  type RevenuePerPatientResponse,
} from '../api/metricsApi';

type TabType = 'overview' | 'choojin' | 'revisit' | 'revenue' | 'weekly' | 'compare';

// 주차 선택용 유틸
function getWeekOptions() {
  const options: { year: number; week: number; label: string }[] = [];
  const today = new Date();
  const currentWeek = getISOWeek(today);

  // 현재 주부터 12주 전까지
  for (let i = 0; i < 12; i++) {
    let y = currentWeek.year;
    let w = currentWeek.week - i;
    if (w < 1) {
      y -= 1;
      w += 52;
    }
    const dates = getWeekDates(y, w);
    const label = `${y}년 ${w}주차 (${dates.start.getMonth() + 1}/${dates.start.getDate()} ~ ${dates.end.getMonth() + 1}/${dates.end.getDate()})`;
    options.push({ year: y, week: w, label });
  }
  return options;
}

// 날짜 포맷
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

// 메트릭 카드 컴포넌트
function MetricCard({
  title,
  value,
  subValue,
  icon,
  color = 'blue',
}: {
  title: string;
  value: string | number;
  subValue?: string;
  icon: string;
  color?: 'blue' | 'green' | 'orange' | 'red' | 'purple';
}) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    orange: 'bg-orange-50 text-orange-600',
    red: 'bg-red-50 text-red-600',
    purple: 'bg-purple-50 text-purple-600',
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorClasses[color]}`}>
          <i className={`fas ${icon}`}></i>
        </div>
        <div>
          <p className="text-xs text-gray-500">{title}</p>
          <p className="text-lg font-bold text-gray-800">{value}</p>
          {subValue && <p className="text-xs text-gray-400">{subValue}</p>}
        </div>
      </div>
    </div>
  );
}

// 주차 선택 props 타입
interface WeekOption {
  year: number;
  week: number;
  label: string;
}

// 종합 탭
function OverviewTab({ selectedWeek }: { selectedWeek: WeekOption }) {
  const [loading, setLoading] = useState(true);
  const [choojinData, setChoojinData] = useState<ChoojinListResponse['data'] | null>(null);
  const [revisitData, setRevisitData] = useState<RevisitRateResponse['data'] | null>(null);
  const [revenueData, setRevenueData] = useState<RevenuePerPatientResponse['data'] | null>(null);

  useEffect(() => {
    loadData();
  }, [selectedWeek]);

  async function loadData() {
    setLoading(true);
    try {
      const dates = getWeekDates(selectedWeek.year, selectedWeek.week);
      const startDate = formatDate(dates.start);
      const endDate = formatDate(dates.end);

      const [choojinRes, revisitRes, revenueRes] = await Promise.all([
        getChoojinList({ start_date: startDate, end_date: endDate }),
        getRevisitRate({ start_date: startDate, end_date: endDate }),
        getRevenuePerPatient({ start_date: startDate, end_date: endDate }),
      ]);

      if (choojinRes.success) setChoojinData(choojinRes.data);
      if (revisitRes.success) setRevisitData(revisitRes.data);
      if (revenueRes.success) setRevenueData(revenueRes.data);
    } catch (error) {
      console.error('지표 데이터 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <i className="fas fa-spinner fa-spin text-2xl text-gray-400"></i>
      </div>
    );
  }

  const summary = choojinData?.summary;
  const overall = revisitData?.overall;
  const revenue = revenueData?.overall;

  return (
    <div className="space-y-6">
      {/* 초진수 요약 */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          <i className="fas fa-user-plus mr-2 text-clinic-primary"></i>
          초진수
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          <MetricCard
            title="총 초진"
            value={formatNumber(summary?.total || 0)}
            icon="fa-users"
            color="blue"
          />
          <MetricCard
            title="침 신규"
            value={formatNumber(summary?.by_type?.chim_new || 0)}
            icon="fa-plus"
            color="green"
          />
          <MetricCard
            title="침 재초진"
            value={formatNumber(summary?.by_type?.chim_re || 0)}
            icon="fa-redo"
            color="green"
          />
          <MetricCard
            title="자보 신규"
            value={formatNumber(summary?.by_type?.jabo_new || 0)}
            icon="fa-car"
            color="orange"
          />
          <MetricCard
            title="자보 재초진"
            value={formatNumber(summary?.by_type?.jabo_re || 0)}
            icon="fa-car"
            color="orange"
          />
          <MetricCard
            title="약 신규"
            value={formatNumber(summary?.by_type?.yak_new || 0)}
            icon="fa-pills"
            color="purple"
          />
          <MetricCard
            title="약 재초진"
            value={formatNumber(summary?.by_type?.yak_re || 0)}
            icon="fa-pills"
            color="purple"
          />
        </div>
      </div>

      {/* 재진율/삼진율/이탈율 */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          <i className="fas fa-chart-line mr-2 text-clinic-primary"></i>
          재진율 / 삼진율 / 이탈율
          {overall && overall.pending_count > 0 && (
            <span className="ml-2 text-xs text-orange-500 font-normal">
              (추적 대기: {overall.pending_count}명)
            </span>
          )}
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard
            title="추적 완료"
            value={formatNumber(overall?.tracking_completed_count || 0)}
            subValue={`총 ${formatNumber(overall?.total_choojin || 0)}명 중`}
            icon="fa-check-circle"
            color="blue"
          />
          <MetricCard
            title="재진율"
            value={formatPercent(overall?.rejin_rate || 0)}
            subValue={`${formatNumber(overall?.rejin_count || 0)}명 재진`}
            icon="fa-user-check"
            color="green"
          />
          <MetricCard
            title="삼진율"
            value={formatPercent(overall?.samjin_rate || 0)}
            subValue={`${formatNumber(overall?.samjin_count || 0)}명 삼진`}
            icon="fa-award"
            color="purple"
          />
          <MetricCard
            title="이탈율"
            value={formatPercent(overall?.ital_rate || 0)}
            subValue={`${formatNumber(overall?.ital_count || 0)}명 이탈`}
            icon="fa-user-minus"
            color="red"
          />
        </div>
      </div>

      {/* 객단가 */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          <i className="fas fa-won-sign mr-2 text-clinic-primary"></i>
          객단가 (환자당 평균 진료비)
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard
            title="전체"
            value={`${formatNumber(Math.round(revenue?.total?.avg_per_patient || 0))}원`}
            subValue={`${formatNumber(revenue?.total?.patient_count || 0)}명`}
            icon="fa-calculator"
            color="blue"
          />
          <MetricCard
            title="급여"
            value={`${formatNumber(Math.round(revenue?.insurance?.avg_per_patient || 0))}원`}
            subValue={`${formatNumber(revenue?.insurance?.patient_count || 0)}명`}
            icon="fa-hospital"
            color="green"
          />
          <MetricCard
            title="자보"
            value={`${formatNumber(Math.round(revenue?.jabo?.avg_per_patient || 0))}원`}
            subValue={`${formatNumber(revenue?.jabo?.patient_count || 0)}명`}
            icon="fa-car"
            color="orange"
          />
          <MetricCard
            title="비급여"
            value={`${formatNumber(Math.round(revenue?.uncovered?.avg_per_patient || 0))}원`}
            subValue={`${formatNumber(revenue?.uncovered?.patient_count || 0)}명`}
            icon="fa-hand-holding-usd"
            color="purple"
          />
        </div>
      </div>

      {/* 원장별 요약 */}
      {summary?.by_doctor && Object.keys(summary.by_doctor).length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            <i className="fas fa-user-md mr-2 text-clinic-primary"></i>
            원장별 초진수
          </h3>
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-gray-600 font-medium">원장</th>
                  <th className="px-4 py-3 text-center text-gray-600 font-medium">총 초진</th>
                  <th className="px-4 py-3 text-center text-gray-600 font-medium">침 신규</th>
                  <th className="px-4 py-3 text-center text-gray-600 font-medium">침 재</th>
                  <th className="px-4 py-3 text-center text-gray-600 font-medium">자보 신규</th>
                  <th className="px-4 py-3 text-center text-gray-600 font-medium">자보 재</th>
                  <th className="px-4 py-3 text-center text-gray-600 font-medium">약 신규</th>
                  <th className="px-4 py-3 text-center text-gray-600 font-medium">약 재</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {Object.entries(summary.by_doctor).map(([doctorId, data]) => (
                  <tr key={doctorId} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{data.doctor_name}</td>
                    <td className="px-4 py-3 text-center font-semibold text-clinic-primary">
                      {formatNumber(data.total)}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-600">{data.chim_new}</td>
                    <td className="px-4 py-3 text-center text-gray-600">{data.chim_re}</td>
                    <td className="px-4 py-3 text-center text-gray-600">{data.jabo_new}</td>
                    <td className="px-4 py-3 text-center text-gray-600">{data.jabo_re}</td>
                    <td className="px-4 py-3 text-center text-gray-600">{data.yak_new}</td>
                    <td className="px-4 py-3 text-center text-gray-600">{data.yak_re}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// 초진분석 탭
function ChoojinTab({ selectedWeek }: { selectedWeek: WeekOption }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ChoojinListResponse['data'] | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'chim' | 'jabo' | 'yak'>('all');

  useEffect(() => {
    loadData();
  }, [selectedWeek, filterType]);

  async function loadData() {
    setLoading(true);
    try {
      const dates = getWeekDates(selectedWeek.year, selectedWeek.week);
      const res = await getChoojinList({
        start_date: formatDate(dates.start),
        end_date: formatDate(dates.end),
        type: filterType === 'all' ? undefined : filterType,
      });
      if (res.success) setData(res.data);
    } catch (error) {
      console.error('초진 데이터 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  }

  const typeLabel = {
    chim: '침',
    jabo: '자보',
    yak: '약',
  };

  const subTypeLabel = {
    new: '신규',
    re: '재초진',
  };

  return (
    <div className="space-y-4">
      {/* 유형 필터 */}
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-gray-600">유형:</label>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as typeof filterType)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-clinic-primary"
        >
          <option value="all">전체</option>
          <option value="chim">침환자</option>
          <option value="jabo">자보환자</option>
          <option value="yak">약환자</option>
        </select>
      </div>

      {/* 요약 카드 */}
      {data?.summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          <MetricCard title="총 초진" value={data.summary.total} icon="fa-users" color="blue" />
          <MetricCard title="침 신규" value={data.summary.by_type.chim_new} icon="fa-plus" color="green" />
          <MetricCard title="침 재초진" value={data.summary.by_type.chim_re} icon="fa-redo" color="green" />
          <MetricCard title="자보 신규" value={data.summary.by_type.jabo_new} icon="fa-car" color="orange" />
          <MetricCard title="자보 재초진" value={data.summary.by_type.jabo_re} icon="fa-car" color="orange" />
          <MetricCard title="약 신규" value={data.summary.by_type.yak_new} icon="fa-pills" color="purple" />
          <MetricCard title="약 재초진" value={data.summary.by_type.yak_re} icon="fa-pills" color="purple" />
        </div>
      )}

      {/* 초진 환자 목록 */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800">
            초진 환자 목록 ({data?.choojin_list?.length || 0}명)
          </h3>
        </div>
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <i className="fas fa-spinner fa-spin text-gray-400"></i>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-gray-600 font-medium">초진일</th>
                  <th className="px-4 py-3 text-left text-gray-600 font-medium">차트번호</th>
                  <th className="px-4 py-3 text-left text-gray-600 font-medium">환자명</th>
                  <th className="px-4 py-3 text-center text-gray-600 font-medium">유형</th>
                  <th className="px-4 py-3 text-center text-gray-600 font-medium">구분</th>
                  <th className="px-4 py-3 text-center text-gray-600 font-medium">보험</th>
                  <th className="px-4 py-3 text-left text-gray-600 font-medium">담당의</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data?.choojin_list?.map((patient, idx) => (
                  <tr key={`${patient.customer_pk}-${idx}`} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-600">{patient.choojin_date}</td>
                    <td className="px-4 py-3 font-mono text-gray-800">{patient.chart_no}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{patient.patient_name}</td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          patient.choojin_type === 'chim'
                            ? 'bg-green-100 text-green-700'
                            : patient.choojin_type === 'jabo'
                            ? 'bg-orange-100 text-orange-700'
                            : 'bg-purple-100 text-purple-700'
                        }`}
                      >
                        {typeLabel[patient.choojin_type]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`px-2 py-1 rounded-full text-xs ${
                          patient.choojin_sub_type === 'new'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {subTypeLabel[patient.choojin_sub_type]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-600">{patient.insurance_type}</td>
                    <td className="px-4 py-3 text-gray-600">{patient.doctor_name}</td>
                  </tr>
                ))}
                {(!data?.choojin_list || data.choojin_list.length === 0) && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                      해당 기간에 초진 환자가 없습니다
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// 재진율 탭
function RevisitTab({ selectedWeek }: { selectedWeek: WeekOption }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<RevisitRateResponse['data'] | null>(null);

  useEffect(() => {
    loadData();
  }, [selectedWeek]);

  async function loadData() {
    setLoading(true);
    try {
      const dates = getWeekDates(selectedWeek.year, selectedWeek.week);
      const res = await getRevisitRate({
        start_date: formatDate(dates.start),
        end_date: formatDate(dates.end),
      });
      if (res.success) setData(res.data);
    } catch (error) {
      console.error('재진율 데이터 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  }

  const overall = data?.overall;

  return (
    <div className="space-y-6">
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <i className="fas fa-spinner fa-spin text-2xl text-gray-400"></i>
        </div>
      ) : (
        <>
          {/* 전체 요약 */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <MetricCard
              title="총 초진"
              value={formatNumber(overall?.total_choojin || 0)}
              icon="fa-user-plus"
              color="blue"
            />
            <MetricCard
              title="재진 (2회+)"
              value={formatNumber(overall?.rejin_count || 0)}
              subValue={formatPercent(overall?.rejin_rate || 0)}
              icon="fa-user-check"
              color="green"
            />
            <MetricCard
              title="삼진 (3회+)"
              value={formatNumber(overall?.samjin_count || 0)}
              subValue={formatPercent(overall?.samjin_rate || 0)}
              icon="fa-award"
              color="purple"
            />
            <MetricCard
              title="이탈 (1회)"
              value={formatNumber(overall?.ital_count || 0)}
              subValue={formatPercent(overall?.ital_rate || 0)}
              icon="fa-user-minus"
              color="red"
            />
            <MetricCard
              title="추적 대기"
              value={formatNumber(overall?.pending_count || 0)}
              subValue="아직 21일 미경과"
              icon="fa-clock"
              color="orange"
            />
          </div>

          {/* 유형별 */}
          {data?.by_type && Object.keys(data.by_type).length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">유형별 재진율</h3>
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-gray-600 font-medium">유형</th>
                      <th className="px-4 py-3 text-center text-gray-600 font-medium">총 초진</th>
                      <th className="px-4 py-3 text-center text-gray-600 font-medium">재진율</th>
                      <th className="px-4 py-3 text-center text-gray-600 font-medium">삼진율</th>
                      <th className="px-4 py-3 text-center text-gray-600 font-medium">이탈율</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {Object.entries(data.by_type).map(([type, stats]) => (
                      <tr key={type} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-800">
                          {type === 'chim' ? '침환자' : type === 'jabo' ? '자보환자' : '약환자'}
                        </td>
                        <td className="px-4 py-3 text-center">{formatNumber(stats.total_choojin)}</td>
                        <td className="px-4 py-3 text-center text-green-600 font-medium">
                          {formatPercent(stats.rejin_rate)}
                        </td>
                        <td className="px-4 py-3 text-center text-purple-600 font-medium">
                          {formatPercent(stats.samjin_rate)}
                        </td>
                        <td className="px-4 py-3 text-center text-red-600 font-medium">
                          {formatPercent(stats.ital_rate)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 원장별 */}
          {data?.by_doctor && Object.keys(data.by_doctor).length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">원장별 재진율</h3>
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-gray-600 font-medium">원장</th>
                      <th className="px-4 py-3 text-center text-gray-600 font-medium">총 초진</th>
                      <th className="px-4 py-3 text-center text-gray-600 font-medium">재진</th>
                      <th className="px-4 py-3 text-center text-gray-600 font-medium">재진율</th>
                      <th className="px-4 py-3 text-center text-gray-600 font-medium">삼진</th>
                      <th className="px-4 py-3 text-center text-gray-600 font-medium">삼진율</th>
                      <th className="px-4 py-3 text-center text-gray-600 font-medium">이탈</th>
                      <th className="px-4 py-3 text-center text-gray-600 font-medium">이탈율</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {Object.entries(data.by_doctor).map(([doctorId, stats]) => (
                      <tr key={doctorId} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-800">{stats.doctor_name}</td>
                        <td className="px-4 py-3 text-center">{formatNumber(stats.total_choojin)}</td>
                        <td className="px-4 py-3 text-center">{formatNumber(stats.rejin_count)}</td>
                        <td className="px-4 py-3 text-center text-green-600 font-medium">
                          {formatPercent(stats.rejin_rate)}
                        </td>
                        <td className="px-4 py-3 text-center">{formatNumber(stats.samjin_count)}</td>
                        <td className="px-4 py-3 text-center text-purple-600 font-medium">
                          {formatPercent(stats.samjin_rate)}
                        </td>
                        <td className="px-4 py-3 text-center">{formatNumber(stats.ital_count)}</td>
                        <td className="px-4 py-3 text-center text-red-600 font-medium">
                          {formatPercent(stats.ital_rate)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// 객단가 탭
function RevenueTab({ selectedWeek }: { selectedWeek: WeekOption }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<RevenuePerPatientResponse['data'] | null>(null);

  useEffect(() => {
    loadData();
  }, [selectedWeek]);

  async function loadData() {
    setLoading(true);
    try {
      const dates = getWeekDates(selectedWeek.year, selectedWeek.week);
      const res = await getRevenuePerPatient({
        start_date: formatDate(dates.start),
        end_date: formatDate(dates.end),
      });
      if (res.success) setData(res.data);
    } catch (error) {
      console.error('객단가 데이터 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  }

  const overall = data?.overall;

  return (
    <div className="space-y-6">
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <i className="fas fa-spinner fa-spin text-2xl text-gray-400"></i>
        </div>
      ) : (
        <>
          {/* 전체 요약 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-medium text-gray-500">전체</span>
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                  <i className="fas fa-calculator text-blue-600"></i>
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-800">
                {formatNumber(Math.round(overall?.total?.avg_per_patient || 0))}원
              </p>
              <div className="mt-2 text-xs text-gray-500">
                <span>총 {formatNumber(overall?.total?.total_revenue || 0)}원</span>
                <span className="mx-1">/</span>
                <span>{formatNumber(overall?.total?.patient_count || 0)}명</span>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-medium text-gray-500">급여</span>
                <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
                  <i className="fas fa-hospital text-green-600"></i>
                </div>
              </div>
              <p className="text-2xl font-bold text-green-600">
                {formatNumber(Math.round(overall?.insurance?.avg_per_patient || 0))}원
              </p>
              <div className="mt-2 text-xs text-gray-500">
                <span>총 {formatNumber(overall?.insurance?.total_revenue || 0)}원</span>
                <span className="mx-1">/</span>
                <span>{formatNumber(overall?.insurance?.patient_count || 0)}명</span>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-medium text-gray-500">자보</span>
                <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center">
                  <i className="fas fa-car text-orange-600"></i>
                </div>
              </div>
              <p className="text-2xl font-bold text-orange-600">
                {formatNumber(Math.round(overall?.jabo?.avg_per_patient || 0))}원
              </p>
              <div className="mt-2 text-xs text-gray-500">
                <span>총 {formatNumber(overall?.jabo?.total_revenue || 0)}원</span>
                <span className="mx-1">/</span>
                <span>{formatNumber(overall?.jabo?.patient_count || 0)}명</span>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-medium text-gray-500">비급여</span>
                <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
                  <i className="fas fa-hand-holding-usd text-purple-600"></i>
                </div>
              </div>
              <p className="text-2xl font-bold text-purple-600">
                {formatNumber(Math.round(overall?.uncovered?.avg_per_patient || 0))}원
              </p>
              <div className="mt-2 text-xs text-gray-500">
                <span>총 {formatNumber(overall?.uncovered?.total_revenue || 0)}원</span>
                <span className="mx-1">/</span>
                <span>{formatNumber(overall?.uncovered?.patient_count || 0)}명</span>
              </div>
            </div>
          </div>

          {/* 원장별 */}
          {data?.by_doctor && Object.keys(data.by_doctor).length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">원장별 객단가</h3>
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-gray-600 font-medium">원장</th>
                      <th className="px-4 py-3 text-right text-gray-600 font-medium">전체</th>
                      <th className="px-4 py-3 text-right text-gray-600 font-medium">급여</th>
                      <th className="px-4 py-3 text-right text-gray-600 font-medium">자보</th>
                      <th className="px-4 py-3 text-right text-gray-600 font-medium">비급여</th>
                      <th className="px-4 py-3 text-right text-gray-600 font-medium">총 환자</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {Object.entries(data.by_doctor).map(([doctorId, stats]) => (
                      <tr key={doctorId} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-800">{stats.doctor_name}</td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-800">
                          {formatNumber(Math.round(stats.total?.avg_per_patient || 0))}원
                        </td>
                        <td className="px-4 py-3 text-right text-green-600">
                          {formatNumber(Math.round(stats.insurance?.avg_per_patient || 0))}원
                        </td>
                        <td className="px-4 py-3 text-right text-orange-600">
                          {formatNumber(Math.round(stats.jabo?.avg_per_patient || 0))}원
                        </td>
                        <td className="px-4 py-3 text-right text-purple-600">
                          {formatNumber(Math.round(stats.uncovered?.avg_per_patient || 0))}원
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600">
                          {formatNumber(stats.total?.patient_count || 0)}명
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// 대표원장 (비교에서 제외)
const EXCLUDED_DOCTOR = '김대현';

// 주차별 추이 탭 뷰 모드
type WeeklyViewMode = 'total' | 'by_doctor';

// 원장별 주차 데이터 타입
interface DoctorWeeklyData {
  choojin: { total: number; chim_new: number; chim_re: number; jabo_new: number; jabo_re: number; yak_new: number; yak_re: number };
  revisit: { total_choojin: number; rejin_rate: number; samjin_rate: number; ital_rate: number };
  revenue: {
    total: number;
    avg_per_patient: number;
    insurance: number;
    insurance_pain_uncovered: number;  // 건보환자 통증비급여
    insurance_daily_count: number;  // 건보 연인원
    insurance_avg: number;  // 건보 객단가
    jabo: number;
    jabo_daily_count: number;  // 자보 연인원
    jabo_avg: number;  // 자보 객단가
    uncovered: number;
    insurance_patients: number;
    jabo_patients: number;
    total_patients: number;
    work_days: number;
    daily_visit_count: number;
  };
}

// 주차별 추이 탭 (16주)
function WeeklyTrendTab() {
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<WeeklyViewMode>('total');
  const [selectedDoctor, setSelectedDoctor] = useState<string>('');

  const [weeklyData, setWeeklyData] = useState<{
    week: { year: number; week: number; label: string; startDate: string; endDate: string };
    choojin: { total: number; chim_new: number; chim_re: number; jabo_new: number; jabo_re: number; yak_new: number; yak_re: number };
    revisit: { total_choojin: number; rejin_rate: number; samjin_rate: number; ital_rate: number };
    revenue: { total: number; avg_per_patient: number; insurance: number; jabo: number; uncovered: number; insurance_patients: number; jabo_patients: number; total_patients: number; work_days: number; daily_visit_count: number };
    byDoctor: Record<string, DoctorWeeklyData>;
  }[]>([]);

  // 원장 목록 (김대현 제외)
  const doctorList = useMemo(() => {
    const doctors = new Set<string>();
    weeklyData.forEach((data) => {
      Object.keys(data.byDoctor).forEach((name) => {
        if (name !== EXCLUDED_DOCTOR) {
          doctors.add(name);
        }
      });
    });
    return Array.from(doctors).sort();
  }, [weeklyData]);

  // 16주 옵션 생성
  const weeks16 = useMemo(() => {
    const options: { year: number; week: number; label: string; startDate: string; endDate: string }[] = [];
    const today = new Date();
    const currentWeek = getISOWeek(today);

    for (let i = 0; i < 16; i++) {
      let y = currentWeek.year;
      let w = currentWeek.week - i;
      if (w < 1) {
        y -= 1;
        w += 52;
      }
      const dates = getWeekDates(y, w);
      const label = `${w}주`;
      options.push({
        year: y,
        week: w,
        label,
        startDate: formatDate(dates.start),
        endDate: formatDate(dates.end),
      });
    }
    return options;
  }, []);

  useEffect(() => {
    loadAllWeeksData();
  }, []);

  // 첫 번째 원장 자동 선택
  useEffect(() => {
    if (doctorList.length > 0 && !selectedDoctor) {
      setSelectedDoctor(doctorList[0]);
    }
  }, [doctorList, selectedDoctor]);

  async function loadAllWeeksData() {
    setLoading(true);
    try {
      // 16주 데이터를 병렬로 가져오기
      const promises = weeks16.map(async (week) => {
        const [choojinRes, revisitRes, revenueRes] = await Promise.all([
          getChoojinList({ start_date: week.startDate, end_date: week.endDate }),
          getRevisitRate({ start_date: week.startDate, end_date: week.endDate }),
          getRevenuePerPatient({ start_date: week.startDate, end_date: week.endDate }),
        ]);

        // 원장별 데이터 추출
        const byDoctor: Record<string, DoctorWeeklyData> = {};
        const choojinByDoctor = choojinRes.data?.summary?.by_doctor || {};
        const revisitByDoctor = revisitRes.data?.by_doctor || {};
        const revenueByDoctor = revenueRes.data?.by_doctor || {};

        // 모든 원장 목록 수집
        const allDoctors = new Set([
          ...Object.keys(choojinByDoctor),
          ...Object.keys(revisitByDoctor),
          ...Object.keys(revenueByDoctor),
        ]);

        allDoctors.forEach((doctorName) => {
          const choojinDoc = choojinByDoctor[doctorName];
          const revisitDoc = revisitByDoctor[doctorName];
          const revenueDoc = revenueByDoctor[doctorName];

          byDoctor[doctorName] = {
            choojin: {
              total: choojinDoc?.total || 0,
              chim_new: choojinDoc?.chim_new || 0,
              chim_re: choojinDoc?.chim_re || 0,
              jabo_new: choojinDoc?.jabo_new || 0,
              jabo_re: choojinDoc?.jabo_re || 0,
              yak_new: choojinDoc?.yak_new || 0,
              yak_re: choojinDoc?.yak_re || 0,
            },
            revisit: {
              total_choojin: revisitDoc?.total_choojin || 0,
              rejin_rate: revisitDoc?.rejin_rate || 0,
              samjin_rate: revisitDoc?.samjin_rate || 0,
              ital_rate: revisitDoc?.ital_rate || 0,
            },
            revenue: {
              total: revenueDoc?.total?.total_revenue || 0,
              avg_per_patient: revenueDoc?.total?.avg_per_patient || 0,
              insurance: revenueDoc?.insurance?.total_revenue || 0,
              insurance_pain_uncovered: revenueDoc?.insurance?.pain_uncovered || 0,
              insurance_daily_count: revenueDoc?.insurance?.daily_count || 0,
              insurance_avg: revenueDoc?.insurance?.avg_per_patient || 0,
              jabo: revenueDoc?.jabo?.total_revenue || 0,
              jabo_daily_count: revenueDoc?.jabo?.daily_count || 0,
              jabo_avg: revenueDoc?.jabo?.avg_per_patient || 0,
              uncovered: revenueDoc?.uncovered?.total_revenue || 0,
              insurance_patients: revenueDoc?.insurance?.patient_count || 0,
              jabo_patients: revenueDoc?.jabo?.patient_count || 0,
              total_patients: revenueDoc?.total?.patient_count || 0,
              work_days: revenueDoc?.work_days || 0,
              daily_visit_count: revenueDoc?.daily_visit_count || 0,
            },
          };
        });

        return {
          week,
          choojin: {
            total: choojinRes.data?.summary?.total || 0,
            chim_new: choojinRes.data?.summary?.by_type?.chim_new || 0,
            chim_re: choojinRes.data?.summary?.by_type?.chim_re || 0,
            jabo_new: choojinRes.data?.summary?.by_type?.jabo_new || 0,
            jabo_re: choojinRes.data?.summary?.by_type?.jabo_re || 0,
            yak_new: choojinRes.data?.summary?.by_type?.yak_new || 0,
            yak_re: choojinRes.data?.summary?.by_type?.yak_re || 0,
          },
          revisit: {
            total_choojin: revisitRes.data?.overall?.total_choojin || 0,
            rejin_rate: revisitRes.data?.overall?.rejin_rate || 0,
            samjin_rate: revisitRes.data?.overall?.samjin_rate || 0,
            ital_rate: revisitRes.data?.overall?.ital_rate || 0,
          },
          revenue: {
            total: revenueRes.data?.overall?.total?.total_revenue || 0,
            avg_per_patient: revenueRes.data?.overall?.total?.avg_per_patient || 0,
            insurance: revenueRes.data?.overall?.insurance?.total_revenue || 0,
            jabo: revenueRes.data?.overall?.jabo?.total_revenue || 0,
            uncovered: revenueRes.data?.overall?.uncovered?.total_revenue || 0,
            insurance_patients: revenueRes.data?.overall?.insurance?.patient_count || 0,
            jabo_patients: revenueRes.data?.overall?.jabo?.patient_count || 0,
            total_patients: revenueRes.data?.overall?.total?.patient_count || 0,
            work_days: 0, // overall에서는 사용하지 않음
            daily_visit_count: 0, // overall에서는 사용하지 않음
          },
          byDoctor,
        };
      });

      const results = await Promise.all(promises);
      setWeeklyData(results);
    } catch (error) {
      console.error('주차별 데이터 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  }

  // 선택된 원장의 주차별 데이터 추출
  const selectedDoctorData = useMemo(() => {
    if (!selectedDoctor) return [];
    return weeklyData.map((data) => ({
      week: data.week,
      ...data.byDoctor[selectedDoctor] || {
        choojin: { total: 0, chim_new: 0, chim_re: 0, jabo_new: 0, jabo_re: 0, yak_new: 0, yak_re: 0 },
        revisit: { total_choojin: 0, rejin_rate: 0, samjin_rate: 0, ital_rate: 0 },
        revenue: { total: 0, avg_per_patient: 0, insurance: 0, jabo: 0, uncovered: 0, insurance_patients: 0, jabo_patients: 0, total_patients: 0 },
      },
    }));
  }, [weeklyData, selectedDoctor]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <i className="fas fa-spinner fa-spin text-2xl text-gray-400 mb-4"></i>
        <p className="text-gray-500">16주 데이터를 불러오는 중...</p>
      </div>
    );
  }

  // 뷰 모드 선택 버튼
  const ViewModeSelector = () => (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setViewMode('total')}
        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
          viewMode === 'total'
            ? 'bg-clinic-primary text-white'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
      >
        <i className="fas fa-chart-bar mr-2"></i>전체
      </button>
      <button
        onClick={() => setViewMode('by_doctor')}
        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
          viewMode === 'by_doctor'
            ? 'bg-clinic-primary text-white'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
      >
        <i className="fas fa-user-md mr-2"></i>원장별 구분
      </button>
    </div>
  );

  // 전체 테이블 렌더링
  const renderTotalTable = (data: typeof weeklyData, title?: string, highlightFirst = true) => (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100">
        <h3 className="font-semibold text-gray-800">
          <i className="fas fa-calendar-alt text-clinic-primary mr-2"></i>
          {title || '최근 16주 주차별 추이'}
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th rowSpan={2} className="px-3 py-2 text-center text-gray-600 font-medium border-r sticky left-0 bg-gray-50 z-10">주차</th>
              <th rowSpan={2} className="px-3 py-2 text-center text-gray-600 font-medium border-r">기간</th>
              <th colSpan={7} className="px-3 py-2 text-center text-gray-600 font-medium border-b border-r bg-blue-50">초진수</th>
              <th colSpan={4} className="px-3 py-2 text-center text-gray-600 font-medium border-b border-r bg-green-50">재진율/삼진율/이탈율</th>
              <th colSpan={2} className="px-3 py-2 text-center text-gray-600 font-medium border-b bg-orange-50">객단가</th>
            </tr>
            <tr>
              <th className="px-2 py-2 text-center text-xs text-gray-500 font-medium bg-blue-50">전체</th>
              <th className="px-2 py-2 text-center text-xs text-gray-500 font-medium bg-blue-50">침신</th>
              <th className="px-2 py-2 text-center text-xs text-gray-500 font-medium bg-blue-50">침재</th>
              <th className="px-2 py-2 text-center text-xs text-gray-500 font-medium bg-blue-50">자신</th>
              <th className="px-2 py-2 text-center text-xs text-gray-500 font-medium bg-blue-50">자재</th>
              <th className="px-2 py-2 text-center text-xs text-gray-500 font-medium bg-blue-50">약신</th>
              <th className="px-2 py-2 text-center text-xs text-gray-500 font-medium border-r bg-blue-50">약재</th>
              <th className="px-2 py-2 text-center text-xs text-gray-500 font-medium bg-green-50">초진</th>
              <th className="px-2 py-2 text-center text-xs text-gray-500 font-medium bg-green-50">재진율</th>
              <th className="px-2 py-2 text-center text-xs text-gray-500 font-medium bg-green-50">삼진율</th>
              <th className="px-2 py-2 text-center text-xs text-gray-500 font-medium border-r bg-green-50">이탈율</th>
              <th className="px-2 py-2 text-center text-xs text-gray-500 font-medium bg-orange-50">총매출</th>
              <th className="px-2 py-2 text-center text-xs text-gray-500 font-medium bg-orange-50">객단가</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.map((d, idx) => (
              <tr key={`${d.week.year}-${d.week.week}`} className={highlightFirst && idx === 0 ? 'bg-yellow-50' : 'hover:bg-gray-50'}>
                <td className="px-3 py-2 text-center font-medium text-gray-800 border-r sticky left-0 bg-inherit z-10">
                  {d.week.year}년 {d.week.label}
                  {highlightFirst && idx === 0 && <span className="ml-1 text-xs text-orange-500">(현재)</span>}
                </td>
                <td className="px-3 py-2 text-center text-xs text-gray-500 border-r whitespace-nowrap">
                  {d.week.startDate.slice(5)} ~ {d.week.endDate.slice(5)}
                </td>
                <td className="px-2 py-2 text-center font-semibold text-blue-600">{d.choojin.total}</td>
                <td className="px-2 py-2 text-center text-gray-600">{d.choojin.chim_new}</td>
                <td className="px-2 py-2 text-center text-gray-600">{d.choojin.chim_re}</td>
                <td className="px-2 py-2 text-center text-gray-600">{d.choojin.jabo_new}</td>
                <td className="px-2 py-2 text-center text-gray-600">{d.choojin.jabo_re}</td>
                <td className="px-2 py-2 text-center text-gray-600">{d.choojin.yak_new}</td>
                <td className="px-2 py-2 text-center text-gray-600 border-r">{d.choojin.yak_re}</td>
                <td className="px-2 py-2 text-center text-gray-600">{d.revisit.total_choojin}</td>
                <td className="px-2 py-2 text-center text-green-600 font-medium">{formatPercent(d.revisit.rejin_rate)}</td>
                <td className="px-2 py-2 text-center text-purple-600 font-medium">{formatPercent(d.revisit.samjin_rate)}</td>
                <td className="px-2 py-2 text-center text-red-600 font-medium border-r">{formatPercent(d.revisit.ital_rate)}</td>
                <td className="px-2 py-2 text-center text-gray-600 whitespace-nowrap">{formatNumber(Math.round(d.revenue.total / 10000))}만</td>
                <td className="px-2 py-2 text-center text-orange-600 font-medium whitespace-nowrap">{formatNumber(d.revenue.avg_per_patient)}원</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* 뷰 모드 선택 */}
      <ViewModeSelector />

      {/* 전체 모드 */}
      {viewMode === 'total' && (
        <>
          {renderTotalTable(weeklyData)}
          {/* 범례 */}
          <div className="bg-white rounded-xl shadow-sm p-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">범례</h4>
            <div className="flex flex-wrap gap-4 text-xs text-gray-600">
              <span><span className="font-medium">침신</span>: 침 신규초진</span>
              <span><span className="font-medium">침재</span>: 침 재초진</span>
              <span><span className="font-medium">자신</span>: 자보 신규초진</span>
              <span><span className="font-medium">자재</span>: 자보 재초진</span>
              <span><span className="font-medium">약신</span>: 약 신규초진</span>
              <span><span className="font-medium">약재</span>: 약 재초진</span>
            </div>
          </div>
        </>
      )}

      {/* 원장별 구분 모드 */}
      {viewMode === 'by_doctor' && (
        <div className="space-y-4">
          {/* 원장 선택 */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-600">원장 선택:</span>
            <select
              value={selectedDoctor}
              onChange={(e) => setSelectedDoctor(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-clinic-primary"
            >
              {doctorList.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>

          {selectedDoctor && renderTotalTable(
            selectedDoctorData,
            `${selectedDoctor} 원장 - 최근 16주 주차별 추이`,
            true
          )}
        </div>
      )}
    </div>
  );
}

// 비교 항목 정의
const COMPARE_ITEMS = [
  // 초진수
  { category: '초진수', key: 'choojin_chim', label: '침초', defaultChecked: true },
  { category: '초진수', key: 'choojin_jabo', label: '자초', defaultChecked: false },
  { category: '초진수', key: 'choojin_yak', label: '약초', defaultChecked: false },
  // 평환 (초진수 다음 위치)
  { category: '평환', key: 'pyunghwan', label: '평환', defaultChecked: true },
  // 재진율
  { category: '재진율', key: 'revisit_rejin', label: '재진율', defaultChecked: true },
  { category: '재진율', key: 'revisit_samjin', label: '삼진율', defaultChecked: true },
  { category: '재진율', key: 'revisit_ital', label: '이탈율', defaultChecked: true },
  // 매출
  { category: '매출', key: 'revenue_total', label: '총매출', defaultChecked: false },
  { category: '매출', key: 'revenue_insurance', label: '건보매출', defaultChecked: false },
  { category: '매출', key: 'revenue_jabo', label: '자보매출', defaultChecked: false },
  { category: '매출', key: 'revenue_uncovered', label: '비보매출', defaultChecked: false },
  { category: '매출', key: 'avg_insurance', label: '건보객단', defaultChecked: true },
  { category: '매출', key: 'avg_jabo', label: '자보객단', defaultChecked: true },
];

// 카테고리별 그룹화
const COMPARE_CATEGORIES = ['초진수', '평환', '재진율', '매출'];

// 원장간 비교 탭
function DoctorCompareTab({ checkedItems, weekOffset }: { checkedItems: Set<string>; weekOffset: number }) {
  const [loading, setLoading] = useState(true);

  const [weeklyData, setWeeklyData] = useState<{
    week: { year: number; week: number; label: string; startDate: string; endDate: string };
    byDoctor: Record<string, DoctorWeeklyData>;
  }[]>([]);

  // 원장 목록 (김대현 제외)
  const doctorList = useMemo(() => {
    const doctors = new Set<string>();
    weeklyData.forEach((data) => {
      Object.keys(data.byDoctor).forEach((name) => {
        if (name !== EXCLUDED_DOCTOR) {
          doctors.add(name);
        }
      });
    });
    return Array.from(doctors).sort();
  }, [weeklyData]);

  // 12주 옵션 생성 (weekOffset 반영)
  const weeks12 = useMemo(() => {
    const options: { year: number; week: number; label: string; startDate: string; endDate: string }[] = [];
    const today = new Date();
    const currentWeek = getISOWeek(today);

    for (let i = 0; i < 12; i++) {
      let y = currentWeek.year;
      let w = currentWeek.week - i - weekOffset;
      while (w < 1) {
        y -= 1;
        w += 52;
      }
      const dates = getWeekDates(y, w);
      const label = `${w}주`;
      options.push({
        year: y,
        week: w,
        label,
        startDate: formatDate(dates.start),
        endDate: formatDate(dates.end),
      });
    }
    return options;
  }, [weekOffset]);

  // 체크된 항목 목록
  const visibleItems = useMemo(() => {
    return COMPARE_ITEMS.filter(item => checkedItems.has(item.key));
  }, [checkedItems]);

  // 주차 데이터 (역순: 12주전 → 현재)
  const weeks = useMemo(() => [...weeks12].reverse(), [weeks12]);

  useEffect(() => {
    loadAllWeeksData();
  }, [weeks12]);

  async function loadAllWeeksData() {
    setLoading(true);
    try {
      const promises = weeks12.map(async (week) => {
        const [choojinRes, revisitRes, revenueRes] = await Promise.all([
          getChoojinList({ start_date: week.startDate, end_date: week.endDate }),
          getRevisitRate({ start_date: week.startDate, end_date: week.endDate }),
          getRevenuePerPatient({ start_date: week.startDate, end_date: week.endDate }),
        ]);

        const byDoctor: Record<string, DoctorWeeklyData> = {};
        const choojinByDoctor = choojinRes.data?.summary?.by_doctor || {};
        const revisitByDoctor = revisitRes.data?.by_doctor || {};
        const revenueByDoctor = revenueRes.data?.by_doctor || {};

        const allDoctors = new Set([
          ...Object.keys(choojinByDoctor),
          ...Object.keys(revisitByDoctor),
          ...Object.keys(revenueByDoctor),
        ]);

        allDoctors.forEach((doctorName) => {
          const choojinDoc = choojinByDoctor[doctorName];
          const revisitDoc = revisitByDoctor[doctorName];
          const revenueDoc = revenueByDoctor[doctorName];

          byDoctor[doctorName] = {
            choojin: {
              total: choojinDoc?.total || 0,
              chim_new: choojinDoc?.chim_new || 0,
              chim_re: choojinDoc?.chim_re || 0,
              jabo_new: choojinDoc?.jabo_new || 0,
              jabo_re: choojinDoc?.jabo_re || 0,
              yak_new: choojinDoc?.yak_new || 0,
              yak_re: choojinDoc?.yak_re || 0,
            },
            revisit: {
              total_choojin: revisitDoc?.total_choojin || 0,
              rejin_rate: revisitDoc?.rejin_rate || 0,
              samjin_rate: revisitDoc?.samjin_rate || 0,
              ital_rate: revisitDoc?.ital_rate || 0,
            },
            revenue: {
              total: revenueDoc?.total?.total_revenue || 0,
              avg_per_patient: revenueDoc?.total?.avg_per_patient || 0,
              insurance: revenueDoc?.insurance?.total_revenue || 0,
              insurance_pain_uncovered: revenueDoc?.insurance?.pain_uncovered || 0,
              insurance_daily_count: revenueDoc?.insurance?.daily_count || 0,
              insurance_avg: revenueDoc?.insurance?.avg_per_patient || 0,
              jabo: revenueDoc?.jabo?.total_revenue || 0,
              jabo_daily_count: revenueDoc?.jabo?.daily_count || 0,
              jabo_avg: revenueDoc?.jabo?.avg_per_patient || 0,
              uncovered: revenueDoc?.uncovered?.total_revenue || 0,
              insurance_patients: revenueDoc?.insurance?.patient_count || 0,
              jabo_patients: revenueDoc?.jabo?.patient_count || 0,
              total_patients: revenueDoc?.total?.patient_count || 0,
              work_days: revenueDoc?.work_days || 0,
              daily_visit_count: revenueDoc?.daily_visit_count || 0,
            },
          };
        });

        return { week, byDoctor };
      });

      const results = await Promise.all(promises);
      setWeeklyData(results);
    } catch (error) {
      console.error('원장별 데이터 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  }

  // 데이터 값 추출 함수
  const getValue = (data: DoctorWeeklyData, key: string): string | number => {
    switch (key) {
      case 'choojin_total': return data.choojin.total;
      case 'choojin_chim': return `${data.choojin.chim_new + data.choojin.chim_re}(${data.choojin.chim_new}+${data.choojin.chim_re})`;
      case 'choojin_jabo': return data.choojin.jabo_new + data.choojin.jabo_re;
      case 'choojin_yak': return data.choojin.yak_new + data.choojin.yak_re;
      case 'revisit_choojin': return data.revisit.total_choojin;
      case 'revisit_rejin': return formatPercent(data.revisit.rejin_rate);
      case 'revisit_samjin': return formatPercent(data.revisit.samjin_rate);
      case 'revisit_ital': return formatPercent(data.revisit.ital_rate);
      case 'revenue_total': return `${formatNumber(Math.round(data.revenue.total / 10000))}만`;
      case 'revenue_insurance': return `${formatNumber(Math.round(data.revenue.insurance / 10000))}만`;
      case 'revenue_jabo': return `${formatNumber(Math.round(data.revenue.jabo / 10000))}만`;
      case 'revenue_uncovered': return `${formatNumber(Math.round(data.revenue.uncovered / 10000))}만`;
      case 'avg_insurance': {
        // 건보 객단가 = (건보매출 + 통증비급여) / 건보 연인원
        const insuranceAvg = data.revenue.insurance_avg || 0;
        if (insuranceAvg === 0) return '-';
        return `${formatNumber(insuranceAvg)}원`;
      }
      case 'avg_jabo': {
        // 자보 객단가 = 자보매출 / 자보 연인원
        const jaboAvg = data.revenue.jabo_avg || 0;
        if (jaboAvg === 0) return '-';
        return `${formatNumber(jaboAvg)}원`;
      }
      case 'pyunghwan': {
        // 평환 = 연인원(일별 건보+자보 환자수 합계) / 근무일수
        const dailyVisitCount = data.revenue.daily_visit_count || 0;
        const workDays = data.revenue.work_days || 0;
        if (workDays === 0) return '-';
        return (dailyVisitCount / workDays).toFixed(1);
      }
      default: return '-';
    }
  };

  // 셀 스타일
  const getCellStyle = (key: string): string => {
    if (key === 'choojin_total') return 'font-semibold text-blue-600';
    if (key.startsWith('choojin_')) return 'text-gray-600';
    if (key === 'revisit_rejin') return 'text-green-600 font-medium';
    if (key === 'revisit_samjin') return 'text-purple-600 font-medium';
    if (key === 'revisit_ital') return 'text-red-600 font-medium';
    if (key === 'revisit_choojin') return 'text-gray-600';
    if (key === 'revenue_avg') return 'text-orange-600 font-medium';
    if (key === 'revenue_insurance') return 'text-green-600';
    if (key === 'revenue_jabo') return 'text-blue-600';
    if (key === 'revenue_uncovered') return 'text-purple-600';
    if (key === 'revenue_total') return 'text-gray-600';
    if (key === 'pyunghwan') return 'text-teal-600 font-semibold';
    return 'text-gray-600';
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <i className="fas fa-spinner fa-spin text-2xl text-gray-400 mb-4"></i>
        <p className="text-gray-500">원장별 12주 데이터를 불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 선택된 항목이 없을 때 */}
      {visibleItems.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm p-8 text-center text-gray-500">
          <i className="fas fa-exclamation-circle text-2xl mb-2"></i>
          <p>표시할 항목을 선택해주세요</p>
        </div>
      )}

      {/* 통합 테이블 */}
      {visibleItems.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-2 py-2 text-center text-gray-600 font-medium sticky left-0 bg-gray-50 z-20 w-8">
                    원장
                  </th>
                  <th className="px-3 py-2 text-left text-gray-600 font-medium sticky left-8 bg-gray-50 z-20 min-w-[70px]">
                    항목
                  </th>
                  {/* 주차 헤더 */}
                  {weeks.map((w, idx) => (
                    <th
                      key={`${w.year}-${w.week}`}
                      className={`px-2 py-2 text-center text-gray-500 font-medium whitespace-nowrap min-w-[45px] ${
                        idx === weeks.length - 1 ? 'bg-yellow-50' : ''
                      }`}
                    >
                      {w.label}
                      {idx === weeks.length - 1 && (
                        <span className="block text-[10px] text-orange-500">현재</span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {doctorList.map((doctorName, doctorIdx) => {
                  // 원장별 주차 데이터
                  const getDoctorData = (weekInfo: typeof weeks[0]) => {
                    const weekData = weeklyData.find(
                      (d) => d.week.year === weekInfo.year && d.week.week === weekInfo.week
                    );
                    return weekData?.byDoctor[doctorName] || {
                      choojin: { total: 0, chim_new: 0, chim_re: 0, jabo_new: 0, jabo_re: 0, yak_new: 0, yak_re: 0 },
                      revisit: { total_choojin: 0, rejin_rate: 0, samjin_rate: 0, ital_rate: 0 },
                      revenue: { total: 0, avg_per_patient: 0, insurance: 0, jabo: 0, uncovered: 0, insurance_patients: 0, jabo_patients: 0, total_patients: 0 },
                    };
                  };

                  return visibleItems.map((item, itemIdx) => (
                    <tr
                      key={`${doctorName}-${item.key}`}
                      className={`${itemIdx === visibleItems.length - 1 ? 'border-b-2 border-gray-200' : 'border-b border-gray-100'} hover:bg-gray-50`}
                    >
                      {/* 원장명 (첫 번째 항목에만 표시, rowSpan 적용) */}
                      {itemIdx === 0 && (
                        <td
                          rowSpan={visibleItems.length}
                          className={`px-1 py-2 text-center font-semibold text-gray-800 sticky left-0 z-10 border-r border-gray-200 ${
                            doctorIdx % 2 === 0 ? 'bg-gray-50' : 'bg-white'
                          }`}
                          style={{
                            writingMode: 'vertical-rl',
                            textOrientation: 'upright',
                            letterSpacing: '0.1em',
                          }}
                        >
                          {doctorName}
                        </td>
                      )}
                      {/* 항목명 */}
                      <td className={`px-3 py-1.5 text-gray-700 font-medium sticky left-8 z-10 ${
                        doctorIdx % 2 === 0 ? 'bg-gray-50' : 'bg-white'
                      }`}>
                        {item.label}
                      </td>
                      {/* 주차별 데이터 */}
                      {weeks.map((w, weekIdx) => (
                        <td
                          key={`${w.year}-${w.week}`}
                          className={`px-2 py-1.5 text-center whitespace-nowrap ${getCellStyle(item.key)} ${
                            weekIdx === weeks.length - 1 ? 'bg-yellow-50' : ''
                          }`}
                        >
                          {getValue(getDoctorData(w), item.key)}
                        </td>
                      ))}
                    </tr>
                  ));
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// 사이드바 메뉴 아이템
const MENU_ITEMS: { id: TabType; label: string; icon: string }[] = [
  { id: 'overview', label: '종합', icon: 'fa-home' },
  { id: 'choojin', label: '초진분석', icon: 'fa-user-plus' },
  { id: 'revisit', label: '재진율', icon: 'fa-chart-line' },
  { id: 'revenue', label: '객단가', icon: 'fa-won-sign' },
  { id: 'weekly', label: '주차별 추이', icon: 'fa-calendar-alt' },
  { id: 'compare', label: '원장간 비교', icon: 'fa-users' },
];

// 메인 컴포넌트
function Metrics() {
  const [selectedTab, setSelectedTab] = useState<TabType>('overview');

  // 공통 주차 선택 상태
  const weekOptions = useMemo(() => getWeekOptions(), []);
  const [selectedWeek, setSelectedWeek] = useState(weekOptions[0]);

  // 재진율 탭용 (3주 전 기본값)
  const [revisitWeek, setRevisitWeek] = useState(weekOptions[3]);

  // 원장간 비교 탭용 - 체크된 항목 상태
  const [checkedItems, setCheckedItems] = useState<Set<string>>(() => {
    const defaultChecked = new Set<string>();
    COMPARE_ITEMS.forEach(item => {
      if (item.defaultChecked) defaultChecked.add(item.key);
    });
    return defaultChecked;
  });

  // 원장간 비교 탭용 - 주차 오프셋 (0: 현재~12주전, 3: 3주전~15주전, ...)
  const [weekOffset, setWeekOffset] = useState(0);

  // 체크박스 토글
  const toggleItem = (key: string) => {
    setCheckedItems(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // 전체 선택/해제
  const selectAllItems = () => setCheckedItems(new Set(COMPARE_ITEMS.map(item => item.key)));
  const deselectAllItems = () => setCheckedItems(new Set());

  // 현재 탭에 따른 주차/기간 정보
  const currentWeek = selectedTab === 'revisit' ? revisitWeek : selectedWeek;
  const setCurrentWeek = selectedTab === 'revisit' ? setRevisitWeek : setSelectedWeek;

  // 추적 종료일 계산 (재진율 탭용)
  const trackingEndDate = useMemo(() => {
    const dates = getWeekDates(revisitWeek.year, revisitWeek.week);
    const endDate = new Date(dates.end);
    endDate.setDate(endDate.getDate() + 21);
    return formatDate(endDate);
  }, [revisitWeek]);

  return (
    <div className="h-full flex bg-gray-50">
      {/* 좌측 사이드바 */}
      <div className="w-48 bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
        {/* 사이드바 헤더 */}
        <div className="px-4 py-4 border-b border-gray-100">
          <h1 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <i className="fas fa-chart-pie text-clinic-primary"></i>
            지표관리
          </h1>
        </div>

        {/* 메뉴 목록 */}
        <nav className="flex-1 py-2">
          {MENU_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => setSelectedTab(item.id)}
              className={`w-full px-4 py-3 text-left text-sm font-medium flex items-center gap-3 transition-colors ${
                selectedTab === item.id
                  ? 'bg-clinic-primary/10 text-clinic-primary border-r-3 border-clinic-primary'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'
              }`}
            >
              <i className={`fas ${item.icon} w-4 text-center`}></i>
              {item.label}
            </button>
          ))}
        </nav>

        {/* 사이드바 푸터 */}
        <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-400">
          <i className="fas fa-info-circle mr-1"></i>
          21일 추적 기준
        </div>
      </div>

      {/* 우측 콘텐츠 영역 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 콘텐츠 헤더 */}
        <div className="bg-white border-b border-gray-200 px-6 py-3 flex-shrink-0">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800 flex-shrink-0">
              <i className={`fas ${MENU_ITEMS.find(m => m.id === selectedTab)?.icon} text-clinic-primary mr-2`}></i>
              {MENU_ITEMS.find(m => m.id === selectedTab)?.label}
            </h2>

            {/* 기간 선택 (주차별 추이, 원장간 비교 제외) */}
            {selectedTab !== 'weekly' && selectedTab !== 'compare' && (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600">
                    {selectedTab === 'revisit' ? '초진 기준 주차:' : '기간:'}
                  </label>
                  <select
                    value={`${currentWeek.year}-${currentWeek.week}`}
                    onChange={(e) => {
                      const [y, w] = e.target.value.split('-').map(Number);
                      const opt = weekOptions.find((o) => o.year === y && o.week === w);
                      if (opt) setCurrentWeek(opt);
                    }}
                    className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-clinic-primary"
                  >
                    {weekOptions.map((opt) => (
                      <option key={`${opt.year}-${opt.week}`} value={`${opt.year}-${opt.week}`}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                {selectedTab === 'revisit' && (
                  <span className="text-xs text-gray-500">
                    추적 종료일: {trackingEndDate}
                  </span>
                )}
              </div>
            )}

            {/* 원장간 비교 - 항목 선택 */}
            {selectedTab === 'compare' && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {/* 주차 이동 버튼 */}
                <div className="flex items-center gap-0.5">
                  <button
                    onClick={() => setWeekOffset(prev => prev + 3)}
                    className="px-1.5 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors"
                    title="3주 이전"
                  >
                    <i className="fas fa-chevron-left"></i>
                  </button>
                  <span className="text-xs text-gray-500 px-1">{weekOffset > 0 ? `-${weekOffset}주` : '현재'}</span>
                  <button
                    onClick={() => setWeekOffset(prev => Math.max(0, prev - 3))}
                    disabled={weekOffset === 0}
                    className="px-1.5 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    title="3주 이후"
                  >
                    <i className="fas fa-chevron-right"></i>
                  </button>
                </div>

                <div className="w-px h-4 bg-gray-200"></div>

                {/* 전체선택/해제 버튼 */}
                <div className="flex items-center gap-0.5">
                  <button
                    onClick={selectAllItems}
                    className="px-1.5 py-0.5 text-xs font-medium bg-clinic-primary text-white rounded hover:bg-clinic-primary/90 transition-colors"
                  >
                    전체
                  </button>
                  <button
                    onClick={deselectAllItems}
                    className="px-1.5 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors"
                  >
                    해제
                  </button>
                </div>

                <div className="w-px h-4 bg-gray-200"></div>

                {/* 카테고리별 체크박스 */}
                {COMPARE_CATEGORIES.map((category, catIdx) => (
                  <div key={category} className="flex items-center gap-1">
                    {COMPARE_ITEMS.filter(item => item.category === category).map(item => (
                      <label key={item.key} className="flex items-center gap-0.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checkedItems.has(item.key)}
                          onChange={() => toggleItem(item.key)}
                          className="w-3 h-3 rounded border-gray-300 text-clinic-primary focus:ring-clinic-primary"
                        />
                        <span className="text-xs text-gray-600">{item.label}</span>
                      </label>
                    ))}
                    {catIdx < COMPARE_CATEGORIES.length - 1 && (
                      <div className="w-px h-3 bg-gray-200"></div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 콘텐츠 본문 */}
        <div className="flex-1 overflow-auto p-6">
          {selectedTab === 'overview' && <OverviewTab selectedWeek={selectedWeek} />}
          {selectedTab === 'choojin' && <ChoojinTab selectedWeek={selectedWeek} />}
          {selectedTab === 'revisit' && <RevisitTab selectedWeek={revisitWeek} />}
          {selectedTab === 'revenue' && <RevenueTab selectedWeek={selectedWeek} />}
          {selectedTab === 'weekly' && <WeeklyTrendTab />}
          {selectedTab === 'compare' && <DoctorCompareTab checkedItems={checkedItems} weekOffset={weekOffset} />}
        </div>
      </div>
    </div>
  );
}

export default Metrics;
