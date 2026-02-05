import { useState, useEffect, useMemo } from 'react';
import { format, subDays, addDays, startOfMonth } from 'date-fns';
import { diarizeTranscript, updateDiarizedTranscript } from '../../pad/services/transcriptionService';

const API_URL = import.meta.env.VITE_POSTGRES_API_URL || 'http://192.168.0.173:3200';

interface MedicalTranscript {
  id: number;
  acting_id: number;
  patient_id: number;
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

type ViewMode = 'day' | 'range' | 'all';
type SoapFilter = 'all' | 'completed' | 'processing' | 'failed' | 'pending';

const MedicalTranscripts: React.FC = () => {
  // 상태 관리
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [transcripts, setTranscripts] = useState<MedicalTranscript[]>([]);
  const [patientMap, setPatientMap] = useState<Map<number, PatientInfo>>(new Map());
  const [loading, setLoading] = useState(false);
  const [selectedTranscript, setSelectedTranscript] = useState<MedicalTranscript | null>(null);

  // 필터 상태
  const [searchQuery, setSearchQuery] = useState('');
  const [doctorFilter, setDoctorFilter] = useState<string>('all');
  const [actingTypeFilter, setActingTypeFilter] = useState<string>('all');
  const [soapFilter, setSoapFilter] = useState<SoapFilter>('all');

  // 작업 상태
  const [isReprocessing, setIsReprocessing] = useState(false);
  const [isDiarizing, setIsDiarizing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDiarized, setShowDiarized] = useState(true); // 화자분리 보기 토글

  // 고유 의사 목록, 진료 유형 목록
  const uniqueDoctors = useMemo(() => {
    const doctors = [...new Set(transcripts.map((t) => t.doctor_name))];
    return doctors.filter(Boolean);
  }, [transcripts]);

  const uniqueActingTypes = useMemo(() => {
    const types = [...new Set(transcripts.map((t) => t.acting_type))];
    return types.filter(Boolean);
  }, [transcripts]);

  // 필터링된 녹취록
  const filteredTranscripts = useMemo(() => {
    return transcripts.filter((t) => {
      // 검색어 필터
      if (searchQuery) {
        const patient = patientMap.get(t.patient_id);
        const searchLower = searchQuery.toLowerCase();
        const matchesSearch =
          t.transcript?.toLowerCase().includes(searchLower) ||
          patient?.patient_name?.toLowerCase().includes(searchLower) ||
          t.doctor_name?.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      // 의사 필터
      if (doctorFilter !== 'all' && t.doctor_name !== doctorFilter) return false;

      // 진료 유형 필터
      if (actingTypeFilter !== 'all' && t.acting_type !== actingTypeFilter) return false;

      // SOAP 상태 필터
      if (soapFilter !== 'all' && t.soap_status !== soapFilter) return false;

      return true;
    });
  }, [transcripts, searchQuery, doctorFilter, actingTypeFilter, soapFilter, patientMap]);

  // 통계 계산
  const stats = useMemo(() => {
    const total = filteredTranscripts.length;
    const totalDuration = filteredTranscripts.reduce((acc, t) => acc + (t.duration_sec || 0), 0);
    const completed = filteredTranscripts.filter((t) => t.soap_status === 'completed').length;
    const failed = filteredTranscripts.filter((t) => t.soap_status === 'failed').length;
    const processing = filteredTranscripts.filter((t) => t.soap_status === 'processing').length;

    return { total, totalDuration, completed, failed, processing };
  }, [filteredTranscripts]);

  // 녹취록 조회
  const fetchTranscripts = async () => {
    setLoading(true);
    try {
      let sql = '';
      if (viewMode === 'day') {
        sql = `
          SELECT * FROM medical_transcripts
          WHERE date(created_at) = '${selectedDate}'
          ORDER BY created_at DESC
        `;
      } else if (viewMode === 'range') {
        sql = `
          SELECT * FROM medical_transcripts
          WHERE date(created_at) >= '${startDate}' AND date(created_at) <= '${endDate}'
          ORDER BY created_at DESC
        `;
      } else {
        sql = `
          SELECT * FROM medical_transcripts
          ORDER BY created_at DESC
          LIMIT 100
        `;
      }

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
    } catch (error) {
      console.error('녹취록 조회 실패:', error);
      setTranscripts([]);
    } finally {
      setLoading(false);
    }
  };

  // 환자 정보 조회 (MSSQL)
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
          map.set(p.chartNo, { chart_no: p.chartNo, patient_name: p.patientName });
        });
        setPatientMap(map);
      }
    } catch (error) {
      console.error('환자 정보 조회 실패:', error);
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
    let content = `녹취록 내보내기\n`;
    content += `================\n\n`;
    content += `환자: ${patient?.patient_name || `#${selectedTranscript.patient_id}`}\n`;
    content += `의료진: ${selectedTranscript.doctor_name}\n`;
    content += `진료유형: ${selectedTranscript.acting_type}\n`;
    content += `녹음시간: ${formatDuration(selectedTranscript.duration_sec)}\n`;
    content += `일시: ${formatDate(selectedTranscript.created_at, 'yyyy-MM-dd HH:mm')}\n\n`;
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
    a.download = `녹취록_${patient?.patient_name || selectedTranscript.patient_id}_${formatDate(selectedTranscript.created_at, 'yyyyMMdd_HHmm')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    fetchTranscripts();
  }, [viewMode, selectedDate, startDate, endDate]);

  // 날짜 변경
  const changeDate = (days: number) => {
    const newDate =
      days > 0
        ? addDays(new Date(selectedDate), days)
        : subDays(new Date(selectedDate), Math.abs(days));
    setSelectedDate(format(newDate, 'yyyy-MM-dd'));
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

  // 시간 포맷
  const formatTime = (dateStr: string) => {
    try {
      if (!dateStr) return '--:--';
      return format(new Date(dateStr), 'HH:mm');
    } catch {
      return '--:--';
    }
  };

  // 날짜 포맷 (안전)
  const formatDate = (dateStr: string, formatStr: string = 'MM/dd') => {
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

  // 필터 초기화
  const resetFilters = () => {
    setSearchQuery('');
    setDoctorFilter('all');
    setActingTypeFilter('all');
    setSoapFilter('all');
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-gray-800">
              <i className="fas fa-microphone-alt text-clinic-primary mr-2"></i>
              녹취록 관리
            </h1>

            {/* 조회 모드 선택 */}
            <div className="flex items-center bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('day')}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  viewMode === 'day'
                    ? 'bg-white text-clinic-primary shadow-sm'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                일별
              </button>
              <button
                onClick={() => setViewMode('range')}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  viewMode === 'range'
                    ? 'bg-white text-clinic-primary shadow-sm'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                기간
              </button>
              <button
                onClick={() => setViewMode('all')}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  viewMode === 'all'
                    ? 'bg-white text-clinic-primary shadow-sm'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                전체
              </button>
            </div>
          </div>

          {/* 날짜 선택 */}
          <div className="flex items-center gap-2">
            {viewMode === 'day' && (
              <>
                <button
                  onClick={() => changeDate(-1)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <i className="fas fa-chevron-left text-gray-600"></i>
                </button>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <button
                  onClick={() => changeDate(1)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <i className="fas fa-chevron-right text-gray-600"></i>
                </button>
                <button
                  onClick={() => setSelectedDate(format(new Date(), 'yyyy-MM-dd'))}
                  className="px-3 py-1.5 text-sm text-clinic-primary hover:bg-clinic-primary/10 rounded-lg transition-colors"
                >
                  오늘
                </button>
              </>
            )}
            {viewMode === 'range' && (
              <>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <span className="text-gray-500">~</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </>
            )}
            {viewMode === 'all' && (
              <span className="text-sm text-gray-500">최근 100건 표시</span>
            )}
          </div>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-5 gap-4 mb-4">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4">
            <div className="text-2xl font-bold text-blue-700">{stats.total}</div>
            <div className="text-sm text-blue-600">총 녹취</div>
          </div>
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4">
            <div className="text-2xl font-bold text-purple-700">{formatDuration(stats.totalDuration)}</div>
            <div className="text-sm text-purple-600">총 녹음시간</div>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4">
            <div className="text-2xl font-bold text-green-700">{stats.completed}</div>
            <div className="text-sm text-green-600">SOAP 완료</div>
          </div>
          <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl p-4">
            <div className="text-2xl font-bold text-yellow-700">{stats.processing}</div>
            <div className="text-sm text-yellow-600">처리중</div>
          </div>
          <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-4">
            <div className="text-2xl font-bold text-red-700">{stats.failed}</div>
            <div className="text-sm text-red-600">실패</div>
          </div>
        </div>

        {/* 검색 및 필터 */}
        <div className="flex items-center gap-3">
          {/* 검색 */}
          <div className="relative flex-1 max-w-md">
            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="환자명, 녹취 내용 검색..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-clinic-primary focus:border-clinic-primary"
            />
          </div>

          {/* 의사 필터 */}
          <select
            value={doctorFilter}
            onChange={(e) => setDoctorFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
          >
            <option value="all">모든 의료진</option>
            {uniqueDoctors.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>

          {/* 진료 유형 필터 */}
          <select
            value={actingTypeFilter}
            onChange={(e) => setActingTypeFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
          >
            <option value="all">모든 유형</option>
            {uniqueActingTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          {/* SOAP 상태 필터 */}
          <select
            value={soapFilter}
            onChange={(e) => setSoapFilter(e.target.value as SoapFilter)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
          >
            <option value="all">모든 상태</option>
            <option value="completed">완료</option>
            <option value="processing">처리중</option>
            <option value="failed">실패</option>
            <option value="pending">대기</option>
          </select>

          {/* 필터 초기화 */}
          {(searchQuery || doctorFilter !== 'all' || actingTypeFilter !== 'all' || soapFilter !== 'all') && (
            <button
              onClick={resetFilters}
              className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <i className="fas fa-times mr-1"></i>
              초기화
            </button>
          )}

          {/* 새로고침 */}
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
                          {patient?.patient_name || `환자 #${t.patient_id}`}
                        </span>
                        {patient?.chart_no && (
                          <span className="ml-2 text-xs text-gray-400">#{patient.chart_no}</span>
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
                        {formatDate(t.created_at)}
                      </span>
                      <span>
                        <i className="fas fa-clock mr-1"></i>
                        {formatTime(t.created_at)}
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
                    <p className="mt-2 text-xs text-gray-400 line-clamp-2">
                      {t.transcript?.substring(0, 100)}...
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 상세 보기 */}
        <div className="flex-1 overflow-y-auto p-6">
          {selectedTranscript ? (
            <div className="max-w-4xl mx-auto space-y-6">
              {/* 상단 액션 바 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-semibold text-gray-800">
                    {patientMap.get(selectedTranscript.patient_id)?.patient_name ||
                      `환자 #${selectedTranscript.patient_id}`}
                  </span>
                  {getSoapStatusBadge(selectedTranscript.soap_status)}
                </div>
                <div className="flex items-center gap-2">
                  {/* 내보내기 */}
                  <button
                    onClick={handleExport}
                    className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <i className="fas fa-download mr-1"></i>
                    내보내기
                  </button>

                  {/* SOAP 재처리 */}
                  {(selectedTranscript.soap_status === 'failed' ||
                    selectedTranscript.soap_status === 'pending') && (
                    <button
                      onClick={handleReprocessSoap}
                      disabled={isReprocessing}
                      className="px-3 py-2 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
                    >
                      <i className={`fas fa-redo mr-1 ${isReprocessing ? 'animate-spin' : ''}`}></i>
                      {isReprocessing ? '처리중...' : 'SOAP 재처리'}
                    </button>
                  )}

                  {/* 삭제 */}
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="px-3 py-2 text-sm text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <i className="fas fa-trash mr-1"></i>
                    삭제
                  </button>
                </div>
              </div>

              {/* 메타 정보 */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">의료진</span>
                    <p className="font-medium text-gray-800">{selectedTranscript.doctor_name}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">진료유형</span>
                    <p className="font-medium text-gray-800">{selectedTranscript.acting_type}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">녹음시간</span>
                    <p className="font-medium text-gray-800">
                      {formatDuration(selectedTranscript.duration_sec)}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500">일시</span>
                    <p className="font-medium text-gray-800">
                      {formatDate(selectedTranscript.created_at, 'yyyy-MM-dd HH:mm')}
                    </p>
                  </div>
                </div>
              </div>

              {/* 녹취록 */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <h2 className="font-semibold text-gray-800">
                      <i className="fas fa-file-audio text-clinic-primary mr-2"></i>
                      녹취록
                    </h2>
                    {/* 화자분리 토글 */}
                    {selectedTranscript.diarized_transcript && (
                      <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
                        <button
                          onClick={() => setShowDiarized(false)}
                          className={`px-2 py-1 text-xs rounded-md transition-colors ${
                            !showDiarized
                              ? 'bg-white text-gray-800 shadow-sm'
                              : 'text-gray-500 hover:text-gray-700'
                          }`}
                        >
                          원본
                        </button>
                        <button
                          onClick={() => setShowDiarized(true)}
                          className={`px-2 py-1 text-xs rounded-md transition-colors ${
                            showDiarized
                              ? 'bg-white text-gray-800 shadow-sm'
                              : 'text-gray-500 hover:text-gray-700'
                          }`}
                        >
                          화자분리
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {/* 화자분리 버튼 */}
                    {!selectedTranscript.diarized_transcript && (
                      <button
                        onClick={handleDiarize}
                        disabled={isDiarizing}
                        className="text-sm text-blue-500 hover:text-blue-700 disabled:opacity-50"
                      >
                        <i className={`fas fa-users mr-1 ${isDiarizing ? 'animate-pulse' : ''}`}></i>
                        {isDiarizing ? '분리중...' : '화자분리'}
                      </button>
                    )}
                    <button
                      onClick={() => {
                        const content = showDiarized && selectedTranscript.diarized_transcript
                          ? selectedTranscript.diarized_transcript
                          : selectedTranscript.transcript;
                        navigator.clipboard.writeText(content || '');
                        alert('녹취 내용이 클립보드에 복사되었습니다.');
                      }}
                      className="text-sm text-gray-500 hover:text-gray-700"
                    >
                      <i className="fas fa-copy mr-1"></i>
                      복사
                    </button>
                  </div>
                </div>
                <div className="p-6">
                  {/* 화자분리 표시 또는 원본 표시 */}
                  {showDiarized && selectedTranscript.diarized_transcript ? (
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
                    <p className="text-gray-700 whitespace-pre-wrap leading-relaxed text-sm">
                      {selectedTranscript.transcript || '녹취 내용이 없습니다.'}
                    </p>
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
              </div>

              {/* SOAP */}
              {selectedTranscript.soap_status === 'completed' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                    <h2 className="font-semibold text-gray-800">
                      <i className="fas fa-notes-medical text-green-600 mr-2"></i>
                      SOAP 기록
                    </h2>
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
                    {/* Subjective */}
                    <div className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="w-7 h-7 flex items-center justify-center bg-blue-100 text-blue-700 rounded-lg font-bold text-sm">
                          S
                        </span>
                        <span className="font-medium text-gray-700">Subjective (주관적 증상)</span>
                      </div>
                      <p className="text-gray-600 pl-9 whitespace-pre-wrap text-sm">
                        {selectedTranscript.soap_subjective || '-'}
                      </p>
                    </div>
                    {/* Objective */}
                    <div className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="w-7 h-7 flex items-center justify-center bg-green-100 text-green-700 rounded-lg font-bold text-sm">
                          O
                        </span>
                        <span className="font-medium text-gray-700">Objective (객관적 소견)</span>
                      </div>
                      <p className="text-gray-600 pl-9 whitespace-pre-wrap text-sm">
                        {selectedTranscript.soap_objective || '-'}
                      </p>
                    </div>
                    {/* Assessment */}
                    <div className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="w-7 h-7 flex items-center justify-center bg-yellow-100 text-yellow-700 rounded-lg font-bold text-sm">
                          A
                        </span>
                        <span className="font-medium text-gray-700">Assessment (평가)</span>
                      </div>
                      <p className="text-gray-600 pl-9 whitespace-pre-wrap text-sm">
                        {selectedTranscript.soap_assessment || '-'}
                      </p>
                    </div>
                    {/* Plan */}
                    <div className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="w-7 h-7 flex items-center justify-center bg-purple-100 text-purple-700 rounded-lg font-bold text-sm">
                          P
                        </span>
                        <span className="font-medium text-gray-700">Plan (계획)</span>
                      </div>
                      <p className="text-gray-600 pl-9 whitespace-pre-wrap text-sm">
                        {selectedTranscript.soap_plan || '-'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

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

              {/* SOAP 처리중/실패 상태 (processing_status가 없는 경우 기존 로직) */}
              {(!selectedTranscript.processing_status || selectedTranscript.processing_status === 'completed') && selectedTranscript.soap_status === 'processing' && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 text-center">
                  <i className="fas fa-spinner fa-spin text-blue-500 text-2xl mb-2"></i>
                  <p className="text-blue-700">SOAP 변환 중입니다...</p>
                </div>
              )}
              {(!selectedTranscript.processing_status || selectedTranscript.processing_status === 'completed') && selectedTranscript.soap_status === 'failed' && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
                  <i className="fas fa-exclamation-circle text-red-500 text-2xl mb-2"></i>
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
              )}
              {(!selectedTranscript.processing_status || selectedTranscript.processing_status === 'completed') && selectedTranscript.soap_status === 'pending' && (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center">
                  <i className="fas fa-clock text-gray-400 text-2xl mb-2"></i>
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
