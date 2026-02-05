import React, { useState, useEffect } from 'react';
import { query } from '@shared/lib/postgres';

interface LinkedChart {
  id: number;
  chart_date: string;
  chief_complaint: string;
  created_at: string;
}

interface LinkedProgress {
  id: number;
  note_date: string;
  assessment: string;
  notes: string;
  created_at: string;
}

interface TreatmentPlanWithRecords {
  id: number;
  patient_id: number;
  disease_name: string | null;
  visit_frequency: string;
  planned_duration_weeks: number | null;
  selected_programs: { program_id: number; name: string }[] | null;
  created_at: string;
  charts: LinkedChart[];
  progressNotes: LinkedProgress[];
}

interface Props {
  patientId: number;
  patientName: string;
  onSelectRecord: (recordId: number) => void;
  onSelectPlan?: (planId: number) => void;
  onEditPlan?: (planId: number) => void;
  onDeletePlan?: (planId: number) => void;
  onCreateChartFromPlan?: (planId: number) => void;
  onCreateProgressFromPlan?: (planId: number) => void;
  onImportLegacyChart?: (planId: number) => void;
  onEditProgress?: (progressId: number, planId: number) => void;
  onDeleteProgress?: (progressId: number) => void;
}

type DateFilterType = 'all' | 'today' | 'week' | 'month' | 'custom';

const MedicalRecordList: React.FC<Props> = ({
  patientId,
  patientName,
  onSelectRecord,
  onSelectPlan,
  onEditPlan,
  onDeletePlan,
  onCreateChartFromPlan,
  onCreateProgressFromPlan,
  onImportLegacyChart,
  onEditProgress,
  onDeleteProgress,
}) => {
  const [plans, setPlans] = useState<TreatmentPlanWithRecords[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedPlans, setExpandedPlans] = useState<Set<number>>(new Set());
  const [dateFilter, setDateFilter] = useState<DateFilterType>('all');
  const [customDate, setCustomDate] = useState<string>(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    loadRecords();
  }, [patientId]);

  const loadRecords = async () => {
    try {
      setLoading(true);

      // 1. 모든 진료계획 가져오기
      const plansData = await query<{
        id: number;
        patient_id: number;
        disease_name: string | null;
        visit_frequency: string;
        planned_duration_weeks: number | null;
        selected_programs: { program_id: number; name: string }[] | null;
        created_at: string;
      }>(`SELECT id, patient_id, disease_name, visit_frequency, planned_duration_weeks, selected_programs, created_at
          FROM treatment_plans
          WHERE patient_id = ${patientId}
          ORDER BY created_at DESC`);

      // 2. 연결된 초진차트 가져오기
      const chartsData = await query<{
        id: number;
        treatment_plan_id: number | null;
        chart_date: string;
        notes: string;
        created_at: string;
      }>(`SELECT id, treatment_plan_id, chart_date, notes, created_at
          FROM initial_charts
          WHERE patient_id = ${patientId}
          ORDER BY created_at DESC`);

      // 3. 연결된 경과기록 가져오기
      const progressData = await query<{
        id: number;
        treatment_plan_id: number | null;
        note_date: string;
        assessment: string;
        notes: string;
        created_at: string;
      }>(`SELECT id, treatment_plan_id, note_date, assessment, notes, created_at
          FROM progress_notes
          WHERE patient_id = ${patientId}
          ORDER BY note_date DESC`);

      // 4. 진료계획별로 차트/경과 연결
      const plansWithRecords: TreatmentPlanWithRecords[] = (plansData || []).map(plan => ({
        ...plan,
        charts: (chartsData || [])
          .filter(c => c.treatment_plan_id === plan.id)
          .map(c => ({
            id: c.id,
            chart_date: c.chart_date,
            chief_complaint: extractChiefComplaint(c.notes),
            created_at: c.created_at,
          })),
        progressNotes: (progressData || [])
          .filter(p => p.treatment_plan_id === plan.id)
          .map(p => ({
            id: p.id,
            note_date: p.note_date,
            assessment: p.assessment || '(내용 없음)',
            notes: p.notes || '',
            created_at: p.created_at,
          })),
      }));

      setPlans(plansWithRecords);

      // 기본적으로 첫번째 계획 펼치기
      if (plansWithRecords.length > 0) {
        setExpandedPlans(new Set([plansWithRecords[0].id]));
      }
    } catch (error) {
      console.error('진료기록 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  // 주소증 추출 함수
  const extractChiefComplaint = (notes: string): string => {
    if (!notes) return '-';
    const sectionMatch = notes.match(/\[주소증\]\s*([^\[]+)/);
    if (!sectionMatch) return '-';
    const sectionText = sectionMatch[1].trim();
    const lines = sectionText.split('\n');
    const numberedItems: string[] = [];
    for (const line of lines) {
      const numberedMatch = line.match(/^\d+\.\s*(.+)/);
      if (numberedMatch) {
        numberedItems.push(numberedMatch[1].trim());
      }
    }
    if (numberedItems.length === 0) return '-';
    const result = numberedItems.join(', ');
    return result.length > 40 ? result.substring(0, 40) + '...' : result;
  };

  // 날짜 필터링
  const getFilteredPlans = () => {
    if (dateFilter === 'all') return plans;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    return plans.filter(plan => {
      const planDate = new Date(plan.created_at);
      const planDay = new Date(planDate.getFullYear(), planDate.getMonth(), planDate.getDate());

      switch (dateFilter) {
        case 'today':
          return planDay.getTime() === today.getTime();
        case 'week':
          const weekAgo = new Date(today);
          weekAgo.setDate(weekAgo.getDate() - 7);
          return planDate >= weekAgo;
        case 'month':
          const monthAgo = new Date(today);
          monthAgo.setMonth(monthAgo.getMonth() - 1);
          return planDate >= monthAgo;
        case 'custom':
          const filterDay = new Date(customDate);
          return planDay.getTime() === filterDay.getTime();
        default:
          return true;
      }
    });
  };

  // 계획 펼치기/접기 토글
  const togglePlan = (planId: number) => {
    setExpandedPlans(prev => {
      const newSet = new Set(prev);
      if (newSet.has(planId)) {
        newSet.delete(planId);
      } else {
        newSet.add(planId);
      }
      return newSet;
    });
  };

  // 진료계획 입력 완료 여부
  const isPlanComplete = (plan: TreatmentPlanWithRecords): boolean => {
    return !!(
      plan.disease_name &&
      plan.planned_duration_weeks &&
      plan.selected_programs &&
      plan.selected_programs.length > 0
    );
  };

  // 치료기간 라벨
  const getDurationLabel = (weeks: number | null): string => {
    if (!weeks) return '';
    if (weeks <= 4) return '1개월';
    if (weeks <= 12) return '3개월';
    if (weeks <= 26) return '6개월~1년';
    return '1년이상';
  };

  const filteredPlans = getFilteredPlans();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="border-4 border-clinic-background border-t-clinic-primary rounded-full w-8 h-8 animate-spin"></div>
        <span className="ml-3 text-clinic-text-secondary">로딩 중...</span>
      </div>
    );
  }

  if (plans.length === 0) {
    return (
      <div className="text-center py-12">
        <i className="fas fa-clipboard text-6xl text-gray-300 mb-4"></i>
        <p className="text-clinic-text-secondary">등록된 진료기록이 없습니다</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* 날짜 필터 */}
      <div className="flex items-center gap-2 flex-wrap pb-2 border-b">
        <span className="text-sm text-gray-500 mr-1">
          <i className="fas fa-filter mr-1"></i>기간:
        </span>
        {[
          { type: 'all' as const, label: '전체' },
          { type: 'today' as const, label: '오늘' },
          { type: 'week' as const, label: '최근 1주' },
          { type: 'month' as const, label: '최근 1달' },
        ].map(({ type, label }) => (
          <button
            key={type}
            onClick={() => setDateFilter(type)}
            className={`px-3 py-1 text-sm rounded-full transition-colors ${
              dateFilter === type
                ? 'bg-clinic-primary text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {label}
          </button>
        ))}
        <input
          type="date"
          value={customDate}
          onChange={(e) => {
            setCustomDate(e.target.value);
            setDateFilter('custom');
          }}
          className={`px-2 py-1 text-sm border rounded-lg ${
            dateFilter === 'custom' ? 'border-clinic-primary' : 'border-gray-200'
          }`}
        />
        <span className="ml-auto text-sm text-gray-500">
          {filteredPlans.length}건
          {dateFilter !== 'all' && ` / 총 ${plans.length}건`}
        </span>
      </div>

      {/* 필터 결과 없음 */}
      {filteredPlans.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <i className="fas fa-search text-4xl text-gray-300 mb-3"></i>
          <p>해당 기간에 진료기록이 없습니다</p>
        </div>
      )}

      {/* 진료계획 목록 (계층 구조) */}
      {filteredPlans.map((plan) => {
        const isExpanded = expandedPlans.has(plan.id);
        const complete = isPlanComplete(plan);
        const hasRecords = plan.charts.length > 0 || plan.progressNotes.length > 0;

        // 카드 스타일
        const cardBg = plan.charts.length > 0
          ? 'bg-green-50 border-green-300'
          : complete
          ? 'bg-blue-50 border-blue-300'
          : 'bg-red-50 border-red-300';

        const badgeStyle = plan.charts.length > 0
          ? 'bg-green-200 text-green-800'
          : complete
          ? 'bg-blue-200 text-blue-800'
          : 'bg-red-200 text-red-800';

        const statusText = plan.charts.length > 0
          ? '차트완료'
          : complete
          ? '입력완료'
          : '미완료';

        return (
          <div key={plan.id} className={`border-2 rounded-xl overflow-hidden ${cardBg}`}>
            {/* 진료계획 헤더 */}
            <div
              onClick={() => togglePlan(plan.id)}
              className="p-4 cursor-pointer hover:bg-black/5 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <i className={`fas fa-chevron-${isExpanded ? 'down' : 'right'} text-gray-400 text-sm`}></i>
                    <span className="bg-gray-700 text-white px-2 py-0.5 rounded text-xs font-medium">
                      진료계획
                    </span>
                    <span className="text-gray-600 text-sm">
                      {new Date(plan.created_at).toLocaleDateString('ko-KR')}{' '}
                      {new Date(plan.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${badgeStyle}`}>
                      {statusText}
                    </span>
                  </div>
                  <div className="ml-5">
                    <p className="font-semibold text-gray-800">
                      {plan.disease_name || '(질환명 미입력)'}
                    </p>
                    <div className="flex flex-wrap gap-2 mt-1 text-sm text-gray-600">
                      {plan.visit_frequency && (
                        <span><i className="fas fa-calendar-alt mr-1"></i>{plan.visit_frequency}</span>
                      )}
                      {plan.planned_duration_weeks && (
                        <span><i className="fas fa-clock mr-1"></i>{getDurationLabel(plan.planned_duration_weeks)}</span>
                      )}
                      {plan.selected_programs && plan.selected_programs.length > 0 && (
                        <span>
                          <i className="fas fa-pills mr-1"></i>
                          {plan.selected_programs.map(p => p.name).join(', ')}
                        </span>
                      )}
                      {hasRecords && (
                        <span className="text-green-700">
                          <i className="fas fa-file-medical mr-1"></i>
                          차트 {plan.charts.length} / 경과 {plan.progressNotes.length}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* 액션 버튼 */}
              <div className="flex flex-wrap gap-2 mt-3 ml-5">
                {/* 초진차트가 있으면 비활성화 */}
                {plan.charts.length > 0 ? (
                  <button
                    disabled
                    className="px-3 py-1.5 bg-gray-300 text-gray-500 text-xs rounded-lg cursor-not-allowed flex items-center gap-1"
                    title="이미 초진차트가 작성되었습니다"
                  >
                    <i className="fas fa-check-circle"></i>
                    초진차트 완료
                  </button>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onCreateChartFromPlan?.(plan.id);
                    }}
                    className="px-3 py-1.5 bg-clinic-primary text-white text-xs rounded-lg hover:bg-clinic-primary/90 transition-colors flex items-center gap-1"
                  >
                    <i className="fas fa-file-medical"></i>
                    초진차트 작성
                  </button>
                )}
                {/* 경과 입력: 차트가 있으면 차트뷰로, 없으면 기존 방식 */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (plan.charts.length > 0) {
                      // 가장 최근 차트의 상세뷰로 이동
                      onSelectRecord(plan.charts[0].id);
                    } else {
                      // 차트가 없으면 알림
                      alert('먼저 초진차트를 작성해주세요.');
                    }
                  }}
                  className="px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 transition-colors flex items-center gap-1"
                >
                  <i className="fas fa-notes-medical"></i>
                  경과 입력
                </button>
                {onImportLegacyChart && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onImportLegacyChart(plan.id);
                    }}
                    className="px-3 py-1.5 bg-amber-500 text-white text-xs rounded-lg hover:bg-amber-600 transition-colors flex items-center gap-1"
                  >
                    <i className="fas fa-upload"></i>
                    기존 차트 등록
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditPlan?.(plan.id);
                  }}
                  className="px-3 py-1.5 bg-gray-500 text-white text-xs rounded-lg hover:bg-gray-600 transition-colors flex items-center gap-1"
                >
                  <i className="fas fa-pen"></i>
                  수정
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm('이 진료계획을 삭제하시겠습니까?')) {
                      onDeletePlan?.(plan.id);
                    }
                  }}
                  className="px-3 py-1.5 bg-red-500 text-white text-xs rounded-lg hover:bg-red-600 transition-colors flex items-center gap-1"
                >
                  <i className="fas fa-trash"></i>
                  삭제
                </button>
              </div>
            </div>

            {/* 연결된 차트/경과 목록 (펼쳐진 경우) */}
            {isExpanded && hasRecords && (
              <div className="border-t border-gray-200 bg-white/50">
                {/* 초진차트 */}
                {plan.charts.map(chart => (
                  <div
                    key={`chart-${chart.id}`}
                    onClick={() => onSelectRecord(chart.id)}
                    className="ml-8 mr-4 my-2 p-3 bg-white rounded-lg border border-gray-200 cursor-pointer hover:shadow-md hover:border-clinic-primary transition-all"
                  >
                    <div className="flex items-center gap-2">
                      <span className="bg-clinic-primary text-white px-2 py-0.5 rounded text-xs">초진</span>
                      <span className="text-sm text-gray-600">
                        {new Date(chart.chart_date).toLocaleDateString('ko-KR')}
                      </span>
                      <span className="text-sm text-gray-800 font-medium flex-1 truncate">
                        {chart.chief_complaint}
                      </span>
                      <i className="fas fa-chevron-right text-gray-400 text-sm"></i>
                    </div>
                  </div>
                ))}

                {/* 경과기록 */}
                {plan.progressNotes.map(note => {
                  // notes가 있으면 첫 줄 추출, 없으면 assessment 사용
                  const displayText = note.notes
                    ? note.notes.split('\n').find(line => line.trim() && !line.startsWith('['))?.substring(0, 50) || note.assessment
                    : note.assessment;
                  return (
                    <div
                      key={`progress-${note.id}`}
                      className="ml-8 mr-4 my-2 p-3 bg-white rounded-lg border border-gray-200 hover:border-green-400 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="bg-green-600 text-white px-2 py-0.5 rounded text-xs">경과</span>
                        <span className="text-sm text-gray-600">
                          {new Date(note.note_date).toLocaleDateString('ko-KR')}
                        </span>
                        <span className="text-sm text-gray-800 flex-1 truncate">
                          {displayText}
                        </span>
                        {/* 수정/삭제 버튼 */}
                        <div className="flex gap-1 ml-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditProgress?.(note.id, plan.id);
                            }}
                            className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                            title="수정"
                          >
                            <i className="fas fa-pen"></i>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm('이 경과기록을 삭제하시겠습니까?')) {
                                onDeleteProgress?.(note.id);
                              }
                            }}
                            className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                            title="삭제"
                          >
                            <i className="fas fa-trash"></i>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default MedicalRecordList;
