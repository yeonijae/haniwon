import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import type { Patient } from '../types';
import InitialChartView from '../components/InitialChartView';
import DiagnosisListView from '../components/DiagnosisListView';
import ProgressNoteView from '../components/ProgressNoteView';
import MedicalRecordList from '../components/MedicalRecordList';
import MedicalRecordDetail from '../components/MedicalRecordDetail';
import PatientTreatmentStatusCard from '@shared/components/PatientTreatmentStatusCard';
import TreatmentRecordList from '@shared/components/TreatmentRecordList';

const PatientDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [chartView, setChartView] = useState<'initial' | 'diagnosis' | 'progress' | null>(null);
  const [selectedRecordId, setSelectedRecordId] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0); // 목록 새로고침용
  const [showTreatmentHistory, setShowTreatmentHistory] = useState(false); // 진료내역 모달

  useEffect(() => {
    if (id) {
      loadPatient();
    }
  }, [id]);

  const loadPatient = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setPatient(data);
    } catch (error) {
      console.error('환자 정보 로드 실패:', error);
      alert('환자 정보를 불러오는데 실패했습니다');
      navigate('/chart/patients');
    } finally {
      setLoading(false);
    }
  };

  const calculateAge = (dob?: string) => {
    if (!dob) return null;
    const today = new Date();
    const birthDate = new Date(dob);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex flex-col items-center justify-center p-8 text-clinic-text-secondary">
          <div className="border-4 border-clinic-background border-t-clinic-primary rounded-full w-12 h-12 animate-spin mb-4"></div>
          <p>환자 정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <p className="text-center text-clinic-text-secondary">환자를 찾을 수 없습니다</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="max-w-7xl mx-auto w-full p-6 flex-1 flex flex-col overflow-hidden">
        <div className="flex justify-between items-center mb-4 flex-shrink-0">
        <h1 className="text-2xl font-bold text-clinic-text-primary">차트 관리</h1>
        <button
          onClick={() => navigate('/chart/patients')}
          className="px-3 py-1.5 bg-clinic-text-secondary text-white rounded-lg hover:bg-gray-600 transition-colors font-medium text-sm"
        >
          <i className="fas fa-arrow-left mr-2"></i>목록으로
        </button>
      </div>

        {/* 환자 기본 정보 + 치료 상태 */}
        <div className="mb-4 flex-shrink-0 flex gap-4">
          {/* 기본 정보 */}
          <div className="flex-1 text-clinic-text-primary">
            <div className="text-base leading-relaxed">
              <p className="mb-2">
                <span className="font-semibold">차트번호:</span> {patient.chart_number || '-'}
                <span className="mx-3">|</span>
                <span className="font-semibold">이름:</span> {patient.name}
                <span className="mx-3">|</span>
                <span className="font-semibold">생년월일:</span> {patient.dob ? `${patient.dob} (${calculateAge(patient.dob)}세)` : '-'}
                <span className="mx-3">|</span>
                <span className="font-semibold">성별:</span> {patient.gender === 'male' ? '남성' : patient.gender === 'female' ? '여성' : '-'}
              </p>
              <p>
                <span className="font-semibold">전화번호:</span> {patient.phone || '-'}
                <span className="mx-3">|</span>
                <span className="font-semibold">주소:</span> {patient.address || '-'}
                {patient.registration_date && (
                  <>
                    <span className="mx-3">|</span>
                    <span className="font-semibold">등록일:</span> {new Date(patient.registration_date).toLocaleDateString('ko-KR')}
                  </>
                )}
                {patient.referral_path && (
                  <>
                    <span className="mx-3">|</span>
                    <span className="font-semibold">내원경로:</span> {patient.referral_path}
                  </>
                )}
              </p>
            </div>
            {/* 진료내역 버튼 */}
            <button
              onClick={() => setShowTreatmentHistory(true)}
              className="mt-2 px-3 py-1.5 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
            >
              <i className="fas fa-history mr-2"></i>진료내역 보기
            </button>
          </div>

          {/* 치료 상태 카드 */}
          <div className="w-72 flex-shrink-0">
            <PatientTreatmentStatusCard
              patientId={patient.id}
              patientName={patient.name}
            />
          </div>
        </div>

        {/* 진료 관리 */}
        <div className="bg-white rounded-lg shadow-sm p-4 flex-1 flex flex-col overflow-hidden">
          <div className="flex justify-between items-center mb-3 flex-shrink-0">
            <h3 className="text-lg font-semibold text-clinic-text-primary flex items-center">
              <i className="fas fa-clipboard-list text-clinic-primary mr-2"></i>
              진료 관리
            </h3>
            <button
              onClick={() => setChartView('initial')}
              className="px-4 py-2 bg-gradient-to-r from-clinic-primary to-clinic-secondary text-white rounded-lg hover:from-blue-900 hover:to-purple-900 transition-all transform hover:scale-105 font-semibold shadow-lg text-sm"
            >
              <i className="fas fa-file-medical mr-2"></i>새진료 시작
            </button>
          </div>

          {/* 진료기록 목록 */}
          <div className="flex-1 overflow-auto">
            <MedicalRecordList
              key={refreshKey} // refreshKey가 변경되면 컴포넌트가 다시 마운트됨
              patientId={patient.id}
              onSelectRecord={(recordId) => setSelectedRecordId(recordId)}
            />
          </div>
        </div>

      {/* 차트 모달 */}
      {chartView === 'initial' && (
        <InitialChartView
          patientId={patient.id}
          patientName={patient.name}
          onClose={() => {
            setChartView(null);
            setRefreshKey(prev => prev + 1); // 목록 새로고침
          }}
          forceNew={true}
        />
      )}

      {chartView === 'diagnosis' && (
        <DiagnosisListView
          patientId={patient.id}
          patientName={patient.name}
          onClose={() => setChartView(null)}
        />
      )}

      {chartView === 'progress' && (
        <ProgressNoteView
          patientId={patient.id}
          patientName={patient.name}
          onClose={() => setChartView(null)}
        />
      )}

      {/* 진료기록 상세보기 모달 */}
      {selectedRecordId && (
        <MedicalRecordDetail
          recordId={selectedRecordId}
          patientName={patient.name}
          patientInfo={{
            chartNumber: patient.chart_number,
            dob: patient.dob,
            gender: patient.gender,
            age: calculateAge(patient.dob)
          }}
          onClose={() => {
            setSelectedRecordId(null);
            setRefreshKey(prev => prev + 1); // 목록 새로고침
          }}
        />
      )}

      {/* 진료내역 모달 */}
      {showTreatmentHistory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[80vh] overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b flex items-center justify-between flex-shrink-0">
              <h3 className="font-medium text-gray-900">
                {patient.name} 진료내역
              </h3>
              <button
                onClick={() => setShowTreatmentHistory(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <TreatmentRecordList patientId={patient.id} />
            </div>
            <div className="px-4 py-3 border-t bg-gray-50 flex-shrink-0">
              <button
                onClick={() => setShowTreatmentHistory(false)}
                className="w-full py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

export default PatientDetail;
