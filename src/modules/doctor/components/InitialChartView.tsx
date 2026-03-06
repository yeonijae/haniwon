import React, { useState, useEffect, useRef } from 'react';
import { query, queryOne, execute, insert, escapeString, getCurrentTimestamp, getCurrentDate } from '@shared/lib/postgres';
import type { InitialChart, TreatmentPlan } from '../types';
import { useAudioRecorder } from '@modules/pad/hooks/useAudioRecorder';
import { transcribeAudio } from '@modules/pad/services/transcriptionService';
import { useFontScale } from '@shared/hooks/useFontScale';
import { useRecordingContext } from '../contexts/RecordingContext';

interface Props {
  patientId: number;
  patientName: string;
  chartId?: number; // 특정 차트 수정 시
  startEditing?: boolean; // 바로 편집 모드로 시작
  onClose: () => void;
  forceNew?: boolean; // 새진료 시작일 때 true
  treatmentPlan?: Partial<TreatmentPlan> | null; // 진료 계획 정보
  embedded?: boolean; // 메인 콘텐츠 영역에 인라인 배치
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

const InitialChartView: React.FC<Props> = ({ patientId, patientName, chartId, startEditing = false, onClose, forceNew = false, treatmentPlan, embedded = false }) => {
  const { addEntry, updateEntry: updateRecEntry } = useRecordingContext();
  const [recordingEntryId, setRecordingEntryId] = useState<string | null>(null);

  // 의사 정보는 props 또는 localStorage에서 가져옴
  const userName = (() => {
    try {
      const stored = localStorage.getItem('haniwon_user');
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed.name || '';
      }
    } catch {}
    return '';
  })();
  const [chart, setChart] = useState<InitialChart | null>(null);
  const [isEditing, setIsEditing] = useState(forceNew); // forceNew이면 바로 편집 모드
  const [loading, setLoading] = useState(!forceNew); // forceNew이면 로딩 안함
  const [formData, setFormData] = useState<Partial<InitialChart>>({});
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [isDirty, setIsDirty] = useState(false); // 사용자가 실제 수정했는지
  const [showHistory, setShowHistory] = useState(false);
  const [showTranscripts, setShowTranscripts] = useState(false);
  const [transcriptList, setTranscriptList] = useState<Array<{
    id: number;
    transcript: string;
    audio_path: string | null;
    duration_sec: number;
    created_at: string;
  }>>([]);
  const [transcriptLoading, setTranscriptLoading] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  // 누락 분석 관련
  interface MissingItem {
    section: string;
    content: string;
    importance: 'high' | 'medium';
  }
  interface TranscriptAnalysis {
    missing_items: MissingItem[];
    coaching: string;
  }
  const [transcriptAnalysis, setTranscriptAnalysis] = useState<TranscriptAnalysis | null>(null);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const { scale } = useFontScale('doctor');

  const handleClose = async () => {
    // 편집 모드에서 텍스트 영역에 입력된 내용이 있는지 확인
    const hasContent = isEditing && Object.entries(formData).some(([k, v]) => k !== 'chart_date' && typeof v === 'string' && v.trim());
    if (hasContent) {
      if (!confirm('자동저장된 내용이 있습니다. 작성을 취소하시겠습니까?')) return;
      // 자동저장된 차트 삭제 (히스토리는 보존 — 나중에 복원 가능)
      if (chart?.id && forceNew) {
        try {
          await execute(`DELETE FROM initial_charts WHERE id = ${chart.id}`);
          console.log('[InitialChartView] 자동저장 차트 삭제 완료 (히스토리 보존):', chart.id);
        } catch (err) {
          console.error('[InitialChartView] 자동저장 삭제 실패:', err);
        }
      }
    }
    onClose();
  };
  const [historyList, setHistoryList] = useState<ChartHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showSurveyList, setShowSurveyList] = useState(false);
  const [surveyList, setSurveyList] = useState<Array<{
    session_id: number;
    template_name: string;
    completed_at: string;
    answers: any[];
    template_questions: any[];
    session: any;
  }>>([]);
  const [surveyLoading, setSurveyLoading] = useState(false);

  // 녹음 관련
  const [isTranscribing, setIsTranscribing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const {
    isRecording,
    isPaused,
    recordingTime,
    audioLevel,
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

  // 녹음 중지 및 텍스트 변환 + 저장
  const handleStopRecording = async () => {
    try {
      const audioBlob = await stopRecording();
      if (!audioBlob) {
        console.error('녹음 데이터가 없습니다');
        return;
      }

      setIsTranscribing(true);
      if (recordingEntryId) updateRecEntry(recordingEntryId, { status: 'saving', duration: recordingTime });

      // 1. 음성 파일 서버에 업로드 (필수 — 실패 시 중단)
      let audioPath: string | null = null;
      try {
        const { uploadAudioFile } = await import('@modules/pad/services/transcriptionService');
        audioPath = await uploadAudioFile(audioBlob, patientId, 0);
        console.log('[녹음] 음성 파일 저장:', audioPath);
      } catch (uploadErr: any) {
        console.error('[녹음] 음성 파일 업로드 실패:', uploadErr);
        if (recordingEntryId) updateRecEntry(recordingEntryId, { status: 'error', errorMessage: '파일 업로드 실패' });
        alert(`⚠️ 음성 파일 업로드에 실패했습니다.\n${uploadErr?.message || ''}\n\n녹음을 다시 시도해주세요.`);
        setIsTranscribing(false);
        return;
      }

      // 2. Whisper로 텍스트 변환
      if (recordingEntryId) updateRecEntry(recordingEntryId, { status: 'transcribing' });
      const result = await transcribeAudio(audioBlob, {
        prompt: '한의원 초진 상담. 환자 주소증, 병력, 문진 내용.',
      });

      const transcript = result.success ? result.transcript : '';

      // 3. medical_transcripts 테이블에 저장 (음성파일 경로 + 텍스트)
      try {
        const { saveMedicalTranscript } = await import('@modules/pad/services/transcriptionService');
        const recordingDate = new Date().toISOString();
        const transcriptId = await saveMedicalTranscript({
          actingId: 0,
          patientId,
          doctorId: 0,
          doctorName: userName,
          actingType: 'initial_chart',
          audioPath: audioPath || undefined,
          transcript: transcript || '',
          diarizedTranscript: null,
          durationSec: recordingTime,
          recordingDate,
        });
        console.log('[녹음] medical_transcripts 저장 완료, id:', transcriptId);
        // 환자명, 차트번호 업데이트
        if (transcriptId) {
          const patientInfo = await queryOne<{ name: string; chart_number: string }>(
            `SELECT name, chart_number FROM patients WHERE id = ${patientId}`
          );
          if (patientInfo) {
            await execute(
              `UPDATE medical_transcripts SET patient_name = ${escapeString(patientInfo.name)}, chart_number = ${escapeString(patientInfo.chart_number)} WHERE id = ${transcriptId}`
            );
          }
        }
      } catch (saveErr) {
        console.warn('[녹음] DB 저장 실패:', saveErr);
      }

      // 4. 변환 성공 시 누락 분석 실행
      if (result.success && transcript) {
        setIsAnalyzing(true);
        if (recordingEntryId) updateRecEntry(recordingEntryId, { status: 'analyzing' });
        try {
          const analysisRes = await fetch('http://192.168.0.48:3200/api/gpt/chart-analysis', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chart_notes: formData.notes || '',
              transcript: transcript,
            }),
          });
          const analysisData = await analysisRes.json();
          if (analysisData.success) {
            setTranscriptAnalysis({
              missing_items: analysisData.missing_items || [],
              coaching: analysisData.coaching || '',
            });
            setShowAnalysis(true);
            if (recordingEntryId) updateRecEntry(recordingEntryId, { status: 'completed', transcript: transcript.substring(0, 50) });
          } else {
            if (recordingEntryId) updateRecEntry(recordingEntryId, { status: 'completed', transcript: transcript.substring(0, 50) });
            alert(`✅ 녹취 저장 완료\n⚠️ 누락 분석 실패: ${analysisData.error || ''}`);
          }
        } catch (analysisErr) {
          console.error('누락 분석 실패:', analysisErr);
          alert(`✅ 녹취 저장 완료 (${recordingTime}초)\n⚠️ 누락 분석 서버에 연결할 수 없습니다.`);
        } finally {
          setIsAnalyzing(false);
        }
      } else {
        if (recordingEntryId) updateRecEntry(recordingEntryId, { status: 'error', errorMessage: '텍스트 변환 실패' });
        alert(`⚠️ 음성 파일은 저장되었지만, 텍스트 변환에 실패했습니다.\n${result.error || ''}`);
      }
    } catch (error) {
      console.error('녹음 처리 실패:', error);
      if (recordingEntryId) updateRecEntry(recordingEntryId, { status: 'error', errorMessage: '처리 중 오류' });
      alert('녹음 처리 중 오류가 발생했습니다.');
    } finally {
      setIsTranscribing(false);
    }
  };

  // 녹취 목록 로드
  const loadTranscripts = async () => {
    setTranscriptLoading(true);
    try {
      const data = await query<{
        id: number;
        transcript: string;
        audio_path: string | null;
        duration_sec: number;
        created_at: string;
      }>(`SELECT id, transcript, audio_path, duration_sec, created_at
          FROM medical_transcripts
          WHERE patient_id = ${patientId}
          ORDER BY created_at DESC
          LIMIT 20`);
      setTranscriptList(data || []);
      setShowTranscripts(true);
    } catch (error) {
      console.error('녹취 목록 로드 실패:', error);
      alert('녹취 목록을 불러오는데 실패했습니다.');
    } finally {
      setTranscriptLoading(false);
    }
  };

  // 녹취 텍스트를 차트에 삽입
  const insertTranscript = (transcript: string) => {
    const currentNotes = formData.notes || '';
    const separator = currentNotes.trim() ? '\n\n[녹취 가져오기]\n' : '';
    const newNotes = currentNotes + separator + transcript;
    setFormData({ ...formData, notes: newNotes });
    setShowTranscripts(false);
    // 스크롤 맨 아래로
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
      }
    }, 100);
  };

  // 누락 항목을 차트 notes에 삽입
  const insertMissingItem = (item: MissingItem) => {
    const currentNotes = formData.notes || '';
    const sectionTag = `[${item.section}]`;
    const idx = currentNotes.indexOf(sectionTag);
    let newNotes: string;
    if (idx !== -1) {
      // 해당 섹션 끝(다음 섹션 시작 전)에 삽입
      const afterSection = currentNotes.substring(idx + sectionTag.length);
      const nextSectionMatch = afterSection.search(/\n\[/);
      const insertPos = nextSectionMatch !== -1
        ? idx + sectionTag.length + nextSectionMatch
        : currentNotes.length;
      newNotes = currentNotes.substring(0, insertPos) + '\n' + item.content + currentNotes.substring(insertPos);
    } else {
      // 섹션이 없으면 끝에 추가
      newNotes = currentNotes + `\n\n${sectionTag}\n${item.content}`;
    }
    setFormData({ ...formData, notes: newNotes });
    setIsDirty(true);
  };

  const insertAllMissingItems = () => {
    if (!transcriptAnalysis) return;
    let currentNotes = formData.notes || '';
    for (const item of transcriptAnalysis.missing_items) {
      const sectionTag = `[${item.section}]`;
      const idx = currentNotes.indexOf(sectionTag);
      if (idx !== -1) {
        const afterSection = currentNotes.substring(idx + sectionTag.length);
        const nextSectionMatch = afterSection.search(/\n\[/);
        const insertPos = nextSectionMatch !== -1
          ? idx + sectionTag.length + nextSectionMatch
          : currentNotes.length;
        currentNotes = currentNotes.substring(0, insertPos) + '\n' + item.content + currentNotes.substring(insertPos);
      } else {
        currentNotes = currentNotes + `\n\n${sectionTag}\n${item.content}`;
      }
    }
    setFormData({ ...formData, notes: currentNotes });
    setIsDirty(true);
    setShowAnalysis(false);
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

  // 자동 저장 (3초 디바운스) — 사용자 입력이 있을 때만
  useEffect(() => {
    if (!isEditing || !isDirty || !formData.notes || !formData.chart_date) {
      return;
    }

    setAutoSaveStatus('idle');

    const timer = setTimeout(async () => {
      await autoSave();
    }, 3000); // 3초 대기

    return () => clearTimeout(timer);
  }, [formData.notes, formData.chart_date, isEditing, isDirty]);

  const loadChart = async () => {
    try {
      setLoading(true);
      const data = chartId
        ? await queryOne<InitialChart>(`SELECT * FROM initial_charts WHERE id = ${chartId}`)
        : await queryOne<InitialChart>(`SELECT * FROM initial_charts WHERE patient_id = ${patientId} ORDER BY created_at DESC LIMIT 1`);

      if (data) {
        setChart(data);
        // chart_date를 YYYY-MM-DD 포맷으로 정규화 (없으면 오늘)
        const normalizedDate = data.chart_date ? data.chart_date.split('T')[0] : getCurrentDate();
        setFormData({ ...data, chart_date: normalizedDate });
        if (startEditing) setIsEditing(true);
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

  const isSavingRef = useRef(false);

  const autoSave = async () => {
    if (isSavingRef.current) return; // 이미 저장 중이면 스킵
    isSavingRef.current = true;
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
        await execute(`
          INSERT INTO initial_charts (patient_id, notes, chart_date, treatment_plan_id, created_at, updated_at)
          VALUES (${patientId}, ${escapeString(notes)}, ${escapeString(chartDate)}, ${planId}, ${escapeString(now)}, ${escapeString(now)})
        `);

        // INSERT 후 ID 조회
        const inserted = await queryOne<InitialChart>(
          `SELECT * FROM initial_charts WHERE patient_id = ${patientId} ORDER BY id DESC LIMIT 1`
        );

        if (inserted) {
          // 진료계획이 있으면 양방향 연결
          if (planId) {
            await execute(`
              UPDATE treatment_plans SET initial_chart_id = ${inserted.id}, updated_at = ${escapeString(now)}
              WHERE id = ${planId}
            `);
            console.log('자동저장: 진료계획-초진차트 양방향 연결 완료');
          }

          // 첫 저장도 히스토리에 기록 (취소 후 복원 가능하도록)
          await execute(`
            INSERT INTO initial_charts_history (initial_chart_id, patient_id, notes, chart_date, saved_at, version)
            VALUES (${inserted.id}, ${patientId}, ${escapeString(notes)}, ${escapeString(chartDate)}, ${escapeString(now)}, 1)
          `);

          setChart(inserted);
          console.log('자동저장 완료 (새 차트 + 히스토리 v1), id:', inserted.id);
        }
      } else {
        // 기존 차트 업데이트 (chart가 이미 있으면)

        // 1. 차트 업데이트 먼저
        await execute(`
          UPDATE initial_charts SET
            notes = ${escapeString(notes)},
            chart_date = ${escapeString(chartDate)},
            updated_at = ${escapeString(now)}
          WHERE id = ${chart.id}
        `);

        // 2. 업데이트된 최신 상태를 히스토리에 저장
        const lastVersion = await queryOne<{ max_version: number }>(
          `SELECT COALESCE(MAX(version), 0) as max_version FROM initial_charts_history WHERE initial_chart_id = ${chart.id}`
        );
        const newVersion = (lastVersion?.max_version || 0) + 1;

        await execute(`
          INSERT INTO initial_charts_history (initial_chart_id, patient_id, notes, chart_date, saved_at, version)
          VALUES (${chart.id}, ${patientId}, ${escapeString(notes)}, ${escapeString(chartDate)}, ${escapeString(now)}, ${newVersion})
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
    } finally {
      isSavingRef.current = false;
    }
  };

  // 히스토리 목록 조회
  const loadHistory = async () => {
    try {
      setHistoryLoading(true);
      // chart가 있으면 해당 차트의 히스토리, 없으면 환자의 모든 히스토리
      const history = chart
        ? await query<ChartHistory>(
            `SELECT * FROM initial_charts_history
             WHERE initial_chart_id = ${chart.id}
             ORDER BY version DESC
             LIMIT 20`
          )
        : await query<ChartHistory>(
            `SELECT * FROM initial_charts_history
             WHERE patient_id = ${patientId}
             ORDER BY saved_at DESC
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
    const confirmed = confirm(`버전 ${historyItem.version}으로 복원하시겠습니까?\n(${new Date(historyItem.saved_at).toLocaleString('ko-KR')})`);
    if (!confirmed) return;

    try {
      if (chart) {
        // 기존 차트가 있으면 현재 상태를 먼저 히스토리에 저장
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
      }

      // formData도 업데이트 (새 차트든 기존 차트든)
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

      // 진료일자가 없으면 오늘 날짜 자동 세팅
      const chartDateStr = formData.chart_date || getCurrentDate();
      if (!formData.chart_date) {
        setFormData({ ...formData, chart_date: chartDateStr });
      }

      const now = getCurrentTimestamp();
      const chartDate = new Date(chartDateStr).toISOString();
      const notes = formData.notes.trim();

      console.log('저장 데이터:', { patientId, notes: notes.substring(0, 50), chartDate });

      if (forceNew && !chart) {
        // 새진료 시작 & 자동저장된 차트가 없을 때만 insert
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

        alert('초진차트가 저장되었습니다');
        onClose();
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

  const loadSurveys = async () => {
    setSurveyLoading(true);
    try {
      const sessions = await query<{
        id: number; template_id: number; template_name: string;
        patient_name: string; chart_number: string; age: number; gender: string; completed_at: string;
      }>(`
        SELECT s.id, s.template_id, t.name as template_name,
               s.patient_name, s.chart_number, s.age, s.gender, s.completed_at
        FROM survey_sessions s
        LEFT JOIN survey_templates t ON s.template_id = t.id
        WHERE s.patient_id = ${patientId} AND s.status = 'completed'
        ORDER BY s.completed_at DESC
        LIMIT 3
      `);
      if (!sessions || sessions.length === 0) { setSurveyList([]); return; }
      const list = await Promise.all(sessions.map(async (session) => {
        const response = await query<{ answers: any }>(`
          SELECT answers FROM survey_responses WHERE session_id = ${session.id} ORDER BY submitted_at DESC LIMIT 1
        `);
        const template = await query<{ questions: any }>(`
          SELECT questions FROM survey_templates WHERE id = ${session.template_id}
        `);
        return {
          session_id: session.id,
          template_name: session.template_name || '설문',
          completed_at: session.completed_at,
          answers: response?.[0]?.answers || [],
          template_questions: template?.[0]?.questions || [],
          session,
        };
      }));
      setSurveyList(list);
    } catch (error) {
      console.error('설문지 로드 실패:', error);
    } finally {
      setSurveyLoading(false);
    }
  };

  const formatSurveyToNotes = (item: typeof surveyList[0]): string => {
    const questions = Array.isArray(item.template_questions)
      ? item.template_questions
      : (typeof item.template_questions === 'string' ? JSON.parse(item.template_questions) : []);
    const answers = Array.isArray(item.answers)
      ? item.answers
      : (typeof item.answers === 'string' ? JSON.parse(item.answers) : []);
    const getAnswer = (qId: string) => answers.find((a: any) => a.question_id === qId);
    const hasAnswer = (qId: string) => {
      const a = getAnswer(qId);
      if (!a) return false;
      if (Array.isArray(a.answer)) return a.answer.length > 0;
      return !!a.answer && String(a.answer).trim() !== '';
    };
    const ga = (qId: string) => {
      const a = getAnswer(qId);
      if (!a) return '';
      return Array.isArray(a.answer) ? a.answer.join(', ') : String(a.answer);
    };
    const result: string[] = [];
    const session = item.session;

    // 헤더: 환자이름(차트번호) 날짜 - 담당의
    const chartNo = session.chart_number || '';
    const today = new Date();
    const dateStr = `${String(today.getFullYear()).slice(2)}/${String(today.getMonth() + 1)}/${String(today.getDate())}`;
    const doctor = ga('doctor') || session.doctor_name || '';
    const headerParts = [`${patientName}(${chartNo})`, dateStr];
    if (doctor) headerParts.push(`- ${doctor}`);
    result.push(headerParts.join(' '));

    // [주소증] 환자정보
    const genderAge = [
      session.gender ? (session.gender === 'M' ? '남' : session.gender === 'F' ? '여' : session.gender) : '',
      session.age != null ? `${session.age}세` : '',
    ].filter(Boolean).join('/');
    const heightWeight = ga('height_weight');
    const basicParts = [genderAge, heightWeight].filter(Boolean).join('/');
    result.push(`[주소증] ${basicParts || ''}`);

    // [문진] 설문지에서 가져온 내용
    const lines: string[] = [];
    let currentSection = '';
    for (const q of questions) {
      if (!hasAnswer(q.id)) continue;
      const txt = ga(q.id);
      if (['name', 'chart_number', 'doctor', 'gender_age', 'height_weight'].includes(q.id)) continue;
      if (q.question_text.startsWith('>')) {
        if (lines.length > 0 && currentSection) lines.push('');
        currentSection = q.question_text;
        lines.push(`${q.question_text} ${txt}`);
      } else if (q.question_text.startsWith('-')) {
        lines.push(`${q.question_text} ${txt}`);
      } else {
        lines.push(`${q.question_text}: ${txt}`);
      }
    }
    result.push('');
    result.push('[문진]');
    if (lines.length > 0) result.push(...lines);

    // [복진]
    result.push('');
    result.push('[복진]');
    result.push('> 복피 :');
    result.push('> 복외측 :');
    result.push('> 복직근 :');
    result.push('> 심하부 :');
    result.push('> 임맥선 :');
    result.push('> 하복부 :');
    result.push('> 흉협부 :');
    result.push('> 심흉부 :');

    // [설진]
    result.push('');
    result.push('[설진]');

    // [맥진]
    result.push('');
    result.push('[맥진]');
    result.push('- 촌구맥 :');
    result.push('- 인영맥 :');

    // [혈색]
    result.push('');
    result.push('[혈색]');
    result.push('- 하안검 :');
    result.push('- 손톱 :');
    result.push('- 입술 :');

    // [티칭]
    result.push('');
    result.push('[티칭]');

    // [처방]
    result.push('');
    result.push('[처방]');

    return result.join('\n');
  };

  return (
    <div className={embedded ? "bg-white flex flex-col overflow-hidden h-full" : "fixed inset-0 bg-white flex flex-col overflow-hidden"} style={embedded ? { fontSize: `${scale}em` } : { left: '220px', top: '56px', zIndex: 60, fontSize: `${scale}em` }}>
      {/* 본문: 2단 레이아웃 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 왼쪽 사이드 패널 */}
        <div className="w-[200px] flex-shrink-0 bg-white p-4 flex flex-col gap-3 overflow-y-auto">
          {/* 제목 + 자동저장 상태 */}
          <div>
            <h2 className="font-bold text-gray-800 mb-1 text-center" style={{ fontSize: '1.125rem' }}>초진차트 작성</h2>
            {autoSaveStatus === 'saving' && (
              <span className="text-xs text-gray-400 flex items-center justify-center"><i className="fas fa-spinner fa-spin mr-1"></i>저장 중...</span>
            )}
            {autoSaveStatus === 'saved' && (
              <span className="text-xs text-green-600 flex items-center justify-center"><i className="fas fa-check-circle mr-1"></i>자동저장됨</span>
            )}
          </div>

          {/* 날짜 / 음성녹음 / 저장 / 닫기 */}
          <div className="space-y-2">
            {isEditing && (
              <div className="occ-date-wrap">
                <input
                  type="date"
                  value={formData.chart_date || ''}
                  onChange={(e) => { setFormData({ ...formData, chart_date: e.target.value }); setIsDirty(true); }}
                  className="occ-date-hidden"
                  id="initial-chart-date-picker"
                />
                <button
                  type="button"
                  className="w-full px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium text-center"
                  onClick={() => {
                    const el = document.getElementById('initial-chart-date-picker') as HTMLInputElement;
                    el?.showPicker?.();
                  }}
                >
                  <i className="fas fa-calendar-alt mr-2 text-clinic-primary"></i>
                  {formData.chart_date ? (() => {
                    const d = new Date(formData.chart_date + 'T00:00:00');
                    const days = ['일', '월', '화', '수', '목', '금', '토'];
                    return `${d.getFullYear()}. ${String(d.getMonth()+1).padStart(2,'0')}. ${String(d.getDate()).padStart(2,'0')}. (${days[d.getDay()]})`;
                  })() : '날짜 선택'}
                </button>
              </div>
            )}
            {!isEditing && chart && (
              <div className="text-center">
                <span className="text-xs font-semibold text-gray-500">진료일자</span>
                <p className="text-sm font-medium text-gray-800 mt-1">{chart.chart_date ? (() => {
                  const d = new Date(chart.chart_date + 'T00:00:00');
                  const days = ['일', '월', '화', '수', '목', '금', '토'];
                  return `${d.getFullYear()}. ${String(d.getMonth()+1).padStart(2,'0')}. ${String(d.getDate()).padStart(2,'0')}. (${days[d.getDay()]})`;
                })() : '-'}</p>
              </div>
            )}

            {isRecording && (
              <div className="px-3 py-2 bg-red-50 rounded-lg border border-red-200">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                  <span className="text-sm font-medium text-red-700">{formatRecordingTime(recordingTime)}</span>
                  <span className="text-xs text-red-400 ml-auto">{isPaused ? '일시정지' : '녹음중'}</span>
                </div>
                {/* 오디오 레벨 바 */}
                <div className="flex items-end gap-[2px] h-8 justify-center">
                  {Array.from({ length: 20 }).map((_, i) => {
                    const barLevel = isPaused ? 0.02 : audioLevel;
                    const threshold = (i + 1) / 20;
                    const active = barLevel >= threshold * 0.7;
                    const height = active
                      ? Math.max(15, Math.min(100, barLevel * 100 + Math.sin(Date.now() / 100 + i) * 15))
                      : 10 + Math.sin(Date.now() / 300 + i * 0.5) * 3;
                    return (
                      <div
                        key={i}
                        className="rounded-full transition-all duration-75"
                        style={{
                          width: '3px',
                          height: `${height}%`,
                          backgroundColor: active
                            ? barLevel > 0.6 ? '#ef4444' : barLevel > 0.3 ? '#f59e0b' : '#22c55e'
                            : '#e5e7eb',
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            )}
            {isTranscribing && (
              <div className="flex items-center gap-2 px-3 py-2 bg-yellow-100 rounded-lg">
                <i className="fas fa-spinner fa-spin text-yellow-600"></i>
                <span className="text-sm text-yellow-700">변환 중...</span>
              </div>
            )}
            {isAnalyzing && (
              <div className="flex items-center gap-2 px-3 py-2 bg-blue-100 rounded-lg">
                <i className="fas fa-spinner fa-spin text-blue-600"></i>
                <span className="text-sm text-blue-700">누락 분석 중...</span>
              </div>
            )}
            {isRecording ? (
              <div className="flex gap-1">
                {isPaused ? (
                  <button onClick={resumeRecording} className="flex-1 px-2 py-1.5 bg-green-500 text-white rounded-lg hover:bg-green-600 text-xs">
                    <i className="fas fa-play mr-1"></i>계속
                  </button>
                ) : (
                  <button onClick={pauseRecording} className="flex-1 px-2 py-1.5 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 text-xs">
                    <i className="fas fa-pause mr-1"></i>일시정지
                  </button>
                )}
                <button onClick={handleStopRecording} disabled={isTranscribing} className="flex-1 px-2 py-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 text-xs disabled:opacity-50">
                  <i className="fas fa-stop mr-1"></i>완료
                </button>
              </div>
            ) : isEditing ? (
              <button onClick={async () => {
                const ok = await startRecording();
                if (ok) {
                  const entryId = addEntry({
                    patientName: patientName,
                    chartNumber: String(patientId),
                    patientId: patientId,
                    status: 'recording',
                  });
                  setRecordingEntryId(entryId);
                } else if (recordingError) {
                  alert(recordingError);
                } else {
                  alert('녹음을 시작할 수 없습니다. 마이크 권한을 확인해주세요.\n(HTTP 환경에서는 Chrome의 경우 chrome://flags에서 insecure origins 허용이 필요할 수 있습니다)');
                }
              }} disabled={isTranscribing} className="w-full px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm disabled:opacity-50 text-center">
                <i className="fas fa-microphone mr-2 text-red-400"></i>음성 녹음
              </button>
            ) : null}
            {recordingError && (
              <div className="text-xs text-red-500 px-2">{recordingError}</div>
            )}

            {isEditing ? (
              <button onClick={handleSave} className="w-full px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium text-center">
                <i className="fas fa-save mr-2"></i>저장
              </button>
            ) : chart ? (
              <button onClick={() => setIsEditing(true)} className="w-full px-3 py-1.5 bg-white hover:bg-gray-100 text-clinic-primary border border-gray-200 rounded-lg text-sm font-medium text-center">
                <i className="fas fa-edit mr-2"></i>수정
              </button>
            ) : null}
            <button onClick={handleClose} className="w-full px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm text-center">
              <i className="fas fa-times mr-2 text-gray-400"></i>닫기
            </button>
          </div>

          <hr className="border-gray-200" />

          {/* 설문지 / 검사결과 / 히스토리 */}
          {isEditing && (
            <div className="space-y-2">
              <button
                onClick={() => {
                  if (!showSurveyList) loadSurveys();
                  setShowSurveyList(!showSurveyList);
                }}
                className="w-full px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 text-sm font-medium text-center"
              >
                <i className="fas fa-clipboard-list mr-2"></i>설문지 가져오기
                <i className={`fas fa-chevron-${showSurveyList ? 'up' : 'down'} float-right mt-0.5`}></i>
              </button>
              {showSurveyList && (
                <div className="ml-2 space-y-1">
                  {surveyLoading ? (
                    <div className="text-xs text-gray-500 py-2 text-center">
                      <i className="fas fa-spinner fa-spin mr-1"></i>로딩 중...
                    </div>
                  ) : surveyList.length === 0 ? (
                    <div className="text-xs text-gray-400 py-2 text-center">작성된 설문이 없습니다</div>
                  ) : (
                    surveyList.map((item) => (
                      <button
                        key={item.session_id}
                        onClick={() => {
                          const notes = formatSurveyToNotes(item);
                          setFormData({ ...formData, notes });
                          setShowSurveyList(false);
                        }}
                        className="w-full px-3 py-2 bg-white border border-blue-200 rounded-lg hover:bg-blue-50 hover:border-blue-400 text-center transition-colors"
                      >
                        <div className="text-sm font-medium text-blue-800">{item.template_name}</div>
                        <div className="text-xs text-gray-500">
                          {new Date(item.completed_at).toLocaleDateString('ko-KR')} {new Date(item.completed_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
              <button className="w-full px-3 py-1.5 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 text-sm font-medium text-center">
                <i className="fas fa-flask mr-2"></i>검사결과 보기
              </button>
              <button
                onClick={() => {
                  if (!showHistory) loadHistory();
                  else setShowHistory(false);
                }}
                disabled={historyLoading}
                className="w-full px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 text-sm font-medium text-center"
              >
                <i className={`fas ${historyLoading ? 'fa-spinner fa-spin' : 'fa-history'} mr-2`}></i>히스토리 가져오기
                <i className={`fas fa-chevron-${showHistory ? 'up' : 'down'} float-right mt-0.5`}></i>
              </button>
              {showHistory && (
                <div className="ml-2 space-y-1">
                  {historyList.length === 0 ? (
                    <div className="text-xs text-gray-400 py-2 text-center">저장된 히스토리가 없습니다</div>
                  ) : (
                    historyList.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => {
                          if (confirm(`v${item.version} 버전으로 불러오시겠습니까? 현재 내용이 덮어씌워집니다.`)) {
                            restoreVersion(item);
                            setShowHistory(false);
                          }
                        }}
                        className="w-full px-3 py-2 bg-white border border-amber-200 rounded-lg hover:bg-amber-50 hover:border-amber-400 text-center transition-colors"
                      >
                        <div className="text-sm font-medium text-amber-800">v{item.version}</div>
                        <div className="text-xs text-gray-500">
                          {new Date(item.saved_at).toLocaleDateString('ko-KR')} {new Date(item.saved_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <div className="text-xs text-gray-400 truncate mt-0.5">
                          {item.notes?.substring(0, 30) || '(내용 없음)'}...
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}

              {/* 녹취 가져오기 */}
              <button
                onClick={() => {
                  if (!showTranscripts) loadTranscripts();
                  else setShowTranscripts(false);
                }}
                disabled={transcriptLoading}
                className="w-full px-3 py-1.5 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 text-sm font-medium text-center"
              >
                <i className={`fas ${transcriptLoading ? 'fa-spinner fa-spin' : 'fa-file-audio'} mr-2`}></i>녹취 가져오기
                <i className={`fas fa-chevron-${showTranscripts ? 'up' : 'down'} float-right mt-0.5`}></i>
              </button>
              {showTranscripts && (
                <div className="ml-2 space-y-1">
                  {transcriptList.length === 0 ? (
                    <div className="text-xs text-gray-400 py-2 text-center">저장된 녹취가 없습니다</div>
                  ) : (
                    transcriptList.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => {
                          if (confirm('이 녹취를 차트에 삽입하시겠습니까?')) {
                            insertTranscript(item.transcript);
                          }
                        }}
                        className="w-full px-3 py-2 bg-white border border-purple-200 rounded-lg hover:bg-purple-50 hover:border-purple-400 text-left transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-purple-600 font-medium">
                            <i className="fas fa-microphone mr-1"></i>
                            {item.duration_sec ? `${Math.floor(item.duration_sec / 60)}분 ${item.duration_sec % 60}초` : '시간 미상'}
                          </span>
                          <span className="text-xs text-gray-400">
                            {new Date(item.created_at).toLocaleDateString('ko-KR')}
                          </span>
                        </div>
                        <div className="text-xs text-gray-600 mt-1 line-clamp-2">
                          {item.transcript?.substring(0, 80) || '(텍스트 없음)'}
                          {(item.transcript?.length || 0) > 80 ? '...' : ''}
                        </div>
                        {item.audio_path && (
                          <div className="text-xs text-purple-400 mt-0.5">
                            <i className="fas fa-volume-up mr-1"></i>음성 파일 있음
                          </div>
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
          {!isEditing && chart && (
            <div className="text-center">
              <span className="text-xs font-semibold text-gray-500">생성일</span>
              <p className="text-sm text-gray-600 mt-1">{chart.created_at ? new Date(chart.created_at).toLocaleString('ko-KR') : '-'}</p>
            </div>
          )}
        </div>

        {/* 오른쪽 메인 콘텐츠 */}
        <div className="flex-1 overflow-hidden pl-0 pr-4 py-4 flex flex-col">
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
                    <p className="text-xs text-green-600 flex items-center gap-1"><i className="fas fa-save"></i>입력 후 3초마다 자동저장됩니다</p>
                    <p className="text-xs text-purple-600 flex items-center gap-1"><i className="fas fa-microphone"></i>음성 녹음 후 자동으로 텍스트 변환됩니다</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 히스토리는 사이드패널에서만 표시 */}

          {/* 누락 분석 패널 */}
          {showAnalysis && transcriptAnalysis && (
            <div className="mb-3 border border-blue-300 rounded-lg bg-blue-50 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 bg-blue-100 border-b border-blue-200">
                <h4 className="text-sm font-bold text-blue-800">
                  <i className="fas fa-search-plus mr-2"></i>
                  녹취 누락 분석 ({transcriptAnalysis.missing_items.length}건)
                </h4>
                <div className="flex gap-2">
                  {transcriptAnalysis.missing_items.length > 0 && (
                    <button onClick={insertAllMissingItems} className="px-3 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-600 font-medium">
                      <i className="fas fa-check-double mr-1"></i>모두 삽입
                    </button>
                  )}
                  <button onClick={() => setShowAnalysis(false)} className="px-3 py-1 bg-gray-400 text-white rounded text-xs hover:bg-gray-500">
                    <i className="fas fa-times mr-1"></i>닫기
                  </button>
                </div>
              </div>
              <div className="p-3 max-h-[300px] overflow-y-auto space-y-2">
                {transcriptAnalysis.missing_items.length === 0 ? (
                  <p className="text-sm text-green-700 text-center py-2"><i className="fas fa-check-circle mr-1"></i>누락된 항목이 없습니다!</p>
                ) : (
                  transcriptAnalysis.missing_items.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-2 bg-white rounded-lg p-2.5 border border-gray-200">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold text-white flex-shrink-0 mt-0.5 ${item.importance === 'high' ? 'bg-red-500' : 'bg-orange-400'}`}>
                        {item.section}
                      </span>
                      <p className="text-sm text-gray-700 flex-1">{item.content}</p>
                      <button
                        onClick={() => insertMissingItem(item)}
                        className="px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600 flex-shrink-0"
                      >
                        삽입
                      </button>
                    </div>
                  ))
                )}
                {transcriptAnalysis.coaching && (
                  <div className="mt-2 pt-2 border-t border-blue-200">
                    <p className="text-xs text-blue-700"><i className="fas fa-lightbulb mr-1 text-yellow-500"></i>{transcriptAnalysis.coaching}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {isEditing ? (
            <div className="flex flex-col flex-1 min-h-0">
                <textarea
                  ref={textareaRef}
                  value={formData.notes || ''}
                  onChange={(e) => {
                    const newNotes = e.target.value;
                    setIsDirty(true);
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
                  placeholder={"💡 입력 후 3초마다 자동저장됩니다\n💡 설문지 가져오기로 자동 입력 가능\n💡 히스토리에서 이전 버전 복원 가능\n─────────────────────\n환자이름(차트번호) 날짜 - 담당의\n[주소증] 성별/나이/키/몸무게\n\n[문진]\n> 섹션제목 내용\n- 세부항목 내용\n\n[복진]\n> 복피 :\n> 복직근 :\n> 심하부 :\n\n[설진]\n\n[맥진]\n- 촌구맥 :\n- 인영맥 :\n\n[혈색]\n- 하안검 :\n- 손톱 :\n- 입술 :\n\n[티칭]\n\n[처방]\n날짜 처방명 일수"}
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
