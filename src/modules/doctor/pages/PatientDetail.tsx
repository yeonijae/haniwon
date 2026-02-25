import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { query, execute } from '@shared/lib/postgres';
import type { Patient, TreatmentPlan, ProgressNote } from '../types';
import { useAudioRecorder } from '@modules/pad/hooks/useAudioRecorder';
import { processRecording } from '@modules/pad/services/transcriptionService';
import '@modules/cs/styles/cs.css';

// MSSQL API URL
const MSSQL_API_URL = import.meta.env.VITE_MSSQL_API_URL || 'http://192.168.0.173:3100';
import InitialChartView from '../components/InitialChartView';
import TreatmentPlanSetup from '../components/TreatmentPlanSetup';
import DiagnosisListView from '../components/DiagnosisListView';
import ProgressNoteView from '../components/ProgressNoteView';
import MedicalRecordList from '../components/MedicalRecordList';
import MedicalRecordDetail from '../components/MedicalRecordDetail';
import LegacyChartImporter from '../components/LegacyChartImporter';
import PatientTreatmentStatusCard from '@shared/components/PatientTreatmentStatusCard';
import PatientPrepaidStatusCard from '@shared/components/PatientPrepaidStatusCard';
import TreatmentRecordList from '@shared/components/TreatmentRecordList';

interface PatientDetailProps {
  patientId?: string;
  chartNumber?: string;
  onClose?: () => void;
  isModal?: boolean;
}

const PatientDetail: React.FC<PatientDetailProps> = (props) => {
  const params = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const id = props.patientId || params.id;
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [chartView, setChartView] = useState<'plan' | 'initial' | 'diagnosis' | 'progress' | null>(null);
  const [currentPlan, setCurrentPlan] = useState<Partial<TreatmentPlan> | null>(null);
  const [editingPlanId, setEditingPlanId] = useState<number | null>(null); // 수정 중인 계획 ID
  const [progressPlanId, setProgressPlanId] = useState<number | null>(null); // 경과 입력할 계획 ID
  const [importingPlanId, setImportingPlanId] = useState<number | null>(null); // 기존 차트 등록할 계획 ID
  const [selectedRecordId, setSelectedRecordId] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0); // 목록 새로고침용
  const [showTreatmentHistory, setShowTreatmentHistory] = useState(false); // 진료내역 모달
  const [autoCreateChecked, setAutoCreateChecked] = useState(false); // autoCreate 체크 완료 여부
  const [recordingStarted, setRecordingStarted] = useState(false); // 녹음 시작 여부
  const [isProcessing, setIsProcessing] = useState(false); // 녹음 처리 중
  const [editingProgress, setEditingProgress] = useState<ProgressNote | null>(null); // 수정 중인 경과기록

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
      const chartNo = props.chartNumber || searchParams.get('chartNo');
      let apiUrl: string;

      if (chartNo) {
        apiUrl = `${MSSQL_API_URL}/api/patients/chart/${chartNo}`;
        console.log('[PatientDetail] chartNo로 환자 조회:', chartNo);
      } else if (id) {
        apiUrl = `${MSSQL_API_URL}/api/patients/${id}`;
        console.log('[PatientDetail] id로 환자 조회:', id);
      } else {
        console.error('[PatientDetail] id도 chartNo도 없음');
        if (props.isModal) props.onClose?.();
        else navigate('/doctor/patients');
        return;
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
      if (props.isModal) {
        props.onClose?.();
      } else {
        navigate('/doctor/patients');
      }
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

  // 진료계획 수정 핸들러
  const handleEditPlan = async (planId: number) => {
    try {
      // 진료 계획 데이터 로드
      const plans = await query<TreatmentPlan>(
        `SELECT * FROM treatment_plans WHERE id = ${planId}`
      );
      if (plans && plans.length > 0) {
        const plan = plans[0];
        setCurrentPlan(plan);
        setEditingPlanId(planId);
        setChartView('plan');
      }
    } catch (error) {
      console.error('진료계획 로드 실패:', error);
      alert('진료계획을 불러오는데 실패했습니다.');
    }
  };

  // 진료계획 삭제 핸들러 (연결된 차트/경과기록도 함께 삭제)
  const handleDeletePlan = async (planId: number) => {
    if (!confirm('이 진료계획과 관련된 차트/경과기록이 모두 삭제됩니다. 계속하시겠습니까?')) return;
    try {
      // FK 참조 순서대로 삭제
      await execute(`DELETE FROM progress_notes WHERE treatment_plan_id = ${planId}`);
      await execute(`DELETE FROM initial_charts WHERE treatment_plan_id = ${planId}`);
      await execute(`DELETE FROM treatment_plans WHERE id = ${planId}`);
      setRefreshKey(prev => prev + 1);
    } catch (error) {
      console.error('진료계획 삭제 실패:', error);
      alert('진료계획 삭제에 실패했습니다.');
    }
  };

  // 진료계획에서 초진차트 작성 핸들러
  const handleCreateChartFromPlan = async (planId: number) => {
    try {
      // 진료 계획 데이터 로드
      const plans = await query<TreatmentPlan>(
        `SELECT * FROM treatment_plans WHERE id = ${planId}`
      );
      if (plans && plans.length > 0) {
        setCurrentPlan(plans[0]);
        setChartView('initial');
      }
    } catch (error) {
      console.error('진료계획 로드 실패:', error);
      alert('진료계획을 불러오는데 실패했습니다.');
    }
  };

  // 진료계획에서 경과 입력 핸들러
  const handleCreateProgressFromPlan = async (planId: number) => {
    setProgressPlanId(planId);
    setChartView('progress');
  };

  // 경과기록 삭제 핸들러
  const handleDeleteProgress = async (progressId: number) => {
    try {
      await execute(`DELETE FROM progress_notes WHERE id = ${progressId}`);
      setRefreshKey(prev => prev + 1); // 목록 새로고침
    } catch (error) {
      console.error('경과기록 삭제 실패:', error);
      alert('경과기록 삭제에 실패했습니다.');
    }
  };

  // 경과기록 수정 핸들러
  const handleEditProgress = async (progressId: number, planId: number) => {
    try {
      const progressData = await query<ProgressNote>(
        `SELECT * FROM progress_notes WHERE id = ${progressId}`
      );
      if (progressData && progressData.length > 0) {
        setEditingProgress(progressData[0]);
      }
    } catch (error) {
      console.error('경과기록 로드 실패:', error);
      alert('경과기록을 불러오는데 실패했습니다.');
    }
  };

  // 경과기록 저장 핸들러
  const handleSaveProgress = async () => {
    if (!editingProgress) return;
    try {
      const now = new Date().toISOString();
      const notes = editingProgress.notes?.replace(/'/g, "''") || '';
      const noteDate = editingProgress.note_date || now;

      await execute(`
        UPDATE progress_notes SET
          notes = '${notes}',
          note_date = '${noteDate}',
          updated_at = '${now}'
        WHERE id = ${editingProgress.id}
      `);
      setEditingProgress(null);
      setRefreshKey(prev => prev + 1);
      alert('경과기록이 수정되었습니다.');
    } catch (error) {
      console.error('경과기록 저장 실패:', error);
      alert('경과기록 저장에 실패했습니다.');
    }
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
    <div className="h-full flex flex-col overflow-hidden" style={{ maxWidth: '100%' }}>
      <div className="w-full flex-1 flex flex-col overflow-hidden" style={{ minWidth: 0 }}>
        {/* 헤더: CS 환자통합대시보드 스타일 */}
        <div className="dashboard-header-bar">
          <div className="dashboard-header-inline">
            <button
              onClick={() => props.isModal ? props.onClose?.() : navigate(-1)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', color: '#64748b', fontSize: 16, flexShrink: 0 }}
              title={props.isModal ? '닫기' : '뒤로가기'}
            >
              <i className={`fas ${props.isModal ? 'fa-times' : 'fa-arrow-left'}`}></i>
            </button>
            <span className="dh-name">{patient.name}</span>
            <span className="dh-sep">|</span>
            <span className="dh-chart">{patient.chart_number || '-'}</span>
            {patient.gender && (
              <>
                <span className="dh-sep">|</span>
                <span className="dh-gender">{formatGender(patient.gender)}</span>
              </>
            )}
            {patient.dob && (
              <>
                <span className="dh-sep">|</span>
                <span className="dh-age">{calculateAge(patient.dob)}세</span>
              </>
            )}
            {patient.phone && (
              <>
                <span className="dh-sep">|</span>
                <a href={`tel:${patient.phone}`} className="dh-phone">
                  <i className="fas fa-phone" style={{ fontSize: 11, marginRight: 4 }}></i>
                  {patient.phone}
                </a>
              </>
            )}
            {patient.referral_path && (
              <>
                <span className="dh-sep">|</span>
                <span className="dh-referral">
                  <i className="fas fa-route" style={{ marginRight: 4 }}></i>
                  {patient.referral_path}
                </span>
              </>
            )}
            <div style={{ flex: 1 }} />

          {/* 녹음 컨트롤 + 액션 버튼 */}
          <div className="flex items-center gap-2">
            {/* 녹음 상태 표시 */}
            {(isRecording || isProcessing) && (
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${
                isProcessing ? 'bg-yellow-100' : 'bg-red-100'
              }`}>
                {isProcessing ? (
                  <>
                    <div className="w-3 h-3 border-2 border-yellow-600 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-yellow-700 font-medium text-sm">변환 중...</span>
                  </>
                ) : (
                  <>
                    <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                    <span className="text-red-700 font-medium text-sm">
                      {formatRecordingTime(recordingTime)}
                    </span>
                  </>
                )}
              </div>
            )}

            {/* 녹음 에러 표시 */}
            {recordingError && (
              <div className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs">
                <i className="fas fa-exclamation-circle mr-1"></i>
                {recordingError}
              </div>
            )}

            {/* 녹음 버튼들 */}
            {isRecording && !isProcessing && (
              <>
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
                  <i className="fas fa-stop mr-1"></i>중지
                </button>
              </>
            )}

            {/* 수동 녹음 시작 버튼 */}
            {!isRecording && !isProcessing && actingId && (
              <button
                onClick={async () => {
                  const success = await startRecording();
                  if (success) setRecordingStarted(true);
                }}
                className="px-3 py-1.5 bg-clinic-primary text-white rounded-lg hover:bg-clinic-primary-dark transition-colors text-sm"
              >
                <i className="fas fa-microphone mr-1"></i>녹음
              </button>
            )}

            {/* 진료내역 버튼 */}
            <button
              onClick={() => setShowTreatmentHistory(true)}
              className="px-3 py-1.5 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
            >
              <i className="fas fa-history mr-1"></i>진료내역
            </button>

            {/* 새진료 시작 버튼 */}
            <button
              onClick={() => setChartView('plan')}
              className="px-4 py-1.5 bg-gradient-to-r from-clinic-primary to-clinic-secondary text-white rounded-lg hover:from-blue-900 hover:to-purple-900 transition-all font-semibold shadow text-sm"
            >
              <i className="fas fa-plus mr-1"></i>새진료
            </button>
          </div>
        </div>
        </div>

        {/* 메인 콘텐츠: 진료기록 + 사이드바 */}
        <div className="flex-1 flex gap-4 overflow-hidden">
          {/* 진료기록 목록 */}
          <div className="flex-1 bg-white rounded-lg shadow-sm overflow-hidden flex flex-col">
            <div className="flex-1 overflow-auto p-4">
              <MedicalRecordList
                key={refreshKey}
                patientId={patient.id}
                patientName={patient.name}
                onSelectRecord={(recordId) => setSelectedRecordId(recordId)}
                onEditPlan={handleEditPlan}
                onDeletePlan={handleDeletePlan}
                onCreateChartFromPlan={handleCreateChartFromPlan}
                onCreateProgressFromPlan={handleCreateProgressFromPlan}
                onImportLegacyChart={(planId) => setImportingPlanId(planId)}
                onEditProgress={handleEditProgress}
                onDeleteProgress={handleDeleteProgress}
              />
            </div>
          </div>

          {/* 사이드바: 치료 상태 + 선결제 현황 */}
          <div className="w-72 flex-shrink-0 space-y-3 overflow-y-auto">
            <PatientTreatmentStatusCard
              patientId={patient.id}
              patientName={patient.name}
            />
            <PatientPrepaidStatusCard
              patientId={patient.id}
              patientName={patient.name}
            />
          </div>
        </div>

      {/* 진료 계획 설정 모달 */}
      {chartView === 'plan' && (
        <TreatmentPlanSetup
          patientId={patient.id}
          patientName={patient.name}
          existingPlan={editingPlanId ? currentPlan || undefined : undefined}
          onCreateChart={(plan) => {
            setCurrentPlan(plan);
            setChartView('initial');
            setEditingPlanId(null);
          }}
          onSave={() => {
            // 저장 후 닫기 (초진차트로 이동하지 않음)
            setChartView(null);
            setCurrentPlan(null);
            setEditingPlanId(null);
            setRefreshKey(prev => prev + 1); // 목록 새로고침
          }}
          onClose={() => {
            setChartView(null);
            setCurrentPlan(null);
            setEditingPlanId(null);
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
          treatmentPlanId={progressPlanId || undefined}
          onClose={() => {
            setChartView(null);
            setProgressPlanId(null);
          }}
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

      {/* 기존 차트 등록 모달 */}
      {importingPlanId && (
        <LegacyChartImporter
          patientId={patient.id}
          patientName={patient.name}
          treatmentPlanId={importingPlanId}
          onClose={() => setImportingPlanId(null)}
          onSuccess={() => {
            setImportingPlanId(null);
            setRefreshKey(prev => prev + 1);
          }}
        />
      )}

      {/* 경과기록 수정 모달 */}
      {editingProgress && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="sticky top-0 bg-gradient-to-r from-green-600 to-green-700 border-b p-3 flex justify-between items-center text-white shadow-md">
              <div className="flex items-center gap-2">
                <i className="fas fa-notes-medical text-lg"></i>
                <h2 className="text-lg font-bold">경과기록 수정 - {patient.name}</h2>
              </div>
              <button
                onClick={() => setEditingProgress(null)}
                className="px-3 py-1.5 bg-white bg-opacity-20 hover:bg-opacity-30 text-white rounded-lg transition-colors font-medium text-sm"
              >
                <i className="fas fa-times mr-1"></i>닫기
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-4">
                {/* 진료일자 입력 */}
                <div>
                  <label className="block font-semibold mb-2 text-lg text-clinic-text-primary">
                    <i className="fas fa-calendar-alt mr-2 text-green-600"></i>
                    진료일자
                  </label>
                  <input
                    type="date"
                    value={editingProgress.note_date ? editingProgress.note_date.split('T')[0] : ''}
                    onChange={(e) => setEditingProgress({ ...editingProgress, note_date: e.target.value })}
                    className="border-2 border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500 focus:ring-opacity-20 transition-colors"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-2 text-lg text-clinic-text-primary">경과기록 내용</label>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-3">
                    <p className="text-sm text-green-800 mb-2">
                      <i className="fas fa-info-circle mr-1"></i>
                      <strong>작성 방법:</strong>
                    </p>
                    <ul className="text-xs text-green-700 space-y-1 ml-5 list-disc">
                      <li>섹션 구분: <code className="bg-green-100 px-1 rounded">[경과]</code>, <code className="bg-green-100 px-1 rounded">[복진]</code>, <code className="bg-green-100 px-1 rounded">[설진]</code>, <code className="bg-green-100 px-1 rounded">[맥진]</code>, <code className="bg-green-100 px-1 rounded">[처방]</code> 등</li>
                      <li>세부 항목: <code className="bg-green-100 px-1 rounded">&gt; 제목</code> 또는 <code className="bg-green-100 px-1 rounded">- 내용</code> 형식</li>
                    </ul>
                  </div>
                  <textarea
                    value={editingProgress.notes || ''}
                    onChange={(e) => setEditingProgress({ ...editingProgress, notes: e.target.value })}
                    className="w-full border-2 border-gray-300 rounded-lg p-3 focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500 focus:ring-opacity-20 transition-colors font-mono"
                    rows={20}
                    placeholder="[경과]&#10;- 전반적으로 컨디션 개선&#10;- 피로감 감소&#10;&#10;[복진]&#10;> 복직근 : 긴장도 감소&#10;> 심하부 : 압통 경감&#10;&#10;[처방]&#10;25/01/15 소시호탕 15일분"
                    style={{ fontSize: '0.9rem', lineHeight: '1.5' }}
                  />
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t bg-gray-50 flex-shrink-0 flex justify-end gap-2">
              <button
                onClick={() => setEditingProgress(null)}
                className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors font-medium"
              >
                <i className="fas fa-times mr-2"></i>취소
              </button>
              <button
                onClick={handleSaveProgress}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold shadow-md"
              >
                <i className="fas fa-save mr-2"></i>저장
              </button>
            </div>
          </div>
        </div>
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
