import React, { useState, useEffect } from 'react';
import { query } from '@shared/lib/postgres';

interface MedicalRecord {
  id: number;
  patient_id: number;
  chief_complaint: string;
  initial_date: string;
  medication_count: number;
  created_at: string;
}

interface Props {
  patientId: number;
  onSelectRecord: (recordId: number) => void;
}

const MedicalRecordList: React.FC<Props> = ({ patientId, onSelectRecord }) => {
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRecords();
  }, [patientId]);

  const loadRecords = async () => {
    try {
      setLoading(true);
      // 초진차트에서 진료기록 가져오기 - SQLite
      const data = await query<{
        id: number;
        patient_id: number;
        notes: string;
        chart_date: string;
        created_at: string;
      }>(`SELECT * FROM initial_charts WHERE patient_id = ${patientId} ORDER BY chart_date DESC`);

      // 데이터 변환 (초진차트를 진료기록으로 사용)
      // initial_date는 실제 진료일자(chart_date)를 사용
      const recordsData: MedicalRecord[] = (data || []).map(chart => ({
        id: chart.id,
        patient_id: chart.patient_id,
        chief_complaint: extractChiefComplaint(chart.notes),
        initial_date: chart.chart_date, // 실제 진료일자
        medication_count: 0, // TODO: 복약 횟수 계산
        created_at: chart.created_at // 차트 생성일자
      }));

      setRecords(recordsData);
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
          key={record.id}
          onClick={() => onSelectRecord(record.id)}
          className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md hover:border-clinic-primary cursor-pointer transition-all"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="bg-clinic-primary text-white px-3 py-1 rounded-full text-xs font-semibold">
                  {new Date(record.initial_date).toLocaleDateString('ko-KR')}
                </span>
                <span className="text-clinic-text-secondary text-sm">
                  복약 {record.medication_count}회
                </span>
              </div>
              <p className="text-clinic-text-primary font-medium">
                {record.chief_complaint}
              </p>
            </div>
            <i className="fas fa-chevron-right text-clinic-text-secondary"></i>
          </div>
        </div>
      ))}
    </div>
  );
};

export default MedicalRecordList;
