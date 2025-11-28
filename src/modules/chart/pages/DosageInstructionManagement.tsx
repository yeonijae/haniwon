import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { parsePDFToTemplate } from '../services/pdfParser';
import type { DosageInstruction, Prescription } from '../types';

type TabType = 'created' | 'templates';

const DosageInstructionManagement: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('created');

  // 작성된 복용법 관련 상태
  const [createdInstructions, setCreatedInstructions] = useState<Prescription[]>([]);
  const [loadingCreated, setLoadingCreated] = useState(true);
  const [selectedPrescription, setSelectedPrescription] = useState<Prescription | null>(null);

  // 템플릿 관련 상태
  const [templates, setTemplates] = useState<DosageInstruction[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedTemplate, setSelectedTemplate] = useState<DosageInstruction | null>(null);

  // 템플릿 편집 모달 상태
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<DosageInstruction | null>(null);
  const [templateForm, setTemplateForm] = useState({
    category: '',
    subcategory: '',
    disease_name: '',
    condition_detail: '',
    description: '',
    dosage_method: '',
    precautions: '',
    keywords: ''
  });
  const [savingTemplate, setSavingTemplate] = useState(false);

  // PDF 업로드 상태
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parsingPDF, setParsingPDF] = useState(false);

  // 카테고리 목록 추출
  const categories = useMemo(() => {
    const cats = new Set(templates.map(i => i.category));
    return Array.from(cats).sort();
  }, [templates]);

  useEffect(() => {
    loadCreatedInstructions();
    loadTemplates();
  }, []);

  // 작성된 복용법 로드
  const loadCreatedInstructions = async () => {
    try {
      setLoadingCreated(true);
      const { data, error } = await supabase
        .from('prescriptions')
        .select('*')
        .eq('dosage_instruction_created', true)
        .order('dosage_instruction_created_at', { ascending: false });

      if (error) throw error;

      // 각 처방전에 대해 주소증 가져오기
      const prescriptionsWithChiefComplaint = await Promise.all(
        (data || []).map(async (prescription) => {
          let chiefComplaint = '';

          if (prescription.source_type === 'initial_chart' && prescription.source_id) {
            const { data: chartData } = await supabase
              .from('initial_charts')
              .select('notes')
              .eq('id', prescription.source_id)
              .single();

            // notes에서 [주소증] 섹션 추출
            if (chartData?.notes) {
              const match = chartData.notes.match(/\[주소증\]([\s\S]*?)(?=\n\[|$)/);
              if (match) {
                chiefComplaint = match[1].trim();
              }
            }
          } else if (prescription.source_type === 'progress_note' && prescription.source_id) {
            const { data: noteData } = await supabase
              .from('progress_notes')
              .select('subjective')
              .eq('id', prescription.source_id)
              .single();

            if (noteData?.subjective) {
              chiefComplaint = noteData.subjective;
            }
          }

          return { ...prescription, chief_complaint: chiefComplaint };
        })
      );

      setCreatedInstructions(prescriptionsWithChiefComplaint);
    } catch (error) {
      console.error('작성된 복용법 로드 실패:', error);
    } finally {
      setLoadingCreated(false);
    }
  };

  // 템플릿 로드
  const loadTemplates = async () => {
    try {
      setLoadingTemplates(true);
      const { data, error } = await supabase
        .from('dosage_instructions')
        .select('*')
        .order('category')
        .order('disease_name');

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error('복용법 템플릿 로드 실패:', error);
    } finally {
      setLoadingTemplates(false);
    }
  };

  // 필터링된 템플릿 목록
  const filteredTemplates = useMemo(() => {
    return templates.filter(inst => {
      if (selectedCategory && inst.category !== selectedCategory) {
        return false;
      }
      if (searchTerm.length >= 2) {
        const term = searchTerm.toLowerCase();
        return (
          inst.disease_name.toLowerCase().includes(term) ||
          (inst.condition_detail?.toLowerCase().includes(term)) ||
          (inst.subcategory?.toLowerCase().includes(term)) ||
          (inst.keywords?.some(k => k.toLowerCase().includes(term)))
        );
      }
      return true;
    });
  }, [templates, selectedCategory, searchTerm]);

  // 카테고리별 그룹화
  const groupedTemplates = useMemo(() => {
    const groups: Record<string, DosageInstruction[]> = {};
    filteredTemplates.forEach(inst => {
      if (!groups[inst.category]) {
        groups[inst.category] = [];
      }
      groups[inst.category].push(inst);
    });
    return groups;
  }, [filteredTemplates]);

  // 복용법 수정 페이지로 이동
  const goToEditInstruction = (prescription: Prescription) => {
    navigate('/chart/dosage-instructions/create', {
      state: {
        prescriptionId: prescription.id,
        patientName: prescription.patient_name,
        patientAge: prescription.patient_age,
        patientGender: prescription.patient_gender,
        formula: prescription.formula,
        chiefComplaint: prescription.chief_complaint
      }
    });
  };

  // 복용법 삭제
  const handleDeleteInstruction = async (prescription: Prescription) => {
    if (!confirm(`"${prescription.patient_name}"님의 복용법을 삭제하시겠습니까?\n\n처방전은 유지되고 복용법 데이터만 삭제됩니다.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('prescriptions')
        .update({
          dosage_instruction_created: false,
          dosage_instruction_created_at: null,
          dosage_instruction_data: null
        })
        .eq('id', prescription.id);

      if (error) throw error;

      // 목록 새로고침
      setCreatedInstructions(prev => prev.filter(p => p.id !== prescription.id));
      setSelectedPrescription(null);
      alert('복용법이 삭제되었습니다.');
    } catch (error) {
      console.error('복용법 삭제 실패:', error);
      alert('복용법 삭제에 실패했습니다.');
    }
  };

  // 인쇄 기능
  const handlePrint = (prescription: Prescription) => {
    const data = prescription.dosage_instruction_data;
    if (!data) {
      alert('저장된 복용법 데이터가 없습니다.');
      return;
    }

    const today = new Date().toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // 협의된 양약 항목 텍스트
    const MEDICINE_AGREEMENT_TEXT = '다음과 같이 협의된 양약 이외에는 중단해주세요.';

    const printContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>복용법 안내문</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Malgun Gothic', sans-serif; padding: 15mm; font-size: 11pt; line-height: 1.6; }
    .header { text-align: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #1e3a5f; }
    .header h1 { font-size: 22pt; color: #1e3a5f; letter-spacing: 4px; }
    .header .patient-info { margin-top: 10px; font-size: 12pt; color: #333; }
    .header .date { font-size: 10pt; color: #666; margin-top: 5px; }
    .section { margin-bottom: 18px; }
    .section-title { font-size: 12pt; font-weight: bold; color: #1e3a5f; margin-bottom: 8px; padding-left: 8px; border-left: 3px solid #1e3a5f; }
    .section-content { font-size: 10pt; padding: 10px; background: #f8f9fa; border-radius: 4px; white-space: pre-wrap; }
    .precaution-item { padding: 3px 0; }
    .footer { margin-top: 30px; padding-top: 15px; border-top: 1px solid #ddd; text-align: center; font-size: 9pt; color: #666; }
    @media print { body { padding: 10mm; } @page { margin: 0; size: A4; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>복용법 안내문</h1>
    <div class="patient-info">${prescription.patient_name || ''}${prescription.patient_age ? ` (${prescription.patient_age}세)` : ''}</div>
    <div class="date">${today}</div>
  </div>

  ${data.description ? `
  <div class="section">
    <div class="section-title">一. 질환 설명</div>
    <div class="section-content">${data.description}</div>
  </div>
  ` : ''}

  <div class="section">
    <div class="section-title">二. 복용방법</div>
    <div class="section-content">
      하루 ${data.dosageMethod?.selectedTimes?.length || 2}회(${data.dosageMethod?.selectedTimes?.join(', ') || '아침, 저녁'}), 1회 ${data.dosageMethod?.dosageAmount || '1팩'}씩 ${data.dosageMethod?.timing || '식전/식후 상관없이'} 드세요.
      ${data.dosageNotice ? `\n\n${data.dosageNotice}` : ''}
    </div>
  </div>

  <div class="section">
    <div class="section-title">三. 보관방법</div>
    <div class="section-content">
      ${data.storageMethod?.method || '냉장보관'}하며, ${data.storageMethod?.duration || 30}${data.storageMethod?.unit || '일'} 이내에 드세요.
      ${data.storageNotice ? `\n\n${data.storageNotice}` : ''}
    </div>
  </div>

  ${(data.selectedFoods && data.selectedFoods.length > 0) || data.customPrecautions ? `
  <div class="section">
    <div class="section-title">四. 주의사항</div>
    <div class="section-content">
      ${data.selectedFoods?.map((item: string) => {
        if (item === MEDICINE_AGREEMENT_TEXT && (data.selectedMedicines?.length > 0 || data.customMedicine)) {
          const allMeds = [...(data.selectedMedicines || []), data.customMedicine].filter(Boolean);
          return `<div class="precaution-item">□ ${item}<br/><span style="margin-left: 20px; color: #1565c0;">  → ${allMeds.join(', ')}</span></div>`;
        }
        return `<div class="precaution-item">□ ${item}</div>`;
      }).join('') || ''}
      ${data.customPrecautions ? `<div style="margin-top: 10px;">${data.customPrecautions.replace(/\n/g, '<br>')}</div>` : ''}
    </div>
  </div>
  ` : ''}

  <div class="footer">
    <p>연이재한의원 | 문의: 041-576-7582</p>
    <p>본 안내문은 진료 시 설명드린 내용을 바탕으로 정리한 것입니다.</p>
  </div>
</body>
</html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.onload = () => {
        printWindow.print();
      };
    }
  };

  // 날짜 포맷
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // 카테고리 옵션 목록
  const CATEGORY_OPTIONS = [
    '소아&청소년',
    '부인과&산과',
    '소화기',
    '호흡기,안이비',
    '피부',
    '신경정신',
    '순환',
    '비뇨기',
    '보약,피로,면역',
    '다이어트',
    '호르몬,대사',
    '교통사고,상해',
    '일반'
  ];

  // 템플릿 추가 모달 열기
  const openAddTemplateModal = () => {
    setEditingTemplate(null);
    setTemplateForm({
      category: '',
      subcategory: '',
      disease_name: '',
      condition_detail: '',
      description: '',
      dosage_method: '',
      precautions: '',
      keywords: ''
    });
    setShowTemplateModal(true);
  };

  // 템플릿 수정 모달 열기
  const openEditTemplateModal = (template: DosageInstruction) => {
    setEditingTemplate(template);
    setTemplateForm({
      category: template.category || '',
      subcategory: template.subcategory || '',
      disease_name: template.disease_name || '',
      condition_detail: template.condition_detail || '',
      description: template.description || '',
      dosage_method: template.dosage_method || '',
      precautions: template.precautions || '',
      keywords: template.keywords?.join(', ') || ''
    });
    setShowTemplateModal(true);
  };

  // 템플릿 저장 (추가/수정)
  const handleSaveTemplate = async () => {
    if (!templateForm.category || !templateForm.disease_name) {
      alert('카테고리와 질환명은 필수 항목입니다.');
      return;
    }

    setSavingTemplate(true);
    try {
      const keywordsArray = templateForm.keywords
        .split(',')
        .map(k => k.trim())
        .filter(k => k.length > 0);

      const templateData = {
        category: templateForm.category,
        subcategory: templateForm.subcategory || null,
        disease_name: templateForm.disease_name,
        condition_detail: templateForm.condition_detail || null,
        description: templateForm.description || null,
        dosage_method: templateForm.dosage_method || null,
        precautions: templateForm.precautions || null,
        keywords: keywordsArray.length > 0 ? keywordsArray : null
      };

      if (editingTemplate) {
        // 수정
        const { error } = await supabase
          .from('dosage_instructions')
          .update(templateData)
          .eq('id', editingTemplate.id);

        if (error) throw error;
        alert('템플릿이 수정되었습니다.');
      } else {
        // 추가
        const { error } = await supabase
          .from('dosage_instructions')
          .insert([templateData]);

        if (error) throw error;
        alert('템플릿이 추가되었습니다.');
      }

      setShowTemplateModal(false);
      loadTemplates();
      setSelectedTemplate(null);
    } catch (error) {
      console.error('템플릿 저장 실패:', error);
      alert('템플릿 저장에 실패했습니다.');
    } finally {
      setSavingTemplate(false);
    }
  };

  // 템플릿 삭제
  const handleDeleteTemplate = async (template: DosageInstruction) => {
    if (!confirm(`"${template.disease_name}" 템플릿을 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('dosage_instructions')
        .delete()
        .eq('id', template.id);

      if (error) throw error;

      setTemplates(prev => prev.filter(t => t.id !== template.id));
      setSelectedTemplate(null);
      alert('템플릿이 삭제되었습니다.');
    } catch (error) {
      console.error('템플릿 삭제 실패:', error);
      alert('템플릿 삭제에 실패했습니다.');
    }
  };

  // PDF 파일 선택 트리거
  const triggerPDFUpload = () => {
    fileInputRef.current?.click();
  };

  // PDF 파일 업로드 처리
  const handlePDFUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      alert('PDF 파일만 업로드 가능합니다.');
      return;
    }

    setParsingPDF(true);
    try {
      const parsed = await parsePDFToTemplate(file);

      // 파싱된 데이터로 폼 채우기
      setEditingTemplate(null);
      setTemplateForm({
        category: parsed.category || '',
        subcategory: parsed.subcategory || '',
        disease_name: parsed.disease_name || '',
        condition_detail: parsed.condition_detail || '',
        description: parsed.description || '',
        dosage_method: parsed.dosage_method || '',
        precautions: parsed.precautions || '',
        keywords: parsed.keywords?.join(', ') || ''
      });
      setShowTemplateModal(true);
    } catch (error) {
      console.error('PDF 파싱 실패:', error);
      alert('PDF 파일을 읽는 데 실패했습니다.\n파일이 손상되었거나 지원하지 않는 형식일 수 있습니다.');
    } finally {
      setParsingPDF(false);
      // 파일 입력 리셋 (같은 파일 재선택 가능하도록)
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="max-w-7xl mx-auto w-full p-6 flex-1 flex flex-col overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
          <h1 className="text-2xl font-bold text-clinic-text-primary">
            <i className="fas fa-capsules mr-3 text-clinic-primary"></i>
            복용법
          </h1>
          <button
            onClick={() => navigate('/chart/dosage-instructions/create')}
            className="px-4 py-2 bg-clinic-primary text-white rounded-lg hover:bg-opacity-90 transition-colors flex items-center gap-2"
          >
            <i className="fas fa-plus"></i>
            복용법 작성
          </button>
        </div>

        {/* 탭 */}
        <div className="flex gap-2 mb-4 flex-shrink-0">
          <button
            onClick={() => setActiveTab('created')}
            className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
              activeTab === 'created'
                ? 'bg-clinic-primary text-white'
                : 'bg-gray-100 text-clinic-text-secondary hover:bg-gray-200'
            }`}
          >
            <i className="fas fa-file-medical"></i>
            작성된 복용법
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              activeTab === 'created' ? 'bg-white bg-opacity-20' : 'bg-gray-200'
            }`}>
              {createdInstructions.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
              activeTab === 'templates'
                ? 'bg-clinic-primary text-white'
                : 'bg-gray-100 text-clinic-text-secondary hover:bg-gray-200'
            }`}
          >
            <i className="fas fa-folder-open"></i>
            템플릿 관리
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              activeTab === 'templates' ? 'bg-white bg-opacity-20' : 'bg-gray-200'
            }`}>
              {templates.length}
            </span>
          </button>
        </div>

        {/* 작성된 복용법 탭 */}
        {activeTab === 'created' && (
          <div className="flex-1 overflow-hidden">
            {loadingCreated ? (
              <div className="flex flex-col items-center justify-center p-8 text-clinic-text-secondary">
                <div className="border-4 border-clinic-background border-t-clinic-primary rounded-full w-12 h-12 animate-spin mb-4"></div>
                <p>작성된 복용법을 불러오는 중...</p>
              </div>
            ) : createdInstructions.length === 0 ? (
              <div className="bg-white rounded-lg shadow-sm p-12 text-center">
                <i className="fas fa-file-medical text-6xl text-gray-300 mb-4"></i>
                <p className="text-clinic-text-secondary mb-4">작성된 복용법이 없습니다</p>
                <p className="text-sm text-gray-400">처방전 관리에서 복용법을 작성해주세요</p>
              </div>
            ) : (
              <div className="flex gap-4 h-full">
                {/* 목록 */}
                <div className="w-1/2 bg-white rounded-lg shadow-sm overflow-hidden flex flex-col">
                  <div className="bg-gray-50 px-4 py-3 border-b flex-shrink-0">
                    <h2 className="font-semibold text-clinic-text-primary">복용법 목록</h2>
                  </div>
                  <div className="overflow-auto flex-1">
                    {createdInstructions.map(prescription => (
                      <div
                        key={prescription.id}
                        onClick={() => setSelectedPrescription(prescription)}
                        className={`px-4 py-3 border-b cursor-pointer transition-colors ${
                          selectedPrescription?.id === prescription.id
                            ? 'bg-clinic-primary bg-opacity-10 border-l-4 border-l-clinic-primary'
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-clinic-text-primary">
                              {prescription.patient_name || '환자명 없음'}
                              {prescription.patient_age && (
                                <span className="text-clinic-text-secondary font-normal ml-1">
                                  ({prescription.patient_age}세)
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-clinic-text-secondary mt-1">
                              {prescription.formula}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-clinic-text-secondary">
                              {prescription.dosage_instruction_created_at &&
                                formatDate(prescription.dosage_instruction_created_at)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 상세 보기 */}
                <div className="w-1/2 bg-white rounded-lg shadow-sm overflow-hidden flex flex-col">
                  <div className="bg-gray-50 px-4 py-3 border-b flex-shrink-0 flex items-center justify-between">
                    <h2 className="font-semibold text-clinic-text-primary">상세 내용</h2>
                    {selectedPrescription && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => goToEditInstruction(selectedPrescription)}
                          className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                        >
                          <i className="fas fa-edit mr-1"></i>
                          수정
                        </button>
                        <button
                          onClick={() => handlePrint(selectedPrescription)}
                          className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
                        >
                          <i className="fas fa-print mr-1"></i>
                          인쇄
                        </button>
                        <button
                          onClick={() => handleDeleteInstruction(selectedPrescription)}
                          className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                        >
                          <i className="fas fa-trash-alt mr-1"></i>
                          삭제
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="overflow-auto flex-1 p-4">
                    {selectedPrescription?.dosage_instruction_data ? (
                      <div className="space-y-4">
                        {/* 환자 정보 */}
                        <div className="pb-3 border-b">
                          <h3 className="text-lg font-bold text-clinic-text-primary">
                            {selectedPrescription.patient_name}
                            {selectedPrescription.patient_age && ` (${selectedPrescription.patient_age}세)`}
                          </h3>
                          <p className="text-sm text-clinic-text-secondary mt-1">
                            {selectedPrescription.formula}
                          </p>
                        </div>

                        {/* 질환 설명 */}
                        {selectedPrescription.dosage_instruction_data.description && (
                          <div>
                            <h4 className="font-semibold text-clinic-text-primary mb-2 flex items-center">
                              <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-sm mr-2">一</span>
                              질환 설명
                            </h4>
                            <div className="bg-gray-50 rounded-lg p-3 text-sm whitespace-pre-wrap">
                              {selectedPrescription.dosage_instruction_data.description}
                            </div>
                          </div>
                        )}

                        {/* 복용방법 */}
                        <div>
                          <h4 className="font-semibold text-clinic-text-primary mb-2 flex items-center">
                            <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-sm mr-2">二</span>
                            복용방법
                          </h4>
                          <div className="bg-gray-50 rounded-lg p-3 text-sm">
                            하루 {selectedPrescription.dosage_instruction_data.dosageMethod?.selectedTimes?.length || 2}회
                            ({selectedPrescription.dosage_instruction_data.dosageMethod?.selectedTimes?.join(', ') || '아침, 저녁'}),
                            1회 {selectedPrescription.dosage_instruction_data.dosageMethod?.dosageAmount || '1팩'}씩
                            {selectedPrescription.dosage_instruction_data.dosageMethod?.timing || '식전/식후 상관없이'} 드세요.
                          </div>
                        </div>

                        {/* 보관방법 */}
                        <div>
                          <h4 className="font-semibold text-clinic-text-primary mb-2 flex items-center">
                            <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-sm mr-2">三</span>
                            보관방법
                          </h4>
                          <div className="bg-gray-50 rounded-lg p-3 text-sm">
                            {selectedPrescription.dosage_instruction_data.storageMethod?.method || '냉장보관'}하며,
                            {selectedPrescription.dosage_instruction_data.storageMethod?.duration || 30}
                            {selectedPrescription.dosage_instruction_data.storageMethod?.unit || '일'} 이내에 드세요.
                          </div>
                        </div>

                        {/* 주의사항 */}
                        {((selectedPrescription.dosage_instruction_data.selectedFoods &&
                           selectedPrescription.dosage_instruction_data.selectedFoods.length > 0) ||
                          selectedPrescription.dosage_instruction_data.customPrecautions) && (
                          <div>
                            <h4 className="font-semibold text-clinic-text-primary mb-2 flex items-center">
                              <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-sm mr-2">四</span>
                              주의사항
                            </h4>
                            <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
                              {selectedPrescription.dosage_instruction_data.selectedFoods?.map((item: string, idx: number) => (
                                <div key={idx}>□ {item}</div>
                              ))}
                              {selectedPrescription.dosage_instruction_data.customPrecautions && (
                                <div className="mt-2 pt-2 border-t whitespace-pre-wrap">
                                  {selectedPrescription.dosage_instruction_data.customPrecautions}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : selectedPrescription ? (
                      <div className="flex flex-col items-center justify-center h-full text-clinic-text-secondary">
                        <i className="fas fa-exclamation-circle text-4xl mb-4 opacity-30"></i>
                        <p>저장된 복용법 데이터가 없습니다</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-clinic-text-secondary">
                        <i className="fas fa-file-medical text-4xl mb-4 opacity-30"></i>
                        <p>왼쪽 목록에서 복용법을 선택하세요</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 템플릿 관리 탭 */}
        {activeTab === 'templates' && (
          <div className="flex-1 overflow-hidden flex flex-col">
            {/* 검색 및 필터 */}
            <div className="bg-white rounded-lg shadow-sm p-4 mb-4 flex-shrink-0">
              <div className="flex gap-4">
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder="질환명, 상태, 키워드로 검색 (2글자 이상)..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-clinic-primary focus:ring-2 focus:ring-clinic-primary focus:ring-opacity-20 transition-colors"
                  />
                </div>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-clinic-primary focus:ring-2 focus:ring-clinic-primary focus:ring-opacity-20 transition-colors min-w-[180px]"
                >
                  <option value="">전체 카테고리</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                <button
                  onClick={openAddTemplateModal}
                  className="px-4 py-2 bg-clinic-primary text-white rounded-lg hover:bg-opacity-90 transition-colors flex items-center gap-2 whitespace-nowrap"
                >
                  <i className="fas fa-plus"></i>
                  추가
                </button>
                <button
                  onClick={triggerPDFUpload}
                  disabled={parsingPDF}
                  className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors flex items-center gap-2 whitespace-nowrap disabled:opacity-50"
                >
                  {parsingPDF ? (
                    <>
                      <div className="border-2 border-white border-t-transparent rounded-full w-4 h-4 animate-spin"></div>
                      파싱 중...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-file-pdf"></i>
                      PDF 업로드
                    </>
                  )}
                </button>
                {/* 숨겨진 파일 입력 */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  onChange={handlePDFUpload}
                  className="hidden"
                />
              </div>
            </div>

            {/* 메인 컨텐츠 */}
            <div className="flex gap-4 flex-1 overflow-hidden">
              {/* 목록 */}
              <div className="w-1/2 bg-white rounded-lg shadow-sm overflow-hidden flex flex-col">
                <div className="bg-gray-50 px-4 py-3 border-b flex-shrink-0">
                  <h2 className="font-semibold text-clinic-text-primary">
                    템플릿 목록
                    <span className="text-sm font-normal text-clinic-text-secondary ml-2">
                      ({filteredTemplates.length}개)
                    </span>
                  </h2>
                </div>
                <div className="overflow-auto flex-1">
                  {loadingTemplates ? (
                    <div className="flex flex-col items-center justify-center p-8 text-clinic-text-secondary">
                      <div className="border-4 border-clinic-background border-t-clinic-primary rounded-full w-12 h-12 animate-spin mb-4"></div>
                      <p>템플릿을 불러오는 중...</p>
                    </div>
                  ) : filteredTemplates.length === 0 ? (
                    <p className="text-center py-12 text-clinic-text-secondary">
                      {searchTerm.length >= 2 ? '검색 결과가 없습니다' : '템플릿이 없습니다'}
                    </p>
                  ) : (
                    Object.entries(groupedTemplates).map(([category, items]) => (
                      <div key={category}>
                        <div className="bg-clinic-background px-4 py-2 sticky top-0">
                          <span className="text-sm font-semibold text-clinic-primary">{category}</span>
                          <span className="text-xs text-clinic-text-secondary ml-2">({items.length})</span>
                        </div>
                        {items.map(inst => (
                          <div
                            key={inst.id}
                            onClick={() => setSelectedTemplate(inst)}
                            className={`px-4 py-3 border-b cursor-pointer transition-colors ${
                              selectedTemplate?.id === inst.id
                                ? 'bg-clinic-primary bg-opacity-10 border-l-4 border-l-clinic-primary'
                                : 'hover:bg-gray-50'
                            }`}
                          >
                            <p className="font-medium text-clinic-text-primary">
                              {inst.disease_name}
                              {inst.condition_detail && (
                                <span className="text-clinic-text-secondary font-normal ml-1">
                                  - {inst.condition_detail}
                                </span>
                              )}
                            </p>
                          </div>
                        ))}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* 상세 보기 */}
              <div className="w-1/2 bg-white rounded-lg shadow-sm overflow-hidden flex flex-col">
                <div className="bg-gray-50 px-4 py-3 border-b flex-shrink-0 flex items-center justify-between">
                  <h2 className="font-semibold text-clinic-text-primary">상세 내용</h2>
                  {selectedTemplate && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => openEditTemplateModal(selectedTemplate)}
                        className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                      >
                        <i className="fas fa-edit mr-1"></i>
                        수정
                      </button>
                      <button
                        onClick={() => handleDeleteTemplate(selectedTemplate)}
                        className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                      >
                        <i className="fas fa-trash-alt mr-1"></i>
                        삭제
                      </button>
                    </div>
                  )}
                </div>
                <div className="overflow-auto flex-1 p-4">
                  {selectedTemplate ? (
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-xl font-bold text-clinic-text-primary mb-2">
                          {selectedTemplate.disease_name}
                          {selectedTemplate.condition_detail && (
                            <span className="font-normal text-lg ml-2">({selectedTemplate.condition_detail})</span>
                          )}
                        </h3>
                        <div className="flex gap-2 flex-wrap">
                          <span className="text-xs bg-clinic-primary text-white px-2 py-1 rounded">
                            {selectedTemplate.category}
                          </span>
                        </div>
                      </div>

                      {selectedTemplate.description && (
                        <div>
                          <h4 className="font-semibold text-clinic-text-primary mb-2 flex items-center">
                            <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-sm mr-2">一</span>
                            설명
                          </h4>
                          <div className="bg-gray-50 rounded-lg p-4 text-sm whitespace-pre-wrap">
                            {selectedTemplate.description}
                          </div>
                        </div>
                      )}

                      {selectedTemplate.dosage_method && (
                        <div>
                          <h4 className="font-semibold text-clinic-text-primary mb-2 flex items-center">
                            <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-sm mr-2">二</span>
                            복용법
                          </h4>
                          <div className="bg-gray-50 rounded-lg p-4 text-sm whitespace-pre-wrap">
                            {selectedTemplate.dosage_method}
                          </div>
                        </div>
                      )}

                      {selectedTemplate.precautions && (
                        <div>
                          <h4 className="font-semibold text-clinic-text-primary mb-2 flex items-center">
                            <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-sm mr-2">三</span>
                            주의사항
                          </h4>
                          <div className="bg-gray-50 rounded-lg p-4 text-sm whitespace-pre-wrap">
                            {selectedTemplate.precautions}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-clinic-text-secondary">
                      <i className="fas fa-file-medical text-4xl mb-4 opacity-30"></i>
                      <p>왼쪽 목록에서 템플릿을 선택하세요</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 템플릿 추가/수정 모달 */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
            {/* 모달 헤더 */}
            <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0">
              <h2 className="text-xl font-bold text-clinic-text-primary">
                <i className={`fas ${editingTemplate ? 'fa-edit' : 'fa-plus'} mr-2 text-clinic-primary`}></i>
                {editingTemplate ? '템플릿 수정' : '템플릿 추가'}
              </h2>
              <button
                onClick={() => setShowTemplateModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <i className="fas fa-times text-xl"></i>
              </button>
            </div>

            {/* 모달 내용 */}
            <div className="flex-1 overflow-auto p-6">
              <div className="space-y-4">
                {/* 카테고리 & 질환명 */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-clinic-text-primary mb-1">
                      카테고리 <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={templateForm.category}
                      onChange={(e) => setTemplateForm(prev => ({ ...prev, category: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-clinic-primary"
                    >
                      <option value="">카테고리 선택</option>
                      {CATEGORY_OPTIONS.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-clinic-text-primary mb-1">
                      소분류
                    </label>
                    <input
                      type="text"
                      value={templateForm.subcategory}
                      onChange={(e) => setTemplateForm(prev => ({ ...prev, subcategory: e.target.value }))}
                      placeholder="예: 소아, 성인"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-clinic-primary"
                    />
                  </div>
                </div>

                {/* 질환명 & 세부상태 */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-clinic-text-primary mb-1">
                      질환명 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={templateForm.disease_name}
                      onChange={(e) => setTemplateForm(prev => ({ ...prev, disease_name: e.target.value }))}
                      placeholder="예: 소화불량, 비염"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-clinic-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-clinic-text-primary mb-1">
                      세부 상태
                    </label>
                    <input
                      type="text"
                      value={templateForm.condition_detail}
                      onChange={(e) => setTemplateForm(prev => ({ ...prev, condition_detail: e.target.value }))}
                      placeholder="예: 급성, 만성, 코막힘"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-clinic-primary"
                    />
                  </div>
                </div>

                {/* 키워드 */}
                <div>
                  <label className="block text-sm font-medium text-clinic-text-primary mb-1">
                    키워드 <span className="text-xs text-gray-400">(쉼표로 구분)</span>
                  </label>
                  <input
                    type="text"
                    value={templateForm.keywords}
                    onChange={(e) => setTemplateForm(prev => ({ ...prev, keywords: e.target.value }))}
                    placeholder="예: 체증, 소화장애, 더부룩함"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-clinic-primary"
                  />
                </div>

                {/* 설명 */}
                <div>
                  <label className="block text-sm font-medium text-clinic-text-primary mb-1">
                    一. 설명
                  </label>
                  <textarea
                    value={templateForm.description}
                    onChange={(e) => setTemplateForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="질환에 대한 설명을 입력하세요..."
                    rows={5}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-clinic-primary resize-none"
                  />
                </div>

                {/* 복용법 */}
                <div>
                  <label className="block text-sm font-medium text-clinic-text-primary mb-1">
                    二. 복용법
                  </label>
                  <textarea
                    value={templateForm.dosage_method}
                    onChange={(e) => setTemplateForm(prev => ({ ...prev, dosage_method: e.target.value }))}
                    placeholder="복용법에 대한 설명을 입력하세요..."
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-clinic-primary resize-none"
                  />
                </div>

                {/* 주의사항 */}
                <div>
                  <label className="block text-sm font-medium text-clinic-text-primary mb-1">
                    三. 주의사항
                  </label>
                  <textarea
                    value={templateForm.precautions}
                    onChange={(e) => setTemplateForm(prev => ({ ...prev, precautions: e.target.value }))}
                    placeholder="주의사항을 입력하세요..."
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-clinic-primary resize-none"
                  />
                </div>
              </div>
            </div>

            {/* 모달 푸터 */}
            <div className="flex gap-3 px-6 py-4 border-t bg-gray-50 flex-shrink-0">
              <button
                onClick={() => setShowTemplateModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 bg-white rounded-lg text-clinic-text-secondary hover:bg-gray-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleSaveTemplate}
                disabled={savingTemplate || !templateForm.category || !templateForm.disease_name}
                className="flex-1 px-4 py-2 bg-clinic-primary text-white rounded-lg hover:bg-opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingTemplate ? (
                  <>
                    <div className="inline-block border-2 border-white border-t-transparent rounded-full w-4 h-4 animate-spin mr-2"></div>
                    저장 중...
                  </>
                ) : (
                  <>
                    <i className="fas fa-save mr-2"></i>
                    {editingTemplate ? '수정' : '추가'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DosageInstructionManagement;
