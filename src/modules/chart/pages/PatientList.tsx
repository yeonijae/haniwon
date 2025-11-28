import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import type { Patient } from '../types';

interface RecentPatient extends Patient {
  last_visit_date?: string;
}

const PatientList: React.FC = () => {
  const navigate = useNavigate();
  const [recentPatients, setRecentPatients] = useState<RecentPatient[]>([]);
  const [needsChartingPatients, setNeedsChartingPatients] = useState<Patient[]>([]);
  const [searchResults, setSearchResults] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);

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

  // 차팅이 필요한 약상담 환자 로드
  const loadPatientsNeedingCharting = async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().split('T')[0];

      // 1. 오늘 약상담 환자 조회 (acting_queue_items)
      const { data: actingData, error: actingError } = await supabase
        .from('acting_queue_items')
        .select('patient_id, created_at')
        .eq('acting_type', '약상담')
        .gte('created_at', today.toISOString())
        .order('created_at', { ascending: false });

      if (actingError) throw actingError;

      // 2. 오늘 약상담 예약 환자 조회 (reservations + reservation_treatments)
      const { data: reservationsData, error: reservationError } = await supabase
        .from('reservations')
        .select(`
          patient_id,
          id,
          reservation_treatments (
            treatment_name
          )
        `)
        .eq('reservation_date', todayStr)
        .eq('status', 'arrived');

      if (reservationError) throw reservationError;

      // 약상담이 포함된 예약 필터링
      const reservationPatientIds = new Set<number>();
      reservationsData?.forEach((res: any) => {
        const hasConsultation = res.reservation_treatments?.some(
          (t: any) => t.treatment_name === '약상담'
        );
        if (hasConsultation && res.patient_id) {
          reservationPatientIds.add(res.patient_id);
        }
      });

      // 전체 약상담 환자 ID 수집
      const consultationPatientIds = new Set<number>();
      actingData?.forEach(item => {
        if (item.patient_id) consultationPatientIds.add(item.patient_id);
      });
      reservationPatientIds.forEach(id => consultationPatientIds.add(id));

      if (consultationPatientIds.size === 0) {
        setNeedsChartingPatients([]);
        return;
      }

      // 3. 해당 환자들의 차팅 여부 확인
      const patientIdsArray = Array.from(consultationPatientIds);

      const { data: chartedPatients, error: chartError } = await supabase
        .from('initial_charts')
        .select('patient_id')
        .in('patient_id', patientIdsArray);

      if (chartError) throw chartError;

      // 차팅이 완료된 환자 ID 세트
      const chartedPatientIds = new Set(
        chartedPatients?.map(c => c.patient_id) || []
      );

      // 차팅이 필요한 환자 ID (약상담 환자 중 차팅 미완료)
      const needsChartingIds = patientIdsArray.filter(
        id => !chartedPatientIds.has(id)
      );

      if (needsChartingIds.length === 0) {
        setNeedsChartingPatients([]);
        return;
      }

      // 4. 차팅 필요 환자 정보 가져오기
      const { data: patientsData, error: patientsError } = await supabase
        .from('patients')
        .select('*')
        .in('id', needsChartingIds)
        .is('deletion_date', null);

      if (patientsError) throw patientsError;

      setNeedsChartingPatients(patientsData || []);
    } catch (error) {
      console.error('차팅 필요 환자 로드 실패:', error);
    }
  };

  const loadRecentPatients = async () => {
    try {
      setLoading(true);

      // 1. 초진차트에서 최근 진료 기록 가져오기
      const { data: initialCharts, error: chartError } = await supabase
        .from('initial_charts')
        .select(`
          patient_id,
          chart_date,
          updated_at,
          patients (
            id,
            chart_number,
            name,
            dob,
            gender,
            phone,
            address,
            registration_date,
            referral_path,
            created_at,
            deletion_date
          )
        `)
        .order('updated_at', { ascending: false })
        .limit(100);

      if (chartError) throw chartError;

      // 2. 경과기록에서 최근 진료 기록 가져오기
      const { data: progressNotes, error: progressError } = await supabase
        .from('progress_notes')
        .select(`
          patient_id,
          note_date,
          updated_at,
          patients (
            id,
            chart_number,
            name,
            dob,
            gender,
            phone,
            address,
            registration_date,
            referral_path,
            created_at,
            deletion_date
          )
        `)
        .order('updated_at', { ascending: false })
        .limit(100);

      if (progressError) throw progressError;

      // 환자별로 가장 최근 진료 날짜 추출
      const patientMap = new Map<number, RecentPatient>();

      // 초진차트 데이터 처리
      initialCharts?.forEach((record: any) => {
        if (record.patients && !record.patients.deletion_date) {
          const existingPatient = patientMap.get(record.patient_id);
          const recordDate = new Date(record.updated_at || record.chart_date);

          if (!existingPatient || new Date(existingPatient.last_visit_date || '') < recordDate) {
            patientMap.set(record.patient_id, {
              ...record.patients,
              last_visit_date: record.updated_at || record.chart_date
            });
          }
        }
      });

      // 경과기록 데이터 처리 (더 최근이면 업데이트)
      progressNotes?.forEach((record: any) => {
        if (record.patients && !record.patients.deletion_date) {
          const existingPatient = patientMap.get(record.patient_id);
          const recordDate = new Date(record.updated_at || record.note_date);

          if (!existingPatient || new Date(existingPatient.last_visit_date || '') < recordDate) {
            patientMap.set(record.patient_id, {
              ...record.patients,
              last_visit_date: record.updated_at || record.note_date
            });
          }
        }
      });

      // 최근 진료일 기준 정렬
      const sortedPatients = Array.from(patientMap.values())
        .sort((a, b) => {
          const dateA = new Date(a.last_visit_date || '');
          const dateB = new Date(b.last_visit_date || '');
          return dateB.getTime() - dateA.getTime();
        })
        .slice(0, 50);

      setRecentPatients(sortedPatients);
    } catch (error) {
      console.error('최근 진료 환자 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const searchPatients = async () => {
    try {
      setIsSearching(true);
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .is('deletion_date', null)
        .or(`name.ilike.%${searchTerm}%,chart_number.ilike.%${searchTerm}%,phone.like.%${searchTerm}%`)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setSearchResults(data || []);
    } catch (error) {
      console.error('환자 검색 실패:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const displayPatients = searchTerm.length >= 2 ? searchResults : recentPatients;
  const totalCount = searchTerm.length >= 2 ? searchResults.length : recentPatients.length;

  const calculateAge = (dob?: string) => {
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

        {/* 검색 */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-4 flex-shrink-0">
          <input
            type="text"
            placeholder="환자 이름, 차트번호, 전화번호로 검색 (2글자 이상)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-clinic-primary focus:ring-2 focus:ring-clinic-primary focus:ring-opacity-20 transition-colors"
          />
          {searchTerm.length > 0 && searchTerm.length < 2 && (
            <p className="text-xs text-orange-600 mt-2">검색어를 2글자 이상 입력해주세요</p>
          )}
          {isSearching && (
            <p className="text-xs text-clinic-text-secondary mt-2">검색 중...</p>
          )}
        </div>

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
                  onClick={() => navigate(`/chart/patients/${patient.id}`)}
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
                    onClick={() => navigate(`/chart/patients/${patient.id}`)}
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
                      {patient.gender === 'male' ? '남성' : patient.gender === 'female' ? '여성' : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-clinic-text-secondary">{patient.phone || '-'}</td>
                    {searchTerm.length < 2 && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-clinic-text-secondary">
                        {(patient as RecentPatient).last_visit_date
                          ? new Date((patient as RecentPatient).last_visit_date!).toLocaleDateString('ko-KR')
                          : '-'}
                      </td>
                    )}
                    {searchTerm.length >= 2 && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-clinic-text-secondary">
                        {patient.registration_date
                          ? new Date(patient.registration_date).toLocaleDateString('ko-KR')
                          : '-'}
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
