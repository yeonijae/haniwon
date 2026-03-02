/**
 * TreatmentPlanSetup
 * 새 진료 시작 시 치료 계획 설정 모달
 */

import { useState, useEffect, useCallback } from 'react';
import { query, insert, execute, escapeString } from '@shared/lib/postgres';
import type { TreatmentPlan } from '../types';
import DiseaseTagInput from './DiseaseTagInput';

interface TreatmentPlanSetupProps {
  patientId: number;
  patientName: string;
  existingPlan?: Partial<TreatmentPlan>;
  onCreateChart: (plan: Partial<TreatmentPlan>) => void;
  onSave?: (plan: Partial<TreatmentPlan>) => void;
  onClose: () => void;
}

const CONSULTATION_TYPES = ['약초진', '연복', '재초진', '점검', '마무리'] as const;
const DURATION_OPTIONS = [
  { label: '15일', weeks: 2 },
  { label: '1개월', weeks: 4 },
  { label: '3개월', weeks: 12 },
  { label: '6개월', weeks: 26 },
  { label: '1년', weeks: 52 },
  { label: '1년이상', weeks: 104 },
] as const;
const VISIT_PATTERNS = ['15일', '30일'] as const;
const NOKRYONG_OPTIONS = ['녹용필수', '녹용권유', '녹용배제', '언급없음'] as const;

// 주 → 라벨 역매핑
const weeksToLabel = (weeks: number | null | undefined): string | null => {
  if (!weeks) return null;
  const found = DURATION_OPTIONS.find(d => d.weeks === weeks);
  return found?.label || null;
};

const ToggleGroup: React.FC<{
  options: readonly string[];
  value: string | null;
  onChange: (v: string) => void;
}> = ({ options, value, onChange }) => (
  <div className="flex flex-wrap gap-2">
    {options.map(opt => (
      <button
        key={opt}
        type="button"
        onClick={() => onChange(opt)}
        className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
          value === opt
            ? 'bg-blue-500 text-white border-blue-500'
            : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
        }`}
      >
        {opt}
      </button>
    ))}
  </div>
);

const TreatmentPlanSetup: React.FC<TreatmentPlanSetupProps> = ({
  patientId,
  patientName,
  existingPlan,
  onCreateChart,
  onSave,
  onClose,
}) => {
  const isEditMode = !!existingPlan?.id;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [consultationType, setConsultationType] = useState(existingPlan?.consultation_type || '약초진');
  const [treatmentPurpose, setTreatmentPurpose] = useState(existingPlan?.treatment_purpose || '');
  const [purposeOptions, setPurposeOptions] = useState<string[]>([]);
  const [diseaseTags, setDiseaseTags] = useState<string[]>(
    (existingPlan as any)?.disease_names || (existingPlan?.disease_name ? [existingPlan.disease_name] : [])
  );
  const [durationLabel, setDurationLabel] = useState<string | null>(
    weeksToLabel(existingPlan?.planned_duration_weeks) || null
  );
  const [visitFrequency, setVisitFrequency] = useState(existingPlan?.visit_frequency || '30일');
  const [nokryong, setNokryong] = useState(existingPlan?.nokryong_recommendation || '언급없음');
  const [planDate, setPlanDate] = useState(() => {
    const toLocalDate = (date: Date) => {
      return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
    };
    if (existingPlan?.created_at) {
      try {
        const d = new Date(existingPlan.created_at);
        if (!isNaN(d.getTime())) {
          return toLocalDate(d);
        }
      } catch {}
    }
    return toLocalDate(new Date());
  });

  // Schema migration + load purposes
  const initialize = useCallback(async () => {
    try {
      // ALTER TABLE for new columns
      await execute(`ALTER TABLE treatment_plans ADD COLUMN IF NOT EXISTS consultation_type TEXT DEFAULT '약초진'`);
      await execute(`ALTER TABLE treatment_plans ADD COLUMN IF NOT EXISTS treatment_purpose TEXT`);
      await execute(`ALTER TABLE treatment_plans ADD COLUMN IF NOT EXISTS nokryong_recommendation TEXT DEFAULT '언급없음'`);

      // Load herbal_purposes from cs_settings
      const result = await query<{ value: string }>(`SELECT value FROM cs_settings WHERE key = 'herbal_purposes'`);
      const purposes: string[] = result?.[0]?.value ? JSON.parse(result[0].value) : [];
      setPurposeOptions(purposes);
    } catch (error) {
      console.error('[TreatmentPlanSetup] 초기화 실패:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    initialize();
  }, [initialize]);

  const getDurationWeeks = (): number | null => {
    if (!durationLabel) return null;
    const found = DURATION_OPTIONS.find(d => d.label === durationLabel);
    return found?.weeks || null;
  };

  const handleSave = async (proceedToChart: boolean) => {
    setSaving(true);
    try {
      const durationWeeks = getDurationWeeks();
      const diseaseNameStr = diseaseTags.join(', ') || null;
      const diseaseNamesArr = diseaseTags.length > 0
        ? `ARRAY[${diseaseTags.map(t => `'${t.replace(/'/g, "''")}'`).join(',')}]`
        : 'NULL';

      let planId: number;

      if (isEditMode && existingPlan?.id) {
        const updateSql = `
          UPDATE treatment_plans SET
            consultation_type = ${escapeString(consultationType)},
            treatment_purpose = ${treatmentPurpose ? escapeString(treatmentPurpose) : 'NULL'},
            disease_name = ${diseaseNameStr ? escapeString(diseaseNameStr) : 'NULL'},
            disease_names = ${diseaseNamesArr},
            planned_duration_weeks = ${durationWeeks || 'NULL'},
            visit_frequency = ${escapeString(visitFrequency)},
            nokryong_recommendation = ${escapeString(nokryong)},
            created_at = ${escapeString(planDate + 'T00:00:00')}::timestamptz,
            updated_at = NOW()
          WHERE id = ${existingPlan.id}
        `;
        await execute(updateSql);
        planId = existingPlan.id;
      } else {
        const insertSql = `
          INSERT INTO treatment_plans (
            patient_id, consultation_type, treatment_purpose,
            disease_name, disease_names, planned_duration_weeks,
            visit_frequency, nokryong_recommendation,
            selected_programs, status, created_at, updated_at
          ) VALUES (
            ${patientId},
            ${escapeString(consultationType)},
            ${treatmentPurpose ? escapeString(treatmentPurpose) : 'NULL'},
            ${diseaseNameStr ? escapeString(diseaseNameStr) : 'NULL'},
            ${diseaseNamesArr},
            ${durationWeeks || 'NULL'},
            ${escapeString(visitFrequency)},
            ${escapeString(nokryong)},
            '[]'::jsonb,
            'active',
            ${escapeString(planDate + 'T00:00:00')}::timestamptz,
            NOW()
          )
        `;
        await execute(insertSql);
        // INSERT 후 ID 조회
        const inserted = await query<{ id: number }>(
          `SELECT id FROM treatment_plans WHERE patient_id = ${patientId} ORDER BY id DESC LIMIT 1`
        );
        planId = inserted?.[0]?.id || 0;
      }

      const planData: Partial<TreatmentPlan> = {
        id: planId,
        patient_id: patientId,
        consultation_type: consultationType,
        treatment_purpose: treatmentPurpose || undefined,
        disease_name: diseaseTags.join(', ') || undefined,
        planned_duration_weeks: durationWeeks || undefined,
        visit_frequency: visitFrequency,
        nokryong_recommendation: nokryong,
        selected_programs: [],
        status: 'active',
        created_at: new Date(planDate + 'T00:00:00').toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (proceedToChart) {
        onCreateChart(planData);
      } else {
        if (onSave) {
          onSave(planData);
        } else {
          onClose();
        }
      }
    } catch (error) {
      console.error('[TreatmentPlanSetup] 저장 실패:', error);
      alert('진료 계획 저장에 실패했습니다.\n' + (error instanceof Error ? error.message : String(error)));
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
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* 헤더 */}
        <div className="flex-shrink-0 px-6 py-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-800">
            {`진료카드 작성 - ${patientName}`}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <i className="fas fa-times text-xl"></i>
          </button>
        </div>

        {/* 컨텐츠 */}
        <div className="flex-1 overflow-auto p-6 space-y-5">
          {/* 작성일 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">작성일</label>
            <div className="relative">
              <input
                type="date"
                value={planDate}
                onChange={(e) => setPlanDate(e.target.value)}
                className="absolute opacity-0 w-0 h-0"
                id="plan-date-picker"
              />
              <button
                type="button"
                onClick={() => {
                  const el = document.getElementById('plan-date-picker') as HTMLInputElement;
                  el?.showPicker?.();
                }}
                className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm text-gray-800"
              >
                <i className="fas fa-calendar-alt mr-2 text-blue-500"></i>
                {(() => {
                  const d = new Date(planDate + 'T00:00:00');
                  const days = ['일', '월', '화', '수', '목', '금', '토'];
                  return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}(${days[d.getDay()]})`;
                })()}
              </button>
            </div>
          </div>

          {/* 상담유형 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">상담유형</label>
            <ToggleGroup options={CONSULTATION_TYPES} value={consultationType} onChange={setConsultationType} />
          </div>

          {/* 치료목적 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">치료목적</label>
            <select
              value={treatmentPurpose}
              onChange={(e) => setTreatmentPurpose(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            >
              <option value="">선택</option>
              {purposeOptions.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {/* 질환명 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">질환명</label>
            <DiseaseTagInput
              value={diseaseTags}
              onChange={setDiseaseTags}
              placeholder="질환명 입력 후 Enter"
            />
          </div>

          {/* 치료기간 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">치료기간</label>
            <ToggleGroup
              options={DURATION_OPTIONS.map(d => d.label)}
              value={durationLabel}
              onChange={setDurationLabel}
            />
          </div>

          {/* 내원패턴 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">내원패턴</label>
            <ToggleGroup options={VISIT_PATTERNS} value={visitFrequency} onChange={setVisitFrequency} />
          </div>

          {/* 녹용권유 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">녹용권유</label>
            <ToggleGroup options={NOKRYONG_OPTIONS} value={nokryong} onChange={setNokryong} />
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
        </div>
      </div>
    </div>
  );
};

export default TreatmentPlanSetup;
