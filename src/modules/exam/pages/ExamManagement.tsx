import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Patient, ExamDateGroup, ExamResult, ExamType } from '../types';
import { EXAM_TYPES, getExamTypeInfo, getExamTypeStyles } from '../types';
import {
  searchPatients,
  getRecentExamPatients,
  getExamResultsGroupedByDate,
} from '../services/examService';
import { getThumbnailUrl, getFileUrl } from '../lib/fileUpload';
import ExamResultForm from '../components/ExamResultForm';
import ExamResultDetail from '../components/ExamResultDetail';
import ExamCompareViewer from '../components/ExamCompareViewer';
import ExamTrendChart from '../components/ExamTrendChart';
import ExamResultBook from '../components/ExamResultBook';

const ExamManagement: React.FC = () => {
  // 환자 관련 상태
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchResults, setSearchResults] = useState<Patient[]>([]);
  const [recentPatients, setRecentPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // 검사결과 관련 상태
  const [examGroups, setExamGroups] = useState<ExamDateGroup[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');

  // 모달 상태
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedExam, setSelectedExam] = useState<ExamResult | null>(null);
  const [showCompareViewer, setShowCompareViewer] = useState(false);
  const [compareExamType, setCompareExamType] = useState<ExamType | null>(null);
  const [showTrendViewer, setShowTrendViewer] = useState(false);
  const [trendExamType, setTrendExamType] = useState<ExamType | null>(null);
  const [showBookGenerator, setShowBookGenerator] = useState(false);

  // 최근 환자 로드
  useEffect(() => {
    loadRecentPatients();
  }, []);

  const loadRecentPatients = async () => {
    try {
      const patients = await getRecentExamPatients(10);
      setRecentPatients(patients);
    } catch (error) {
      console.error('최근 환자 로드 실패:', error);
    }
  };

  // 환자 검색
  const handleSearch = useCallback(async () => {
    if (!searchKeyword.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const results = await searchPatients(searchKeyword);
      setSearchResults(results);
    } catch (error) {
      console.error('환자 검색 실패:', error);
    } finally {
      setIsSearching(false);
    }
  }, [searchKeyword]);

  // 엔터키 검색
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // 환자 선택
  const handleSelectPatient = async (patient: Patient) => {
    setSelectedPatient(patient);
    setSearchResults([]);
    setSearchKeyword('');
    await loadExamResults(patient.id);
  };

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
      loadRecentPatients();
    }
  };

  // 필터링된 검사결과
  const filteredGroups = examGroups.map(group => ({
    ...group,
    exams: filterType === 'all'
      ? group.exams
      : group.exams.filter(e => e.exam_type === filterType)
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

  return (
    <div className="h-full flex">
      {/* 좌측: 환자 검색 */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
        {/* 검색 입력 */}
        <div className="p-4 border-b border-gray-200">
          <div className="relative">
            <input
              type="text"
              placeholder="환자 검색..."
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
            {isSearching && (
              <i className="fas fa-spinner fa-spin absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
            )}
          </div>
        </div>

        {/* 검색 결과 */}
        {searchResults.length > 0 && (
          <div className="border-b border-gray-200 max-h-60 overflow-y-auto">
            <div className="px-3 py-2 text-xs text-gray-500 bg-gray-50">
              검색 결과 ({searchResults.length})
            </div>
            {searchResults.map((patient) => (
              <button
                key={patient.id}
                onClick={() => handleSelectPatient(patient)}
                className="w-full px-4 py-2 text-left hover:bg-purple-50 flex items-center gap-2"
              >
                <i className="fas fa-user text-gray-400"></i>
                <div>
                  <div className="text-sm font-medium text-gray-900">
                    {patient.name}
                    <span className="text-gray-500 ml-1">
                      ({patient.gender === 'M' ? '남' : '여'}/{calculateAge(patient.birth_date)})
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">{patient.chart_number}</div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* 최근 환자 */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-3 py-2 text-xs text-gray-500 bg-gray-50 sticky top-0">
            최근 검사 환자
          </div>
          {recentPatients.length === 0 ? (
            <div className="p-4 text-center text-sm text-gray-400">
              검사 기록이 없습니다
            </div>
          ) : (
            recentPatients.map((patient) => (
              <button
                key={patient.id}
                onClick={() => handleSelectPatient(patient)}
                className={`w-full px-4 py-2 text-left hover:bg-purple-50 flex items-center gap-2 ${
                  selectedPatient?.id === patient.id ? 'bg-purple-100' : ''
                }`}
              >
                <i className="fas fa-user text-gray-400"></i>
                <div>
                  <div className="text-sm font-medium text-gray-900">
                    {patient.name}
                  </div>
                  <div className="text-xs text-gray-500">{patient.chart_number}</div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* 우측: 검사결과 목록 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedPatient ? (
          <>
            {/* 헤더 */}
            <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">
                    {selectedPatient.name}
                    <span className="text-gray-500 font-normal ml-2">
                      ({selectedPatient.gender === 'M' ? '남' : '여'}/{calculateAge(selectedPatient.birth_date)})
                    </span>
                  </h2>
                  <p className="text-sm text-gray-500">{selectedPatient.chart_number}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {/* 필터 */}
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
                >
                  <option value="all">전체</option>
                  {EXAM_TYPES.map((type) => (
                    <option key={type.code} value={type.code}>
                      {type.name}
                    </option>
                  ))}
                </select>

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
                    {/* 드롭다운 메뉴 */}
                    <div className="absolute right-0 mt-1 w-40 bg-white border border-gray-200 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                      {trendableTypes.map((type) => {
                        const info = getExamTypeInfo(type);
                        return (
                          <button
                            key={type}
                            onClick={() => handleStartTrend(type)}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-purple-50 flex items-center gap-2"
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
                    {/* 드롭다운 메뉴 */}
                    <div className="absolute right-0 mt-1 w-40 bg-white border border-gray-200 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                      {comparableTypes.map((type) => {
                        const info = getExamTypeInfo(type);
                        return (
                          <button
                            key={type}
                            onClick={() => handleStartCompare(type)}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-purple-50 flex items-center gap-2"
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
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 flex items-center gap-2"
                >
                  <i className="fas fa-plus"></i>
                  검사 등록
                </button>
              </div>
            </div>

            {/* 검사결과 목록 */}
            <div className="flex-1 overflow-y-auto p-6">
              {isLoading ? (
                <div className="flex items-center justify-center h-40">
                  <i className="fas fa-spinner fa-spin text-2xl text-purple-600"></i>
                </div>
              ) : filteredGroups.length === 0 ? (
                <div className="text-center py-20">
                  <i className="fas fa-folder-open text-6xl text-gray-300 mb-4"></i>
                  <p className="text-gray-500">등록된 검사결과가 없습니다</p>
                  <button
                    onClick={() => setShowAddForm(true)}
                    className="mt-4 text-purple-600 hover:underline"
                  >
                    첫 검사 등록하기
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  {filteredGroups.map((group) => (
                    <div key={group.date} className="bg-white rounded-lg shadow-sm border border-gray-200">
                      {/* 날짜 헤더 */}
                      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 rounded-t-lg">
                        <h3 className="font-medium text-gray-700">
                          <i className="fas fa-calendar-day mr-2 text-gray-400"></i>
                          {group.date}
                        </h3>
                      </div>

                      {/* 검사 목록 */}
                      <div className="p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {group.exams.map((exam) => {
                          const typeInfo = getExamTypeInfo(exam.exam_type);
                          const typeStyles = getExamTypeStyles(exam.exam_type);
                          const thumbnail = exam.attachments?.[0]?.thumbnail_path;

                          return (
                            <button
                              key={exam.id}
                              onClick={() => setSelectedExam(exam)}
                              className="group bg-gray-50 rounded-lg p-3 hover:bg-purple-50 hover:ring-2 hover:ring-purple-200 transition-all text-left"
                            >
                              {/* 썸네일 */}
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

                              {/* 정보 */}
                              <div className="flex items-center gap-2">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${typeStyles.badge}`}>
                                  {typeInfo?.name || exam.exam_type}
                                </span>
                                {(exam.attachments?.length || 0) > 1 && (
                                  <span className="text-xs text-gray-500">
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
            </div>
          </>
        ) : (
          /* 환자 미선택 상태 */
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <i className="fas fa-user-circle text-6xl text-gray-300 mb-4"></i>
              <p className="text-gray-500">환자를 선택하세요</p>
            </div>
          </div>
        )}
      </div>

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
            {/* 헤더 */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">
                <i className="fas fa-chart-line text-purple-600 mr-2"></i>
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

            {/* 본문 */}
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
