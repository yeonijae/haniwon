import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { query, getCurrentDate } from '@shared/lib/postgres';
import type { Patient } from '../types';

// MSSQL API URL
const MSSQL_API_URL = import.meta.env.VITE_MSSQL_API_URL || 'http://192.168.0.173:3100';

interface RecentPatient extends Patient {
  last_visit_date?: string;
}

interface DailyPatient extends Patient {
  has_chart: boolean;
  has_plan: boolean;
  plan_time?: string;
  chart_time?: string;
  disease_name?: string;
}

const PatientList: React.FC = () => {
  const navigate = useNavigate();
  const [recentPatients, setRecentPatients] = useState<RecentPatient[]>([]);
  const [needsChartingPatients, setNeedsChartingPatients] = useState<Patient[]>([]);
  const [searchResults, setSearchResults] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  // 날짜별 진료 환자 필터
  const [filterDate, setFilterDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [dailyPatients, setDailyPatients] = useState<DailyPatient[]>([]);
  const [loadingDaily, setLoadingDaily] = useState(false);
  const [showDailyFilter, setShowDailyFilter] = useState(false);

  useEffect(() => {
    loadRecentPatients();
    loadPatientsNeedingCharting();
  }, []);

  useEffect(() => {
    if (searchTerm.length >= 2) {
      searchPatients();
    } else {
      setSearchResults([]);
      setIsSearching(false);
    }
  }, [searchTerm]);

  // 날짜별 필터가 활성화되면 해당 날짜의 환자 로드
  useEffect(() => {
    if (showDailyFilter) {
      loadDailyPatients();
    }
  }, [filterDate, showDailyFilter]);

  // 날짜별 진료 환자 로드
  const loadDailyPatients = async () => {
    try {
      setLoadingDaily(true);

      const startOfDay = `${filterDate} 00:00:00`;
      const endOfDay = `${filterDate} 23:59:59`;

      // 1. 해당 날짜의 진료계획 조회
      const plansData = await query<{
        patient_id: number;
        disease_name: string | null;
        created_at: string;
      }>(`
        SELECT patient_id, disease_name, created_at
        FROM treatment_plans
        WHERE created_at >= '${startOfDay}' AND created_at <= '${endOfDay}'
        ORDER BY created_at DESC
      `);

      // 2. 해당 날짜의 초진차트 조회
      const chartsData = await query<{
        patient_id: number;
        chart_date: string;
        created_at: string;
      }>(`
        SELECT patient_id, chart_date, created_at
        FROM initial_charts
        WHERE chart_date = '${filterDate}' OR (created_at >= '${startOfDay}' AND created_at <= '${endOfDay}')
        ORDER BY created_at DESC
      `);

      // 3. 환자 ID별로 정보 수집
      const patientMap = new Map<number, {
        has_chart: boolean;
        has_plan: boolean;
        plan_time?: string;
        chart_time?: string;
        disease_name?: string;
      }>();

      // 진료계획 데이터 처리
      (plansData || []).forEach(plan => {
        const existing = patientMap.get(plan.patient_id) || { has_chart: false, has_plan: false };
        existing.has_plan = true;
        existing.plan_time = plan.created_at;
        existing.disease_name = plan.disease_name || undefined;
        patientMap.set(plan.patient_id, existing);
      });

      // 초진차트 데이터 처리
      (chartsData || []).forEach(chart => {
        const existing = patientMap.get(chart.patient_id) || { has_chart: false, has_plan: false };
        existing.has_chart = true;
        existing.chart_time = chart.created_at;
        patientMap.set(chart.patient_id, existing);
      });

      if (patientMap.size === 0) {
        setDailyPatients([]);
        return;
      }

      // 4. MSSQL에서 환자 정보 가져오기
      const patients: DailyPatient[] = [];
      for (const [patientId, info] of patientMap) {
        try {
          const response = await fetch(`${MSSQL_API_URL}/api/patients/${patientId}`);
          if (response.ok) {
            const mssqlData = await response.json();
            const patient = convertMssqlPatient(mssqlData);
            patients.push({
              ...patient,
              ...info,
            });
          }
        } catch (err) {
          console.error(`환자 ${patientId} 정보 조회 실패:`, err);
        }
      }

      // 시간순 정렬 (최신순)
      patients.sort((a, b) => {
        const timeA = a.plan_time || a.chart_time || '';
        const timeB = b.plan_time || b.chart_time || '';
        return new Date(timeB).getTime() - new Date(timeA).getTime();
      });

      setDailyPatients(patients);
    } catch (error) {
      console.error('날짜별 진료 환자 로드 실패:', error);
    } finally {
      setLoadingDaily(false);
    }
  };

  // MSSQL에서 여러 환자 정보 가져오기
  const fetchPatientsFromMssql = async (patientIds: number[]): Promise<Patient[]> => {
    const patients: Patient[] = [];

    for (const patientId of patientIds) {
      try {
        const response = await fetch(`${MSSQL_API_URL}/api/patients/${patientId}`);
        if (response.ok) {
          const mssqlData = await response.json();
          patients.push(convertMssqlPatient(mssqlData));
        }
      } catch (err) {
        console.error(`환자 ${patientId} 정보 조회 실패:`, err);
      }
    }

    return patients;
  };

  // 오늘 약상담 환자 ID 수집
  const getConsultationPatientIds = async (todayStr: string): Promise<Set<number>> => {
    const consultationPatientIds = new Set<number>();

    // 1. daily_acting_records에서 조회
    const actingData = await query<{ patient_id: number }>(`
      SELECT patient_id FROM daily_acting_records
      WHERE acting_type = '약상담' AND work_date = '${todayStr}'
    `);
    actingData?.forEach(item => {
      if (item.patient_id) consultationPatientIds.add(item.patient_id);
    });

    // 2. reservations에서 조회
    const reservationsData = await query<{ patient_id: number }>(`
      SELECT r.patient_id FROM reservations r
      INNER JOIN reservation_treatments rt ON r.id = rt.reservation_id
      WHERE r.reservation_date = '${todayStr}'
      AND r.status = 'arrived'
      AND rt.treatment_name = '약상담'
    `);
    reservationsData?.forEach(res => {
      if (res.patient_id) consultationPatientIds.add(res.patient_id);
    });

    return consultationPatientIds;
  };

  // 차팅이 필요한 환자 ID 필터링
  const filterUnchartedPatients = async (patientIds: number[]): Promise<number[]> => {
    if (patientIds.length === 0) return [];

    const chartedPatients = await query<{ patient_id: number }>(`
      SELECT DISTINCT patient_id FROM initial_charts
      WHERE patient_id IN (${patientIds.join(',')})
    `);

    const chartedPatientIds = new Set(chartedPatients?.map(c => c.patient_id) || []);
    return patientIds.filter(id => !chartedPatientIds.has(id));
  };

  // 차팅이 필요한 약상담 환자 로드 (PostgreSQL + MSSQL)
  const loadPatientsNeedingCharting = async () => {
    try {
      const todayStr = getCurrentDate();

      // 1. 오늘 약상담 환자 ID 수집
      const consultationPatientIds = await getConsultationPatientIds(todayStr);
      if (consultationPatientIds.size === 0) {
        setNeedsChartingPatients([]);
        return;
      }

      // 2. 차팅 미완료 환자 ID 필터링
      const patientIdsArray = Array.from(consultationPatientIds);
      const needsChartingIds = await filterUnchartedPatients(patientIdsArray);
      if (needsChartingIds.length === 0) {
        setNeedsChartingPatients([]);
        return;
      }

      // 3. MSSQL에서 환자 정보 가져오기
      const patients = await fetchPatientsFromMssql(needsChartingIds);
      setNeedsChartingPatients(patients);
    } catch (error) {
      console.error('차팅 필요 환자 로드 실패:', error);
    }
  };

  // 환자별 최근 진료 날짜 추출
  const getPatientLastVisitDates = async (): Promise<Map<number, string>> => {
    const patientDateMap = new Map<number, string>();

    // 초진차트에서 조회
    const initialCharts = await query<{ patient_id: number; chart_date: string; updated_at: string }>(`
      SELECT patient_id, chart_date, updated_at FROM initial_charts
      ORDER BY updated_at DESC LIMIT 100
    `);

    // 경과기록에서 조회
    const progressNotes = await query<{ patient_id: number; note_date: string; updated_at: string }>(`
      SELECT patient_id, note_date, updated_at FROM progress_notes
      ORDER BY updated_at DESC LIMIT 100
    `);

    // 데이터 병합 (더 최근 날짜로 업데이트)
    const updatePatientDate = (record: { patient_id: number; updated_at: string; chart_date?: string; note_date?: string }) => {
      const existingDate = patientDateMap.get(record.patient_id);
      const recordDate = record.updated_at || record.chart_date || record.note_date;

      if (recordDate && (!existingDate || new Date(existingDate) < new Date(recordDate))) {
        patientDateMap.set(record.patient_id, recordDate);
      }
    };

    initialCharts?.forEach(updatePatientDate);
    progressNotes?.forEach(updatePatientDate);

    return patientDateMap;
  };

  // 최근 진료 환자 로드 (PostgreSQL + MSSQL)
  const loadRecentPatients = async () => {
    try {
      setLoading(true);

      // 1. 환자별 최근 진료 날짜 추출
      const patientDateMap = await getPatientLastVisitDates();

      // 2. 최근 진료일 기준 정렬 후 상위 50명
      const sortedPatientIds = Array.from(patientDateMap.entries())
        .sort((a, b) => new Date(b[1]).getTime() - new Date(a[1]).getTime())
        .slice(0, 50);

      if (sortedPatientIds.length === 0) {
        setRecentPatients([]);
        return;
      }

      // 3. MSSQL에서 환자 정보 가져오기
      const patients: RecentPatient[] = [];
      for (const [patientId, lastVisitDate] of sortedPatientIds) {
        try {
          const response = await fetch(`${MSSQL_API_URL}/api/patients/${patientId}`);
          if (response.ok) {
            const mssqlData = await response.json();
            const patient = convertMssqlPatient(mssqlData);
            patients.push({ ...patient, last_visit_date: lastVisitDate });
          }
        } catch (err) {
          console.error(`환자 ${patientId} 정보 조회 실패:`, err);
        }
      }

      setRecentPatients(patients);
    } catch (error) {
      console.error('최근 진료 환자 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  // 환자 검색 (MSSQL에서 검색)
  const searchPatients = async () => {
    try {
      setIsSearching(true);

      const response = await fetch(`${MSSQL_API_URL}/api/patients/search?q=${encodeURIComponent(searchTerm)}`);
      if (!response.ok) {
        throw new Error(`MSSQL API 오류: ${response.status}`);
      }

      const data = await response.json();

      // MSSQL 응답을 Patient 타입으로 변환
      const patients: Patient[] = (data || []).map(convertMssqlPatient);

      setSearchResults(patients);
    } catch (error) {
      console.error('환자 검색 실패:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const displayPatients = searchTerm.length >= 2 ? searchResults : recentPatients;
  const totalCount = searchTerm.length >= 2 ? searchResults.length : recentPatients.length;

  // 유틸리티 함수들
  const calculateAge = (dob?: string): string => {
    if (!dob) return '-';

    const today = new Date();
    const birthDate = new Date(dob);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    return `${age}세`;
  };

  const convertMssqlPatient = (mssqlData: any): Patient => ({
    id: mssqlData.id,
    name: mssqlData.name,
    chart_number: mssqlData.chart_no || '',
    dob: mssqlData.birth || undefined,
    gender: mssqlData.sex === 'M' ? 'male' : mssqlData.sex === 'F' ? 'female' : undefined,
    phone: mssqlData.phone || undefined,
    address: mssqlData.address || undefined,
    registration_date: mssqlData.reg_date || undefined,
  });

  const formatGender = (gender?: 'male' | 'female'): string => {
    if (gender === 'male') return '남성';
    if (gender === 'female') return '여성';
    return '-';
  };

  const formatDate = (dateStr?: string): string => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('ko-KR');
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex flex-col items-center justify-center p-8 text-clinic-text-secondary">
          <div className="border-4 border-clinic-background border-t-clinic-primary rounded-full w-12 h-12 animate-spin mb-4"></div>
          <p>최근 진료 환자를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="max-w-7xl mx-auto w-full p-6 flex-1 flex flex-col overflow-hidden">
        <h1 className="text-2xl font-bold text-clinic-text-primary mb-4 flex-shrink-0">
          환자 차트
        </h1>

        {/* 검색 + 날짜 필터 */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-4 flex-shrink-0">
          <div className="flex gap-4 items-start">
            <div className="flex-1">
              <input
                type="text"
                placeholder="환자 이름, 차트번호, 전화번호로 검색 (2글자 이상)..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  if (e.target.value.length >= 2) {
                    setShowDailyFilter(false);
                  }
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-clinic-primary focus:ring-2 focus:ring-clinic-primary focus:ring-opacity-20 transition-colors"
              />
              {searchTerm.length > 0 && searchTerm.length < 2 && (
                <p className="text-xs text-orange-600 mt-2">검색어를 2글자 이상 입력해주세요</p>
              )}
              {isSearching && (
                <p className="text-xs text-clinic-text-secondary mt-2">검색 중...</p>
              )}
            </div>

            {/* 날짜별 필터 토글 */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowDailyFilter(!showDailyFilter)}
                className={`px-4 py-2 rounded-lg border transition-colors flex items-center gap-2 ${
                  showDailyFilter
                    ? 'bg-clinic-primary text-white border-clinic-primary'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-clinic-primary'
                }`}
              >
                <i className="fas fa-calendar-day"></i>
                날짜별 조회
              </button>
              {showDailyFilter && (
                <input
                  type="date"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-clinic-primary"
                />
              )}
            </div>
          </div>
        </div>

        {/* 날짜별 진료 환자 목록 */}
        {showDailyFilter && searchTerm.length < 2 && (
          <div className="bg-blue-50 border-2 border-blue-300 rounded-lg shadow-sm p-4 mb-4 flex-shrink-0">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-blue-800 flex items-center">
                <i className="fas fa-calendar-check mr-2"></i>
                {filterDate} 진료 환자 ({dailyPatients.length}명)
              </h2>
              {loadingDaily && (
                <div className="flex items-center gap-2 text-blue-600">
                  <div className="w-4 h-4 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin"></div>
                  <span className="text-sm">로딩 중...</span>
                </div>
              )}
            </div>

            {!loadingDaily && dailyPatients.length === 0 ? (
              <p className="text-center py-6 text-blue-600">해당 날짜에 진료 기록이 없습니다</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-64 overflow-auto">
                {dailyPatients.map((patient) => (
                  <div
                    key={patient.id}
                    onClick={() => navigate(`/doctor/patients/${patient.id}?chartNo=${patient.chart_number}`)}
                    className={`border-2 rounded-lg p-3 cursor-pointer transition-colors ${
                      patient.has_chart
                        ? 'bg-green-50 border-green-400 hover:bg-green-100'
                        : 'bg-amber-50 border-amber-400 hover:bg-amber-100'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-800 truncate">{patient.name}</p>
                        <p className="text-xs text-gray-500">#{patient.chart_number}</p>
                        {patient.disease_name && (
                          <p className="text-xs text-gray-600 mt-1 truncate">{patient.disease_name}</p>
                        )}
                        <p className="text-xs text-gray-400 mt-1">
                          {patient.plan_time && new Date(patient.plan_time).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <div className="flex flex-col gap-1 ml-2">
                        {patient.has_plan && (
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            patient.has_chart ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                            {patient.has_chart ? '차트완료' : '계획만'}
                          </span>
                        )}
                        {!patient.has_plan && patient.has_chart && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                            차트완료
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 차팅할 환자 (검색 중이 아닐 때만 표시) */}
        {searchTerm.length < 2 && needsChartingPatients.length > 0 && (
          <div className="bg-orange-50 border-2 border-orange-300 rounded-lg shadow-sm p-4 mb-4 flex-shrink-0">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-orange-800 flex items-center">
                <i className="fas fa-clipboard-list mr-2"></i>
                차팅할 환자 ({needsChartingPatients.length}명)
              </h2>
              <p className="text-xs text-orange-600">오늘 약상담 진료한 환자 중 차팅 미완료</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {needsChartingPatients.map((patient) => (
                <div
                  key={patient.id}
                  onClick={() => navigate(`/doctor/patients/${patient.id}`)}
                  className="bg-white border-2 border-orange-400 rounded-lg p-3 hover:bg-orange-50 cursor-pointer transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-bold text-clinic-text-primary">{patient.name}</p>
                      <p className="text-xs text-clinic-text-secondary">{patient.chart_number || '차트번호 없음'}</p>
                      <p className="text-xs text-clinic-text-secondary mt-1">{patient.phone || '연락처 없음'}</p>
                    </div>
                    <span className="bg-orange-500 text-white text-xs px-2 py-1 rounded-full whitespace-nowrap">
                      차팅 필요
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 환자 목록 */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden flex-1 flex flex-col">
        {displayPatients.length === 0 ? (
          <p className="text-center py-12 text-clinic-text-secondary">
            {searchTerm.length >= 2
              ? '검색 결과가 없습니다'
              : '최근 진료 기록이 없습니다'}
          </p>
        ) : (
          <div className="overflow-auto flex-1">
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-clinic-text-primary uppercase tracking-wider">차트번호</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-clinic-text-primary uppercase tracking-wider">이름</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-clinic-text-primary uppercase tracking-wider">생년월일 (나이)</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-clinic-text-primary uppercase tracking-wider">성별</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-clinic-text-primary uppercase tracking-wider">전화번호</th>
                  {searchTerm.length < 2 && (
                    <th className="px-6 py-3 text-left text-xs font-semibold text-clinic-text-primary uppercase tracking-wider">최근 진료일</th>
                  )}
                  {searchTerm.length >= 2 && (
                    <th className="px-6 py-3 text-left text-xs font-semibold text-clinic-text-primary uppercase tracking-wider">등록일</th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {displayPatients.map((patient) => (
                  <tr
                    key={patient.id}
                    onClick={() => navigate(`/doctor/patients/${patient.id}`)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-clinic-text-secondary">{patient.chart_number || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-clinic-text-primary">{patient.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-clinic-text-secondary">
                      {patient.dob ? (
                        <>
                          {patient.dob} ({calculateAge(patient.dob)})
                        </>
                      ) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-clinic-text-secondary">
                      {formatGender(patient.gender)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-clinic-text-secondary">{patient.phone || '-'}</td>
                    {searchTerm.length < 2 && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-clinic-text-secondary">
                        {formatDate((patient as RecentPatient).last_visit_date)}
                      </td>
                    )}
                    {searchTerm.length >= 2 && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-clinic-text-secondary">
                        {formatDate(patient.registration_date)}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        </div>
      </div>
    </div>
  );
};

export default PatientList;
