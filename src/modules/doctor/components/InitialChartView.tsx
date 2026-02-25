import React, { useState, useEffect, useRef } from 'react';
import { query, queryOne, execute, insert, escapeString, getCurrentTimestamp, getCurrentDate } from '@shared/lib/postgres';
import type { InitialChart, TreatmentPlan } from '../types';
import { useAudioRecorder } from '@modules/pad/hooks/useAudioRecorder';
import { transcribeAudio } from '@modules/pad/services/transcriptionService';
import { useFontScale } from '@shared/hooks/useFontScale';

interface Props {
  patientId: number;
  patientName: string;
  onClose: () => void;
  forceNew?: boolean; // 새진료 시작일 때 true
  treatmentPlan?: Partial<TreatmentPlan> | null; // 진료 계획 정보
}

interface ChartHistory {
  id: number;
  initial_chart_id: number;
  patient_id: number;
  notes: string;
  chart_date: string;
  saved_at: string;
  version: number;
}

const InitialChartView: React.FC<Props> = ({ patientId, patientName, onClose, forceNew = false, treatmentPlan }) => {
  const [chart, setChart] = useState<InitialChart | null>(null);
  const [isEditing, setIsEditing] = useState(forceNew); // forceNew이면 바로 편집 모드
  const [loading, setLoading] = useState(!forceNew); // forceNew이면 로딩 안함
  const [formData, setFormData] = useState<Partial<InitialChart>>({});
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [showHistory, setShowHistory] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const { scale } = useFontScale('doctor');
  const [historyList, setHistoryList] = useState<ChartHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // 녹음 관련
  const [isTranscribing, setIsTranscribing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
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

  // 녹음 시간 포맷
  const formatRecordingTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // 녹음 중지 및 텍스트 변환
  const handleStopRecording = async () => {
    try {
      const audioBlob = await stopRecording();
      if (!audioBlob) {
        console.error('녹음 데이터가 없습니다');
        return;
      }

      setIsTranscribing(true);

      // Whisper로 텍스트 변환
      const result = await transcribeAudio(audioBlob, {
        prompt: '한의원 초진 상담. 환자 주소증, 병력, 문진 내용.',
      });

      if (result.success && result.transcript) {
        // 현재 notes에 변환된 텍스트 추가
        const currentNotes = formData.notes || '';
        const separator = currentNotes.trim() ? '\n\n[녹음 변환]\n' : '';
        const newNotes = currentNotes + separator + result.transcript;
        setFormData({ ...formData, notes: newNotes });

        // textarea 스크롤을 맨 아래로
        setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
          }
        }, 100);
      } else {
        alert(`음성 변환 실패: ${result.error || '알 수 없는 오류'}`);
      }
    } catch (error) {
      console.error('녹음 처리 실패:', error);
      alert('녹음 처리 중 오류가 발생했습니다.');
    } finally {
      setIsTranscribing(false);
    }
  };

  // 구분자를 기준으로 섹션 파싱 ([], > 모두 지원)
  // 텍스트에서 날짜 추출 (YY/MM/DD, YYYY-MM-DD, YYYY.MM.DD 형식 지원)
  const extractDateFromText = (text: string): string | null => {
    if (!text) return null;

    // 패턴 1: YY/MM/DD (예: 25/11/15, 24/12/31)
    const pattern1 = text.match(/(\d{2})\/(\d{1,2})\/(\d{1,2})/);
    if (pattern1) {
      const year = parseInt(pattern1[1]) + 2000; // 25 -> 2025
      const month = pattern1[2].padStart(2, '0');
      const day = pattern1[3].padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    // 패턴 2: YYYY-MM-DD 또는 YYYY/MM/DD
    const pattern2 = text.match(/(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
    if (pattern2) {
      const year = pattern2[1];
      const month = pattern2[2].padStart(2, '0');
      const day = pattern2[3].padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    // 패턴 3: YYYY.MM.DD
    const pattern3 = text.match(/(\d{4})\.(\d{1,2})\.(\d{1,2})/);
    if (pattern3) {
      const year = pattern3[1];
      const month = pattern3[2].padStart(2, '0');
      const day = pattern3[3].padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    return null;
  };

  const parseChartSections = (text: string) => {
    if (!text) return [];

    interface Subsection {
      title: string;
      content: string;
    }

    interface Section {
      title: string;
      subsections: Subsection[];
      directContent: string;
    }

    const sections: Section[] = [];
    const lines = text.split('\n');
    let currentSection: Section | null = null;
    let currentSubsection: Subsection | null = null;

    lines.forEach(line => {
      const sectionMatch = line.match(/^\[(.+?)\](.*)$/);
      const subsectionMatch = line.match(/^>\s*(.+?)$/);

      if (sectionMatch) {
        // 새로운 대분류 섹션 시작
        if (currentSection) {
          if (currentSubsection) {
            currentSection.subsections.push(currentSubsection);
            currentSubsection = null;
          }
          sections.push(currentSection);
        }
        currentSection = {
          title: sectionMatch[1].trim(),
          subsections: [],
          directContent: sectionMatch[2].trim() // [주소증] 바로 뒤에 오는 내용
        };
      } else if (subsectionMatch && currentSection) {
        // 새로운 중분류 시작
        if (currentSubsection) {
          currentSection.subsections.push(currentSubsection);
        }
        currentSubsection = {
          title: subsectionMatch[1].trim(),
          content: ''
        };
      } else {
        // 내용 추가 (빈 줄 포함)
        if (currentSubsection) {
          currentSubsection.content += (currentSubsection.content ? '\n' : '') + line;
        } else if (currentSection) {
          currentSection.directContent += (currentSection.directContent ? '\n' : '') + line;
        }
      }
    });

    // 마지막 subsection과 section 추가
    if (currentSubsection && currentSection) {
      currentSection.subsections.push(currentSubsection);
    }
    if (currentSection) {
      sections.push(currentSection);
    }

    // 각 섹션의 내용 끝부분 공백 제거
    sections.forEach(section => {
      section.directContent = section.directContent.trim();
      section.subsections.forEach(subsection => {
        subsection.content = subsection.content.trim();
      });
    });

    return sections;
  };

  useEffect(() => {
    if (forceNew) {
      // 새진료 시작: 빈 폼 데이터로 시작 (오늘 날짜로 초기화)
      const today = getCurrentDate(); // YYYY-MM-DD 형식
      setFormData({
        patient_id: patientId,
        chart_date: today
      });
      setIsEditing(true);
      setLoading(false);
    } else {
      // 기존 방식: 차트 로드
      loadChart();
    }
  }, [patientId, forceNew]);

  // 자동 저장 (5초 디바운스)
  useEffect(() => {
    if (!isEditing || !formData.notes || !formData.chart_date) {
      return;
    }

    setAutoSaveStatus('idle');

    const timer = setTimeout(async () => {
      await autoSave();
    }, 5000); // 5초 대기

    return () => clearTimeout(timer);
  }, [formData.notes, formData.chart_date, isEditing]);

  const loadChart = async () => {
    try {
      setLoading(true);
      const data = await queryOne<InitialChart>(
        `SELECT * FROM initial_charts WHERE patient_id = ${patientId} ORDER BY created_at DESC LIMIT 1`
      );

      if (data) {
        setChart(data);
        setFormData(data);
      } else {
        setIsEditing(true);
        setFormData({ patient_id: patientId });
      }
    } catch (error) {
      console.error('초진차트 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const autoSave = async () => {
    try {
      setAutoSaveStatus('saving');

      if (!formData.notes || formData.notes.trim() === '') {
        setAutoSaveStatus('idle');
        return;
      }

      if (!formData.chart_date) {
        setAutoSaveStatus('idle');
        return;
      }

      const now = getCurrentTimestamp();
      const chartDate = new Date(formData.chart_date).toISOString();
      const notes = formData.notes.trim();

      // 자동저장: chart 상태만 확인 (forceNew는 수동 저장에서만 사용)
      // forceNew를 조건에 넣으면 props가 true로 유지되어 매번 INSERT됨!
      if (!chart) {
        // 새 차트 생성 (chart가 없을 때만)
        const planId = treatmentPlan?.id || null;
        const newId = await insert(`
          INSERT INTO initial_charts (patient_id, notes, chart_date, treatment_plan_id, created_at, updated_at)
          VALUES (${patientId}, ${escapeString(notes)}, ${escapeString(chartDate)}, ${planId}, ${escapeString(now)}, ${escapeString(now)})
        `);

        if (newId) {
          // 진료계획이 있으면 양방향 연결
          if (planId) {
            await execute(`
              UPDATE treatment_plans SET initial_chart_id = ${newId}, updated_at = ${escapeString(now)}
              WHERE id = ${planId}
            `);
            console.log('자동저장: 진료계획-초진차트 양방향 연결 완료');
          }

          const newChart = await queryOne<InitialChart>(
            `SELECT * FROM initial_charts WHERE id = ${newId}`
          );
          if (newChart) {
            setChart(newChart);
            console.log('자동저장 완료 (새 차트), id:', newId);
          }
        }
      } else {
        // 기존 차트 업데이트 (chart가 이미 있으면)

        // 1. 현재 상태를 히스토리에 저장 (UPDATE 전에)
        const lastVersion = await queryOne<{ max_version: number }>(
          `SELECT COALESCE(MAX(version), 0) as max_version FROM initial_charts_history WHERE initial_chart_id = ${chart.id}`
        );
        const newVersion = (lastVersion?.max_version || 0) + 1;

        await execute(`
          INSERT INTO initial_charts_history (initial_chart_id, patient_id, notes, chart_date, saved_at, version)
          VALUES (${chart.id}, ${patientId}, ${escapeString(chart.notes || '')}, ${escapeString(chart.chart_date?.toString() || now)}, ${escapeString(now)}, ${newVersion})
        `);

        // 2. 차트 업데이트
        await execute(`
          UPDATE initial_charts SET
            notes = ${escapeString(notes)},
            chart_date = ${escapeString(chartDate)},
            updated_at = ${escapeString(now)}
          WHERE id = ${chart.id}
        `);

        // 3. 로컬 상태도 업데이트
        setChart({ ...chart, notes, chart_date: chartDate, updated_at: now });
        console.log('자동저장 완료 (업데이트, 히스토리 v' + newVersion + ' 저장)');
      }

      setAutoSaveStatus('saved');

      // 2초 후 saved 상태 초기화
      setTimeout(() => {
        setAutoSaveStatus('idle');
      }, 2000);
    } catch (error) {
      console.error('자동저장 오류:', error);
      setAutoSaveStatus('idle');
    }
  };

  // 히스토리 목록 조회
  const loadHistory = async () => {
    if (!chart) return;

    try {
      setHistoryLoading(true);
      const history = await query<ChartHistory>(
        `SELECT * FROM initial_charts_history
         WHERE initial_chart_id = ${chart.id}
         ORDER BY version DESC
         LIMIT 20`
      );
      setHistoryList(history);
      setShowHistory(true);
    } catch (error) {
      console.error('히스토리 로드 오류:', error);
      alert('히스토리를 불러오는데 실패했습니다.');
    } finally {
      setHistoryLoading(false);
    }
  };

  // 특정 버전으로 복원
  const restoreVersion = async (historyItem: ChartHistory) => {
    if (!chart) return;

    const confirmed = confirm(`버전 ${historyItem.version}으로 복원하시겠습니까?\n(${new Date(historyItem.saved_at).toLocaleString('ko-KR')})`);
    if (!confirmed) return;

    try {
      // 현재 상태를 먼저 히스토리에 저장
      const now = getCurrentTimestamp();
      const lastVersion = await queryOne<{ max_version: number }>(
        `SELECT COALESCE(MAX(version), 0) as max_version FROM initial_charts_history WHERE initial_chart_id = ${chart.id}`
      );
      const newVersion = (lastVersion?.max_version || 0) + 1;

      await execute(`
        INSERT INTO initial_charts_history (initial_chart_id, patient_id, notes, chart_date, saved_at, version)
        VALUES (${chart.id}, ${patientId}, ${escapeString(chart.notes || '')}, ${escapeString(chart.chart_date?.toString() || now)}, ${escapeString(now)}, ${newVersion})
      `);

      // 선택한 버전으로 복원
      await execute(`
        UPDATE initial_charts SET
          notes = ${escapeString(historyItem.notes)},
          chart_date = ${escapeString(historyItem.chart_date)},
          updated_at = ${escapeString(now)}
        WHERE id = ${chart.id}
      `);

      // 상태 업데이트
      setChart({ ...chart, notes: historyItem.notes, chart_date: historyItem.chart_date, updated_at: now });
      setFormData({ ...formData, notes: historyItem.notes, chart_date: historyItem.chart_date.split('T')[0] });
      setShowHistory(false);
      alert(`버전 ${historyItem.version}으로 복원되었습니다.`);
    } catch (error) {
      console.error('복원 오류:', error);
      alert('복원에 실패했습니다.');
    }
  };

  const handleSave = async () => {
    try {
      // 입력 검증
      if (!formData.notes || formData.notes.trim() === '') {
        alert('차트 내용을 입력해주세요.');
        return;
      }

      if (!formData.chart_date) {
        alert('진료일자를 입력해주세요.');
        return;
      }

      const now = getCurrentTimestamp();
      const chartDate = new Date(formData.chart_date).toISOString();
      const notes = formData.notes.trim();

      console.log('저장 데이터:', { patientId, notes: notes.substring(0, 50), chartDate });

      if (forceNew) {
        // 새진료 시작: 무조건 새로 insert
        console.log('새진료 차트 생성 시도...');
        const planId = treatmentPlan?.id || null;
        const newChartId = await insert(`
          INSERT INTO initial_charts (patient_id, notes, chart_date, treatment_plan_id, created_at, updated_at)
          VALUES (${patientId}, ${escapeString(notes)}, ${escapeString(chartDate)}, ${planId}, ${escapeString(now)}, ${escapeString(now)})
        `);

        // 진료계획이 있으면 양방향 연결
        if (planId && newChartId) {
          await execute(`
            UPDATE treatment_plans SET initial_chart_id = ${newChartId}, updated_at = ${escapeString(now)}
            WHERE id = ${planId}
          `);
          console.log('진료계획-초진차트 양방향 연결 완료');
        }

        console.log('생성 성공, chartId:', newChartId);
        alert('새 진료차트가 생성되었습니다');
        onClose(); // 저장 후 닫기
      } else if (chart) {
        // 수정
        await execute(`
          UPDATE initial_charts SET
            notes = ${escapeString(notes)},
            chart_date = ${escapeString(chartDate)},
            updated_at = ${escapeString(now)}
          WHERE id = ${chart.id}
        `);

        alert('초진차트가 수정되었습니다');
        setIsEditing(false);
        await loadChart();
      } else {
        // 신규 생성
        console.log('초진차트 신규 생성 시도...');
        const planId = treatmentPlan?.id || null;
        const newChartId = await insert(`
          INSERT INTO initial_charts (patient_id, notes, chart_date, treatment_plan_id, created_at, updated_at)
          VALUES (${patientId}, ${escapeString(notes)}, ${escapeString(chartDate)}, ${planId}, ${escapeString(now)}, ${escapeString(now)})
        `);

        // 진료계획이 있으면 양방향 연결
        if (planId && newChartId) {
          await execute(`
            UPDATE treatment_plans SET initial_chart_id = ${newChartId}, updated_at = ${escapeString(now)}
            WHERE id = ${planId}
          `);
          console.log('진료계획-초진차트 양방향 연결 완료');
        }

        console.log('생성 성공, chartId:', newChartId);
        alert('초진차트가 생성되었습니다');
        setIsEditing(false);
        await loadChart();
      }
    } catch (error: any) {
      console.error('저장 실패:', error);
      alert('저장에 실패했습니다.\n\n오류: ' + (error.message || error));
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="border-4 border-clinic-background border-t-clinic-primary rounded-full w-8 h-8 animate-spin"></div>
            <p className="text-clinic-text-secondary">로딩 중...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-white flex flex-col overflow-hidden" style={{ left: '220px', top: '56px', zIndex: 60, fontSize: `${scale}em` }}>
      {/* 헤더 */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 p-3 flex justify-between items-center text-gray-800">
        <div className="flex items-center gap-2">
          <i className="fas fa-file-medical text-lg"></i>
          <h2 className="text-lg font-bold">초진차트 - {patientName}</h2>
        </div>
        <div className="flex items-center gap-2">
          {/* 녹음 컨트롤 */}
          {isRecording && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-red-100 rounded-lg">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
              <span className="text-sm font-medium text-red-700">{formatRecordingTime(recordingTime)}</span>
            </div>
          )}
          {isTranscribing && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-100 rounded-lg">
              <i className="fas fa-spinner fa-spin text-yellow-600"></i>
              <span className="text-sm text-yellow-700">변환 중...</span>
            </div>
          )}
          {isRecording ? (
            <>
              {isPaused ? (
                <button onClick={resumeRecording} className="px-3 py-1.5 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm">
                  <i className="fas fa-play mr-1"></i>계속
                </button>
              ) : (
                <button onClick={pauseRecording} className="px-3 py-1.5 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 text-sm">
                  <i className="fas fa-pause mr-1"></i>일시정지
                </button>
              )}
              <button onClick={handleStopRecording} disabled={isTranscribing} className="px-3 py-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 text-sm disabled:opacity-50">
                <i className="fas fa-stop mr-1"></i>녹음 완료
              </button>
            </>
          ) : isEditing ? (
            <button onClick={startRecording} disabled={isTranscribing} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm disabled:opacity-50">
              <i className="fas fa-microphone mr-1"></i>음성 녹음
            </button>
          ) : null}

          {/* 자동저장 상태 */}
          {autoSaveStatus === 'saving' && (
            <span className="text-xs text-gray-400 flex items-center"><i className="fas fa-spinner fa-spin mr-1"></i>저장 중...</span>
          )}
          {autoSaveStatus === 'saved' && (
            <span className="text-xs text-green-600 flex items-center"><i className="fas fa-check-circle mr-1"></i>자동저장됨</span>
          )}

          {/* 작성 방법 안내 */}
          <button onClick={() => setShowGuide(true)} className="px-2 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm" title="작성 방법 안내">
            <i className="fas fa-question-circle"></i>
          </button>

          {chart && (
            <button onClick={loadHistory} disabled={historyLoading} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm">
              <i className={`fas ${historyLoading ? 'fa-spinner fa-spin' : 'fa-history'} mr-1`}></i>히스토리
            </button>
          )}
          {isEditing ? (
            <>
              <button onClick={handleSave} className="px-3 py-1.5 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm font-semibold">
                <i className="fas fa-save mr-1"></i>저장
              </button>
              <button onClick={onClose} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm">
                <i className="fas fa-times mr-1"></i>닫기
              </button>
            </>
          ) : (
            <>
              {chart && (
                <button onClick={() => setIsEditing(true)} className="px-3 py-1.5 bg-white text-clinic-primary rounded-lg hover:bg-gray-100 text-sm font-medium">
                  <i className="fas fa-edit mr-1"></i>수정
                </button>
              )}
              <button onClick={onClose} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm">
                <i className="fas fa-times mr-1"></i>닫기
              </button>
            </>
          )}
        </div>
      </div>

      {/* 본문: 2단 레이아웃 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 왼쪽 사이드 패널 */}
        <div className="w-[200px] flex-shrink-0 border-r bg-gray-50 p-4 flex flex-col gap-4 overflow-y-auto">
          {isEditing && (
            <>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  <i className="fas fa-calendar-alt mr-1 text-clinic-primary"></i>진료일자
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={formData.chart_date || ''}
                    onChange={(e) => setFormData({ ...formData, chart_date: e.target.value })}
                    className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
                  />
                  <div className="w-full border rounded-lg px-3 py-2 text-sm bg-white cursor-pointer hover:border-clinic-primary">
                    {formData.chart_date ? (() => {
                      const d = new Date(formData.chart_date + 'T00:00:00');
                      const days = ['일', '월', '화', '수', '목', '금', '토'];
                      return `${d.getFullYear()}. ${String(d.getMonth()+1).padStart(2,'0')}. ${String(d.getDate()).padStart(2,'0')}. (${days[d.getDay()]})`;
                    })() : <span className="text-gray-400">날짜 선택</span>}
                  </div>
                </div>
              </div>
              <button className="w-full px-3 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 text-sm font-medium text-left">
                <i className="fas fa-clipboard-list mr-2"></i>설문지 가져오기
              </button>
              <button className="w-full px-3 py-2 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 text-sm font-medium text-left">
                <i className="fas fa-flask mr-2"></i>검사결과 보기
              </button>
            </>
          )}
          {!isEditing && chart && (
            <>
              <div>
                <span className="text-xs font-semibold text-gray-500">진료일자</span>
                <p className="text-sm font-medium text-gray-800 mt-1">{chart.chart_date ? (() => {
                  const d = new Date(chart.chart_date + 'T00:00:00');
                  const days = ['일', '월', '화', '수', '목', '금', '토'];
                  return `${d.getFullYear()}. ${String(d.getMonth()+1).padStart(2,'0')}. ${String(d.getDate()).padStart(2,'0')}. (${days[d.getDay()]})`;
                })() : '-'}</p>
              </div>
              <div>
                <span className="text-xs font-semibold text-gray-500">생성일</span>
                <p className="text-sm text-gray-600 mt-1">{chart.created_at ? new Date(chart.created_at).toLocaleString('ko-KR') : '-'}</p>
              </div>
            </>
          )}
        </div>

        {/* 오른쪽 메인 콘텐츠 */}
        <div className="flex-1 overflow-hidden p-4 flex flex-col">
          {/* 작성 방법 안내 모달 */}
          {showGuide && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70]" onClick={() => setShowGuide(false)}>
              <div className="bg-white rounded-xl shadow-2xl w-[420px] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between px-5 py-3 border-b bg-blue-50 rounded-t-xl">
                  <h3 className="text-base font-bold text-blue-800 flex items-center gap-2">
                    <i className="fas fa-info-circle"></i>작성 방법 안내
                  </h3>
                  <button onClick={() => setShowGuide(false)} className="text-gray-400 hover:text-gray-600">
                    <i className="fas fa-times"></i>
                  </button>
                </div>
                <div className="p-5 space-y-4">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-800 mb-1">대분류 (큰 섹션)</h4>
                    <p className="text-sm text-gray-600"><code className="bg-blue-100 px-1.5 py-0.5 rounded text-blue-800 font-mono">[제목]</code> 형식으로 작성</p>
                    <p className="text-xs text-gray-400 mt-1">예: [주소증], [문진], [복진], [처방]</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-800 mb-1">중분류 (세부 항목)</h4>
                    <p className="text-sm text-gray-600"><code className="bg-blue-100 px-1.5 py-0.5 rounded text-blue-800 font-mono">&gt; 제목</code> 형식으로 작성</p>
                    <p className="text-xs text-gray-400 mt-1">예: &gt; 식사패턴, &gt; 소화, &gt; 커피 등</p>
                  </div>
                  <div className="border-t pt-3 space-y-2">
                    <p className="text-xs text-green-600 flex items-center gap-1"><i className="fas fa-save"></i>입력 후 5초마다 자동저장됩니다</p>
                    <p className="text-xs text-purple-600 flex items-center gap-1"><i className="fas fa-microphone"></i>음성 녹음 후 자동으로 텍스트 변환됩니다</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 히스토리 패널 */}
          {showHistory && (
            <div className="mb-4 bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-800">
                  <i className="fas fa-history text-blue-500 mr-2"></i>
                  버전 히스토리
                </h3>
                <button
                  onClick={() => setShowHistory(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>
              {historyList.length === 0 ? (
                <p className="text-gray-500 text-sm">저장된 히스토리가 없습니다.</p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {historyList.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between bg-white border rounded-lg p-3 hover:bg-blue-50 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-blue-600">v{item.version}</span>
                          <span className="text-sm text-gray-500">
                            {new Date(item.saved_at).toLocaleString('ko-KR')}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">
                          {item.notes ? `${item.notes.substring(0, 50)}...` : '(내용 없음)'}
                        </p>
                      </div>
                      <button
                        onClick={() => restoreVersion(item)}
                        className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                      >
                        <i className="fas fa-undo mr-1"></i>복원
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {isEditing ? (
            <div className="flex flex-col flex-1 min-h-0">
                <textarea
                  ref={textareaRef}
                  value={formData.notes || ''}
                  onChange={(e) => {
                    const newNotes = e.target.value;
                    const extractedDate = extractDateFromText(newNotes);
                    if (extractedDate) {
                      const today = getCurrentDate();
                      if (!formData.chart_date || formData.chart_date === today) {
                        setFormData({ ...formData, notes: newNotes, chart_date: extractedDate });
                        return;
                      }
                    }
                    setFormData({ ...formData, notes: newNotes });
                  }}
                  className="w-full flex-1 border border-gray-300 rounded-lg p-4 resize-none focus:ring-2 focus:ring-clinic-primary focus:border-clinic-primary"
                  placeholder="[주소증] 여/38세/165cm/74kg&#10;1. 임신준비&#10;- 딸이 3명인데, 남아를 낳고 싶다.&#10;&#10;[문진]&#10;> 식사패턴 : 규칙적&#10;&#10;[복진]&#10;> 복직근 : 긴장+압통&#10;&#10;[처방]&#10;25/11/15 백인 소시호 귀비탕 15일분"
                  style={{ fontSize: '1.025em', lineHeight: '1.6', fontFamily: 'inherit' }}
                />
            </div>
          ) : chart ? (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-lg mb-4 text-clinic-text-primary flex items-center">
                  <i className="fas fa-clipboard-list text-clinic-primary mr-2"></i>
                  초진차트
                </h3>

                {(() => {
                  const sections = parseChartSections(chart.notes || '');

                  if (sections.length === 0) {
                    return (
                      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                        <p className="text-gray-500">내용이 없습니다.</p>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-4">
                      {sections.map((section, sectionIndex) => (
                        <div key={sectionIndex} className="bg-white border-2 border-clinic-primary rounded-lg overflow-hidden shadow-md">
                          {/* 대분류 제목 */}
                          <div className="bg-gradient-to-r from-clinic-primary to-clinic-secondary px-4 py-3">
                            <h4 className="font-bold text-white text-lg flex items-center">
                              <i className="fas fa-folder-open text-base mr-2"></i>
                              {section.title}
                            </h4>
                          </div>

                          {/* 대분류 직접 내용 (subsection 없이 바로 오는 내용) */}
                          {section.directContent && (
                            <div className="px-4 py-3 bg-blue-50 border-b border-gray-200">
                              <p className="text-clinic-text-primary whitespace-pre-wrap" style={{ lineHeight: '1.7', fontSize: '0.95rem' }}>
                                {section.directContent}
                              </p>
                            </div>
                          )}

                          {/* 중분류들 */}
                          {section.subsections.length > 0 && (
                            <div className="p-4 space-y-3">
                              {section.subsections.map((subsection, subIndex) => (
                                <div key={subIndex} className="border-l-4 border-clinic-secondary pl-4 py-2 bg-gray-50 rounded-r">
                                  <h5 className="font-semibold text-clinic-primary mb-2 flex items-center text-base">
                                    <i className="fas fa-angle-right text-sm mr-2"></i>
                                    {subsection.title}
                                  </h5>
                                  <div className="text-clinic-text-primary whitespace-pre-wrap ml-4" style={{ lineHeight: '1.7', fontSize: '0.9rem' }}>
                                    {subsection.content}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
              <div className="mt-4 text-sm text-clinic-text-secondary border-t pt-3">
                <div className="flex items-center mb-1">
                  <i className="fas fa-calendar-check mr-2 text-clinic-primary"></i>
                  <span className="font-semibold">진료일자:</span>
                  <span className="ml-2">{new Date(chart.chart_date).toLocaleDateString('ko-KR')}</span>
                </div>
                <div className="flex items-center">
                  <i className="fas fa-clock mr-2 text-gray-400"></i>
                  <span className="font-semibold">차트 생성일:</span>
                  <span className="ml-2">{new Date(chart.created_at).toLocaleString('ko-KR')}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <i className="fas fa-file-medical text-6xl text-gray-300 mb-4"></i>
              <p className="text-clinic-text-secondary mb-6 text-lg">초진차트가 없습니다</p>
              <button
                onClick={() => setIsEditing(true)}
                className="px-6 py-3 bg-clinic-primary text-white rounded-lg hover:bg-blue-900 transition-all transform hover:scale-105 font-semibold shadow-md"
              >
                <i className="fas fa-plus mr-2"></i>초진차트 작성
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const FormField: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <label className="block font-semibold mb-1">{label}</label>
    {children}
  </div>
);

const Section: React.FC<{ title: string; content?: string }> = ({ title, content }) => (
  content ? (
    <div>
      <h3 className="font-semibold text-lg mb-2">{title}</h3>
      <p className="whitespace-pre-wrap bg-gray-50 p-3 rounded">{content}</p>
    </div>
  ) : null
);

export default InitialChartView;
