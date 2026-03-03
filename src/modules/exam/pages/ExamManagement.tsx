import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { Patient, ExamDateGroup, ExamResult, ExamType } from '../types';
import { EXAM_TYPES, getExamTypeInfo, getExamTypeStyles } from '../types';
import {
  getExamResultsGroupedByDate,
  createExamResult,
  addExamAttachment,
  getExamTabOrder,
  saveExamTabOrder,
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
  const [examTabOrder, setExamTabOrder] = useState<ExamType[]>(EXAM_TYPES.map((t) => t.code));

  // 빠른 등록 상태
  const [quickFiles, setQuickFiles] = useState<QuickUploadFile[]>([]);
  const [quickDragOver, setQuickDragOver] = useState(false);
  const [quickViewMode, setQuickViewMode] = useState<'list' | 'card'>('card');
  const [isQuickSaving, setIsQuickSaving] = useState(false);
  const quickFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadTabOrder = async () => {
      try {
        const saved = await getExamTabOrder();
        if (saved.length > 0) {
          const valid = saved.filter((code): code is ExamType => EXAM_TYPES.some((t) => t.code === code as ExamType));
          const missing = EXAM_TYPES.map((t) => t.code).filter((code) => !valid.includes(code));
          setExamTabOrder([...(valid as ExamType[]), ...missing]);
        }
      } catch (e) {
        console.error('검사 탭 순서 로드 실패:', e);
      }
    };
    loadTabOrder();
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
    const map = new Map(EXAM_TYPES.map((type) => [type.code, type]));
    const ordered = examTabOrder.map((code) => map.get(code)).filter(Boolean) as typeof EXAM_TYPES;
    const rest = EXAM_TYPES.filter((type) => !examTabOrder.includes(type.code));
    return [...ordered, ...rest];
  }, [examTabOrder]);

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

  const activeExamType = activeExamTab !== 'all' ? activeExamTab as ExamType : null;

  const addQuickFiles = (fileList: FileList) => {
    const allowed = ['image/', 'application/pdf'];
    const incoming = Array.from(fileList)
      .filter((file) => allowed.some((type) => file.type.startsWith(type)))
      .map((file) => ({
        file,
        preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : '',
      }));

    if (incoming.length === 0) {
      alert('이미지(JPG/PNG) 또는 PDF 파일만 등록할 수 있습니다.');
      return;
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
    if (e.dataTransfer.files.length > 0) addQuickFiles(e.dataTransfer.files);
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
        const key = `${toExamDate(qf.file.lastModified)} ${toTimeLabel(qf.file.lastModified)}`;
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)!.push(qf);
      }

      for (const [key, files] of grouped.entries()) {
        const [examDate, timeLabel] = key.split(' ');
        const examId = await createExamResult({
          patient_id: selectedPatient.id,
          exam_date: examDate,
          exam_type: activeExamType,
          memo: `빠른등록 (${timeLabel})`,
        });

        for (let i = 0; i < files.length; i++) {
          const uploaded = await uploadExamFile(files[i].file, selectedPatient.id, activeExamType);
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

  const moveExamTab = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= examTabOrder.length) return;
    const next = [...examTabOrder];
    [next[index], next[target]] = [next[target], next[index]];
    setExamTabOrder(next);
  };

  const handleSaveSettings = async () => {
    try {
      await saveExamTabOrder(examTabOrder);
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
                {activeExamTab === 'all' ? '전체 검사 보기' : (getExamTypeInfo(activeExamTab as ExamType)?.name || activeExamTab)}
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
                          {info?.name || type}
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
                          {info?.name || type}
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
                    <span className="truncate pr-2">{type.name}</span>
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
                      <h3 className="text-base font-semibold text-gray-800">빠른등록 - {getExamTypeInfo(activeExamType)?.name || activeExamType}</h3>
                      <p className="text-sm text-gray-500">파일의 날짜/시간(lastModified)으로 자동 등록됩니다.</p>
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
                      onChange={(e) => e.target.files && addQuickFiles(e.target.files)}
                    />
                    <i className="fas fa-cloud-upload-alt text-2xl text-gray-400 mb-2"></i>
                    <p className="text-base text-gray-700">파일을 드래그&드롭하거나 클릭해서 추가</p>
                    <p className="text-sm text-gray-500">JPG/PNG/PDF · 여러 파일 가능</p>
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
                              <p className="text-gray-500">{toExamDate(qf.file.lastModified)} {toTimeLabel(qf.file.lastModified)} · {formatFileSize(qf.file.size)}</p>
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
                              <p className="text-xs text-gray-500">{toExamDate(qf.file.lastModified)} {toTimeLabel(qf.file.lastModified)}</p>
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
                                    alt={typeInfo?.name || exam.exam_type}
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
                                  {typeInfo?.name || exam.exam_type}
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
              <p className="text-sm text-gray-500 mb-2">검사결과 탭 순서를 변경할 수 있습니다.</p>
              {examTabOrder.map((code, idx) => {
                const info = getExamTypeInfo(code);
                return (
                  <div key={code} className="flex items-center justify-between border border-gray-200 rounded-lg px-3 py-2">
                    <span className="text-base text-gray-700">{info?.name || code}</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => moveExamTab(idx, -1)}
                        disabled={idx === 0}
                        className="w-8 h-8 rounded border border-gray-200 text-gray-600 disabled:opacity-30"
                        title="위로"
                      >
                        <i className="fas fa-arrow-up"></i>
                      </button>
                      <button
                        onClick={() => moveExamTab(idx, 1)}
                        disabled={idx === examTabOrder.length - 1}
                        className="w-8 h-8 rounded border border-gray-200 text-gray-600 disabled:opacity-30"
                        title="아래로"
                      >
                        <i className="fas fa-arrow-down"></i>
                      </button>
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
