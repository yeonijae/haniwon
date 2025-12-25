/**
 * 이미지 뷰어 컴포넌트
 * - Fit to Window 기본 표시
 * - 확대/축소 (마우스 휠, 버튼)
 * - 드래그 패닝
 * - 미니맵 (확대 시 현재 위치 표시)
 * - 썸네일 스트립 네비게이션
 * - 캡션 편집
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { getFileUrl, getThumbnailUrl } from '../lib/fileUpload';
import type { ExamAttachment } from '../types';

interface ExamImageViewerProps {
  images: ExamAttachment[];
  initialIndex?: number;
  onClose: () => void;
  onCaptionUpdate?: (id: number, caption: string) => Promise<void>;
}

const ExamImageViewer: React.FC<ExamImageViewerProps> = ({
  images,
  initialIndex = 0,
  onClose,
  onCaptionUpdate,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1);
  const [fitScale, setFitScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [isEditingCaption, setIsEditingCaption] = useState(false);
  const [captionText, setCaptionText] = useState('');
  const [showMinimap, setShowMinimap] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const thumbnailStripRef = useRef<HTMLDivElement>(null);

  const currentImage = images[currentIndex];

  // 컨테이너 크기 감지
  useEffect(() => {
    const updateContainerSize = () => {
      if (containerRef.current) {
        setContainerSize({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };

    updateContainerSize();
    window.addEventListener('resize', updateContainerSize);
    return () => window.removeEventListener('resize', updateContainerSize);
  }, []);

  // 이미지 로드 시 Fit to Window 계산
  const handleImageLoad = useCallback(() => {
    if (imageRef.current && containerRef.current) {
      const img = imageRef.current;
      const container = containerRef.current;

      const naturalWidth = img.naturalWidth;
      const naturalHeight = img.naturalHeight;
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;

      setImageSize({ width: naturalWidth, height: naturalHeight });

      // Fit to Window 스케일 계산 (여백 포함)
      const scaleX = (containerWidth - 40) / naturalWidth;
      const scaleY = (containerHeight - 40) / naturalHeight;
      const fit = Math.min(scaleX, scaleY, 1); // 최대 1배 (100%)

      setFitScale(fit);
      setScale(fit);
      setPosition({ x: 0, y: 0 });
    }
  }, []);

  // 이미지 변경 시 캡션 로드
  useEffect(() => {
    setCaptionText(currentImage.caption || '');
    setIsEditingCaption(false);
  }, [currentIndex, currentImage.caption]);

  // 썸네일 스트립에서 현재 이미지 보이도록 스크롤
  useEffect(() => {
    if (thumbnailStripRef.current) {
      const strip = thumbnailStripRef.current;
      const activeThumb = strip.children[currentIndex] as HTMLElement;
      if (activeThumb) {
        const stripRect = strip.getBoundingClientRect();
        const thumbRect = activeThumb.getBoundingClientRect();

        if (thumbRect.left < stripRect.left || thumbRect.right > stripRect.right) {
          activeThumb.scrollIntoView({ behavior: 'smooth', inline: 'center' });
        }
      }
    }
  }, [currentIndex]);

  // 확대
  const zoomIn = useCallback(() => {
    setScale((s) => Math.min(s * 1.25, 5));
  }, []);

  // 축소
  const zoomOut = useCallback(() => {
    setScale((s) => Math.max(s / 1.25, fitScale * 0.5));
  }, [fitScale]);

  // Fit to Window
  const fitToWindow = useCallback(() => {
    setScale(fitScale);
    setPosition({ x: 0, y: 0 });
  }, [fitScale]);

  // 원본 크기 (100%)
  const actualSize = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  // 이전/다음 이미지
  const goToPrevious = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  }, [currentIndex]);

  const goToNext = useCallback(() => {
    if (currentIndex < images.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  }, [currentIndex, images.length]);

  // 마우스 휠 줌
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      zoomIn();
    } else {
      zoomOut();
    }
  }, [zoomIn, zoomOut]);

  // 드래그 시작
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (scale > fitScale) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      });
    }
  }, [scale, fitScale, position]);

  // 드래그 중
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  }, [isDragging, dragStart]);

  // 드래그 종료
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // 미니맵 클릭으로 이동
  const handleMinimapClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const minimapWidth = rect.width;
    const minimapHeight = rect.height;

    // 클릭 위치를 이미지 좌표로 변환
    const imgX = (x / minimapWidth) * imageSize.width * scale;
    const imgY = (y / minimapHeight) * imageSize.height * scale;

    // 뷰포트 중앙에 해당 위치가 오도록 position 설정
    setPosition({
      x: containerSize.width / 2 - imgX,
      y: containerSize.height / 2 - imgY,
    });
  }, [imageSize, scale, containerSize]);

  // 캡션 저장
  const handleSaveCaption = async () => {
    if (onCaptionUpdate) {
      await onCaptionUpdate(currentImage.id, captionText);
    }
    setIsEditingCaption(false);
  };

  // 키보드 단축키
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isEditingCaption) return;

      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowLeft':
          goToPrevious();
          break;
        case 'ArrowRight':
          goToNext();
          break;
        case '+':
        case '=':
          zoomIn();
          break;
        case '-':
          zoomOut();
          break;
        case 'f':
        case 'F':
          fitToWindow();
          break;
        case '1':
          actualSize();
          break;
        case 'm':
        case 'M':
          setShowMinimap(s => !s);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, goToPrevious, goToNext, zoomIn, zoomOut, fitToWindow, actualSize, isEditingCaption]);

  // 이미지 다운로드
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = getFileUrl(currentImage.file_path);
    link.download = currentImage.file_name;
    link.click();
  };

  // 확대 여부 확인
  const isZoomedIn = scale > fitScale * 1.1;

  // 미니맵 뷰포트 계산
  const getMinimapViewport = () => {
    if (!isZoomedIn) return null;

    const minimapWidth = 120;
    const minimapHeight = (imageSize.height / imageSize.width) * minimapWidth || 80;

    const scaledImgWidth = imageSize.width * scale;
    const scaledImgHeight = imageSize.height * scale;

    // 뷰포트 크기 (미니맵 스케일로)
    const vpWidth = (containerSize.width / scaledImgWidth) * minimapWidth;
    const vpHeight = (containerSize.height / scaledImgHeight) * minimapHeight;

    // 뷰포트 위치
    const centerX = -position.x + containerSize.width / 2;
    const centerY = -position.y + containerSize.height / 2;

    const vpX = (centerX / scaledImgWidth) * minimapWidth - vpWidth / 2;
    const vpY = (centerY / scaledImgHeight) * minimapHeight - vpHeight / 2;

    return {
      width: Math.min(vpWidth, minimapWidth),
      height: Math.min(vpHeight, minimapHeight),
      left: Math.max(0, Math.min(vpX, minimapWidth - vpWidth)),
      top: Math.max(0, Math.min(vpY, minimapHeight - vpHeight)),
      minimapHeight,
    };
  };

  const viewport = getMinimapViewport();

  return (
    <div className="fixed inset-0 bg-black z-[60] flex flex-col">
      {/* 상단 툴바 */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900/95 border-b border-gray-700">
        <div className="flex items-center gap-4">
          <span className="text-white font-medium">
            {currentIndex + 1} / {images.length}
          </span>
          <span className="text-gray-400 text-sm truncate max-w-xs">
            {currentImage.file_name}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {/* 줌 컨트롤 */}
          <div className="flex items-center gap-1 bg-gray-800 rounded-lg px-2 py-1">
            <button
              onClick={zoomOut}
              className="p-1.5 text-gray-400 hover:text-white transition-colors"
              title="축소 (-)"
            >
              <i className="fas fa-minus text-xs"></i>
            </button>
            <button
              onClick={fitToWindow}
              className="px-2 py-1 text-white text-sm hover:bg-gray-700 rounded"
              title="창에 맞춤 (F)"
            >
              {Math.round(scale * 100)}%
            </button>
            <button
              onClick={zoomIn}
              className="p-1.5 text-gray-400 hover:text-white transition-colors"
              title="확대 (+)"
            >
              <i className="fas fa-plus text-xs"></i>
            </button>
          </div>

          <button
            onClick={actualSize}
            className={`p-2 transition-colors rounded ${
              scale === 1 ? 'text-purple-400' : 'text-gray-400 hover:text-white'
            }`}
            title="원본 크기 (1)"
          >
            <i className="fas fa-expand"></i>
          </button>

          <button
            onClick={() => setShowMinimap(s => !s)}
            className={`p-2 transition-colors rounded ${
              showMinimap ? 'text-purple-400' : 'text-gray-400 hover:text-white'
            }`}
            title="미니맵 (M)"
          >
            <i className="fas fa-map"></i>
          </button>

          <div className="w-px h-6 bg-gray-700 mx-1"></div>

          <button
            onClick={handleDownload}
            className="p-2 text-gray-400 hover:text-white transition-colors"
            title="다운로드"
          >
            <i className="fas fa-download"></i>
          </button>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white transition-colors"
            title="닫기 (ESC)"
          >
            <i className="fas fa-times text-lg"></i>
          </button>
        </div>
      </div>

      {/* 이미지 영역 */}
      <div
        ref={containerRef}
        className={`flex-1 overflow-hidden flex items-center justify-center relative ${
          isZoomedIn ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
        }`}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <img
          ref={imageRef}
          src={getFileUrl(currentImage.file_path)}
          alt={currentImage.file_name}
          className="max-w-none select-none"
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transition: isDragging ? 'none' : 'transform 0.1s ease-out',
          }}
          draggable={false}
          onLoad={handleImageLoad}
        />

        {/* 미니맵 */}
        {showMinimap && isZoomedIn && viewport && (
          <div
            className="absolute bottom-4 right-4 bg-black/70 border border-gray-600 rounded-lg overflow-hidden cursor-pointer"
            style={{ width: 120, height: viewport.minimapHeight }}
            onClick={handleMinimapClick}
          >
            <img
              src={getThumbnailUrl(currentImage.thumbnail_path) || getFileUrl(currentImage.file_path)}
              alt=""
              className="w-full h-full object-contain"
            />
            {/* 현재 뷰포트 표시 */}
            <div
              className="absolute border-2 border-purple-500 bg-purple-500/20"
              style={{
                width: viewport.width,
                height: viewport.height,
                left: viewport.left,
                top: viewport.top,
              }}
            />
          </div>
        )}

        {/* 이전/다음 버튼 */}
        {images.length > 1 && (
          <>
            <button
              onClick={goToPrevious}
              disabled={currentIndex === 0}
              className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-black/50 text-white rounded-full hover:bg-black/70 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <i className="fas fa-chevron-left text-xl"></i>
            </button>
            <button
              onClick={goToNext}
              disabled={currentIndex === images.length - 1}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-black/50 text-white rounded-full hover:bg-black/70 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <i className="fas fa-chevron-right text-xl"></i>
            </button>
          </>
        )}
      </div>

      {/* 캡션 영역 */}
      <div className="bg-gray-900/95 border-t border-gray-700 px-4 py-2">
        {isEditingCaption ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={captionText}
              onChange={(e) => setCaptionText(e.target.value)}
              placeholder="이미지 설명을 입력하세요..."
              className="flex-1 bg-gray-800 text-white px-3 py-1.5 rounded border border-gray-600 focus:border-purple-500 focus:outline-none"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveCaption();
                if (e.key === 'Escape') setIsEditingCaption(false);
              }}
            />
            <button
              onClick={handleSaveCaption}
              className="px-3 py-1.5 bg-purple-600 text-white rounded hover:bg-purple-700"
            >
              저장
            </button>
            <button
              onClick={() => setIsEditingCaption(false)}
              className="px-3 py-1.5 bg-gray-700 text-gray-300 rounded hover:bg-gray-600"
            >
              취소
            </button>
          </div>
        ) : (
          <div
            onClick={() => onCaptionUpdate && setIsEditingCaption(true)}
            className={`text-center ${
              onCaptionUpdate ? 'cursor-pointer hover:bg-gray-800/50 rounded py-1' : ''
            }`}
          >
            {currentImage.caption ? (
              <span className="text-gray-200">{currentImage.caption}</span>
            ) : (
              <span className="text-gray-500 italic">
                {onCaptionUpdate ? '클릭하여 설명 추가...' : ''}
              </span>
            )}
          </div>
        )}
      </div>

      {/* 썸네일 스트립 */}
      {images.length > 1 && (
        <div className="bg-gray-900/95 border-t border-gray-700 px-4 py-2">
          <div
            ref={thumbnailStripRef}
            className="flex justify-center gap-2 overflow-x-auto py-1 scrollbar-thin scrollbar-thumb-gray-600"
          >
            {images.map((img, idx) => (
              <button
                key={img.id}
                onClick={() => setCurrentIndex(idx)}
                className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden transition-all ${
                  idx === currentIndex
                    ? 'ring-2 ring-purple-500 ring-offset-2 ring-offset-gray-900'
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
          <div className="text-center text-gray-500 text-xs mt-1">
            ← → 이전/다음 | +/- 확대/축소 | F 창맞춤 | 1 원본 | M 미니맵 | ESC 닫기
          </div>
        </div>
      )}
    </div>
  );
};

export default ExamImageViewer;
