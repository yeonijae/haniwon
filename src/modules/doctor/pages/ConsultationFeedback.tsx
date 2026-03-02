import React, { useState, useEffect, useMemo } from 'react';
import { format, startOfMonth, endOfMonth } from 'date-fns';

const API_URL = import.meta.env.VITE_POSTGRE_API_URL || 'http://192.168.0.48:3200';

interface TranscriptItem {
  id: number;
  patient_id: number;
  patient_name: string | null;
  chart_number: string | null;
  doctor_name: string | null;
  acting_type: string;
  transcript: string;
  duration_sec: number;
  created_at: string;
  recording_date: string;
}

interface ConsultationScore {
  trust_building: { score: number; comment: string };
  need_recognition: { score: number; comment: string };
  treatment_plan: { score: number; comment: string };
  value_delivery: { score: number; comment: string };
  patient_engagement: { score: number; comment: string };
  overall: number;
}

interface AnalysisResult {
  success: boolean;
  missing_items: Array<{ section: string; content: string; importance: string }>;
  consultation_score: ConsultationScore;
  strengths: string[];
  improvements: string[];
  suggested_phrases: string[];
  coaching: string;
}

interface FeedbackRecord {
  transcript_id: number;
  analysis: AnalysisResult;
  chart_notes: string;
  transcript_text: string;
  analyzed_at: string;
}

const SCORE_LABELS: Record<string, string> = {
  trust_building: '신뢰 구축',
  need_recognition: '치료 필요성',
  treatment_plan: '치료 계획',
  value_delivery: '가치 전달',
  patient_engagement: '환자 참여',
};

const ScoreBar: React.FC<{ score: number; label: string; comment: string }> = ({ score, label, comment }) => {
  const colors = ['', 'bg-red-400', 'bg-orange-400', 'bg-yellow-400', 'bg-blue-400', 'bg-green-500'];
  return (
    <div className="flex items-center gap-3 py-1">
      <span className="text-sm text-gray-600 w-24 shrink-0">{label}</span>
      <div className="flex gap-1 shrink-0">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className={`w-6 h-6 rounded ${i <= score ? colors[score] : 'bg-gray-200'} transition-colors`}
          />
        ))}
      </div>
      <span className="text-xs text-gray-500 truncate">{comment}</span>
    </div>
  );
};

const ConsultationFeedback: React.FC = () => {
  const [transcripts, setTranscripts] = useState<TranscriptItem[]>([]);
  const [selectedTranscript, setSelectedTranscript] = useState<TranscriptItem | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [chartNotes, setChartNotes] = useState('');
  const [feedbackHistory, setFeedbackHistory] = useState<FeedbackRecord[]>([]);

  // 날짜 필터
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [viewMode, setViewMode] = useState<'day' | 'month' | 'all'>('day');

  // 녹취 목록 로드
  const fetchTranscripts = async () => {
    setLoading(true);
    try {
      let dateFilter = '';
      if (viewMode === 'day') {
        dateFilter = `WHERE date(recording_date) = '${selectedDate}'`;
      } else if (viewMode === 'month') {
        const monthStart = format(startOfMonth(new Date(selectedDate)), 'yyyy-MM-dd');
        const monthEnd = format(endOfMonth(new Date(selectedDate)), 'yyyy-MM-dd');
        dateFilter = `WHERE date(recording_date) >= '${monthStart}' AND date(recording_date) <= '${monthEnd}'`;
      }

      const res = await fetch(`${API_URL}/api/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sql: `SELECT id, patient_id, patient_name, chart_number, doctor_name, acting_type,
                       transcript, duration_sec, created_at, recording_date
                FROM medical_transcripts
                ${dateFilter}
                ORDER BY recording_date DESC
                LIMIT 50`,
        }),
      });
      const data = await res.json();
      setTranscripts(data.rows || []);
    } catch (err) {
      console.error('녹취 목록 로드 실패:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTranscripts();
  }, [selectedDate, viewMode]);

  // 피드백 기록 로드
  const loadFeedbackHistory = async (transcriptId: number) => {
    try {
      const res = await fetch(`${API_URL}/api/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sql: `SELECT * FROM consultation_feedback WHERE transcript_id = ${transcriptId} ORDER BY analyzed_at DESC LIMIT 1`,
        }),
      });
      const data = await res.json();
      if (data.rows && data.rows.length > 0) {
        const row = data.rows[0];
        const parsed: AnalysisResult = typeof row.analysis_json === 'string' ? JSON.parse(row.analysis_json) : row.analysis_json;
        setAnalysis(parsed);
        setChartNotes(row.chart_notes || '');
      } else {
        setAnalysis(null);
        setChartNotes('');
      }
    } catch {
      // 테이블 없으면 무시
      setAnalysis(null);
    }
  };

  // 녹취 선택
  const selectTranscript = (t: TranscriptItem) => {
    setSelectedTranscript(t);
    setAnalysis(null);
    setChartNotes('');
    loadFeedbackHistory(t.id);
  };

  // 분석 실행
  const runAnalysis = async () => {
    if (!selectedTranscript) return;
    setIsAnalyzing(true);
    try {
      const res = await fetch(`${API_URL}/api/gpt/chart-analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chart_notes: chartNotes,
          transcript: selectedTranscript.transcript,
        }),
      });
      const data: AnalysisResult = await res.json();
      setAnalysis(data);

      // DB에 저장
      await fetch(`${API_URL}/api/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sql: `CREATE TABLE IF NOT EXISTS consultation_feedback (
            id SERIAL PRIMARY KEY,
            transcript_id INTEGER NOT NULL,
            chart_notes TEXT,
            analysis_json JSONB,
            overall_score INTEGER,
            analyzed_at TIMESTAMP DEFAULT NOW()
          )`,
        }),
      });

      await fetch(`${API_URL}/api/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sql: `INSERT INTO consultation_feedback (transcript_id, chart_notes, analysis_json, overall_score)
                VALUES (${selectedTranscript.id}, '${chartNotes.replace(/'/g, "''")}', '${JSON.stringify(data).replace(/'/g, "''")}', ${data.consultation_score?.overall || 0})`,
        }),
      });
    } catch (err) {
      console.error('분석 실패:', err);
      alert('분석 중 오류가 발생했습니다.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const formatDuration = (sec: number) => {
    if (!sec) return '-';
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m > 0 ? `${m}분 ${s}초` : `${s}초`;
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* 상단 필터 */}
      <div className="bg-white border-b px-4 py-3 flex items-center gap-4 shrink-0">
        <h1 className="text-lg font-bold text-gray-800">💬 상담 피드백</h1>
        <div className="flex items-center gap-2 ml-auto">
          <select
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value as any)}
            className="border rounded px-2 py-1 text-sm"
          >
            <option value="day">일별</option>
            <option value="month">월별</option>
            <option value="all">전체</option>
          </select>
          {viewMode !== 'all' && (
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="border rounded px-2 py-1 text-sm"
            />
          )}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* 좌측: 녹취 목록 */}
        <div className="w-80 border-r bg-white overflow-y-auto shrink-0">
          {loading ? (
            <div className="p-4 text-center text-gray-400">
              <i className="fas fa-spinner fa-spin mr-2"></i>로딩 중...
            </div>
          ) : transcripts.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <div className="text-4xl mb-2">🎙️</div>
              <div>녹취 기록이 없습니다</div>
            </div>
          ) : (
            transcripts.map((t) => (
              <div
                key={t.id}
                onClick={() => selectTranscript(t)}
                className={`p-3 border-b cursor-pointer hover:bg-gray-50 transition-colors ${
                  selectedTranscript?.id === t.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-sm text-gray-800">
                    {t.patient_name || `환자 #${t.patient_id}`}
                  </span>
                  <span className="text-xs text-gray-400">
                    {t.chart_number && `#${t.chart_number}`}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span>{t.doctor_name || '-'}</span>
                  <span>·</span>
                  <span>{t.acting_type}</span>
                  <span>·</span>
                  <span>{formatDuration(t.duration_sec)}</span>
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {t.recording_date ? format(new Date(t.recording_date), 'MM/dd HH:mm') : '-'}
                </div>
              </div>
            ))
          )}
        </div>

        {/* 우측: 분석 영역 */}
        <div className="flex-1 overflow-y-auto">
          {!selectedTranscript ? (
            <div className="h-full flex items-center justify-center text-gray-400">
              <div className="text-center">
                <div className="text-5xl mb-4">💬</div>
                <div className="text-lg">녹취를 선택하면 상담 피드백을 볼 수 있습니다</div>
              </div>
            </div>
          ) : (
            <div className="p-6 space-y-6">
              {/* 환자 정보 */}
              <div className="bg-white rounded-xl shadow-sm p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-gray-800">
                      {selectedTranscript.patient_name || `환자 #${selectedTranscript.patient_id}`}
                      {selectedTranscript.chart_number && (
                        <span className="ml-2 text-sm font-normal text-gray-400">#{selectedTranscript.chart_number}</span>
                      )}
                    </h2>
                    <div className="text-sm text-gray-500 mt-1">
                      {selectedTranscript.doctor_name} · {selectedTranscript.acting_type} · {formatDuration(selectedTranscript.duration_sec)}
                    </div>
                  </div>
                  <button
                    onClick={runAnalysis}
                    disabled={isAnalyzing}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 text-sm font-medium"
                  >
                    {isAnalyzing ? (
                      <><i className="fas fa-spinner fa-spin mr-2"></i>분석 중...</>
                    ) : analysis ? (
                      <><i className="fas fa-redo mr-2"></i>재분석</>
                    ) : (
                      <><i className="fas fa-brain mr-2"></i>피드백 분석</>
                    )}
                  </button>
                </div>
              </div>

              {/* 녹취 원문 + 차트 입력 */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white rounded-xl shadow-sm p-4">
                  <h3 className="text-sm font-bold text-gray-700 mb-2">
                    <i className="fas fa-microphone text-purple-500 mr-2"></i>녹취 원문
                  </h3>
                  <div className="text-sm text-gray-600 whitespace-pre-wrap max-h-60 overflow-y-auto leading-relaxed bg-gray-50 rounded-lg p-3">
                    {selectedTranscript.transcript || '(녹취 텍스트 없음)'}
                  </div>
                </div>
                <div className="bg-white rounded-xl shadow-sm p-4">
                  <h3 className="text-sm font-bold text-gray-700 mb-2">
                    <i className="fas fa-file-medical text-blue-500 mr-2"></i>차트 내용 (비교용)
                  </h3>
                  <textarea
                    value={chartNotes}
                    onChange={(e) => setChartNotes(e.target.value)}
                    placeholder="차트 내용을 붙여넣으면 누락 항목도 분석합니다 (선택사항)"
                    className="w-full h-52 text-sm border rounded-lg p-3 resize-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400"
                  />
                </div>
              </div>

              {/* 분석 결과 */}
              {analysis && analysis.success && (
                <>
                  {/* 종합 점수 */}
                  {analysis.consultation_score && (
                    <div className="bg-white rounded-xl shadow-sm p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-bold text-gray-700">
                          <i className="fas fa-chart-bar text-purple-500 mr-2"></i>상담 점수
                        </h3>
                        <div className="flex items-center gap-2">
                          <span className="text-3xl font-bold text-purple-600">
                            {analysis.consultation_score.overall}
                          </span>
                          <span className="text-sm text-gray-400">/ 5</span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        {Object.entries(SCORE_LABELS).map(([key, label]) => {
                          const item = (analysis.consultation_score as any)[key];
                          if (!item) return null;
                          return (
                            <ScoreBar
                              key={key}
                              score={item.score}
                              label={label}
                              comment={item.comment}
                            />
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* 잘한 점 & 개선점 */}
                  <div className="grid grid-cols-2 gap-4">
                    {analysis.strengths && analysis.strengths.length > 0 && (
                      <div className="bg-green-50 rounded-xl p-4">
                        <h3 className="text-sm font-bold text-green-700 mb-3">
                          <i className="fas fa-thumbs-up mr-2"></i>잘한 점
                        </h3>
                        <ul className="space-y-2">
                          {analysis.strengths.map((s, i) => (
                            <li key={i} className="text-sm text-green-800 flex gap-2">
                              <span className="text-green-500 shrink-0">✓</span>
                              {s}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {analysis.improvements && analysis.improvements.length > 0 && (
                      <div className="bg-amber-50 rounded-xl p-4">
                        <h3 className="text-sm font-bold text-amber-700 mb-3">
                          <i className="fas fa-lightbulb mr-2"></i>개선점
                        </h3>
                        <ul className="space-y-2">
                          {analysis.improvements.map((s, i) => (
                            <li key={i} className="text-sm text-amber-800 flex gap-2">
                              <span className="text-amber-500 shrink-0">→</span>
                              {s}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* 추천 멘트 */}
                  {analysis.suggested_phrases && analysis.suggested_phrases.length > 0 && (
                    <div className="bg-blue-50 rounded-xl p-4">
                      <h3 className="text-sm font-bold text-blue-700 mb-3">
                        <i className="fas fa-comment-dots mr-2"></i>추천 멘트
                      </h3>
                      <div className="space-y-2">
                        {analysis.suggested_phrases.map((p, i) => (
                          <div key={i} className="bg-white rounded-lg p-3 text-sm text-blue-800 border border-blue-200">
                            "{p}"
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 누락 항목 */}
                  {analysis.missing_items && analysis.missing_items.length > 0 && (
                    <div className="bg-white rounded-xl shadow-sm p-4">
                      <h3 className="text-sm font-bold text-gray-700 mb-3">
                        <i className="fas fa-exclamation-triangle text-red-500 mr-2"></i>차트 누락 항목
                      </h3>
                      <div className="space-y-2">
                        {analysis.missing_items.map((item, i) => (
                          <div key={i} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                            <span
                              className={`px-2 py-0.5 rounded text-xs font-bold shrink-0 ${
                                item.importance === 'high'
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-orange-100 text-orange-700'
                              }`}
                            >
                              {item.section}
                            </span>
                            <span className="text-sm text-gray-700">{item.content}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 종합 코칭 */}
                  {analysis.coaching && (
                    <div className="bg-purple-50 rounded-xl p-4">
                      <h3 className="text-sm font-bold text-purple-700 mb-2">
                        <i className="fas fa-user-md mr-2"></i>종합 코칭
                      </h3>
                      <p className="text-sm text-purple-800 leading-relaxed">{analysis.coaching}</p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConsultationFeedback;
