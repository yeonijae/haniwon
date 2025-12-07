import React, { useState, useEffect } from 'react';
import { Patient } from '../types';

interface ConsultationInfoModalProps {
  patient: Patient;
  onSave: (patientId: number, details: string, memo?: string) => void;
  onClose: () => void;
}

const INSURANCE_TYPES = ['건보', '차상위', '1종', '2종', '임산부', '산정특례', '일반'];
const ACUPUNCTURE_TREATMENTS = ['침', '추나', '약침', '초음파'];
const ACCIDENT_TREATMENTS = ['침', '추나', '자보약'];
const HERBAL_TYPES = ['상비약', '감기약', '맞춤한약'];

const ConsultationInfoModal: React.FC<ConsultationInfoModalProps> = ({
  patient,
  onSave,
  onClose,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<'acupuncture' | 'accident' | null>(null);
  const [insuranceType, setInsuranceType] = useState<string>('건보');
  const [selectedTreatments, setSelectedTreatments] = useState<string[]>([]);
  const [includeHerbal, setIncludeHerbal] = useState<boolean>(false);
  const [selectedHerbalType, setSelectedHerbalType] = useState<string>('');
  const [customHerbalNote, setCustomHerbalNote] = useState<string>('');
  const [receptionMemo, setReceptionMemo] = useState<string>('');

  // 기존 details와 memo 파싱하여 초기화
  useEffect(() => {
    if (patient.details) {
      const details = patient.details;
      console.log('📋 파싱할 details:', details);

      // 침치료 파싱: "침치료(건보) - 침+추나" 또는 "침치료(건보) - 침+추나+약침+초음파"
      const acupunctureMatch = details.match(/침치료\(([^)]+)\)\s*-\s*([^,]+)/);
      if (acupunctureMatch) {
        console.log('✅ 침치료 매칭:', acupunctureMatch);
        setSelectedCategory('acupuncture');
        setInsuranceType(acupunctureMatch[1]);
        const treatments = acupunctureMatch[2].split('+').map(t => t.trim());
        console.log('✅ 선택된 치료:', treatments);
        setSelectedTreatments(treatments);
      }

      // 자보 파싱: "자보 - 침+추나+자보약"
      const accidentMatch = details.match(/자보\s*-\s*([^,]+)/);
      if (accidentMatch && !acupunctureMatch) {
        console.log('✅ 자보 매칭:', accidentMatch);
        setSelectedCategory('accident');
        const treatments = accidentMatch[1].split('+').map(t => t.trim());
        console.log('✅ 선택된 치료:', treatments);
        setSelectedTreatments(treatments);
      }

      // 약상담 파싱: "약상담-상비약" 또는 "약상담-감기약" 또는 "약상담-맞춤한약(내용)"
      const herbalMatch = details.match(/약상담-([^,()\s]+)(?:\(([^)]+)\))?/);
      if (herbalMatch) {
        console.log('✅ 약상담 매칭:', herbalMatch);
        setIncludeHerbal(true);
        setSelectedHerbalType(herbalMatch[1]);
        if (herbalMatch[2]) {
          setCustomHerbalNote(herbalMatch[2]);
        }
      }
    }

    // memo 설정
    if (patient.memo) {
      setReceptionMemo(patient.memo);
    }
  }, [patient.details, patient.memo]);

  const toggleTreatment = (treatment: string) => {
    setSelectedTreatments(prev =>
      prev.includes(treatment)
        ? prev.filter(t => t !== treatment)
        : [...prev, treatment]
    );
  };

  const handleSave = () => {
    const parts: string[] = [];

    // 침치료 또는 자보
    if (selectedCategory === 'acupuncture' && selectedTreatments.length > 0) {
      const treatments = selectedTreatments.join('+');
      parts.push(`침치료(${insuranceType}) - ${treatments}`);
    } else if (selectedCategory === 'accident' && selectedTreatments.length > 0) {
      const treatments = selectedTreatments.join('+');
      parts.push(`자보 - ${treatments}`);
    }

    // 약상담 (추가 선택)
    if (includeHerbal && selectedHerbalType) {
      if (selectedHerbalType === '맞춤한약') {
        parts.push(`약상담-맞춤한약${customHerbalNote ? `(${customHerbalNote})` : ''}`);
      } else {
        parts.push(`약상담-${selectedHerbalType}`);
      }
    }

    const detailsText = parts.join(', ');
    onSave(patient.id, detailsText, receptionMemo || undefined);
    onClose();
  };

  const canSubmit = () => {
    // 침치료/자보가 선택된 경우: 치료 항목이 있어야 함
    if (selectedCategory) {
      if (selectedTreatments.length === 0) return false;
    }
    // 약상담만 선택한 경우: 약상담 유형이 있어야 함
    if (!selectedCategory && includeHerbal) {
      return selectedHerbalType !== '';
    }
    // 약상담이 추가로 선택된 경우: 약상담 유형이 있어야 함
    if (includeHerbal && !selectedHerbalType) return false;

    // 최소 하나는 선택되어야 함
    return selectedCategory !== null || (includeHerbal && selectedHerbalType !== '');
  };

  return (
    <div className="flex flex-col h-[85vh] min-w-[900px]">
      {/* 환자 이름 + 접수메모 */}
      <div className="bg-gray-50 p-4 rounded-lg mb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-shrink-0">
            <p className="font-bold text-clinic-primary text-xl">{patient.name}</p>
            <p className="text-sm text-gray-500">진료정보 수정</p>
          </div>
          <div className="flex-1 max-w-md">
            <div className="flex items-center gap-2 mb-1">
              <i className="fa-solid fa-message text-red-500 text-sm"></i>
              <label className="text-sm font-semibold text-gray-700">접수 메모</label>
            </div>
            <input
              type="text"
              value={receptionMemo}
              onChange={(e) => setReceptionMemo(e.target.value)}
              placeholder="특이사항 입력 (대시보드에 붉은글씨로 표시)"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-400 focus:border-red-400"
            />
          </div>
        </div>
      </div>

      {/* 2단 레이아웃: 좌측 진료유형 / 우측 세부항목 */}
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-2 gap-6 h-full">
          {/* 좌측: 진료 유형 선택 */}
          <div className="space-y-3">
            <label className="block text-sm font-semibold text-gray-700">진료 유형 선택</label>

            {/* 침치료 */}
            <button
              onClick={() => { setSelectedCategory(selectedCategory === 'acupuncture' ? null : 'acupuncture'); setSelectedTreatments([]); }}
              className={`w-full p-4 rounded-xl border-2 transition-all flex items-center gap-4 ${
                selectedCategory === 'acupuncture'
                  ? 'border-blue-500 bg-blue-50 shadow-sm'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                selectedCategory === 'acupuncture' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-500'
              }`}>
                <i className="fa-solid fa-hand-dots text-xl"></i>
              </div>
              <div className="text-left">
                <span className={`font-bold text-lg ${selectedCategory === 'acupuncture' ? 'text-blue-600' : 'text-gray-700'}`}>
                  침치료
                </span>
                <p className="text-xs text-gray-500">건강보험 진료</p>
              </div>
              {selectedCategory === 'acupuncture' && <i className="fa-solid fa-check text-blue-500 ml-auto text-xl"></i>}
            </button>

            {/* 자보 */}
            <button
              onClick={() => { setSelectedCategory(selectedCategory === 'accident' ? null : 'accident'); setSelectedTreatments([]); }}
              className={`w-full p-4 rounded-xl border-2 transition-all flex items-center gap-4 ${
                selectedCategory === 'accident'
                  ? 'border-red-500 bg-red-50 shadow-sm'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                selectedCategory === 'accident' ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-500'
              }`}>
                <i className="fa-solid fa-car-burst text-xl"></i>
              </div>
              <div className="text-left">
                <span className={`font-bold text-lg ${selectedCategory === 'accident' ? 'text-red-600' : 'text-gray-700'}`}>
                  자보
                </span>
                <p className="text-xs text-gray-500">자동차보험 진료</p>
              </div>
              {selectedCategory === 'accident' && <i className="fa-solid fa-check text-red-500 ml-auto text-xl"></i>}
            </button>

            {/* 약상담 추가 */}
            <div
              onClick={() => { setIncludeHerbal(!includeHerbal); if (includeHerbal) { setSelectedHerbalType(''); setCustomHerbalNote(''); } }}
              className={`w-full p-4 rounded-xl border-2 transition-all flex items-center gap-4 cursor-pointer ${
                includeHerbal
                  ? 'border-green-500 bg-green-50 shadow-sm'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                includeHerbal ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-500'
              }`}>
                <i className="fa-solid fa-prescription-bottle-medical text-xl"></i>
              </div>
              <div className="text-left">
                <span className={`font-bold text-lg ${includeHerbal ? 'text-green-600' : 'text-gray-700'}`}>
                  약상담
                </span>
                <p className="text-xs text-gray-500">한약 상담 추가</p>
              </div>
              {includeHerbal && <i className="fa-solid fa-check text-green-500 ml-auto text-xl"></i>}
            </div>
          </div>

          {/* 우측: 세부항목 선택 */}
          <div className="border rounded-xl p-5 bg-white shadow-sm">
            {!selectedCategory && !includeHerbal && (
              <div className="h-full flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <i className="fa-solid fa-arrow-left text-4xl mb-3"></i>
                  <p className="font-medium">좌측에서 진료 유형을 선택해주세요</p>
                </div>
              </div>
            )}

            {/* 침치료 세부항목 */}
            {selectedCategory === 'acupuncture' && (
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    <i className="fa-solid fa-id-card mr-2 text-blue-500"></i>종별 선택
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {INSURANCE_TYPES.map((type) => (
                      <button
                        key={type}
                        onClick={() => setInsuranceType(type)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          insuranceType === type
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    <i className="fa-solid fa-hand-holding-medical mr-2 text-blue-500"></i>받을 치료 (복수 선택 가능)
                  </label>
                  <div className="flex flex-wrap gap-3">
                    {ACUPUNCTURE_TREATMENTS.map((treatment) => (
                      <button
                        key={treatment}
                        onClick={() => toggleTreatment(treatment)}
                        className={`px-5 py-3 rounded-xl text-base font-medium transition-all ${
                          selectedTreatments.includes(treatment)
                            ? 'bg-blue-500 text-white shadow-md'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {selectedTreatments.includes(treatment) && <i className="fa-solid fa-check mr-2"></i>}
                        {treatment}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 자보 세부항목 */}
            {selectedCategory === 'accident' && (
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    <i className="fa-solid fa-hand-holding-medical mr-2 text-red-500"></i>받을 치료 (복수 선택 가능)
                  </label>
                  <div className="flex flex-wrap gap-3">
                    {ACCIDENT_TREATMENTS.map((treatment) => (
                      <button
                        key={treatment}
                        onClick={() => toggleTreatment(treatment)}
                        className={`px-5 py-3 rounded-xl text-base font-medium transition-all ${
                          selectedTreatments.includes(treatment)
                            ? 'bg-red-500 text-white shadow-md'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {selectedTreatments.includes(treatment) && <i className="fa-solid fa-check mr-2"></i>}
                        {treatment}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 약상담 세부항목 */}
            {includeHerbal && (
              <div className={`space-y-5 ${selectedCategory ? 'mt-5 pt-5 border-t' : ''}`}>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    <i className="fa-solid fa-pills mr-2 text-green-500"></i>약상담 유형
                  </label>
                  <div className="flex flex-wrap gap-3">
                    {HERBAL_TYPES.map((type) => (
                      <button
                        key={type}
                        onClick={() => setSelectedHerbalType(type)}
                        className={`px-5 py-3 rounded-xl text-base font-medium transition-all ${
                          selectedHerbalType === type
                            ? 'bg-green-500 text-white shadow-md'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {selectedHerbalType === type && <i className="fa-solid fa-check mr-2"></i>}
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                {selectedHerbalType === '맞춤한약' && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      <i className="fa-solid fa-pen mr-2 text-green-500"></i>상담 내용 (선택)
                    </label>
                    <input
                      type="text"
                      value={customHerbalNote}
                      onChange={(e) => setCustomHerbalNote(e.target.value)}
                      placeholder="예: 피로회복, 면역력 강화 등"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 하단: 선택항목 요약 + 버튼 */}
      <div className="border-t pt-4 mt-4">
        {/* 선택 항목 요약 */}
        {(selectedCategory || (includeHerbal && selectedHerbalType)) && (
          <div className="mb-4 p-3 bg-blue-50 rounded-xl">
            <span className="font-semibold text-blue-800">선택된 항목: </span>
            <span className="text-blue-600 font-medium">
              {(() => {
                const parts: string[] = [];
                if (selectedCategory === 'acupuncture' && selectedTreatments.length > 0) {
                  parts.push(`침치료(${insuranceType}) - ${selectedTreatments.join('+')}`);
                }
                if (selectedCategory === 'accident' && selectedTreatments.length > 0) {
                  parts.push(`자보 - ${selectedTreatments.join('+')}`);
                }
                if (includeHerbal && selectedHerbalType) {
                  if (selectedHerbalType === '맞춤한약') {
                    parts.push(`약상담-맞춤한약${customHerbalNote ? `(${customHerbalNote})` : ''}`);
                  } else {
                    parts.push(`약상담-${selectedHerbalType}`);
                  }
                }
                return parts.join(', ');
              })()}
            </span>
          </div>
        )}

        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-300 transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={!canSubmit()}
            className={`px-8 py-2.5 font-semibold rounded-xl transition-all ${
              canSubmit()
                ? 'bg-clinic-secondary text-white hover:bg-blue-700 shadow-md'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            <i className="fa-solid fa-check mr-2"></i>
            저장
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConsultationInfoModal;
