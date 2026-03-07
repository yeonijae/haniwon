import { useState, useEffect, useMemo, Fragment } from 'react';
import { format, subDays } from 'date-fns';
import { diarizeTranscript, updateDiarizedTranscript } from '../../pad/services/transcriptionService';

const API_URL = import.meta.env.VITE_POSTGRES_API_URL || 'http://192.168.0.173:5200';

interface MedicalTranscript {
  id: number;
  acting_id: number;
  patient_id: number;
  recording_date?: string | null;
  patient_name: string | null;
  chart_number: string | null;
  doctor_id: number;
  doctor_name: string;
  acting_type: string;
  audio_path: string | null;
  transcript: string;
  diarized_transcript: string | null;
  duration_sec: number;
  soap_subjective: string | null;
  soap_objective: string | null;
  soap_assessment: string | null;
  soap_plan: string | null;
  soap_status: 'pending' | 'processing' | 'completed' | 'failed';
  processing_status: 'uploading' | 'transcribing' | 'processing' | 'completed' | 'failed' | null;
  processing_message: string | null;
  created_at: string;
  updated_at: string;
}

interface PatientInfo {
  chart_no: string;
  patient_name: string;
}

type ViewMode = 'day' | '3weeks' | '3months' | 'all';
type PipelineCategory = 'saving' | 'transcribing' | 'done' | 'failed';
type DetailTab = 'raw' | 'diarized' | 'soap';

interface MedicalTranscriptsProps {
  selectedDoctorName?: string;
}

const MedicalTranscripts: React.FC<MedicalTranscriptsProps> = ({ selectedDoctorName }) => {
  // 상태 관리
  const [viewMode, setViewMode] = useState<ViewMode>('all');
  const [baseDate, setBaseDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [transcripts, setTranscripts] = useState<MedicalTranscript[]>([]);
  const [patientMap, setPatientMap] = useState<Map<number, PatientInfo>>(new Map());
  const [chartNumberPatientMap, setChartNumberPatientMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(false);
  const [selectedTranscript, setSelectedTranscript] = useState<MedicalTranscript | null>(null);

  // 필터 상태
  const [searchQuery, setSearchQuery] = useState('');
  const [pipelineFilter, setPipelineFilter] = useState<PipelineCategory | null>(null);

  // 작업 상태
  const [isReprocessing, setIsReprocessing] = useState(false);
  const [isDiarizing, setIsDiarizing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [detailTab, setDetailTab] = useState<DetailTab>('raw');

  // 필터링된 녹취록
  const filteredTranscripts = useMemo(() => {
    return transcripts.filter((t) => {
      // 파이프라인 상태 필터
      if (pipelineFilter && getPipelineCategory(t) !== pipelineFilter) return false;

      // 검색어 필터
      if (searchQuery) {
        const patient = patientMap.get(t.patient_id);
        const chartFallbackName = t.chart_number ? chartNumberPatientMap.get(t.chart_number) : undefined;
        const searchLower = searchQuery.toLowerCase();
        const matchesSearch =
          t.transcript?.toLowerCase().includes(searchLower) ||
          t.patient_name?.toLowerCase().includes(searchLower) ||
          patient?.patient_name?.toLowerCase().includes(searchLower) ||
          chartFallbackName?.toLowerCase().includes(searchLower) ||
          t.doctor_name?.toLowerCase().includes(searchLower) ||
          t.chart_number?.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      return true;
    });
  }, [transcripts, searchQuery, pipelineFilter, patientMap, chartNumberPatientMap]);

  // 파이프라인 카테고리 분류 (function 선언문으로 호이스팅 보장)
  function getPipelineCategory(t: MedicalTranscript): PipelineCategory {
    // 실패: 어느 단계든 failed 이거나, 처리 완료인데 transcript가 없는 경우
    if (t.processing_status === 'failed' || t.soap_status === 'failed' ||
        (!t.transcript && t.processing_status === 'completed')) {
      return 'failed';
    }
    // 저장중: 업로드 단계
    if (t.processing_status === 'uploading') {
      return 'saving';
    }
    // 완료: processing과 soap 모두 완료
    if ((!t.processing_status || t.processing_status === 'completed') && t.soap_status === 'completed') {
      return 'done';
    }
    // 변환중: 나머지 진행 중인 상태
    return 'transcribing';
  }

  // 파이프라인 상태 배지 카운트 (전체 조회 결과 기준)
  const pipelineStats = useMemo(() => {
    const counts = { saving: 0, transcribing: 0, done: 0, failed: 0 };
    transcripts.forEach(t => { counts[getPipelineCategory(t)]++; });
    return counts;
  }, [transcripts]);

  // 녹취록 조회
  const fetchTranscripts = async () => {
    setLoading(true);
    try {
      let sql = '';
      const tsExpr = `COALESCE(recording_date, NULLIF(created_at,'')::timestamp)`;
      const localDateExpr = `date(${tsExpr})`;
      const conditions: string[] = [];

      // 의사 필터
      if (selectedDoctorName) {
        conditions.push(`doctor_name = '${selectedDoctorName.replace(/'/g, "''")}'`);
      }

      if (viewMode === 'day') {
        conditions.push(`${localDateExpr} = '${baseDate}'`);
      } else if (viewMode === '3weeks') {
        const rangeStart = format(subDays(new Date(baseDate), 20), 'yyyy-MM-dd');
        conditions.push(`${localDateExpr} >= '${rangeStart}' AND ${localDateExpr} <= '${baseDate}'`);
      } else if (viewMode === '3months') {
        // 3개월 = 90일 윈도우 (baseDate 포함 90일: baseDate-89 ~ baseDate)
        const rangeStart = format(subDays(new Date(baseDate), 89), 'yyyy-MM-dd');
        conditions.push(`${localDateExpr} >= '${rangeStart}' AND ${localDateExpr} <= '${baseDate}'`);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      sql = `
        SELECT * FROM medical_transcripts
        ${whereClause}
        ORDER BY ${tsExpr} DESC
      `;

      const response = await fetch(`${API_URL}/api/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql }),
      });

      const data = await response.json();
      if (!data.rows || data.rows.length === 0) {
        setTranscripts([]);
        return;
      }

      // PostgreSQL API는 rows를 객체 배열로 반환
      let items: MedicalTranscript[];
      if (data.columns && Array.isArray(data.rows[0])) {
        // 구버전 형식: columns + rows(배열)
        items = data.rows.map((row: any[]) => {
          const obj: any = {};
          data.columns.forEach((col: string, idx: number) => {
            obj[col] = row[idx];
          });
          return obj as MedicalTranscript;
        });
      } else {
        // PostgreSQL 형식: rows(객체 배열)
        items = data.rows as MedicalTranscript[];
      }

      setTranscripts(items);

      // 환자 정보 조회
      const patientIds = [...new Set(items.map((t) => t.patient_id))];
      if (patientIds.length > 0) {
        await fetchPatientInfo(patientIds);
      }

      // chart_number 기반 fallback 이름 조회 (PG 공통키)
      const chartNumbers = [...new Set(items.map((t) => t.chart_number).filter(Boolean) as string[])];
      if (chartNumbers.length > 0) {
        await fetchPatientInfoByChartNumbers(chartNumbers);
      }
    } catch (error) {
      console.error('녹취록 조회 실패:', error);
      setTranscripts([]);
    } finally {
      setLoading(false);
    }
  };

  // 환자 정보 조회 (MSSQL: patient_id 기준)
  const fetchPatientInfo = async (patientIds: number[]) => {
    try {
      const mssqlApiUrl = import.meta.env.VITE_MSSQL_API_URL || 'http://192.168.0.173:3100';
      const response = await fetch(`${mssqlApiUrl}/api/patients/by-ids`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: patientIds }),
      });

      const data = await response.json();
      if (data.patients) {
        const map = new Map<number, PatientInfo>();
        data.patients.forEach((p: any) => {
          // mssql API 응답: { id, chart_no, name, ... }
          map.set(p.id, { chart_no: p.chart_no, patient_name: p.name });
        });
        setPatientMap(map);
      }
    } catch (error) {
      console.error('환자 정보 조회 실패:', error);
    }
  };

  // 환자 정보 조회 (PostgreSQL: chart_number 공통키 기준)
  const fetchPatientInfoByChartNumbers = async (chartNumbers: string[]) => {
    try {
      const normalized = [...new Set(chartNumbers.map((c) => String(c).trim()).filter(Boolean))];
      if (normalized.length === 0) return;

      const inList = normalized.map((c) => `'${c.replace(/'/g, "''")}'`).join(',');
      const response = await fetch(`${API_URL}/api/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sql: `SELECT chart_number, name FROM patients WHERE chart_number IN (${inList})`,
        }),
      });

      const data = await response.json();
      if (!data?.rows) return;

      const rows = Array.isArray(data.rows[0]) && data.columns
        ? data.rows.map((row: any[]) => {
            const obj: any = {};
            data.columns.forEach((col: string, idx: number) => {
              obj[col] = row[idx];
            });
            return obj;
          })
        : data.rows;

      const map = new Map<string, string>();
      rows.forEach((r: any) => {
        if (r.chart_number && r.name) map.set(String(r.chart_number), String(r.name));
      });
      setChartNumberPatientMap(map);
    } catch (error) {
      console.error('차트번호 기반 환자 정보 조회 실패:', error);
    }
  };

  // 화자 분리 실행
  const handleDiarize = async () => {
    if (!selectedTranscript) return;

    setIsDiarizing(true);
    try {
      // Gemini API를 통한 화자 분리
      const result = await diarizeTranscript(
        selectedTranscript.transcript,
        selectedTranscript.acting_type
      );

      if (result.success && result.formatted) {
        // DB 업데이트
        await updateDiarizedTranscript(selectedTranscript.id, result.formatted);
        alert('화자 분리가 완료되었습니다.');
        fetchTranscripts();
      } else {
        throw new Error(result.error || 'Empty response');
      }
    } catch (error) {
      console.error('화자 분리 실패:', error);
      alert('화자 분리에 실패했습니다.');
    } finally {
      setIsDiarizing(false);
    }
  };

  // SOAP 재처리
  const handleReprocessSoap = async () => {
    if (!selectedTranscript) return;

    setIsReprocessing(true);
    try {
      // SOAP 상태 초기화
      await fetch(`${API_URL}/api/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sql: `UPDATE medical_transcripts SET soap_status = 'processing', updated_at = NOW() WHERE id = ${selectedTranscript.id}`,
        }),
      });

      // SOAP 변환 요청
      const soapResponse = await fetch(`${API_URL}/api/gpt/soap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: selectedTranscript.transcript,
          acting_type: selectedTranscript.acting_type,
        }),
      });

      const soapData = await soapResponse.json();

      if (soapData.subjective || soapData.objective || soapData.assessment || soapData.plan) {
        // SOAP 저장
        const escapeStr = (str: string | null) =>
          str ? `'${str.replace(/'/g, "''")}'` : 'NULL';

        await fetch(`${API_URL}/api/execute`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sql: `UPDATE medical_transcripts SET
              soap_subjective = ${escapeStr(soapData.subjective)},
              soap_objective = ${escapeStr(soapData.objective)},
              soap_assessment = ${escapeStr(soapData.assessment)},
              soap_plan = ${escapeStr(soapData.plan)},
              soap_status = 'completed',
              updated_at = NOW()
            WHERE id = ${selectedTranscript.id}`,
          }),
        });

        alert('SOAP 재처리가 완료되었습니다.');
        fetchTranscripts();
      } else {
        throw new Error('SOAP 변환 실패');
      }
    } catch (error) {
      console.error('SOAP 재처리 실패:', error);
      alert('SOAP 재처리에 실패했습니다.');

      // 실패 상태 업데이트
      await fetch(`${API_URL}/api/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sql: `UPDATE medical_transcripts SET soap_status = 'failed', updated_at = NOW() WHERE id = ${selectedTranscript.id}`,
        }),
      });
    } finally {
      setIsReprocessing(false);
    }
  };

  // 녹취록 삭제
  const handleDelete = async () => {
    if (!selectedTranscript) return;

    setIsDeleting(true);
    try {
      await fetch(`${API_URL}/api/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sql: `DELETE FROM medical_transcripts WHERE id = ${selectedTranscript.id}`,
        }),
      });

      alert('녹취록이 삭제되었습니다.');
      setSelectedTranscript(null);
      setShowDeleteConfirm(false);
      fetchTranscripts();
    } catch (error) {
      console.error('녹취록 삭제 실패:', error);
      alert('녹취록 삭제에 실패했습니다.');
    } finally {
      setIsDeleting(false);
    }
  };

  // 내보내기 (텍스트)
  const handleExport = () => {
    if (!selectedTranscript) return;

    const patient = patientMap.get(selectedTranscript.patient_id);
    const displayPatientName = getDisplayPatientName(selectedTranscript);
    let content = `녹취록 내보내기\n`;
    content += `================\n\n`;
    content += `환자: ${displayPatientName}\n`;
    content += `의료진: ${selectedTranscript.doctor_name}\n`;
    content += `진료유형: ${selectedTranscript.acting_type}\n`;
    content += `녹음시간: ${formatDuration(selectedTranscript.duration_sec)}\n`;
    content += `일시: ${formatDate(getDisplayDateTime(selectedTranscript), 'yyyy-MM-dd HH:mm')}\n\n`;
    content += `[녹취 내용]\n${selectedTranscript.transcript}\n\n`;

    if (selectedTranscript.soap_status === 'completed') {
      content += `[SOAP 기록]\n`;
      content += `S (주관적 증상): ${selectedTranscript.soap_subjective || '-'}\n\n`;
      content += `O (객관적 소견): ${selectedTranscript.soap_objective || '-'}\n\n`;
      content += `A (평가): ${selectedTranscript.soap_assessment || '-'}\n\n`;
      content += `P (계획): ${selectedTranscript.soap_plan || '-'}\n`;
    }

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `녹취록_${displayPatientName}_${formatDate(getDisplayDateTime(selectedTranscript), 'yyyyMMdd_HHmm')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    fetchTranscripts();
  }, [viewMode, baseDate, selectedDoctorName]);

  // 파이프라인 단계 표시기
  const getPipelineSteps = (t: MedicalTranscript): { label: string; status: 'done' | 'in-progress' | 'not-started' | 'failed' }[] => {
    const dones = [
      !!t.audio_path,
      !!t.transcript && t.transcript.trim() !== '',
      !!t.diarized_transcript && t.diarized_transcript.trim() !== '',
      t.soap_status === 'completed',
    ];
    const labels = [`녹음 ${formatDuration(t.duration_sec)}`, '녹취', '화자', 'SOAP'];
    const hasFailed = t.processing_status === 'failed' || t.soap_status === 'failed';
    const firstPendingIdx = dones.findIndex(d => !d);

    return labels.map((label, i) => ({
      label,
      status: dones[i]
        ? 'done'
        : hasFailed
          ? 'failed'
          : i === firstPendingIdx
            ? 'in-progress'
            : 'not-started',
    }));
  };

  // SOAP 상태 배지
  const getSoapStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full">완료</span>
        );
      case 'processing':
        return (
          <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full animate-pulse">
            처리중
          </span>
        );
      case 'failed':
        return (
          <span className="px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded-full">실패</span>
        );
      default:
        return (
          <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-700 rounded-full">대기</span>
        );
    }
  };

  // 처리 상태 배지 (서버 사이드 처리)
  const getProcessingStatusBadge = (transcript: MedicalTranscript) => {
    const status = transcript.processing_status;
    if (!status || status === 'completed') return null;

    const statusConfig: Record<string, { bg: string; text: string; icon: string; label: string }> = {
      uploading: { bg: 'bg-gray-100', text: 'text-gray-700', icon: 'fa-cloud-upload-alt', label: '업로드' },
      transcribing: { bg: 'bg-yellow-100', text: 'text-yellow-700', icon: 'fa-microphone', label: '녹취변환' },
      processing: { bg: 'bg-blue-100', text: 'text-blue-700', icon: 'fa-cog fa-spin', label: 'SOAP변환' },
      failed: { bg: 'bg-red-100', text: 'text-red-700', icon: 'fa-exclamation-circle', label: '실패' },
    };

    const config = statusConfig[status] || statusConfig.uploading;

    return (
      <div className={`flex items-center gap-1 px-2 py-0.5 text-xs ${config.bg} ${config.text} rounded-full`}>
        <i className={`fas ${config.icon}`}></i>
        <span>{config.label}</span>
      </div>
    );
  };

  // 서버 사이드 재처리 요청
  const handleServerRetry = async (transcriptId: number) => {
    setIsReprocessing(true);
    try {
      const response = await fetch(`${API_URL}/api/transcribe/retry/${transcriptId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      if (data.success) {
        alert('재처리가 시작되었습니다. 잠시 후 새로고침하세요.');
        fetchTranscripts();
      } else {
        throw new Error(data.error || '재처리 실패');
      }
    } catch (error: any) {
      console.error('재처리 실패:', error);
      alert(`재처리 실패: ${error.message}`);
    } finally {
      setIsReprocessing(false);
    }
  };

  // 실제 진료/녹음 시각 우선, 없으면 생성 시각 fallback
  const getDisplayDateTime = (t: MedicalTranscript) => t.recording_date || t.created_at;

  // 환자명 fallback: row.patient_name → patient_id 조회 → chart_number 공통키 조회
  const getDisplayPatientName = (t: MedicalTranscript) => {
    const byPatientId = patientMap.get(t.patient_id)?.patient_name;
    const byChartNumber = t.chart_number ? chartNumberPatientMap.get(t.chart_number) : undefined;
    return t.patient_name || byPatientId || byChartNumber || `환자 #${t.patient_id}`;
  };

  // 백엔드 datetime 문자열을 파싱하여 로컬 시각 부분을 반환
  // - ISO with TZ (Z, +00:00 등): Date 객체로 변환하여 로컬(KST) 시각 추출
  // - naive datetime (TZ 없음): 벽시계 시각 그대로 사용 (추가 변환 없음)
  const parseClinicDateParts = (dateStr: string) => {
    if (!dateStr) return null;

    const iso = dateStr.match(/(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
    if (iso) {
      // 타임존 정보가 포함된 경우 (Z, +HH:MM, -HH:MM, +HHMM)
      const hasTZ = /[Zz]|[+-]\d{2}:?\d{2}\s*$/.test(dateStr.trim());
      if (hasTZ) {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
          return {
            year: d.getFullYear(),
            month: d.getMonth() + 1,
            day: d.getDate(),
            hour: d.getHours(),
            minute: d.getMinutes(),
            second: d.getSeconds(),
          };
        }
      }
      // naive datetime (TZ 없음) — 로컬 벽시계 시각 그대로 사용
      return {
        year: Number(iso[1]),
        month: Number(iso[2]),
        day: Number(iso[3]),
        hour: Number(iso[4]),
        minute: Number(iso[5]),
        second: Number(iso[6] || 0),
      };
    }

    // RFC 형식 (GMT 포함) — Date로 파싱하여 로컬 시각 추출
    const rfc = dateStr.match(/\w{3},\s\d{2}\s\w{3}\s\d{4}\s\d{2}:\d{2}:\d{2}\sGMT/i);
    if (rfc) {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) {
        return {
          year: d.getFullYear(),
          month: d.getMonth() + 1,
          day: d.getDate(),
          hour: d.getHours(),
          minute: d.getMinutes(),
          second: d.getSeconds(),
        };
      }
    }

    return null;
  };

  // 시간 포맷
  const formatTime = (dateStr: string) => {
    const p = parseClinicDateParts(dateStr);
    if (p) return `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`;

    try {
      if (!dateStr) return '--:--';
      return format(new Date(dateStr), 'HH:mm');
    } catch {
      return '--:--';
    }
  };

  // 날짜 포맷 (안전)
  const formatDate = (dateStr: string, formatStr: string = 'MM/dd') => {
    const p = parseClinicDateParts(dateStr);
    if (p) {
      const MM = String(p.month).padStart(2, '0');
      const dd = String(p.day).padStart(2, '0');
      const HH = String(p.hour).padStart(2, '0');
      const mm = String(p.minute).padStart(2, '0');
      if (formatStr === 'MM/dd') return `${MM}/${dd}`;
      if (formatStr === 'yyyy-MM-dd HH:mm') return `${p.year}-${MM}-${dd} ${HH}:${mm}`;
      if (formatStr === 'yyyyMMdd_HHmm') return `${p.year}${MM}${dd}_${HH}${mm}`;
      return `${MM}/${dd}`;
    }

    try {
      if (!dateStr) return '--/--';
      return format(new Date(dateStr), formatStr);
    } catch {
      return '--/--';
    }
  };

  // 녹음 시간 포맷
  const formatDuration = (seconds: number) => {
    if (!seconds) return '0:00';
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // 진료일자 포맷: 년. 월. 일. (요일)
  const formatDateWithWeekday = (dateStr: string) => {
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const p = parseClinicDateParts(dateStr);
    if (p) {
      const d = new Date(p.year, p.month - 1, p.day);
      return `${p.year}. ${String(p.month).padStart(2, '0')}. ${String(p.day).padStart(2, '0')}. (${days[d.getDay()]})`;
    }
    try {
      const d = new Date(dateStr);
      return `${d.getFullYear()}. ${String(d.getMonth() + 1).padStart(2, '0')}. ${String(d.getDate()).padStart(2, '0')}. (${days[d.getDay()]})`;
    } catch {
      return '--';
    }
  };

  const formatBaseDateDisplay = (dateStr: string) => {
    try {
      const d = new Date(`${dateStr}T00:00:00`);
      const days = ['일', '월', '화', '수', '목', '금', '토'];
      return `${d.getFullYear()}. ${String(d.getMonth() + 1).padStart(2, '0')}. ${String(d.getDate()).padStart(2, '0')}. (${days[d.getDay()]})`;
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setBaseDate(format(subDays(new Date(baseDate), 1), 'yyyy-MM-dd'))}
            className="occ-date-btn"
          >
            ◀
          </button>
          <div className="occ-date-wrap" style={{ width: 'auto' }}>
            <input
              type="date"
              value={baseDate}
              onChange={(e) => setBaseDate(e.target.value)}
              className="occ-date-hidden"
              id="transcript-base-date-picker"
            />
            <button
              className="occ-date-display"
              onClick={() => {
                const el = document.getElementById('transcript-base-date-picker') as HTMLInputElement;
                el?.showPicker?.();
              }}
            >
              {formatBaseDateDisplay(baseDate)}
            </button>
          </div>
          <button
            onClick={() => setBaseDate(format(subDays(new Date(baseDate), -1), 'yyyy-MM-dd'))}
            className="occ-date-btn"
          >
            ▶
          </button>
          {baseDate !== format(new Date(), 'yyyy-MM-dd') && (
            <button
              onClick={() => setBaseDate(format(new Date(), 'yyyy-MM-dd'))}
              className="occ-today-btn"
            >
              오늘
            </button>
          )}

          <div className="occ-filter-group occ-filter-patient">
            {([['day', '일별'], ['3weeks', '3주'], ['3months', '3개월'], ['all', '전체']] as [ViewMode, string][]).map(([mode, label]) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`occ-filter-btn ${viewMode === mode ? 'active' : ''}`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="occ-filter-group occ-filter-patient">
            {([
              ['saving', '저장중', pipelineStats.saving],
              ['transcribing', '변환중', pipelineStats.transcribing],
              ['done', '완료', pipelineStats.done],
              ['failed', '실패', pipelineStats.failed],
            ] as [PipelineCategory, string, number][]).map(([key, label, count]) => (
              <button
                key={key}
                onClick={() => setPipelineFilter(pipelineFilter === key ? null : key)}
                className={`occ-filter-btn ${pipelineFilter === key ? 'active' : ''}`}
              >
                {label} <span className="font-bold ml-0.5">{count}</span>
              </button>
            ))}
          </div>

          <div className="relative ml-auto" style={{ width: '220px' }}>
            <i className="fas fa-search absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs"></i>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="환자명/차트번호/내용 검색"
              className="w-full pl-7 pr-2 py-2 border border-gray-300 rounded-md text-xs focus:ring-1 focus:ring-clinic-primary focus:border-clinic-primary"
            />
          </div>

          <button
            onClick={fetchTranscripts}
            disabled={loading}
            className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <i className={`fas fa-sync-alt ${loading ? 'animate-spin' : ''}`}></i>
          </button>
        </div>
      </div>

      {/* 컨텐츠 영역 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 목록 */}
        <div className="w-[420px] border-r border-gray-200 bg-white overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <i className="fas fa-spinner fa-spin text-gray-400 text-xl"></i>
            </div>
          ) : filteredTranscripts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-gray-400">
              <i className="fas fa-microphone-slash text-3xl mb-2"></i>
              <p>녹취 기록이 없습니다</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredTranscripts.map((t) => {
                const patient = patientMap.get(t.patient_id);
                return (
                  <div
                    key={t.id}
                    onClick={() => setSelectedTranscript(t)}
                    className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                      selectedTranscript?.id === t.id
                        ? 'bg-clinic-primary/5 border-l-4 border-clinic-primary'
                        : ''
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <span className="font-medium text-gray-800">
                          {getDisplayPatientName(t)}
                        </span>
                        {(t.chart_number || patient?.chart_no) && (
                          <span className="ml-2 text-xs text-gray-400">#{t.chart_number || patient?.chart_no}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {getProcessingStatusBadge(t)}
                        {(!t.processing_status || t.processing_status === 'completed') && getSoapStatusBadge(t.soap_status)}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-500 mb-2">
                      <span>
                        <i className="fas fa-calendar-alt mr-1"></i>
                        {formatDate(getDisplayDateTime(t))}
                      </span>
                      <span>
                        <i className="fas fa-clock mr-1"></i>
                        {formatTime(getDisplayDateTime(t))}
                      </span>
                      <span>
                        <i className="fas fa-stopwatch mr-1"></i>
                        {formatDuration(t.duration_sec)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 bg-gray-100 rounded text-xs text-gray-600">
                        {t.acting_type}
                      </span>
                      <span className="text-xs text-gray-400">{t.doctor_name}</span>
                      {t.audio_path && (
                        <span className="text-xs text-blue-500">
                          <i className="fas fa-volume-up"></i>
                        </span>
                      )}
                    </div>
                    {/* 녹취 미리보기 */}
                    {!t.transcript && t.audio_path ? (
                      <p className="mt-2 text-xs text-amber-600">
                        <i className="fas fa-exclamation-triangle mr-1"></i>녹취 실패 — 재시도 가능
                      </p>
                    ) : (
                      <p className="mt-2 text-xs text-gray-400 line-clamp-2">
                        {t.transcript?.substring(0, 100)}...
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 상세 보기 */}
        <div className="flex-1 overflow-y-auto p-6">
          {selectedTranscript ? (
            <div className="max-w-4xl mx-auto space-y-4">
              {/* 상단: 메타 + 파이프라인 + 액션 단일 행 */}
              <div className="flex items-center gap-2 flex-wrap text-[15px] py-0.5">
                <span className="font-semibold text-gray-800 whitespace-nowrap">
                  {getDisplayPatientName(selectedTranscript)}
                  {(selectedTranscript.chart_number || patientMap.get(selectedTranscript.patient_id)?.chart_no) && (
                    <span className="text-gray-400 text-xs ml-0.5">
                      ({selectedTranscript.chart_number || patientMap.get(selectedTranscript.patient_id)?.chart_no})
                    </span>
                  )}
                </span>
                <span className="text-gray-300">|</span>
                <span className="text-gray-600 whitespace-nowrap">
                  {formatDateWithWeekday(getDisplayDateTime(selectedTranscript))}
                </span>
                <span className="text-gray-300">|</span>
                <span className="text-gray-600 whitespace-nowrap">
                  {formatTime(getDisplayDateTime(selectedTranscript))}
                </span>
                <span className="text-gray-300">|</span>
                <span className="text-gray-600 whitespace-nowrap">
                  {selectedTranscript.doctor_name}
                </span>
                <span className="text-gray-300">|</span>
                <div className="flex items-center gap-1">
                  {getPipelineSteps(selectedTranscript).map((step, idx, arr) => (
                    <Fragment key={idx}>
                      <span className={`inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full ${
                        step.status === 'done' ? 'bg-green-100 text-green-700' :
                        step.status === 'in-progress' ? 'bg-blue-100 text-blue-700 animate-pulse' :
                        step.status === 'failed' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-400'
                      }`}>
                        {step.status === 'done' && <i className="fas fa-check text-[10px] mr-1"></i>}
                        {step.status === 'failed' && <i className="fas fa-times text-[10px] mr-1"></i>}
                        {step.label}
                      </span>
                      {idx < arr.length - 1 && (
                        <i className="fas fa-chevron-right text-[8px] text-gray-300"></i>
                      )}
                    </Fragment>
                  ))}
                </div>
                <div className="flex items-center gap-1 ml-auto">
                  {(selectedTranscript.soap_status === 'failed' ||
                    selectedTranscript.soap_status === 'pending') && (
                    <button
                      onClick={handleReprocessSoap}
                      disabled={isReprocessing}
                      className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
                      title={isReprocessing ? '처리중...' : 'SOAP 재처리'}
                    >
                      <i className={`fas fa-redo text-sm ${isReprocessing ? 'animate-spin' : ''}`}></i>
                    </button>
                  )}
                  <button
                    onClick={handleExport}
                    className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                    title="내보내기"
                  >
                    <i className="fas fa-download text-sm"></i>
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
                    title="삭제"
                  >
                    <i className="fas fa-trash text-sm"></i>
                  </button>
                </div>
              </div>

              {/* 탭 바 */}
              <div className="flex items-center border-b border-gray-200">
                {([
                  ['raw', '녹취원본'],
                  ['diarized', '화자분리'],
                  ['soap', 'SOAP'],
                ] as [DetailTab, string][]).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setDetailTab(key)}
                    className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                      detailTab === key
                        ? 'border-clinic-primary text-clinic-primary'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* 탭 컨텐츠 */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                {/* 녹취원본 탭 */}
                {detailTab === 'raw' && (
                  <>
                    <div className="px-6 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-end">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(selectedTranscript.transcript || '');
                          alert('녹취 내용이 클립보드에 복사되었습니다.');
                        }}
                        className="text-sm text-gray-500 hover:text-gray-700"
                      >
                        <i className="fas fa-copy mr-1"></i>
                        복사
                      </button>
                    </div>
                    <div className="p-6">
                      <p className="text-gray-700 whitespace-pre-wrap leading-relaxed text-sm">
                        {selectedTranscript.transcript || '녹취 내용이 없습니다.'}
                      </p>
                      {!selectedTranscript.transcript && selectedTranscript.audio_path && (
                        <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-center">
                          <p className="text-sm text-amber-700 mb-2">
                            <i className="fas fa-exclamation-triangle mr-1"></i>
                            음성 파일은 있지만 텍스트 변환에 실패했습니다
                          </p>
                          <button
                            onClick={() => handleServerRetry(selectedTranscript.id)}
                            disabled={isReprocessing}
                            className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50 text-sm"
                          >
                            <i className={`fas fa-redo mr-1 ${isReprocessing ? 'animate-spin' : ''}`}></i>
                            {isReprocessing ? '변환 중...' : '녹취 재시도'}
                          </button>
                        </div>
                      )}
                    </div>
                    {selectedTranscript.audio_path && (
                      <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
                        <audio
                          controls
                          src={`${API_URL}/api/files/${selectedTranscript.audio_path}`}
                          className="w-full h-10"
                        />
                      </div>
                    )}
                  </>
                )}

                {/* 화자분리 탭 */}
                {detailTab === 'diarized' && (
                  <>
                    <div className="px-6 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {!selectedTranscript.diarized_transcript && (
                          <button
                            onClick={handleDiarize}
                            disabled={isDiarizing}
                            className="text-sm text-blue-500 hover:text-blue-700 disabled:opacity-50"
                          >
                            <i className={`fas fa-users mr-1 ${isDiarizing ? 'animate-pulse' : ''}`}></i>
                            {isDiarizing ? '분리중...' : '화자분리 실행'}
                          </button>
                        )}
                      </div>
                      {selectedTranscript.diarized_transcript && (
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(selectedTranscript.diarized_transcript || '');
                            alert('화자분리 내용이 클립보드에 복사되었습니다.');
                          }}
                          className="text-sm text-gray-500 hover:text-gray-700"
                        >
                          <i className="fas fa-copy mr-1"></i>
                          복사
                        </button>
                      )}
                    </div>
                    <div className="p-6">
                      {selectedTranscript.diarized_transcript ? (
                        <div className="space-y-3">
                          {selectedTranscript.diarized_transcript.split('\n').map((line, idx) => {
                            const trimmed = line.trim();
                            if (!trimmed) return null;
                            const isDoctor = trimmed.startsWith('[의사]');
                            const isPatient = trimmed.startsWith('[환자]');
                            const text = trimmed.replace(/^\[(의사|환자)\]\s*/, '');
                            if (isDoctor) {
                              return (
                                <div key={idx} className="flex gap-3">
                                  <div className="flex-shrink-0 w-16 text-right">
                                    <span className="inline-block px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
                                      의사
                                    </span>
                                  </div>
                                  <p className="flex-1 text-gray-700 text-sm leading-relaxed">{text}</p>
                                </div>
                              );
                            } else if (isPatient) {
                              return (
                                <div key={idx} className="flex gap-3">
                                  <div className="flex-shrink-0 w-16 text-right">
                                    <span className="inline-block px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                                      환자
                                    </span>
                                  </div>
                                  <p className="flex-1 text-gray-700 text-sm leading-relaxed">{text}</p>
                                </div>
                              );
                            }
                            return (
                              <p key={idx} className="text-gray-500 text-sm pl-[76px]">{trimmed}</p>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-gray-400">
                          <i className="fas fa-users text-3xl mb-2 block"></i>
                          <p>화자분리 결과가 없습니다</p>
                          <p className="text-xs mt-1">위 버튼을 눌러 화자분리를 실행하세요</p>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* SOAP 탭 */}
                {detailTab === 'soap' && (
                  <>
                    {selectedTranscript.soap_status === 'completed' ? (
                      <>
                        <div className="px-6 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-end">
                          <button
                            onClick={() => {
                              const soap = `S: ${selectedTranscript.soap_subjective || '-'}\n\nO: ${selectedTranscript.soap_objective || '-'}\n\nA: ${selectedTranscript.soap_assessment || '-'}\n\nP: ${selectedTranscript.soap_plan || '-'}`;
                              navigator.clipboard.writeText(soap);
                              alert('SOAP 내용이 클립보드에 복사되었습니다.');
                            }}
                            className="text-sm text-gray-500 hover:text-gray-700"
                          >
                            <i className="fas fa-copy mr-1"></i>
                            복사
                          </button>
                        </div>
                        <div className="divide-y divide-gray-100">
                          <div className="p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="w-7 h-7 flex items-center justify-center bg-blue-100 text-blue-700 rounded-lg font-bold text-sm">S</span>
                              <span className="font-medium text-gray-700">Subjective (주관적 증상)</span>
                            </div>
                            <p className="text-gray-600 pl-9 whitespace-pre-wrap text-sm">
                              {selectedTranscript.soap_subjective || '-'}
                            </p>
                          </div>
                          <div className="p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="w-7 h-7 flex items-center justify-center bg-green-100 text-green-700 rounded-lg font-bold text-sm">O</span>
                              <span className="font-medium text-gray-700">Objective (객관적 소견)</span>
                            </div>
                            <p className="text-gray-600 pl-9 whitespace-pre-wrap text-sm">
                              {selectedTranscript.soap_objective || '-'}
                            </p>
                          </div>
                          <div className="p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="w-7 h-7 flex items-center justify-center bg-yellow-100 text-yellow-700 rounded-lg font-bold text-sm">A</span>
                              <span className="font-medium text-gray-700">Assessment (평가)</span>
                            </div>
                            <p className="text-gray-600 pl-9 whitespace-pre-wrap text-sm">
                              {selectedTranscript.soap_assessment || '-'}
                            </p>
                          </div>
                          <div className="p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="w-7 h-7 flex items-center justify-center bg-purple-100 text-purple-700 rounded-lg font-bold text-sm">P</span>
                              <span className="font-medium text-gray-700">Plan (계획)</span>
                            </div>
                            <p className="text-gray-600 pl-9 whitespace-pre-wrap text-sm">
                              {selectedTranscript.soap_plan || '-'}
                            </p>
                          </div>
                        </div>
                      </>
                    ) : selectedTranscript.soap_status === 'processing' ? (
                      <div className="p-6 text-center">
                        <i className="fas fa-spinner fa-spin text-blue-500 text-2xl mb-2 block"></i>
                        <p className="text-blue-700">SOAP 변환 중입니다...</p>
                      </div>
                    ) : selectedTranscript.soap_status === 'failed' ? (
                      <div className="p-6 text-center">
                        <i className="fas fa-exclamation-circle text-red-500 text-2xl mb-2 block"></i>
                        <p className="text-red-700 mb-3">SOAP 변환에 실패했습니다</p>
                        <button
                          onClick={() => handleServerRetry(selectedTranscript.id)}
                          disabled={isReprocessing}
                          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                        >
                          <i className={`fas fa-redo mr-1 ${isReprocessing ? 'animate-spin' : ''}`}></i>
                          {isReprocessing ? '처리중...' : '서버 재처리'}
                        </button>
                      </div>
                    ) : (
                      <div className="p-6 text-center">
                        <i className="fas fa-clock text-gray-400 text-2xl mb-2 block"></i>
                        <p className="text-gray-600 mb-3">SOAP 변환 대기 중</p>
                        <button
                          onClick={handleReprocessSoap}
                          disabled={isReprocessing}
                          className="px-4 py-2 bg-clinic-primary text-white rounded-lg hover:bg-clinic-primary/90 transition-colors disabled:opacity-50"
                        >
                          <i className={`fas fa-play mr-1 ${isReprocessing ? 'animate-spin' : ''}`}></i>
                          {isReprocessing ? '처리중...' : 'SOAP 생성'}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* 서버 사이드 처리 상태 */}
              {selectedTranscript.processing_status && selectedTranscript.processing_status !== 'completed' && (
                <div className={`rounded-xl p-6 ${
                  selectedTranscript.processing_status === 'failed'
                    ? 'bg-red-50 border border-red-200'
                    : 'bg-blue-50 border border-blue-200'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {selectedTranscript.processing_status === 'failed' ? (
                        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                          <i className="fas fa-exclamation-circle text-red-500 text-xl"></i>
                        </div>
                      ) : (
                        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                          <i className="fas fa-cog fa-spin text-blue-500 text-xl"></i>
                        </div>
                      )}
                      <div>
                        <p className={`font-medium ${
                          selectedTranscript.processing_status === 'failed' ? 'text-red-700' : 'text-blue-700'
                        }`}>
                          {selectedTranscript.processing_status === 'uploading' && '업로드 완료, 처리 대기 중...'}
                          {selectedTranscript.processing_status === 'transcribing' && 'Whisper 음성 변환 중...'}
                          {selectedTranscript.processing_status === 'processing' && 'SOAP 및 화자 분리 중...'}
                          {selectedTranscript.processing_status === 'failed' && '처리 실패'}
                        </p>
                        {selectedTranscript.processing_message && (
                          <p className={`text-sm ${
                            selectedTranscript.processing_status === 'failed' ? 'text-red-600' : 'text-blue-600'
                          }`}>
                            {selectedTranscript.processing_message}
                          </p>
                        )}
                      </div>
                    </div>
                    {selectedTranscript.processing_status === 'failed' && (
                      <button
                        onClick={() => handleServerRetry(selectedTranscript.id)}
                        disabled={isReprocessing}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                      >
                        <i className={`fas fa-redo mr-1 ${isReprocessing ? 'animate-spin' : ''}`}></i>
                        {isReprocessing ? '처리중...' : '재처리'}
                      </button>
                    )}
                  </div>
                  {selectedTranscript.processing_status !== 'failed' && (
                    <div className="mt-4">
                      <div className="flex items-center gap-2 text-xs text-blue-600">
                        <div className={`w-2 h-2 rounded-full ${
                          selectedTranscript.processing_status === 'uploading' ? 'bg-blue-500' : 'bg-blue-300'
                        }`}></div>
                        <span>업로드</span>
                        <div className="flex-1 h-0.5 bg-blue-200"></div>
                        <div className={`w-2 h-2 rounded-full ${
                          selectedTranscript.processing_status === 'transcribing' ? 'bg-blue-500 animate-pulse' :
                          selectedTranscript.processing_status === 'processing' ? 'bg-blue-300' : 'bg-gray-200'
                        }`}></div>
                        <span>음성변환</span>
                        <div className="flex-1 h-0.5 bg-blue-200"></div>
                        <div className={`w-2 h-2 rounded-full ${
                          selectedTranscript.processing_status === 'processing' ? 'bg-blue-500 animate-pulse' : 'bg-gray-200'
                        }`}></div>
                        <span>SOAP</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-400">
              <div className="text-center">
                <i className="fas fa-hand-pointer text-4xl mb-3"></i>
                <p>왼쪽에서 녹취 기록을 선택하세요</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 삭제 확인 모달 */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="fas fa-exclamation-triangle text-red-500 text-2xl"></i>
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">녹취록 삭제</h3>
              <p className="text-gray-600">
                이 녹취록을 정말 삭제하시겠습니까?
                <br />
                <span className="text-red-500 text-sm">이 작업은 되돌릴 수 없습니다.</span>
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <i className="fas fa-spinner fa-spin mr-1"></i>
                    삭제중...
                  </>
                ) : (
                  '삭제'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MedicalTranscripts;
