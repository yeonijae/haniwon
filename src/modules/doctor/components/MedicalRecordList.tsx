import React, { useState, useEffect } from 'react';
import { query, execute } from '@shared/lib/postgres';

interface LinkedChart {
  id: number;
  chart_date: string;
  chief_complaint: string;
  prescription_issued: boolean;
  dosage_created: boolean;
  created_at: string;
}

interface LinkedProgress {
  id: number;
  note_date: string;
  assessment: string;
  notes: string;
  prescription_issued: boolean;
  created_at: string;
}

interface TreatmentPlanWithRecords {
  id: number;
  patient_id: number;
  disease_name: string | null;
  visit_frequency: string;
  planned_duration_weeks: number | null;
  selected_programs: { program_id: number; name: string }[] | null;
  treatment_purpose?: string;
  nokryong_recommendation?: string;
  consultation_type?: string;
  status?: string;
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
  onEditChart?: (chartId: number) => void;
  onIssuePrescription?: (sourceType: 'initial_chart' | 'progress_note', sourceId: number, planId: number) => void;
  onCreateDosage?: (sourceType: 'initial_chart' | 'progress_note', sourceId: number, planId: number) => void;
  onOpenMedicationInput?: (planId: number, chartId?: number) => void;
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
  onEditChart,
  onIssuePrescription,
  onCreateDosage,
  onOpenMedicationInput,
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
        treatment_purpose?: string;
        nokryong_recommendation?: string;
        consultation_type?: string;
        status?: string;
        created_at: string;
      }>(`SELECT id, patient_id, disease_name, visit_frequency, planned_duration_weeks, selected_programs, treatment_purpose, nokryong_recommendation, consultation_type, status, created_at
          FROM treatment_plans
          WHERE patient_id = ${patientId}
          ORDER BY created_at DESC`);

      // 2. 연결된 초진차트 가져오기
      const chartsData = await query<{
        id: number;
        treatment_plan_id: number | null;
        chart_date: string;
        notes: string;
        prescription_issued: boolean;
        created_at: string;
      }>(`SELECT id, treatment_plan_id, chart_date, notes, COALESCE(prescription_issued, 0) as prescription_issued, created_at
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
        prescription_issued: boolean;
        created_at: string;
      }>(`SELECT id, treatment_plan_id, note_date, assessment, notes, COALESCE(prescription_issued, 0) as prescription_issued, created_at
          FROM progress_notes
          WHERE patient_id = ${patientId}
          ORDER BY note_date DESC`);

      // 3.5. 복용법 작성 여부 조회 (prescriptions 테이블)
      const dosageData = await query<{
        source_type: string;
        source_id: number;
        dosage_instruction_created: boolean;
      }>(`SELECT source_type, source_id, COALESCE(dosage_instruction_created, 0) as dosage_instruction_created
          FROM prescriptions
          WHERE patient_id = ${patientId} AND dosage_instruction_created = 1`);

      const dosageMap = new Set(
        (dosageData || []).map(d => `${d.source_type}_${d.source_id}`)
      );

      // 4. 진료계획별로 차트/경과 연결
      const plansWithRecords: TreatmentPlanWithRecords[] = (plansData || []).map(plan => ({
        ...plan,
        charts: (chartsData || [])
          .filter(c => c.treatment_plan_id === plan.id)
          .map(c => ({
            id: c.id,
            chart_date: c.chart_date,
            chief_complaint: extractChiefComplaint(c.notes),
            prescription_issued: c.prescription_issued || false,
            dosage_created: dosageMap.has(`initial_chart_${c.id}`),
            created_at: c.created_at,
          })),
        progressNotes: (progressData || [])
          .filter(p => p.treatment_plan_id === plan.id)
          .map(p => ({
            id: p.id,
            note_date: p.note_date,
            assessment: p.assessment || '(내용 없음)',
            notes: p.notes || '',
            prescription_issued: p.prescription_issued || false,
            created_at: p.created_at,
          })),
      }));

      setPlans(plansWithRecords);

      // 완료되지 않은 진료카드는 펼치고, 완료된 건 닫기
      const activeIds = plansWithRecords
        .filter(p => p.status !== 'completed')
        .map(p => p.id);
      setExpandedPlans(new Set(activeIds));
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
    if (sectionMatch) {
      const sectionText = sectionMatch[1].trim();
      const lines = sectionText.split('\n').filter(l => l.trim());
      // 번호 항목 추출
      const numberedItems: string[] = [];
      for (const line of lines) {
        const numberedMatch = line.match(/^\d+\.\s*(.+)/);
        if (numberedMatch) {
          numberedItems.push(numberedMatch[1].trim());
        }
      }
      if (numberedItems.length > 0) {
        return numberedItems.join(', ');
      }
      // 번호 항목이 없으면 주소증 섹션 텍스트 그대로
      return lines.join(' ');
    }
    // [주소증] 마커가 없으면 첫 의미있는 줄들
    const contentLines = notes.split('\n').filter(l => l.trim() && !l.startsWith('['));
    return contentLines.join(' ').trim() || '-';
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
        const isCompleted = plan.status === 'completed';
        const cardBg = isCompleted
          ? 'bg-gray-50 border-gray-200 opacity-70'
          : plan.charts.length > 0
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
                  <div className="flex items-center gap-2 flex-wrap">
                    <i className={`fas fa-chevron-${isExpanded ? 'down' : 'right'} text-gray-400 text-sm`}></i>
                    <span className="text-gray-800 font-semibold text-sm">
                      {(() => {
                        const d = new Date(plan.created_at);
                        const days = ['일', '월', '화', '수', '목', '금', '토'];
                        return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}(${days[d.getDay()]})`;
                      })()}
                    </span>
                    {plan.treatment_purpose && (
                      <span className="text-sm text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded">{plan.treatment_purpose}</span>
                    )}
                    {plan.disease_name && (
                      <span className="text-sm text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">{plan.disease_name}</span>
                    )}
                    {plan.planned_duration_weeks && (
                      <span className="text-sm text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">{getDurationLabel(plan.planned_duration_weeks)} 치료</span>
                    )}
                    {plan.visit_frequency && (
                      <span className="text-sm text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded">{plan.visit_frequency} 내원</span>
                    )}
                    {plan.nokryong_recommendation && plan.nokryong_recommendation !== '언급없음' && (
                      <span className="text-sm text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">{plan.nokryong_recommendation}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* 액션 버튼 */}
              <div className={`flex flex-wrap gap-2 mt-3 ml-5 ${isCompleted ? 'opacity-60' : ''}`}>
                {/* 초진차트가 있으면 비활성화 */}
                {plan.charts.length > 0 ? (
                  <button
                    disabled
                    className="px-3 py-1.5 bg-gray-300 text-gray-500 text-xs rounded-lg cursor-not-allowed flex items-center gap-1"
                    title="이미 초진차트가 작성되었습니다"
                  >
                    <i className="fas fa-check-circle"></i>
                    초진차트
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
                {plan.charts.length > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectRecord(plan.charts[0].id);
                    }}
                    className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1"
                  >
                    <i className="fas fa-clipboard-list"></i>
                    상세보기
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditPlan?.(plan.id);
                  }}
                  className="px-3 py-1.5 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-1 font-medium"
                >
                  <i className="fas fa-clipboard-list"></i>
                  진료계획
                </button>
                {plan.status !== 'completed' ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm('이 진료를 완료 처리하시겠습니까?')) {
                        execute(`UPDATE treatment_plans SET status = 'completed', updated_at = '${new Date().toISOString()}' WHERE id = ${plan.id}`).then(() => {
                          loadRecords();
                        });
                      }
                    }}
                    className="px-3 py-1.5 bg-gray-600 text-white text-xs rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-1"
                  >
                    <i className="fas fa-check-circle"></i>
                    진료완료
                  </button>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      execute(`UPDATE treatment_plans SET status = 'active', updated_at = '${new Date().toISOString()}' WHERE id = ${plan.id}`).then(() => {
                        loadRecords();
                      });
                    }}
                    className="px-3 py-1.5 bg-green-100 text-green-700 text-xs rounded-lg hover:bg-green-200 transition-colors flex items-center gap-1"
                  >
                    <i className="fas fa-check-circle"></i>
                    진료완료됨
                  </button>
                )}
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
                    className="group ml-8 mr-4 my-2 p-3 bg-white rounded-lg border border-gray-200 hover:border-blue-400 hover:shadow-sm transition-all"
                  >
                    <div className="flex items-center gap-2">
                      <span className="bg-clinic-primary text-white px-2 py-0.5 rounded text-xs">초진</span>
                      <span className="text-sm text-gray-600">
                        {new Date(chart.chart_date).toLocaleDateString('ko-KR')}
                      </span>
                      <span className="text-sm text-gray-800 font-medium flex-1" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {chart.chief_complaint}
                      </span>
                      <div className="flex gap-1 ml-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditChart ? onEditChart(chart.id) : onSelectRecord(chart.id);
                          }}
                          className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors opacity-0 group-hover:opacity-100"
                          title="수정"
                        >
                          <i className="fas fa-pen"></i>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm('이 초진차트를 삭제하시겠습니까?')) {
                              execute(`DELETE FROM initial_charts WHERE id = ${chart.id}`).then(() => {
                                loadRecords();
                              });
                            }
                          }}
                          className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors opacity-0 group-hover:opacity-100"
                          title="삭제"
                        >
                          <i className="fas fa-trash"></i>
                        </button>
                        <span className="w-px h-4 bg-gray-300 mx-0.5 opacity-0 group-hover:opacity-100"></span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onIssuePrescription?.('initial_chart', chart.id, plan.id);
                          }}
                          className={`px-2 py-1 text-xs rounded transition-colors ${
                            chart.prescription_issued
                              ? 'bg-green-100 text-green-700'
                              : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                          }`}
                          title={chart.prescription_issued ? '처방전 발급완료' : '처방전 발급'}
                        >
                          {chart.prescription_issued ? '✅ 처방전' : '처방전'}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onCreateDosage?.('initial_chart', chart.id, plan.id);
                          }}
                          className={`px-2 py-1 text-xs rounded transition-colors ${
                            chart.dosage_created
                              ? 'bg-green-100 text-green-700'
                              : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                          }`}
                          title={chart.dosage_created ? '복용법 작성완료' : '복용법 작성'}
                        >
                          {chart.dosage_created ? '✅ 복용법' : '복용법'}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenMedicationInput?.(plan.id, chart.id);
                          }}
                          className="px-2 py-1 text-xs rounded transition-colors bg-teal-100 text-teal-700 hover:bg-teal-200"
                          title="양약 입력"
                        >
                          💊 양약
                        </button>
                      </div>
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
                      className="group ml-8 mr-4 my-2 p-3 bg-white rounded-lg border border-gray-200 hover:border-blue-400 hover:shadow-sm transition-all"
                    >
                      <div className="flex items-center gap-2">
                        <span className="bg-green-600 text-white px-2 py-0.5 rounded text-xs">경과</span>
                        <span className="text-sm text-gray-600">
                          {note.assessment?.includes('날짜미상')
                            ? note.assessment.replace(' (날짜미상)', '')
                            : new Date(note.note_date).toLocaleDateString('ko-KR')}
                        </span>
                        {note.assessment?.includes('날짜미상') && (
                          <span className="text-xs text-gray-400">(날짜미상)</span>
                        )}
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
                            className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors opacity-0 group-hover:opacity-100"
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
                            className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors opacity-0 group-hover:opacity-100"
                            title="삭제"
                          >
                            <i className="fas fa-trash"></i>
                          </button>
                          <span className="w-px h-4 bg-gray-300 mx-0.5 opacity-0 group-hover:opacity-100"></span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onIssuePrescription?.('progress_note', note.id, plan.id);
                            }}
                            className={`px-2 py-1 text-xs rounded transition-colors ${
                              note.prescription_issued
                                ? 'bg-green-100 text-green-700'
                                : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                            }`}
                            title={note.prescription_issued ? '처방전 발급완료' : '처방전 발급'}
                          >
                            {note.prescription_issued ? '✅ 처방전' : '처방전'}
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
