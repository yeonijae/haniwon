/**
 * 처방 입력 모달
 * 한약 패키지에 처방 연결 및 복용법 입력
 */

import { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import type { HerbalPackage } from '@modules/cs/types';
import { linkPrescriptionToPackage } from '@modules/cs/lib/decoctionApi';
import { prescriptionsApi, type Prescription, type PrescriptionDefinition, prescriptionDefinitionsApi } from '@modules/inventory/api/prescriptions';

interface Props {
  pkg: HerbalPackage;
  onClose: () => void;
  onSuccess: () => void;
}

// 자주 사용하는 복용법 프리셋
const DOSAGE_PRESETS = [
  '1일 2회, 아침 저녁 식후 30분, 1회 1포',
  '1일 3회, 아침 점심 저녁 식후 30분, 1회 1포',
  '1일 2회, 아침 저녁 식전 30분, 1회 1포',
  '1일 1회, 취침 전, 1회 1포',
];

export function PrescriptionInputModal({ pkg, onClose, onSuccess }: Props) {
  const [prescriptionDefinitions, setPrescriptionDefinitions] = useState<PrescriptionDefinition[]>([]);
  const [recentPrescriptions, setRecentPrescriptions] = useState<Prescription[]>([]);
  const [selectedDefinitionId, setSelectedDefinitionId] = useState<number | null>(null);
  const [dosageInstruction, setDosageInstruction] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isDark } = useTheme();

  // 데이터 로드
  useEffect(() => {
    const loadData = async () => {
      try {
        const [definitions, recent] = await Promise.all([
          prescriptionDefinitionsApi.getAll({ isActive: true }),
          prescriptionsApi.getRecent(10),
        ]);
        setPrescriptionDefinitions(definitions);
        setRecentPrescriptions(recent);
      } catch (err) {
        console.error('처방전 데이터 로드 오류:', err);
        setError('데이터를 불러오는데 실패했습니다.');
      }
    };
    loadData();
  }, []);

  // 검색 필터링
  const filteredDefinitions = prescriptionDefinitions.filter(def =>
    def.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (def.alias && def.alias.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // 처방 저장
  const handleSubmit = async () => {
    if (!selectedDefinitionId) {
      setError('처방을 선택해주세요.');
      return;
    }

    if (!dosageInstruction.trim()) {
      setError('복용법을 입력해주세요.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // 1. 처방 발행
      const selectedDef = prescriptionDefinitions.find(d => d.id === selectedDefinitionId);
      if (!selectedDef) throw new Error('선택한 처방을 찾을 수 없습니다.');

      const prescription = await prescriptionsApi.create({
        prescription_definition_id: selectedDefinitionId,
        patient_name: pkg.patient_name,
        prescription_name: selectedDef.name,
        composition: selectedDef.composition,
        issued_date: new Date().toISOString().split('T')[0],
        issued_by: pkg.doctor_name || '원장',
        herbal_package_id: pkg.id,
        dosage_instruction: dosageInstruction.trim(),
      });

      // 2. 패키지에 처방 연결
      await linkPrescriptionToPackage(pkg.id!, prescription.id, dosageInstruction.trim());

      onSuccess();
    } catch (err) {
      console.error('처방 저장 오류:', err);
      setError('저장에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 테마별 스타일
  const t = {
    overlay: 'fixed inset-0 bg-black/50 flex items-center justify-center z-50',
    modal: isDark ? 'bg-gray-800 text-white' : 'bg-white text-gray-900',
    border: isDark ? 'border-gray-700' : 'border-gray-200',
    input: isDark
      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400',
    button: isDark
      ? 'bg-gray-700 hover:bg-gray-600 text-white'
      : 'bg-gray-100 hover:bg-gray-200 text-gray-800',
    buttonPrimary: 'bg-blue-500 hover:bg-blue-600 text-white',
    text: isDark ? 'text-white' : 'text-gray-900',
    textMuted: isDark ? 'text-gray-400' : 'text-gray-500',
    itemBg: isDark ? 'bg-gray-700/50 hover:bg-gray-700' : 'bg-gray-50 hover:bg-gray-100',
    itemSelected: isDark ? 'bg-blue-900/50 border-blue-500' : 'bg-blue-50 border-blue-500',
  };

  return (
    <div className={t.overlay} onClick={onClose}>
      <div
        className={`${t.modal} rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col`}
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className={`px-4 py-3 border-b ${t.border} flex items-center justify-between`}>
          <div>
            <h2 className={`text-lg font-semibold ${t.text}`}>처방 입력</h2>
            <p className={`text-sm ${t.textMuted}`}>
              {pkg.patient_name} - {pkg.herbal_name}
            </p>
          </div>
          <button
            onClick={onClose}
            className={`p-1 rounded ${t.button}`}
          >
            ✕
          </button>
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* 에러 메시지 */}
          {error && (
            <div className="p-3 bg-red-100 border border-red-300 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* 처방 검색 */}
          <div>
            <label className={`block text-sm font-medium ${t.text} mb-2`}>
              처방 선택 *
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="처방명 검색..."
              className={`w-full px-3 py-2 rounded-lg border ${t.input} focus:outline-none focus:ring-2 focus:ring-blue-500`}
            />
          </div>

          {/* 처방 목록 */}
          <div className="max-h-40 overflow-y-auto space-y-1">
            {filteredDefinitions.slice(0, 20).map(def => (
              <div
                key={def.id}
                onClick={() => setSelectedDefinitionId(def.id)}
                className={`px-3 py-2 rounded-lg cursor-pointer transition-colors border ${
                  selectedDefinitionId === def.id
                    ? t.itemSelected
                    : `${t.itemBg} border-transparent`
                }`}
              >
                <div className={`font-medium ${t.text}`}>{def.name}</div>
                {def.alias && (
                  <div className={`text-xs ${t.textMuted}`}>{def.alias}</div>
                )}
              </div>
            ))}
            {filteredDefinitions.length === 0 && (
              <div className={`text-center py-4 ${t.textMuted}`}>
                검색 결과가 없습니다
              </div>
            )}
          </div>

          {/* 복용법 */}
          <div>
            <label className={`block text-sm font-medium ${t.text} mb-2`}>
              복용법 *
            </label>

            {/* 프리셋 버튼 */}
            <div className="flex flex-wrap gap-2 mb-2">
              {DOSAGE_PRESETS.map((preset, idx) => (
                <button
                  key={idx}
                  onClick={() => setDosageInstruction(preset)}
                  className={`text-xs px-2 py-1 rounded ${t.button}`}
                >
                  {preset.substring(0, 15)}...
                </button>
              ))}
            </div>

            <textarea
              value={dosageInstruction}
              onChange={e => setDosageInstruction(e.target.value)}
              placeholder="복용법을 입력하세요"
              rows={3}
              className={`w-full px-3 py-2 rounded-lg border ${t.input} focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none`}
            />
          </div>

          {/* 탕전 정보 */}
          <div className={`p-3 rounded-lg ${isDark ? 'bg-gray-700/50' : 'bg-gray-100'}`}>
            <div className={`text-sm ${t.textMuted}`}>탕전 예정일</div>
            <div className={`font-medium ${t.text}`}>
              {pkg.decoction_date || '미정'}
            </div>
          </div>
        </div>

        {/* 푸터 */}
        <div className={`px-4 py-3 border-t ${t.border} flex justify-end gap-2`}>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className={`px-4 py-2 rounded-lg ${t.button}`}
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !selectedDefinitionId || !dosageInstruction.trim()}
            className={`px-4 py-2 rounded-lg ${t.buttonPrimary} disabled:opacity-50`}
          >
            {isSubmitting ? '저장 중...' : '처방 저장'}
          </button>
        </div>
      </div>
    </div>
  );
}
