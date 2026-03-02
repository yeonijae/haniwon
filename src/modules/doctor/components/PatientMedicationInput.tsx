import React, { useState, useEffect } from 'react';
import { execute, query, queryOne } from '@shared/lib/postgres';

const POSTGRES_API = import.meta.env.VITE_POSTGRES_API_URL || 'http://192.168.0.48:3200';

interface Props {
  patientId: number;
  patientName: string;
  treatmentPlanId: number;
  chartId?: number;
  noteDate?: string;
  onClose: () => void;
  onSaved?: () => void;
}

interface ExistingMedication {
  id: number;
  medication_text: string;
  drug_names: string[];
  note_date: string;
  created_at: string;
}

const PatientMedicationInput: React.FC<Props> = ({
  patientId,
  patientName,
  treatmentPlanId,
  chartId,
  noteDate,
  onClose,
  onSaved,
}) => {
  const [medicationText, setMedicationText] = useState('');
  const [date, setDate] = useState(noteDate || new Date().toISOString().split('T')[0]);
  const [saving, setSaving] = useState(false);
  const [existing, setExisting] = useState<ExistingMedication[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);

  // DB 테이블 생성
  useEffect(() => {
    execute(`
      CREATE TABLE IF NOT EXISTS patient_medications (
        id SERIAL PRIMARY KEY,
        patient_id INTEGER NOT NULL,
        treatment_plan_id INTEGER NOT NULL,
        chart_id INTEGER,
        note_date DATE NOT NULL,
        medication_text TEXT NOT NULL,
        drug_names TEXT[] DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `).catch(() => {});
  }, []);

  // 기존 데이터 로드
  useEffect(() => {
    loadExisting();
  }, [treatmentPlanId]);

  const loadExisting = async () => {
    try {
      const rows = await query<ExistingMedication>(
        `SELECT id, medication_text, drug_names, note_date::text, created_at::text
         FROM patient_medications
         WHERE treatment_plan_id = ${treatmentPlanId}
         ORDER BY note_date DESC, id DESC`
      );
      setExisting(rows);
    } catch (e) {
      console.error('양약 로드 실패:', e);
    }
  };

  // 약 이름 파싱 (줄바꿈, 쉼표, 공백 구분)
  const parseDrugNames = (text: string): string[] => {
    return text
      .split(/[\n,;·•]+/)
      .map(s => s.replace(/^[-\s·•]+/, '').trim())
      .filter(s => s.length > 0);
  };

  // AI 연구 요청 (DB에 없는 약물)
  const requestAiForMissing = async (names: string[]) => {
    for (const name of names) {
      try {
        // 위키에 존재하는지 확인
        const res = await fetch(`${POSTGRES_API}/api/wiki/drugs/ai-status/${encodeURIComponent(name)}`);
        const data = await res.json();
        if (data.status === 'not_found') {
          // 신규 등록 + AI 요청
          await fetch(`${POSTGRES_API}/api/wiki/drugs/request`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, category: '약물' }),
          });
          await fetch(`${POSTGRES_API}/api/wiki/drugs/ai-research`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name }),
          });
        }
      } catch (e) {
        console.error(`AI 요청 실패 (${name}):`, e);
      }
    }
  };

  const handleSave = async () => {
    if (!medicationText.trim()) return;
    setSaving(true);

    try {
      const drugNames = parseDrugNames(medicationText);
      const drugNamesArray = `ARRAY[${drugNames.map(n => `'${n.replace(/'/g, "''")}'`).join(',')}]::TEXT[]`;
      const escapedText = medicationText.replace(/'/g, "''");

      if (editingId) {
        await execute(
          `UPDATE patient_medications SET medication_text = '${escapedText}', drug_names = ${drugNamesArray}, note_date = '${date}', updated_at = NOW() WHERE id = ${editingId}`
        );
      } else {
        await execute(
          `INSERT INTO patient_medications (patient_id, treatment_plan_id, chart_id, note_date, medication_text, drug_names)
           VALUES (${patientId}, ${treatmentPlanId}, ${chartId || 'NULL'}, '${date}', '${escapedText}', ${drugNamesArray})`
        );
      }

      // DB에 없는 약물 AI 자동 생성
      requestAiForMissing(drugNames);

      setMedicationText('');
      setEditingId(null);
      await loadExisting();
      onSaved?.();
    } catch (e) {
      console.error('양약 저장 실패:', e);
      alert('저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (med: ExistingMedication) => {
    setEditingId(med.id);
    setMedicationText(med.medication_text);
    setDate(med.note_date?.split('T')[0] || new Date().toISOString().split('T')[0]);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('삭제하시겠습니까?')) return;
    try {
      await execute(`DELETE FROM patient_medications WHERE id = ${id}`);
      await loadExisting();
    } catch (e) {
      console.error('삭제 실패:', e);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-3 border-b bg-gray-50 rounded-t-xl">
          <div>
            <h3 className="font-semibold text-gray-800">💊 양약 입력</h3>
            <span className="text-xs text-gray-500">{patientName}</span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
        </div>

        {/* 입력 영역 */}
        <div className="p-5 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">날짜</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">복용 중인 양약</label>
            <textarea
              value={medicationText}
              onChange={e => setMedicationText(e.target.value)}
              placeholder="약 이름을 줄바꿈 또는 쉼표로 구분하여 입력&#10;예:&#10;아스피린 100mg&#10;리피토정 20mg&#10;트윈스타정"
              className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none"
              rows={5}
              autoFocus
            />
            <p className="text-xs text-gray-400 mt-1">
              약 이름만 입력하면 양약사전과 자동 연결됩니다. DB에 없는 약물은 AI가 자동 추가합니다.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            {editingId && (
              <button
                onClick={() => { setEditingId(null); setMedicationText(''); }}
                className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                취소
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={saving || !medicationText.trim()}
              className="px-4 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 font-medium"
            >
              {saving ? '저장 중...' : editingId ? '수정' : '저장'}
            </button>
          </div>
        </div>

        {/* 기존 입력 목록 */}
        {existing.length > 0 && (
          <div className="border-t px-5 py-3 flex-1 overflow-y-auto">
            <h4 className="text-xs font-semibold text-gray-500 mb-2">이 진료의 양약 기록</h4>
            <div className="space-y-2">
              {existing.map(med => (
                <div key={med.id} className="bg-gray-50 rounded-lg p-3 text-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-500">
                      {med.note_date?.split('T')[0]}
                    </span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleEdit(med)}
                        className="text-xs text-blue-600 hover:text-blue-800"
                      >
                        수정
                      </button>
                      <button
                        onClick={() => handleDelete(med.id)}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                  <p className="text-gray-700 whitespace-pre-line">{med.medication_text}</p>
                  {med.drug_names?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {med.drug_names.map((name, i) => (
                        <span key={i} className="px-1.5 py-0.5 bg-teal-100 text-teal-700 rounded text-xs">
                          {name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PatientMedicationInput;
