import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { query, queryOne, execute, insert, escapeString, toSqlValue, getCurrentTimestamp } from '@shared/lib/postgres';
import type { InitialChart } from '../types';
import PrescriptionInput, { PrescriptionData } from './PrescriptionInput';

interface ProgressEntry {
  id: number;
  entry_date: string;
  treatment: string;  // 진료
  diagnosis: string;  // 진단
  prescription: string;  // 처방
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
}

const MedicalRecordDetail: React.FC<Props> = ({ recordId, patientName, patientInfo, onClose }) => {
  const navigate = useNavigate();
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
  const [showProgressModal, setShowProgressModal] = useState(false); // 경과 모아보기 모달
  const [showPrescriptionInputModal, setShowPrescriptionInputModal] = useState(false); // 처방입력기 모달
  const [prescriptionFormula, setPrescriptionFormula] = useState(''); // 처방공식
  const [prescriptionSourceType, setPrescriptionSourceType] = useState<'initial_chart' | 'progress_note'>('initial_chart');
  const [prescriptionSourceId, setPrescriptionSourceId] = useState<number | null>(null);

  useEffect(() => {
    loadData();
  }, [recordId]);

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

      // 초진차트 로드 - SQLite
      const chartData = await queryOne<InitialChart>(
        `SELECT * FROM initial_charts WHERE id = ${recordId}`
      );

      if (!chartData) {
        console.error('초진차트를 찾을 수 없습니다');
        return;
      }
      setInitialChart(chartData);
      setInitialChartPrescriptionIssued(chartData.prescription_issued || false);

      // 경과 기록 로드 (progress_notes 테이블에서) - SQLite
      const progressData = await query<{
        id: number;
        patient_id: number;
        note_date: string;
        objective: string;
        assessment: string;
        plan: string;
        prescription_issued: boolean;
        prescription_issued_at: string;
        created_at: string;
      }>(`SELECT * FROM progress_notes WHERE patient_id = ${chartData.patient_id} ORDER BY note_date DESC`);

      // 데이터 변환
      const entries: ProgressEntry[] = (progressData || []).map(note => ({
        id: note.id,
        entry_date: note.note_date,
        treatment: note.objective || '',
        diagnosis: note.assessment || '',
        prescription: note.plan || '',
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
            updated_at = ${escapeString(now)}
          WHERE id = ${lastSavedId}
        `);

        console.log('경과 자동저장 완료 (업데이트)');
      } else {
        // 새 경과 생성
        const newId = await insert(`
          INSERT INTO progress_notes (patient_id, note_date, objective, assessment, plan, created_at, updated_at)
          VALUES (
            ${initialChart.patient_id},
            ${escapeString(noteDate)},
            ${toSqlValue(parsed.treatment)},
            ${toSqlValue(parsed.diagnosis)},
            ${toSqlValue(parsed.prescription)},
            ${escapeString(now)},
            ${escapeString(now)}
          )
        `);

        if (newId) {
          setLastSavedId(newId);
          console.log('경과 자동저장 완료 (신규)');
        }
      }

      setAutoSaveStatus('saved');

      // 2초 후 saved 상태 초기화
      setTimeout(() => {
        setAutoSaveStatus('idle');
      }, 2000);

      // 경과 목록 새로고침
      await loadData();
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
        INSERT INTO progress_notes (patient_id, note_date, objective, assessment, plan, created_at, updated_at)
        VALUES (
          ${initialChart.patient_id},
          ${escapeString(noteDate)},
          ${toSqlValue(parsed.treatment)},
          ${toSqlValue(parsed.diagnosis)},
          ${toSqlValue(parsed.prescription)},
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

  const handleEditChart = () => {
    if (initialChart) {
      setEditedNotes(initialChart.notes || '');
      setIsEditingChart(true);
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
    const entryDate = new Date(entry.entry_date).toISOString().split('T')[0];
    setProgressDate(entryDate);

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
      const prescriptionDate = now.toISOString().split('T')[0];

      // prescriptions 테이블에 저장 - SQLite
      await insert(`
        INSERT INTO prescriptions (
          prescription_number, prescription_date, patient_id, patient_name, chart_number,
          patient_age, patient_gender, source_type, source_id, formula,
          merged_herbs, final_herbs, total_doses, days, doses_per_day,
          total_packs, pack_volume, water_amount, herb_adjustment, total_dosage,
          final_total_amount, notes, status, issued_at, created_at, updated_at
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
          ${escapeString(nowTimestamp)}
        )
      `);

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
      onClose(); // 진료기록 상세 모달 닫기
      navigate('/chart/prescriptions'); // 처방관리로 이동
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

    // 처방 내용에서 공식 추출
    const formula = extractFormulaFromPrescription(progressEntry.prescription || '');

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
      if (entry.diagnosis) {
        const entryDate = new Date(entry.entry_date).toLocaleDateString('ko-KR');
        if (!dates.includes(entryDate)) {
          dates.push(entryDate);
        }

        if (!data[entryDate]) {
          data[entryDate] = {};
        }

        // 경과의 diagnosis에서 각 섹션 추출
        const diagnosisText = entry.diagnosis;

        // [복진], [설진], [맥진], [혈색]로 구분되어 있는지 확인
        const hasSections = /\[(복진|설진|맥진|혈색)\]/.test(diagnosisText);

        if (hasSections) {
          // 구분자가 있는 경우 각각 추출
          const bokjinMatch = diagnosisText.match(/\[복진\]\s*([^\[]*)/i);
          if (bokjinMatch && bokjinMatch[1].trim()) {
            data[entryDate].복진 = cleanDiagnosisContent(bokjinMatch[1]);
          }

          const seoljinMatch = diagnosisText.match(/\[설진\]\s*([^\[]*)/i);
          if (seoljinMatch && seoljinMatch[1].trim()) {
            data[entryDate].설진 = cleanDiagnosisContent(seoljinMatch[1]);
          }

          const maekjinMatch = diagnosisText.match(/\[맥진\]\s*([^\[]*)/i);
          if (maekjinMatch && maekjinMatch[1].trim()) {
            data[entryDate].맥진 = cleanDiagnosisContent(maekjinMatch[1]);
          }

          const hyeolsaekMatch = diagnosisText.match(/\[혈색\]\s*([^\[]*)/i);
          if (hyeolsaekMatch && hyeolsaekMatch[1].trim()) {
            data[entryDate].혈색 = cleanDiagnosisContent(hyeolsaekMatch[1]);
          }
        } else {
          // 구분자가 없는 경우 메모로 저장
          const cleaned = cleanDiagnosisContent(diagnosisText);
          if (cleaned) {
            data[entryDate].메모 = cleaned;
          }
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
      if (entry.prescription) {
        const entryDate = new Date(entry.entry_date).toLocaleDateString('ko-KR');
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
      if (entry.treatment) {
        const entryDate = new Date(entry.entry_date).toLocaleDateString('ko-KR');
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2">
      <div className="bg-white rounded-lg w-full h-[98vh] flex flex-col shadow-2xl">
        {/* 헤더 */}
        <div className="bg-gray-700 p-3 flex justify-between items-center text-white border-b-2 border-gray-800">
          <div className="flex items-center gap-2">
            <i className="fas fa-file-medical text-lg"></i>
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
              className="px-3 py-1.5 bg-gray-600 hover:bg-gray-500 rounded transition-colors font-medium text-sm"
            >
              <i className="fas fa-notes-medical mr-1"></i>경과 모아보기
            </button>
            <button
              onClick={() => setShowDiagnosisModal(true)}
              className="px-3 py-1.5 bg-gray-600 hover:bg-gray-500 rounded transition-colors font-medium text-sm"
            >
              <i className="fas fa-stethoscope mr-1"></i>진단 모아보기
            </button>
            <button
              onClick={() => setShowPrescriptionModal(true)}
              className="px-3 py-1.5 bg-gray-600 hover:bg-gray-500 rounded transition-colors font-medium text-sm"
            >
              <i className="fas fa-prescription-bottle mr-1"></i>처방 모아보기
            </button>
            <button
              onClick={handleDelete}
              className="px-3 py-1.5 bg-red-700 hover:bg-red-600 rounded transition-colors font-medium text-sm"
            >
              <i className="fas fa-trash mr-1"></i>삭제
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-900 rounded transition-colors font-medium text-sm"
            >
              <i className="fas fa-times mr-1"></i>닫기
            </button>
          </div>
        </div>

        {/* 본문 (좌우 분할) */}
        <div className="flex-1 flex overflow-hidden">
          {/* 왼쪽: 초진차트 (독립 스크롤) */}
          <div className="w-1/2 border-r border-gray-200 overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-4 sticky top-0 bg-white pb-2">
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
                          <h4 className="font-semibold text-gray-800 text-base flex items-center">
                            <i className="fas fa-chevron-right text-xs mr-2"></i>
                            {section.title}
                          </h4>
                          {section.title === '처방' && (section.directContent || section.subsections.length > 0) && (
                            initialChartPrescriptionIssued ? (
                              <button
                                onClick={() => {
                                  onClose();
                                  navigate('/chart/prescriptions');
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
                          <p className="text-clinic-text-primary whitespace-pre-wrap" style={{ lineHeight: '1.7', fontSize: '0.95rem' }}>
                            {section.directContent}
                          </p>
                        </div>
                      )}

                      {section.subsections.length > 0 && (
                        <div className="p-4 space-y-3">
                          {section.subsections.map((subsection, subIndex) => (
                            <div key={subIndex} className="border-l-3 border-gray-400 pl-4 py-2 bg-gray-50">
                              <h5 className="font-semibold text-gray-700 mb-2 text-sm">
                                • {subsection.title}
                              </h5>
                              <div className="text-clinic-text-primary whitespace-pre-wrap ml-3" style={{ lineHeight: '1.7', fontSize: '0.9rem' }}>
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
          <div className="w-1/2 overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-4 sticky top-0 bg-white pb-2">
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
                    const today = new Date().toISOString().split('T')[0];
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
              <div className="bg-gray-50 border border-gray-300 rounded-lg p-4 mb-4">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-semibold text-gray-800">
                    {editingProgressId ? '경과 수정' : '새 경과 추가'}
                  </h4>
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
                <div className="space-y-3">
                  {/* 경과 날짜 입력 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-800 mb-1">
                      <i className="fas fa-calendar-alt mr-1 text-gray-600"></i>
                      경과 날짜
                    </label>
                    <input
                      type="date"
                      value={progressDate}
                      onChange={(e) => setProgressDate(e.target.value)}
                      className="border-2 border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:border-gray-500 focus:ring-2 focus:ring-gray-400 focus:ring-opacity-20 transition-colors"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-800 mb-1">
                      경과 내용
                    </label>
                    <div className="bg-white border border-gray-300 rounded p-2 mb-2 text-xs text-gray-700">
                      <i className="fas fa-info-circle mr-1"></i>
                      <strong>작성 방법:</strong> [경과], [복진], [설진], [맥진], [혈색], [처방] 구분자를 사용하세요
                      <span className="ml-2 text-gray-600">
                        <i className="fas fa-save mr-1"></i>
                        입력 후 5초마다 자동저장됩니다
                      </span>
                    </div>
                    <textarea
                      value={progressText}
                      onChange={(e) => setProgressText(e.target.value)}
                      className="w-full border border-gray-300 rounded p-3 text-sm font-mono focus:outline-none focus:border-gray-500 focus:ring-2 focus:ring-gray-400 focus:ring-opacity-20"
                      rows={12}
                      placeholder="[경과]&#10;환자 상태 호전됨&#10;두통 증상 감소&#10;&#10;[복진]&#10;복부 압통 감소&#10;&#10;[설진]&#10;설태 박백&#10;&#10;[맥진]&#10;맥 평이&#10;&#10;[혈색]&#10;안색 양호&#10;&#10;[처방]&#10;소시호탕 7일분"
                      style={{ lineHeight: '1.6' }}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={editingProgressId ? handleUpdateProgress : handleAddProgress}
                      className="px-4 py-2 bg-clinic-accent text-white rounded hover:bg-green-700 transition-colors font-semibold"
                    >
                      <i className="fas fa-save mr-1"></i>
                      {editingProgressId ? '수정 완료' : '저장'}
                    </button>
                    <button
                      onClick={() => {
                        setShowAddForm(false);
                        setProgressText('');
                        setProgressDate('');
                        setEditingProgressId(null);
                        setLastSavedId(null);
                        setAutoSaveStatus('idle');
                      }}
                      className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
                    >
                      <i className="fas fa-times mr-1"></i>취소
                    </button>
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
                progressEntries.map((entry) => (
                  <div key={entry.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-3 pb-2 border-b">
                      <span className="text-sm font-semibold text-clinic-primary">
                        <i className="fas fa-calendar-alt mr-2"></i>
                        {new Date(entry.entry_date).toLocaleDateString('ko-KR')}
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

                    {entry.treatment && (
                      <div className="mb-3">
                        <h5 className="font-semibold text-gray-700 mb-2" style={{ fontSize: '0.95rem' }}>진료</h5>
                        <p className="text-gray-600 whitespace-pre-wrap" style={{ lineHeight: '1.7', fontSize: '0.9rem' }}>{entry.treatment}</p>
                      </div>
                    )}

                    {entry.diagnosis && (
                      <div className="mb-3">
                        <h5 className="font-semibold text-gray-700 mb-2" style={{ fontSize: '0.95rem' }}>진단</h5>
                        <p className="text-gray-600 whitespace-pre-wrap" style={{ lineHeight: '1.7', fontSize: '0.9rem' }}>{entry.diagnosis}</p>
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
                                navigate('/chart/prescriptions');
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
                        <p className="text-gray-600 whitespace-pre-wrap" style={{ lineHeight: '1.7', fontSize: '0.9rem' }}>{entry.prescription}</p>
                      </div>
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
                                  <div className="text-clinic-text-primary whitespace-pre-wrap" style={{ lineHeight: '1.6', fontSize: '0.9rem' }}>
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

      {/* 처방입력기 모달 */}
      {showPrescriptionInputModal && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[70] p-4">
          <div className="bg-clinic-background rounded-lg w-full max-w-7xl h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* 헤더 */}
            <div className="bg-gray-700 p-4 flex justify-between items-center text-white border-b-2 border-gray-800 flex-shrink-0">
              <div className="flex items-center gap-3">
                <i className="fas fa-prescription text-xl"></i>
                <div>
                  <h3 className="text-xl font-bold">처방전 발급</h3>
                  <p className="text-sm text-gray-300">
                    {patientName}
                    {patientInfo?.chartNumber && ` (${patientInfo.chartNumber})`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowPrescriptionInputModal(false)}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg transition-colors"
              >
                <i className="fas fa-times mr-2"></i>닫기
              </button>
            </div>

            {/* 처방입력기 */}
            <div className="flex-1 overflow-hidden p-4">
              <PrescriptionInput
                onSave={handleSavePrescription}
                patientName={patientName}
                showPatientInput={false}
                showNotesInput={true}
                showSaveButton={true}
                saveButtonText="처방전 발급"
                initialFormula={prescriptionFormula}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MedicalRecordDetail;
