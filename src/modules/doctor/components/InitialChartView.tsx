import React, { useState, useEffect } from 'react';
import { query, queryOne, execute, insert, escapeString, getCurrentTimestamp, getCurrentDate } from '@shared/lib/postgres';
import type { InitialChart, TreatmentPlan } from '../types';

interface Props {
  patientId: number;
  patientName: string;
  onClose: () => void;
  forceNew?: boolean; // 새진료 시작일 때 true
  treatmentPlan?: Partial<TreatmentPlan> | null; // 진료 계획 정보
}

const InitialChartView: React.FC<Props> = ({ patientId, patientName, onClose, forceNew = false, treatmentPlan }) => {
  const [chart, setChart] = useState<InitialChart | null>(null);
  const [isEditing, setIsEditing] = useState(forceNew); // forceNew이면 바로 편집 모드
  const [loading, setLoading] = useState(!forceNew); // forceNew이면 로딩 안함
  const [formData, setFormData] = useState<Partial<InitialChart>>({});
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  // 구분자를 기준으로 섹션 파싱 ([], > 모두 지원)
  // 텍스트에서 날짜 추출 (YY/MM/DD, YYYY-MM-DD, YYYY.MM.DD 형식 지원)
  const extractDateFromText = (text: string): string | null => {
    if (!text) return null;

    // 패턴 1: YY/MM/DD (예: 25/11/15, 24/12/31)
    const pattern1 = text.match(/(\d{2})\/(\d{1,2})\/(\d{1,2})/);
    if (pattern1) {
      const year = parseInt(pattern1[1]) + 2000; // 25 -> 2025
      const month = pattern1[2].padStart(2, '0');
      const day = pattern1[3].padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    // 패턴 2: YYYY-MM-DD 또는 YYYY/MM/DD
    const pattern2 = text.match(/(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
    if (pattern2) {
      const year = pattern2[1];
      const month = pattern2[2].padStart(2, '0');
      const day = pattern2[3].padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    // 패턴 3: YYYY.MM.DD
    const pattern3 = text.match(/(\d{4})\.(\d{1,2})\.(\d{1,2})/);
    if (pattern3) {
      const year = pattern3[1];
      const month = pattern3[2].padStart(2, '0');
      const day = pattern3[3].padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    return null;
  };

  const parseChartSections = (text: string) => {
    if (!text) return [];

    interface Subsection {
      title: string;
      content: string;
    }

    interface Section {
      title: string;
      subsections: Subsection[];
      directContent: string;
    }

    const sections: Section[] = [];
    const lines = text.split('\n');
    let currentSection: Section | null = null;
    let currentSubsection: Subsection | null = null;

    lines.forEach(line => {
      const sectionMatch = line.match(/^\[(.+?)\](.*)$/);
      const subsectionMatch = line.match(/^>\s*(.+?)$/);

      if (sectionMatch) {
        // 새로운 대분류 섹션 시작
        if (currentSection) {
          if (currentSubsection) {
            currentSection.subsections.push(currentSubsection);
            currentSubsection = null;
          }
          sections.push(currentSection);
        }
        currentSection = {
          title: sectionMatch[1].trim(),
          subsections: [],
          directContent: sectionMatch[2].trim() // [주소증] 바로 뒤에 오는 내용
        };
      } else if (subsectionMatch && currentSection) {
        // 새로운 중분류 시작
        if (currentSubsection) {
          currentSection.subsections.push(currentSubsection);
        }
        currentSubsection = {
          title: subsectionMatch[1].trim(),
          content: ''
        };
      } else {
        // 내용 추가 (빈 줄 포함)
        if (currentSubsection) {
          currentSubsection.content += (currentSubsection.content ? '\n' : '') + line;
        } else if (currentSection) {
          currentSection.directContent += (currentSection.directContent ? '\n' : '') + line;
        }
      }
    });

    // 마지막 subsection과 section 추가
    if (currentSubsection && currentSection) {
      currentSection.subsections.push(currentSubsection);
    }
    if (currentSection) {
      sections.push(currentSection);
    }

    // 각 섹션의 내용 끝부분 공백 제거
    sections.forEach(section => {
      section.directContent = section.directContent.trim();
      section.subsections.forEach(subsection => {
        subsection.content = subsection.content.trim();
      });
    });

    return sections;
  };

  useEffect(() => {
    if (forceNew) {
      // 새진료 시작: 빈 폼 데이터로 시작 (오늘 날짜로 초기화)
      const today = getCurrentDate(); // YYYY-MM-DD 형식
      setFormData({
        patient_id: patientId,
        chart_date: today
      });
      setIsEditing(true);
      setLoading(false);
    } else {
      // 기존 방식: 차트 로드
      loadChart();
    }
  }, [patientId, forceNew]);

  // 자동 저장 (5초 디바운스)
  useEffect(() => {
    if (!isEditing || !formData.notes || !formData.chart_date) {
      return;
    }

    setAutoSaveStatus('idle');

    const timer = setTimeout(async () => {
      await autoSave();
    }, 5000); // 5초 대기

    return () => clearTimeout(timer);
  }, [formData.notes, formData.chart_date, isEditing]);

  const loadChart = async () => {
    try {
      setLoading(true);
      const data = await queryOne<InitialChart>(
        `SELECT * FROM initial_charts WHERE patient_id = ${patientId} ORDER BY created_at DESC LIMIT 1`
      );

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

  const autoSave = async () => {
    try {
      setAutoSaveStatus('saving');

      if (!formData.notes || formData.notes.trim() === '') {
        setAutoSaveStatus('idle');
        return;
      }

      if (!formData.chart_date) {
        setAutoSaveStatus('idle');
        return;
      }

      const now = getCurrentTimestamp();
      const chartDate = new Date(formData.chart_date).toISOString();
      const notes = formData.notes.trim();

      if (forceNew || !chart) {
        // 새 차트 생성
        const newId = await insert(`
          INSERT INTO initial_charts (patient_id, notes, chart_date, created_at, updated_at)
          VALUES (${patientId}, ${escapeString(notes)}, ${escapeString(chartDate)}, ${escapeString(now)}, ${escapeString(now)})
        `);

        if (newId) {
          const newChart = await queryOne<InitialChart>(
            `SELECT * FROM initial_charts WHERE id = ${newId}`
          );
          if (newChart) {
            setChart(newChart);
            console.log('자동저장 완료 (새 차트)');
          }
        }
      } else {
        // 기존 차트 업데이트
        await execute(`
          UPDATE initial_charts SET
            notes = ${escapeString(notes)},
            chart_date = ${escapeString(chartDate)},
            updated_at = ${escapeString(now)}
          WHERE id = ${chart.id}
        `);
        console.log('자동저장 완료 (업데이트)');
      }

      setAutoSaveStatus('saved');

      // 2초 후 saved 상태 초기화
      setTimeout(() => {
        setAutoSaveStatus('idle');
      }, 2000);
    } catch (error) {
      console.error('자동저장 오류:', error);
      setAutoSaveStatus('idle');
    }
  };

  const handleSave = async () => {
    try {
      // 입력 검증
      if (!formData.notes || formData.notes.trim() === '') {
        alert('차트 내용을 입력해주세요.');
        return;
      }

      if (!formData.chart_date) {
        alert('진료일자를 입력해주세요.');
        return;
      }

      const now = getCurrentTimestamp();
      const chartDate = new Date(formData.chart_date).toISOString();
      const notes = formData.notes.trim();

      console.log('저장 데이터:', { patientId, notes: notes.substring(0, 50), chartDate });

      if (forceNew) {
        // 새진료 시작: 무조건 새로 insert
        console.log('새진료 차트 생성 시도...');
        await insert(`
          INSERT INTO initial_charts (patient_id, notes, chart_date, created_at, updated_at)
          VALUES (${patientId}, ${escapeString(notes)}, ${escapeString(chartDate)}, ${escapeString(now)}, ${escapeString(now)})
        `);

        console.log('생성 성공');
        alert('새 진료차트가 생성되었습니다');
        onClose(); // 저장 후 닫기
      } else if (chart) {
        // 수정
        await execute(`
          UPDATE initial_charts SET
            notes = ${escapeString(notes)},
            chart_date = ${escapeString(chartDate)},
            updated_at = ${escapeString(now)}
          WHERE id = ${chart.id}
        `);

        alert('초진차트가 수정되었습니다');
        setIsEditing(false);
        await loadChart();
      } else {
        // 신규 생성
        console.log('초진차트 신규 생성 시도...');
        await insert(`
          INSERT INTO initial_charts (patient_id, notes, chart_date, created_at, updated_at)
          VALUES (${patientId}, ${escapeString(notes)}, ${escapeString(chartDate)}, ${escapeString(now)}, ${escapeString(now)})
        `);

        console.log('생성 성공');
        alert('초진차트가 생성되었습니다');
        setIsEditing(false);
        await loadChart();
      }
    } catch (error: any) {
      console.error('저장 실패:', error);
      alert('저장에 실패했습니다.\n\n오류: ' + (error.message || error));
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="border-4 border-clinic-background border-t-clinic-primary rounded-full w-8 h-8 animate-spin"></div>
            <p className="text-clinic-text-secondary">로딩 중...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-gradient-to-r from-clinic-primary to-clinic-secondary border-b p-3 flex justify-between items-center text-white shadow-md">
          <div className="flex items-center gap-2">
            <i className="fas fa-file-medical text-lg"></i>
            <h2 className="text-lg font-bold">초진차트 - {patientName}</h2>
          </div>
          <div className="flex gap-2">
            {!isEditing && chart && (
              <button
                onClick={() => setIsEditing(true)}
                className="px-3 py-1.5 bg-white text-clinic-primary rounded-lg hover:bg-gray-100 transition-colors font-medium text-sm"
              >
                <i className="fas fa-edit mr-1"></i>수정
              </button>
            )}
            <button
              onClick={onClose}
              className="px-3 py-1.5 bg-white bg-opacity-20 hover:bg-opacity-30 text-white rounded-lg transition-colors font-medium text-sm"
            >
              <i className="fas fa-times mr-1"></i>닫기
            </button>
          </div>
        </div>

        <div className="p-4">
          {isEditing ? (
            <div className="space-y-4">
              {/* 진료일자 입력 */}
              <div>
                <label className="block font-semibold mb-2 text-lg text-clinic-text-primary">
                  <i className="fas fa-calendar-alt mr-2 text-clinic-primary"></i>
                  진료일자 <span className="text-sm font-normal text-clinic-text-secondary">(실제 진료를 시행한 날짜)</span>
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="date"
                    value={formData.chart_date || ''}
                    onChange={(e) => setFormData({ ...formData, chart_date: e.target.value })}
                    className="border-2 border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:border-clinic-primary focus:ring-2 focus:ring-clinic-primary focus:ring-opacity-20 transition-colors"
                    required
                  />
                  <span className="text-xs text-blue-600 bg-blue-50 px-3 py-2 rounded border border-blue-200">
                    <i className="fas fa-magic mr-1"></i>
                    차트 내용에서 날짜를 자동으로 추출합니다 (예: 25/11/15)
                  </span>
                  {/* 자동저장 상태 */}
                  {autoSaveStatus === 'saving' && (
                    <span className="text-xs text-gray-600 flex items-center">
                      <i className="fas fa-spinner fa-spin mr-1"></i>
                      저장 중...
                    </span>
                  )}
                  {autoSaveStatus === 'saved' && (
                    <span className="text-xs text-green-600 flex items-center">
                      <i className="fas fa-check-circle mr-1"></i>
                      자동저장 완료
                    </span>
                  )}
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-2 text-lg text-clinic-text-primary">초진차트 내용</label>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                  <p className="text-sm text-blue-800 mb-2">
                    <i className="fas fa-info-circle mr-1"></i>
                    <strong>작성 방법:</strong>
                  </p>
                  <ul className="text-xs text-blue-700 space-y-1 ml-5 list-disc">
                    <li>대분류(큰 섹션): <code className="bg-blue-100 px-1 rounded">[제목]</code> 형식</li>
                    <li>중분류(세부 항목): <code className="bg-blue-100 px-1 rounded">&gt; 제목</code> 형식</li>
                    <li>예: [주소증], [문진], [복진], [처방] / &gt; 식사패턴, &gt; 소화, &gt; 커피 등</li>
                    <li className="text-green-700 font-semibold">
                      <i className="fas fa-save mr-1"></i>
                      입력 후 5초마다 자동저장됩니다
                    </li>
                  </ul>
                </div>
                <textarea
                  value={formData.notes || ''}
                  onChange={(e) => {
                    const newNotes = e.target.value;
                    const extractedDate = extractDateFromText(newNotes);

                    // 텍스트에서 날짜를 찾았고, 아직 진료일자가 설정되지 않았거나 오늘 날짜인 경우 자동 설정
                    if (extractedDate) {
                      const today = getCurrentDate();
                      if (!formData.chart_date || formData.chart_date === today) {
                        setFormData({ ...formData, notes: newNotes, chart_date: extractedDate });
                        return;
                      }
                    }

                    setFormData({ ...formData, notes: newNotes });
                  }}
                  className="w-full border-2 border-gray-300 rounded-lg p-3 focus:outline-none focus:border-clinic-primary focus:ring-2 focus:ring-clinic-primary focus:ring-opacity-20 transition-colors font-mono"
                  rows={20}
                  placeholder="[주소증] 여/38세/165cm/74kg&#10;1. 임신준비&#10;- 딸이 3명인데, 남아를 낳고 싶다.&#10;&#10;2. 비염&#10;- 비염이 심하게 오면 두통이 온다.&#10;&#10;[문진]&#10;> 식사패턴 : 규칙적&#10;- 아침식사 : 안먹는다.&#10;- 점심식사 : 12시&#10;&#10;> 소화&#10;- 배고픔 : 때가 되면 느낀다.&#10;- 소화상태 : 더부룩함&#10;&#10;> 커피 : 하루1~2잔&#10;- 커피 종류 : 아메리카노&#10;&#10;[복진]&#10;> 복직근 : 긴장+압통&#10;> 심하부 : 압통 있음&#10;&#10;[처방]&#10;25/11/15 백인 소시호 귀비탕 15일분"
                  style={{ fontSize: '0.9rem', lineHeight: '1.5' }}
                />
              </div>

              <div className="flex gap-2 pt-4 border-t">
                <button
                  onClick={handleSave}
                  className="px-6 py-2 bg-clinic-accent text-white rounded-lg hover:bg-green-700 transition-colors font-semibold shadow-md"
                >
                  <i className="fas fa-save mr-2"></i>저장
                </button>
                <button
                  onClick={() => {
                    setIsEditing(false);
                    if (chart) setFormData(chart);
                  }}
                  className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors font-medium"
                >
                  <i className="fas fa-times mr-2"></i>취소
                </button>
              </div>
            </div>
          ) : chart ? (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-lg mb-4 text-clinic-text-primary flex items-center">
                  <i className="fas fa-clipboard-list text-clinic-primary mr-2"></i>
                  초진차트
                </h3>

                {(() => {
                  const sections = parseChartSections(chart.notes || '');

                  if (sections.length === 0) {
                    return (
                      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                        <p className="text-gray-500">내용이 없습니다.</p>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-4">
                      {sections.map((section, sectionIndex) => (
                        <div key={sectionIndex} className="bg-white border-2 border-clinic-primary rounded-lg overflow-hidden shadow-md">
                          {/* 대분류 제목 */}
                          <div className="bg-gradient-to-r from-clinic-primary to-clinic-secondary px-4 py-3">
                            <h4 className="font-bold text-white text-lg flex items-center">
                              <i className="fas fa-folder-open text-base mr-2"></i>
                              {section.title}
                            </h4>
                          </div>

                          {/* 대분류 직접 내용 (subsection 없이 바로 오는 내용) */}
                          {section.directContent && (
                            <div className="px-4 py-3 bg-blue-50 border-b border-gray-200">
                              <p className="text-clinic-text-primary whitespace-pre-wrap" style={{ lineHeight: '1.7', fontSize: '0.95rem' }}>
                                {section.directContent}
                              </p>
                            </div>
                          )}

                          {/* 중분류들 */}
                          {section.subsections.length > 0 && (
                            <div className="p-4 space-y-3">
                              {section.subsections.map((subsection, subIndex) => (
                                <div key={subIndex} className="border-l-4 border-clinic-secondary pl-4 py-2 bg-gray-50 rounded-r">
                                  <h5 className="font-semibold text-clinic-primary mb-2 flex items-center text-base">
                                    <i className="fas fa-angle-right text-sm mr-2"></i>
                                    {subsection.title}
                                  </h5>
                                  <div className="text-clinic-text-primary whitespace-pre-wrap ml-4" style={{ lineHeight: '1.7', fontSize: '0.9rem' }}>
                                    {subsection.content}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
              <div className="mt-4 text-sm text-clinic-text-secondary border-t pt-3">
                <div className="flex items-center mb-1">
                  <i className="fas fa-calendar-check mr-2 text-clinic-primary"></i>
                  <span className="font-semibold">진료일자:</span>
                  <span className="ml-2">{new Date(chart.chart_date).toLocaleDateString('ko-KR')}</span>
                </div>
                <div className="flex items-center">
                  <i className="fas fa-clock mr-2 text-gray-400"></i>
                  <span className="font-semibold">차트 생성일:</span>
                  <span className="ml-2">{new Date(chart.created_at).toLocaleString('ko-KR')}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <i className="fas fa-file-medical text-6xl text-gray-300 mb-4"></i>
              <p className="text-clinic-text-secondary mb-6 text-lg">초진차트가 없습니다</p>
              <button
                onClick={() => setIsEditing(true)}
                className="px-6 py-3 bg-clinic-primary text-white rounded-lg hover:bg-blue-900 transition-all transform hover:scale-105 font-semibold shadow-md"
              >
                <i className="fas fa-plus mr-2"></i>초진차트 작성
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
