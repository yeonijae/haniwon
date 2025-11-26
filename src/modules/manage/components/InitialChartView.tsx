import React, { useState, useEffect } from 'react';
import { supabase } from '@shared/lib/supabase';
import type { InitialChart } from '../types';

interface Props {
  patientId: number;
  patientName: string;
  onClose: () => void;
}

const InitialChartView: React.FC<Props> = ({ patientId, patientName, onClose }) => {
  const [chart, setChart] = useState<InitialChart | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState<Partial<InitialChart>>({});

  useEffect(() => {
    loadChart();
  }, [patientId]);

  const loadChart = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('initial_charts')
        .select('*')
        .eq('patient_id', patientId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setChart(data);
        setFormData(data);
      } else {
        setIsEditing(true);
        setFormData({ patient_id: patientId });
      }
    } catch (error) {
      console.error('초진차트 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      if (chart) {
        const { error } = await supabase
          .from('initial_charts')
          .update(formData)
          .eq('id', chart.id);
        if (error) throw error;
        alert('초진차트가 수정되었습니다');
      } else {
        const { error } = await supabase
          .from('initial_charts')
          .insert([formData]);
        if (error) throw error;
        alert('초진차트가 생성되었습니다');
      }
      setIsEditing(false);
      loadChart();
    } catch (error: any) {
      console.error('저장 실패:', error);
      alert('저장에 실패했습니다: ' + error.message);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8">
          <p>로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b p-4 flex justify-between items-center">
          <h2 className="text-2xl font-bold">초진차트 - {patientName}</h2>
          <div className="flex gap-2">
            {!isEditing && chart && (
              <button
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                수정
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              닫기
            </button>
          </div>
        </div>

        <div className="p-6">
          {isEditing ? (
            <div className="space-y-4">
              <FormField label="주 호소 (Chief Complaint)">
                <textarea
                  value={formData.chief_complaint || ''}
                  onChange={(e) => setFormData({ ...formData, chief_complaint: e.target.value })}
                  className="w-full border rounded p-2"
                  rows={3}
                />
              </FormField>

              <FormField label="현병력 (Present Illness)">
                <textarea
                  value={formData.present_illness || ''}
                  onChange={(e) => setFormData({ ...formData, present_illness: e.target.value })}
                  className="w-full border rounded p-2"
                  rows={4}
                />
              </FormField>

              <FormField label="과거 병력 (Past Medical History)">
                <textarea
                  value={formData.past_medical_history || ''}
                  onChange={(e) => setFormData({ ...formData, past_medical_history: e.target.value })}
                  className="w-full border rounded p-2"
                  rows={3}
                />
              </FormField>

              <FormField label="과거 수술력 (Past Surgical History)">
                <textarea
                  value={formData.past_surgical_history || ''}
                  onChange={(e) => setFormData({ ...formData, past_surgical_history: e.target.value })}
                  className="w-full border rounded p-2"
                  rows={3}
                />
              </FormField>

              <FormField label="가족력 (Family History)">
                <textarea
                  value={formData.family_history || ''}
                  onChange={(e) => setFormData({ ...formData, family_history: e.target.value })}
                  className="w-full border rounded p-2"
                  rows={3}
                />
              </FormField>

              <FormField label="사회력 (Social History)">
                <textarea
                  value={formData.social_history || ''}
                  onChange={(e) => setFormData({ ...formData, social_history: e.target.value })}
                  className="w-full border rounded p-2"
                  rows={3}
                />
              </FormField>

              <FormField label="현재 복용약 (Medications)">
                <textarea
                  value={formData.medications || ''}
                  onChange={(e) => setFormData({ ...formData, medications: e.target.value })}
                  className="w-full border rounded p-2"
                  rows={3}
                />
              </FormField>

              <FormField label="알레르기 (Allergies)">
                <textarea
                  value={formData.allergies || ''}
                  onChange={(e) => setFormData({ ...formData, allergies: e.target.value })}
                  className="w-full border rounded p-2"
                  rows={2}
                />
              </FormField>

              <FormField label="초진 진단 (Initial Diagnosis)">
                <textarea
                  value={formData.initial_diagnosis || ''}
                  onChange={(e) => setFormData({ ...formData, initial_diagnosis: e.target.value })}
                  className="w-full border rounded p-2"
                  rows={3}
                />
              </FormField>

              <FormField label="초진 계획 (Initial Plan)">
                <textarea
                  value={formData.initial_plan || ''}
                  onChange={(e) => setFormData({ ...formData, initial_plan: e.target.value })}
                  className="w-full border rounded p-2"
                  rows={3}
                />
              </FormField>

              <FormField label="비고 (Notes)">
                <textarea
                  value={formData.notes || ''}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full border rounded p-2"
                  rows={2}
                />
              </FormField>

              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  className="px-6 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                >
                  저장
                </button>
                <button
                  onClick={() => {
                    setIsEditing(false);
                    if (chart) setFormData(chart);
                  }}
                  className="px-6 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                >
                  취소
                </button>
              </div>
            </div>
          ) : chart ? (
            <div className="space-y-4">
              <Section title="주 호소" content={chart.chief_complaint} />
              <Section title="현병력" content={chart.present_illness} />
              <Section title="과거 병력" content={chart.past_medical_history} />
              <Section title="과거 수술력" content={chart.past_surgical_history} />
              <Section title="가족력" content={chart.family_history} />
              <Section title="사회력" content={chart.social_history} />
              <Section title="현재 복용약" content={chart.medications} />
              <Section title="알레르기" content={chart.allergies} />
              <Section title="초진 진단" content={chart.initial_diagnosis} />
              <Section title="초진 계획" content={chart.initial_plan} />
              <Section title="비고" content={chart.notes} />
              <div className="mt-4 text-sm text-gray-500">
                작성일: {new Date(chart.chart_date).toLocaleString('ko-KR')}
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500 mb-4">초진차트가 없습니다</p>
              <button
                onClick={() => setIsEditing(true)}
                className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                초진차트 작성
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const FormField: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <label className="block font-semibold mb-1">{label}</label>
    {children}
  </div>
);

const Section: React.FC<{ title: string; content?: string }> = ({ title, content }) => (
  content ? (
    <div>
      <h3 className="font-semibold text-lg mb-2">{title}</h3>
      <p className="whitespace-pre-wrap bg-gray-50 p-3 rounded">{content}</p>
    </div>
  ) : null
);

export default InitialChartView;
