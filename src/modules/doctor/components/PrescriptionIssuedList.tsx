/**
 * PrescriptionIssuedList - 처방전 발급 이력 및 신규 발급
 */
import React, { useState, useEffect } from 'react';
import { query, execute, escapeString, getCurrentTimestamp } from '@shared/lib/postgres';

interface Props {
  patientId: number;
  treatmentPlanId?: number;
  onIssuePrescription?: (sourceType: 'initial_chart' | 'progress_note', sourceId: number, formula: string) => void;
  onRefresh?: () => void;
}

interface IssuedPrescription {
  id: number;
  formula: string;
  days: number;
  packs: number;
  total_amount: number;
  status: string;
  source_type: string;
  source_id: number;
  prescription_issued: boolean;
  prescription_issued_at: string;
  dosage_instruction_created: boolean;
  dosage_instruction_created_at: string;
  created_at: string;
  prescription_number: string;
}

const PrescriptionIssuedList: React.FC<Props> = ({ patientId, treatmentPlanId, onIssuePrescription, onRefresh }) => {
  const [prescriptions, setPrescriptions] = useState<IssuedPrescription[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPrescriptions();
  }, [patientId, treatmentPlanId]);

  const loadPrescriptions = async () => {
    try {
      setLoading(true);
      const data = await query<IssuedPrescription>(
        `SELECT * FROM prescriptions
         WHERE patient_id = ${patientId}
         ORDER BY created_at DESC`
      );
      setPrescriptions(data || []);
    } catch (error) {
      console.error('처방전 목록 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkPrinted = async (id: number) => {
    const now = getCurrentTimestamp();
    await execute(`UPDATE prescriptions SET prescription_issued = true, prescription_issued_at = ${escapeString(now)} WHERE id = ${id}`);

    // 업무대기(DoctorTaskSidebar)의 처방전 대기건 자동 완료
    // initial_charts / progress_notes의 prescription_issued도 업데이트
    const rx = prescriptions.find(p => p.id === id);
    if (rx) {
      if (rx.source_type === 'initial_chart' && rx.source_id) {
        await execute(`UPDATE initial_charts SET prescription_issued = true, prescription_issued_at = ${escapeString(now)} WHERE id = ${rx.source_id}`);
      } else if (rx.source_type === 'progress_note' && rx.source_id) {
        await execute(`UPDATE progress_notes SET prescription_issued = true, prescription_issued_at = ${escapeString(now)} WHERE id = ${rx.source_id}`);
      }
    }

    await loadPrescriptions();
    onRefresh?.();
  };

  const handlePrint = (id: number) => {
    // 인쇄 기능 - 처방전 인쇄 페이지로 이동 또는 window.print()
    window.open(`/doctor/prescriptions/${id}/print`, '_blank');
  };

  if (loading) {
    return <div className="text-center py-8 text-gray-500"><i className="fas fa-spinner fa-spin mr-2"></i>로딩 중...</div>;
  }

  return (
    <div className="space-y-4">
      {prescriptions.length === 0 ? (
        <div className="text-center py-12">
          <i className="fas fa-file-prescription text-5xl text-gray-300 mb-4"></i>
          <p className="text-gray-500">발급된 처방전이 없습니다</p>
        </div>
      ) : (
        prescriptions.map(rx => (
          <div key={rx.id} className="border rounded-lg p-4 bg-white">
            <div className="flex items-start justify-between mb-2">
              <div>
                <span className="font-semibold text-gray-800">{rx.formula || '처방명 없음'}</span>
                {rx.prescription_number && (
                  <span className="ml-2 text-xs text-gray-500">#{rx.prescription_number}</span>
                )}
              </div>
              <div className="flex gap-1">
                {rx.prescription_issued ? (
                  <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded font-medium">
                    <i className="fas fa-check mr-1"></i>발급완료
                  </span>
                ) : (
                  <button
                    onClick={() => handleMarkPrinted(rx.id)}
                    className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
                  >
                    <i className="fas fa-print mr-1"></i>발급확인
                  </button>
                )}
                {rx.dosage_instruction_created ? (
                  <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded font-medium">
                    <i className="fas fa-check mr-1"></i>복용법완료
                  </span>
                ) : null}
              </div>
            </div>
            <div className="flex gap-4 text-sm text-gray-600">
              {rx.days && <span><i className="fas fa-calendar mr-1"></i>{rx.days}일분</span>}
              {rx.packs && <span><i className="fas fa-box mr-1"></i>{rx.packs}팩</span>}
              <span><i className="fas fa-clock mr-1"></i>{new Date(rx.created_at).toLocaleDateString('ko-KR')}</span>
            </div>
            {rx.prescription_issued_at && (
              <div className="mt-1 text-xs text-gray-400">
                발급: {new Date(rx.prescription_issued_at).toLocaleString('ko-KR')}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
};

export default PrescriptionIssuedList;
