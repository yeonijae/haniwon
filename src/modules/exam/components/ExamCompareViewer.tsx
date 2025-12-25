/**
 * 검사결과 비교 뷰어
 * - 같은 유형의 검사를 좌우로 비교
 * - 독립적인 줌, 패닝, 회전
 * - 미니맵으로 현재 위치 표시
 * - 썸네일 스트립으로 파일 선택
 */

import { useState, useCallback, useRef, useEffect } from 'react';
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
  rotation: number;  // 0, 90, 180, 270
  imageIndex: number;
}

interface DragState {
  isDragging: boolean;
  startX: number;
  startY: number;
  startPosX: number;
  startPosY: number;
}

interface ImageDimensions {
  naturalWidth: number;
  naturalHeight: number;
  displayWidth: number;
  displayHeight: number;
}

const MINIMAP_SIZE = 100;

const ExamCompareViewer: React.FC<ExamCompareViewerProps> = ({
  exams,
  initialLeftIndex = 0,
  initialRightIndex = 1,
  onClose,
}) => {
  const [leftState, setLeftState] = useState<ViewState>({
    scale: 1,
    position: { x: 0, y: 0 },
    rotation: 0,
    imageIndex: 0,
  });

  const [rightState, setRightState] = useState<ViewState>({
    scale: 1,
    position: { x: 0, y: 0 },
    rotation: 0,
    imageIndex: 0,
  });

  const [leftDrag, setLeftDrag] = useState<DragState>({
    isDragging: false,
    startX: 0,
    startY: 0,
    startPosX: 0,
    startPosY: 0,
  });

  const [rightDrag, setRightDrag] = useState<DragState>({
    isDragging: false,
    startX: 0,
    startY: 0,
    startPosX: 0,
    startPosY: 0,
  });

  const [leftDimensions, setLeftDimensions] = useState<ImageDimensions | null>(null);
  const [rightDimensions, setRightDimensions] = useState<ImageDimensions | null>(null);

  const leftContainerRef = useRef<HTMLDivElement>(null);
  const rightContainerRef = useRef<HTMLDivElement>(null);
  const leftImageRef = useRef<HTMLImageElement>(null);
  const rightImageRef = useRef<HTMLImageElement>(null);

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

  // 이미지 로드 시 dimensions 계산
  const handleImageLoad = useCallback((
    side: 'left' | 'right',
    img: HTMLImageElement,
    container: HTMLDivElement
  ) => {
    const containerRect = container.getBoundingClientRect();
    const naturalWidth = img.naturalWidth;
    const naturalHeight = img.naturalHeight;

    // Fit to container 계산
    const scaleX = containerRect.width / naturalWidth;
    const scaleY = containerRect.height / naturalHeight;
    const fitScale = Math.min(scaleX, scaleY, 1);

    const displayWidth = naturalWidth * fitScale;
    const displayHeight = naturalHeight * fitScale;

    const dimensions: ImageDimensions = {
      naturalWidth,
      naturalHeight,
      displayWidth,
      displayHeight,
    };

    if (side === 'left') {
      setLeftDimensions(dimensions);
    } else {
      setRightDimensions(dimensions);
    }
  }, []);

  // 줌 컨트롤
  const handleZoom = useCallback((
    side: 'left' | 'right',
    delta: number,
    setState: React.Dispatch<React.SetStateAction<ViewState>>
  ) => {
    setState(state => ({
      ...state,
      scale: Math.max(0.5, Math.min(5, state.scale + delta)),
    }));
  }, []);

  // 마우스 휠 줌
  const handleWheel = useCallback((
    e: React.WheelEvent,
    setState: React.Dispatch<React.SetStateAction<ViewState>>
  ) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setState(state => ({
      ...state,
      scale: Math.max(0.5, Math.min(5, state.scale + delta)),
    }));
  }, []);

  // Fit to Window
  const handleFit = useCallback((
    setState: React.Dispatch<React.SetStateAction<ViewState>>
  ) => {
    setState(state => ({
      ...state,
      scale: 1,
      position: { x: 0, y: 0 },
    }));
  }, []);

  // 회전
  const handleRotate = useCallback((
    setState: React.Dispatch<React.SetStateAction<ViewState>>
  ) => {
    setState(state => ({
      ...state,
      rotation: (state.rotation + 90) % 360,
    }));
  }, []);

  // 드래그 시작
  const handleMouseDown = useCallback((
    e: React.MouseEvent,
    state: ViewState,
    setDrag: React.Dispatch<React.SetStateAction<DragState>>
  ) => {
    if (state.scale <= 1) return;
    e.preventDefault();
    setDrag({
      isDragging: true,
      startX: e.clientX,
      startY: e.clientY,
      startPosX: state.position.x,
      startPosY: state.position.y,
    });
  }, []);

  // 드래그 중
  const handleMouseMove = useCallback((
    e: React.MouseEvent,
    drag: DragState,
    setState: React.Dispatch<React.SetStateAction<ViewState>>
  ) => {
    if (!drag.isDragging) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    setState(state => ({
      ...state,
      position: {
        x: drag.startPosX + dx,
        y: drag.startPosY + dy,
      },
    }));
  }, []);

  // 드래그 끝
  const handleMouseUp = useCallback((
    setDrag: React.Dispatch<React.SetStateAction<DragState>>
  ) => {
    setDrag(drag => ({ ...drag, isDragging: false }));
  }, []);

  // 미니맵 클릭
  const handleMinimapClick = useCallback((
    e: React.MouseEvent<HTMLDivElement>,
    dimensions: ImageDimensions,
    state: ViewState,
    setState: React.Dispatch<React.SetStateAction<ViewState>>,
    containerRef: React.RefObject<HTMLDivElement>
  ) => {
    if (!containerRef.current || state.scale <= 1) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const containerRect = containerRef.current.getBoundingClientRect();
    const scaledWidth = dimensions.displayWidth * state.scale;
    const scaledHeight = dimensions.displayHeight * state.scale;

    // 미니맵에서의 비율을 실제 좌표로 변환
    const ratioX = clickX / MINIMAP_SIZE;
    const ratioY = clickY / MINIMAP_SIZE;

    // 클릭 위치를 중앙에 오도록 position 계산
    const viewportCenterX = containerRect.width / 2;
    const viewportCenterY = containerRect.height / 2;

    const targetX = ratioX * scaledWidth;
    const targetY = ratioY * scaledHeight;

    const newPosX = viewportCenterX - targetX;
    const newPosY = viewportCenterY - targetY;

    setState(s => ({
      ...s,
      position: { x: newPosX, y: newPosY },
    }));
  }, []);

  // 이미지 인덱스 변경
  const handleImageChange = useCallback((
    delta: number,
    images: ExamAttachment[],
    state: ViewState,
    setState: React.Dispatch<React.SetStateAction<ViewState>>
  ) => {
    const newIndex = state.imageIndex + delta;
    if (newIndex >= 0 && newIndex < images.length) {
      setState(s => ({
        ...s,
        imageIndex: newIndex,
        scale: 1,
        position: { x: 0, y: 0 },
        rotation: 0,
      }));
    }
  }, []);

  // 전체 리셋
  const handleReset = useCallback(() => {
    const resetState: ViewState = {
      scale: 1,
      position: { x: 0, y: 0 },
      rotation: 0,
      imageIndex: 0,
    };
    setLeftState(resetState);
    setRightState(resetState);
  }, []);

  // 미니맵 렌더링
  const renderMinimap = (
    dimensions: ImageDimensions | null,
    state: ViewState,
    setState: React.Dispatch<React.SetStateAction<ViewState>>,
    containerRef: React.RefObject<HTMLDivElement>,
    currentImage: ExamAttachment | undefined
  ) => {
    if (!dimensions || state.scale <= 1 || !currentImage) return null;

    const containerRect = containerRef.current?.getBoundingClientRect();
    if (!containerRect) return null;

    const scaledWidth = dimensions.displayWidth * state.scale;
    const scaledHeight = dimensions.displayHeight * state.scale;

    // 뷰포트 크기 비율
    const viewportWidthRatio = containerRect.width / scaledWidth;
    const viewportHeightRatio = containerRect.height / scaledHeight;

    // 뷰포트 위치 비율 (position은 이미지가 이동한 거리)
    const centerX = (containerRect.width / 2 - state.position.x) / scaledWidth;
    const centerY = (containerRect.height / 2 - state.position.y) / scaledHeight;

    const viewportX = (centerX - viewportWidthRatio / 2) * MINIMAP_SIZE;
    const viewportY = (centerY - viewportHeightRatio / 2) * MINIMAP_SIZE;
    const viewportWidth = viewportWidthRatio * MINIMAP_SIZE;
    const viewportHeight = viewportHeightRatio * MINIMAP_SIZE;

    return (
      <div
        className="absolute bottom-16 right-2 bg-black/70 rounded overflow-hidden cursor-pointer"
        style={{ width: MINIMAP_SIZE, height: MINIMAP_SIZE }}
        onClick={(e) => handleMinimapClick(e, dimensions, state, setState, containerRef)}
      >
        <img
          src={getThumbnailUrl(currentImage.thumbnail_path) || getFileUrl(currentImage.file_path)}
          alt=""
          className="w-full h-full object-contain"
          style={{
            transform: `rotate(${state.rotation}deg)`,
          }}
        />
        <div
          className="absolute border-2 border-purple-500 bg-purple-500/20"
          style={{
            left: Math.max(0, Math.min(MINIMAP_SIZE - viewportWidth, viewportX)),
            top: Math.max(0, Math.min(MINIMAP_SIZE - viewportHeight, viewportY)),
            width: Math.min(viewportWidth, MINIMAP_SIZE),
            height: Math.min(viewportHeight, MINIMAP_SIZE),
          }}
        />
      </div>
    );
  };

  // 이미지 패널 렌더링
  const renderImagePanel = (
    side: 'left' | 'right',
    exam: ExamResult,
    images: ExamAttachment[],
    state: ViewState,
    setState: React.Dispatch<React.SetStateAction<ViewState>>,
    drag: DragState,
    setDrag: React.Dispatch<React.SetStateAction<DragState>>,
    dimensions: ImageDimensions | null,
    setDimensions: React.Dispatch<React.SetStateAction<ImageDimensions | null>>,
    containerRef: React.RefObject<HTMLDivElement>,
    imageRef: React.RefObject<HTMLImageElement>,
    examIndex: number,
    setExamIndex: React.Dispatch<React.SetStateAction<number>>
  ) => {
    const currentImage = images[state.imageIndex];
    const hasMultipleImages = images.length > 1;

    return (
      <div className="flex-1 flex flex-col border-r border-gray-700 last:border-r-0">
        {/* 날짜 선택 헤더 */}
        <div className="bg-gray-800 px-3 py-2 flex items-center justify-between">
          <select
            value={examIndex}
            onChange={(e) => {
              setExamIndex(Number(e.target.value));
              setState(s => ({ ...s, imageIndex: 0, scale: 1, position: { x: 0, y: 0 }, rotation: 0 }));
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
            {/* 회전 버튼 */}
            <button
              onClick={() => handleRotate(setState)}
              className="p-1.5 text-gray-400 hover:text-white rounded hover:bg-gray-700"
              title="90° 회전"
            >
              <i className="fas fa-redo text-xs"></i>
            </button>
            <div className="w-px h-4 bg-gray-600 mx-1"></div>
            {/* 줌 컨트롤 */}
            <button
              onClick={() => handleZoom(side, -0.25, setState)}
              className="p-1.5 text-gray-400 hover:text-white rounded hover:bg-gray-700"
              title="축소"
            >
              <i className="fas fa-minus text-xs"></i>
            </button>
            <button
              onClick={() => handleFit(setState)}
              className="px-2 py-1 text-gray-300 text-xs hover:bg-gray-700 rounded min-w-[48px]"
              title="창에 맞춤"
            >
              {Math.round(state.scale * 100)}%
            </button>
            <button
              onClick={() => handleZoom(side, 0.25, setState)}
              className="p-1.5 text-gray-400 hover:text-white rounded hover:bg-gray-700"
              title="확대"
            >
              <i className="fas fa-plus text-xs"></i>
            </button>
          </div>
        </div>

        {/* 이미지 영역 */}
        <div
          ref={containerRef}
          className={`flex-1 bg-gray-900 flex items-center justify-center overflow-hidden relative ${
            state.scale > 1 ? 'cursor-grab' : ''
          } ${drag.isDragging ? 'cursor-grabbing' : ''}`}
          onMouseDown={(e) => handleMouseDown(e, state, setDrag)}
          onMouseMove={(e) => handleMouseMove(e, drag, setState)}
          onMouseUp={() => handleMouseUp(setDrag)}
          onMouseLeave={() => handleMouseUp(setDrag)}
          onWheel={(e) => handleWheel(e, setState)}
        >
          {currentImage ? (
            <>
              <img
                ref={imageRef}
                src={getFileUrl(currentImage.file_path)}
                alt=""
                className="max-w-full max-h-full object-contain select-none"
                style={{
                  transform: `translate(${state.position.x}px, ${state.position.y}px) scale(${state.scale}) rotate(${state.rotation}deg)`,
                  transition: drag.isDragging ? 'none' : 'transform 0.1s ease-out',
                }}
                draggable={false}
                onLoad={(e) => {
                  if (containerRef.current) {
                    handleImageLoad(side, e.currentTarget, containerRef.current);
                  }
                }}
              />

              {/* 미니맵 */}
              {renderMinimap(dimensions, state, setState, containerRef, currentImage)}

              {/* 회전 표시 */}
              {state.rotation !== 0 && (
                <div className="absolute top-2 left-2 bg-black/60 px-2 py-1 rounded text-white text-xs">
                  {state.rotation}°
                </div>
              )}

              {/* 이전/다음 버튼 (여러 이미지인 경우) */}
              {hasMultipleImages && (
                <>
                  <button
                    onClick={() => handleImageChange(-1, images, state, setState)}
                    disabled={state.imageIndex === 0}
                    className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 disabled:opacity-30 disabled:cursor-not-allowed z-10"
                  >
                    <i className="fas fa-chevron-left"></i>
                  </button>
                  <button
                    onClick={() => handleImageChange(1, images, state, setState)}
                    disabled={state.imageIndex === images.length - 1}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 disabled:opacity-30 disabled:cursor-not-allowed z-10"
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
                  onClick={() => setState(s => ({
                    ...s,
                    imageIndex: idx,
                    scale: 1,
                    position: { x: 0, y: 0 },
                    rotation: 0,
                  }))}
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
          leftDrag,
          setLeftDrag,
          leftDimensions,
          setLeftDimensions,
          leftContainerRef,
          leftImageRef,
          leftExamIndex,
          setLeftExamIndex
        )}
        {renderImagePanel(
          'right',
          rightExam,
          rightImages,
          rightState,
          setRightState,
          rightDrag,
          setRightDrag,
          rightDimensions,
          setRightDimensions,
          rightContainerRef,
          rightImageRef,
          rightExamIndex,
          setRightExamIndex
        )}
      </div>

      {/* 하단 도움말 */}
      <div className="bg-gray-900 border-t border-gray-700 px-4 py-1.5 text-center text-gray-500 text-xs">
        마우스 휠: 줌 | 드래그: 이동 | 각 패널 독립적으로 줌/회전 조절 가능
      </div>
    </div>
  );
};

export default ExamCompareViewer;
