/**
 * AI 분석 컴포넌트
 * - 검사 이미지 AI 분석 요청
 * - 분석 결과 표시
 * - 소견 자동 채우기
 */

import { useState, useEffect } from 'react';
import type { ExamResult, ExamType } from '../types';
import { getExamTypeInfo } from '../types';
import { analyzeExamImage, checkAIStatus, EXAM_ANALYSIS_HINTS } from '../services/aiService';
import { getFileUrl, isImageFile } from '../lib/fileUpload';

interface ExamAIAnalysisProps {
  exam: ExamResult;
  onApplyFindings?: (findings: string) => void;
}

const ExamAIAnalysis: React.FC<ExamAIAnalysisProps> = ({ exam, onApplyFindings }) => {
  const [isAvailable, setIsAvailable] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [model, setModel] = useState<string>('');

  const typeInfo = getExamTypeInfo(exam.exam_type);
  const images = exam.attachments?.filter(a => isImageFile(a.file_name)) || [];
  const firstImage = images[0];

  // AI 상태 확인
  useEffect(() => {
    checkAIStatus().then(status => {
      setIsAvailable(status.available);
      setModel(status.model);
    });
  }, []);

  // AI 분석 요청
  const handleAnalyze = async () => {
    if (!firstImage) {
      setError('분석할 이미지가 없습니다.');
      return;
    }

    setIsAnalyzing(true);
    setError('');
    setAnalysis('');

    try {
      const imageUrl = `/api/files/${firstImage.file_path}`;
      const result = await analyzeExamImage(
        exam.exam_type,
        imageUrl,
        exam.values,
        undefined // 이전 소견은 선택적
      );

      if (result.success) {
        setAnalysis(result.analysis);
        setModel(result.model);
      } else {
        setError(result.error || 'AI 분석에 실패했습니다.');
      }
    } catch (err: any) {
      setError(err.message || 'AI 분석 중 오류가 발생했습니다.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 소견에 적용
  const handleApply = () => {
    if (analysis && onApplyFindings) {
      onApplyFindings(analysis);
    }
  };

  if (!isAvailable) {
    return (
      <div className="bg-gray-50 rounded-lg p-4 text-center">
        <i className="fas fa-robot text-gray-400 text-2xl mb-2"></i>
        <p className="text-sm text-gray-500">AI 분석 서비스를 사용할 수 없습니다.</p>
        <p className="text-xs text-gray-400 mt-1">GEMINI_API_KEY 설정을 확인하세요.</p>
      </div>
    );
  }

  return (
    <div className="bg-purple-50 rounded-lg p-4 space-y-3">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <i className="fas fa-robot text-purple-600"></i>
          <span className="text-sm font-medium text-purple-700">AI 분석</span>
        </div>
        {model && (
          <span className="text-xs text-purple-500">{model}</span>
        )}
      </div>

      {/* 분석 힌트 */}
      <p className="text-xs text-purple-600">
        {EXAM_ANALYSIS_HINTS[exam.exam_type] || '검사 이미지를 분석합니다.'}
      </p>

      {/* 분석 버튼 */}
      {!analysis && !isAnalyzing && (
        <button
          onClick={handleAnalyze}
          disabled={!firstImage}
          className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
        >
          <i className="fas fa-magic"></i>
          AI로 분석하기
        </button>
      )}

      {/* 분석 중 */}
      {isAnalyzing && (
        <div className="text-center py-4">
          <i className="fas fa-spinner fa-spin text-2xl text-purple-600 mb-2"></i>
          <p className="text-sm text-purple-700">AI가 분석 중입니다...</p>
          <p className="text-xs text-purple-500 mt-1">잠시만 기다려주세요.</p>
        </div>
      )}

      {/* 오류 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="flex items-center gap-2 text-red-700">
            <i className="fas fa-exclamation-circle"></i>
            <span className="text-sm">{error}</span>
          </div>
          <button
            onClick={handleAnalyze}
            className="mt-2 text-sm text-red-600 hover:underline"
          >
            다시 시도
          </button>
        </div>
      )}

      {/* 분석 결과 */}
      {analysis && (
        <div className="space-y-3">
          <div className="bg-white rounded-lg p-3 border border-purple-200">
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{analysis}</p>
          </div>

          <div className="flex gap-2">
            {onApplyFindings && (
              <button
                onClick={handleApply}
                className="flex-1 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm flex items-center justify-center gap-2"
              >
                <i className="fas fa-check"></i>
                소견에 적용
              </button>
            )}
            <button
              onClick={handleAnalyze}
              className="px-3 py-2 border border-purple-300 text-purple-700 rounded-lg hover:bg-purple-100 text-sm"
            >
              <i className="fas fa-redo"></i>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExamAIAnalysis;
