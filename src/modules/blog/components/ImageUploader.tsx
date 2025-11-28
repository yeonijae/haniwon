/**
 * 블로그 이미지 업로더 컴포넌트
 * - 드래그 앤 드롭 지원
 * - 클립보드 붙여넣기 지원
 * - Supabase Storage에 업로드
 */

import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

// 이미지 업로드 함수 (외부에서도 사용 가능)
export async function uploadImageToSupabase(file: File): Promise<string | null> {
  if (!file.type.startsWith('image/')) {
    throw new Error('이미지 파일만 업로드할 수 있습니다.');
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error('파일 크기는 5MB 이하여야 합니다.');
  }

  const fileExt = file.name.split('.').pop() || 'png';
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
  const filePath = `posts/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('blog-images')
    .upload(filePath, file);

  if (uploadError) {
    throw uploadError;
  }

  const { data } = supabase.storage
    .from('blog-images')
    .getPublicUrl(filePath);

  return data.publicUrl;
}

interface ImageUploaderProps {
  onImageInsert: (imageUrl: string, altText: string) => void;
  onClose: () => void;
}

export default function ImageUploader({ onImageInsert, onClose }: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [altText, setAltText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const uploadImage = async (file: File): Promise<string | null> => {
    setUploading(true);
    setError(null);

    try {
      const url = await uploadImageToSupabase(file);
      return url;
    } catch (err) {
      console.error('Upload error:', err);
      setError(err instanceof Error ? err.message : '이미지 업로드에 실패했습니다.');
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleFile = async (file: File) => {
    // 미리보기 생성
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    // 업로드
    const url = await uploadImage(file);
    if (url) {
      setUploadedUrl(url);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dropZoneRef.current?.classList.remove('border-green-500', 'bg-green-50');

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFile(file);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dropZoneRef.current?.classList.add('border-green-500', 'bg-green-50');
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dropZoneRef.current?.classList.remove('border-green-500', 'bg-green-50');
  }, []);

  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) {
          handleFile(file);
          break;
        }
      }
    }
  }, []);

  const handleInsert = () => {
    if (uploadedUrl) {
      onImageInsert(uploadedUrl, altText || '이미지');
      onClose();
    }
  };

  const handleUrlInput = (url: string) => {
    setPreview(url);
    setUploadedUrl(url);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        onPaste={handlePaste}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-bold text-gray-800">이미지 삽입</h3>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <i className="fa-solid fa-times"></i>
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* 드래그 앤 드롭 영역 */}
          {!preview && (
            <div
              ref={dropZoneRef}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center transition-colors cursor-pointer hover:border-gray-400"
              onClick={() => fileInputRef.current?.click()}
            >
              <i className="fa-solid fa-cloud-arrow-up text-4xl text-gray-400 mb-4"></i>
              <p className="text-gray-600 mb-2">
                이미지를 드래그하거나 클릭하여 업로드
              </p>
              <p className="text-sm text-gray-400">
                또는 클립보드에서 Ctrl+V로 붙여넣기
              </p>
              <p className="text-xs text-gray-400 mt-2">
                최대 5MB, JPG/PNG/GIF/WebP
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          )}

          {/* 미리보기 */}
          {preview && (
            <div className="space-y-4">
              <div className="relative aspect-video bg-gray-100 rounded-lg overflow-hidden">
                <img
                  src={preview}
                  alt="미리보기"
                  className="w-full h-full object-contain"
                />
                {uploading && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <div className="text-white text-center">
                      <i className="fa-solid fa-spinner animate-spin text-2xl mb-2"></i>
                      <p>업로드 중...</p>
                    </div>
                  </div>
                )}
                <button
                  onClick={() => {
                    setPreview(null);
                    setUploadedUrl(null);
                    setAltText('');
                  }}
                  className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                >
                  <i className="fa-solid fa-times"></i>
                </button>
              </div>

              {/* 대체 텍스트 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  대체 텍스트 (SEO용)
                </label>
                <input
                  type="text"
                  value={altText}
                  onChange={(e) => setAltText(e.target.value)}
                  placeholder="이미지 설명을 입력하세요"
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>
          )}

          {/* URL 직접 입력 */}
          <div className="pt-4 border-t">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              또는 이미지 URL 직접 입력
            </label>
            <input
              type="url"
              placeholder="https://example.com/image.jpg"
              onChange={(e) => handleUrlInput(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          {/* 에러 메시지 */}
          {error && (
            <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">
              <i className="fa-solid fa-exclamation-circle mr-2"></i>
              {error}
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="flex items-center justify-end gap-3 p-4 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleInsert}
            disabled={!uploadedUrl || uploading}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            삽입하기
          </button>
        </div>
      </div>
    </div>
  );
}
