/**
 * PatientEditModal — PostgreSQL 환자정보 열람/수정 모달
 */
import { useState, useEffect } from 'react';
import { execute, escapeString, getCurrentTimestamp } from '@shared/lib/postgres';
import type { LocalPatient } from '../../lib/patientSync';

interface Props {
  patient: LocalPatient;
  onClose: () => void;
  onSuccess: () => void;
}

const FIELDS: { key: keyof LocalPatient; label: string; type?: string; readonly?: boolean }[] = [
  { key: 'name', label: '이름' },
  { key: 'chart_number', label: '차트번호', readonly: true },
  { key: 'mssql_id', label: 'MSSQL ID', readonly: true },
  { key: 'phone', label: '전화번호' },
  { key: 'birth_date', label: '생년월일', type: 'date' },
  { key: 'gender', label: '성별' },
  { key: 'address', label: '주소' },
  { key: 'main_doctor', label: '주치의' },
  { key: 'referral_type', label: '내원경로' },
  { key: 'first_visit_date', label: '초진일', type: 'date' },
  { key: 'last_visit_date', label: '최근내원', type: 'date' },
  { key: 'total_visits', label: '총 내원수', type: 'number' },
  { key: 'treatment_clothing', label: '치료복' },
  { key: 'treatment_notes', label: '진료 메모', type: 'textarea' },
  { key: 'doctor_memo', label: '의사 메모', type: 'textarea' },
  { key: 'nurse_memo', label: '간호 메모', type: 'textarea' },
  { key: 'consultation_memo', label: '상담 메모', type: 'textarea' },
  { key: 'created_at', label: '등록일', readonly: true },
  { key: 'updated_at', label: '수정일', readonly: true },
  { key: 'synced_at', label: '동기화', readonly: true },
];

export default function PatientEditModal({ patient, onClose, onSuccess }: Props) {
  const [form, setForm] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const data: Record<string, any> = {};
    FIELDS.forEach(f => { data[f.key] = (patient as any)[f.key] ?? ''; });
    setForm(data);
  }, [patient]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const editableFields = FIELDS.filter(f => !f.readonly);
      const parts = editableFields.map(f => {
        const val = form[f.key];
        if (val === '' || val === null || val === undefined) return `${f.key} = NULL`;
        if (f.type === 'number') return `${f.key} = ${Number(val) || 0}`;
        return `${f.key} = ${escapeString(String(val))}`;
      });
      parts.push(`updated_at = ${escapeString(getCurrentTimestamp())}`);
      await execute(`UPDATE cs_local_patients SET ${parts.join(', ')} WHERE id = ${patient.id}`);
      onSuccess();
      onClose();
    } catch (err) {
      console.error('환자정보 수정 실패:', err);
      alert('수정에 실패했습니다.');
    }
    setSaving(false);
  };

  const handleChange = (key: string, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="pkg-modal-overlay" onClick={onClose}>
      <div className="expanded-section-modal" style={{ width: 520 }} onClick={e => e.stopPropagation()}>
        <div className="expanded-section-header">
          <h3>환자정보 수정</h3>
          <button className="pkg-modal-close-btn" onClick={onClose}><i className="fa-solid fa-xmark" /></button>
        </div>
        <div className="expanded-section-body" style={{ padding: '12px 16px' }}>
          {FIELDS.map(f => (
            <div key={f.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
              <label style={{ width: 90, flexShrink: 0, fontSize: 13, fontWeight: 600, color: '#374151', paddingTop: 6 }}>{f.label}</label>
              {f.readonly ? (
                <span style={{ fontSize: 13, color: '#6b7280', paddingTop: 6 }}>{form[f.key] || '-'}</span>
              ) : f.type === 'textarea' ? (
                <textarea
                  value={form[f.key] || ''}
                  onChange={e => handleChange(f.key, e.target.value)}
                  rows={2}
                  style={{ flex: 1, padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, resize: 'vertical' }}
                />
              ) : (
                <input
                  type={f.type || 'text'}
                  value={form[f.key] || ''}
                  onChange={e => handleChange(f.key, e.target.value)}
                  style={{ flex: 1, padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13 }}
                />
              )}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 16px', borderTop: '1px solid #e5e7eb' }}>
          <button onClick={onClose} style={{ padding: '8px 20px', border: '1px solid #d1d5db', borderRadius: 6, background: 'white', cursor: 'pointer' }}>취소</button>
          <button onClick={handleSave} disabled={saving} style={{ padding: '8px 20px', border: 'none', borderRadius: 6, background: '#3b82f6', color: 'white', fontWeight: 600, cursor: 'pointer' }}>
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}
