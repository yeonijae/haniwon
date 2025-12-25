/**
 * 검사결과 비교 뷰어 (멀티 패널 그리드)
 * - 같은 유형의 검사를 여러 패널로 비교
 * - 2~6개 패널 동적 그리드 레이아웃
 * - 각 패널 독립적인 줌, 패닝, 회전
 * - 미니맵으로 현재 위치 표시
 */

import { useState, useCallback, useRef } from 'react';
import type { ExamResult, ExamAttachment } from '../types';
import { getExamTypeInfo, getExamTypeStyles } from '../types';
import { getFileUrl, getThumbnailUrl, isImageFile } from '../lib/fileUpload';

interface ExamCompareViewerProps {
  exams: ExamResult[];  // 같은 유형의 검사 목록 (날짜순 정렬)
  initialLeftIndex?: number;
  initialRightIndex?: number;
  onClose: () => void;
}

interface PanelState {
  id: string;
  examIndex: number;
  imageIndex: number;
  scale: number;
  position: { x: number; y: number };
  rotation: number;
}

interface DragState {
  panelId: string | null;
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

const MINIMAP_SIZE = 80;
const MAX_PANELS = 6;
const MIN_PANELS = 2;

// 고유 ID 생성
const generateId = () => Math.random().toString(36).substr(2, 9);

const ExamCompareViewer: React.FC<ExamCompareViewerProps> = ({
  exams,
  initialLeftIndex = 0,
  initialRightIndex = 1,
  onClose,
}) => {
  // 패널 배열 상태
  const [panels, setPanels] = useState<PanelState[]>([
    {
      id: generateId(),
      examIndex: Math.min(initialLeftIndex, exams.length - 1),
      imageIndex: 0,
      scale: 1,
      position: { x: 0, y: 0 },
      rotation: 0,
    },
    {
      id: generateId(),
      examIndex: Math.min(initialRightIndex, exams.length - 1),
      imageIndex: 0,
      scale: 1,
      position: { x: 0, y: 0 },
      rotation: 0,
    },
  ]);

  const [dragState, setDragState] = useState<DragState>({
    panelId: null,
    isDragging: false,
    startX: 0,
    startY: 0,
    startPosX: 0,
    startPosY: 0,
  });

  const [dimensions, setDimensions] = useState<Record<string, ImageDimensions>>({});
  const containerRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const typeInfo = getExamTypeInfo(exams[0]?.exam_type);
  const typeStyles = getExamTypeStyles(exams[0]?.exam_type);

  // 그리드 열 수 계산
  const getGridCols = (panelCount: number) => {
    if (panelCount <= 3) return panelCount;
    if (panelCount <= 4) return 2;
    return 3;
  };

  // 패널 상태 업데이트
  const updatePanel = useCallback((panelId: string, updates: Partial<PanelState>) => {
    setPanels(prev => prev.map(p =>
      p.id === panelId ? { ...p, ...updates } : p
    ));
  }, []);

  // 패널 추가
  const addPanel = useCallback(() => {
    if (panels.length >= MAX_PANELS) return;

    // 아직 선택되지 않은 exam 찾기
    const usedIndices = new Set(panels.map(p => p.examIndex));
    let newExamIndex = 0;
    for (let i = 0; i < exams.length; i++) {
      if (!usedIndices.has(i)) {
        newExamIndex = i;
        break;
      }
    }

    setPanels(prev => [...prev, {
      id: generateId(),
      examIndex: newExamIndex,
      imageIndex: 0,
      scale: 1,
      position: { x: 0, y: 0 },
      rotation: 0,
    }]);
  }, [panels.length, exams.length]);

  // 패널 삭제
  const removePanel = useCallback((panelId: string) => {
    if (panels.length <= MIN_PANELS) return;
    setPanels(prev => prev.filter(p => p.id !== panelId));
  }, [panels.length]);

  // 이미지 로드 시 dimensions 계산
  const handleImageLoad = useCallback((
    panelId: string,
    img: HTMLImageElement,
    container: HTMLDivElement
  ) => {
    const containerRect = container.getBoundingClientRect();
    const naturalWidth = img.naturalWidth;
    const naturalHeight = img.naturalHeight;

    const scaleX = containerRect.width / naturalWidth;
    const scaleY = containerRect.height / naturalHeight;
    const fitScale = Math.min(scaleX, scaleY, 1);

    setDimensions(prev => ({
      ...prev,
      [panelId]: {
        naturalWidth,
        naturalHeight,
        displayWidth: naturalWidth * fitScale,
        displayHeight: naturalHeight * fitScale,
      },
    }));
  }, []);

  // 줌 컨트롤
  const handleZoom = useCallback((panelId: string, delta: number) => {
    setPanels(prev => prev.map(p =>
      p.id === panelId
        ? { ...p, scale: Math.max(0.5, Math.min(5, p.scale + delta)) }
        : p
    ));
  }, []);

  // 마우스 휠 줌
  const handleWheel = useCallback((e: React.WheelEvent, panelId: string) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    handleZoom(panelId, delta);
  }, [handleZoom]);

  // Fit to Window
  const handleFit = useCallback((panelId: string) => {
    updatePanel(panelId, { scale: 1, position: { x: 0, y: 0 } });
  }, [updatePanel]);

  // 회전
  const handleRotate = useCallback((panelId: string) => {
    setPanels(prev => prev.map(p =>
      p.id === panelId
        ? { ...p, rotation: (p.rotation + 90) % 360 }
        : p
    ));
  }, []);

  // 드래그 시작
  const handleMouseDown = useCallback((e: React.MouseEvent, panel: PanelState) => {
    if (panel.scale <= 1) return;
    e.preventDefault();
    setDragState({
      panelId: panel.id,
      isDragging: true,
      startX: e.clientX,
      startY: e.clientY,
      startPosX: panel.position.x,
      startPosY: panel.position.y,
    });
  }, []);

  // 드래그 중
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragState.isDragging || !dragState.panelId) return;
    const dx = e.clientX - dragState.startX;
    const dy = e.clientY - dragState.startY;
    updatePanel(dragState.panelId, {
      position: {
        x: dragState.startPosX + dx,
        y: dragState.startPosY + dy,
      },
    });
  }, [dragState, updatePanel]);

  // 드래그 끝
  const handleMouseUp = useCallback(() => {
    setDragState(prev => ({ ...prev, isDragging: false, panelId: null }));
  }, []);

  // 미니맵 클릭
  const handleMinimapClick = useCallback((
    e: React.MouseEvent<HTMLDivElement>,
    panel: PanelState
  ) => {
    const dim = dimensions[panel.id];
    const container = containerRefs.current[panel.id];
    if (!dim || !container || panel.scale <= 1) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const containerRect = container.getBoundingClientRect();
    const scaledWidth = dim.displayWidth * panel.scale;
    const scaledHeight = dim.displayHeight * panel.scale;

    const ratioX = clickX / MINIMAP_SIZE;
    const ratioY = clickY / MINIMAP_SIZE;

    const viewportCenterX = containerRect.width / 2;
    const viewportCenterY = containerRect.height / 2;

    const targetX = ratioX * scaledWidth;
    const targetY = ratioY * scaledHeight;

    updatePanel(panel.id, {
      position: {
        x: viewportCenterX - targetX,
        y: viewportCenterY - targetY,
      },
    });
  }, [dimensions, updatePanel]);

  // 이미지 인덱스 변경
  const handleImageChange = useCallback((panelId: string, delta: number, maxIndex: number) => {
    setPanels(prev => prev.map(p => {
      if (p.id !== panelId) return p;
      const newIndex = p.imageIndex + delta;
      if (newIndex < 0 || newIndex >= maxIndex) return p;
      return {
        ...p,
        imageIndex: newIndex,
        scale: 1,
        position: { x: 0, y: 0 },
        rotation: 0,
      };
    }));
  }, []);

  // 전체 리셋
  const handleReset = useCallback(() => {
    setPanels(prev => prev.map(p => ({
      ...p,
      imageIndex: 0,
      scale: 1,
      position: { x: 0, y: 0 },
      rotation: 0,
    })));
  }, []);

  // 미니맵 렌더링
  const renderMinimap = (panel: PanelState, currentImage: ExamAttachment | undefined) => {
    const dim = dimensions[panel.id];
    const container = containerRefs.current[panel.id];
    if (!dim || !container || panel.scale <= 1 || !currentImage) return null;

    const containerRect = container.getBoundingClientRect();
    const scaledWidth = dim.displayWidth * panel.scale;
    const scaledHeight = dim.displayHeight * panel.scale;

    const viewportWidthRatio = containerRect.width / scaledWidth;
    const viewportHeightRatio = containerRect.height / scaledHeight;

    const centerX = (containerRect.width / 2 - panel.position.x) / scaledWidth;
    const centerY = (containerRect.height / 2 - panel.position.y) / scaledHeight;

    const viewportX = (centerX - viewportWidthRatio / 2) * MINIMAP_SIZE;
    const viewportY = (centerY - viewportHeightRatio / 2) * MINIMAP_SIZE;
    const viewportWidth = viewportWidthRatio * MINIMAP_SIZE;
    const viewportHeight = viewportHeightRatio * MINIMAP_SIZE;

    return (
      <div
        className="absolute bottom-2 right-2 bg-black/70 rounded overflow-hidden cursor-pointer z-20"
        style={{ width: MINIMAP_SIZE, height: MINIMAP_SIZE }}
        onClick={(e) => {
          e.stopPropagation();
          handleMinimapClick(e, panel);
        }}
      >
        <img
          src={getThumbnailUrl(currentImage.thumbnail_path) || getFileUrl(currentImage.file_path)}
          alt=""
          className="w-full h-full object-contain"
          style={{ transform: `rotate(${panel.rotation}deg)` }}
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

  // 패널 렌더링
  const renderPanel = (panel: PanelState, index: number) => {
    const exam = exams[panel.examIndex];
    if (!exam) return null;

    const images = exam.attachments?.filter(a => isImageFile(a.file_name)) || [];
    const currentImage = images[panel.imageIndex];
    const hasMultipleImages = images.length > 1;
    const isDragging = dragState.panelId === panel.id && dragState.isDragging;

    return (
      <div
        key={panel.id}
        className="flex flex-col border border-gray-700 bg-gray-900 rounded-lg overflow-hidden"
      >
        {/* 헤더 */}
        <div className="bg-gray-800 px-2 py-1.5 flex items-center justify-between gap-2">
          <select
            value={panel.examIndex}
            onChange={(e) => updatePanel(panel.id, {
              examIndex: Number(e.target.value),
              imageIndex: 0,
              scale: 1,
              position: { x: 0, y: 0 },
              rotation: 0,
            })}
            className="bg-gray-700 text-white text-xs rounded px-1.5 py-1 border-none focus:ring-1 focus:ring-purple-500 flex-1 min-w-0"
          >
            {exams.map((ex, idx) => (
              <option key={ex.id} value={idx}>
                {ex.exam_date} ({ex.attachments?.filter(a => isImageFile(a.file_name)).length || 0}장)
              </option>
            ))}
          </select>

          <div className="flex items-center gap-0.5 flex-shrink-0">
            <button
              onClick={() => handleRotate(panel.id)}
              className="p-1 text-gray-400 hover:text-white rounded hover:bg-gray-700"
              title="90° 회전"
            >
              <i className="fas fa-redo text-xs"></i>
            </button>
            <button
              onClick={() => handleZoom(panel.id, -0.25)}
              className="p-1 text-gray-400 hover:text-white rounded hover:bg-gray-700"
              title="축소"
            >
              <i className="fas fa-minus text-xs"></i>
            </button>
            <button
              onClick={() => handleFit(panel.id)}
              className="px-1 py-0.5 text-gray-300 text-xs hover:bg-gray-700 rounded"
              title="창에 맞춤"
            >
              {Math.round(panel.scale * 100)}%
            </button>
            <button
              onClick={() => handleZoom(panel.id, 0.25)}
              className="p-1 text-gray-400 hover:text-white rounded hover:bg-gray-700"
              title="확대"
            >
              <i className="fas fa-plus text-xs"></i>
            </button>
            {panels.length > MIN_PANELS && (
              <button
                onClick={() => removePanel(panel.id)}
                className="p-1 text-gray-400 hover:text-red-400 rounded hover:bg-gray-700 ml-1"
                title="패널 삭제"
              >
                <i className="fas fa-times text-xs"></i>
              </button>
            )}
          </div>
        </div>

        {/* 이미지 영역 */}
        <div
          ref={(el) => { containerRefs.current[panel.id] = el; }}
          className={`flex-1 bg-gray-900 flex items-center justify-center overflow-hidden relative min-h-[200px] ${
            panel.scale > 1 ? 'cursor-grab' : ''
          } ${isDragging ? 'cursor-grabbing' : ''}`}
          onMouseDown={(e) => handleMouseDown(e, panel)}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={(e) => handleWheel(e, panel.id)}
        >
          {currentImage ? (
            <>
              <img
                src={getFileUrl(currentImage.file_path)}
                alt=""
                className="max-w-full max-h-full object-contain select-none"
                style={{
                  transform: `translate(${panel.position.x}px, ${panel.position.y}px) scale(${panel.scale}) rotate(${panel.rotation}deg)`,
                  transition: isDragging ? 'none' : 'transform 0.1s ease-out',
                }}
                draggable={false}
                onLoad={(e) => {
                  const container = containerRefs.current[panel.id];
                  if (container) {
                    handleImageLoad(panel.id, e.currentTarget, container);
                  }
                }}
              />

              {/* 미니맵 */}
              {renderMinimap(panel, currentImage)}

              {/* 회전 표시 */}
              {panel.rotation !== 0 && (
                <div className="absolute top-1 left-1 bg-black/60 px-1.5 py-0.5 rounded text-white text-xs">
                  {panel.rotation}°
                </div>
              )}

              {/* 이전/다음 버튼 */}
              {hasMultipleImages && (
                <>
                  <button
                    onClick={() => handleImageChange(panel.id, -1, images.length)}
                    disabled={panel.imageIndex === 0}
                    className="absolute left-1 top-1/2 -translate-y-1/2 p-1.5 bg-black/50 text-white rounded-full hover:bg-black/70 disabled:opacity-30 disabled:cursor-not-allowed z-10"
                  >
                    <i className="fas fa-chevron-left text-sm"></i>
                  </button>
                  <button
                    onClick={() => handleImageChange(panel.id, 1, images.length)}
                    disabled={panel.imageIndex === images.length - 1}
                    className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 bg-black/50 text-white rounded-full hover:bg-black/70 disabled:opacity-30 disabled:cursor-not-allowed z-10"
                  >
                    <i className="fas fa-chevron-right text-sm"></i>
                  </button>
                  <div className="absolute top-1 right-1 bg-black/60 px-1.5 py-0.5 rounded text-white text-xs">
                    {panel.imageIndex + 1}/{images.length}
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="text-gray-500 text-center">
              <i className="fas fa-image text-2xl mb-1"></i>
              <p className="text-xs">이미지 없음</p>
            </div>
          )}
        </div>

        {/* 썸네일 스트립 */}
        {hasMultipleImages && (
          <div className="bg-gray-800 px-1.5 py-1.5">
            <div className="flex gap-1 overflow-x-auto">
              {images.map((img, idx) => (
                <button
                  key={img.id}
                  onClick={() => updatePanel(panel.id, {
                    imageIndex: idx,
                    scale: 1,
                    position: { x: 0, y: 0 },
                    rotation: 0,
                  })}
                  className={`flex-shrink-0 w-10 h-10 rounded overflow-hidden transition-all ${
                    idx === panel.imageIndex
                      ? 'ring-2 ring-purple-500'
                      : 'ring-1 ring-gray-600 opacity-60 hover:opacity-100'
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

        {/* 캡션 */}
        <div className="bg-gray-800 px-2 py-1.5 border-t border-gray-700">
          <p className="text-xs text-gray-400 truncate">
            {currentImage?.caption || exam.findings || exam.exam_date}
          </p>
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

  const gridCols = getGridCols(panels.length);

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
            {panels.length}개 패널
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={addPanel}
            disabled={panels.length >= MAX_PANELS}
            className="px-3 py-1.5 text-sm text-gray-300 hover:text-white bg-gray-800 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <i className="fas fa-plus mr-1"></i>
            패널 추가
          </button>
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

      {/* 그리드 영역 */}
      <div
        className="flex-1 p-3 overflow-auto"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
          gap: '12px',
        }}
      >
        {panels.map((panel, index) => renderPanel(panel, index))}
      </div>

      {/* 하단 도움말 */}
      <div className="bg-gray-900 border-t border-gray-700 px-4 py-1.5 text-center text-gray-500 text-xs">
        마우스 휠: 줌 | 드래그: 이동 | 각 패널 독립 조절 | 최대 {MAX_PANELS}개 패널
      </div>
    </div>
  );
};

export default ExamCompareViewer;
