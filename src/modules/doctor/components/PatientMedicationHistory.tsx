import React, { useState, useEffect } from 'react';
import { query, execute } from '@shared/lib/postgres';

const POSTGRES_API = import.meta.env.VITE_POSTGRES_API_URL || 'http://192.168.0.48:3200';

interface Props {
  patientId: number;
  patientName: string;
  onClose: () => void;
  onViewDrug?: (drugName: string) => void;
}

interface MedicationRecord {
  id: number;
  treatment_plan_id: number;
  disease_name: string | null;
  note_date: string;
  medication_text: string;
  drug_names: string[];
  created_at: string;
}

const PatientMedicationHistory: React.FC<Props> = ({
  patientId,
  patientName,
  onClose,
  onViewDrug,
}) => {
  const [records, setRecords] = useState<MedicationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedPlans, setExpandedPlans] = useState<Set<number>>(new Set());

  useEffect(() => {
    loadHistory();
  }, [patientId]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const rows = await query<MedicationRecord>(
        `SELECT pm.id, pm.treatment_plan_id, tp.disease_name, pm.note_date::text, pm.medication_text, pm.drug_names, pm.created_at::text
         FROM patient_medications pm
         LEFT JOIN treatment_plans tp ON tp.id = pm.treatment_plan_id
         WHERE pm.patient_id = ${patientId}
         ORDER BY pm.note_date DESC, pm.id DESC`
      );
      setRecords(rows);

      // 모든 진료 펼치기
      const planIds = new Set(rows.map(r => r.treatment_plan_id));
      setExpandedPlans(planIds);
    } catch (e) {
      console.error('양약 이력 로드 실패:', e);
    } finally {
      setLoading(false);
    }
  };

  // 진료별 그룹핑
  const grouped = records.reduce((acc, rec) => {
    const key = rec.treatment_plan_id;
    if (!acc[key]) acc[key] = { diseaseName: rec.disease_name, records: [] };
    acc[key].records.push(rec);
    return acc;
  }, {} as Record<number, { diseaseName: string | null; records: MedicationRecord[] }>);

  // 전체 약물 목록 (고유값)
  const allDrugNames = [...new Set(records.flatMap(r => r.drug_names || []))].sort();

  const togglePlan = (planId: number) => {
    setExpandedPlans(prev => {
      const next = new Set(prev);
      if (next.has(planId)) next.delete(planId);
      else next.add(planId);
      return next;
    });
  };

  return (
    <div className="absolute inset-0 bg-white z-[35] flex flex-col overflow-hidden">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-5 py-3 border-b bg-gray-50 flex-shrink-0">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-gray-800">💊 {patientName} — 양약 이력</h3>
          <span className="text-xs text-gray-500">{records.length}건</span>
        </div>
        <button onClick={onClose} className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 rounded-lg text-sm font-medium text-gray-700">
          닫기
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* 좌측: 타임라인 */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center h-40 text-gray-400">로딩 중...</div>
          ) : records.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-400">
              <span className="text-3xl mb-2">💊</span>
              <span className="text-sm">등록된 양약 기록이 없습니다</span>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(grouped).map(([planIdStr, group]) => {
                const planId = Number(planIdStr);
                const isExpanded = expandedPlans.has(planId);
                return (
                  <div key={planId} className="border border-gray-200 rounded-lg overflow-hidden">
                    {/* 진료 헤더 */}
                    <button
                      onClick={() => togglePlan(planId)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs">{isExpanded ? '▼' : '▶'}</span>
                        <span className="font-medium text-sm text-gray-800">
                          {group.diseaseName || '진료'}
                        </span>
                        <span className="text-xs px-2 py-0.5 bg-teal-100 text-teal-700 rounded-full">
                          {group.records.length}건
                        </span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {group.records[group.records.length - 1]?.note_date?.split('T')[0]} ~ {group.records[0]?.note_date?.split('T')[0]}
                      </span>
                    </button>

                    {/* 약물 기록 */}
                    {isExpanded && (
                      <div className="divide-y divide-gray-100">
                        {group.records.map(rec => (
                          <div key={rec.id} className="px-4 py-3">
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="text-sm font-medium text-gray-600">
                                📅 {rec.note_date?.split('T')[0]}
                              </span>
                            </div>
                            <p className="text-sm text-gray-700 whitespace-pre-line mb-2">
                              {rec.medication_text}
                            </p>
                            {rec.drug_names?.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {rec.drug_names.map((name, i) => (
                                  <button
                                    key={i}
                                    onClick={() => onViewDrug?.(name)}
                                    className="px-2 py-0.5 bg-teal-50 text-teal-700 border border-teal-200 rounded text-xs hover:bg-teal-100 transition-colors cursor-pointer"
                                    title="양약사전에서 보기"
                                  >
                                    {name}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 우측: 전체 약물 요약 */}
        <div className="w-64 border-l border-gray-200 bg-gray-50 overflow-y-auto p-4 flex-shrink-0">
          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">전체 약물 목록</h4>
          {allDrugNames.length === 0 ? (
            <p className="text-xs text-gray-400">없음</p>
          ) : (
            <div className="space-y-1">
              {allDrugNames.map((name, i) => (
                <button
                  key={i}
                  onClick={() => onViewDrug?.(name)}
                  className="w-full text-left px-3 py-2 bg-white rounded-lg border border-gray-200 text-sm text-gray-700 hover:border-teal-400 hover:bg-teal-50 transition-colors"
                  title="양약사전에서 보기"
                >
                  💊 {name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PatientMedicationHistory;
