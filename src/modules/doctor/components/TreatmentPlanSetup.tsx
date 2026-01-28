/**
 * TreatmentPlanSetup
 * 새 진료 시작 시 치료 계획 설정 모달
 */

import { useState, useEffect, useCallback } from 'react';
import { query, insert, escapeString } from '@shared/lib/postgres';
import type { TreatmentProgram, TreatmentPlan, SelectedProgram } from '../types';

interface TreatmentPlanSetupProps {
  patientId: number;
  patientName: string;
  onCreateChart: (plan: Partial<TreatmentPlan>) => void;
  onSave?: (plan: Partial<TreatmentPlan>) => void; // 저장 후 닫기
  onClose: () => void;
}

const TreatmentPlanSetup: React.FC<TreatmentPlanSetupProps> = ({
  patientId,
  patientName,
  onCreateChart,
  onSave,
  onClose,
}) => {
  const [programs, setPrograms] = useState<TreatmentProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 폼 상태
  const [diseaseName, setDiseaseName] = useState('');
  const [durationWeeks, setDurationWeeks] = useState<number | null>(null);
  const [visitFrequency, setVisitFrequency] = useState('주 2회');
  const [selectedPrograms, setSelectedPrograms] = useState<number[]>([]);
  const [notes, setNotes] = useState('');

  // 치료 프로그램 목록 로드
  const loadPrograms = useCallback(async () => {
    try {
      const data = await query<TreatmentProgram>(`
        SELECT * FROM treatment_items
        WHERE is_active = 1
        ORDER BY display_order ASC, name ASC
      `);
      setPrograms(data);
    } catch (error) {
      console.error('치료 프로그램 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPrograms();
  }, [loadPrograms]);

  // 프로그램 선택/해제
  const toggleProgram = (programId: number) => {
    setSelectedPrograms(prev =>
      prev.includes(programId)
        ? prev.filter(id => id !== programId)
        : [...prev, programId]
    );
  };

  // 선택된 프로그램들의 정보 계산
  const getSelectedProgramsInfo = (): SelectedProgram[] => {
    return programs
      .filter(p => selectedPrograms.includes(p.id))
      .map(p => ({
        program_id: p.id,
        name: p.name,
        duration: p.duration,
        price: p.price,
      }));
  };

  // 1회 비용 계산
  const calculateCostPerVisit = () => {
    return getSelectedProgramsInfo().reduce((sum, p) => sum + p.price, 0);
  };

  // 예상 총 비용 계산
  const calculateTotalCost = () => {
    if (!durationWeeks) return 0;

    // 내원 빈도 파싱 (예: "주 2회" -> 2)
    const frequencyMatch = visitFrequency.match(/주\s*(\d+)\s*회/);
    const visitsPerWeek = frequencyMatch ? parseInt(frequencyMatch[1]) : 2;

    const totalVisits = durationWeeks * visitsPerWeek;
    return totalVisits * calculateCostPerVisit();
  };

  // 예상 총 내원 횟수 계산
  const calculateTotalVisits = () => {
    if (!durationWeeks) return 0;

    const frequencyMatch = visitFrequency.match(/주\s*(\d+)\s*회/);
    const visitsPerWeek = frequencyMatch ? parseInt(frequencyMatch[1]) : 2;

    return durationWeeks * visitsPerWeek;
  };

  // 금액 포맷
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ko-KR').format(price);
  };

  // 저장 처리 (proceedToChart: true면 초진차트로 진행, false면 저장 후 닫기)
  const handleSave = async (proceedToChart: boolean) => {
    setSaving(true);

    try {
      const selectedProgramsData = getSelectedProgramsInfo();
      const costPerVisit = calculateCostPerVisit();
      const totalCost = calculateTotalCost();
      const totalVisits = calculateTotalVisits();

      console.log('[TreatmentPlanSetup] 저장 시작:', { patientId, diseaseName, durationWeeks, visitFrequency });

      // 진료 계획 DB에 저장
      const sql = `
        INSERT INTO treatment_plans (
          patient_id,
          disease_name,
          planned_duration_weeks,
          planned_visits,
          visit_frequency,
          estimated_cost_per_visit,
          estimated_total_cost,
          selected_programs,
          notes,
          status,
          created_at,
          updated_at
        ) VALUES (
          ${patientId},
          ${diseaseName ? escapeString(diseaseName) : 'NULL'},
          ${durationWeeks || 'NULL'},
          ${totalVisits || 'NULL'},
          ${escapeString(visitFrequency)},
          ${costPerVisit},
          ${totalCost || 'NULL'},
          ${escapeString(JSON.stringify(selectedProgramsData))}::jsonb,
          ${notes ? escapeString(notes) : 'NULL'},
          'active',
          NOW(),
          NOW()
        )
      `;
      console.log('[TreatmentPlanSetup] SQL:', sql);

      const planId = await insert(sql);
      console.log('[TreatmentPlanSetup] 저장 완료, planId:', planId);

      const planData: Partial<TreatmentPlan> = {
        id: planId,
        patient_id: patientId,
        disease_name: diseaseName || undefined,
        planned_duration_weeks: durationWeeks || undefined,
        planned_visits: totalVisits || undefined,
        visit_frequency: visitFrequency,
        estimated_cost_per_visit: costPerVisit,
        estimated_total_cost: totalCost || undefined,
        selected_programs: selectedProgramsData,
        notes: notes || undefined,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      console.log('[TreatmentPlanSetup] proceedToChart:', proceedToChart);

      if (proceedToChart) {
        // 초진차트 작성으로 진행
        console.log('[TreatmentPlanSetup] onCreateChart 호출');
        onCreateChart(planData);
      } else {
        // 저장 후 닫기
        console.log('[TreatmentPlanSetup] onSave 호출');
        if (onSave) {
          onSave(planData);
        } else {
          onClose();
        }
      }
    } catch (error) {
      console.error('[TreatmentPlanSetup] 진료 계획 저장 실패:', error);
      alert('진료 계획 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-8">
          <div className="border-4 border-gray-200 border-t-clinic-primary rounded-full w-12 h-12 animate-spin mx-auto"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* 헤더 */}
        <div className="flex-shrink-0 px-6 py-4 border-b flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-800">새 진료 시작</h2>
            <p className="text-sm text-gray-500">{patientName} 환자</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <i className="fas fa-times text-xl"></i>
          </button>
        </div>

        {/* 컨텐츠 */}
        <div className="flex-1 overflow-auto p-6 space-y-6">
          {/* 질환명 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              질환명 <span className="text-gray-400 font-normal">(선택)</span>
            </label>
            <input
              type="text"
              value={diseaseName}
              onChange={(e) => setDiseaseName(e.target.value)}
              className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-clinic-primary focus:border-clinic-primary"
              placeholder="예: 요추 추간판 탈출증, 비염, 소화불량 등"
            />
          </div>

          {/* 치료기간 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              예상 치료기간 <span className="text-gray-400 font-normal">(선택)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {[4, 8, 12, 16, 24].map(weeks => (
                <button
                  key={weeks}
                  onClick={() => setDurationWeeks(durationWeeks === weeks ? null : weeks)}
                  className={`px-4 py-2 rounded-lg border transition-colors ${
                    durationWeeks === weeks
                      ? 'bg-clinic-primary text-white border-clinic-primary'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-clinic-primary'
                  }`}
                >
                  {weeks}주
                </button>
              ))}
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={durationWeeks && ![4, 8, 12, 16, 24].includes(durationWeeks) ? durationWeeks : ''}
                  onChange={(e) => setDurationWeeks(parseInt(e.target.value) || null)}
                  className="w-20 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-clinic-primary focus:border-clinic-primary"
                  placeholder="직접"
                  min="1"
                />
                <span className="text-gray-500">주</span>
              </div>
            </div>
          </div>

          {/* 내원 빈도 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              예상 내원 빈도
            </label>
            <div className="flex flex-wrap gap-2">
              {['주 1회', '주 2회', '주 3회', '격주'].map(freq => (
                <button
                  key={freq}
                  onClick={() => setVisitFrequency(freq)}
                  className={`px-4 py-2 rounded-lg border transition-colors ${
                    visitFrequency === freq
                      ? 'bg-clinic-primary text-white border-clinic-primary'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-clinic-primary'
                  }`}
                >
                  {freq}
                </button>
              ))}
            </div>
          </div>

          {/* 치료 프로그램 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              치료 프로그램 <span className="text-gray-400 font-normal">(선택)</span>
            </label>
            {programs.length === 0 ? (
              <div className="text-center py-6 bg-gray-50 rounded-lg">
                <p className="text-gray-500">등록된 치료 프로그램이 없습니다.</p>
                <p className="text-sm text-gray-400 mt-1">설정에서 프로그램을 추가해주세요.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {programs.map(program => (
                  <button
                    key={program.id}
                    onClick={() => toggleProgram(program.id)}
                    className={`p-3 rounded-lg border text-left transition-colors ${
                      selectedPrograms.includes(program.id)
                        ? 'bg-clinic-primary/10 border-clinic-primary text-clinic-primary'
                        : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{program.name}</span>
                      {selectedPrograms.includes(program.id) && (
                        <i className="fas fa-check text-clinic-primary"></i>
                      )}
                    </div>
                    <div className="text-sm text-gray-500 mt-0.5">
                      {program.duration}분 · ₩{formatPrice(program.price)}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 비용 요약 (프로그램 선택 시만 표시) */}
          {selectedPrograms.length > 0 && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-3">예상 비용</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">1회 진료비</span>
                  <span className="font-medium">₩{formatPrice(calculateCostPerVisit())}</span>
                </div>
                {durationWeeks && (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">
                        예상 총 내원 ({durationWeeks}주 × {visitFrequency})
                      </span>
                      <span className="font-medium">{calculateTotalVisits()}회</span>
                    </div>
                    <div className="border-t pt-2 mt-2 flex justify-between">
                      <span className="font-medium text-gray-700">예상 총 비용</span>
                      <span className="font-bold text-lg text-clinic-primary">
                        ₩{formatPrice(calculateTotalCost())}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* 비고 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              비고 <span className="text-gray-400 font-normal">(선택)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-clinic-primary focus:border-clinic-primary resize-none"
              rows={2}
              placeholder="추가 메모사항..."
            />
          </div>
        </div>

        {/* 푸터 */}
        <div className="flex-shrink-0 px-6 py-4 border-t bg-gray-50 rounded-b-xl flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
          >
            취소
          </button>
          <button
            onClick={() => handleSave(false)}
            disabled={saving}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                저장 중...
              </>
            ) : (
              <>
                <i className="fas fa-save"></i>
                저장
              </>
            )}
          </button>
          <button
            onClick={() => handleSave(true)}
            disabled={saving}
            className="px-5 py-2 bg-gradient-to-r from-clinic-primary to-clinic-secondary text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                저장 중...
              </>
            ) : (
              <>
                <i className="fas fa-file-medical"></i>
                초진차트 작성
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TreatmentPlanSetup;
