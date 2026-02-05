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

type TabType = 'overview' | 'choojin' | 'revisit' | 'revenue';

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

// 종합 탭
function OverviewTab() {
  const [loading, setLoading] = useState(true);
  const [choojinData, setChoojinData] = useState<ChoojinListResponse['data'] | null>(null);
  const [revisitData, setRevisitData] = useState<RevisitRateResponse['data'] | null>(null);
  const [revenueData, setRevenueData] = useState<RevenuePerPatientResponse['data'] | null>(null);

  const weekOptions = useMemo(() => getWeekOptions(), []);
  const [selectedWeek, setSelectedWeek] = useState(weekOptions[0]);

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
      {/* 주차 선택 */}
      <div className="flex items-center gap-4">
        <label className="text-sm font-medium text-gray-600">기간 선택:</label>
        <select
          value={`${selectedWeek.year}-${selectedWeek.week}`}
          onChange={(e) => {
            const [y, w] = e.target.value.split('-').map(Number);
            const opt = weekOptions.find((o) => o.year === y && o.week === w);
            if (opt) setSelectedWeek(opt);
          }}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-clinic-primary"
        >
          {weekOptions.map((opt) => (
            <option key={`${opt.year}-${opt.week}`} value={`${opt.year}-${opt.week}`}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

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
function ChoojinTab() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ChoojinListResponse['data'] | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'chim' | 'jabo' | 'yak'>('all');

  const weekOptions = useMemo(() => getWeekOptions(), []);
  const [selectedWeek, setSelectedWeek] = useState(weekOptions[0]);

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
      {/* 필터 */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-600">기간:</label>
          <select
            value={`${selectedWeek.year}-${selectedWeek.week}`}
            onChange={(e) => {
              const [y, w] = e.target.value.split('-').map(Number);
              const opt = weekOptions.find((o) => o.year === y && o.week === w);
              if (opt) setSelectedWeek(opt);
            }}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-clinic-primary"
          >
            {weekOptions.map((opt) => (
              <option key={`${opt.year}-${opt.week}`} value={`${opt.year}-${opt.week}`}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
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
function RevisitTab() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<RevisitRateResponse['data'] | null>(null);

  const weekOptions = useMemo(() => getWeekOptions(), []);
  const [selectedWeek, setSelectedWeek] = useState(weekOptions[3]); // 3주 전부터 (추적 완료된 데이터)

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
      {/* 기간 선택 */}
      <div className="flex items-center gap-4">
        <label className="text-sm font-medium text-gray-600">초진 기준 주차:</label>
        <select
          value={`${selectedWeek.year}-${selectedWeek.week}`}
          onChange={(e) => {
            const [y, w] = e.target.value.split('-').map(Number);
            const opt = weekOptions.find((o) => o.year === y && o.week === w);
            if (opt) setSelectedWeek(opt);
          }}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-clinic-primary"
        >
          {weekOptions.map((opt) => (
            <option key={`${opt.year}-${opt.week}`} value={`${opt.year}-${opt.week}`}>
              {opt.label}
            </option>
          ))}
        </select>
        {data?.period && (
          <span className="text-xs text-gray-500">
            추적 종료일: {data.period.tracking_end_date}
          </span>
        )}
      </div>

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
function RevenueTab() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<RevenuePerPatientResponse['data'] | null>(null);

  const weekOptions = useMemo(() => getWeekOptions(), []);
  const [selectedWeek, setSelectedWeek] = useState(weekOptions[0]);

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
      {/* 기간 선택 */}
      <div className="flex items-center gap-4">
        <label className="text-sm font-medium text-gray-600">기간:</label>
        <select
          value={`${selectedWeek.year}-${selectedWeek.week}`}
          onChange={(e) => {
            const [y, w] = e.target.value.split('-').map(Number);
            const opt = weekOptions.find((o) => o.year === y && o.week === w);
            if (opt) setSelectedWeek(opt);
          }}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-clinic-primary"
        >
          {weekOptions.map((opt) => (
            <option key={`${opt.year}-${opt.week}`} value={`${opt.year}-${opt.week}`}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

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

// 메인 컴포넌트
function Metrics() {
  const [selectedTab, setSelectedTab] = useState<TabType>('overview');

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white border-b px-6 py-4">
        <h1 className="text-xl font-bold text-gray-800">
          <i className="fas fa-chart-pie text-clinic-primary mr-2"></i>
          지표관리
        </h1>
        <p className="text-sm text-gray-500 mt-1">진료 성과 및 운영 지표를 확인합니다</p>
      </div>

      {/* 탭 네비게이션 */}
      <div className="bg-white border-b px-6">
        <div className="flex gap-1">
          <button
            onClick={() => setSelectedTab('overview')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              selectedTab === 'overview'
                ? 'border-clinic-primary text-clinic-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <i className="fas fa-home mr-2"></i>
            종합
          </button>
          <button
            onClick={() => setSelectedTab('choojin')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              selectedTab === 'choojin'
                ? 'border-clinic-primary text-clinic-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <i className="fas fa-user-plus mr-2"></i>
            초진분석
          </button>
          <button
            onClick={() => setSelectedTab('revisit')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              selectedTab === 'revisit'
                ? 'border-clinic-primary text-clinic-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <i className="fas fa-chart-line mr-2"></i>
            재진율
          </button>
          <button
            onClick={() => setSelectedTab('revenue')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              selectedTab === 'revenue'
                ? 'border-clinic-primary text-clinic-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <i className="fas fa-won-sign mr-2"></i>
            객단가
          </button>
        </div>
      </div>

      {/* 콘텐츠 영역 */}
      <div className="flex-1 overflow-auto p-6">
        {selectedTab === 'overview' && <OverviewTab />}
        {selectedTab === 'choojin' && <ChoojinTab />}
        {selectedTab === 'revisit' && <RevisitTab />}
        {selectedTab === 'revenue' && <RevenueTab />}
      </div>
    </div>
  );
}

export default Metrics;
