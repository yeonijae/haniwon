import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { Patient, ExamDateGroup, ExamResult, ExamType } from '../types';
import { EXAM_TYPES, getExamTypeInfo, getExamTypeStyles } from '../types';
import {
  getExamResultsGroupedByDate,
  createExamResult,
  addExamAttachment,
  getExamTabOrder,
  saveExamTabOrder,
  getExamTabLabels,
  saveExamTabLabels,
} from '../services/examService';
import { getThumbnailUrl, uploadExamFile, formatFileSize } from '../lib/fileUpload';
import ExamResultForm from '../components/ExamResultForm';
import ExamResultDetail from '../components/ExamResultDetail';
import ExamCompareViewer from '../components/ExamCompareViewer';
import ExamTrendChart from '../components/ExamTrendChart';
import ExamResultBook from '../components/ExamResultBook';

interface ExamManagementProps {
  selectedPatientId: number | null;
  selectedPatientName: string;
  settingsOpenSignal?: number;
}

interface QuickUploadFile {
  file: File;
  preview: string;
  capturedAtMs: number;
}

const ExamManagement: React.FC<ExamManagementProps> = ({ selectedPatientId, selectedPatientName, settingsOpenSignal = 0 }) => {
  // 환자 관련 상태
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  // 검사결과 관련 상태
  const [examGroups, setExamGroups] = useState<ExamDateGroup[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeExamTab, setActiveExamTab] = useState<string>('all');

  // 모달 상태
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedExam, setSelectedExam] = useState<ExamResult | null>(null);
  const [showCompareViewer, setShowCompareViewer] = useState(false);
  const [compareExamType, setCompareExamType] = useState<ExamType | null>(null);
  const [showTrendViewer, setShowTrendViewer] = useState(false);
  const [trendExamType, setTrendExamType] = useState<ExamType | null>(null);
  const [showBookGenerator, setShowBookGenerator] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [examTabOrder, setExamTabOrder] = useState<string[]>(EXAM_TYPES.map((t) => t.code));
  const [examTabLabels, setExamTabLabels] = useState<Record<string, string>>({});
  const [draggingTab, setDraggingTab] = useState<string | null>(null);
  const [newExamName, setNewExamName] = useState('');
  const [editingCode, setEditingCode] = useState<string | null>(null);

  // 빠른 등록 상태
  const [quickFiles, setQuickFiles] = useState<QuickUploadFile[]>([]);
  const [quickDragOver, setQuickDragOver] = useState(false);
  const [quickViewMode, setQuickViewMode] = useState<'list' | 'card'>('card');
  const [isQuickSaving, setIsQuickSaving] = useState(false);
  const quickFileInputRef = useRef<HTMLInputElement>(null);
  const quickFolderInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const saved = await getExamTabOrder();
        if (saved.length > 0) {
          setExamTabOrder(saved);
        }

        const labels = await getExamTabLabels();
        setExamTabLabels(labels || {});
      } catch (e) {
        console.error('검사 설정 로드 실패:', e);
      }
    };
    loadSettings();
  }, []);

  useEffect(() => {
    if (settingsOpenSignal > 0) {
      setShowSettings(true);
    }
  }, [settingsOpenSignal]);

  // 선택된 환자 변경 시 검사결과 로드
  useEffect(() => {
    if (selectedPatientId) {
      const patient: Patient = {
        id: selectedPatientId,
        name: selectedPatientName,
      };
      setSelectedPatient(patient);
      loadExamResults(selectedPatientId);
    }
  }, [selectedPatientId, selectedPatientName]);

  useEffect(() => {
    quickFiles.forEach((qf) => qf.preview && URL.revokeObjectURL(qf.preview));
    setQuickFiles([]);
    setQuickViewMode('card');
  }, [activeExamTab]);

  // 검사결과 로드
  const loadExamResults = async (patientId: number) => {
    setIsLoading(true);
    try {
      const groups = await getExamResultsGroupedByDate(patientId);
      setExamGroups(groups);
    } catch (error) {
      console.error('검사결과 로드 실패:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 검사결과 새로고침
  const refreshExamResults = () => {
    if (selectedPatient) {
      loadExamResults(selectedPatient.id);
    }
  };

  // 필터링된 검사결과
  const filteredGroups = examGroups.map(group => ({
    ...group,
    exams: activeExamTab === 'all'
      ? group.exams
      : group.exams.filter(e => e.exam_type === activeExamTab)
  })).filter(group => group.exams.length > 0);

  // 특정 유형의 모든 검사 (비교용)
  const getExamsForCompare = useCallback((examType: ExamType): ExamResult[] => {
    const allExams: ExamResult[] = [];
    for (const group of examGroups) {
      for (const exam of group.exams) {
        if (exam.exam_type === examType) {
          allExams.push(exam);
        }
      }
    }
    return allExams.sort((a, b) => b.exam_date.localeCompare(a.exam_date));
  }, [examGroups]);

  // 비교 가능한 검사 유형 (2개 이상인 경우)
  const comparableTypes = useMemo(() => {
    const typeCounts: Record<string, number> = {};
    for (const group of examGroups) {
      for (const exam of group.exams) {
        typeCounts[exam.exam_type] = (typeCounts[exam.exam_type] || 0) + 1;
      }
    }
    return Object.entries(typeCounts)
      .filter(([, count]) => count >= 2)
      .map(([type]) => type as ExamType);
  }, [examGroups]);

  // 추이 분석 가능한 검사 유형 (수치 데이터 포함, 2개 이상)
  const trendableTypes = useMemo(() => {
    const typeHasValues: Record<string, number> = {};
    for (const group of examGroups) {
      for (const exam of group.exams) {
        const info = getExamTypeInfo(exam.exam_type);
        if (info?.hasValues && exam.values && exam.values.length > 0) {
          typeHasValues[exam.exam_type] = (typeHasValues[exam.exam_type] || 0) + 1;
        }
      }
    }
    return Object.entries(typeHasValues)
      .filter(([, count]) => count >= 2)
      .map(([type]) => type as ExamType);
  }, [examGroups]);

  // 모든 검사 (추이 분석용)
  const allExams = useMemo(() => {
    const exams: ExamResult[] = [];
    for (const group of examGroups) {
      exams.push(...group.exams);
    }
    return exams;
  }, [examGroups]);

  const examTypeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const exam of allExams) {
      counts[exam.exam_type] = (counts[exam.exam_type] || 0) + 1;
    }
    return counts;
  }, [allExams]);

  const orderedExamTypes = useMemo(() => {
    const fromOrder = examTabOrder.map((code) => ({ code }));
    const unknownFromData = Object.keys(examTypeCounts)
      .filter((code) => !examTabOrder.includes(code))
      .map((code) => ({ code }));
    return [...fromOrder, ...unknownFromData];
  }, [examTabOrder, examTypeCounts]);

  // 검사 기간 계산
  const examDateRange = useMemo(() => {
    if (examGroups.length === 0) return { start: '', end: '' };
    const dates = examGroups.map(g => g.date).sort();
    return {
      start: dates[0],
      end: dates[dates.length - 1],
    };
  }, [examGroups]);

  // 비교 시작
  const handleStartCompare = (examType: ExamType) => {
    setCompareExamType(examType);
    setShowCompareViewer(true);
  };

  // 추이 분석 시작
  const handleStartTrend = (examType: ExamType) => {
    setTrendExamType(examType);
    setShowTrendViewer(true);
  };

  // 나이 계산
  const calculateAge = (birthDate?: string) => {
    if (!birthDate) return '';
    const birth = new Date(birthDate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const getExamLabel = (code: string) => {
    const custom = (examTabLabels[code] || '').trim();
    if (custom) return custom;
    return getExamTypeInfo(code as ExamType)?.name || code;
  };

  const activeExamType = activeExamTab !== 'all' ? activeExamTab : null;

  const extractExifDateMs = async (file: File): Promise<number | null> => {
    if (!file.type.startsWith('image/jpeg')) return null;
    try {
      const buffer = await file.arrayBuffer();
      const view = new DataView(buffer);
      let offset = 2;
      while (offset + 4 < view.byteLength) {
        if (view.getUint8(offset) !== 0xFF) break;
        const marker = view.getUint8(offset + 1);
        const size = view.getUint16(offset + 2, false);
        if (marker === 0xE1) {
          const exifStart = offset + 4;
          if (view.getUint32(exifStart, false) !== 0x45786966) return null; // Exif
          const tiffStart = exifStart + 6;
          const little = view.getUint16(tiffStart, false) === 0x4949;
          const get16 = (o: number) => view.getUint16(o, little);
          const get32 = (o: number) => view.getUint32(o, little);
          const ifd0 = tiffStart + get32(tiffStart + 4);
          const count = get16(ifd0);
          let exifIfdOffset = 0;
          for (let i = 0; i < count; i++) {
            const entry = ifd0 + 2 + i * 12;
            if (get16(entry) === 0x8769) {
              exifIfdOffset = get32(entry + 8);
              break;
            }
          }
          if (!exifIfdOffset) return null;
          const exifIfd = tiffStart + exifIfdOffset;
          const exifCount = get16(exifIfd);
          for (let i = 0; i < exifCount; i++) {
            const entry = exifIfd + 2 + i * 12;
            if (get16(entry) === 0x9003) {
              const len = get32(entry + 4);
              const valOffset = tiffStart + get32(entry + 8);
              let s = '';
              for (let j = 0; j < len - 1; j++) s += String.fromCharCode(view.getUint8(valOffset + j));
              const m = s.match(/(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
              if (!m) return null;
              const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6]));
              return dt.getTime();
            }
          }
          return null;
        }
        offset += 2 + size;
      }
      return null;
    } catch {
      return null;
    }
  };

  const addQuickFiles = async (fileList: FileList) => {
    const allowed = ['image/', 'application/pdf'];
    const candidates = Array.from(fileList).filter((file) => allowed.some((type) => file.type.startsWith(type)));

    if (candidates.length === 0) {
      alert('이미지(JPG/PNG) 또는 PDF 파일만 등록할 수 있습니다.');
      return;
    }

    const incoming: QuickUploadFile[] = [];
    for (const file of candidates) {
      const capturedAtMs = (await extractExifDateMs(file)) || file.lastModified;
      incoming.push({
        file,
        preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : '',
        capturedAtMs,
      });
    }

    setQuickFiles((prev) => [...prev, ...incoming]);
  };

  const removeQuickFile = (index: number) => {
    setQuickFiles((prev) => {
      const next = [...prev];
      if (next[index]?.preview) URL.revokeObjectURL(next[index].preview);
      next.splice(index, 1);
      return next;
    });
  };

  const toExamDate = (ms: number) => {
    const d = new Date(ms);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const toTimeLabel = (ms: number) => {
    const d = new Date(ms);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const handleQuickDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setQuickDragOver(false);
    if (e.dataTransfer.files.length > 0) void addQuickFiles(e.dataTransfer.files);
  };

  const handleQuickRegister = async () => {
    if (!selectedPatient || !activeExamType) return;
    if (quickFiles.length === 0) {
      alert('등록할 파일을 먼저 추가해주세요.');
      return;
    }

    setIsQuickSaving(true);
    try {
      const grouped = new Map<string, QuickUploadFile[]>();
      for (const qf of quickFiles) {
        const key = `${toExamDate(qf.capturedAtMs)} ${toTimeLabel(qf.capturedAtMs)}`;
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)!.push(qf);
      }

      for (const [key, files] of grouped.entries()) {
        const [examDate, timeLabel] = key.split(' ');
        const examId = await createExamResult({
          patient_id: selectedPatient.id,
          exam_date: examDate,
          exam_type: activeExamType as ExamType,
          memo: `빠른등록 (${timeLabel})`,
        });

        for (let i = 0; i < files.length; i++) {
          const uploaded = await uploadExamFile(files[i].file, selectedPatient.id, activeExamType as ExamType);
          await addExamAttachment(examId, {
            file_name: uploaded.original_name,
            file_path: uploaded.file_path,
            file_size: uploaded.file_size,
            mime_type: uploaded.mime_type,
            thumbnail_path: uploaded.thumbnail_path,
            sort_order: i,
          });
        }
      }

      quickFiles.forEach((qf) => qf.preview && URL.revokeObjectURL(qf.preview));
      setQuickFiles([]);
      await refreshExamResults();
    } catch (error) {
      console.error('빠른등록 실패:', error);
      alert('빠른등록 중 오류가 발생했습니다.');
    } finally {
      setIsQuickSaving(false);
    }
  };

  const handleDropExamTab = (targetCode: string) => {
    if (!draggingTab || draggingTab === targetCode) return;
    const next = [...examTabOrder];
    const from = next.indexOf(draggingTab);
    const to = next.indexOf(targetCode);
    if (from < 0 || to < 0) return;
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setExamTabOrder(next);
    setDraggingTab(null);
  };

  const handleAddExamItem = () => {
    const name = newExamName.trim();
    if (!name) return;

    const base = name
      .toLowerCase()
      .replace(/[^a-z0-9가-힣]+/g, '_')
      .replace(/^_+|_+$/g, '') || `custom_${Date.now()}`;

    let code = base;
    let seq = 2;
    while (examTabOrder.includes(code)) {
      code = `${base}_${seq++}`;
    }

    setExamTabOrder((prev) => [...prev, code]);
    setExamTabLabels((prev) => ({ ...prev, [code]: name }));
    setNewExamName('');
  };

  const handleDeleteExamItem = (code: string) => {
    setExamTabOrder((prev) => prev.filter((c) => c !== code));
    setExamTabLabels((prev) => {
      const next = { ...prev };
      delete next[code];
      return next;
    });
    if (activeExamTab === code) setActiveExamTab('all');
  };

  const handleSaveSettings = async () => {
    try {
      await saveExamTabOrder(examTabOrder);
      const cleanedLabels = Object.fromEntries(
        Object.entries(examTabLabels)
          .map(([k, v]) => [k, (v || '').trim()])
          .filter(([, v]) => !!v)
      );
      await saveExamTabLabels(cleanedLabels);
      setExamTabLabels(cleanedLabels);
      setShowSettings(false);
    } catch (e) {
      console.error('설정 저장 실패:', e);
      alert('설정 저장에 실패했습니다.');
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {selectedPatient ? (
        <>
          {/* 헤더 */}
          <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  {selectedPatient.name}
                  {selectedPatient.gender && (
                    <span className="text-gray-500 font-normal ml-2">
                      ({selectedPatient.gender === 'M' ? '남' : '여'}/{calculateAge(selectedPatient.birth_date)})
                    </span>
                  )}
                </h2>
                {selectedPatient.chart_number && (
                  <p className="text-sm text-gray-500">{selectedPatient.chart_number}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-sm text-gray-500 mr-1">
                {activeExamTab === 'all' ? '전체 검사 보기' : getExamLabel(activeExamTab)}
              </div>

              {/* 추이 분석 버튼 */}
              {trendableTypes.length > 0 && (
                <div className="relative group">
                  <button
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 flex items-center gap-2"
                  >
                    <i className="fas fa-chart-line"></i>
                    추이
                    <i className="fas fa-chevron-down text-xs"></i>
                  </button>
                  <div className="absolute right-0 mt-1 w-40 bg-white border border-gray-200 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                    {trendableTypes.map((type) => {
                      const info = getExamTypeInfo(type);
                      return (
                        <button
                          key={type}
                          onClick={() => handleStartTrend(type)}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-blue-50 flex items-center gap-2"
                        >
                          <i className={`fas ${info?.icon || 'fa-file'} text-gray-400`}></i>
                          {getExamLabel(type)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 비교 버튼 */}
              {comparableTypes.length > 0 && (
                <div className="relative group">
                  <button
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 flex items-center gap-2"
                  >
                    <i className="fas fa-columns"></i>
                    비교
                    <i className="fas fa-chevron-down text-xs"></i>
                  </button>
                  <div className="absolute right-0 mt-1 w-40 bg-white border border-gray-200 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                    {comparableTypes.map((type) => {
                      const info = getExamTypeInfo(type);
                      return (
                        <button
                          key={type}
                          onClick={() => handleStartCompare(type)}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-blue-50 flex items-center gap-2"
                        >
                          <i className={`fas ${info?.icon || 'fa-file'} text-gray-400`}></i>
                          {getExamLabel(type)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 검사결과책 버튼 */}
              {allExams.length > 0 && (
                <button
                  onClick={() => setShowBookGenerator(true)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 flex items-center gap-2"
                >
                  <i className="fas fa-file-pdf text-red-500"></i>
                  검사결과책
                </button>
              )}


              {/* 검사 등록 버튼 */}
              <button
                onClick={() => setShowAddForm(true)}
                className="px-4 py-2 bg-slate-700 text-white rounded-lg text-sm font-medium hover:bg-slate-800 flex items-center gap-2"
              >
                <i className="fas fa-plus"></i>
                검사 등록
              </button>
            </div>
          </div>

          {/* 검사결과 차트 */}
          <div className="flex-1 min-h-0 flex overflow-hidden">
            <aside className="w-64 border-r border-gray-200 bg-gray-50 p-3 overflow-y-auto">
              <button
                onClick={() => setActiveExamTab('all')}
                className={`w-full text-left px-3 py-2 rounded-lg mb-2 text-base flex items-center justify-between ${activeExamTab === 'all' ? 'bg-blue-100 text-blue-700 font-semibold' : 'hover:bg-gray-100 text-gray-700'}`}
              >
                <span>전체</span>
                <span className="text-sm">{allExams.length}</span>
              </button>
              {orderedExamTypes.map((type) => {
                const count = examTypeCounts[type.code] || 0;
                const isActive = activeExamTab === type.code;
                return (
                  <button
                    key={type.code}
                    onClick={() => setActiveExamTab(type.code)}
                    className={`w-full text-left px-3 py-2 rounded-lg mb-2 text-base flex items-center justify-between ${isActive ? 'bg-blue-100 text-blue-700 font-semibold' : 'hover:bg-gray-100 text-gray-700'}`}
                  >
                    <span className="truncate pr-2">{getExamLabel(type.code)}</span>
                    <span className="text-sm">{count}</span>
                  </button>
                );
              })}
            </aside>

            <section className="flex-1 overflow-y-auto p-6 space-y-4">
              {activeExamType && (
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="text-base font-semibold text-gray-800">빠른등록 - {getExamLabel(activeExamType)}</h3>
                      <p className="text-sm text-gray-500">촬영일(EXIF) 우선, 없으면 파일 날짜/시간으로 자동 등록됩니다.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setQuickViewMode('list')}
                        className={`px-2 py-1 rounded border text-sm ${quickViewMode === 'list' ? 'bg-gray-100 border-gray-300' : 'border-gray-200 text-gray-500'}`}
                      >목록</button>
                      <button
                        onClick={() => setQuickViewMode('card')}
                        className={`px-2 py-1 rounded border text-sm ${quickViewMode === 'card' ? 'bg-gray-100 border-gray-300' : 'border-gray-200 text-gray-500'}`}
                      >카드</button>
                    </div>
                  </div>

                  <div
                    className={`border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition ${quickDragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400'}`}
                    onDragOver={(e) => { e.preventDefault(); setQuickDragOver(true); }}
                    onDragLeave={() => setQuickDragOver(false)}
                    onDrop={handleQuickDrop}
                    onClick={() => quickFileInputRef.current?.click()}
                  >
                    <input
                      ref={quickFileInputRef}
                      type="file"
                      multiple
                      accept="image/*,.pdf"
                      className="hidden"
                      onChange={(e) => e.target.files && void addQuickFiles(e.target.files)}
                    />
                    <input
                      ref={quickFolderInputRef}
                      type="file"
                      multiple
                      className="hidden"
                      {...({ webkitdirectory: '', directory: '' } as any)}
                      onChange={(e) => e.target.files && void addQuickFiles(e.target.files)}
                    />
                    <i className="fas fa-cloud-upload-alt text-2xl text-gray-400 mb-2"></i>
                    <p className="text-base text-gray-700">파일을 드래그&드롭하거나 클릭해서 추가</p>
                    <p className="text-sm text-gray-500">JPG/PNG/PDF · 여러 파일 가능</p>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); quickFolderInputRef.current?.click(); }}
                      className="mt-2 px-3 py-1.5 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50"
                    >
                      폴더 통째로 선택(하위폴더 포함)
                    </button>
                  </div>

                  {quickFiles.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {quickViewMode === 'list' ? (
                        quickFiles.map((qf, idx) => (
                          <div key={`${qf.file.name}-${idx}`} className="flex items-center gap-3 border border-gray-100 rounded-lg p-2">
                            {qf.preview ? (
                              <img src={qf.preview} alt="" className="w-10 h-10 rounded object-cover" />
                            ) : (
                              <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center">
                                <i className="fas fa-file-pdf text-red-500"></i>
                              </div>
                            )}
                            <div className="flex-1 min-w-0 text-sm">
                              <p className="truncate font-medium text-gray-700">{qf.file.name}</p>
                              <p className="text-gray-500">{toExamDate(qf.capturedAtMs)} {toTimeLabel(qf.capturedAtMs)} · {formatFileSize(qf.file.size)}</p>
                            </div>
                            <button onClick={() => removeQuickFile(idx)} className="text-gray-400 hover:text-red-500">
                              <i className="fas fa-times"></i>
                            </button>
                          </div>
                        ))
                      ) : (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {quickFiles.map((qf, idx) => (
                            <div key={`${qf.file.name}-${idx}`} className="border border-gray-100 rounded-lg p-2">
                              <div className="aspect-square rounded bg-gray-100 mb-2 overflow-hidden">
                                {qf.preview ? (
                                  <img src={qf.preview} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center"><i className="fas fa-file-pdf text-red-500 text-2xl"></i></div>
                                )}
                              </div>
                              <p className="text-sm font-medium text-gray-700 truncate">{qf.file.name}</p>
                              <p className="text-xs text-gray-500">{toExamDate(qf.capturedAtMs)} {toTimeLabel(qf.capturedAtMs)}</p>
                              <button onClick={() => removeQuickFile(idx)} className="mt-1 text-xs text-gray-500 hover:text-red-500">제거</button>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex justify-end">
                        <button
                          onClick={handleQuickRegister}
                          disabled={isQuickSaving || quickFiles.length === 0}
                          className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50 text-sm"
                        >
                          {isQuickSaving ? '등록 중...' : `${quickFiles.length}개 파일 빠른등록`}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {isLoading ? (
                <div className="flex items-center justify-center h-40">
                  <i className="fas fa-spinner fa-spin text-2xl text-blue-600"></i>
                </div>
              ) : filteredGroups.length === 0 ? (
                <div className="text-center py-20">
                  <i className="fas fa-folder-open text-6xl text-gray-300 mb-4"></i>
                  <p className="text-gray-500">선택한 검사 유형의 결과가 없습니다</p>
                  <button
                    onClick={() => setShowAddForm(true)}
                    className="mt-4 text-blue-600 hover:underline"
                  >
                    검사 등록하기
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  {filteredGroups.map((group) => (
                    <div key={group.date} className="bg-white rounded-lg shadow-sm border border-gray-200">
                      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 rounded-t-lg">
                        <h3 className="font-medium text-gray-700">
                          <i className="fas fa-calendar-day mr-2 text-gray-400"></i>
                          {group.date}
                        </h3>
                      </div>

                      <div className="p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                        {group.exams.map((exam) => {
                          const typeInfo = getExamTypeInfo(exam.exam_type);
                          const typeStyles = getExamTypeStyles(exam.exam_type);
                          const thumbnail = exam.attachments?.[0]?.thumbnail_path;

                          return (
                            <button
                              key={exam.id}
                              onClick={() => setSelectedExam(exam)}
                              className="group bg-gray-50 rounded-lg p-3 hover:bg-blue-50 hover:ring-2 hover:ring-blue-200 transition-all text-left"
                            >
                              <div className="aspect-square bg-gray-200 rounded-lg mb-2 overflow-hidden">
                                {thumbnail ? (
                                  <img
                                    src={getThumbnailUrl(thumbnail)}
                                    alt={getExamLabel(exam.exam_type)}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <i className={`fas ${typeInfo?.icon || 'fa-file'} text-3xl text-gray-400`}></i>
                                  </div>
                                )}
                              </div>

                              <div className="flex items-center gap-2">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-sm font-medium ${typeStyles.badge}`}>
                                  {getExamLabel(exam.exam_type)}
                                </span>
                                {(exam.attachments?.length || 0) > 1 && (
                                  <span className="text-sm text-gray-500">
                                    +{(exam.attachments?.length || 1) - 1}
                                  </span>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </>
      ) : (
        /* 환자 미선택 상태 */
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <i className="fas fa-search text-6xl text-gray-300 mb-4"></i>
            <p className="text-gray-500 text-lg">상단 검색창에서 환자를 검색하세요</p>
            <p className="text-gray-400 text-sm mt-2">이름, 차트번호, 연락처로 검색할 수 있습니다</p>
          </div>
        </div>
      )}

      {/* 설정 모달 */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800">검사결과 설정</h3>
              <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-gray-600">
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="p-4 overflow-y-auto space-y-2">
              <p className="text-sm text-gray-500 mb-2">검사항목을 추가/수정/삭제하고 드래그로 순서를 변경할 수 있습니다.</p>

              <div className="flex items-center gap-2 mb-3">
                <input
                  value={newExamName}
                  onChange={(e) => setNewExamName(e.target.value)}
                  placeholder="새 검사항목 이름"
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
                <button onClick={handleAddExamItem} className="px-3 py-2 bg-slate-700 text-white rounded-lg text-sm">추가</button>
              </div>

              {examTabOrder.map((code) => {
                const info = getExamTypeInfo(code as ExamType);
                const isDragging = draggingTab === code;
                return (
                  <div
                    key={code}
                    draggable
                    onDragStart={() => setDraggingTab(code)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => handleDropExamTab(code)}
                    onDragEnd={() => setDraggingTab(null)}
                    className={`group flex items-center justify-between border rounded-lg px-3 py-2 cursor-move ${isDragging ? 'border-blue-300 bg-blue-50 opacity-70' : 'border-gray-200 bg-white'}`}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <i className="fas fa-grip-vertical text-gray-400"></i>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-400 mb-1">기본: {info?.name || code}</p>
                        {editingCode === code ? (
                          <input
                            autoFocus
                            value={examTabLabels[code] ?? ''}
                            onChange={(e) => setExamTabLabels((prev) => ({ ...prev, [code]: e.target.value }))}
                            onClick={(e) => e.stopPropagation()}
                            onBlur={() => setEditingCode(null)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === 'Escape') setEditingCode(null);
                            }}
                            placeholder="표시 이름 수정"
                            className="w-full px-2 py-1 border border-gray-200 rounded text-sm"
                          />
                        ) : (
                          <p className="text-sm text-gray-700 truncate">{getExamLabel(code)}</p>
                        )}
                      </div>
                    </div>
                    <div className="ml-2 flex items-center gap-2">
                      <span className="text-xs text-gray-400">드래그</span>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditingCode(code); }}
                          className="w-7 h-7 rounded border border-gray-200 text-gray-600 hover:bg-gray-50"
                          title="이름 수정"
                        >
                          <i className="fas fa-pen text-xs"></i>
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteExamItem(code); }}
                          className="w-7 h-7 rounded border border-red-200 text-red-500 hover:bg-red-50"
                          title="항목 삭제"
                        >
                          <i className="fas fa-trash text-xs"></i>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="px-5 py-3 border-t border-gray-200 flex justify-end gap-2">
              <button onClick={() => setShowSettings(false)} className="px-3 py-2 bg-gray-100 rounded-lg text-sm">취소</button>
              <button onClick={handleSaveSettings} className="px-3 py-2 bg-slate-700 text-white rounded-lg text-sm">저장</button>
            </div>
          </div>
        </div>
      )}

      {/* 검사 등록 모달 */}
      {showAddForm && selectedPatient && (
        <ExamResultForm
          patient={selectedPatient}
          onClose={() => setShowAddForm(false)}
          onSave={() => {
            setShowAddForm(false);
            refreshExamResults();
          }}
        />
      )}

      {/* 검사 상세 모달 */}
      {selectedExam && (
        <ExamResultDetail
          exam={selectedExam}
          onClose={() => setSelectedExam(null)}
          onUpdate={refreshExamResults}
        />
      )}

      {/* 검사 비교 모달 */}
      {showCompareViewer && compareExamType && (
        <ExamCompareViewer
          exams={getExamsForCompare(compareExamType)}
          onClose={() => {
            setShowCompareViewer(false);
            setCompareExamType(null);
          }}
        />
      )}

      {/* 추이 분석 모달 */}
      {showTrendViewer && trendExamType && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">
                <i className="fas fa-chart-line text-blue-600 mr-2"></i>
                수치 추이 분석
              </h2>
              <button
                onClick={() => {
                  setShowTrendViewer(false);
                  setTrendExamType(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <i className="fas fa-times text-xl"></i>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <ExamTrendChart
                exams={allExams}
                examType={trendExamType}
              />
            </div>
          </div>
        </div>
      )}

      {/* 검사결과책 생성 모달 */}
      {showBookGenerator && selectedPatient && (
        <ExamResultBook
          patient={selectedPatient}
          exams={allExams}
          dateRange={examDateRange}
          onClose={() => setShowBookGenerator(false)}
        />
      )}
    </div>
  );
};

export default ExamManagement;
