import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { query, queryOne, execute, insert, escapeString, toSqlValue, getCurrentTimestamp, getCurrentDate } from '@shared/lib/postgres';
import type { InitialChart } from '../types';
import PrescriptionInput, { PrescriptionData } from './PrescriptionInput';
import PrescriptionIssuedList from './PrescriptionIssuedList';
import DosageList from './DosageList';
import InitialChartView from './InitialChartView';
import { useFontScale } from '@shared/hooks/useFontScale';

interface ProgressEntry {
  id: number;
  entry_date: string;
  treatment: string;  // 진료 (objective)
  diagnosis: string;  // 진단 (assessment)
  prescription: string;  // 처방 (plan)
  notes: string;  // 상세 기록 (notes) - LegacyChartImporter에서 저장한 데이터
  prescription_issued: boolean;  // 처방전 발급 여부
  prescription_issued_at?: string;  // 처방전 발급 시각
  created_at: string;
}

interface Props {
  recordId: number;
  patientName: string;
  patientInfo?: {
    chartNumber?: string;
    dob?: string;
    gender?: string;
    age?: number | null;
  };
  onClose: () => void;
  embedded?: boolean;
  autoOpenPrescription?: boolean;
  autoOpenDosage?: boolean;
  onOpenDosageCreator?: (state: any) => void;
}

const MedicalRecordDetail: React.FC<Props> = ({ recordId, patientName, patientInfo, onClose, embedded = false, autoOpenPrescription = false, autoOpenDosage = false, onOpenDosageCreator }) => {
  const navigate = useNavigate();
  const { scale } = useFontScale('doctor');
  const [initialChart, setInitialChart] = useState<InitialChart | null>(null);
  const [initialChartPrescriptionIssued, setInitialChartPrescriptionIssued] = useState(false); // 초진차트 처방 발급 여부
  const [progressEntries, setProgressEntries] = useState<ProgressEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [progressText, setProgressText] = useState(''); // 통합 텍스트
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [lastSavedId, setLastSavedId] = useState<number | null>(null); // 마지막 저장된 경과 ID
  const [isEditingChart, setIsEditingChart] = useState(false); // 초진차트 수정 모드
  const [editedNotes, setEditedNotes] = useState(''); // 수정 중인 차트 내용
  const [progressDate, setProgressDate] = useState(''); // 경과 입력 날짜
  const [editingProgressId, setEditingProgressId] = useState<number | null>(null); // 수정 중인 경과 ID
  const [showDiagnosisModal, setShowDiagnosisModal] = useState(false); // 진단 모아보기 모달
  const [showPrescriptionModal, setShowPrescriptionModal] = useState(false); // 처방 모아보기 모달
  const [isExpanded, setIsExpanded] = useState(false); // 크게보기 모드
  const [splitPercent, setSplitPercent] = useState(50); // 좌우 분할 비율
  const [isDragging, setIsDragging] = useState(false);
  const splitContainerRef = useRef<HTMLDivElement>(null);

  // 드래그로 좌우 분할 비율 조절
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      if (!splitContainerRef.current) return;
      const rect = splitContainerRef.current.getBoundingClientRect();
      const percent = ((e.clientX - rect.left) / rect.width) * 100;
      setSplitPercent(Math.min(80, Math.max(20, percent)));
    };
    const handleMouseUp = () => setIsDragging(false);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);
  const [showProgressModal, setShowProgressModal] = useState(false); // 경과 모아보기 모달
  const [showPrescriptionIssuedModal, setShowPrescriptionIssuedModal] = useState(false); // 처방전 발급 이력
  const [showDosageModal, setShowDosageModal] = useState(false); // 복용법 이력
  const [showDosageCreator, setShowDosageCreator] = useState(false); // 복용법 작성 모달
  const [dosageCreatorState, setDosageCreatorState] = useState<any>(null);
  const [issuedPrescriptions, setIssuedPrescriptions] = useState<any[]>([]); // 발급된 처방전 목록
  const [dosageInstructions, setDosageInstructions] = useState<any[]>([]); // 복용법 목록
  const [showPrescriptionInputModal, setShowPrescriptionInputModal] = useState(false); // 처방입력기 모달
  const [prescriptionFormula, setPrescriptionFormula] = useState(''); // 처방공식
  const [prescriptionSourceType, setPrescriptionSourceType] = useState<'initial_chart' | 'progress_note'>('initial_chart');
  const [prescriptionSourceId, setPrescriptionSourceId] = useState<number | null>(null);

  const getDraftIdFromUrl = (): number | null => {
    try {
      const params = new URLSearchParams(window.location.search);
      const raw = params.get('draftId');
      if (!raw) return null;
      const n = parseInt(raw, 10);
      return Number.isFinite(n) ? n : null;
    } catch {
      return null;
    }
  };

  const ensurePrescriptionLinkColumns = async () => {
    await execute(`ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS herbal_draft_id INTEGER`).catch(() => {});
    await execute(`ALTER TABLE cs_herbal_drafts ADD COLUMN IF NOT EXISTS prescription_id INTEGER`).catch(() => {});
    await execute(`ALTER TABLE cs_herbal_drafts ADD COLUMN IF NOT EXISTS prescription_linked_at TIMESTAMPTZ`).catch(() => {});
  };

  useEffect(() => {
    loadData();
  }, [recordId]);

  // autoOpenPrescription: 데이터 로드 후 처방 모달 자동 오픈
  const [autoOpenDone, setAutoOpenDone] = useState(false);
  useEffect(() => {
    if (autoOpenPrescription && !autoOpenDone && initialChart) {
      // 차트의 [처방] 섹션에서 처방공식 추출 후 처방입력기 오픈
      handleIssuePrescriptionInitial();
      setAutoOpenDone(true);
    }
  }, [autoOpenPrescription, autoOpenDone, initialChart]);

  // autoOpenDosage: 데이터 로드 후 복용법 작성 모달 자동 오픈
  const [autoOpenDosageDone, setAutoOpenDosageDone] = useState(false);
  useEffect(() => {
    if (autoOpenDosage && !autoOpenDosageDone && initialChart) {
      // 최신 처방전 조회 후 복용법 작성 모달 오픈
      (async () => {
        try {
          const rxList = await query<any>(
            `SELECT id, formula, patient_name, patient_age, patient_gender
             FROM prescriptions
             WHERE source_type = 'initial_chart' AND source_id = ${initialChart.id}
             ORDER BY created_at DESC LIMIT 1`
          );
          if (rxList && rxList.length > 0) {
            const rx = rxList[0];
            let chiefComplaint = '';
            const match = (initialChart.notes || '').match(/\[주소증\]\s*([\s\S]*?)(?=\n\[|$)/);
            if (match) chiefComplaint = match[1].trim();

            const state = {
              prescriptionId: rx.id,
              patientName: rx.patient_name || patientName,
              patientAge: rx.patient_age || patientInfo?.age,
              patientGender: rx.patient_gender || patientInfo?.gender,
              formula: rx.formula,
              chiefComplaint,
            };
            if (onOpenDosageCreator) {
              onOpenDosageCreator(state);
            }
          } else {
            alert('처방전을 먼저 발급해주세요.');
          }
        } catch (err) {
          console.error('복용법 모달 오픈 실패:', err);
        }
      })();
      setAutoOpenDosageDone(true);
    }
  }, [autoOpenDosage, autoOpenDosageDone, initialChart]);

  // ESC키: 가장 위에 있는 모달만 닫기
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();

      // 우선순위: 가장 위에 있는 모달부터 닫기
      if (showDosageCreator) {
        setShowDosageCreator(false);
      } else if (showPrescriptionInputModal) {
        setShowPrescriptionInputModal(false);
      } else if (showPrescriptionIssuedModal) {
        setShowPrescriptionIssuedModal(false);
      } else if (showDosageModal) {
        setShowDosageModal(false);
      } else if (showProgressModal) {
        setShowProgressModal(false);
      } else if (showDiagnosisModal) {
        setShowDiagnosisModal(false);
      } else if (showPrescriptionModal) {
        setShowPrescriptionModal(false);
      } else {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [showDosageCreator, showPrescriptionInputModal, showPrescriptionIssuedModal, showDosageModal, showProgressModal, showDiagnosisModal, showPrescriptionModal]);

  // 자동 저장 (5초 디바운스)
  useEffect(() => {
    if (!showAddForm || !progressText.trim() || !progressDate) {
      return;
    }

    setAutoSaveStatus('idle');

    const timer = setTimeout(async () => {
      await autoSaveProgress();
    }, 5000); // 5초 대기

    return () => clearTimeout(timer);
  }, [progressText, progressDate, showAddForm]);

  const loadData = async () => {
    try {
      setLoading(true);

      // 초진차트 로드 - PostgreSQL
      const chartData = await queryOne<InitialChart>(
        `SELECT * FROM initial_charts WHERE id = ${recordId}`
      );

      if (!chartData) {
        console.error('초진차트를 찾을 수 없습니다');
        return;
      }
      setInitialChart(chartData);
      setInitialChartPrescriptionIssued(chartData.prescription_issued || false);

      // 경과 기록 로드 (progress_notes 테이블에서) - PostgreSQL
      const progressData = await query<{
        id: number;
        patient_id: number;
        note_date: string;
        objective: string;
        assessment: string;
        plan: string;
        notes: string;
        prescription_issued: boolean;
        prescription_issued_at: string;
        created_at: string;
      }>(`SELECT * FROM progress_notes WHERE patient_id = ${chartData.patient_id} AND treatment_plan_id = ${chartData.treatment_plan_id} ORDER BY note_date DESC`);

      // 데이터 변환
      const entries: ProgressEntry[] = (progressData || []).map(note => ({
        id: note.id,
        entry_date: note.note_date,
        treatment: note.objective || '',
        diagnosis: note.assessment || '',
        prescription: note.plan || '',
        notes: note.notes || '',
        prescription_issued: note.prescription_issued || false,
        prescription_issued_at: note.prescription_issued_at || undefined,
        created_at: note.created_at
      }));

      setProgressEntries(entries);
    } catch (error) {
      console.error('데이터 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  // [경과], [복진], [설진], [맥진], [혈색], [처방] 섹션 파싱
  const parseProgressText = (text: string) => {
    const sections = {
      treatment: '',
      diagnosis: '',
      prescription: ''
    };

    if (!text) return sections;

    // 섹션별 추출
    const gyeongwaMatch = text.match(/\[경과\]\s*([^\[]*)/i);
    const bokjinMatch = text.match(/\[복진\]\s*([^\[]*)/i);
    const seoljinMatch = text.match(/\[설진\]\s*([^\[]*)/i);
    const maekjinMatch = text.match(/\[맥진\]\s*([^\[]*)/i);
    const hyeolsaekMatch = text.match(/\[혈색\]\s*([^\[]*)/i);
    const prescriptionMatch = text.match(/\[처방\]\s*([^\[]*)/i);

    // 경과
    if (gyeongwaMatch) {
      sections.treatment = gyeongwaMatch[1].trim();
    }

    // 복진, 설진, 맥진, 혈색을 진단(assessment)으로 통합
    const diagnosisParts: string[] = [];
    if (bokjinMatch && bokjinMatch[1].trim()) {
      diagnosisParts.push(`[복진]\n${bokjinMatch[1].trim()}`);
    }
    if (seoljinMatch && seoljinMatch[1].trim()) {
      diagnosisParts.push(`[설진]\n${seoljinMatch[1].trim()}`);
    }
    if (maekjinMatch && maekjinMatch[1].trim()) {
      diagnosisParts.push(`[맥진]\n${maekjinMatch[1].trim()}`);
    }
    if (hyeolsaekMatch && hyeolsaekMatch[1].trim()) {
      diagnosisParts.push(`[혈색]\n${hyeolsaekMatch[1].trim()}`);
    }

    if (diagnosisParts.length > 0) {
      sections.diagnosis = diagnosisParts.join('\n\n');
    }

    // 처방
    if (prescriptionMatch) {
      sections.prescription = prescriptionMatch[1].trim();
    }

    // 구분자가 없는 경우: 전체 텍스트를 경과로 저장
    if (!sections.treatment && !sections.diagnosis && !sections.prescription) {
      sections.treatment = text.trim();
    }

    return sections;
  };

  const autoSaveProgress = async () => {
    try {
      setAutoSaveStatus('saving');

      if (!initialChart || !progressText.trim() || !progressDate) {
        setAutoSaveStatus('idle');
        return;
      }

      const parsed = parseProgressText(progressText);
      const now = getCurrentTimestamp();
      const noteDate = new Date(progressDate).toISOString();

      // 수정 모드인 경우
      if (editingProgressId) {
        await execute(`
          UPDATE progress_notes SET
            note_date = ${escapeString(noteDate)},
            objective = ${toSqlValue(parsed.treatment)},
            assessment = ${toSqlValue(parsed.diagnosis)},
            plan = ${toSqlValue(parsed.prescription)},
            notes = ${toSqlValue(progressText.trim())},
            updated_at = ${escapeString(now)}
          WHERE id = ${editingProgressId}
        `);

        console.log('경과 자동저장 완료 (수정 모드)');
      } else if (lastSavedId) {
        // 기존 경과 업데이트 (자동 저장으로 생성된 경우)
        await execute(`
          UPDATE progress_notes SET
            note_date = ${escapeString(noteDate)},
            objective = ${toSqlValue(parsed.treatment)},
            assessment = ${toSqlValue(parsed.diagnosis)},
            plan = ${toSqlValue(parsed.prescription)},
            notes = ${toSqlValue(progressText.trim())},
            updated_at = ${escapeString(now)}
          WHERE id = ${lastSavedId}
        `);

        console.log('경과 자동저장 완료 (업데이트)');
      } else {
        // 새 경과 생성 (insert()가 0을 반환하므로 execute+query 패턴 사용)
        await execute(`
          INSERT INTO progress_notes (patient_id, treatment_plan_id, note_date, objective, assessment, plan, notes, created_at, updated_at)
          VALUES (
            ${initialChart.patient_id},
            ${initialChart.treatment_plan_id || 'null'},
            ${escapeString(noteDate)},
            ${toSqlValue(parsed.treatment)},
            ${toSqlValue(parsed.diagnosis)},
            ${toSqlValue(parsed.prescription)},
            ${toSqlValue(progressText.trim())},
            ${escapeString(now)},
            ${escapeString(now)}
          )
        `);

        // 방금 생성된 ID 조회
        const newest = await queryOne<{ id: number }>(
          `SELECT id FROM progress_notes WHERE patient_id = ${initialChart.patient_id} ORDER BY id DESC LIMIT 1`
        );
        if (newest) {
          setLastSavedId(newest.id);
          console.log('경과 자동저장 완료 (신규), id:', newest.id);
        }
      }

      setAutoSaveStatus('saved');

      // 2초 후 saved 상태 초기화
      setTimeout(() => {
        setAutoSaveStatus('idle');
      }, 2000);

      // 자동저장 시에는 리프레시하지 않음 (UI 깜빡임 방지)
    } catch (error) {
      console.error('자동저장 오류:', error);
      setAutoSaveStatus('idle');
    }
  };

  const handleAddProgress = async () => {
    try {
      if (!initialChart) return;

      if (!progressText.trim()) {
        alert('경과 내용을 입력해주세요.');
        return;
      }

      if (!progressDate) {
        alert('경과 날짜를 선택해주세요.');
        return;
      }

      // 텍스트 파싱
      const parsed = parseProgressText(progressText);
      const now = getCurrentTimestamp();
      const noteDate = new Date(progressDate).toISOString();

      await insert(`
        INSERT INTO progress_notes (patient_id, treatment_plan_id, note_date, objective, assessment, plan, notes, created_at, updated_at)
        VALUES (
          ${initialChart.patient_id},
          ${initialChart.treatment_plan_id || 'null'},
          ${escapeString(noteDate)},
          ${toSqlValue(parsed.treatment)},
          ${toSqlValue(parsed.diagnosis)},
          ${toSqlValue(parsed.prescription)},
          ${toSqlValue(progressText.trim())},
          ${escapeString(now)},
          ${escapeString(now)}
        )
      `);

      alert('경과가 추가되었습니다');
      setShowAddForm(false);
      setProgressText('');
      setProgressDate('');
      setLastSavedId(null);
      setAutoSaveStatus('idle');
      await loadData();
    } catch (error: any) {
      console.error('경과 추가 실패:', error);
      alert('경과 추가에 실패했습니다: ' + error.message);
    }
  };

  const handleDelete = async () => {
    if (!initialChart) return;

    const confirmed = window.confirm(
      '이 진료기록을 삭제하시겠습니까?\n\n삭제된 데이터는 복구할 수 없습니다.'
    );

    if (!confirmed) return;

    try {
      setLoading(true);

      await execute(`DELETE FROM initial_charts WHERE id = ${recordId}`);

      alert('진료기록이 삭제되었습니다');
      onClose(); // 모달 닫기
    } catch (error: any) {
      console.error('삭제 실패:', error);
      alert('삭제에 실패했습니다: ' + error.message);
      setLoading(false);
    }
  };

  const [showChartEditor, setShowChartEditor] = useState(false);

  const handleEditChart = () => {
    if (initialChart) {
      setShowChartEditor(true);
    }
  };

  const handleSaveChart = async () => {
    try {
      if (!initialChart) return;

      const now = getCurrentTimestamp();

      await execute(`
        UPDATE initial_charts SET
          notes = ${toSqlValue(editedNotes)},
          updated_at = ${escapeString(now)}
        WHERE id = ${initialChart.id}
      `);

      alert('초진차트가 수정되었습니다');
      setIsEditingChart(false);
      await loadData();
    } catch (error: any) {
      console.error('수정 실패:', error);
      alert('수정에 실패했습니다: ' + error.message);
    }
  };

  const handleCancelEdit = () => {
    setIsEditingChart(false);
    setEditedNotes('');
  };

  const handleEditProgress = (entry: ProgressEntry) => {
    // 경과 수정 모드로 전환
    const date = new Date(entry.entry_date);
    const entryDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    setProgressDate(entryDate);

    // notes가 있으면 그것을 직접 사용 (LegacyChartImporter로 저장된 데이터)
    if (entry.notes) {
      setProgressText(entry.notes);
    } else {
      // 텍스트 재구성 (diagnosis에 이미 [복진], [설진] 등이 포함되어 있을 수 있음)
      let text = '';
      if (entry.treatment) {
        text += `[경과]\n${entry.treatment}\n\n`;
      }
      if (entry.diagnosis) {
        // diagnosis에 이미 구분자가 있으면 그대로, 없으면 추가
        if (entry.diagnosis.includes('[복진]') || entry.diagnosis.includes('[설진]') ||
            entry.diagnosis.includes('[맥진]') || entry.diagnosis.includes('[혈색]')) {
          text += `${entry.diagnosis}\n\n`;
        } else {
          text += `${entry.diagnosis}\n\n`;
        }
      }
      if (entry.prescription) {
        text += `[처방]\n${entry.prescription}`;
      }
      setProgressText(text.trim());
    }

    setEditingProgressId(entry.id);
    setShowAddForm(true);
  };

  const handleUpdateProgress = async () => {
    try {
      if (!editingProgressId) return;

      if (!progressText.trim()) {
        alert('경과 내용을 입력해주세요.');
        return;
      }

      if (!progressDate) {
        alert('경과 날짜를 선택해주세요.');
        return;
      }

      const parsed = parseProgressText(progressText);
      const now = getCurrentTimestamp();
      const noteDate = new Date(progressDate).toISOString();

      await execute(`
        UPDATE progress_notes SET
          note_date = ${escapeString(noteDate)},
          objective = ${toSqlValue(parsed.treatment)},
          assessment = ${toSqlValue(parsed.diagnosis)},
          plan = ${toSqlValue(parsed.prescription)},
          notes = ${toSqlValue(progressText.trim())},
          updated_at = ${escapeString(now)}
        WHERE id = ${editingProgressId}
      `);

      alert('경과가 수정되었습니다');
      setShowAddForm(false);
      setProgressText('');
      setProgressDate('');
      setEditingProgressId(null);
      setLastSavedId(null);
      setAutoSaveStatus('idle');
      await loadData();
    } catch (error: any) {
      console.error('경과 수정 실패:', error);
      alert('경과 수정에 실패했습니다: ' + error.message);
    }
  };

  // < > 안의 처방공식 추출
  const extractFormulaFromPrescription = (prescriptionText: string): string => {
    if (!prescriptionText) return '';
    // < > 안의 내용 추출
    const match = prescriptionText.match(/<([^>]+)>/);
    if (match) {
      return match[1].trim();
    }
    return '';
  };

  // 초진차트 처방전 발급 - 처방입력기 모달 열기
  const handleIssuePrescriptionInitial = () => {
    if (!initialChart) return;

    // [처방] 섹션에서 처방공식 추출
    const prescriptionSection = extractSectionFromNotes(initialChart.notes || '', '처방');
    const formula = extractFormulaFromPrescription(prescriptionSection);

    setPrescriptionFormula(formula);
    setPrescriptionSourceType('initial_chart');
    setPrescriptionSourceId(initialChart.id);
    setShowPrescriptionInputModal(true);
  };

  // 처방 저장 후 처리
  const handleSavePrescription = async (data: PrescriptionData) => {
    try {
      // 처방번호 생성 (RX-YYYYMMDD-HHMMSS-랜덤)
      const now = new Date();
      const nowTimestamp = getCurrentTimestamp();
      const prescriptionNumber = `RX-${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}-${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}${String(now.getSeconds()).padStart(2,'0')}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
      const prescriptionDate = getCurrentDate();

      await ensurePrescriptionLinkColumns();

      // 1) URL draftId 우선 2) 환자 기준 단일 후보 자동 매칭
      let targetDraftId = getDraftIdFromUrl();
      if (!targetDraftId && initialChart?.patient_id) {
        const candidates = await query<{ id: number }>(`
          SELECT id
          FROM cs_herbal_drafts
          WHERE patient_id = ${initialChart.patient_id}
            AND (prescription_id IS NULL)
          ORDER BY created_at DESC
          LIMIT 2
        `).catch(() => [] as { id: number }[]);

        if (candidates.length === 1) {
          targetDraftId = candidates[0].id;
        }
      }

      // prescriptions 테이블에 저장 - PostgreSQL
      const prescriptionId = await insert(`
        INSERT INTO prescriptions (
          prescription_number, prescription_date, patient_id, patient_name, chart_number,
          patient_age, patient_gender, source_type, source_id, formula,
          merged_herbs, final_herbs, total_doses, days, doses_per_day,
          total_packs, pack_volume, water_amount, herb_adjustment, total_dosage,
          final_total_amount, notes, status, issued_at, created_at, updated_at, herbal_draft_id
        ) VALUES (
          ${escapeString(prescriptionNumber)},
          ${escapeString(prescriptionDate)},
          ${initialChart?.patient_id || 'NULL'},
          ${escapeString(patientName)},
          ${toSqlValue(patientInfo?.chartNumber || '')},
          ${patientInfo?.age || 'NULL'},
          ${toSqlValue(patientInfo?.gender)},
          ${escapeString(prescriptionSourceType)},
          ${prescriptionSourceId || 'NULL'},
          ${toSqlValue(data.formula)},
          ${toSqlValue(JSON.stringify(data.mergedHerbs))},
          ${toSqlValue(JSON.stringify(data.finalHerbs))},
          ${data.totalDoses || 'NULL'},
          ${data.days || 'NULL'},
          ${data.dosesPerDay || 'NULL'},
          ${data.totalPacks || 'NULL'},
          ${data.packVolume || 'NULL'},
          ${data.waterAmount || 'NULL'},
          ${toSqlValue(data.herbAdjustment)},
          ${data.totalDosage || 'NULL'},
          ${data.finalTotalAmount || 'NULL'},
          ${toSqlValue(data.notes)},
          ${escapeString('issued')},
          ${escapeString(nowTimestamp)},
          ${escapeString(nowTimestamp)},
          ${escapeString(nowTimestamp)},
          ${targetDraftId || 'NULL'}
        )
      `);

      // draft ↔ prescription 양방향 링크
      if (targetDraftId) {
        await execute(`
          UPDATE cs_herbal_drafts
          SET prescription_id = ${prescriptionId},
              prescription_linked_at = ${escapeString(nowTimestamp)},
              updated_at = ${escapeString(nowTimestamp)}
          WHERE id = ${targetDraftId}
            AND (prescription_id IS NULL OR prescription_id = ${prescriptionId})
        `);
      }

      // 처방발급 상태 업데이트 (초진차트 또는 경과기록)
      if (prescriptionSourceType === 'initial_chart' && prescriptionSourceId) {
        await execute(`
          UPDATE initial_charts SET
            prescription_issued = 1,
            prescription_issued_at = ${escapeString(nowTimestamp)}
          WHERE id = ${prescriptionSourceId}
        `);
        setInitialChartPrescriptionIssued(true);
      } else if (prescriptionSourceType === 'progress_note' && prescriptionSourceId) {
        await execute(`
          UPDATE progress_notes SET
            prescription_issued = 1,
            prescription_issued_at = ${escapeString(nowTimestamp)}
          WHERE id = ${prescriptionSourceId}
        `);

        // 로컬 상태 업데이트
        setProgressEntries(prev =>
          prev.map(entry =>
            entry.id === prescriptionSourceId
              ? { ...entry, prescription_issued: true, prescription_issued_at: nowTimestamp }
              : entry
          )
        );
      }

      alert('처방전이 발급되었습니다');
      setShowPrescriptionInputModal(false);
      setPrescriptionSourceId(null);
      await loadData(); // 목록 새로고침
    } catch (error: any) {
      console.error('처방전 발급 실패:', error);
      alert('처방전 발급에 실패했습니다: ' + error.message);
    }
  };

  // 경과 처방전 발급 - 처방입력기 모달 열기
  const handleIssuePrescriptionProgress = (progressId: number) => {
    // 해당 경과 기록 찾기
    const progressEntry = progressEntries.find(entry => entry.id === progressId);
    if (!progressEntry) return;

    // 처방 내용에서 공식 추출 (notes 또는 prescription 필드에서)
    let prescriptionText = progressEntry.prescription || '';

    // notes에서 [처방] 섹션 추출 (LegacyChartImporter로 저장된 경우)
    if (!prescriptionText && progressEntry.notes) {
      prescriptionText = extractSectionFromNotes(progressEntry.notes, '처방');
    }

    const formula = extractFormulaFromPrescription(prescriptionText);

    setPrescriptionFormula(formula);
    setPrescriptionSourceType('progress_note');
    setPrescriptionSourceId(progressId);
    setShowPrescriptionInputModal(true);
  };

  const handleDeleteProgress = async (progressId: number) => {
    const confirmed = window.confirm(
      '이 경과를 삭제하시겠습니까?\n\n삭제된 데이터는 복구할 수 없습니다.'
    );

    if (!confirmed) return;

    try {
      await execute(`DELETE FROM progress_notes WHERE id = ${progressId}`);

      alert('경과가 삭제되었습니다');
      await loadData();
    } catch (error: any) {
      console.error('경과 삭제 실패:', error);
      alert('경과 삭제에 실패했습니다: ' + error.message);
    }
  };

  // 초진차트에서 특정 섹션 추출
  const extractSectionFromNotes = (notes: string, sectionName: string): string => {
    if (!notes) return '';
    const regex = new RegExp(`\\[${sectionName}\\]\\s*([^\\[]*)`, 'i');
    const match = notes.match(regex);
    return match ? match[1].trim() : '';
  };

  // 내용에서 마크업 제거하고 > 구분자는 세분화해서 표시
  const cleanDiagnosisContent = (text: string): string => {
    if (!text) return '';

    // 각 줄을 처리
    const lines = text.split('\n');
    const cleanedLines: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();

      // []로 시작하는 섹션 제목은 제거
      if (trimmed.startsWith('[') && trimmed.includes(']')) {
        continue;
      }

      // >로 시작하는 subsection은 bullet point로 변환
      if (trimmed.startsWith('>')) {
        const content = trimmed.substring(1).trim(); // > 제거
        if (content) {
          cleanedLines.push(`• ${content}`);
        }
        continue;
      }

      // 일반 내용은 그대로 추가
      if (trimmed) {
        cleanedLines.push(trimmed);
      }
    }

    return cleanedLines.join('\n').trim();
  };

  // 진단 정보 수집 (테이블 형태)
  const getDiagnosisTableData = () => {
    interface DiagnosisData {
      [date: string]: {
        복진?: string;
        설진?: string;
        맥진?: string;
        혈색?: string;
        메모?: string;
      };
    }

    const data: DiagnosisData = {};
    const dates: string[] = [];

    // 초진차트 데이터
    if (initialChart) {
      const chartDate = new Date(initialChart.chart_date).toLocaleDateString('ko-KR');
      if (!dates.includes(chartDate)) {
        dates.push(chartDate);
      }

      if (!data[chartDate]) {
        data[chartDate] = {};
      }

      const bokjin = cleanDiagnosisContent(extractSectionFromNotes(initialChart.notes, '복진'));
      if (bokjin) data[chartDate].복진 = bokjin;

      const seoljin = cleanDiagnosisContent(extractSectionFromNotes(initialChart.notes, '설진'));
      if (seoljin) data[chartDate].설진 = seoljin;

      const maekjin = cleanDiagnosisContent(extractSectionFromNotes(initialChart.notes, '맥진'));
      if (maekjin) data[chartDate].맥진 = maekjin;

      const hyeolsaek = cleanDiagnosisContent(extractSectionFromNotes(initialChart.notes, '혈색'));
      if (hyeolsaek) data[chartDate].혈색 = hyeolsaek;
    }

    // 경과에서 진단 정보 추가
    progressEntries.forEach(entry => {
      const entryDate = new Date(entry.entry_date).toLocaleDateString('ko-KR');

      // notes 또는 diagnosis에서 데이터 추출
      const sourceText = entry.notes || entry.diagnosis || '';
      if (!sourceText) return;

      if (!dates.includes(entryDate)) {
        dates.push(entryDate);
      }

      if (!data[entryDate]) {
        data[entryDate] = {};
      }

      // [복진], [설진], [맥진], [혈색]로 구분되어 있는지 확인
      const hasSections = /\[(복진|설진|맥진|혈색)\]/.test(sourceText);

      if (hasSections) {
        // 구분자가 있는 경우 각각 추출
        const bokjinMatch = sourceText.match(/\[복진\]\s*([^\[]*)/i);
        if (bokjinMatch && bokjinMatch[1].trim()) {
          data[entryDate].복진 = cleanDiagnosisContent(bokjinMatch[1]);
        }

        const seoljinMatch = sourceText.match(/\[설진\]\s*([^\[]*)/i);
        if (seoljinMatch && seoljinMatch[1].trim()) {
          data[entryDate].설진 = cleanDiagnosisContent(seoljinMatch[1]);
        }

        const maekjinMatch = sourceText.match(/\[맥진\]\s*([^\[]*)/i);
        if (maekjinMatch && maekjinMatch[1].trim()) {
          data[entryDate].맥진 = cleanDiagnosisContent(maekjinMatch[1]);
        }

        const hyeolsaekMatch = sourceText.match(/\[혈색\]\s*([^\[]*)/i);
        if (hyeolsaekMatch && hyeolsaekMatch[1].trim()) {
          data[entryDate].혈색 = cleanDiagnosisContent(hyeolsaekMatch[1]);
        }
      } else if (entry.diagnosis) {
        // 구분자가 없고 diagnosis 필드가 있는 경우 메모로 저장
        const cleaned = cleanDiagnosisContent(entry.diagnosis);
        if (cleaned) {
          data[entryDate].메모 = cleaned;
        }
      }
    });

    // 날짜를 시간순으로 정렬 (오래된 날짜부터)
    dates.sort((a, b) => {
      // "2024. 1. 15." 형식을 Date 객체로 변환
      const parseKoreanDate = (dateStr: string) => {
        const parts = dateStr.split('.').map(s => s.trim()).filter(s => s);
        if (parts.length >= 3) {
          return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        }
        return new Date(dateStr);
      };

      const dateA = parseKoreanDate(a);
      const dateB = parseKoreanDate(b);
      return dateA.getTime() - dateB.getTime();
    });

    return { data, dates };
  };

  // 처방 정보 수집
  const getPrescriptionData = () => {
    const data: Array<{ date: string; content: string }> = [];

    if (initialChart) {
      const prescription = cleanDiagnosisContent(extractSectionFromNotes(initialChart.notes, '처방'));
      if (prescription) {
        const chartDate = new Date(initialChart.chart_date).toLocaleDateString('ko-KR');
        data.push({ date: chartDate, content: prescription });
      }
    }

    // 경과에서 처방 정보 추가
    progressEntries.forEach(entry => {
      const entryDate = new Date(entry.entry_date).toLocaleDateString('ko-KR');

      // notes에서 [처방] 섹션 추출 (LegacyChartImporter 데이터)
      if (entry.notes) {
        const prescriptionFromNotes = cleanDiagnosisContent(extractSectionFromNotes(entry.notes, '처방'));
        if (prescriptionFromNotes) {
          data.push({ date: entryDate, content: prescriptionFromNotes });
          return; // notes에서 찾았으면 다음 entry로
        }
      }

      // 기존 prescription 필드 확인
      if (entry.prescription) {
        const cleaned = cleanDiagnosisContent(entry.prescription);
        if (cleaned) {
          data.push({ date: entryDate, content: cleaned });
        }
      }
    });

    // 날짜를 시간순으로 정렬 (오래된 날짜부터)
    data.sort((a, b) => {
      // "2024. 1. 15." 형식을 Date 객체로 변환
      const parseKoreanDate = (dateStr: string) => {
        const parts = dateStr.split('.').map(s => s.trim()).filter(s => s);
        if (parts.length >= 3) {
          return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        }
        return new Date(dateStr);
      };

      const dateA = parseKoreanDate(a.date);
      const dateB = parseKoreanDate(b.date);
      return dateA.getTime() - dateB.getTime();
    });

    return data;
  };

  // 경과 정보 수집
  const getProgressData = () => {
    const data: Array<{ date: string; content: string }> = [];

    if (initialChart) {
      const progress = cleanDiagnosisContent(extractSectionFromNotes(initialChart.notes, '경과'));
      if (progress) {
        const chartDate = new Date(initialChart.chart_date).toLocaleDateString('ko-KR');
        data.push({ date: chartDate, content: progress });
      }
    }

    // 경과에서 진료(treatment) 정보 추가
    progressEntries.forEach(entry => {
      const entryDate = new Date(entry.entry_date).toLocaleDateString('ko-KR');

      // notes에서 [경과] 섹션 추출 (LegacyChartImporter 데이터)
      if (entry.notes) {
        const progressFromNotes = cleanDiagnosisContent(extractSectionFromNotes(entry.notes, '경과'));
        if (progressFromNotes) {
          data.push({ date: entryDate, content: progressFromNotes });
          return; // notes에서 찾았으면 다음 entry로
        }
      }

      // 기존 treatment 필드 확인
      if (entry.treatment) {
        const cleaned = cleanDiagnosisContent(entry.treatment);
        if (cleaned) {
          data.push({ date: entryDate, content: cleaned });
        }
      }
    });

    // 날짜를 시간순으로 정렬 (오래된 날짜부터)
    data.sort((a, b) => {
      // "2024. 1. 15." 형식을 Date 객체로 변환
      const parseKoreanDate = (dateStr: string) => {
        const parts = dateStr.split('.').map(s => s.trim()).filter(s => s);
        if (parts.length >= 3) {
          return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        }
        return new Date(dateStr);
      };

      const dateA = parseKoreanDate(a.date);
      const dateB = parseKoreanDate(b.date);
      return dateA.getTime() - dateB.getTime();
    });

    return data;
  };

  // 초진차트 섹션 파싱
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
          directContent: sectionMatch[2].trim()
        };
      } else if (subsectionMatch && currentSection) {
        if (currentSubsection) {
          currentSection.subsections.push(currentSubsection);
        }
        currentSubsection = {
          title: subsectionMatch[1].trim(),
          content: ''
        };
      } else {
        if (currentSubsection) {
          currentSubsection.content += (currentSubsection.content ? '\n' : '') + line;
        } else if (currentSection) {
          currentSection.directContent += (currentSection.directContent ? '\n' : '') + line;
        }
      }
    });

    if (currentSubsection && currentSection) {
      currentSection.subsections.push(currentSubsection);
    }
    if (currentSection) {
      sections.push(currentSection);
    }

    sections.forEach(section => {
      section.directContent = section.directContent.trim();
      section.subsections.forEach(subsection => {
        subsection.content = subsection.content.trim();
      });
    });

    return sections;
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="border-4 border-clinic-background border-t-clinic-primary rounded-full w-8 h-8 animate-spin"></div>
            <p className="text-clinic-text-secondary">로딩 중...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={(embedded && !isExpanded) ? "relative bg-white flex flex-col overflow-hidden h-full" : "fixed inset-0 bg-white flex flex-col overflow-hidden"} style={(embedded && !isExpanded) ? { zoom: scale } : { top: '56px', left: '220px', zIndex: 90, zoom: scale }}>
      <div className="bg-white w-full h-full flex flex-col">
        {/* 헤더 */}
        <div className="bg-white p-3 flex justify-between items-center text-gray-800 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <i className="fas fa-file-medical text-lg text-clinic-primary"></i>
            <h2 className="text-lg font-bold">
              진료기록 상세 - {patientName}
              {patientInfo?.chartNumber && `(${patientInfo.chartNumber})`}
              {(patientInfo?.age !== undefined && patientInfo?.age !== null) && ` ${patientInfo.age}세`}
              {patientInfo?.gender && `/${patientInfo.gender === 'male' ? '남성' : patientInfo.gender === 'female' ? '여성' : patientInfo.gender}`}
            </h2>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowProgressModal(true)}
              className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition-colors font-medium text-sm"
            >
              <i className="fas fa-notes-medical mr-1"></i>경과
            </button>
            <button
              onClick={() => setShowDiagnosisModal(true)}
              className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition-colors font-medium text-sm"
            >
              <i className="fas fa-stethoscope mr-1"></i>진단
            </button>
            <button
              onClick={() => setShowPrescriptionModal(true)}
              className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition-colors font-medium text-sm"
            >
              <i className="fas fa-prescription-bottle mr-1"></i>처방
            </button>
            <button
              onClick={handleDelete}
              className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded transition-colors font-medium text-sm"
            >
              <i className="fas fa-trash mr-1"></i>삭제
            </button>
            {embedded && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition-colors font-medium text-sm"
              >
                <i className={`fas fa-${isExpanded ? 'compress' : 'expand'} mr-1`}></i>{isExpanded ? '축소' : '크게'}
              </button>
            )}
            <button
              onClick={onClose}
              className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition-colors font-medium text-sm"
            >
              <i className="fas fa-times mr-1"></i>닫기
            </button>
          </div>
        </div>

        {/* 본문 (좌우 분할) */}
        <div ref={splitContainerRef} className={`flex-1 flex overflow-hidden ${isDragging ? 'select-none' : ''}`}>
          {/* 왼쪽: 초진차트 (독립 스크롤) */}
          <div className="overflow-y-auto p-6" style={{ width: `${splitPercent}%`, flexShrink: 0 }}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-clinic-text-primary flex items-center">
                <i className="fas fa-file-alt text-clinic-primary mr-2"></i>
                초진차트
              </h3>
              {!isEditingChart && initialChart && (
                <button
                  onClick={handleEditChart}
                  className="px-3 py-1 bg-clinic-primary text-white rounded hover:bg-blue-900 transition-colors text-sm font-semibold"
                >
                  <i className="fas fa-edit mr-1"></i>수정
                </button>
              )}
            </div>

            {isEditingChart ? (
              <div className="space-y-3">
                <textarea
                  value={editedNotes}
                  onChange={(e) => setEditedNotes(e.target.value)}
                  className="w-full border-2 border-gray-300 rounded-lg p-3 focus:outline-none focus:border-clinic-primary focus:ring-2 focus:ring-clinic-primary focus:ring-opacity-20 transition-colors font-mono"
                  rows={25}
                  style={{ fontSize: '0.9rem', lineHeight: '1.5' }}
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveChart}
                    className="px-4 py-2 bg-clinic-accent text-white rounded hover:bg-green-700 transition-colors font-semibold"
                  >
                    <i className="fas fa-save mr-1"></i>저장
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
                  >
                    <i className="fas fa-times mr-1"></i>취소
                  </button>
                </div>
              </div>
            ) : initialChart && initialChart.notes ? (
              <>
                <div className="space-y-4 mb-4">
                  {parseChartSections(initialChart.notes).map((section, sectionIndex) => (
                    <div key={sectionIndex} className="bg-white border border-gray-300 rounded overflow-hidden shadow-sm">
                      <div className="bg-gray-100 px-4 py-2 border-b border-gray-300">
                        <div className="flex items-center justify-between">
                          <h4 className="font-semibold text-gray-800 flex items-center" style={{ fontSize: '1.15rem' }}>
                            <i className="fas fa-chevron-right text-xs mr-2"></i>
                            {section.title}
                          </h4>
                          {section.title === '처방' && (section.directContent || section.subsections.length > 0) && (
                            initialChartPrescriptionIssued ? (
                              <button
                                onClick={() => {
                                  onClose();
                                  navigate('/doctor/prescriptions');
                                }}
                                className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full font-semibold hover:bg-green-200 transition-colors cursor-pointer"
                                title="처방 목록 보기"
                              >
                                <i className="fas fa-check-circle mr-1"></i>처방완료
                                <i className="fas fa-external-link-alt ml-1 text-[10px]"></i>
                              </button>
                            ) : (
                              <button
                                onClick={handleIssuePrescriptionInitial}
                                className="px-2 py-1 bg-orange-500 text-white text-xs rounded hover:bg-orange-600 transition-colors font-semibold"
                              >
                                <i className="fas fa-paper-plane mr-1"></i>처방전 발급
                              </button>
                            )
                          )}
                        </div>
                      </div>

                      {section.directContent && (
                        <div className="px-4 py-3 bg-gray-50">
                          <p className="text-clinic-text-primary whitespace-pre-wrap" style={{ lineHeight: '1.7', fontSize: '1.1375rem' }}>
                            {section.directContent}
                          </p>
                        </div>
                      )}

                      {section.subsections.length > 0 && (
                        <div className="p-4 space-y-3">
                          {section.subsections.map((subsection, subIndex) => (
                            <div key={subIndex} className="border-l-3 border-gray-400 pl-4 py-2 bg-gray-50">
                              <h5 className="font-semibold text-gray-700 mb-2" style={{ fontSize: '1.0875rem' }}>
                                • {subsection.title}
                              </h5>
                              <div className="text-clinic-text-primary whitespace-pre-wrap ml-3" style={{ lineHeight: '1.7', fontSize: '1.0875rem' }}>
                                {subsection.content}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* 진료일자 및 생성일자 표시 */}
                <div className="bg-gray-50 border border-gray-300 rounded p-3 text-sm text-clinic-text-secondary">
                  <div className="flex items-center mb-1">
                    <i className="fas fa-calendar-check mr-2 text-gray-600"></i>
                    <span className="font-semibold">진료일자:</span>
                    <span className="ml-2">{new Date(initialChart.chart_date).toLocaleDateString('ko-KR')}</span>
                  </div>
                  <div className="flex items-center">
                    <i className="fas fa-clock mr-2 text-gray-400"></i>
                    <span className="font-semibold">차트 생성일:</span>
                    <span className="ml-2">{new Date(initialChart.created_at).toLocaleString('ko-KR')}</span>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-gray-500">초진차트 내용이 없습니다.</p>
            )}
          </div>

          {/* 오른쪽: 경과 목록 */}
          {/* 드래그 구분선 */}
          <div
            onMouseDown={handleMouseDown}
            className="flex-shrink-0 w-1 bg-gray-200 hover:bg-blue-400 cursor-col-resize transition-colors relative group"
          >
            <div className="absolute inset-y-0 -left-1 -right-1" />
          </div>

          {/* 오른쪽: 진료 경과 */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-clinic-text-primary flex items-center">
                <i className="fas fa-list-ul text-clinic-primary mr-2"></i>
                진료 경과
              </h3>
              <button
                onClick={() => {
                  if (showAddForm) {
                    // 폼 닫기
                    setShowAddForm(false);
                    setProgressText('');
                    setProgressDate('');
                    setEditingProgressId(null);
                    setLastSavedId(null);
                    setAutoSaveStatus('idle');
                  } else {
                    // 새 경과 추가 모드
                    const today = getCurrentDate();
                    setProgressDate(today);
                    setProgressText('');
                    setEditingProgressId(null);
                    setShowAddForm(true);
                  }
                }}
                className="px-4 py-2 bg-clinic-accent text-white rounded-lg hover:bg-green-700 transition-colors font-semibold shadow-md"
              >
                <i className={`fas ${showAddForm ? 'fa-times' : 'fa-plus'} mr-2`}></i>
                {showAddForm ? '닫기' : '경과 추가'}
              </button>
            </div>

            {/* 경과 추가 폼 */}
            {showAddForm && (
              <div className="bg-gray-50 border border-gray-300 rounded-lg p-4 mb-4 flex flex-col" style={{ minHeight: '60vh' }}>
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-1">
                    <input
                      type="date"
                      value={progressDate}
                      onChange={(e) => setProgressDate(e.target.value)}
                      className="border-2 border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:border-gray-500 focus:ring-2 focus:ring-gray-400 focus:ring-opacity-20 transition-colors"
                      required
                    />
                    <button
                      onClick={() => {
                        const template = `[주요 경과]\n\n[복진]\n> 복피 :\n> 복외측 :\n> 복직근 :\n> 심하부 :\n> 임맥선 :\n> 하복부 :\n> 흉협부 :\n> 심흉부 :\n\n[설진]\n\n[맥진]\n- 촌구맥 :\n- 인영맥 :\n\n[혈색]\n- 하안검 :\n- 손톱 :\n- 입술 :\n\n[티칭]\n\n[처방]\n`;
                        if (!progressText.trim() || confirm('기존 내용을 템플릿으로 대체하시겠습니까?')) {
                          setProgressText(template);
                        }
                      }}
                      className="px-2 py-1.5 text-sm bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors font-medium whitespace-nowrap min-w-[70px] text-center"
                    >
                      <i className="fas fa-user mr-1"></i>내원
                    </button>
                    <button
                      onClick={() => {
                        const template = `[주요 경과]\n\n[처방]\n`;
                        if (!progressText.trim() || confirm('기존 내용을 템플릿으로 대체하시겠습니까?')) {
                          setProgressText(template);
                        }
                      }}
                      className="px-2 py-1.5 text-sm bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 transition-colors font-medium whitespace-nowrap min-w-[70px] text-center"
                    >
                      <i className="fas fa-phone mr-1"></i>전화
                    </button>
                    <button
                      onClick={editingProgressId ? handleUpdateProgress : handleAddProgress}
                      className="px-2 py-1.5 bg-clinic-accent text-white rounded-lg hover:bg-green-700 transition-colors font-semibold text-sm whitespace-nowrap"
                    >
                      <i className="fas fa-save mr-1"></i>{editingProgressId ? '수정' : '저장'}
                    </button>
                    <button
                      onClick={async () => {
                        if (lastSavedId && !editingProgressId) {
                          if (confirm('자동저장된 항목이 삭제됩니다. 취소할까요?')) {
                            await execute(`DELETE FROM progress_notes WHERE id = ${lastSavedId}`);
                            await loadData();
                          } else {
                            return; // 팝업에서 취소 → 입력 상태 유지
                          }
                        }
                        setShowAddForm(false);
                        setProgressText('');
                        setProgressDate('');
                        setEditingProgressId(null);
                        setLastSavedId(null);
                        setAutoSaveStatus('idle');
                      }}
                      className="px-2 py-1.5 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors text-sm whitespace-nowrap"
                    >
                      <i className="fas fa-times mr-1"></i>취소
                    </button>
                  </div>
                  {/* 자동저장 상태 */}
                  {autoSaveStatus === 'saving' && (
                    <span className="text-xs text-gray-600 flex items-center">
                      <i className="fas fa-spinner fa-spin mr-1"></i>
                      저장 중...
                    </span>
                  )}
                  {autoSaveStatus === 'saved' && (
                    <span className="text-xs text-gray-700 flex items-center">
                      <i className="fas fa-check-circle mr-1"></i>
                      자동저장 완료
                    </span>
                  )}
                </div>
                <div className="flex-1 flex flex-col">
                  <div className="flex-1 flex flex-col">
                    <textarea
                      value={progressText}
                      onChange={(e) => setProgressText(e.target.value)}
                      className="w-full flex-1 border border-gray-300 rounded-lg p-4 focus:ring-2 focus:ring-clinic-primary focus:border-clinic-primary resize-none"
                      placeholder="[경과], [복진], [설진], [맥진], [혈색], [처방] 구분자 사용 (자동저장)&#10;&#10;[경과]&#10;환자 상태 호전됨&#10;두통 증상 감소&#10;&#10;[복진]&#10;복부 압통 감소&#10;&#10;[설진]&#10;설태 박백&#10;&#10;[맥진]&#10;맥 평이&#10;&#10;[혈색]&#10;안색 양호&#10;&#10;[처방]&#10;소시호탕 7일분"
                      style={{ fontSize: '1.025em', lineHeight: '1.6', fontFamily: 'inherit' }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 경과 목록 */}
            <div className="space-y-4">
              {progressEntries.length === 0 ? (
                <div className="text-center py-12">
                  <i className="fas fa-clipboard-list text-6xl text-gray-300 mb-4"></i>
                  <p className="text-clinic-text-secondary">등록된 경과가 없습니다</p>
                </div>
              ) : (
                progressEntries.map((entry, idx) => (
                  <div key={entry.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-3 pb-2 border-b">
                      <span className="text-sm font-semibold text-clinic-primary">
                        <i className="fas fa-calendar-alt mr-2"></i>
                        {entry.diagnosis?.includes('날짜미상')
                          ? `${entry.diagnosis.replace(' (날짜미상)', '')} (날짜미상)`
                          : new Date(entry.entry_date).toLocaleDateString('ko-KR')}
                      </span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEditProgress(entry)}
                          className="px-2 py-1 bg-gray-600 text-white rounded text-xs hover:bg-gray-500 transition-colors"
                        >
                          <i className="fas fa-edit mr-1"></i>수정
                        </button>
                        <button
                          onClick={() => handleDeleteProgress(entry.id)}
                          className="px-2 py-1 bg-red-700 text-white rounded text-xs hover:bg-red-600 transition-colors"
                        >
                          <i className="fas fa-trash mr-1"></i>삭제
                        </button>
                      </div>
                    </div>

                    {/* notes가 있으면 우선 표시 (LegacyChartImporter로 저장된 데이터) */}
                    {entry.notes ? (
                      (() => {
                        // notes에서 [처방] 섹션 추출
                        const prescriptionFromNotes = extractSectionFromNotes(entry.notes, '처방');
                        return (
                          <div>
                            <pre className="text-gray-600 whitespace-pre-wrap font-sans" style={{ lineHeight: '1.7', fontSize: '1.0875rem' }}>{entry.notes}</pre>
                            {/* 처방 섹션이 있으면 처방전 발급 버튼 표시 */}
                            {prescriptionFromNotes && (
                              <div className="mt-3 pt-3 border-t border-gray-200">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-semibold text-gray-700">
                                    <i className="fas fa-prescription mr-1"></i>처방 발급
                                  </span>
                                  {entry.prescription_issued ? (
                                    <button
                                      onClick={() => {
                                        onClose();
                                        navigate('/doctor/prescriptions');
                                      }}
                                      className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full font-semibold hover:bg-green-200 transition-colors cursor-pointer"
                                      title="처방 목록 보기"
                                    >
                                      <i className="fas fa-check-circle mr-1"></i>처방완료
                                      <i className="fas fa-external-link-alt ml-1 text-[10px]"></i>
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => handleIssuePrescriptionProgress(entry.id)}
                                      className="px-2 py-1 bg-orange-500 text-white text-xs rounded hover:bg-orange-600 transition-colors font-semibold"
                                    >
                                      <i className="fas fa-paper-plane mr-1"></i>처방전 발급
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()
                    ) : (
                      <>
                        {entry.treatment && (
                          <div className="mb-3">
                            <h5 className="font-semibold text-gray-700 mb-2" style={{ fontSize: '0.95rem' }}>진료</h5>
                            <p className="text-gray-600 whitespace-pre-wrap" style={{ lineHeight: '1.7', fontSize: '1.0875rem' }}>{entry.treatment}</p>
                          </div>
                        )}

                        {entry.diagnosis && (
                          <div className="mb-3">
                            <h5 className="font-semibold text-gray-700 mb-2" style={{ fontSize: '0.95rem' }}>진단</h5>
                            <p className="text-gray-600 whitespace-pre-wrap" style={{ lineHeight: '1.7', fontSize: '1.0875rem' }}>{entry.diagnosis}</p>
                          </div>
                        )}

                        {entry.prescription && (
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <h5 className="font-semibold text-gray-700" style={{ fontSize: '0.95rem' }}>처방</h5>
                              {entry.prescription_issued ? (
                                <button
                                  onClick={() => {
                                    onClose();
                                    navigate('/doctor/prescriptions');
                                  }}
                                  className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full font-semibold hover:bg-green-200 transition-colors cursor-pointer"
                                  title="처방 목록 보기"
                                >
                                  <i className="fas fa-check-circle mr-1"></i>처방완료
                                  <i className="fas fa-external-link-alt ml-1 text-[10px]"></i>
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleIssuePrescriptionProgress(entry.id)}
                                  className="px-2 py-1 bg-orange-500 text-white text-xs rounded hover:bg-orange-600 transition-colors font-semibold"
                                >
                                  <i className="fas fa-paper-plane mr-1"></i>처방전 발급
                                </button>
                              )}
                            </div>
                            <p className="text-gray-600 whitespace-pre-wrap" style={{ lineHeight: '1.7', fontSize: '1.0875rem' }}>{entry.prescription}</p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 진단 모아보기 모달 */}
      {showDiagnosisModal && (() => {
        const { data, dates } = getDiagnosisTableData();
        const diagnosisTypes = ['복진', '설진', '맥진', '혈색', '메모'];

        return (
          <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-lg w-full max-w-6xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
              <div className="bg-gray-700 p-5 flex justify-between items-center text-white border-b-4 border-gray-800">
                <h3 className="text-2xl font-bold flex items-center">
                  <i className="fas fa-stethoscope mr-2"></i>
                  진단 모아보기
                </h3>
                <button
                  onClick={() => setShowDiagnosisModal(false)}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg transition-colors"
                >
                  <i className="fas fa-times mr-1"></i>닫기
                </button>
              </div>
              <div className="flex-1 overflow-auto p-6">
                {dates.length === 0 ? (
                  <div className="text-center py-12">
                    <i className="fas fa-clipboard-list text-6xl text-gray-300 mb-4"></i>
                    <p className="text-clinic-text-secondary">등록된 진단 정보가 없습니다</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr>
                          <th className="border-2 border-gray-400 bg-gray-600 text-white p-3 font-bold sticky left-0 z-10">
                            구분
                          </th>
                          {dates.map((date, index) => (
                            <th key={index} className="border-2 border-gray-400 bg-gray-600 text-white p-3 font-bold min-w-[200px]">
                              <i className="fas fa-calendar-alt mr-2"></i>
                              {date}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {diagnosisTypes.map((type) => (
                          <tr key={type}>
                            <td className="border-2 border-gray-300 bg-gray-100 p-3 font-semibold text-gray-800 sticky left-0 z-10">
                              {type}
                            </td>
                            {dates.map((date, index) => (
                              <td key={index} className="border-2 border-gray-300 p-3 bg-white align-top">
                                {data[date]?.[type as keyof typeof data[typeof date]] ? (
                                  <div className="text-clinic-text-primary whitespace-pre-wrap" style={{ lineHeight: '1.6', fontSize: '1.0875rem' }}>
                                    {data[date][type as keyof typeof data[typeof date]]}
                                  </div>
                                ) : (
                                  <span className="text-gray-400 text-sm">-</span>
                                )}
                              </td>
                            ))}
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
      })()}

      {/* 처방 모아보기 모달 */}
      {showPrescriptionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="bg-gray-700 p-5 flex justify-between items-center text-white sticky top-0 border-b-4 border-gray-800">
              <h3 className="text-2xl font-bold flex items-center">
                <i className="fas fa-prescription-bottle mr-2"></i>
                처방 모아보기
              </h3>
              <button
                onClick={() => setShowPrescriptionModal(false)}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg transition-colors"
              >
                <i className="fas fa-times mr-1"></i>닫기
              </button>
            </div>
            <div className="p-6 space-y-4">
              {getPrescriptionData().length === 0 ? (
                <div className="text-center py-12">
                  <i className="fas fa-prescription-bottle-alt text-6xl text-gray-300 mb-4"></i>
                  <p className="text-clinic-text-secondary">등록된 처방 정보가 없습니다</p>
                </div>
              ) : (
                getPrescriptionData().map((item, index) => (
                  <div key={index} className="bg-gray-50 border-2 border-gray-300 rounded-lg p-4 shadow-sm">
                    <div className="flex items-center mb-2 pb-2 border-b border-gray-300">
                      <span className="text-sm font-semibold text-gray-700">
                        <i className="fas fa-calendar-alt mr-2"></i>
                        {item.date}
                      </span>
                    </div>
                    <p className="text-clinic-text-primary whitespace-pre-wrap" style={{ lineHeight: '1.7', fontSize: '0.95rem' }}>
                      {item.content}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* 경과 모아보기 모달 */}
      {showProgressModal && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="bg-gray-700 p-5 flex justify-between items-center text-white sticky top-0 border-b-4 border-gray-800">
              <h3 className="text-2xl font-bold flex items-center">
                <i className="fas fa-notes-medical mr-2"></i>
                경과 모아보기
              </h3>
              <button
                onClick={() => setShowProgressModal(false)}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg transition-colors"
              >
                <i className="fas fa-times mr-1"></i>닫기
              </button>
            </div>
            <div className="p-6 space-y-4">
              {getProgressData().length === 0 ? (
                <div className="text-center py-12">
                  <i className="fas fa-notes-medical text-6xl text-gray-300 mb-4"></i>
                  <p className="text-clinic-text-secondary">등록된 경과 정보가 없습니다</p>
                </div>
              ) : (
                getProgressData().map((item, index) => (
                  <div key={index} className="bg-gray-50 border-2 border-gray-300 rounded-lg p-4 shadow-sm">
                    <div className="flex items-center mb-2 pb-2 border-b border-gray-300">
                      <span className="text-sm font-semibold text-gray-700">
                        <i className="fas fa-calendar-alt mr-2"></i>
                        {item.date}
                      </span>
                    </div>
                    <p className="text-clinic-text-primary whitespace-pre-wrap" style={{ lineHeight: '1.7', fontSize: '0.95rem' }}>
                      {item.content}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* 처방입력기 (진료상세보기 영역 내) */}
      {showPrescriptionInputModal && (
        <div className="absolute inset-0 bg-white z-[30] flex flex-col overflow-hidden">
            {/* 처방입력기 */}
            <div className="flex-1 overflow-hidden p-4 bg-white">
              <PrescriptionInput
                onSave={handleSavePrescription}
                patientName={patientName}
                patientChartNumber={patientInfo?.chartNumber}
                patientAge={patientInfo?.age}
                onClose={() => setShowPrescriptionInputModal(false)}
                showPatientInput={false}
                showNotesInput={true}
                showSaveButton={true}
                saveButtonText="저장"
                initialFormula={prescriptionFormula}
              />
            </div>
        </div>
      )}

      {/* 처방전 발급 이력 모달 */}
      {showPrescriptionIssuedModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-lg w-full max-w-3xl max-h-[80vh] flex flex-col shadow-2xl">
            <div className="flex justify-between items-center px-6 py-4 border-b">
              <h3 className="text-lg font-bold text-gray-800">
                <i className="fas fa-file-prescription mr-2 text-blue-600"></i>처방전 발급 이력
              </h3>
              <button onClick={() => setShowPrescriptionIssuedModal(false)} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                <i className="fas fa-times text-xl"></i>
              </button>
            </div>
            <div className="flex-1 overflow-auto p-6">
              <PrescriptionIssuedList
                patientId={initialChart?.patient_id || 0}
                treatmentPlanId={initialChart?.treatment_plan_id}
                onIssuePrescription={(sourceType, sourceId, formula) => {
                  setPrescriptionSourceType(sourceType);
                  setPrescriptionSourceId(sourceId);
                  setPrescriptionFormula(formula);
                  setShowPrescriptionIssuedModal(false);
                  setShowPrescriptionInputModal(true);
                }}
                onRefresh={loadData}
              />
            </div>
          </div>
        </div>
      )}

      {/* 복용법 이력 모달 */}
      {showDosageModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-lg w-full max-w-3xl max-h-[80vh] flex flex-col shadow-2xl">
            <div className="flex justify-between items-center px-6 py-4 border-b">
              <h3 className="text-lg font-bold text-gray-800">
                <i className="fas fa-pills mr-2 text-green-600"></i>복용법 이력
              </h3>
              <button onClick={() => setShowDosageModal(false)} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                <i className="fas fa-times text-xl"></i>
              </button>
            </div>
            <div className="flex-1 overflow-auto p-6">
              <DosageList
                patientId={initialChart?.patient_id || 0}
                treatmentPlanId={initialChart?.treatment_plan_id}
                patientName={patientName}
                patientInfo={patientInfo}
                onRefresh={loadData}
              />
            </div>
          </div>
        </div>
      )}

      {/* 초진차트 수정 (인라인 오버레이) */}
      {showChartEditor && initialChart && (
        <div className="absolute inset-0 z-50 bg-white">
          <InitialChartView
            patientId={initialChart.patient_id}
            patientName={patientName}
            chartId={initialChart.id}
            startEditing={true}
            embedded={true}
            onClose={() => {
              setShowChartEditor(false);
              loadData();
            }}
          />
        </div>
      )}
    </div>
  );
};

export default MedicalRecordDetail;
