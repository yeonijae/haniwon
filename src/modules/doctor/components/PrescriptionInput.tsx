import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { query } from '@shared/lib/postgres';
import type { PrescriptionTemplate, PrescriptionHerb } from '../types';

// 최종 약재 타입
export interface FinalHerb {
  herb_id: number;
  name: string;
  amount: number;
}

// 처방 데이터 타입
export interface PrescriptionData {
  formula: string;
  mergedHerbs: PrescriptionHerb[];
  finalHerbs: FinalHerb[];
  totalDoses: number;
  days: number;
  dosesPerDay: number;
  totalPacks: number;
  herbAdjustment: string;
  notes: string;
  patientName?: string;
  totalDosage: number; // 1첩 용량
  finalTotalAmount: number; // 최종 총량
  packVolume: number; // 한팩당 용량 (ml)
  waterAmount: number; // 탕전 물양 (ml)
}

export interface UnlinkedHerbalDraftOption {
  id: number;
  created_at?: string;
}

// Props 타입
export interface PrescriptionInputProps {
  onSave?: (data: PrescriptionData) => void;
  onChange?: (data: PrescriptionData) => void;
  patientName?: string;
  patientChartNumber?: string;
  patientAge?: number | null;
  onClose?: () => void;
  onPatientNameChange?: (name: string) => void;
  showPatientInput?: boolean;
  showNotesInput?: boolean;
  showSaveButton?: boolean;
  saveButtonText?: string;
  initialFormula?: string;
  initialNotes?: string;
  initialTotalDoses?: number;
  initialDays?: number;
  initialDosesPerDay?: number;
  initialPackVolume?: number;
  compact?: boolean; // 컴팩트 모드 (미리보기 숨김)
  unlinkedHerbalDrafts?: UnlinkedHerbalDraftOption[];
  selectedHerbalDraftId?: number | null;
  onSelectHerbalDraftId?: (draftId: number | null) => void;
}

// 합방(+) 처방 해결 함수 - 재귀적으로 처방 참조를 해결하고 약재를 merge
const resolveMergedComposition = (
  composition: string,
  allPrescriptions: { name: string; alias?: string; composition?: string }[],
  visited: Set<string> = new Set()
): string => {
  if (!composition) return '';

  // + 가 없으면 그대로 반환
  if (!composition.includes('+')) {
    return composition;
  }

  // + 로 구분된 처방명들 추출
  const prescriptionNames = composition.split('+').map(name => name.trim());
  const herbMap = new Map<string, number>();
  const suffixes = ['', '탕', '산', '환', '음']; // 접미사 목록

  for (const name of prescriptionNames) {
    // 순환 참조 방지
    if (visited.has(name)) {
      console.warn(`순환 참조 감지: ${name}`);
      continue;
    }
    visited.add(name);

    // 처방 찾기 - 정확한 이름 또는 접미사 붙여서 검색
    let prescription = allPrescriptions.find(
      p => p.name === name || p.alias === name
    );

    // 못 찾으면 접미사 붙여서 검색
    if (!prescription) {
      for (const suffix of suffixes) {
        if (suffix === '') continue;
        const nameWithSuffix = name + suffix;
        prescription = allPrescriptions.find(
          p => p.name === nameWithSuffix || p.alias === nameWithSuffix
        );
        if (prescription) break;
      }
    }

    if (!prescription || !prescription.composition) {
      console.warn(`처방을 찾을 수 없거나 구성이 없음: ${name}`);
      continue;
    }

    // 재귀적으로 해결
    const resolvedComposition = resolveMergedComposition(
      prescription.composition,
      allPrescriptions,
      new Set(visited)
    );

    // 약재 파싱 후 merge (큰 값 취함)
    const herbParts = resolvedComposition.split('/').filter(s => s.trim());
    for (const part of herbParts) {
      const [herbName, dosageStr] = part.split(':');
      if (herbName && dosageStr) {
        const amount = parseFloat(dosageStr) || 0;
        const currentMax = herbMap.get(herbName.trim()) || 0;
        herbMap.set(herbName.trim(), Math.max(currentMax, amount));
      }
    }
  }

  // 병합된 약재를 composition 문자열로 변환
  return Array.from(herbMap.entries())
    .map(([herb, amount]) => `${herb}:${amount}`)
    .join('/');
};

const PrescriptionInput: React.FC<PrescriptionInputProps> = ({
  onSave,
  onChange,
  patientName: externalPatientName,
  patientChartNumber,
  patientAge,
  onClose,
  onPatientNameChange,
  showPatientInput = true,
  showNotesInput = true,
  showSaveButton = true,
  saveButtonText = '처방전 저장',
  initialFormula = '',
  initialNotes = '',
  initialTotalDoses = 15,
  initialDays = 15,
  initialDosesPerDay = 2,
  initialPackVolume = 100,
  compact = false,
  unlinkedHerbalDrafts = [],
  selectedHerbalDraftId = null,
  onSelectHerbalDraftId,
}) => {
  const [templates, setTemplates] = useState<PrescriptionTemplate[]>([]);
  const [herbIdMap, setHerbIdMap] = useState<Map<string, number>>(new Map()); // 약재명 -> DB ID 매핑
  const [loading, setLoading] = useState(true);
  const [formula, setFormula] = useState(initialFormula);
  const [mergedHerbs, setMergedHerbs] = useState<PrescriptionHerb[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [totalDoses, setTotalDoses] = useState(initialTotalDoses);
  const [days, setDays] = useState(initialDays);
  const [dosesPerDay, setDosesPerDay] = useState(initialDosesPerDay);
  const [packVolume, setPackVolume] = useState(initialPackVolume);
  const [internalPatientName, setInternalPatientName] = useState('');
  const [notes, setNotes] = useState(initialNotes);
  const [showTemplateList, setShowTemplateList] = useState(false);
  const [templateSearchTerm, setTemplateSearchTerm] = useState('');
  const [herbAdjustment, setHerbAdjustment] = useState('');
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    setShowPrintPreview(true);
  };

  const getPortrait2Html = () => {
    const sortedHerbs = [...finalHerbs];
    const packVol = packVolume || 120;
    const finalTotalAmt = finalHerbs.reduce((sum, h) => sum + h.amount, 0);
    const waterAmt = Math.round(totalDosage * 1.2 + packVol * (totalPacks + 1) + 300);
    const MAX_HERBS_LEFT = 30;
    const needsTwoColumns = sortedHerbs.length > MAX_HERBS_LEFT;

    let leftHerbs, rightHerbs;
    if (needsTwoColumns) {
      leftHerbs = sortedHerbs.slice(0, MAX_HERBS_LEFT);
      rightHerbs = sortedHerbs.slice(MAX_HERBS_LEFT);
    } else {
      leftHerbs = sortedHerbs;
      rightHerbs = [] as typeof sortedHerbs;
    }

    const leftHerbsHtml = leftHerbs.map(h => `<tr><td class="row">${h.name}</td><td class="row">${Math.round(h.amount)}g</td></tr>`).join('');
    const rightHerbsHtml = rightHerbs.map(h => `<tr><td class="row">${h.name}</td><td class="row">${Math.round(h.amount)}g</td></tr>`).join('');

    const summaryHtml = `
      <tr><td class="row summary-row">총 ${sortedHerbs.length}개</td><td class="row summary-row" style="text-align:right">총 ${Math.round(finalTotalAmt).toLocaleString()}g</td></tr>
      <tr><td class="row">${packVol}ml</td><td class="row" style="text-align:right">${totalPacks}팩</td></tr>
      <tr><td class="row water-row">${waterAmt.toLocaleString()}ml</td><td class="row"><button class="print-btn" onclick="window.print()">인쇄하기</button></td></tr>
    `;

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>처방전 - ${patientName || '환자'}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Malgun Gothic', sans-serif; padding: 5mm 15mm 15mm 15mm; }
        .container { display: flex; gap: 20px; align-items: flex-start; }
        table { border-collapse: collapse; width: 200px; }
        .row { border: 1px solid #999; padding: 5px 10px; height: 28px; font-size: 14px; }
        .header-row { font-weight: bold; font-size: 16px; background: #f5f5f5; }
        .summary-row { font-weight: bold; background: #e8e8e8; }
        .water-row { font-weight: bold; background: #e3f2fd; color: #0d47a1; font-size: 16px; }
        .print-btn { padding: 4px 16px; font-size: 13px; cursor: pointer; border: 1px solid #999; border-radius: 4px; background: #f5f5f5; }
        .print-btn:hover { background: #e0e0e0; }
        @media print {
          body { padding: 5mm 10mm; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          @page { margin: 0; size: A4 portrait; }
          .print-btn { display: none; }
        }
      </style></head><body>
      <div class="container">
        <table>
          <tr><td class="row header-row" colspan="2">${[patientName || '-', patientChartNumber ? `(${patientChartNumber})` : '', patientAge ? `${patientAge}세` : ''].filter(Boolean).join(' ')}</td></tr>
          ${leftHerbsHtml}
          ${!needsTwoColumns ? summaryHtml : `<tr><td class="row summary-row" colspan="2">→ 계속</td></tr>`}
        </table>
        ${needsTwoColumns ? `<table>
          <tr><td class="row header-row" colspan="2">(계속)</td></tr>
          ${rightHerbsHtml}
          ${summaryHtml}
        </table>` : ''}
      </div></body></html>`;
  };

  const executePrint = () => {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.left = '-9999px';
    iframe.style.width = '210mm';
    iframe.style.height = '297mm';
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument;
    if (!doc) return;
    doc.open();
    doc.write(getPortrait2Html());
    doc.close();

    iframe.onload = () => {
      setTimeout(() => {
        iframe.contentWindow?.print();
        setTimeout(() => document.body.removeChild(iframe), 1000);
      }, 500);
    };
  };

  // 외부에서 patientName을 제어하는 경우
  const patientName = externalPatientName !== undefined ? externalPatientName : internalPatientName;
  const setPatientName = onPatientNameChange || setInternalPatientName;

  const formatDraftCreatedAt = (value?: string) => {
    if (!value) return '';
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return '';
    return dt.toLocaleString('ko-KR', { hour12: false });
  };

  // 처방 템플릿 로드
  useEffect(() => {
    loadPrescriptionTemplates();
  }, []);

  const loadPrescriptionTemplates = async () => {
    try {
      setLoading(true);

      // 약재 목록 로드 (ID 매핑용) - PostgreSQL
      const herbsData = await query<{ id: number; name: string }>(
        `SELECT id, name FROM herbs ORDER BY id`
      );

      const idMap = new Map<string, number>();
      (herbsData || []).forEach((herb) => {
        idMap.set(herb.name, herb.id);
      });
      setHerbIdMap(idMap);

      // 처방 템플릿 로드 - PostgreSQL
      const data = await query<{
        id: number;
        name: string;
        alias: string;
        short_name: string;
        composition: string;
        description: string;
      }>(`SELECT * FROM prescription_definitions ORDER BY name`);

      // 먼저 raw 데이터로 배열 생성 (합방 해결용)
      const rawPrescriptions = (data || []).map(item => ({
        name: item.name,
        alias: item.alias || item.short_name || '',
        composition: item.composition || ''
      }));

      const loadedTemplates: PrescriptionTemplate[] = (data || []).map((item) => {
        const normalizedHerbs: PrescriptionHerb[] = [];

        if (item.composition) {
          // 합방(+) 처방인 경우 먼저 해결
          const resolvedComposition = item.composition.includes('+')
            ? resolveMergedComposition(item.composition, rawPrescriptions)
            : item.composition;

          const herbParts = resolvedComposition.split('/').filter((s: string) => s.trim());
          herbParts.forEach((part: string, index: number) => {
            const [herbName, dosageStr] = part.split(':');
            if (herbName && dosageStr) {
              normalizedHerbs.push({
                herb_id: index + 1,
                herb_name: herbName.trim(),
                dosage: parseFloat(dosageStr) || 0,
                unit: 'g'
              });
            }
          });
        }

        return {
          id: item.id,
          name: item.name,
          alias: item.alias || item.short_name || '',
          herbs: normalizedHerbs,
          description: item.description || ''
        };
      });

      setTemplates(loadedTemplates);
    } catch (error) {
      console.error('처방 템플릿 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  // 처방 공식 파싱 및 merge
  const parseFormula = useCallback((formulaStr: string) => {
    setParseError(null);
    setMergedHerbs([]);

    let normalized = formulaStr.trim();
    if (!normalized) return;

    normalized = normalized.replace(/^</, '').replace(/>$/, '');
    normalized = normalized.replace(/\s+/g, '+');
    normalized = normalized.replace(/\++/g, '+');
    normalized = normalized.replace(/^\+|\+$/g, '');

    if (!normalized) return;

    const prescriptionParts = normalized.split('+').map(s => s.trim()).filter(s => s);
    const foundTemplates: { template: PrescriptionTemplate; multiplier: number }[] = [];
    const notFound: string[] = [];
    const multipleMatches: { name: string; matches: string[] }[] = [];
    const suffixes = ['', '탕', '산', '환', '음'];

    prescriptionParts.forEach(part => {
      let searchName = part;
      let multiplier = 1.0;

      const multiplierMatch = part.match(/^(.+)\*(\d*\.?\d+)$/);
      if (multiplierMatch) {
        searchName = multiplierMatch[1].trim();
        multiplier = parseFloat(multiplierMatch[2]) || 1.0;
      }

      let template = templates.find(
        t => t.name === searchName || t.alias === searchName
      );

      if (template) {
        foundTemplates.push({ template, multiplier });
        return;
      }

      const matchedTemplates: PrescriptionTemplate[] = [];
      for (const suffix of suffixes) {
        if (suffix === '') continue;
        const nameWithSuffix = searchName + suffix;
        const found = templates.find(
          t => t.name === nameWithSuffix || t.alias === nameWithSuffix
        );
        if (found && !matchedTemplates.includes(found)) {
          matchedTemplates.push(found);
        }
      }

      if (matchedTemplates.length === 0) {
        templates.forEach(t => {
          if (t.name.startsWith(searchName) || (t.alias && t.alias.startsWith(searchName))) {
            if (!matchedTemplates.includes(t)) {
              matchedTemplates.push(t);
            }
          }
        });
      }

      if (matchedTemplates.length === 1) {
        foundTemplates.push({ template: matchedTemplates[0], multiplier });
      } else if (matchedTemplates.length > 1) {
        multipleMatches.push({
          name: searchName,
          matches: matchedTemplates.map(t => t.name)
        });
      } else {
        notFound.push(searchName);
      }
    });

    if (multipleMatches.length > 0) {
      const messages = multipleMatches.map(m =>
        `"${m.name}": ${m.matches.join(', ')}`
      );
      setParseError(`여러 처방이 검색됨 - 정확한 이름을 입력해주세요:\n${messages.join('\n')}`);
      return;
    }

    if (notFound.length > 0) {
      setParseError(`없는 처방: ${notFound.join(', ')}`);
      return;
    }

    const herbMap = new Map<string, PrescriptionHerb>();

    foundTemplates.forEach(({ template, multiplier }) => {
      template.herbs.forEach(herb => {
        const adjustedDosage = herb.dosage * multiplier;
        const existing = herbMap.get(herb.herb_name);
        if (!existing || existing.dosage < adjustedDosage) {
          herbMap.set(herb.herb_name, {
            ...herb,
            dosage: adjustedDosage
          });
        }
      });
    });

    const merged = Array.from(herbMap.values()).sort((a, b) => b.dosage - a.dosage);
    setMergedHerbs(merged);
  }, [templates]);

  // formula 변경시 자동 파싱
  useEffect(() => {
    const timer = setTimeout(() => {
      parseFormula(formula);
    }, 300);
    return () => clearTimeout(timer);
  }, [formula, parseFormula]);

  // 총 용량 계산
  const totalDosage = mergedHerbs.reduce((sum, h) => sum + h.dosage, 0);

  // 첩수 자동조정 계산
  const TARGET_DOSAGE_PER_DOSE = 100;
  const recommendedDoses = totalDosage > TARGET_DOSAGE_PER_DOSE
    ? Math.round((days * TARGET_DOSAGE_PER_DOSE / totalDosage) * 10) / 10
    : null;

  const applyRecommendedDoses = () => {
    if (recommendedDoses !== null) {
      setTotalDoses(recommendedDoses);
    }
  };

  // 약재 조정 파싱
  const parseHerbAdjustment = (adjustmentStr: string): { name: string; amount: number; isAdd: boolean }[] => {
    if (!adjustmentStr.trim()) return [];

    const adjustments: { name: string; amount: number; isAdd: boolean }[] = [];
    const regex = /([+-]?)([가-힣]+)(\d+(?:\.\d+)?)/g;
    let match;

    while ((match = regex.exec(adjustmentStr)) !== null) {
      const sign = match[1];
      const name = match[2];
      const amount = parseFloat(match[3]);

      adjustments.push({
        name,
        amount,
        isAdd: sign !== '-'
      });
    }

    return adjustments;
  };

  // 최종 약재 목록 계산
  const finalHerbs = useMemo(() => {
    const herbMap = new Map<string, number>();
    mergedHerbs.forEach(herb => {
      herbMap.set(herb.herb_name, Math.round(herb.dosage * totalDoses));
    });

    const adjustments = parseHerbAdjustment(herbAdjustment);
    adjustments.forEach(adj => {
      const current = herbMap.get(adj.name) || 0;
      if (adj.isAdd) {
        herbMap.set(adj.name, current + adj.amount);
      } else {
        const newAmount = current - adj.amount;
        if (newAmount <= 0) {
          herbMap.delete(adj.name);
        } else {
          herbMap.set(adj.name, newAmount);
        }
      }
    });

    // herb_id를 포함하여 반환하고 DB ID 순서로 정렬
    return Array.from(herbMap.entries())
      .map(([name, amount]) => ({
        herb_id: herbIdMap.get(name) || 99999, // DB에 없는 약재는 맨 뒤로
        name,
        amount
      }))
      .sort((a, b) => a.herb_id - b.herb_id); // DB ID 오름차순 정렬
  }, [mergedHerbs, totalDoses, herbAdjustment, herbIdMap]);

  // 최종 총량
  const finalTotalAmount = finalHerbs.reduce((sum, h) => sum + h.amount, 0);
  const totalPacks = days * dosesPerDay;

  // 탕전 물양 계산: 약재총량*1.2 + 한팩당용량*(팩수+1) + 300
  const waterAmount = Math.round(finalTotalAmount * 1.2 + packVolume * (totalPacks + 1) + 300);

  // 처방 데이터 생성
  const getPrescriptionData = useCallback((): PrescriptionData => ({
    formula,
    mergedHerbs,
    finalHerbs,
    totalDoses,
    days,
    dosesPerDay,
    totalPacks,
    herbAdjustment,
    notes,
    patientName,
    totalDosage,
    finalTotalAmount,
    packVolume,
    waterAmount,
  }), [formula, mergedHerbs, finalHerbs, totalDoses, days, dosesPerDay, totalPacks, herbAdjustment, notes, patientName, totalDosage, finalTotalAmount, packVolume, waterAmount]);

  // 변경 시 콜백 호출
  useEffect(() => {
    if (onChange && mergedHerbs.length > 0) {
      onChange(getPrescriptionData());
    }
  }, [formula, mergedHerbs, finalHerbs, totalDoses, days, dosesPerDay, packVolume, herbAdjustment, notes, patientName]);

  // 저장 핸들러
  const handleSave = () => {
    if (!formula.trim()) {
      alert('처방 공식을 입력해주세요.');
      return;
    }
    if (mergedHerbs.length === 0) {
      alert('유효한 처방 공식을 입력해주세요.');
      return;
    }

    if (onSave) {
      onSave(getPrescriptionData());
    }
  };

  // 템플릿 추가
  const addTemplateToFormula = (template: PrescriptionTemplate) => {
    const name = template.alias || template.name;
    if (!formula.trim()) {
      setFormula(name);
    } else {
      setFormula(formula.trim() + ' ' + name);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center text-clinic-text-secondary">
          <div className="border-4 border-clinic-background border-t-clinic-primary rounded-full w-12 h-12 animate-spin mb-4 mx-auto"></div>
          <p>처방 템플릿을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex gap-4 ${compact ? '' : 'h-full'}`}>
      {/* 왼쪽: 처방 입력 */}
      <div className={`${compact ? 'w-full' : 'w-1/2'} bg-white rounded-lg shadow-sm p-4 flex flex-col overflow-hidden`}>
        {/* 기록 연결 */}
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-clinic-text-primary flex items-center mb-2">
            <i className="fas fa-link text-clinic-primary mr-2"></i>
            기록 연결
          </h3>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              해당 환자의 탕약기록(처방전 미연결)
            </label>
            <select
              value={selectedHerbalDraftId ?? ''}
              onChange={(e) => {
                if (!onSelectHerbalDraftId) return;
                const raw = e.target.value;
                if (!raw) {
                  onSelectHerbalDraftId(null);
                  return;
                }
                const next = Number(raw);
                onSelectHerbalDraftId(Number.isFinite(next) ? next : null);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-clinic-primary focus:ring-2 focus:ring-clinic-primary focus:ring-opacity-20"
            >
              <option value="">선택 안 함</option>
              {unlinkedHerbalDrafts.map((draft) => (
                <option key={draft.id} value={draft.id}>
                  {`#${draft.id}${formatDraftCreatedAt(draft.created_at) ? ` · ${formatDraftCreatedAt(draft.created_at)}` : ''}`}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between mb-4 mt-5">
          <h2 className="text-lg font-semibold text-clinic-text-primary flex items-center">
            <i className="fas fa-edit text-clinic-primary mr-2"></i>
            처방 입력
            <span className="text-xs font-normal text-gray-500 ml-2">
              ({templates.length}개 처방)
            </span>
          </h2>
        </div>

        {/* 환자명 */}
        {showPatientInput && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">환자명</label>
            <input
              type="text"
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
              placeholder="환자 이름 입력..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-clinic-primary focus:ring-2 focus:ring-clinic-primary focus:ring-opacity-20"
            />
          </div>
        )}

        {/* 처방 공식 입력 */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            처방 공식
            <span className="text-xs text-gray-500 ml-2">예: 백인 소시호 반하사심</span>
          </label>
          <div className="relative">
            <input
              type="text"
              value={formula}
              onChange={(e) => setFormula(e.target.value)}
              placeholder="처방명을 띄어쓰기로 구분하여 입력"
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-opacity-20 text-lg ${
                parseError
                  ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                  : 'border-gray-300 focus:border-clinic-primary focus:ring-clinic-primary'
              }`}
            />
            <button
              onClick={() => {
                setShowTemplateList(!showTemplateList);
                if (!showTemplateList) setTemplateSearchTerm('');
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-sm"
            >
              <i className="fas fa-search mr-1"></i>처방검색
            </button>
          </div>
          {parseError && (
            <p className="text-red-500 text-xs mt-1">
              <i className="fas fa-exclamation-circle mr-1"></i>
              {parseError}
            </p>
          )}
        </div>

        {/* 처방 검색 드롭다운 */}
        {showTemplateList && (
          <div className="mb-4 border border-gray-300 rounded-lg overflow-hidden">
            <div className="p-2 bg-gray-50 border-b">
              <input
                type="text"
                value={templateSearchTerm}
                onChange={(e) => setTemplateSearchTerm(e.target.value)}
                placeholder="처방명 검색 (2글자 이상)..."
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-clinic-primary"
                autoFocus
              />
            </div>
            <div className="max-h-56 overflow-y-auto">
              {templateSearchTerm.length < 2 ? (
                <p className="px-3 py-4 text-center text-gray-500 text-sm">
                  2글자 이상 입력하면 처방이 검색됩니다
                </p>
              ) : (
                (() => {
                  const filtered = templates.filter(t =>
                    t.name.includes(templateSearchTerm) ||
                    (t.alias && t.alias.includes(templateSearchTerm))
                  );
                  if (filtered.length === 0) {
                    return (
                      <p className="px-3 py-4 text-center text-gray-500 text-sm">
                        검색 결과가 없습니다
                      </p>
                    );
                  }
                  return filtered.map(template => (
                    <div
                      key={template.id}
                      onClick={() => {
                        addTemplateToFormula(template);
                        setTemplateSearchTerm('');
                      }}
                      className="px-3 py-2 hover:bg-gray-100 cursor-pointer border-b last:border-b-0 flex justify-between items-center"
                    >
                      <span className="font-medium">{template.name}</span>
                      <span className="text-sm text-gray-500">
                        {template.alias && `(${template.alias})`}
                      </span>
                    </div>
                  ));
                })()
              )}
            </div>
          </div>
        )}

        {/* 첩수 자동조정 알림 */}
        {recommendedDoses !== null && recommendedDoses !== totalDoses && (
          <div className="mb-3 p-3 bg-amber-50 border border-amber-300 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="text-sm text-amber-800">
                <i className="fas fa-lightbulb text-amber-500 mr-2"></i>
                1첩 용량이 {totalDosage}g입니다. {days}일 × 100g 기준으로
                <span className="font-bold mx-1">{recommendedDoses}첩</span>을 권장합니다.
              </div>
              <button
                onClick={applyRecommendedDoses}
                className="px-3 py-1 bg-amber-500 text-white text-sm rounded hover:bg-amber-600 transition-colors"
              >
                적용
              </button>
            </div>
          </div>
        )}

        {/* 복용 설정 */}
        <div className="grid grid-cols-5 gap-2 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">첩수</label>
            <div className="flex items-center">
              <input
                type="number"
                value={totalDoses}
                onChange={(e) => setTotalDoses(parseFloat(e.target.value) || 1)}
                min={1}
                step={0.1}
                className="w-14 px-2 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-clinic-primary text-sm"
              />
              <span className="ml-1 text-gray-600 text-sm">첩</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">복용일수</label>
            <div className="flex items-center">
              <input
                type="number"
                value={days}
                onChange={(e) => setDays(parseInt(e.target.value) || 1)}
                min={1}
                className="w-14 px-2 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-clinic-primary text-sm"
              />
              <span className="ml-1 text-gray-600 text-sm">일</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">하루팩수</label>
            <div className="flex items-center">
              <input
                type="number"
                value={dosesPerDay}
                onChange={(e) => setDosesPerDay(parseInt(e.target.value) || 1)}
                min={1}
                max={5}
                className="w-14 px-2 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-clinic-primary text-sm"
              />
              <span className="ml-1 text-gray-600 text-sm">팩</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">팩용량</label>
            <div className="flex items-center">
              <input
                type="number"
                value={packVolume}
                onChange={(e) => setPackVolume(parseInt(e.target.value) || 100)}
                min={50}
                max={200}
                step={10}
                className="w-14 px-2 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-clinic-primary text-sm"
              />
              <span className="ml-1 text-gray-600 text-sm">ml</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">총팩수</label>
            <div className="flex items-center h-[42px]">
              <span className="text-lg font-semibold text-clinic-primary">
                {totalPacks}팩
              </span>
            </div>
          </div>
        </div>

        {/* 약재 조정 */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            약재 조정
            <span className="text-xs text-gray-500 ml-2">예: 녹용37-인삼30+백출20</span>
          </label>
          <input
            type="text"
            value={herbAdjustment}
            onChange={(e) => setHerbAdjustment(e.target.value)}
            placeholder="추가: 약재명+용량, 제거: -약재명+용량"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-clinic-primary focus:ring-2 focus:ring-clinic-primary focus:ring-opacity-20"
          />
          {herbAdjustment && parseHerbAdjustment(herbAdjustment).length > 0 && (
            <div className="mt-1 text-xs text-gray-600">
              {parseHerbAdjustment(herbAdjustment).map((adj, i) => (
                <span key={i} className={`mr-2 ${adj.isAdd ? 'text-green-600' : 'text-red-600'}`}>
                  {adj.isAdd ? '+' : '-'}{adj.name} {adj.amount}g
                </span>
              ))}
            </div>
          )}
        </div>

        {/* 특이사항 */}
        {showNotesInput && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">특이사항</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="특이사항 입력..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-clinic-primary focus:ring-2 focus:ring-clinic-primary focus:ring-opacity-20"
            />
          </div>
        )}

        {/* 저장 버튼은 헤더로 이동 */}
      </div>

      {/* 오른쪽: 처방 미리보기 */}
      {!compact && (
        <div className="w-1/2 bg-white rounded-lg shadow-sm p-4 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-clinic-text-primary flex items-center">
              <i className="fas fa-eye text-clinic-primary mr-2"></i>
              미리보기
              {finalHerbs.length > 0 && (
                <span className="ml-2 px-2.5 py-0.5 bg-blue-500 text-white text-sm font-bold rounded-full">총 {finalHerbs.length}개</span>
              )}
            </h2>
            <div className="flex items-center gap-1">
              {mergedHerbs.length > 0 && (
                <button
                  onClick={handlePrint}
                  className="px-4 py-1.5 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                >
                  <i className="fas fa-print mr-1"></i>인쇄
                </button>
              )}
              {showSaveButton && (
                <button
                  onClick={handleSave}
                  disabled={mergedHerbs.length === 0}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    mergedHerbs.length > 0
                      ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <i className="fas fa-save mr-1"></i>저장
                </button>
              )}
              {onClose && (
                <button
                  onClick={onClose}
                  className="px-4 py-1.5 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                >
                  <i className="fas fa-times mr-1"></i>닫기
                </button>
              )}
            </div>
          </div>

          {mergedHerbs.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <i className="fas fa-mortar-pestle text-6xl mb-4"></i>
                <p>처방 공식을 입력하면<br/>합쳐진 약재가 표시됩니다</p>
              </div>
            </div>
          ) : (
            <>
              {/* 약재 목록 */}
              <div className="flex-1 overflow-y-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">약재명</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600 uppercase">1첩</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600 uppercase">최종 총량</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {finalHerbs.map((herb, index) => {
                      const originalHerb = mergedHerbs.find(h => h.herb_name === herb.name);
                      const originalTotal = originalHerb ? Math.round(originalHerb.dosage * totalDoses) : 0;
                      const isAdjusted = originalTotal !== herb.amount;
                      const isNew = !originalHerb;

                      return (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-medium text-clinic-text-primary">
                            {herb.name}
                            {isNew && <span className="ml-1 text-xs text-green-600">(추가)</span>}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-clinic-text-secondary">
                            {originalHerb ? `${originalHerb.dosage}g` : '-'}
                          </td>
                          <td className={`px-4 py-3 text-sm text-right font-semibold ${isAdjusted ? 'text-amber-600' : 'text-clinic-primary'}`}>
                            {Math.round(herb.amount)}g
                            {isAdjusted && !isNew && (
                              <span className="text-xs ml-1">
                                ({herb.amount > originalTotal ? '+' : ''}{Math.round(herb.amount - originalTotal)})
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-gray-100">
                    <tr>
                      <td className="px-4 py-3 text-sm font-bold text-clinic-text-primary">합계</td>
                      <td className="px-4 py-3 text-sm text-right font-bold text-clinic-text-primary">
                        {totalDosage}g
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-bold text-clinic-primary">
                        {Math.round(finalTotalAmount)}g
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* 공식 표시 제거됨 */}
            </>
          )}
        </div>
      )}

      {/* 인쇄 미리보기 모달 */}
      {showPrintPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-[80] p-4">
          <div className="bg-white rounded-xl w-full max-w-[650px] max-h-[90vh] flex flex-col shadow-lg overflow-hidden">
            <div className="bg-gray-50 px-5 py-3 flex justify-between items-center border-b border-gray-200 flex-shrink-0">
              <h3 className="text-base font-semibold text-gray-800">
                <i className="fas fa-print text-gray-500 mr-2"></i>인쇄 미리보기
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { executePrint(); }}
                  className="px-4 py-1.5 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                >
                  <i className="fas fa-print mr-1"></i>인쇄
                </button>
                <button
                  onClick={() => setShowPrintPreview(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>
            </div>
            <iframe
              srcDoc={getPortrait2Html()}
              className="flex-1 w-full bg-white"
              style={{ minHeight: '70vh' }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default PrescriptionInput;
