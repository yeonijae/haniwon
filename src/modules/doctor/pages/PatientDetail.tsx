import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { query } from '@shared/lib/postgres';
import type { Patient, TreatmentPlan } from '../types';
import { useAudioRecorder } from '@modules/pad/hooks/useAudioRecorder';
import { processRecording } from '@modules/pad/services/transcriptionService';

// MSSQL API URL
const MSSQL_API_URL = import.meta.env.VITE_MSSQL_API_URL || 'http://192.168.0.173:3100';
import InitialChartView from '../components/InitialChartView';
import TreatmentPlanSetup from '../components/TreatmentPlanSetup';
import DiagnosisListView from '../components/DiagnosisListView';
import ProgressNoteView from '../components/ProgressNoteView';
import MedicalRecordList from '../components/MedicalRecordList';
import MedicalRecordDetail from '../components/MedicalRecordDetail';
import PatientTreatmentStatusCard from '@shared/components/PatientTreatmentStatusCard';
import TreatmentRecordList from '@shared/components/TreatmentRecordList';

const PatientDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [chartView, setChartView] = useState<'plan' | 'initial' | 'diagnosis' | 'progress' | null>(null);
  const [currentPlan, setCurrentPlan] = useState<Partial<TreatmentPlan> | null>(null);
  const [selectedRecordId, setSelectedRecordId] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0); // 목록 새로고침용
  const [showTreatmentHistory, setShowTreatmentHistory] = useState(false); // 진료내역 모달
  const [autoCreateChecked, setAutoCreateChecked] = useState(false); // autoCreate 체크 완료 여부
  const [recordingStarted, setRecordingStarted] = useState(false); // 녹음 시작 여부
  const [isProcessing, setIsProcessing] = useState(false); // 녹음 처리 중

  // 녹음 관련
  const {
    isRecording,
    isPaused,
    recordingTime,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    error: recordingError,
  } = useAudioRecorder();

  // URL에서 녹음 관련 파라미터 추출
  const autoRecord = searchParams.get('autoRecord') === 'true';
  const actingId = searchParams.get('actingId');
  const actingType = searchParams.get('actingType') || '약상담';
  const doctorId = searchParams.get('doctorId');
  const doctorName = searchParams.get('doctorName') || '';

  useEffect(() => {
    console.log('[PatientDetail] useParams id:', id);
    if (id) {
      loadPatient();
    }
  }, [id]);

  // autoCreate 파라미터 처리: 차트가 없으면 자동으로 새 진료 시작
  useEffect(() => {
    const autoCreate = searchParams.get('autoCreate') === 'true';
    console.log('[PatientDetail] autoCreate 체크:', { autoCreate, patient: !!patient, autoCreateChecked });

    if (!autoCreate || !patient || autoCreateChecked) {
      console.log('[PatientDetail] 조건 불충족으로 스킵:', { autoCreate, hasPatient: !!patient, autoCreateChecked });
      return;
    }

    const checkAndCreate = async () => {
      try {
        console.log('[PatientDetail] 차트 조회 시작, patient.id:', patient.id);
        // 기존 차트가 있는지 확인
        const charts = await query<{ id: number }>(
          `SELECT id FROM initial_charts WHERE patient_id = ${patient.id} LIMIT 1`
        );

        console.log('[PatientDetail] 차트 조회 결과:', charts);
        setAutoCreateChecked(true);

        // 차트가 없으면 자동으로 새 진료 계획 설정 화면 오픈
        if (!charts || charts.length === 0) {
          console.log('[PatientDetail] 차트 없음 - 새 진료 계획 설정 화면 오픈');
          setChartView('plan');
        } else {
          console.log('[PatientDetail] 기존 차트 있음:', charts.length, '개');
        }
      } catch (error) {
        console.error('[PatientDetail] 차트 확인 실패:', error);
        setAutoCreateChecked(true);
      }
    };

    checkAndCreate();
  }, [patient, searchParams, autoCreateChecked]);

  // autoRecord 파라미터 처리: 자동 녹음 시작
  useEffect(() => {
    if (autoRecord && patient && autoCreateChecked && !recordingStarted && !isRecording) {
      // 약간의 딜레이 후 녹음 시작 (UI 렌더링 후)
      const timer = setTimeout(async () => {
        const success = await startRecording();
        if (success) {
          setRecordingStarted(true);
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [autoRecord, patient, autoCreateChecked, recordingStarted, isRecording, startRecording]);

  // 녹음 중지 및 처리
  const handleStopRecording = useCallback(async () => {
    if (!patient || !actingId) return;

    setIsProcessing(true);
    try {
      const audioBlob = await stopRecording();
      if (!audioBlob) {
        console.error('녹음 데이터가 없습니다');
        setIsProcessing(false);
        return;
      }

      // Whisper API로 변환 및 저장
      const result = await processRecording(audioBlob, {
        actingId: parseInt(actingId, 10),
        patientId: patient.id,
        doctorId: parseInt(doctorId || '0', 10),
        doctorName: doctorName,
        actingType: actingType,
        saveAudio: true,
      });

      if (result.success) {
        alert(`녹음이 완료되었습니다.\n변환된 텍스트: ${result.transcript.substring(0, 100)}...`);
      } else {
        alert(`녹음 처리 중 오류: ${result.error}`);
      }
    } catch (error) {
      console.error('녹음 처리 실패:', error);
      alert('녹음 처리 중 오류가 발생했습니다.');
    } finally {
      setIsProcessing(false);
    }
  }, [patient, actingId, doctorId, doctorName, actingType, stopRecording]);

  // 녹음 시간 포맷
  const formatRecordingTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // MSSQL 환자 데이터를 Patient 타입으로 변환
  const convertMssqlPatient = (mssqlData: any): Patient => ({
    id: mssqlData.id,
    name: mssqlData.name,
    chart_number: mssqlData.chart_no || '',
    dob: mssqlData.birth || undefined,
    gender: mssqlData.sex === 'M' ? 'male' : mssqlData.sex === 'F' ? 'female' : undefined,
    phone: mssqlData.phone || undefined,
    address: mssqlData.address || undefined,
    registration_date: mssqlData.reg_date || undefined,
    referral_path: mssqlData.referral_source || undefined,
  });

  // 환자 정보 로드 (MSSQL에서 조회)
  const loadPatient = async () => {
    try {
      setLoading(true);

      // chartNo가 있으면 chart_no로 조회, 없으면 id로 조회
      const chartNo = searchParams.get('chartNo');
      let apiUrl: string;

      if (chartNo) {
        apiUrl = `${MSSQL_API_URL}/api/patients/chart/${chartNo}`;
        console.log('[PatientDetail] chartNo로 환자 조회:', chartNo);
      } else {
        apiUrl = `${MSSQL_API_URL}/api/patients/${id}`;
        console.log('[PatientDetail] id로 환자 조회:', id);
      }

      const response = await fetch(apiUrl);
      if (!response.ok) {
        throw new Error(`환자 정보 조회 실패: ${response.status}`);
      }

      const mssqlData = await response.json();
      const patientData = convertMssqlPatient(mssqlData);

      setPatient(patientData);
    } catch (error) {
      console.error('환자 정보 로드 실패:', error);
      alert('환자 정보를 불러오는데 실패했습니다');
      navigate('/doctor/patients');
    } finally {
      setLoading(false);
    }
  };

  // 나이 계산 함수
  const calculateAge = (dob?: string): number | null => {
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

  // 성별 표시 함수
  const formatGender = (gender?: 'male' | 'female'): string => {
    if (gender === 'male') return '남성';
    if (gender === 'female') return '여성';
    return '-';
  };

  // 날짜 포맷 함수
  const formatDate = (dateStr?: string): string => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('ko-KR');
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

          {/* 녹음 컨트롤 */}
          <div className="flex items-center gap-3">
            {/* 녹음 상태 표시 */}
            {(isRecording || isProcessing) && (
              <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                isProcessing ? 'bg-yellow-100' : 'bg-red-100'
              }`}>
                {isProcessing ? (
                  <>
                    <div className="w-3 h-3 border-2 border-yellow-600 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-yellow-700 font-medium">변환 중...</span>
                  </>
                ) : (
                  <>
                    <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                    <span className="text-red-700 font-medium">
                      녹음 중 {formatRecordingTime(recordingTime)}
                    </span>
                  </>
                )}
              </div>
            )}

            {/* 녹음 에러 표시 */}
            {recordingError && (
              <div className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-sm">
                <i className="fas fa-exclamation-circle mr-1"></i>
                {recordingError}
              </div>
            )}

            {/* 녹음 버튼들 */}
            {isRecording && !isProcessing && (
              <div className="flex items-center gap-2">
                {isPaused ? (
                  <button
                    onClick={resumeRecording}
                    className="px-3 py-1.5 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm"
                  >
                    <i className="fas fa-play mr-1"></i>재개
                  </button>
                ) : (
                  <button
                    onClick={pauseRecording}
                    className="px-3 py-1.5 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors text-sm"
                  >
                    <i className="fas fa-pause mr-1"></i>일시정지
                  </button>
                )}
                <button
                  onClick={handleStopRecording}
                  className="px-3 py-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm"
                >
                  <i className="fas fa-stop mr-1"></i>녹음 중지
                </button>
              </div>
            )}

            {/* 수동 녹음 시작 버튼 (녹음 중이 아닐 때만) */}
            {!isRecording && !isProcessing && actingId && (
              <button
                onClick={async () => {
                  const success = await startRecording();
                  if (success) setRecordingStarted(true);
                }}
                className="px-3 py-1.5 bg-clinic-primary text-white rounded-lg hover:bg-clinic-primary-dark transition-colors text-sm"
              >
                <i className="fas fa-microphone mr-1"></i>녹음 시작
              </button>
            )}

            <button
              onClick={() => navigate('/doctor/patients')}
              className="px-3 py-1.5 bg-clinic-text-secondary text-white rounded-lg hover:bg-gray-600 transition-colors font-medium text-sm"
            >
              <i className="fas fa-arrow-left mr-2"></i>목록으로
            </button>
          </div>
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
                <span className="font-semibold">성별:</span> {formatGender(patient.gender)}
              </p>
              <p>
                <span className="font-semibold">전화번호:</span> {patient.phone || '-'}
                <span className="mx-3">|</span>
                <span className="font-semibold">주소:</span> {patient.address || '-'}
                {patient.registration_date && (
                  <>
                    <span className="mx-3">|</span>
                    <span className="font-semibold">등록일:</span> {formatDate(patient.registration_date)}
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
              onClick={() => setChartView('plan')}
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

      {/* 진료 계획 설정 모달 */}
      {chartView === 'plan' && (
        <TreatmentPlanSetup
          patientId={patient.id}
          patientName={patient.name}
          onCreateChart={(plan) => {
            setCurrentPlan(plan);
            setChartView('initial');
          }}
          onSave={() => {
            // 저장 후 닫기 (초진차트로 이동하지 않음)
            setChartView(null);
            setCurrentPlan(null);
            setRefreshKey(prev => prev + 1); // 목록 새로고침
          }}
          onClose={() => {
            setChartView(null);
            setCurrentPlan(null);
          }}
        />
      )}

      {/* 초진차트 모달 */}
      {chartView === 'initial' && (
        <InitialChartView
          patientId={patient.id}
          patientName={patient.name}
          treatmentPlan={currentPlan}
          onClose={() => {
            setChartView(null);
            setCurrentPlan(null);
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
