/**
 * DosageList - 복용법 이력 및 신규 작성
 */
import React, { useState, useEffect } from 'react';
import { query, execute, escapeString, getCurrentTimestamp } from '@shared/lib/postgres';
import { useNavigate } from 'react-router-dom';

interface Props {
  patientId: number;
  treatmentPlanId?: number;
  patientName?: string;
  patientInfo?: {
    chartNumber?: string;
    dob?: string;
    gender?: string;
    age?: number;
  };
  onRefresh?: () => void;
}

interface DosageRecord {
  id: number;
  formula: string;
  dosage_instruction_created: boolean;
  dosage_instruction_created_at: string;
  dosage_instruction_data: any;
  prescription_issued: boolean;
  created_at: string;
  patient_name: string;
}

const DosageList: React.FC<Props> = ({ patientId, treatmentPlanId, patientName, patientInfo, onRefresh }) => {
  const navigate = useNavigate();
  const [records, setRecords] = useState<DosageRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRecords();
  }, [patientId]);

  const loadRecords = async () => {
    try {
      setLoading(true);
      const data = await query<DosageRecord>(
        `SELECT id, formula, dosage_instruction_created, dosage_instruction_created_at, 
                dosage_instruction_data, prescription_issued, created_at, patient_name
         FROM prescriptions
         WHERE patient_id = ${patientId}
         ORDER BY created_at DESC`
      );
      setRecords(data || []);
    } catch (error) {
      console.error('복용법 목록 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDosage = (rx: DosageRecord) => {
    // 복용법 작성 페이지로 이동
    navigate('/doctor/dosage/create', {
      state: {
        prescriptionId: rx.id,
        patientName: rx.patient_name || patientName,
        patientAge: patientInfo?.age,
        patientGender: patientInfo?.gender,
        formula: rx.formula,
      }
    });
  };

  const handlePrintDosage = (rx: DosageRecord) => {
    window.open(`/doctor/dosage/${rx.id}/print`, '_blank');
  };

  if (loading) {
    return <div className="text-center py-8 text-gray-500"><i className="fas fa-spinner fa-spin mr-2"></i>로딩 중...</div>;
  }

  return (
    <div className="space-y-4">
      {records.length === 0 ? (
        <div className="text-center py-12">
          <i className="fas fa-pills text-5xl text-gray-300 mb-4"></i>
          <p className="text-gray-500">처방 기록이 없습니다</p>
          <p className="text-sm text-gray-400 mt-1">처방전을 먼저 발급해주세요</p>
        </div>
      ) : (
        records.map(rx => (
          <div key={rx.id} className="border rounded-lg p-4 bg-white">
            <div className="flex items-start justify-between mb-2">
              <div>
                <span className="font-semibold text-gray-800">{rx.formula || '처방명 없음'}</span>
              </div>
              <div className="flex gap-1">
                {rx.dosage_instruction_created ? (
                  <>
                    <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded font-medium">
                      <i className="fas fa-check mr-1"></i>작성완료
                    </span>
                    <button
                      onClick={() => handlePrintDosage(rx)}
                      className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded hover:bg-gray-200 transition-colors"
                    >
                      <i className="fas fa-print mr-1"></i>인쇄
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => handleCreateDosage(rx)}
                    className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition-colors"
                  >
                    <i className="fas fa-edit mr-1"></i>복용법 작성
                  </button>
                )}
              </div>
            </div>
            <div className="flex gap-4 text-sm text-gray-600">
              <span><i className="fas fa-clock mr-1"></i>{new Date(rx.created_at).toLocaleDateString('ko-KR')}</span>
              {!rx.prescription_issued && (
                <span className="text-amber-600"><i className="fas fa-exclamation-triangle mr-1"></i>처방전 미발급</span>
              )}
            </div>
            {rx.dosage_instruction_created_at && (
              <div className="mt-1 text-xs text-gray-400">
                복용법 작성: {new Date(rx.dosage_instruction_created_at).toLocaleString('ko-KR')}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
};

export default DosageList;
