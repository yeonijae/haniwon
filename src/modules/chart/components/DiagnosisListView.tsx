import React, { useState, useEffect } from 'react';
import { query, execute, insert, escapeString, toSqlValue, getCurrentTimestamp } from '@shared/lib/postgres';
import type { Diagnosis, DiagnosisStatus, Severity } from '../types';

interface Props {
  patientId: number;
  patientName: string;
  onClose: () => void;
}

const DiagnosisListView: React.FC<Props> = ({ patientId, patientName, onClose }) => {
  const [diagnoses, setDiagnoses] = useState<Diagnosis[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingDiagnosis, setEditingDiagnosis] = useState<Diagnosis | null>(null);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState<Partial<Diagnosis>>({
    diagnosis_name: '',
    status: 'active',
    severity: 'moderate'
  });

  useEffect(() => {
    loadDiagnoses();
  }, [patientId]);

  const loadDiagnoses = async () => {
    try {
      setLoading(true);
      const data = await query<Diagnosis>(
        `SELECT * FROM diagnoses WHERE patient_id = ${patientId} ORDER BY diagnosis_date DESC`
      );
      setDiagnoses(data || []);
    } catch (error) {
      console.error('진단기록 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const now = getCurrentTimestamp();
      const diagnosisDate = formData.diagnosis_date || new Date().toISOString().split('T')[0];

      if (editingDiagnosis) {
        await execute(`
          UPDATE diagnoses SET
            diagnosis_name = ${escapeString(formData.diagnosis_name || '')},
            icd_code = ${toSqlValue(formData.icd_code)},
            status = ${escapeString(formData.status || 'active')},
            severity = ${toSqlValue(formData.severity)},
            notes = ${toSqlValue(formData.notes)},
            updated_at = ${escapeString(now)}
          WHERE id = ${editingDiagnosis.id}
        `);
        alert('진단기록이 수정되었습니다');
      } else {
        await insert(`
          INSERT INTO diagnoses (patient_id, diagnosis_name, icd_code, diagnosis_date, status, severity, notes, created_at, updated_at)
          VALUES (
            ${patientId},
            ${escapeString(formData.diagnosis_name || '')},
            ${toSqlValue(formData.icd_code)},
            ${escapeString(diagnosisDate)},
            ${escapeString(formData.status || 'active')},
            ${toSqlValue(formData.severity)},
            ${toSqlValue(formData.notes)},
            ${escapeString(now)},
            ${escapeString(now)}
          )
        `);
        alert('진단기록이 추가되었습니다');
      }

      setShowForm(false);
      setEditingDiagnosis(null);
      resetForm();
      loadDiagnoses();
    } catch (error: any) {
      console.error('저장 실패:', error);
      alert('저장에 실패했습니다: ' + error.message);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('이 진단기록을 삭제하시겠습니까?')) return;

    try {
      await execute(`DELETE FROM diagnoses WHERE id = ${id}`);
      alert('진단기록이 삭제되었습니다');
      loadDiagnoses();
    } catch (error: any) {
      console.error('삭제 실패:', error);
      alert('삭제에 실패했습니다: ' + error.message);
    }
  };

  const handleEdit = (diagnosis: Diagnosis) => {
    setEditingDiagnosis(diagnosis);
    setFormData(diagnosis);
    setShowForm(true);
  };

  const resetForm = () => {
    setFormData({
      diagnosis_name: '',
      status: 'active',
      severity: 'moderate'
    });
  };

  const getStatusBadge = (status: DiagnosisStatus) => {
    const colors: Record<DiagnosisStatus, string> = {
      active: 'bg-red-500',
      resolved: 'bg-green-500',
      chronic: 'bg-yellow-500',
      'ruled-out': 'bg-gray-500'
    };
    const labels: Record<DiagnosisStatus, string> = {
      active: '활성',
      resolved: '완치',
      chronic: '만성',
      'ruled-out': '배제'
    };
    return <span className={`px-2 py-1 text-xs text-white rounded ${colors[status]}`}>{labels[status]}</span>;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-6xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b p-4 flex justify-between items-center">
          <h2 className="text-2xl font-bold">진단기록 - {patientName}</h2>
          <div className="flex gap-2">
            <button
              onClick={() => {
                resetForm();
                setEditingDiagnosis(null);
                setShowForm(!showForm);
              }}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              {showForm ? '취소' : '+ 진단 추가'}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              닫기
            </button>
          </div>
        </div>

        <div className="p-6">
          {showForm && (
            <div className="bg-gray-50 p-4 rounded mb-4">
              <h3 className="font-bold mb-3">{editingDiagnosis ? '진단 수정' : '진단 추가'}</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block mb-1 text-sm font-semibold">진단명 *</label>
                  <input
                    type="text"
                    value={formData.diagnosis_name || ''}
                    onChange={(e) => setFormData({ ...formData, diagnosis_name: e.target.value })}
                    className="w-full border rounded p-2"
                    required
                  />
                </div>
                <div>
                  <label className="block mb-1 text-sm font-semibold">ICD 코드</label>
                  <input
                    type="text"
                    value={formData.icd_code || ''}
                    onChange={(e) => setFormData({ ...formData, icd_code: e.target.value })}
                    className="w-full border rounded p-2"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-sm font-semibold">상태</label>
                  <select
                    value={formData.status || 'active'}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as DiagnosisStatus })}
                    className="w-full border rounded p-2"
                  >
                    <option value="active">활성</option>
                    <option value="chronic">만성</option>
                    <option value="resolved">완치</option>
                    <option value="ruled-out">배제</option>
                  </select>
                </div>
                <div>
                  <label className="block mb-1 text-sm font-semibold">심각도</label>
                  <select
                    value={formData.severity || 'moderate'}
                    onChange={(e) => setFormData({ ...formData, severity: e.target.value as Severity })}
                    className="w-full border rounded p-2"
                  >
                    <option value="mild">경증</option>
                    <option value="moderate">중등도</option>
                    <option value="severe">중증</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block mb-1 text-sm font-semibold">비고</label>
                  <textarea
                    value={formData.notes || ''}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full border rounded p-2"
                    rows={2}
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={handleSave} className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600">
                  저장
                </button>
                <button
                  onClick={() => {
                    setShowForm(false);
                    setEditingDiagnosis(null);
                    resetForm();
                  }}
                  className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                >
                  취소
                </button>
              </div>
            </div>
          )}

          <div>
            <h3 className="font-bold mb-2">진단 목록 ({diagnoses.length}건)</h3>
            {loading ? (
              <p>로딩 중...</p>
            ) : diagnoses.length === 0 ? (
              <p className="text-gray-500">진단기록이 없습니다.</p>
            ) : (
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border p-2 text-left">진단명</th>
                    <th className="border p-2 text-left">ICD</th>
                    <th className="border p-2 text-center">상태</th>
                    <th className="border p-2 text-center">심각도</th>
                    <th className="border p-2 text-center">진단일</th>
                    <th className="border p-2 text-center">작업</th>
                  </tr>
                </thead>
                <tbody>
                  {diagnoses.map((diagnosis) => (
                    <tr key={diagnosis.id}>
                      <td className="border p-2">{diagnosis.diagnosis_name}</td>
                      <td className="border p-2">{diagnosis.icd_code || '-'}</td>
                      <td className="border p-2 text-center">{getStatusBadge(diagnosis.status)}</td>
                      <td className="border p-2 text-center">{diagnosis.severity || '-'}</td>
                      <td className="border p-2 text-center">
                        {new Date(diagnosis.diagnosis_date).toLocaleDateString('ko-KR')}
                      </td>
                      <td className="border p-2 text-center">
                        <button
                          onClick={() => handleEdit(diagnosis)}
                          className="px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 mr-1"
                        >
                          수정
                        </button>
                        <button
                          onClick={() => handleDelete(diagnosis.id)}
                          className="px-2 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600"
                        >
                          삭제
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DiagnosisListView;
