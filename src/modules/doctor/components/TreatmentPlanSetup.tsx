/**
 * TreatmentPlanSetup
 * 새 진료 시작 시 치료 계획 설정 모달
 */

import { useState, useEffect, useCallback } from 'react';
import { query, insert, execute, escapeString } from '@shared/lib/postgres';
import type { TreatmentProgram, TreatmentPlan, SelectedProgram } from '../types';

interface TreatmentPlanSetupProps {
  patientId: number;
  patientName: string;
  existingPlan?: Partial<TreatmentPlan>; // 수정 모드일 때 기존 계획
  onCreateChart: (plan: Partial<TreatmentPlan>) => void;
  onSave?: (plan: Partial<TreatmentPlan>) => void; // 저장 후 닫기
  onClose: () => void;
}

const TreatmentPlanSetup: React.FC<TreatmentPlanSetupProps> = ({
  patientId,
  patientName,
  existingPlan,
  onCreateChart,
  onSave,
  onClose,
}) => {
  const isEditMode = !!existingPlan?.id;
  const [programs, setPrograms] = useState<TreatmentProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 현재 날짜/시간 기본값 계산
  const getDefaultDateTime = () => {
    const now = existingPlan?.created_at ? new Date(existingPlan.created_at) : new Date();
    const date = now.toISOString().split('T')[0];
    const time = now.toTimeString().slice(0, 5); // HH:MM
    return { date, time };
  };

  const defaultDateTime = getDefaultDateTime();

  // 폼 상태 (수정 모드일 때 기존 값으로 초기화)
  const [planDate, setPlanDate] = useState(defaultDateTime.date);
  const [planTime, setPlanTime] = useState(defaultDateTime.time);
  const [diseaseName, setDiseaseName] = useState(existingPlan?.disease_name || '');
  const [durationWeeks, setDurationWeeks] = useState<number | null>(existingPlan?.planned_duration_weeks || null);
  const [visitFrequency, setVisitFrequency] = useState(existingPlan?.visit_frequency || '30일');
  const [selectedPrograms, setSelectedPrograms] = useState<number[]>(
    existingPlan?.selected_programs?.map(p => p.program_id) || []
  );
  const [notes, setNotes] = useState(existingPlan?.notes || '');

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

  // 선택된 프로그램들의 정보
  const getSelectedProgramsInfo = (): SelectedProgram[] => {
    return programs
      .filter(p => selectedPrograms.includes(p.id))
      .map(p => ({
        program_id: p.id,
        name: p.name,
        duration: 0,
        price: 0,
      }));
  };

  // 저장 처리 (proceedToChart: true면 초진차트로 진행, false면 저장 후 닫기)
  const handleSave = async (proceedToChart: boolean) => {
    setSaving(true);

    try {
      const selectedProgramsData = getSelectedProgramsInfo();

      // 사용자가 선택한 날짜/시간을 타임스탬프로 변환
      const planTimestamp = `${planDate} ${planTime}:00`;

      console.log('[TreatmentPlanSetup] 저장 시작:', { patientId, diseaseName, durationWeeks, visitFrequency, isEditMode, planTimestamp });

      let planId: number;

      if (isEditMode && existingPlan?.id) {
        // 수정 모드: UPDATE 쿼리
        const updateSql = `
          UPDATE treatment_plans SET
            disease_name = ${diseaseName ? escapeString(diseaseName) : 'NULL'},
            planned_duration_weeks = ${durationWeeks || 'NULL'},
            visit_frequency = ${escapeString(visitFrequency)},
            selected_programs = ${escapeString(JSON.stringify(selectedProgramsData))}::jsonb,
            notes = ${notes ? escapeString(notes) : 'NULL'},
            created_at = ${escapeString(planTimestamp)}::timestamptz,
            updated_at = NOW()
          WHERE id = ${existingPlan.id}
        `;
        console.log('[TreatmentPlanSetup] UPDATE SQL:', updateSql);
        await execute(updateSql);
        planId = existingPlan.id;
        console.log('[TreatmentPlanSetup] 수정 완료, planId:', planId);
      } else {
        // 신규 모드: INSERT 쿼리
        const insertSql = `
          INSERT INTO treatment_plans (
            patient_id,
            disease_name,
            planned_duration_weeks,
            visit_frequency,
            selected_programs,
            notes,
            status,
            created_at,
            updated_at
          ) VALUES (
            ${patientId},
            ${diseaseName ? escapeString(diseaseName) : 'NULL'},
            ${durationWeeks || 'NULL'},
            ${escapeString(visitFrequency)},
            ${escapeString(JSON.stringify(selectedProgramsData))}::jsonb,
            ${notes ? escapeString(notes) : 'NULL'},
            'active',
            ${escapeString(planTimestamp)}::timestamptz,
            NOW()
          )
        `;
        console.log('[TreatmentPlanSetup] INSERT SQL:', insertSql);
        planId = await insert(insertSql);
        console.log('[TreatmentPlanSetup] 저장 완료, planId:', planId);
      }

      const planData: Partial<TreatmentPlan> = {
        id: planId,
        patient_id: patientId,
        disease_name: diseaseName || undefined,
        planned_duration_weeks: durationWeeks || undefined,
        visit_frequency: visitFrequency,
        selected_programs: selectedProgramsData,
        notes: notes || undefined,
        status: 'active',
        created_at: new Date(`${planDate}T${planTime}:00`).toISOString(),
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
            <h2 className="text-lg font-bold text-gray-800">{isEditMode ? '진료계획 수정' : '새 진료 시작'}</h2>
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
          {/* 진료계획 날짜/시간 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              진료계획 일시
            </label>
            <div className="flex gap-3">
              <input
                type="date"
                value={planDate}
                onChange={(e) => setPlanDate(e.target.value)}
                className="w-44 px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-clinic-primary focus:border-clinic-primary"
              />
              <input
                type="time"
                value={planTime}
                onChange={(e) => setPlanTime(e.target.value)}
                className="w-36 px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-clinic-primary focus:border-clinic-primary"
              />
            </div>
          </div>

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
              {[
                { weeks: 4, label: '1개월' },
                { weeks: 12, label: '3개월' },
                { weeks: 26, label: '6개월~1년' },
                { weeks: 52, label: '1년이상' },
              ].map(({ weeks, label }) => (
                <button
                  key={weeks}
                  onClick={() => setDurationWeeks(durationWeeks === weeks ? null : weeks)}
                  className={`px-4 py-2 rounded-lg border transition-colors ${
                    durationWeeks === weeks
                      ? 'bg-clinic-primary text-white border-clinic-primary'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-clinic-primary'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* 내원 빈도 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              예상 내원 빈도
            </label>
            <div className="flex flex-wrap gap-2">
              {['미정', '15일', '30일', '3개월'].map(freq => (
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
              치료 프로그램 <span className="text-gray-400 font-normal">(복수 선택 가능)</span>
            </label>
            {programs.length === 0 ? (
              <div className="text-center py-6 bg-gray-50 rounded-lg">
                <p className="text-gray-500">등록된 치료 프로그램이 없습니다.</p>
                <p className="text-sm text-gray-400 mt-1">설정에서 프로그램을 추가해주세요.</p>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {programs.map(program => (
                  <button
                    key={program.id}
                    onClick={() => toggleProgram(program.id)}
                    className={`px-4 py-2 rounded-lg border transition-colors flex items-center gap-2 ${
                      selectedPrograms.includes(program.id)
                        ? 'bg-clinic-primary text-white border-clinic-primary'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-clinic-primary'
                    }`}
                  >
                    {selectedPrograms.includes(program.id) && (
                      <i className="fas fa-check text-sm"></i>
                    )}
                    <span className="font-medium">{program.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

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
