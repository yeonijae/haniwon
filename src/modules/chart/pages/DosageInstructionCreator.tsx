import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { query, queryOne, execute, insert, escapeString, toSqlValue, getCurrentTimestamp } from '@shared/lib/sqlite';
import { getMultipleRecommendations, generateCustomDescription, type AIRecommendation, type AIGeneratedDescription } from '../services/aiDosageRecommendation';
import type { DosageInstruction, Patient } from '../types';

// 처방전 관리에서 전달받는 데이터 타입
interface PrescriptionState {
  prescriptionId?: number;
  patientName?: string;
  patientAge?: number;
  patientGender?: string;
  formula?: string;
  chiefComplaint?: string;
}

// 음식 주의사항 프리셋
const FOOD_PRESETS = {
  eating_habit: {
    label: '식사 습관',
    items: [
      '아침은 가볍게(100~300kcal)라도 드시고, 5시간에 한번은 식사를 챙겨드세요.',
      '공복이 5시간 이상 되면 작은 간식(100~200kcal)을 드셔도 좋습니다.',
      '밥만 많이 먹으면 혈당이 빠르게 치솟으니, 반찬과 같이 드세요.',
      '밥을 빠르게 드시면 혈당피크가 오니, 천천히 드시는 것이 좋습니다.',
      '식후에 바로 간식이 땡기더라도 식후 30분까지만 참아보세요.',
      '고기→야채→탄수화물 순서로 드시면 혈당 피크를 피할수 있습니다.',
      '당분간 짭짤하게 드셔주는 것이 좋습니다.'
    ]
  },
  carbohydrate: {
    label: '탄수화물',
    items: [
      '쌀가루, 밀가루, 전분가루로 만든 음식(쌀국수, 라면, 당면, 빵, 과자 등)을 주의하세요.',
      '액상과당이 들어간 모든 음료는 피해주세요.',
      '각종 초콜렛, 사탕, 젤리, 과자 종류는 모두 피해주세요.',
      '카레, 짜장, 김밥도 혈당이 급격하게 오르니 적게 드셔야합니다.'
    ]
  },
  meat: {
    label: '고기',
    items: [
      '기름에 튀긴 음식이나 바싹 익힌 고기는 피해주세요.',
      '고기의 기름진 부위는 피해주세요.',
      '물에서 익힌 고기는 괜찮습니다.(수육, 장조림, 국/찌개 속 고기)',
      '고기를 갈아서 만든 음식은 피해주세요.(너겟, 햄, 소세지, 만두 등)'
    ]
  },
  spicy: {
    label: '매운것',
    items: [
      '매운 음식은 대체로 피해주세요.',
      '후추 등의 화한 맛은 괜찮습니다.',
      '김치찌개 정도는 괜찮습니다.',
      '일부러 맵게 만든 음식(매운 떡볶이/불닭 등)은 피해주세요.'
    ]
  },
  beverage: {
    label: '물/음료',
    items: [
      '물은 갈증날때만 드시도록 해주세요.',
      '물은 수시로 자주 드시는 것이 좋습니다.',
      '각종 유제품(우유, 요거트, 치즈 등)은 피해주세요.',
      '소화가 잘되는 우유(락토프리)는 드셔도 괜찮습니다.'
    ]
  },
  caffeine: {
    label: '카페인',
    items: [
      '카페인이 들어간 음료는 피해주세요.(루이보스, 캐모마일 등은 괜찮습니다.)',
      '커피는 하루 최대 1잔만 드셔주세요.',
      '커피는 아예 드시지 않으시는 것이 좋습니다.',
      '디카페인 커피의 화학공정에 쓰이는 약품이 부정맥을 만드는 경우가 있으니 조심하세요.'
    ]
  },
  fruits_vegetables: {
    label: '과일/야채',
    items: [
      '일부러 달게 만들어진 과일은 피해주세요.(특히 열대과일류)',
      '각종 과일은 1/4개까지만 가능합니다.',
      '야채를 일부러 많이 드실 필요는 없습니다.',
      '엽록소가 많은 야채를 드셔주세요.(시금치, 파프리카 등등)',
      '소화에 문제가 없는 경우, 방울토마토, 오이, 양배추 등은 양껏 드셔도 됩니다.'
    ]
  },
  alcohol: {
    label: '술',
    items: [
      '각종 술을 중단해주세요.',
      '발효 상태의 술을 피해주세요.(막걸리, 맥주, 와인 등)',
      '증류된 술은 소량 드셔도 괜찮습니다.(소주, 양주 등)'
    ]
  },
  sticky: {
    label: '끈적한 음식',
    items: [
      'MSG가 많이 들어간 음식을 주의해주세요.(식당에서 국물은 남겨주세요.)',
      '찰기가 있는 음식을 주의해주세요.(떡, 죽, 찹쌀 등)',
      '발효시킨 음식을 주의해주세요.(각종 효소, 요거트, 낫또 등)',
      '느끼한 음식을 주의해주세요.(크림/버터/치즈 베이스 음식 등)'
    ]
  },
  supplements: {
    label: '건기식 및 양약',
    items: [
      '각종 건강기능식품(비타민, 유산균, 미네랄 등등)을 중단해주세요.',
      '각종 피부연고는 중단해주세요.',
      '다음과 같이 협의된 양약 이외에는 중단해주세요.',
      '갑작스레 양약을 드시게 될때는 연락주세요.(감기약, 항생제, 진통제 등등)'
    ]
  }
};

// 협의된 양약 옵션 (2차 선택)
const MEDICINE_OPTIONS = [
  '고혈압약',
  '당뇨약',
  '고지혈증약',
  '갑상선약',
  '심장약'
];

// 협의된 양약 항목 텍스트 (매칭용)
const MEDICINE_AGREEMENT_TEXT = '다음과 같이 협의된 양약 이외에는 중단해주세요.';

// 복용 시간 옵션
const DOSAGE_TIMES = ['아침', '점심', '저녁', '자기전'] as const;

// 1회 복용량 옵션
const DOSAGE_AMOUNTS = ['1팩', '50cc', '40cc', '30cc'] as const;

// 복용방법 기본 템플릿
const DEFAULT_DOSAGE_TEMPLATE = {
  dosageAmount: '1팩' as string,
  selectedTimes: ['아침', '저녁'] as string[],
  timing: '식전/식후 상관없이'
};

// 고정 복용 안내 문구
const FIXED_DOSAGE_NOTICE = `따뜻하게 중탕해서 드세요. ※ 알루미늄팩 전자렌지 사용 불가

○ 한약이 5-6팩 남았을 때, 내원하시거나 전화상담하세요.
○ 감기약, 진통제, 항생제, 스테로이드제 등의 약을 사용할 때는 반드시 상의해 주세요.`;

// 고정 보관 안내 문구
const FIXED_STORAGE_NOTICE = `○ 실온에서 2개월 이상 보관시 변질 우려가 있습니다.
○ 직사광선을 피하고, 서늘한 곳에 보관하세요.
○ 냉장보관 시 엉기는 경우가 있으나 데우면 풀어집니다.`;

// 보관방법 기본 템플릿
const DEFAULT_STORAGE_TEMPLATE = {
  method: '냉장보관',
  duration: 30,
  unit: '일'
};

const DosageInstructionCreator: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const patientId = searchParams.get('patientId');
  const chiefComplaint = searchParams.get('chiefComplaint') || '';

  // 처방전 관리에서 전달받은 데이터
  const prescriptionState = (location.state as PrescriptionState) || {};

  // 상태
  const [patient, setPatient] = useState<Patient | null>(null);
  const prescriptionId = prescriptionState.prescriptionId;
  const [templates, setTemplates] = useState<DosageInstruction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // 선택된 템플릿 및 편집 상태
  const [selectedTemplate, setSelectedTemplate] = useState<DosageInstruction | null>(null);
  const [description, setDescription] = useState('');
  const [dosageMethod, setDosageMethod] = useState(DEFAULT_DOSAGE_TEMPLATE);
  const [dosageNotice, setDosageNotice] = useState(FIXED_DOSAGE_NOTICE);
  const [storageMethod, setStorageMethod] = useState(DEFAULT_STORAGE_TEMPLATE);
  const [storageNotice, setStorageNotice] = useState(FIXED_STORAGE_NOTICE);
  const [selectedFoods, setSelectedFoods] = useState<string[]>([]);
  const [selectedMedicines, setSelectedMedicines] = useState<string[]>([]);
  const [customMedicine, setCustomMedicine] = useState('');
  const [customPrecautions, setCustomPrecautions] = useState('');

  // AI 추천 상태
  const [aiRecommendations, setAiRecommendations] = useState<AIRecommendation[]>([]);
  const [aiGenerated, setAiGenerated] = useState<AIGeneratedDescription | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiInputComplaint, setAiInputComplaint] = useState('');

  // AI 생성 저장 모달 상태
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveForm, setSaveForm] = useState({
    diseaseName: '',
    category: '',
    conditionDetail: ''
  });
  const [saving, setSaving] = useState(false);

  // 주의사항 프리셋 저장 상태 (DB에서 로드)
  const [savedPresets, setSavedPresets] = useState<Record<string, string[]>>({});
  const [showPresetModal, setShowPresetModal] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [presetsLoading, setPresetsLoading] = useState(true);

  useEffect(() => {
    loadTemplates();
    loadPresetsFromDB();
    if (patientId) {
      loadPatient(patientId);
    }
    // 처방전 관리에서 전달받은 환자 정보로 초기화
    if (prescriptionState.patientName) {
      setPatient({
        id: 0,
        name: prescriptionState.patientName,
        gender: prescriptionState.patientGender as 'male' | 'female' | undefined
      });
    }
    // 기존 복용법 데이터 로드
    if (prescriptionState.prescriptionId) {
      loadExistingDosageInstruction(prescriptionState.prescriptionId);
    }
  }, [patientId]);

  // DB에서 프리셋 로드
  const loadPresetsFromDB = async () => {
    try {
      setPresetsLoading(true);
      const data = await query<{ name: string; items: string }>(
        `SELECT name, items FROM precaution_presets ORDER BY created_at DESC`
      );

      const presetsMap: Record<string, string[]> = {};
      (data || []).forEach((preset) => {
        let items: string[] = [];
        if (typeof preset.items === 'string') {
          try { items = JSON.parse(preset.items); } catch { items = []; }
        } else if (Array.isArray(preset.items)) {
          items = preset.items;
        }
        presetsMap[preset.name] = items;
      });
      setSavedPresets(presetsMap);
    } catch (error) {
      console.error('프리셋 로드 실패:', error);
    } finally {
      setPresetsLoading(false);
    }
  };

  // 기존 복용법 데이터 로드
  const loadExistingDosageInstruction = async (prescId: number) => {
    try {
      const data = await queryOne<{ dosage_instruction_data: string }>(
        `SELECT dosage_instruction_data FROM prescriptions WHERE id = ${prescId}`
      );

      if (data?.dosage_instruction_data) {
        let d: any;
        if (typeof data.dosage_instruction_data === 'string') {
          try { d = JSON.parse(data.dosage_instruction_data); } catch { return; }
        } else {
          d = data.dosage_instruction_data;
        }
        if (d.description) setDescription(d.description);
        if (d.dosageMethod) setDosageMethod(d.dosageMethod);
        if (d.dosageNotice) setDosageNotice(d.dosageNotice);
        if (d.storageMethod) setStorageMethod(d.storageMethod);
        if (d.storageNotice) setStorageNotice(d.storageNotice);
        if (d.selectedFoods) setSelectedFoods(d.selectedFoods);
        if (d.selectedMedicines) setSelectedMedicines(d.selectedMedicines);
        if (d.customMedicine) setCustomMedicine(d.customMedicine);
        if (d.customPrecautions) setCustomPrecautions(d.customPrecautions);
      }
    } catch (error) {
      console.error('기존 복용법 로드 실패:', error);
    }
  };

  const loadPatient = async (id: string) => {
    try {
      const data = await queryOne<Patient>(
        `SELECT * FROM patients WHERE id = ${id}`
      );
      if (data) {
        setPatient(data);
      }
    } catch (error) {
      console.error('환자 정보 로드 실패:', error);
    }
  };

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const data = await query<DosageInstruction>(
        `SELECT * FROM dosage_instructions ORDER BY category, disease_name`
      );

      // keywords가 JSON 문자열일 수 있으므로 파싱
      const templates = (data || []).map(t => {
        let keywords: string[] = [];
        if (typeof t.keywords === 'string') {
          try { keywords = JSON.parse(t.keywords); } catch { keywords = []; }
        } else if (Array.isArray(t.keywords)) {
          keywords = t.keywords;
        }
        return { ...t, keywords };
      });

      console.log('템플릿 로드 완료:', templates.length, '개');
      setTemplates(templates);
    } catch (error) {
      console.error('복용법 템플릿 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  // AI 추천 요청
  const handleAIRecommend = async () => {
    if (!aiInputComplaint.trim()) {
      alert('주소증을 입력해주세요.');
      return;
    }
    if (templates.length === 0) {
      alert('템플릿이 로드되지 않았습니다.');
      return;
    }

    setAiLoading(true);
    setAiRecommendations([]);
    setAiGenerated(null);

    try {
      // 환자 나이 계산
      let age: number | undefined;
      if (patient?.dob) {
        const birthDate = new Date(patient.dob);
        const today = new Date();
        age = today.getFullYear() - birthDate.getFullYear();
      }

      const patientContext = {
        name: patient?.name || prescriptionState.patientName,
        age: age || prescriptionState.patientAge,
        gender: patient?.gender || prescriptionState.patientGender as 'male' | 'female' | undefined,
        chiefComplaint: aiInputComplaint
      };

      // 병렬로 추천과 생성 실행
      const [recommendations, generated] = await Promise.all([
        getMultipleRecommendations(patientContext, templates, 3),
        generateCustomDescription(patientContext, templates)
      ]);

      setAiRecommendations(recommendations);
      setAiGenerated(generated);

      if (recommendations.length === 0 && !generated) {
        alert('AI 추천 결과가 없습니다. 직접 검색해주세요.');
      }
    } catch (error) {
      console.error('AI 추천 오류:', error);
      alert('AI 추천 중 오류가 발생했습니다.');
    } finally {
      setAiLoading(false);
    }
  };

  // AI 추천 항목 선택
  const handleSelectAIRecommendation = (recommendation: AIRecommendation) => {
    const template = templates.find(t => t.id === recommendation.recommendedId);
    if (template) {
      handleSelectTemplate(template);
    }
  };

  // AI 생성 설명 사용
  const handleUseAIGenerated = () => {
    if (aiGenerated) {
      setSelectedTemplate(null);
      setDescription(addLineBreaks(aiGenerated.description));
    }
  };

  // AI 생성 저장 모달 열기
  const handleOpenSaveModal = () => {
    if (aiGenerated) {
      setSaveForm({
        diseaseName: aiGenerated.title,
        category: '',
        conditionDetail: ''
      });
      setShowSaveModal(true);
    }
  };

  // AI 생성 설명 DB 저장
  const handleSaveAIGenerated = async () => {
    if (!aiGenerated || !saveForm.diseaseName || !saveForm.category) {
      alert('질환명과 카테고리를 입력해주세요.');
      return;
    }

    setSaving(true);
    try {
      const now = getCurrentTimestamp();
      const keywordsArray = [saveForm.diseaseName, ...aiInputComplaint.split(/[\s,]+/).filter(k => k.length >= 2)];
      const keywordsJson = JSON.stringify(keywordsArray);

      await insert(`
        INSERT INTO dosage_instructions (category, disease_name, condition_detail, description, keywords, source_filename, created_at, updated_at)
        VALUES (
          ${escapeString(saveForm.category)},
          ${escapeString(saveForm.diseaseName)},
          ${toSqlValue(saveForm.conditionDetail)},
          ${escapeString(aiGenerated.description)},
          ${escapeString(keywordsJson)},
          ${escapeString('AI 생성')},
          ${escapeString(now)},
          ${escapeString(now)}
        )
      `);

      alert('AI 생성 설명이 템플릿으로 저장되었습니다.');
      setShowSaveModal(false);
      // 템플릿 목록 새로고침
      loadTemplates();
    } catch (error) {
      console.error('저장 실패:', error);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  // 검색 필터링
  const filteredTemplates = useMemo(() => {
    if (searchTerm.length < 2) return [];
    const term = searchTerm.toLowerCase();
    const results = templates.filter(t => {
      // 질환명 검색
      if (t.disease_name?.toLowerCase().includes(term)) return true;
      // 세부 상태 검색
      if (t.condition_detail?.toLowerCase().includes(term)) return true;
      // 소분류 검색
      if (t.subcategory?.toLowerCase().includes(term)) return true;
      // 카테고리 검색
      if (t.category?.toLowerCase().includes(term)) return true;
      // 키워드 검색
      if (t.keywords?.some(k => k.toLowerCase().includes(term))) return true;
      // 전체 텍스트 검색
      if (t.full_text?.toLowerCase().includes(term)) return true;
      return false;
    });
    console.log(`검색어 "${searchTerm}" 결과:`, results.length, '개');
    return results.slice(0, 30);
  }, [templates, searchTerm]);

  // 텍스트에 구분자로 줄바꿈 추가
  const addLineBreaks = (text: string) => {
    if (!text) return '';
    // ○, ①②③④⑤⑥⑦⑧⑨⑩ 등 앞에 줄바꿈 추가 (이미 줄 시작이 아닌 경우)
    return text
      .replace(/([^\n])([○●◎])/g, '$1\n$2')
      .replace(/([^\n])([①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳])/g, '$1\n$2')
      .trim();
  };

  // 템플릿 선택
  const handleSelectTemplate = (template: DosageInstruction) => {
    setSelectedTemplate(template);
    // 설명에 줄바꿈 처리 적용
    setDescription(addLineBreaks(template.description || ''));
    // 기존 주의사항에서 음식 관련 키워드 추출하여 선택
    if (template.precautions) {
      const foods: string[] = [];
      Object.values(FOOD_PRESETS).forEach(preset => {
        preset.items.forEach(item => {
          if (template.precautions?.includes(item)) {
            foods.push(item);
          }
        });
      });
      setSelectedFoods(foods);
      setCustomPrecautions(addLineBreaks(template.precautions));
    }
  };

  // 음식 토글
  const toggleFood = (food: string) => {
    setSelectedFoods(prev =>
      prev.includes(food)
        ? prev.filter(f => f !== food)
        : [...prev, food]
    );
  };

  // 프리셋 전체 선택/해제
  const togglePreset = (presetKey: keyof typeof FOOD_PRESETS) => {
    const preset = FOOD_PRESETS[presetKey];
    const allSelected = preset.items.every(item => selectedFoods.includes(item));

    if (allSelected) {
      setSelectedFoods(prev => prev.filter(f => !preset.items.includes(f)));
    } else {
      setSelectedFoods(prev => [...new Set([...prev, ...preset.items])]);
    }
  };

  // 선택 항목 리셋
  const resetSelectedFoods = () => {
    setSelectedFoods([]);
  };

  // 현재 선택을 프리셋으로 저장 (DB에 저장)
  const saveAsPreset = async () => {
    if (!presetName.trim()) {
      alert('프리셋 이름을 입력해주세요.');
      return;
    }
    if (selectedFoods.length === 0) {
      alert('저장할 항목을 선택해주세요.');
      return;
    }

    try {
      const now = getCurrentTimestamp();
      const itemsJson = JSON.stringify(selectedFoods);
      const trimmedName = presetName.trim();

      // 기존 프리셋이 있는지 확인
      const existing = await queryOne<{ id: number }>(
        `SELECT id FROM precaution_presets WHERE name = ${escapeString(trimmedName)}`
      );

      if (existing) {
        // 업데이트
        await execute(`
          UPDATE precaution_presets SET items = ${escapeString(itemsJson)}, updated_at = ${escapeString(now)}
          WHERE name = ${escapeString(trimmedName)}
        `);
      } else {
        // 삽입
        await insert(`
          INSERT INTO precaution_presets (name, items, created_at, updated_at)
          VALUES (${escapeString(trimmedName)}, ${escapeString(itemsJson)}, ${escapeString(now)}, ${escapeString(now)})
        `);
      }

      // 로컬 상태 업데이트
      setSavedPresets(prev => ({
        ...prev,
        [trimmedName]: selectedFoods
      }));
      setShowPresetModal(false);
      setPresetName('');
      alert(`"${trimmedName}" 프리셋이 저장되었습니다.`);
    } catch (error) {
      console.error('프리셋 저장 실패:', error);
      alert('프리셋 저장에 실패했습니다.');
    }
  };

  // 저장된 프리셋 불러오기
  const loadSavedPreset = (name: string) => {
    const preset = savedPresets[name];
    if (preset) {
      setSelectedFoods(preset);
    }
  };

  // 저장된 프리셋 삭제 (DB에서 삭제)
  const deleteSavedPreset = async (name: string) => {
    if (confirm(`"${name}" 프리셋을 삭제하시겠습니까?`)) {
      try {
        await execute(`DELETE FROM precaution_presets WHERE name = ${escapeString(name)}`);

        // 로컬 상태 업데이트
        setSavedPresets(prev => {
          const newPresets = { ...prev };
          delete newPresets[name];
          return newPresets;
        });
      } catch (error) {
        console.error('프리셋 삭제 실패:', error);
        alert('프리셋 삭제에 실패했습니다.');
      }
    }
  };

  // 복용법 데이터 객체 생성
  const getDosageInstructionData = () => ({
    description,
    dosageMethod,
    dosageNotice,
    storageMethod,
    storageNotice,
    selectedFoods,
    selectedMedicines,
    customMedicine,
    customPrecautions
  });

  // 복용법 저장
  const saveDosageInstruction = async () => {
    if (!prescriptionId) {
      alert('처방전 정보가 없어 저장할 수 없습니다.');
      return;
    }

    try {
      const now = new Date().toISOString();
      const dataJson = JSON.stringify(getDosageInstructionData());

      await execute(`
        UPDATE prescriptions SET
          dosage_instruction_created = 1,
          dosage_instruction_created_at = ${escapeString(now)},
          dosage_instruction_data = ${escapeString(dataJson)}
        WHERE id = ${prescriptionId}
      `);

      alert('복용법이 저장되었습니다.');
    } catch (error) {
      console.error('복용법 저장 실패:', error);
      alert('복용법 저장에 실패했습니다.');
    }
  };

  // 처방전 복용법 작성 상태 업데이트 (인쇄 시)
  const updatePrescriptionDosageStatus = async () => {
    if (!prescriptionId) return;

    try {
      const now = new Date().toISOString();
      const dataJson = JSON.stringify(getDosageInstructionData());

      await execute(`
        UPDATE prescriptions SET
          dosage_instruction_created = 1,
          dosage_instruction_created_at = ${escapeString(now)},
          dosage_instruction_data = ${escapeString(dataJson)}
        WHERE id = ${prescriptionId}
      `);
    } catch (error) {
      console.error('처방전 복용법 상태 업데이트 실패:', error);
    }
  };

  // 인쇄 기능
  const handlePrint = () => {
    const printContent = generatePrintContent();
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.onload = () => {
        printWindow.print();
      };
      // 처방전 복용법 작성 상태 업데이트
      updatePrescriptionDosageStatus();
    }
  };

  // 인쇄용 HTML 생성
  const generatePrintContent = () => {
    const today = new Date().toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>복용법 안내문</title>
  <style>
    @page {
      size: A4;
      margin: 15mm;
    }
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Malgun Gothic', '맑은 고딕', sans-serif;
      font-size: 11pt;
      line-height: 1.6;
      color: #333;
    }
    .header {
      text-align: center;
      border-bottom: 2px solid #2563eb;
      padding-bottom: 15px;
      margin-bottom: 20px;
    }
    .header h1 {
      font-size: 20pt;
      color: #2563eb;
      margin-bottom: 5px;
    }
    .header .clinic {
      font-size: 10pt;
      color: #666;
    }
    .header .date {
      font-size: 9pt;
      color: #999;
      margin-top: 5px;
    }
    .patient-info {
      background: #f8fafc;
      padding: 10px 15px;
      border-radius: 5px;
      margin-bottom: 20px;
      font-size: 10pt;
    }
    .section {
      margin-bottom: 20px;
      page-break-inside: avoid;
    }
    .section-title {
      font-size: 12pt;
      font-weight: bold;
      color: #1e40af;
      border-left: 4px solid #2563eb;
      padding-left: 10px;
      margin-bottom: 10px;
    }
    .section-content {
      padding-left: 14px;
      white-space: pre-wrap;
    }
    .dosage-highlight {
      background: #ecfdf5;
      padding: 10px 15px;
      border-radius: 5px;
      font-weight: 500;
      color: #065f46;
      margin-bottom: 10px;
    }
    .storage-highlight {
      background: #ecfeff;
      padding: 10px 15px;
      border-radius: 5px;
      font-weight: 500;
      color: #0e7490;
      margin-bottom: 10px;
    }
    .warning {
      color: #dc2626;
      font-weight: bold;
    }
    .precaution-item {
      margin-bottom: 5px;
    }
    .footer {
      margin-top: 30px;
      padding-top: 15px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      font-size: 9pt;
      color: #666;
    }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>복용법 안내문</h1>
    <div class="clinic">연이재한의원</div>
    <div class="date">${today}</div>
  </div>

  ${patient ? `
  <div class="patient-info">
    <strong>환자:</strong> ${patient.name} ${patient.chart_number ? `(${patient.chart_number})` : ''}
  </div>
  ` : ''}

  ${description ? `
  <div class="section">
    <div class="section-title">一. 설명</div>
    <div class="section-content">${description.replace(/\n/g, '<br>')}</div>
  </div>
  ` : ''}

  <div class="section">
    <div class="section-title">二. 복용방법</div>
    <div class="dosage-highlight">${generateDosageText()}</div>
    <div class="section-content">${dosageNotice.replace(/※.*전자렌지.*불가/g, '<span class="warning">$&</span>').replace(/\n/g, '<br>')}</div>
  </div>

  <div class="section">
    <div class="section-title">三. 보관방법</div>
    <div class="storage-highlight">${generateStorageText()}</div>
    <div class="section-content">${storageNotice.replace(/\n/g, '<br>')}</div>
  </div>

  ${selectedFoods.length > 0 || customPrecautions ? `
  <div class="section">
    <div class="section-title">四. 주의사항</div>
    <div class="section-content">
      ${selectedFoods.map(item => {
        if (item === MEDICINE_AGREEMENT_TEXT && (selectedMedicines.length > 0 || customMedicine)) {
          const allMeds = [...selectedMedicines, customMedicine].filter(Boolean);
          return `<div class="precaution-item">□ ${item}<br/><span style="margin-left: 20px; color: #1565c0;">  → ${allMeds.join(', ')}</span></div>`;
        }
        return `<div class="precaution-item">□ ${item}</div>`;
      }).join('')}
      ${customPrecautions ? `<div style="margin-top: 10px;">${customPrecautions.replace(/\n/g, '<br>')}</div>` : ''}
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
  };

  // 복용법 텍스트 생성
  const generateDosageText = () => {
    const { dosageAmount, selectedTimes, timing } = dosageMethod;
    const timesCount = selectedTimes.length;
    const timesText = selectedTimes.join(', ');
    return `하루 ${timesCount}회(${timesText}), 1회 ${dosageAmount}씩 ${timing} 드세요.`;
  };

  // 보관방법 텍스트 생성
  const generateStorageText = () => {
    const { method, duration, unit } = storageMethod;
    return `${method}하며, ${duration}${unit} 이내에 드세요.`;
  };

  // 주의사항 텍스트 생성
  const generatePrecautionsText = () => {
    let text = '';
    if (selectedFoods.length > 0) {
      // 각 항목을 □ 체크박스 형태로 줄바꿈해서 표시
      text = selectedFoods.map(item => {
        if (item === MEDICINE_AGREEMENT_TEXT && (selectedMedicines.length > 0 || customMedicine)) {
          const allMeds = [...selectedMedicines, customMedicine].filter(Boolean);
          return `□ ${item}\n   → ${allMeds.join(', ')}`;
        }
        return `□ ${item}`;
      }).join('\n');
    }
    if (customPrecautions) {
      text += text ? '\n\n' + customPrecautions : customPrecautions;
    }
    return text;
  };

  // 텍스트 포맷팅 (줄바꿈 및 원숫자 들여쓰기)
  const formatText = (text: string) => {
    if (!text) return null;

    // 원숫자 패턴
    const circledNumbers = /[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳]/;

    return text.split('\n').map((line, index) => {
      const trimmedLine = line.trim();
      const hasCircledNumber = circledNumbers.test(trimmedLine);

      // ※ 전자렌지 관련 경고 문구 빨간색 처리
      let content: React.ReactNode = trimmedLine || '\u00A0';
      if (trimmedLine.includes('※') && trimmedLine.includes('전자렌지')) {
        // ※부터 끝까지 빨간색
        const warningIndex = trimmedLine.indexOf('※');
        const beforeWarning = trimmedLine.substring(0, warningIndex);
        const warningText = trimmedLine.substring(warningIndex);
        content = (
          <>
            {beforeWarning}
            <span className="text-red-600 font-semibold">{warningText}</span>
          </>
        );
      }

      return (
        <div
          key={index}
          className={hasCircledNumber ? 'pl-4 my-1' : ''}
          style={{ minHeight: trimmedLine ? 'auto' : '0.5em' }}
        >
          {content}
        </div>
      );
    });
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex flex-col items-center justify-center p-8 text-clinic-text-secondary">
          <div className="border-4 border-clinic-background border-t-clinic-primary rounded-full w-12 h-12 animate-spin mb-4"></div>
          <p>복용법 템플릿을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="max-w-7xl mx-auto w-full p-6 flex-1 flex flex-col overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(prescriptionId ? '/chart/prescriptions' : '/chart/dosage-instructions')}
              className="text-clinic-text-secondary hover:text-clinic-primary transition-colors"
            >
              <i className="fas fa-arrow-left text-xl"></i>
            </button>
            <h1 className="text-2xl font-bold text-clinic-text-primary">
              복용법 작성
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {(patient || prescriptionState.patientName) && (
              <div className="bg-clinic-primary bg-opacity-10 px-4 py-2 rounded-lg flex items-center gap-2">
                <span className="text-clinic-primary font-medium">
                  {patient?.name || prescriptionState.patientName}
                  {(patient?.chart_number) && ` (${patient.chart_number})`}
                  {prescriptionState.patientAge && ` ${prescriptionState.patientAge}세`}
                  {prescriptionState.patientGender && ` ${prescriptionState.patientGender === 'male' ? '남' : prescriptionState.patientGender === 'female' ? '여' : ''}`}
                </span>
                {prescriptionState.formula && (
                  <span className="text-clinic-text-secondary text-sm border-l border-clinic-primary border-opacity-30 pl-2 ml-1">
                    {prescriptionState.formula}
                  </span>
                )}
              </div>
            )}
            <button
              onClick={() => setShowPreviewModal(true)}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
            >
              <i className="fas fa-eye"></i>
              미리보기
            </button>
          </div>
        </div>

        {/* 메인 컨텐츠 */}
        <div className="flex gap-4 flex-1 overflow-hidden">
          {/* 왼쪽: 선택 영역 */}
          <div className="w-1/2 overflow-auto space-y-4">
            {/* 템플릿 검색 */}
            <div className="bg-white rounded-lg shadow-sm p-4">
              <h2 className="font-semibold text-clinic-text-primary mb-3">
                <i className="fas fa-search mr-2 text-clinic-primary"></i>
                템플릿 검색
              </h2>
              <input
                type="text"
                placeholder="질환명, 증상으로 검색 (2글자 이상)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-clinic-primary focus:ring-2 focus:ring-clinic-primary focus:ring-opacity-20"
              />
              {filteredTemplates.length > 0 && (
                <div className="mt-3 max-h-48 overflow-auto border rounded-lg">
                  {filteredTemplates.map(t => (
                    <div
                      key={t.id}
                      onClick={() => handleSelectTemplate(t)}
                      className={`px-3 py-2 cursor-pointer border-b last:border-b-0 transition-colors ${
                        selectedTemplate?.id === t.id
                          ? 'bg-clinic-primary bg-opacity-10 border-l-4 border-l-clinic-primary'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <span className="font-medium">{t.disease_name}</span>
                      {t.condition_detail && (
                        <span className="text-clinic-text-secondary ml-1">
                          - {t.condition_detail}
                        </span>
                      )}
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded ml-2">
                        {t.category}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* AI 추천 */}
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg shadow-sm p-4 border border-purple-200">
              <h2 className="font-semibold text-clinic-text-primary mb-3">
                <i className="fas fa-robot mr-2 text-purple-500"></i>
                AI 추천
                <span className="text-xs font-normal text-purple-500 ml-2">Gemini</span>
              </h2>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="환자의 주소증을 입력하세요..."
                  value={aiInputComplaint}
                  onChange={(e) => setAiInputComplaint(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAIRecommend()}
                  className="flex-1 px-4 py-2 border border-purple-300 rounded-lg focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500 focus:ring-opacity-20"
                />
                {(prescriptionState.chiefComplaint || chiefComplaint) && (
                  <button
                    onClick={() => setAiInputComplaint(prescriptionState.chiefComplaint || chiefComplaint)}
                    className="px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors flex items-center gap-1 text-sm whitespace-nowrap"
                    title="환자 진료의 주소증을 붙여넣습니다"
                  >
                    <i className="fas fa-paste"></i>
                    주소증
                  </button>
                )}
                <button
                  onClick={handleAIRecommend}
                  disabled={aiLoading}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {aiLoading ? (
                    <>
                      <div className="border-2 border-white border-t-transparent rounded-full w-4 h-4 animate-spin"></div>
                      분석중
                    </>
                  ) : (
                    <>
                      <i className="fas fa-magic"></i>
                      추천
                    </>
                  )}
                </button>
              </div>
              {/* AI 추천 결과 */}
              {aiRecommendations.length > 0 && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs text-purple-600 font-medium">추천 결과 (클릭하여 선택)</p>
                  {aiRecommendations.map((rec, idx) => (
                    <div
                      key={rec.recommendedId}
                      onClick={() => handleSelectAIRecommendation(rec)}
                      className={`p-3 rounded-lg cursor-pointer transition-all border ${
                        selectedTemplate?.id === rec.recommendedId
                          ? 'bg-purple-100 border-purple-400'
                          : 'bg-white border-purple-200 hover:border-purple-400'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            rec.confidence === 'high'
                              ? 'bg-green-100 text-green-700'
                              : rec.confidence === 'medium'
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-gray-100 text-gray-600'
                          }`}>
                            {idx + 1}순위
                          </span>
                          <span className="font-medium text-clinic-text-primary">
                            {rec.diseaseName}
                          </span>
                        </div>
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                          {rec.category}
                        </span>
                      </div>
                      <p className="text-xs text-clinic-text-secondary mt-1">
                        {rec.reason}
                      </p>
                    </div>
                  ))}
                </div>
              )}
              {/* AI 생성 설명 */}
              {aiGenerated && (
                <div className="mt-4 pt-4 border-t border-purple-200">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-purple-600 font-medium">
                      <i className="fas fa-wand-magic-sparkles mr-1"></i>
                      AI 맞춤 생성
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={handleOpenSaveModal}
                        className="text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                      >
                        <i className="fas fa-save mr-1"></i>
                        템플릿 저장
                      </button>
                      <button
                        onClick={handleUseAIGenerated}
                        className="text-xs px-2 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
                      >
                        이 설명 사용
                      </button>
                    </div>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-purple-200">
                    <p className="font-medium text-clinic-text-primary mb-2">
                      {aiGenerated.title}
                    </p>
                    <p className="text-sm text-clinic-text-secondary whitespace-pre-wrap line-clamp-4">
                      {aiGenerated.description}
                    </p>
                    <p className="text-xs text-gray-400 mt-2">
                      참고: {aiGenerated.basedOn.join(', ')}
                    </p>
                  </div>
                </div>
              )}
              {!import.meta.env.VITE_GEMINI_API_KEY && (
                <p className="text-xs text-orange-600 mt-2">
                  <i className="fas fa-exclamation-triangle mr-1"></i>
                  Gemini API Key가 설정되지 않았습니다. .env.local에 VITE_GEMINI_API_KEY를 추가하세요.
                </p>
              )}
            </div>

            {/* 복용방법 설정 */}
            <div className="bg-white rounded-lg shadow-sm p-4">
              <h2 className="font-semibold text-clinic-text-primary mb-3">
                <i className="fas fa-pills mr-2 text-green-500"></i>
                복용방법
              </h2>
              {/* 복용 시간 체크박스 */}
              <div className="mb-3">
                <label className="text-sm text-clinic-text-secondary">복용 시간 (복수 선택)</label>
                <div className="flex gap-2 mt-1 flex-wrap">
                  {DOSAGE_TIMES.map(time => (
                    <label
                      key={time}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg cursor-pointer transition-colors text-sm ${
                        dosageMethod.selectedTimes.includes(time)
                          ? 'bg-green-500 text-white'
                          : 'bg-gray-100 text-clinic-text-secondary hover:bg-gray-200'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={dosageMethod.selectedTimes.includes(time)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setDosageMethod(prev => ({
                              ...prev,
                              selectedTimes: [...prev.selectedTimes, time].sort((a, b) =>
                                DOSAGE_TIMES.indexOf(a as typeof DOSAGE_TIMES[number]) - DOSAGE_TIMES.indexOf(b as typeof DOSAGE_TIMES[number])
                              )
                            }));
                          } else {
                            setDosageMethod(prev => ({
                              ...prev,
                              selectedTimes: prev.selectedTimes.filter(t => t !== time)
                            }));
                          }
                        }}
                        className="hidden"
                      />
                      {time}
                    </label>
                  ))}
                </div>
                {dosageMethod.selectedTimes.length === 0 && (
                  <p className="text-xs text-red-500 mt-1">최소 1개 이상 선택해주세요</p>
                )}
              </div>
              {/* 1회 복용량 선택 */}
              <div className="mb-3">
                <label className="text-sm text-clinic-text-secondary">1회 복용량</label>
                <div className="flex gap-2 mt-1 flex-wrap">
                  {DOSAGE_AMOUNTS.map(amount => (
                    <button
                      key={amount}
                      onClick={() => setDosageMethod(prev => ({ ...prev, dosageAmount: amount }))}
                      className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                        dosageMethod.dosageAmount === amount
                          ? 'bg-green-500 text-white'
                          : 'bg-gray-100 text-clinic-text-secondary hover:bg-gray-200'
                      }`}
                    >
                      {amount}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm text-clinic-text-secondary">복용 시점</label>
                <select
                    value={dosageMethod.timing}
                    onChange={(e) => setDosageMethod(prev => ({ ...prev, timing: e.target.value }))}
                    className="w-full mt-1 px-2 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:border-clinic-primary text-sm"
                  >
                    <option value="식전/식후 상관없이">식전/식후 상관없이</option>
                    <option value="식전 30분">식전 30분</option>
                    <option value="식후 30분~1시간">식후 30분~1시간</option>
                    <option value="공복에">공복에</option>
                    <option value="취침 전">취침 전</option>
                  </select>
                </div>
              {/* 복용 안내 문구 */}
              <div className="mt-3">
                <label className="text-sm text-clinic-text-secondary">복용 안내 (수정 가능)</label>
                <textarea
                  value={dosageNotice}
                  onChange={(e) => setDosageNotice(e.target.value)}
                  rows={6}
                  className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-clinic-primary text-sm resize-none"
                />
              </div>
            </div>

            {/* 보관방법 설정 */}
            <div className="bg-white rounded-lg shadow-sm p-4">
              <h2 className="font-semibold text-clinic-text-primary mb-3">
                <i className="fas fa-snowflake mr-2 text-cyan-500"></i>
                보관방법
              </h2>
              <div className="flex items-center gap-3 flex-wrap">
                <select
                  value={storageMethod.method}
                  onChange={(e) => setStorageMethod(prev => ({ ...prev, method: e.target.value }))}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:border-clinic-primary text-sm"
                >
                  <option value="냉장보관">냉장보관</option>
                  <option value="냉동보관">냉동보관</option>
                  <option value="실온보관">실온보관</option>
                </select>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={storageMethod.duration}
                    onChange={(e) => setStorageMethod(prev => ({ ...prev, duration: Number(e.target.value) }))}
                    min={1}
                    max={90}
                    className="w-16 px-2 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:border-clinic-primary text-center text-sm"
                  />
                  <select
                    value={storageMethod.unit}
                    onChange={(e) => setStorageMethod(prev => ({ ...prev, unit: e.target.value }))}
                    className="px-2 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:border-clinic-primary text-sm"
                  >
                    <option value="일">일</option>
                    <option value="주">주</option>
                    <option value="개월">개월</option>
                  </select>
                  <span className="text-sm text-clinic-text-secondary">이내</span>
                </div>
              </div>
              {/* 보관 안내 문구 */}
              <div className="mt-3">
                <label className="text-sm text-clinic-text-secondary">보관 안내 (수정 가능)</label>
                <textarea
                  value={storageNotice}
                  onChange={(e) => setStorageNotice(e.target.value)}
                  rows={4}
                  className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-clinic-primary text-sm resize-none"
                />
              </div>
            </div>

            {/* 음식 주의사항 */}
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-clinic-text-primary">
                  <i className="fas fa-utensils mr-2 text-orange-500"></i>
                  주의사항 선택
                  {selectedFoods.length > 0 && (
                    <span className="text-xs font-normal text-orange-500 ml-2">
                      ({selectedFoods.length}개 선택)
                    </span>
                  )}
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={resetSelectedFoods}
                    disabled={selectedFoods.length === 0}
                    className="text-xs px-2 py-1 text-gray-500 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title="선택 초기화"
                  >
                    <i className="fas fa-rotate-left mr-1"></i>
                    리셋
                  </button>
                  <button
                    onClick={() => setShowPresetModal(true)}
                    disabled={selectedFoods.length === 0}
                    className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <i className="fas fa-save mr-1"></i>
                    프리셋 저장
                  </button>
                </div>
              </div>

              {/* 저장된 프리셋 목록 */}
              {Object.keys(savedPresets).length > 0 && (
                <div className="mb-3 p-2 bg-blue-50 rounded-lg">
                  <p className="text-xs text-blue-600 font-medium mb-2">
                    <i className="fas fa-bookmark mr-1"></i>
                    저장된 프리셋
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(savedPresets).map(([name, items]) => (
                      <div key={name} className="flex items-center gap-1 bg-white rounded border border-blue-200">
                        <button
                          onClick={() => loadSavedPreset(name)}
                          className="text-xs px-2 py-1 text-blue-700 hover:bg-blue-50 transition-colors"
                        >
                          {name} ({items.length})
                        </button>
                        <button
                          onClick={() => deleteSavedPreset(name)}
                          className="text-xs px-1.5 py-1 text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <i className="fas fa-times"></i>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-4 max-h-96 overflow-auto">
                {Object.entries(FOOD_PRESETS).map(([key, preset]) => {
                  const presetKey = key as keyof typeof FOOD_PRESETS;
                  const selectedCount = preset.items.filter(item => selectedFoods.includes(item)).length;
                  const allSelected = selectedCount === preset.items.length;

                  return (
                    <div key={key} className="border border-gray-200 rounded-lg overflow-hidden">
                      <button
                        onClick={() => togglePreset(presetKey)}
                        className={`w-full flex items-center justify-between px-3 py-2 text-sm font-medium transition-colors ${
                          allSelected
                            ? 'bg-orange-500 text-white'
                            : selectedCount > 0
                            ? 'bg-orange-100 text-orange-700'
                            : 'bg-gray-50 text-clinic-text-primary hover:bg-gray-100'
                        }`}
                      >
                        <span>{preset.label}</span>
                        <span className="text-xs">
                          {selectedCount > 0 && `${selectedCount}/${preset.items.length}`}
                        </span>
                      </button>
                      <div className="p-2 space-y-1 bg-white">
                        {preset.items.map(item => (
                          <div key={item}>
                            <label
                              className={`flex items-start gap-2 p-1.5 rounded cursor-pointer transition-colors text-xs ${
                                selectedFoods.includes(item)
                                  ? 'bg-orange-50'
                                  : 'hover:bg-gray-50'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={selectedFoods.includes(item)}
                                onChange={() => toggleFood(item)}
                                className="mt-0.5 accent-orange-500"
                              />
                              <span className={selectedFoods.includes(item) ? 'text-orange-700' : 'text-clinic-text-secondary'}>
                                {item}
                              </span>
                            </label>
                            {/* 협의된 양약 2차 선택 */}
                            {item === MEDICINE_AGREEMENT_TEXT && selectedFoods.includes(item) && (
                              <div className="ml-6 mt-2 p-2 bg-blue-50 rounded-lg border border-blue-200">
                                <div className="text-xs text-blue-700 font-medium mb-2">협의된 양약 선택:</div>
                                <div className="flex flex-wrap gap-2">
                                  {MEDICINE_OPTIONS.map(med => (
                                    <label key={med} className="flex items-center gap-1 text-xs cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={selectedMedicines.includes(med)}
                                        onChange={() => {
                                          setSelectedMedicines(prev =>
                                            prev.includes(med)
                                              ? prev.filter(m => m !== med)
                                              : [...prev, med]
                                          );
                                        }}
                                        className="accent-blue-500"
                                      />
                                      <span className={selectedMedicines.includes(med) ? 'text-blue-700' : 'text-gray-600'}>
                                        {med}
                                      </span>
                                    </label>
                                  ))}
                                </div>
                                <div className="mt-2 flex items-center gap-2">
                                  <label className="flex items-center gap-1 text-xs cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={customMedicine.length > 0}
                                      onChange={() => {
                                        if (customMedicine.length > 0) setCustomMedicine('');
                                      }}
                                      className="accent-blue-500"
                                      readOnly
                                    />
                                    <span className="text-gray-600">기타:</span>
                                  </label>
                                  <input
                                    type="text"
                                    value={customMedicine}
                                    onChange={(e) => setCustomMedicine(e.target.value)}
                                    placeholder="직접 입력..."
                                    className="flex-1 px-2 py-1 text-xs border border-blue-300 rounded focus:outline-none focus:border-blue-500"
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 오른쪽: 결과 및 수정 영역 */}
          <div className="w-1/2 overflow-auto space-y-4">
            {/* 질환 설명 */}
            <div className="bg-white rounded-lg shadow-sm p-4">
              <h2 className="font-semibold text-clinic-text-primary mb-3">
                <i className="fas fa-file-alt mr-2 text-blue-500"></i>
                질환 설명
                {selectedTemplate && (
                  <span className="text-xs font-normal text-clinic-text-secondary ml-2">
                    ({selectedTemplate.disease_name})
                  </span>
                )}
              </h2>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="질환에 대한 설명을 입력하거나 왼쪽에서 템플릿을 선택하세요..."
                rows={5}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-clinic-primary focus:ring-2 focus:ring-clinic-primary focus:ring-opacity-20 resize-none text-sm"
              />
            </div>

            {/* 복용방법 결과 */}
            <div className="bg-white rounded-lg shadow-sm p-4">
              <h2 className="font-semibold text-clinic-text-primary mb-3">
                <i className="fas fa-pills mr-2 text-green-500"></i>
                복용방법
              </h2>
              <div className="bg-green-50 rounded-lg p-3 text-sm text-green-800 mb-2">
                {generateDosageText()}
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700">
                {formatText(dosageNotice)}
              </div>
            </div>

            {/* 보관방법 결과 */}
            <div className="bg-white rounded-lg shadow-sm p-4">
              <h2 className="font-semibold text-clinic-text-primary mb-3">
                <i className="fas fa-snowflake mr-2 text-cyan-500"></i>
                보관방법
              </h2>
              <div className="bg-cyan-50 rounded-lg p-3 text-sm text-cyan-800 mb-2">
                {generateStorageText()}
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700">
                {formatText(storageNotice)}
              </div>
            </div>

            {/* 주의사항 결과 */}
            <div className="bg-white rounded-lg shadow-sm p-4">
              <h2 className="font-semibold text-clinic-text-primary mb-3">
                <i className="fas fa-exclamation-triangle mr-2 text-orange-500"></i>
                주의사항
              </h2>
              {selectedFoods.length > 0 && (
                <div className="bg-orange-50 rounded-lg p-3 text-sm text-orange-800 mb-3 max-h-48 overflow-auto">
                  <strong className="block mb-2">선택한 주의사항:</strong>
                  <ul className="space-y-1">
                    {selectedFoods.map((item, idx) => (
                      <li key={idx} className="flex flex-col gap-1">
                        <div className="flex items-start gap-2">
                          <span className="text-orange-600">□</span>
                          <span>{item}</span>
                        </div>
                        {item === MEDICINE_AGREEMENT_TEXT && (selectedMedicines.length > 0 || customMedicine) && (
                          <div className="ml-6 text-blue-700 text-xs">
                            → {[...selectedMedicines, customMedicine].filter(Boolean).join(', ')}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <textarea
                value={customPrecautions}
                onChange={(e) => setCustomPrecautions(e.target.value)}
                placeholder="추가 주의사항을 입력하세요..."
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-clinic-primary focus:ring-2 focus:ring-clinic-primary focus:ring-opacity-20 resize-none text-sm"
              />
            </div>

            {/* 버튼 */}
            <div className="flex gap-3 sticky bottom-0 bg-clinic-background py-2">
              <button
                onClick={() => navigate('/chart/dosage-instructions')}
                className="flex-1 px-4 py-3 border border-gray-300 bg-white rounded-lg text-clinic-text-secondary hover:bg-gray-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={() => {
                  saveDosageInstruction();
                  setShowPreviewModal(false);
                }}
                disabled={!prescriptionId}
                className={`flex-1 px-4 py-3 text-white rounded-lg transition-colors ${
                  prescriptionId
                    ? 'bg-clinic-primary hover:bg-opacity-90'
                    : 'bg-gray-400 cursor-not-allowed'
                }`}
              >
                <i className="fas fa-save mr-2"></i>
                저장
              </button>
              <button
                onClick={handlePrint}
                className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-opacity-90 transition-colors"
              >
                <i className="fas fa-print mr-2"></i>
                인쇄
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 미리보기 모달 */}
      {showPreviewModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
            {/* 모달 헤더 */}
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-xl font-bold text-clinic-text-primary">
                <i className="fas fa-eye mr-2 text-purple-500"></i>
                복용법 미리보기
              </h2>
              <button
                onClick={() => setShowPreviewModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <i className="fas fa-times text-xl"></i>
              </button>
            </div>

            {/* 모달 내용 */}
            <div className="flex-1 overflow-auto p-6">
              <div className="space-y-6">
                {/* 질환 설명 */}
                {description && (
                  <div>
                    <h3 className="font-semibold text-blue-600 mb-2 flex items-center">
                      <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-sm mr-2">一</span>
                      설명
                    </h3>
                    <div className="bg-gray-50 rounded-lg p-4 text-sm">
                      {formatText(description)}
                    </div>
                  </div>
                )}

                {/* 복용방법 */}
                <div>
                  <h3 className="font-semibold text-green-600 mb-2 flex items-center">
                    <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-sm mr-2">二</span>
                    복용방법
                  </h3>
                  <div className="bg-gray-50 rounded-lg p-4 text-sm">
                    <p className="font-medium mb-2">{generateDosageText()}</p>
                    {formatText(dosageNotice)}
                  </div>
                </div>

                {/* 보관방법 */}
                <div>
                  <h3 className="font-semibold text-cyan-600 mb-2 flex items-center">
                    <span className="bg-cyan-100 text-cyan-700 px-2 py-0.5 rounded text-sm mr-2">三</span>
                    보관방법
                  </h3>
                  <div className="bg-gray-50 rounded-lg p-4 text-sm">
                    <p className="font-medium mb-2">{generateStorageText()}</p>
                    {formatText(storageNotice)}
                  </div>
                </div>

                {/* 주의사항 */}
                {(selectedFoods.length > 0 || customPrecautions) && (
                  <div>
                    <h3 className="font-semibold text-orange-600 mb-2 flex items-center">
                      <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-sm mr-2">四</span>
                      주의사항
                    </h3>
                    <div className="bg-gray-50 rounded-lg p-4 text-sm">
                      {formatText(generatePrecautionsText())}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 모달 푸터 */}
            <div className="flex gap-3 px-6 py-4 border-t bg-gray-50">
              <button
                onClick={() => setShowPreviewModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 bg-white rounded-lg text-clinic-text-secondary hover:bg-gray-50 transition-colors"
              >
                닫기
              </button>
              <button
                onClick={() => {
                  setShowPreviewModal(false);
                  handlePrint();
                }}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <i className="fas fa-print mr-2"></i>
                인쇄
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI 생성 저장 모달 */}
      {showSaveModal && aiGenerated && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-bold text-clinic-text-primary">
                <i className="fas fa-save mr-2 text-green-500"></i>
                AI 생성 설명 저장
              </h2>
              <button
                onClick={() => setShowSaveModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <i className="fas fa-times text-xl"></i>
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* 질환명 */}
              <div>
                <label className="block text-sm font-medium text-clinic-text-primary mb-1">
                  질환명 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={saveForm.diseaseName}
                  onChange={(e) => setSaveForm(prev => ({ ...prev, diseaseName: e.target.value }))}
                  placeholder="예: 소화불량, 비염, ADHD"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-clinic-primary"
                />
              </div>

              {/* 카테고리 */}
              <div>
                <label className="block text-sm font-medium text-clinic-text-primary mb-1">
                  카테고리 <span className="text-red-500">*</span>
                </label>
                <select
                  value={saveForm.category}
                  onChange={(e) => setSaveForm(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-clinic-primary"
                >
                  <option value="">카테고리 선택</option>
                  <option value="소아&청소년">소아&청소년</option>
                  <option value="부인과&산과">부인과&산과</option>
                  <option value="소화기">소화기</option>
                  <option value="호흡기,안이비">호흡기,안이비</option>
                  <option value="피부">피부</option>
                  <option value="신경정신">신경정신</option>
                  <option value="순환">순환</option>
                  <option value="비뇨기">비뇨기</option>
                  <option value="보약,피로,면역">보약,피로,면역</option>
                  <option value="다이어트">다이어트</option>
                  <option value="호르몬,대사">호르몬,대사</option>
                  <option value="교통사고,상해">교통사고,상해</option>
                  <option value="일반">일반</option>
                </select>
              </div>

              {/* 세부 상태 (선택) */}
              <div>
                <label className="block text-sm font-medium text-clinic-text-primary mb-1">
                  세부 상태 <span className="text-gray-400 text-xs">(선택)</span>
                </label>
                <input
                  type="text"
                  value={saveForm.conditionDetail}
                  onChange={(e) => setSaveForm(prev => ({ ...prev, conditionDetail: e.target.value }))}
                  placeholder="예: 급성, 만성, 소아용"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-clinic-primary"
                />
              </div>

              {/* 미리보기 */}
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">저장될 설명 (일부)</p>
                <p className="text-sm text-clinic-text-secondary line-clamp-3">
                  {aiGenerated.description}
                </p>
              </div>
            </div>

            <div className="flex gap-3 px-6 py-4 border-t bg-gray-50">
              <button
                onClick={() => setShowSaveModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 bg-white rounded-lg text-clinic-text-secondary hover:bg-gray-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleSaveAIGenerated}
                disabled={saving || !saveForm.diseaseName || !saveForm.category}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <div className="inline-block border-2 border-white border-t-transparent rounded-full w-4 h-4 animate-spin mr-2"></div>
                    저장 중...
                  </>
                ) : (
                  <>
                    <i className="fas fa-save mr-2"></i>
                    템플릿으로 저장
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 주의사항 프리셋 저장 모달 */}
      {showPresetModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-bold text-clinic-text-primary">
                <i className="fas fa-bookmark mr-2 text-blue-500"></i>
                주의사항 프리셋 저장
              </h2>
              <button
                onClick={() => {
                  setShowPresetModal(false);
                  setPresetName('');
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <i className="fas fa-times text-xl"></i>
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-clinic-text-primary mb-1">
                  프리셋 이름 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  placeholder="예: 소화기환자, 피부환자, 다이어트"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  onKeyDown={(e) => e.key === 'Enter' && saveAsPreset()}
                />
              </div>

              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-2">저장될 항목 ({selectedFoods.length}개)</p>
                <div className="max-h-32 overflow-auto text-xs text-clinic-text-secondary">
                  {selectedFoods.map((item, idx) => (
                    <div key={idx} className="py-0.5">□ {item}</div>
                  ))}
                </div>
              </div>

              {Object.keys(savedPresets).includes(presetName.trim()) && (
                <p className="text-xs text-orange-600">
                  <i className="fas fa-exclamation-triangle mr-1"></i>
                  이미 존재하는 이름입니다. 저장하면 덮어씁니다.
                </p>
              )}
            </div>

            <div className="flex gap-3 px-6 py-4 border-t bg-gray-50">
              <button
                onClick={() => {
                  setShowPresetModal(false);
                  setPresetName('');
                }}
                className="flex-1 px-4 py-2 border border-gray-300 bg-white rounded-lg text-clinic-text-secondary hover:bg-gray-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={saveAsPreset}
                disabled={!presetName.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <i className="fas fa-save mr-2"></i>
                프리셋 저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DosageInstructionCreator;
