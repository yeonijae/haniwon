import React, { useState, useEffect } from 'react';
import { query, execute, insert, escapeString, toSqlValue, getCurrentTimestamp } from '@shared/lib/postgres';
import type { ProgressNote } from '../types';

interface Props {
  patientId: number;
  patientName: string;
  treatmentPlanId?: number; // 연결된 진료계획 ID (선택적)
  onClose: () => void;
}

const ProgressNoteView: React.FC<Props> = ({ patientId, patientName, treatmentPlanId, onClose }) => {
  const [notes, setNotes] = useState<ProgressNote[]>([]);
  const [selectedNote, setSelectedNote] = useState<ProgressNote | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingNote, setEditingNote] = useState<ProgressNote | null>(null);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState<Partial<ProgressNote>>({
    subjective: '',
    objective: '',
    assessment: '',
    plan: '',
    follow_up_plan: '',
    notes: ''
  });

  useEffect(() => {
    loadNotes();
  }, [patientId]);

  const loadNotes = async () => {
    try {
      setLoading(true);
      const data = await query<ProgressNote>(
        `SELECT * FROM progress_notes WHERE patient_id = ${patientId} ORDER BY note_date DESC`
      );
      setNotes(data || []);
    } catch (error) {
      console.error('경과기록 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const now = getCurrentTimestamp();
      const noteDate = formData.note_date || new Date().toISOString();

      if (editingNote) {
        await execute(`
          UPDATE progress_notes SET
            subjective = ${toSqlValue(formData.subjective)},
            objective = ${toSqlValue(formData.objective)},
            assessment = ${toSqlValue(formData.assessment)},
            plan = ${toSqlValue(formData.plan)},
            follow_up_plan = ${toSqlValue(formData.follow_up_plan)},
            notes = ${toSqlValue(formData.notes)},
            updated_at = ${escapeString(now)}
          WHERE id = ${editingNote.id}
        `);
        alert('경과기록이 수정되었습니다');
      } else {
        await insert(`
          INSERT INTO progress_notes (patient_id, note_date, subjective, objective, assessment, plan, follow_up_plan, notes, treatment_plan_id, created_at, updated_at)
          VALUES (
            ${patientId},
            ${escapeString(noteDate)},
            ${toSqlValue(formData.subjective)},
            ${toSqlValue(formData.objective)},
            ${toSqlValue(formData.assessment)},
            ${toSqlValue(formData.plan)},
            ${toSqlValue(formData.follow_up_plan)},
            ${toSqlValue(formData.notes)},
            ${treatmentPlanId || 'NULL'},
            ${escapeString(now)},
            ${escapeString(now)}
          )
        `);
        alert('경과기록이 추가되었습니다');
      }

      setShowForm(false);
      setEditingNote(null);
      resetForm();
      loadNotes();
    } catch (error: any) {
      console.error('저장 실패:', error);
      alert('저장에 실패했습니다: ' + error.message);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('이 경과기록을 삭제하시겠습니까?')) return;

    try {
      await execute(`DELETE FROM progress_notes WHERE id = ${id}`);
      alert('경과기록이 삭제되었습니다');
      setSelectedNote(null);
      loadNotes();
    } catch (error: any) {
      console.error('삭제 실패:', error);
      alert('삭제에 실패했습니다: ' + error.message);
    }
  };

  const handleEdit = (note: ProgressNote) => {
    setEditingNote(note);
    setFormData(note);
    setShowForm(true);
    setSelectedNote(null);
  };

  const resetForm = () => {
    setFormData({
      subjective: '',
      objective: '',
      assessment: '',
      plan: '',
      follow_up_plan: '',
      notes: ''
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-7xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="bg-white border-b p-4 flex justify-between items-center">
          <h2 className="text-2xl font-bold">경과기록 (SOAP Notes) - {patientName}</h2>
          <div className="flex gap-2">
            <button
              onClick={() => {
                resetForm();
                setEditingNote(null);
                setShowForm(!showForm);
              }}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              {showForm ? '취소' : '+ 경과기록 추가'}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              닫기
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {showForm && (
            <div className="bg-gray-50 p-4 rounded mb-4">
              <h3 className="font-bold mb-3">{editingNote ? '경과기록 수정' : '경과기록 추가'}</h3>
              <div className="space-y-4">
                <div>
                  <label className="block mb-1 text-sm font-semibold text-blue-600">S (Subjective) - 주관적 증상</label>
                  <textarea
                    value={formData.subjective || ''}
                    onChange={(e) => setFormData({ ...formData, subjective: e.target.value })}
                    className="w-full border rounded p-2"
                    rows={3}
                    placeholder="환자가 호소하는 증상, 느낌 등"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-sm font-semibold text-green-600">O (Objective) - 객관적 소견</label>
                  <textarea
                    value={formData.objective || ''}
                    onChange={(e) => setFormData({ ...formData, objective: e.target.value })}
                    className="w-full border rounded p-2"
                    rows={3}
                    placeholder="바이탈 사인, 검사 결과, 신체 검진 소견 등"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-sm font-semibold text-red-600">A (Assessment) - 평가</label>
                  <textarea
                    value={formData.assessment || ''}
                    onChange={(e) => setFormData({ ...formData, assessment: e.target.value })}
                    className="w-full border rounded p-2"
                    rows={3}
                    placeholder="진단, 상태 평가, 문제 목록 등"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-sm font-semibold text-purple-600">P (Plan) - 계획</label>
                  <textarea
                    value={formData.plan || ''}
                    onChange={(e) => setFormData({ ...formData, plan: e.target.value })}
                    className="w-full border rounded p-2"
                    rows={3}
                    placeholder="치료 계획, 처방, 추가 검사 등"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-sm font-semibold">추적 계획</label>
                  <textarea
                    value={formData.follow_up_plan || ''}
                    onChange={(e) => setFormData({ ...formData, follow_up_plan: e.target.value })}
                    className="w-full border rounded p-2"
                    rows={2}
                    placeholder="다음 방문 일정, 모니터링 사항 등"
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
                    setEditingNote(null);
                    resetForm();
                  }}
                  className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                >
                  취소
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-4">
            {/* 왼쪽: 경과기록 목록 */}
            <div className="col-span-1">
              <h3 className="font-bold mb-2">경과기록 목록 ({notes.length}건)</h3>
              <div className="space-y-2">
                {loading ? (
                  <p>로딩 중...</p>
                ) : notes.length === 0 ? (
                  <p className="text-gray-500">경과기록이 없습니다.</p>
                ) : (
                  notes.map((note) => (
                    <div
                      key={note.id}
                      onClick={() => setSelectedNote(note)}
                      className={`p-3 border rounded cursor-pointer hover:bg-blue-50 ${
                        selectedNote?.id === note.id ? 'bg-blue-100 border-blue-500' : ''
                      }`}
                    >
                      <div className="font-semibold">
                        {new Date(note.note_date).toLocaleDateString('ko-KR')}
                      </div>
                      <div className="text-xs text-gray-600 mt-1">
                        {note.doctor_name || '담당의 미지정'}
                      </div>
                      {note.assessment && (
                        <div className="text-xs mt-1 text-gray-700 truncate">
                          {note.assessment.substring(0, 40)}...
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 오른쪽: 선택된 경과기록 상세 */}
            <div className="col-span-2">
              {selectedNote ? (
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-lg">경과기록 상세</h3>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(selectedNote)}
                        className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
                      >
                        수정
                      </button>
                      <button
                        onClick={() => handleDelete(selectedNote.id)}
                        className="px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600"
                      >
                        삭제
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <strong>작성일:</strong> {new Date(selectedNote.note_date).toLocaleString('ko-KR')}
                    </div>
                    {selectedNote.doctor_name && (
                      <div>
                        <strong>담당의:</strong> {selectedNote.doctor_name}
                      </div>
                    )}

                    <hr />

                    <div>
                      <h4 className="font-semibold text-blue-600 mb-2">S (Subjective) - 주관적 증상</h4>
                      <p className="whitespace-pre-wrap bg-blue-50 p-3 rounded">{selectedNote.subjective || '-'}</p>
                    </div>

                    <div>
                      <h4 className="font-semibold text-green-600 mb-2">O (Objective) - 객관적 소견</h4>
                      <p className="whitespace-pre-wrap bg-green-50 p-3 rounded">{selectedNote.objective || '-'}</p>
                    </div>

                    <div>
                      <h4 className="font-semibold text-red-600 mb-2">A (Assessment) - 평가</h4>
                      <p className="whitespace-pre-wrap bg-red-50 p-3 rounded">{selectedNote.assessment || '-'}</p>
                    </div>

                    <div>
                      <h4 className="font-semibold text-purple-600 mb-2">P (Plan) - 계획</h4>
                      <p className="whitespace-pre-wrap bg-purple-50 p-3 rounded">{selectedNote.plan || '-'}</p>
                    </div>

                    {selectedNote.follow_up_plan && (
                      <div>
                        <h4 className="font-semibold mb-2">추적 계획</h4>
                        <p className="whitespace-pre-wrap bg-gray-50 p-3 rounded">{selectedNote.follow_up_plan}</p>
                      </div>
                    )}

                    {selectedNote.notes && (
                      <div>
                        <h4 className="font-semibold text-gray-700 mb-2">상세 기록</h4>
                        <pre className="whitespace-pre-wrap bg-gray-100 p-3 rounded text-sm font-sans">{selectedNote.notes}</pre>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  <p>경과기록을 선택하여 상세 내용을 확인하세요</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProgressNoteView;
