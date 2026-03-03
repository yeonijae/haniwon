import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { LocalPatient } from '../../lib/patientSync';
import { searchLocalPatients, searchAndSyncPatients } from '../../lib/patientSync';
import type { SurveyTemplate } from '../../types';
import { createSession, getTemplates } from '../../lib/surveyApi';

interface SurveySessionCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void | Promise<void>;
  doctors: { id: string | number; name: string }[];
  createdBy?: string;
  initialPatient?: LocalPatient | null;
}

const calcAge = (birthDate: string | null): number | undefined => {
  if (!birthDate) return undefined;
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const month = today.getMonth() - birth.getMonth();
  if (month < 0 || (month === 0 && today.getDate() < birth.getDate())) age--;
  return age;
};

export default function SurveySessionCreateModal({
  isOpen,
  onClose,
  onSuccess,
  doctors,
  createdBy,
  initialPatient,
}: SurveySessionCreateModalProps) {
  const [templates, setTemplates] = useState<SurveyTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | ''>('');
  const [selectedDoctor, setSelectedDoctor] = useState<string>('');
  const [selectedPatient, setSelectedPatient] = useState<LocalPatient | null>(null);
  const [patientQuery, setPatientQuery] = useState('');
  const [patientResults, setPatientResults] = useState<LocalPatient[]>([]);
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = useCallback(() => {
    setSelectedPatient(initialPatient || null);
    setPatientQuery('');
    setPatientResults([]);
    setShowPatientDropdown(false);
    setSelectedDoctor(initialPatient?.main_doctor || '');
    setSelectedTemplateId(prev => {
      if (prev) return prev;
      return templates.length > 0 ? templates[0].id : '';
    });
  }, [initialPatient, templates]);

  useEffect(() => {
    if (!isOpen) return;
    resetForm();
  }, [isOpen, resetForm]);

  useEffect(() => {
    if (!isOpen) return;
    let mounted = true;

    (async () => {
      setIsLoadingTemplates(true);
      try {
        const list = await getTemplates();
        if (!mounted) return;
        setTemplates(list);
        setSelectedTemplateId(prev => (prev ? prev : (list.length > 0 ? list[0].id : '')));
      } catch (error) {
        console.error(error);
      } finally {
        if (mounted) setIsLoadingTemplates(false);
      }
    })();

    return () => { mounted = false; };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || initialPatient || patientQuery.length < 2) {
      setPatientResults([]);
      setShowPatientDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        let results = await searchLocalPatients(patientQuery);
        if (results.length === 0) results = await searchAndSyncPatients(patientQuery);
        setPatientResults(results);
        setShowPatientDropdown(true);
      } catch (error) {
        console.error(error);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [isOpen, initialPatient, patientQuery]);

  const canSubmit = useMemo(
    () => !!selectedPatient && !!selectedTemplateId && !isSubmitting,
    [selectedPatient, selectedTemplateId, isSubmitting],
  );

  const handleClose = () => {
    if (isSubmitting) return;
    onClose();
  };

  const handleSubmit = async () => {
    if (!selectedPatient || !selectedTemplateId || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await createSession({
        patient_id: selectedPatient.mssql_id || selectedPatient.id,
        patient_name: selectedPatient.name,
        chart_number: selectedPatient.chart_number || undefined,
        age: calcAge(selectedPatient.birth_date),
        gender: selectedPatient.gender || undefined,
        template_id: selectedTemplateId as number,
        doctor_name: selectedDoctor || undefined,
        created_by: createdBy,
      });

      await onSuccess?.();
      onClose();
    } catch (error) {
      console.error(error);
      alert('설문지 생성에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={H.modalOverlay} onClick={handleClose} role="dialog" aria-modal="true" aria-labelledby="survey-create-modal-title">
      <div style={H.modalCard} onClick={e => e.stopPropagation()}>
        <div style={H.modalHeader}>
          <h3 id="survey-create-modal-title" style={H.modalTitle}>설문지 생성</h3>
          <button
            onClick={handleClose}
            style={H.modalCloseBtn}
            disabled={isSubmitting}
            aria-label="설문지 생성 모달 닫기"
          >
            ×
          </button>
        </div>

        <div style={H.modalBody}>
          <div style={{ position: 'relative' }}>
            <label style={H.formLabel}>환자</label>
            <input
              value={selectedPatient ? `${selectedPatient.name} (${selectedPatient.chart_number || ''})` : patientQuery}
              onChange={e => {
                if (initialPatient) return;
                setPatientQuery(e.target.value);
                setSelectedPatient(null);
              }}
              onFocus={() => patientResults.length > 0 && !initialPatient && setShowPatientDropdown(true)}
              placeholder="이름/차트번호"
              style={{ ...H.formInput, background: initialPatient ? '#f8fafc' : '#fff' }}
              autoFocus={!initialPatient}
              readOnly={!!initialPatient}
            />
            {showPatientDropdown && patientResults.length > 0 && !initialPatient && (
              <div style={H.dropdown}>
                {patientResults.map(p => (
                  <div
                    key={`${p.id}-${p.chart_number || ''}`}
                    onClick={() => {
                      setSelectedPatient(p);
                      setShowPatientDropdown(false);
                      setPatientQuery('');
                    }}
                    style={H.dropdownItem}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f1f5f9')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
                  >
                    <strong>{p.name}</strong> <span style={{ color: '#64748b' }}>({p.chart_number || '-'})</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label style={H.formLabel}>담당의</label>
            <select value={selectedDoctor} onChange={e => setSelectedDoctor(e.target.value)} style={H.formInput}>
              <option value="">선택</option>
              {doctors.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
            </select>
          </div>

          <div>
            <label style={H.formLabel}>템플릿</label>
            {isLoadingTemplates ? (
              <div style={{ ...H.formInput, color: '#94a3b8' }}>로딩 중...</div>
            ) : (
              <select value={selectedTemplateId} onChange={e => setSelectedTemplateId(Number(e.target.value))} style={H.formInput}>
                <option value="">선택</option>
                {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            )}
          </div>
        </div>

        <div style={H.modalFooter}>
          <button onClick={handleClose} style={H.modalCancelBtn} disabled={isSubmitting}>취소</button>
          <button onClick={handleSubmit} disabled={!canSubmit} style={{ ...H.createBtn, opacity: canSubmit ? 1 : 0.5 }}>
            {isSubmitting ? '생성 중...' : '생성'}
          </button>
        </div>
      </div>
    </div>
  );
}

const H = {
  formLabel: { display: 'block', fontSize: 12, marginBottom: 3, color: '#64748b' } as React.CSSProperties,
  formInput: { width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, boxSizing: 'border-box' as const, outline: 'none' } as React.CSSProperties,
  createBtn: { padding: '5px 16px', borderRadius: 6, border: 'none', background: '#3b82f6', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13 } as React.CSSProperties,
  dropdown: { position: 'absolute' as const, top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #d1d5db', borderRadius: 8, maxHeight: 200, overflowY: 'auto' as const, zIndex: 100, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' } as React.CSSProperties,
  modalOverlay: { position: 'fixed' as const, inset: 0, background: 'rgba(15, 23, 42, 0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 } as React.CSSProperties,
  modalCard: { width: 'min(560px, 92vw)', background: '#fff', borderRadius: 12, boxShadow: '0 20px 50px rgba(15, 23, 42, 0.3)', display: 'flex', flexDirection: 'column' } as React.CSSProperties,
  modalHeader: { padding: '14px 18px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' } as React.CSSProperties,
  modalTitle: { margin: 0, fontSize: 16, fontWeight: 700, color: '#111827' } as React.CSSProperties,
  modalCloseBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 24, color: '#64748b', lineHeight: 1 } as React.CSSProperties,
  modalBody: { padding: 18, display: 'flex', flexDirection: 'column', gap: 12 } as React.CSSProperties,
  modalFooter: { padding: '14px 18px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: 8 } as React.CSSProperties,
  modalCancelBtn: { padding: '7px 16px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', color: '#374151', cursor: 'pointer', fontSize: 13 } as React.CSSProperties,
  dropdownItem: { padding: '7px 12px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', fontSize: 13 } as React.CSSProperties,
};
