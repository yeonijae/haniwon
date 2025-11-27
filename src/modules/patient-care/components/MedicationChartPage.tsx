/**
 * 복약관리 페이지
 * 환자별 복약차트 - 서브메뉴 없이 환자별 차트만 표시
 */

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../chart/lib/supabaseClient';

interface MedicationPatient {
  patient_id: number;
  patient_name: string;
  chart_number?: string;
  phone?: string;
  prescriptions: PrescriptionInfo[];
}

interface PrescriptionInfo {
  id: number;
  formula: string;
  issued_at: string;
  days: number;
  delivery_method: string;
  medication_start_date: string;
  expected_end_date: string;
  days_remaining: number;
  progress_percent: number;
  delivery_call_done: boolean;
  visit_call_done: boolean;
  medication_completed: boolean;
}

const MedicationChartPage: React.FC = () => {
  const [patients, setPatients] = useState<MedicationPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);

  useEffect(() => {
    loadPatients();
  }, []);

  const loadPatients = async () => {
    try {
      setLoading(true);

      // 복약 중인 처방전 조회
      const { data: prescriptions, error } = await supabase
        .from('prescriptions')
        .select('*')
        .eq('status', 'issued')
        .eq('medication_completed', false)
        .order('issued_at', { ascending: false });

      if (error) throw error;

      // 환자별로 그룹화
      const patientMap = new Map<number, MedicationPatient>();

      for (const p of prescriptions || []) {
        if (!p.patient_id) continue;

        const deliveryMethod = p.delivery_method || '직접수령';
        const issuedDate = new Date(p.issued_at);

        // 복약 시작일 계산
        let startDate = new Date(issuedDate);
        if (deliveryMethod === '퀵') startDate.setDate(startDate.getDate() + 1);
        else if (deliveryMethod === '택배') startDate.setDate(startDate.getDate() + 3);

        // 복약 종료 예정일
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + (p.days || 15));

        // 남은 일수 계산
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const daysRemaining = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        // 진행률 계산
        const totalDays = p.days || 15;
        const elapsedDays = Math.ceil((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        const progressPercent = Math.min(100, Math.max(0, Math.round((elapsedDays / totalDays) * 100)));

        const prescriptionInfo: PrescriptionInfo = {
          id: p.id,
          formula: p.formula,
          issued_at: p.issued_at,
          days: p.days || 15,
          delivery_method: deliveryMethod,
          medication_start_date: startDate.toISOString(),
          expected_end_date: endDate.toISOString(),
          days_remaining: daysRemaining,
          progress_percent: progressPercent,
          delivery_call_done: !!p.delivery_call_date,
          visit_call_done: !!p.visit_call_date,
          medication_completed: !!p.medication_completed,
        };

        if (patientMap.has(p.patient_id)) {
          patientMap.get(p.patient_id)!.prescriptions.push(prescriptionInfo);
        } else {
          // 환자 전화번호 가져오기
          const { data: patientData } = await supabase
            .from('patients')
            .select('phone')
            .eq('id', p.patient_id)
            .single();

          patientMap.set(p.patient_id, {
            patient_id: p.patient_id,
            patient_name: p.patient_name || '이름없음',
            chart_number: p.chart_number,
            phone: patientData?.phone,
            prescriptions: [prescriptionInfo],
          });
        }
      }

      setPatients(Array.from(patientMap.values()));
    } catch (error) {
      console.error('환자 목록 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  // 검색 필터링
  const filteredPatients = useMemo(() => {
    if (!searchTerm) return patients;
    const term = searchTerm.toLowerCase();
    return patients.filter(p =>
      p.patient_name.toLowerCase().includes(term) ||
      p.chart_number?.toLowerCase().includes(term) ||
      p.phone?.includes(term) ||
      p.prescriptions.some(pr => pr.formula.toLowerCase().includes(term))
    );
  }, [patients, searchTerm]);

  const selectedPatient = selectedPatientId
    ? patients.find(p => p.patient_id === selectedPatientId)
    : null;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ko-KR', {
      month: 'short',
      day: 'numeric',
    });
  };

  const getProgressColor = (percent: number) => {
    if (percent >= 100) return 'bg-green-500';
    if (percent >= 70) return 'bg-yellow-500';
    return 'bg-blue-500';
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex">
      {/* 환자 목록 */}
      <div className="w-96 border-r bg-white flex flex-col">
        {/* 검색 */}
        <div className="p-4 border-b">
          <div className="relative">
            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
            <input
              type="text"
              placeholder="환자명, 차트번호, 처방으로 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-orange-500"
            />
          </div>
          <div className="mt-2 text-sm text-gray-500">
            복약 진행 중: <span className="font-bold text-orange-600">{patients.length}</span>명
          </div>
        </div>

        {/* 환자 목록 */}
        <div className="flex-1 overflow-auto">
          {filteredPatients.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <i className="fas fa-pills text-4xl mb-4 opacity-30"></i>
              <p>복약 중인 환자가 없습니다</p>
            </div>
          ) : (
            filteredPatients.map(patient => (
              <div
                key={patient.patient_id}
                onClick={() => setSelectedPatientId(patient.patient_id)}
                className={`p-4 border-b cursor-pointer transition-colors ${
                  selectedPatientId === patient.patient_id
                    ? 'bg-orange-50 border-l-4 border-l-orange-500'
                    : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-900">{patient.patient_name}</div>
                    {patient.chart_number && (
                      <div className="text-sm text-gray-500">{patient.chart_number}</div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-orange-600">
                      {patient.prescriptions.length}건 복약중
                    </div>
                    {patient.phone && (
                      <div className="text-xs text-gray-400">{patient.phone}</div>
                    )}
                  </div>
                </div>
                {/* 첫 번째 처방 미리보기 */}
                {patient.prescriptions[0] && (
                  <div className="mt-2">
                    <div className="text-xs text-gray-500 truncate">{patient.prescriptions[0].formula}</div>
                    <div className="mt-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${getProgressColor(patient.prescriptions[0].progress_percent)}`}
                        style={{ width: `${patient.prescriptions[0].progress_percent}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* 복약 차트 상세 */}
      <div className="flex-1 bg-gray-50 overflow-auto">
        {selectedPatient ? (
          <div className="p-6">
            {/* 환자 정보 헤더 */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{selectedPatient.patient_name}</h2>
                  <div className="flex items-center gap-4 mt-2 text-gray-500">
                    {selectedPatient.chart_number && (
                      <span><i className="fas fa-id-card mr-1"></i>{selectedPatient.chart_number}</span>
                    )}
                    {selectedPatient.phone && (
                      <span><i className="fas fa-phone mr-1"></i>{selectedPatient.phone}</span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-orange-600">{selectedPatient.prescriptions.length}</div>
                  <div className="text-sm text-gray-500">복약 진행 중</div>
                </div>
              </div>
            </div>

            {/* 복약 차트 목록 */}
            <div className="space-y-4">
              {selectedPatient.prescriptions.map(prescription => (
                <div key={prescription.id} className="bg-white rounded-lg shadow p-5">
                  {/* 처방 헤더 */}
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-medium text-gray-900">{prescription.formula}</h3>
                      <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                        <span>{prescription.days}일분</span>
                        <span>|</span>
                        <span>{prescription.delivery_method}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-lg font-bold ${prescription.days_remaining <= 0 ? 'text-green-600' : prescription.days_remaining <= 3 ? 'text-orange-600' : 'text-blue-600'}`}>
                        {prescription.days_remaining <= 0 ? '복약 완료' : `D-${prescription.days_remaining}`}
                      </div>
                      <div className="text-xs text-gray-400">
                        {formatDate(prescription.expected_end_date)} 종료
                      </div>
                    </div>
                  </div>

                  {/* 진행률 바 */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between text-sm text-gray-500 mb-1">
                      <span>복약 진행률</span>
                      <span className="font-medium">{prescription.progress_percent}%</span>
                    </div>
                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${getProgressColor(prescription.progress_percent)}`}
                        style={{ width: `${prescription.progress_percent}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                      <span>{formatDate(prescription.medication_start_date)} 시작</span>
                      <span>{formatDate(prescription.expected_end_date)} 종료</span>
                    </div>
                  </div>

                  {/* 콜 상태 */}
                  <div className="flex gap-3">
                    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                      prescription.delivery_call_done
                        ? 'bg-green-50 text-green-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}>
                      <i className={`fas ${prescription.delivery_call_done ? 'fa-check-circle' : 'fa-circle'}`}></i>
                      <span>배송콜</span>
                    </div>
                    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                      prescription.visit_call_done
                        ? 'bg-green-50 text-green-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}>
                      <i className={`fas ${prescription.visit_call_done ? 'fa-check-circle' : 'fa-circle'}`}></i>
                      <span>내원콜</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-gray-400">
            <div className="text-center">
              <i className="fas fa-pills text-6xl mb-4 opacity-30"></i>
              <p className="text-lg">왼쪽에서 환자를 선택하세요</p>
              <p className="text-sm mt-2">환자별 복약 차트를 확인할 수 있습니다</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MedicationChartPage;
