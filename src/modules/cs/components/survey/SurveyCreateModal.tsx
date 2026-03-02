/**
 * 설문 등록 모달
 * 환자 대시보드에서 [설문+] 버튼으로 호출
 * 환자 정보 자동 채움 + 담당의 변경 + 템플릿 선택
 */
import React, { useState, useEffect } from 'react';
import type { LocalPatient } from '../../lib/patientSync';
import type { SurveyTemplate } from '../../types';
import { getTemplates, createSession, ensureSurveyTables } from '../../lib/surveyApi';

interface SurveyCreateModalProps {
  patient: LocalPatient;
  doctors: { id: string | number; name: string }[];
  onClose: () => void;
  onSuccess?: () => void;
}

export default function SurveyCreateModal({ patient, doctors, onClose, onSuccess }: SurveyCreateModalProps) {
  const [templates, setTemplates] = useState<SurveyTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [selectedDoctor, setSelectedDoctor] = useState<string>(patient.main_doctor || '');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 나이 계산
  const calcAge = (birthDate: string | null): number | undefined => {
    if (!birthDate) return undefined;
    const birth = new Date(birthDate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  };

  const age = calcAge(patient.birth_date);
  const gender = patient.gender || undefined;

  useEffect(() => {
    (async () => {
      await ensureSurveyTables();
      const list = await getTemplates();
      setTemplates(list);
      if (list.length > 0) setSelectedTemplateId(list[0].id);
      setIsLoading(false);
    })();
  }, []);

  const handleSubmit = async () => {
    if (!selectedTemplateId || !selectedDoctor) return;
    setIsSubmitting(true);
    try {
      await createSession({
        patient_id: patient.id,
        patient_name: patient.name,
        chart_number: patient.chart_number || '',
        age,
        gender: gender || undefined,
        template_id: selectedTemplateId,
        doctor_name: selectedDoctor,
      });
      onSuccess?.();
      onClose();
    } catch (err) {
      console.error('설문 세션 생성 실패:', err);
      alert('설문 등록에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <div style={styles.header}>
          <h3 style={styles.title}>📝 설문 등록</h3>
          <button style={styles.closeBtn} onClick={onClose}>×</button>
        </div>

        <div style={styles.body}>
          {/* 환자 정보 (읽기전용) */}
          <div style={styles.patientInfo}>
            <span style={styles.patientName}>{patient.name}</span>
            <span style={styles.patientDetail}>
              {patient.chart_number && `#${patient.chart_number}`}
              {gender && age != null && ` · ${gender === 'M' ? '남' : gender === 'F' ? '여' : gender}/${age}세`}
            </span>
          </div>

          {/* 담당의 선택 */}
          <div style={styles.formGroup}>
            <label style={styles.label}>담당의</label>
            <select
              style={styles.select}
              value={selectedDoctor}
              onChange={e => setSelectedDoctor(e.target.value)}
            >
              <option value="">선택하세요</option>
              {doctors.map(d => (
                <option key={d.id} value={d.name}>{d.name}</option>
              ))}
            </select>
          </div>

          {/* 템플릿 선택 */}
          <div style={styles.formGroup}>
            <label style={styles.label}>설문 템플릿</label>
            {isLoading ? (
              <span style={{ color: '#9ca3af' }}>로딩 중...</span>
            ) : templates.length === 0 ? (
              <span style={{ color: '#ef4444' }}>등록된 템플릿이 없습니다</span>
            ) : (
              <select
                style={styles.select}
                value={selectedTemplateId ?? ''}
                onChange={e => setSelectedTemplateId(Number(e.target.value))}
              >
                {templates.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.questions.length}문항)
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div style={styles.footer}>
          <button style={styles.cancelBtn} onClick={onClose}>취소</button>
          <button
            style={{
              ...styles.submitBtn,
              opacity: (!selectedTemplateId || !selectedDoctor || isSubmitting) ? 0.5 : 1,
            }}
            onClick={handleSubmit}
            disabled={!selectedTemplateId || !selectedDoctor || isSubmitting}
          >
            {isSubmitting ? '등록 중...' : '설문 등록'}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000,
  },
  modal: {
    background: '#fff', borderRadius: 12, width: 420, maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '16px 20px', borderBottom: '1px solid #e5e7eb',
  },
  title: { margin: 0, fontSize: 16, fontWeight: 600 },
  closeBtn: {
    background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#6b7280', lineHeight: 1,
  },
  body: { padding: '20px' },
  patientInfo: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '10px 14px', background: '#f3f4f6', borderRadius: 8, marginBottom: 16,
  },
  patientName: { fontWeight: 600, fontSize: 15 },
  patientDetail: { color: '#6b7280', fontSize: 13 },
  formGroup: { marginBottom: 14 },
  label: { display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 },
  select: {
    width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #d1d5db',
    fontSize: 14, background: '#fff',
  },
  footer: {
    display: 'flex', justifyContent: 'flex-end', gap: 8,
    padding: '14px 20px', borderTop: '1px solid #e5e7eb',
  },
  cancelBtn: {
    padding: '8px 16px', borderRadius: 6, border: '1px solid #d1d5db',
    background: '#fff', cursor: 'pointer', fontSize: 13,
  },
  submitBtn: {
    padding: '8px 20px', borderRadius: 6, border: 'none',
    background: '#8b5cf6', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600,
  },
};
