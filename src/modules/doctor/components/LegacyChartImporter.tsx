/**
 * LegacyChartImporter
 * 기존 차트 등록 - 하나의 텍스트에서 초진/경과를 분리하여 저장
 */

import React, { useState } from 'react';
import { insert, escapeString, getCurrentTimestamp } from '@shared/lib/postgres';

interface Props {
  patientId: number;
  patientName: string;
  treatmentPlanId: number;
  onClose: () => void;
  onSuccess: () => void;
}

interface ProgressSections {
  progress: string[];   // 일반 경과
  abdomen: string[];    // 복진
  tongue: string[];     // 설진
  pulse: string[];      // 맥진
  complexion: string[]; // 혈색
}

interface ParsedProgress {
  visitNumber: number;
  type: 'visit' | 'call'; // ▶ = 방문, ☎ = 전화
  date: string | null;
  prescription: string | null;
  sections: ProgressSections;
}

interface ParsedChart {
  initialContent: string; // 초진 내용 (마커 없는 부분)
  initialDate: string | null;
  initialPrescription: string | null;
  progressList: ParsedProgress[];
}

const LegacyChartImporter: React.FC<Props> = ({
  patientId,
  patientName,
  treatmentPlanId,
  onClose,
  onSuccess,
}) => {
  const [rawText, setRawText] = useState('');
  const [parsedResult, setParsedResult] = useState<ParsedChart | null>(null);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<'input' | 'preview'>('input');

  // 날짜 파싱 (YY/MM/DD 형식)
  const parseDate = (text: string): string | null => {
    const match = text.match(/(\d{2})\/(\d{1,2})\/(\d{1,2})/);
    if (match) {
      const year = 2000 + parseInt(match[1]);
      const month = match[2].padStart(2, '0');
      const day = match[3].padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    return null;
  };

  // 카테고리 분류 함수
  const categorizeContent = (content: string): keyof ProgressSections => {
    // 복진 패턴
    if (/^>?\s*(복피|복외측|복직근|심하부|임맥선|하복부|흉협부|심흉부|복탄력)/.test(content)) {
      return 'abdomen';
    }
    // 설진 패턴
    if (/^\[설진\]|^>?\s*(사상유두|설태|설질)/.test(content)) {
      return 'tongue';
    }
    // 맥진 패턴
    if (/^\[맥진\]|^-?\s*(촌구맥|인영맥|맥진)/.test(content)) {
      return 'pulse';
    }
    // 혈색 패턴
    if (/^\[혈색\]|^-?\s*(하안검)|^>?\s*(멍|매핵기)/.test(content)) {
      return 'complexion';
    }
    // 기본: 경과
    return 'progress';
  };

  // 빈 섹션 생성
  const createEmptySections = (): ProgressSections => ({
    progress: [],
    abdomen: [],
    tongue: [],
    pulse: [],
    complexion: [],
  });

  // 텍스트 파싱
  const parseChartText = (text: string): ParsedChart => {
    const lines = text.split('\n');

    const numberMap: { [key: string]: number } = {
      '①': 1, '②': 2, '③': 3, '④': 4, '⑤': 5,
      '⑥': 6, '⑦': 7, '⑧': 8, '⑨': 9, '⑩': 10,
      '⑪': 11, '⑫': 12, '⑬': 13, '⑭': 14, '⑮': 15,
      '⑯': 16, '⑰': 17, '⑱': 18, '⑲': 19, '⑳': 20,
    };

    // 처방 라인 패턴: 날짜 <처방명>
    const prescriptionPattern = /^([▶☎]?[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳]?)?\s*(\d{2}\/\d{1,2}\/\d{1,2})\s*<(.+?)>/;

    // 연속 라인 패턴: -, *, +, ** 등으로 시작하는 라인
    const continuationPattern = /^[-*+]|\*\*/;

    const progressMap = new Map<number, ParsedProgress>();
    const initialLines: string[] = [];
    let initialDate: string | null = null;
    let initialPrescription: string | null = null;

    // 현재 활성화된 경과 번호 (마커 이후 연속 라인 처리용)
    let activeProgressNum: number | null = null;

    // 내용을 경과에 추가하는 헬퍼 함수
    const addToProgress = (visitNum: number, content: string) => {
      if (!progressMap.has(visitNum)) return;
      const category = categorizeContent(content);
      // 이미 구분자가 있는 경우 제거 (예: "[설진] 사상유두가..." -> "사상유두가...")
      let cleanContent = content;
      if (category === 'tongue' && content.startsWith('[설진]')) {
        cleanContent = content.replace(/^\[설진\]\s*/, '');
      } else if (category === 'pulse' && content.startsWith('[맥진]')) {
        cleanContent = content.replace(/^\[맥진\]\s*/, '');
      } else if (category === 'complexion' && content.startsWith('[혈색]')) {
        cleanContent = content.replace(/^\[혈색\]\s*/, '');
      } else if (category === 'abdomen' && content.startsWith('[복진]')) {
        cleanContent = content.replace(/^\[복진\]\s*/, '');
      } else if (category === 'progress' && content.startsWith('[경과]')) {
        cleanContent = content.replace(/^\[경과\]\s*/, '');
      }
      if (cleanContent.trim()) {
        progressMap.get(visitNum)!.sections[category].push(cleanContent);
      }
    };

    // 1차 파싱: 각 라인 분류
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;

      // 처방 라인 체크
      const prescMatch = trimmedLine.match(prescriptionPattern);
      if (prescMatch) {
        const marker = prescMatch[1] || '';
        const dateStr = prescMatch[2];
        const prescription = prescMatch[3];
        const parsedDate = parseDate(dateStr);

        if (marker) {
          // 경과 처방
          const typeChar = marker[0];
          const numChar = marker[1];
          const visitNum = numberMap[numChar] || 1;
          const type = typeChar === '☎' ? 'call' : 'visit';

          if (!progressMap.has(visitNum)) {
            progressMap.set(visitNum, {
              visitNumber: visitNum,
              type,
              date: parsedDate,
              prescription: `<${prescription}>`,
              sections: createEmptySections(),
            });
          } else {
            const existing = progressMap.get(visitNum)!;
            existing.date = parsedDate;
            existing.prescription = `<${prescription}>`;
          }
        } else {
          // 초진 처방
          initialDate = parsedDate;
          initialPrescription = `<${prescription}>`;
        }
        activeProgressNum = null; // 처방 라인 후에는 활성 경과 리셋
        continue;
      }

      // 일반 라인에서 마커 체크
      const markerRegex = /([▶☎])([①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳])/g;
      const markers: { index: number; marker: string; typeChar: string; numChar: string }[] = [];
      let match;

      while ((match = markerRegex.exec(trimmedLine)) !== null) {
        markers.push({
          index: match.index,
          marker: match[0],
          typeChar: match[1],
          numChar: match[2],
        });
      }

      if (markers.length > 0) {
        // 마커가 있는 라인 - 각 마커 뒤의 텍스트를 해당 경과에 추가
        const prefix = trimmedLine.substring(0, markers[0].index).trim();

        for (let i = 0; i < markers.length; i++) {
          const m = markers[i];
          const visitNum = numberMap[m.numChar] || 1;
          const type = m.typeChar === '☎' ? 'call' : 'visit';

          // 다음 마커까지의 텍스트 추출 (마커 자체는 제외)
          const startIdx = m.index + m.marker.length;
          const endIdx = markers[i + 1]?.index ?? trimmedLine.length;
          let content = trimmedLine.substring(startIdx, endIdx).trim();

          // 프리픽스가 있으면 추가 (예: "> 복피 : ")
          if (prefix && content) {
            content = `${prefix} ${content}`;
          } else if (prefix && !content) {
            content = prefix;
          }

          if (!progressMap.has(visitNum)) {
            progressMap.set(visitNum, {
              visitNumber: visitNum,
              type,
              date: null,
              prescription: null,
              sections: createEmptySections(),
            });
          }

          if (content) {
            addToProgress(visitNum, content);
          }

          // 마지막 마커의 경과 번호를 활성화 (다음 연속 라인 처리용)
          if (i === markers.length - 1) {
            activeProgressNum = visitNum;
          }
        }
      } else if (activeProgressNum !== null && continuationPattern.test(trimmedLine)) {
        // 활성 경과가 있고, 연속 라인 패턴(-, *, + 등)으로 시작하는 경우
        // 해당 경과의 변경사항에 추가
        if (progressMap.has(activeProgressNum)) {
          addToProgress(activeProgressNum, trimmedLine);
        }
      } else {
        // 마커 없는 라인 - 초진 내용
        initialLines.push(line);
        activeProgressNum = null; // 일반 라인이 나오면 활성 경과 리셋
      }
    }

    // 결과 정리
    const progressList = Array.from(progressMap.values()).sort((a, b) => a.visitNumber - b.visitNumber);

    return {
      initialContent: initialLines.join('\n'),
      initialDate,
      initialPrescription,
      progressList,
    };
  };

  // 섹션을 구분자와 함께 문자열로 변환
  const formatSectionsToString = (sections: ProgressSections, prescription: string | null): string => {
    const parts: string[] = [];

    if (sections.progress.length > 0) {
      parts.push('[경과]');
      parts.push(...sections.progress);
    }

    if (sections.abdomen.length > 0) {
      parts.push('');
      parts.push('[복진]');
      parts.push(...sections.abdomen);
    }

    if (sections.tongue.length > 0) {
      parts.push('');
      parts.push('[설진]');
      parts.push(...sections.tongue);
    }

    if (sections.pulse.length > 0) {
      parts.push('');
      parts.push('[맥진]');
      parts.push(...sections.pulse);
    }

    if (sections.complexion.length > 0) {
      parts.push('');
      parts.push('[혈색]');
      parts.push(...sections.complexion);
    }

    if (prescription) {
      parts.push('');
      parts.push('[처방]');
      parts.push(prescription);
    }

    return parts.join('\n');
  };

  // 미리보기
  const handlePreview = () => {
    if (!rawText.trim()) {
      alert('차트 내용을 입력해주세요.');
      return;
    }

    const result = parseChartText(rawText);
    setParsedResult(result);
    setStep('preview');
  };

  // 저장
  const handleSave = async () => {
    if (!parsedResult) return;

    setSaving(true);
    try {
      const now = getCurrentTimestamp();
      const chartDate = parsedResult.initialDate || new Date().toISOString().split('T')[0];

      // 1. 초진차트 저장
      const chartId = await insert(`
        INSERT INTO initial_charts (patient_id, notes, chart_date, treatment_plan_id, created_at, updated_at)
        VALUES (
          ${patientId},
          ${escapeString(parsedResult.initialContent)},
          ${escapeString(chartDate)},
          ${treatmentPlanId},
          ${escapeString(now)},
          ${escapeString(now)}
        )
      `);

      console.log('초진차트 저장 완료:', chartId);

      // 2. 경과기록 저장
      for (const progress of parsedResult.progressList) {
        const noteDate = progress.date || chartDate;
        const content = formatSectionsToString(progress.sections, progress.prescription);
        const assessment = `${progress.visitNumber}차 ${progress.type === 'call' ? '전화상담' : '내원'}`;

        await insert(`
          INSERT INTO progress_notes (
            patient_id, note_date, assessment, notes, treatment_plan_id, created_at, updated_at
          ) VALUES (
            ${patientId},
            ${escapeString(noteDate)},
            ${escapeString(assessment)},
            ${escapeString(content)},
            ${treatmentPlanId},
            ${escapeString(now)},
            ${escapeString(now)}
          )
        `);

        console.log(`${progress.visitNumber}차 경과 저장 완료`);
      }

      alert(`초진차트 1개, 경과기록 ${parsedResult.progressList.length}개가 저장되었습니다.`);
      onSuccess();
    } catch (error) {
      console.error('저장 실패:', error);
      alert('저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* 헤더 */}
        <div className="flex-shrink-0 px-6 py-4 border-b flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-800">기존 차트 등록</h2>
            <p className="text-sm text-gray-500">{patientName} 환자 - 초진/경과 자동 분리</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <i className="fas fa-times text-xl"></i>
          </button>
        </div>

        {/* 컨텐츠 */}
        <div className="flex-1 overflow-auto p-6">
          {step === 'input' ? (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-medium text-blue-800 mb-2">
                  <i className="fas fa-info-circle mr-2"></i>사용 방법
                </h3>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>기존 차트 텍스트를 아래에 붙여넣기 하세요.</li>
                  <li><code className="bg-blue-100 px-1 rounded">▶①</code>, <code className="bg-blue-100 px-1 rounded">☎②</code> 등의 마커로 경과를 구분합니다.</li>
                  <li>처방 라인(<code className="bg-blue-100 px-1 rounded">25/8/26 &lt;처방명&gt;</code>)에서 날짜를 추출합니다.</li>
                  <li>마커가 없는 내용은 초진차트로 저장됩니다.</li>
                </ul>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  차트 내용 붙여넣기
                </label>
                <textarea
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  className="w-full h-96 px-4 py-3 border rounded-lg font-mono text-sm focus:ring-2 focus:ring-clinic-primary focus:border-clinic-primary resize-none"
                  placeholder="기존 차트 내용을 여기에 붙여넣기..."
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* 초진차트 미리보기 */}
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-clinic-primary text-white px-4 py-2 font-medium">
                  <i className="fas fa-file-medical mr-2"></i>
                  초진차트
                  {parsedResult?.initialDate && (
                    <span className="ml-2 text-sm opacity-80">({parsedResult.initialDate})</span>
                  )}
                </div>
                <div className="p-4 bg-gray-50 max-h-48 overflow-auto">
                  <pre className="text-sm whitespace-pre-wrap font-sans">
                    {parsedResult?.initialContent || '(내용 없음)'}
                  </pre>
                  {parsedResult?.initialPrescription && (
                    <p className="mt-2 text-sm text-clinic-primary font-medium">
                      처방: {parsedResult.initialPrescription}
                    </p>
                  )}
                </div>
              </div>

              {/* 경과기록 미리보기 */}
              {parsedResult?.progressList.map((progress) => (
                <div key={progress.visitNumber} className="border rounded-lg overflow-hidden">
                  <div className={`px-4 py-2 font-medium text-white ${
                    progress.type === 'call' ? 'bg-amber-500' : 'bg-green-600'
                  }`}>
                    <i className={`fas ${progress.type === 'call' ? 'fa-phone' : 'fa-user'} mr-2`}></i>
                    {progress.visitNumber}차 {progress.type === 'call' ? '전화상담' : '내원'}
                    {progress.date && (
                      <span className="ml-2 text-sm opacity-80">({progress.date})</span>
                    )}
                  </div>
                  <div className="p-4 bg-gray-50">
                    <pre className="text-sm whitespace-pre-wrap font-sans">
                      {formatSectionsToString(progress.sections, progress.prescription) || '(내용 없음)'}
                    </pre>
                  </div>
                </div>
              ))}

              {parsedResult?.progressList.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <i className="fas fa-info-circle text-2xl mb-2"></i>
                  <p>분리된 경과기록이 없습니다.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="flex-shrink-0 px-6 py-4 border-t bg-gray-50 rounded-b-xl flex items-center justify-between">
          <div className="text-sm text-gray-500">
            {step === 'preview' && parsedResult && (
              <>
                초진 1개 + 경과 {parsedResult.progressList.length}개로 분리됨
              </>
            )}
          </div>
          <div className="flex gap-2">
            {step === 'preview' && (
              <button
                onClick={() => setStep('input')}
                className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <i className="fas fa-arrow-left mr-2"></i>
                수정
              </button>
            )}
            <button
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
            >
              취소
            </button>
            {step === 'input' ? (
              <button
                onClick={handlePreview}
                className="px-5 py-2 bg-clinic-primary text-white rounded-lg hover:bg-clinic-primary/90 transition-colors flex items-center gap-2"
              >
                <i className="fas fa-eye"></i>
                미리보기
              </button>
            ) : (
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    저장 중...
                  </>
                ) : (
                  <>
                    <i className="fas fa-save"></i>
                    저장하기
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LegacyChartImporter;
