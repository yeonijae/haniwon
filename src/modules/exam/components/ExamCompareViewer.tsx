/**
 * 검사결과 비교 뷰어
 * - 같은 유형의 검사를 좌우로 비교
 * - 날짜 선택으로 비교 대상 변경
 * - 썸네일 스트립으로 파일 선택
 * - 동기화 줌/이동 옵션
 */

import { useState, useCallback } from 'react';
import type { ExamResult, ExamAttachment } from '../types';
import { getExamTypeInfo, getExamTypeStyles } from '../types';
import { getFileUrl, getThumbnailUrl, isImageFile } from '../lib/fileUpload';

interface ExamCompareViewerProps {
  exams: ExamResult[];  // 같은 유형의 검사 목록 (날짜순 정렬)
  initialLeftIndex?: number;
  initialRightIndex?: number;
  onClose: () => void;
}

interface ViewState {
  scale: number;
  position: { x: number; y: number };
  imageIndex: number;
}

const ExamCompareViewer: React.FC<ExamCompareViewerProps> = ({
  exams,
  initialLeftIndex = 0,
  initialRightIndex = 1,
  onClose,
}) => {
  const [syncMode, setSyncMode] = useState(true);

  const [leftState, setLeftState] = useState<ViewState>({
    scale: 1,
    position: { x: 0, y: 0 },
    imageIndex: 0,
  });

  const [rightState, setRightState] = useState<ViewState>({
    scale: 1,
    position: { x: 0, y: 0 },
    imageIndex: 0,
  });

  const [leftExamIndex, setLeftExamIndex] = useState(
    Math.min(initialLeftIndex, exams.length - 1)
  );
  const [rightExamIndex, setRightExamIndex] = useState(
    Math.min(initialRightIndex, exams.length - 1)
  );

  const leftExam = exams[leftExamIndex];
  const rightExam = exams[rightExamIndex];

  const leftImages = leftExam?.attachments?.filter(a => isImageFile(a.file_name)) || [];
  const rightImages = rightExam?.attachments?.filter(a => isImageFile(a.file_name)) || [];

  const typeInfo = getExamTypeInfo(exams[0]?.exam_type);
  const typeStyles = getExamTypeStyles(exams[0]?.exam_type);

  // 줌 컨트롤
  const handleZoom = useCallback((side: 'left' | 'right', delta: number) => {
    const updateState = (state: ViewState): ViewState => ({
      ...state,
      scale: Math.max(0.5, Math.min(3, state.scale + delta)),
    });

    if (syncMode) {
      setLeftState(updateState);
      setRightState(updateState);
    } else if (side === 'left') {
      setLeftState(updateState);
    } else {
      setRightState(updateState);
    }
  }, [syncMode]);

  // Fit to Window
  const handleFit = useCallback((side: 'left' | 'right') => {
    const resetState = (state: ViewState): ViewState => ({
      ...state,
      scale: 1,
      position: { x: 0, y: 0 },
    });

    if (syncMode) {
      setLeftState(resetState);
      setRightState(resetState);
    } else if (side === 'left') {
      setLeftState(resetState);
    } else {
      setRightState(resetState);
    }
  }, [syncMode]);

  // 이미지 인덱스 변경
  const handleImageChange = useCallback((
    side: 'left' | 'right',
    delta: number,
    images: ExamAttachment[],
    state: ViewState,
    setState: React.Dispatch<React.SetStateAction<ViewState>>
  ) => {
    const newIndex = state.imageIndex + delta;
    if (newIndex >= 0 && newIndex < images.length) {
      setState(s => ({ ...s, imageIndex: newIndex }));
    }
  }, []);

  // 전체 리셋
  const handleReset = useCallback(() => {
    const resetState: ViewState = {
      scale: 1,
      position: { x: 0, y: 0 },
      imageIndex: 0,
    };
    setLeftState(resetState);
    setRightState(resetState);
  }, []);

  // 이미지 패널 렌더링
  const renderImagePanel = (
    side: 'left' | 'right',
    exam: ExamResult,
    images: ExamAttachment[],
    state: ViewState,
    setState: React.Dispatch<React.SetStateAction<ViewState>>,
    examIndex: number,
    setExamIndex: React.Dispatch<React.SetStateAction<number>>
  ) => {
    const currentImage = images[state.imageIndex];
    const hasMultipleImages = images.length > 1;

    return (
      <div className="flex-1 flex flex-col border-r border-gray-700 last:border-r-0">
        {/* 날짜 선택 헤더 */}
        <div className="bg-gray-800 px-4 py-2 flex items-center justify-between">
          <select
            value={examIndex}
            onChange={(e) => {
              setExamIndex(Number(e.target.value));
              setState(s => ({ ...s, imageIndex: 0 }));
            }}
            className="bg-gray-700 text-white text-sm rounded px-2 py-1.5 border-none focus:ring-2 focus:ring-purple-500"
          >
            {exams.map((ex, idx) => (
              <option key={ex.id} value={idx}>
                {ex.exam_date} ({ex.attachments?.filter(a => isImageFile(a.file_name)).length || 0}장)
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1">
            <button
              onClick={() => handleZoom(side, -0.25)}
              className="p-1.5 text-gray-400 hover:text-white rounded hover:bg-gray-700"
              title="축소"
            >
              <i className="fas fa-minus text-xs"></i>
            </button>
            <button
              onClick={() => handleFit(side)}
              className="px-2 py-1 text-gray-300 text-xs hover:bg-gray-700 rounded"
              title="창에 맞춤"
            >
              {Math.round(state.scale * 100)}%
            </button>
            <button
              onClick={() => handleZoom(side, 0.25)}
              className="p-1.5 text-gray-400 hover:text-white rounded hover:bg-gray-700"
              title="확대"
            >
              <i className="fas fa-plus text-xs"></i>
            </button>
          </div>
        </div>

        {/* 이미지 영역 */}
        <div className="flex-1 bg-gray-900 flex items-center justify-center overflow-hidden relative">
          {currentImage ? (
            <>
              <img
                src={getFileUrl(currentImage.file_path)}
                alt=""
                className="max-w-full max-h-full object-contain transition-transform"
                style={{
                  transform: `translate(${state.position.x}px, ${state.position.y}px) scale(${state.scale})`,
                }}
                draggable={false}
              />

              {/* 이전/다음 버튼 (여러 이미지인 경우) */}
              {hasMultipleImages && (
                <>
                  <button
                    onClick={() => handleImageChange(side, -1, images, state, setState)}
                    disabled={state.imageIndex === 0}
                    className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <i className="fas fa-chevron-left"></i>
                  </button>
                  <button
                    onClick={() => handleImageChange(side, 1, images, state, setState)}
                    disabled={state.imageIndex === images.length - 1}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <i className="fas fa-chevron-right"></i>
                  </button>

                  {/* 이미지 인덱스 표시 */}
                  <div className="absolute top-2 right-2 bg-black/60 px-2 py-1 rounded text-white text-xs">
                    {state.imageIndex + 1} / {images.length}
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="text-gray-500 text-center">
              <i className="fas fa-image text-4xl mb-2"></i>
              <p>이미지 없음</p>
            </div>
          )}
        </div>

        {/* 썸네일 스트립 */}
        {hasMultipleImages && (
          <div className="bg-gray-800 px-2 py-2">
            <div className="flex gap-1.5 overflow-x-auto py-1">
              {images.map((img, idx) => (
                <button
                  key={img.id}
                  onClick={() => setState(s => ({ ...s, imageIndex: idx }))}
                  className={`flex-shrink-0 w-12 h-12 rounded overflow-hidden transition-all ${
                    idx === state.imageIndex
                      ? 'ring-2 ring-purple-500 ring-offset-1 ring-offset-gray-800'
                      : 'ring-1 ring-gray-600 hover:ring-gray-400 opacity-60 hover:opacity-100'
                  }`}
                >
                  <img
                    src={getThumbnailUrl(img.thumbnail_path) || getFileUrl(img.file_path)}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 캡션 또는 소견 */}
        <div className="bg-gray-800 px-4 py-2 border-t border-gray-700 min-h-[48px]">
          {currentImage?.caption ? (
            <p className="text-sm text-gray-300">{currentImage.caption}</p>
          ) : exam.findings ? (
            <p className="text-xs text-gray-400 line-clamp-2">{exam.findings}</p>
          ) : (
            <p className="text-xs text-gray-500 italic">설명 없음</p>
          )}
        </div>
      </div>
    );
  };

  if (exams.length < 2) {
    return (
      <div className="fixed inset-0 bg-black z-[60] flex items-center justify-center">
        <div className="text-center text-white">
          <i className="fas fa-exclamation-circle text-4xl mb-4 text-yellow-500"></i>
          <p className="text-lg mb-4">비교할 검사가 2개 이상 필요합니다.</p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-purple-600 rounded-lg hover:bg-purple-700"
          >
            닫기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black z-[60] flex flex-col">
      {/* 상단 툴바 */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center px-2 py-1 rounded text-sm ${typeStyles.badge}`}>
            <i className={`fas ${typeInfo?.icon || 'fa-file'} mr-2`}></i>
            {typeInfo?.name || '검사'} 비교
          </span>
          <span className="text-gray-400 text-sm">
            {leftExam.exam_date} vs {rightExam.exam_date}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* 동기화 토글 */}
          <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={syncMode}
              onChange={(e) => setSyncMode(e.target.checked)}
              className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-purple-600 focus:ring-purple-500"
            />
            동기화
          </label>

          <button
            onClick={handleReset}
            className="px-3 py-1.5 text-sm text-gray-400 hover:text-white bg-gray-800 rounded"
          >
            <i className="fas fa-sync-alt mr-1"></i>
            초기화
          </button>

          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white"
          >
            <i className="fas fa-times text-xl"></i>
          </button>
        </div>
      </div>

      {/* 비교 영역 */}
      <div className="flex-1 flex">
        {renderImagePanel(
          'left',
          leftExam,
          leftImages,
          leftState,
          setLeftState,
          leftExamIndex,
          setLeftExamIndex
        )}
        {renderImagePanel(
          'right',
          rightExam,
          rightImages,
          rightState,
          setRightState,
          rightExamIndex,
          setRightExamIndex
        )}
      </div>

      {/* 하단 도움말 */}
      <div className="bg-gray-900 border-t border-gray-700 px-4 py-1.5 text-center text-gray-500 text-xs">
        좌우 패널에서 날짜와 이미지를 선택하여 비교 | 동기화 모드에서 줌 동시 조절
      </div>
    </div>
  );
};

export default ExamCompareViewer;
