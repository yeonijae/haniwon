/**
 * 이미지 뷰어 컴포넌트
 * - 확대/축소 (마우스 휠, 버튼)
 * - 회전 (90도 단위)
 * - 드래그 이동
 * - 전체화면
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { getFileUrl } from '../lib/fileUpload';

interface ExamImageViewerProps {
  images: { file_path: string; file_name: string }[];
  initialIndex?: number;
  onClose: () => void;
}

const ExamImageViewer: React.FC<ExamImageViewerProps> = ({
  images,
  initialIndex = 0,
  onClose,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const currentImage = images[currentIndex];

  // 확대
  const zoomIn = useCallback(() => {
    setScale((s) => Math.min(s + 0.25, 5));
  }, []);

  // 축소
  const zoomOut = useCallback(() => {
    setScale((s) => Math.max(s - 0.25, 0.25));
  }, []);

  // 원본 크기
  const resetZoom = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
    setRotation(0);
  }, []);

  // 회전
  const rotateClockwise = useCallback(() => {
    setRotation((r) => (r + 90) % 360);
  }, []);

  const rotateCounterClockwise = useCallback(() => {
    setRotation((r) => (r - 90 + 360) % 360);
  }, []);

  // 이전/다음 이미지
  const goToPrevious = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      resetZoom();
    }
  }, [currentIndex, resetZoom]);

  const goToNext = useCallback(() => {
    if (currentIndex < images.length - 1) {
      setCurrentIndex(currentIndex + 1);
      resetZoom();
    }
  }, [currentIndex, images.length, resetZoom]);

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
    if (scale > 1) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      });
    }
  }, [scale, position]);

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

  // 키보드 단축키
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
        case 'r':
        case 'R':
          rotateClockwise();
          break;
        case '0':
          resetZoom();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, goToPrevious, goToNext, zoomIn, zoomOut, rotateClockwise, resetZoom]);

  // 이미지 다운로드
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = getFileUrl(currentImage.file_path);
    link.download = currentImage.file_name;
    link.click();
  };

  return (
    <div className="fixed inset-0 bg-black z-[60] flex flex-col">
      {/* 상단 툴바 */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/80">
        <div className="flex items-center gap-4">
          <span className="text-white text-sm">
            {currentIndex + 1} / {images.length}
          </span>
          <span className="text-gray-400 text-sm truncate max-w-xs">
            {currentImage.file_name}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* 줌 컨트롤 */}
          <div className="flex items-center gap-1 bg-gray-800 rounded-lg px-2 py-1">
            <button
              onClick={zoomOut}
              className="p-1.5 text-gray-400 hover:text-white transition-colors"
              title="축소 (-)"
            >
              <i className="fas fa-search-minus"></i>
            </button>
            <span className="text-white text-sm w-12 text-center">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={zoomIn}
              className="p-1.5 text-gray-400 hover:text-white transition-colors"
              title="확대 (+)"
            >
              <i className="fas fa-search-plus"></i>
            </button>
          </div>

          {/* 회전 */}
          <div className="flex items-center gap-1 bg-gray-800 rounded-lg px-2 py-1">
            <button
              onClick={rotateCounterClockwise}
              className="p-1.5 text-gray-400 hover:text-white transition-colors"
              title="반시계 회전"
            >
              <i className="fas fa-undo"></i>
            </button>
            <button
              onClick={rotateClockwise}
              className="p-1.5 text-gray-400 hover:text-white transition-colors"
              title="시계 회전 (R)"
            >
              <i className="fas fa-redo"></i>
            </button>
          </div>

          {/* 기타 버튼 */}
          <button
            onClick={resetZoom}
            className="p-2 text-gray-400 hover:text-white transition-colors"
            title="원본 크기 (0)"
          >
            <i className="fas fa-compress-arrows-alt"></i>
          </button>
          <button
            onClick={handleDownload}
            className="p-2 text-gray-400 hover:text-white transition-colors"
            title="다운로드"
          >
            <i className="fas fa-download"></i>
          </button>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white transition-colors ml-2"
            title="닫기 (ESC)"
          >
            <i className="fas fa-times text-xl"></i>
          </button>
        </div>
      </div>

      {/* 이미지 영역 */}
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden flex items-center justify-center cursor-grab active:cursor-grabbing"
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
          className="max-w-none select-none transition-transform duration-100"
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale}) rotate(${rotation}deg)`,
          }}
          draggable={false}
        />
      </div>

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

      {/* 하단 썸네일 바 */}
      {images.length > 1 && (
        <div className="bg-black/80 px-4 py-3 flex justify-center gap-2 overflow-x-auto">
          {images.map((img, idx) => (
            <button
              key={idx}
              onClick={() => {
                setCurrentIndex(idx);
                resetZoom();
              }}
              className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden ring-2 transition-all ${
                idx === currentIndex
                  ? 'ring-purple-500'
                  : 'ring-transparent hover:ring-gray-500'
              }`}
            >
              <img
                src={getFileUrl(img.file_path)}
                alt=""
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}

      {/* 단축키 도움말 */}
      <div className="absolute bottom-20 left-4 text-gray-500 text-xs space-y-1">
        <div>← → 이전/다음</div>
        <div>+/- 확대/축소</div>
        <div>R 회전 | 0 원본</div>
        <div>ESC 닫기</div>
      </div>
    </div>
  );
};

export default ExamImageViewer;
