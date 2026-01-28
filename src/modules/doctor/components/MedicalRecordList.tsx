import React, { useState, useEffect } from 'react';
import { query } from '@shared/lib/postgres';

interface MedicalRecord {
  id: number;
  patient_id: number;
  chief_complaint: string;
  initial_date: string;
  medication_count: number;
  created_at: string;
  type: 'chart' | 'plan'; // 차트 or 계획
  disease_name?: string;
  visit_frequency?: string;
  planned_duration_weeks?: number;
}

interface Props {
  patientId: number;
  onSelectRecord: (recordId: number) => void;
  onSelectPlan?: (planId: number) => void;
}

const MedicalRecordList: React.FC<Props> = ({ patientId, onSelectRecord, onSelectPlan }) => {
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRecords();
  }, [patientId]);

  const loadRecords = async () => {
    try {
      setLoading(true);

      // 초진차트 가져오기
      const chartsData = await query<{
        id: number;
        patient_id: number;
        notes: string;
        chart_date: string;
        created_at: string;
      }>(`SELECT * FROM initial_charts WHERE patient_id = ${patientId} ORDER BY chart_date DESC`);

      // 진료 계획 가져오기 (초진차트와 연결되지 않은 것만)
      const plansData = await query<{
        id: number;
        patient_id: number;
        disease_name: string | null;
        visit_frequency: string;
        planned_duration_weeks: number | null;
        initial_chart_id: number | null;
        created_at: string;
      }>(`SELECT * FROM treatment_plans WHERE patient_id = ${patientId} AND initial_chart_id IS NULL ORDER BY created_at DESC`);

      // 초진차트 데이터 변환
      const chartRecords: MedicalRecord[] = (chartsData || []).map(chart => ({
        id: chart.id,
        patient_id: chart.patient_id,
        chief_complaint: extractChiefComplaint(chart.notes),
        initial_date: chart.chart_date,
        medication_count: 0,
        created_at: chart.created_at,
        type: 'chart' as const,
      }));

      // 진료 계획 데이터 변환
      const planRecords: MedicalRecord[] = (plansData || []).map(plan => ({
        id: plan.id,
        patient_id: plan.patient_id,
        chief_complaint: plan.disease_name || '(질환명 미입력)',
        initial_date: plan.created_at,
        medication_count: 0,
        created_at: plan.created_at,
        type: 'plan' as const,
        disease_name: plan.disease_name || undefined,
        visit_frequency: plan.visit_frequency,
        planned_duration_weeks: plan.planned_duration_weeks || undefined,
      }));

      // 날짜순으로 합쳐서 정렬
      const allRecords = [...chartRecords, ...planRecords].sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setRecords(allRecords);
    } catch (error) {
      console.error('진료기록 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  // 주소증 추출 함수 (notes에서 [주소증] 부분의 넘버링된 제목들만 추출)
  const extractChiefComplaint = (notes: string): string => {
    if (!notes) return '-';

    // [주소증] 섹션 찾기
    const sectionMatch = notes.match(/\[주소증\]\s*([^\[]+)/);
    if (!sectionMatch) return '-';

    const sectionText = sectionMatch[1].trim();
    const lines = sectionText.split('\n');

    // 넘버링된 항목들 추출 (1. 임신준비, 2. 비염 등)
    const numberedItems: string[] = [];

    for (const line of lines) {
      const numberedMatch = line.match(/^\d+\.\s*(.+)/);
      if (numberedMatch) {
        numberedItems.push(numberedMatch[1].trim());
      }
    }

    if (numberedItems.length === 0) return '-';

    // 항목들을 쉼표로 연결
    const result = numberedItems.join(', ');
    return result.length > 60 ? result.substring(0, 60) + '...' : result;
  };

  const handleClick = (record: MedicalRecord) => {
    if (record.type === 'chart') {
      onSelectRecord(record.id);
    } else if (onSelectPlan) {
      onSelectPlan(record.id);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="border-4 border-clinic-background border-t-clinic-primary rounded-full w-8 h-8 animate-spin"></div>
        <span className="ml-3 text-clinic-text-secondary">로딩 중...</span>
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="text-center py-12">
        <i className="fas fa-clipboard text-6xl text-gray-300 mb-4"></i>
        <p className="text-clinic-text-secondary">등록된 진료기록이 없습니다</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {records.map((record) => (
        <div
          key={`${record.type}-${record.id}`}
          onClick={() => handleClick(record)}
          className={`border rounded-lg p-4 cursor-pointer transition-all ${
            record.type === 'chart'
              ? 'bg-white border-gray-200 hover:shadow-md hover:border-clinic-primary'
              : 'bg-amber-50 border-amber-200 hover:shadow-md hover:border-amber-400'
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                {record.type === 'chart' ? (
                  <span className="bg-clinic-primary text-white px-3 py-1 rounded-full text-xs font-semibold">
                    {new Date(record.initial_date).toLocaleDateString('ko-KR')}
                  </span>
                ) : (
                  <span className="bg-amber-500 text-white px-3 py-1 rounded-full text-xs font-semibold">
                    진료계획
                  </span>
                )}
                {record.type === 'chart' && (
                  <span className="text-clinic-text-secondary text-sm">
                    복약 {record.medication_count}회
                  </span>
                )}
                {record.type === 'plan' && record.visit_frequency && (
                  <span className="text-amber-700 text-sm">
                    {record.visit_frequency}
                    {record.planned_duration_weeks && ` · ${record.planned_duration_weeks}주`}
                  </span>
                )}
              </div>
              <p className={`font-medium ${record.type === 'chart' ? 'text-clinic-text-primary' : 'text-amber-800'}`}>
                {record.chief_complaint}
              </p>
              {record.type === 'plan' && (
                <p className="text-xs text-amber-600 mt-1">
                  <i className="fas fa-info-circle mr-1"></i>
                  초진차트 작성 필요
                </p>
              )}
            </div>
            <i className={`fas fa-chevron-right ${record.type === 'chart' ? 'text-clinic-text-secondary' : 'text-amber-400'}`}></i>
          </div>
        </div>
      ))}
    </div>
  );
};

export default MedicalRecordList;
