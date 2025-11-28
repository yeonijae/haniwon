/**
 * 미디어 라이브러리 모달
 * - 다중 이미지 업로드
 * - 카테고리별 분류 (DB 연동)
 * - 이미지 선택
 */

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import MediaCategoryManager, { MediaCategory as CategoryType, DEFAULT_CATEGORIES } from './MediaCategoryManager';

export type MediaCategorySlug = string;

interface MediaFile {
  id: string;
  file_name: string;
  original_name: string;
  file_url: string;
  file_size: number;
  category: MediaCategorySlug;
  alt_text?: string;
  created_at: string;
}

interface UploadingFile {
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'done' | 'error';
  preview: string;
}

interface MediaLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (url: string, alt?: string) => void;
  defaultCategory?: MediaCategorySlug;
}

export default function MediaLibraryModal({
  isOpen,
  onClose,
  onSelect,
  defaultCategory = 'uncategorized',
}: MediaLibraryModalProps) {
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<MediaFile | null>(null);
  const [altText, setAltText] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<MediaCategorySlug | 'all'>('all');

  // 카테고리 관련
  const [categories, setCategories] = useState<CategoryType[]>(DEFAULT_CATEGORIES);
  const [showCategoryManager, setShowCategoryManager] = useState(false);

  // 업로드 관련
  const [showUploadPanel, setShowUploadPanel] = useState(false);
  const [uploadCategory, setUploadCategory] = useState<MediaCategorySlug>(defaultCategory);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      loadCategories();
      loadFiles();
      setSelectedFile(null);
      setAltText('');
      setUploadingFiles([]);
      setShowUploadPanel(false);
    }
  }, [isOpen]);

  // DB에서 카테고리 로드
  async function loadCategories() {
    try {
      const { data, error } = await supabase
        .from('media_categories')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) {
        console.warn('카테고리 로드 실패, 기본값 사용:', error);
        setCategories(DEFAULT_CATEGORIES);
      } else {
        setCategories(data || DEFAULT_CATEGORIES);
      }
    } catch (error) {
      console.error('Failed to load categories:', error);
      setCategories(DEFAULT_CATEGORIES);
    }
  }

  async function loadFiles() {
    setLoading(true);
    try {
      // DB에서 메타데이터 조회
      const { data: dbFiles, error: dbError } = await supabase
        .from('media_files')
        .select('*')
        .order('created_at', { ascending: false });

      if (dbError) {
        console.warn('DB 조회 실패, Storage에서 직접 로드:', dbError);
        // DB 실패 시 Storage에서 직접 로드 (기존 방식)
        await loadFilesFromStorage();
        return;
      }

      setFiles(dbFiles || []);
    } catch (error) {
      console.error('Failed to load files:', error);
      await loadFilesFromStorage();
    } finally {
      setLoading(false);
    }
  }

  // DB 없을 때 Storage에서 직접 로드 (fallback)
  async function loadFilesFromStorage() {
    try {
      const { data: storageFiles, error } = await supabase.storage
        .from('blog-images')
        .list('posts', {
          limit: 100,
          sortBy: { column: 'created_at', order: 'desc' },
        });

      if (error) throw error;

      const fileList: MediaFile[] = (storageFiles || [])
        .filter((file) => file.name !== '.emptyFolderPlaceholder')
        .map((file) => {
          const { data: urlData } = supabase.storage
            .from('blog-images')
            .getPublicUrl(`posts/${file.name}`);

          return {
            id: file.id || file.name,
            file_name: file.name,
            original_name: file.name,
            file_url: urlData.publicUrl,
            file_size: file.metadata?.size || 0,
            category: 'uncategorized' as MediaCategory,
            created_at: file.created_at || '',
          };
        });

      setFiles(fileList);
    } catch (error) {
      console.error('Storage load failed:', error);
    }
  }

  // 파일 선택 핸들러
  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(e.target.files || []);
    addFilesToUpload(selectedFiles);
  }

  // 드래그 앤 드롭 핸들러
  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files).filter((f) =>
      f.type.startsWith('image/')
    );
    addFilesToUpload(droppedFiles);
  }

  // 업로드 목록에 파일 추가
  function addFilesToUpload(newFiles: File[]) {
    const uploadFiles: UploadingFile[] = newFiles.map((file) => ({
      file,
      progress: 0,
      status: 'pending',
      preview: URL.createObjectURL(file),
    }));
    setUploadingFiles((prev) => [...prev, ...uploadFiles]);
    setShowUploadPanel(true);
  }

  // 업로드 목록에서 파일 제거
  function removeFromUpload(index: number) {
    setUploadingFiles((prev) => {
      const newList = [...prev];
      URL.revokeObjectURL(newList[index].preview);
      newList.splice(index, 1);
      return newList;
    });
  }

  // 모든 파일 업로드
  async function uploadAllFiles() {
    const pendingFiles = uploadingFiles.filter((f) => f.status === 'pending');
    if (pendingFiles.length === 0) return;

    for (let i = 0; i < uploadingFiles.length; i++) {
      if (uploadingFiles[i].status !== 'pending') continue;

      // 상태 업데이트: uploading
      setUploadingFiles((prev) =>
        prev.map((f, idx) => (idx === i ? { ...f, status: 'uploading' } : f))
      );

      try {
        const file = uploadingFiles[i].file;
        const fileExt = file.name.split('.').pop() || 'png';
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `posts/${fileName}`;

        // Storage에 업로드
        const { error: uploadError } = await supabase.storage
          .from('blog-images')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        // URL 가져오기
        const { data: urlData } = supabase.storage
          .from('blog-images')
          .getPublicUrl(filePath);

        // DB에 메타데이터 저장
        const { error: dbError } = await supabase.from('media_files').insert({
          file_name: fileName,
          original_name: file.name,
          file_path: filePath,
          file_url: urlData.publicUrl,
          file_size: file.size,
          mime_type: file.type,
          category: uploadCategory,
        });

        if (dbError) {
          console.warn('DB 저장 실패 (Storage 업로드는 성공):', dbError);
        }

        // 상태 업데이트: done
        setUploadingFiles((prev) =>
          prev.map((f, idx) => (idx === i ? { ...f, status: 'done', progress: 100 } : f))
        );
      } catch (error) {
        console.error('Upload failed:', error);
        // 상태 업데이트: error
        setUploadingFiles((prev) =>
          prev.map((f, idx) => (idx === i ? { ...f, status: 'error' } : f))
        );
      }
    }

    // 업로드 완료 후 목록 새로고침
    await loadFiles();
  }

  function handleSelect() {
    if (selectedFile) {
      onSelect(selectedFile.file_url, altText || selectedFile.alt_text || selectedFile.original_name);
      onClose();
    }
  }

  function formatBytes(bytes: number) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  function formatDate(dateStr: string) {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('ko-KR', {
      month: 'short',
      day: 'numeric',
    });
  }

  // 필터링된 파일
  const filteredFiles = files.filter((file) => {
    if (categoryFilter !== 'all' && file.category !== categoryFilter) return false;
    if (searchTerm && !file.original_name.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    return true;
  });

  // 업로드 대기 중인 파일 수
  const pendingCount = uploadingFiles.filter((f) => f.status === 'pending').length;
  const uploadingCount = uploadingFiles.filter((f) => f.status === 'uploading').length;

  // 카테고리 slug로 정보 가져오기
  function getCategoryInfo(slug: string): CategoryType | undefined {
    return categories.find((c) => c.slug === slug);
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 배경 오버레이 */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* 모달 */}
      <div className="relative bg-white rounded-xl shadow-2xl w-[1000px] max-h-[85vh] flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-xl font-bold text-gray-800">미디어 라이브러리</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCategoryManager(true)}
              className="px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-2"
              title="카테고리 관리"
            >
              <i className="fa-solid fa-tags"></i>
              <span className="text-sm">카테고리 관리</span>
            </button>
            <button
              onClick={() => setShowUploadPanel(!showUploadPanel)}
              className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                showUploadPanel
                  ? 'bg-rose-100 text-rose-600'
                  : 'bg-rose-500 text-white hover:bg-rose-600'
              }`}
            >
              <i className="fa-solid fa-upload"></i>
              업로드
              {pendingCount > 0 && (
                <span className="px-2 py-0.5 bg-white/20 rounded-full text-xs">
                  {pendingCount}
                </span>
              )}
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <i className="fa-solid fa-xmark text-xl"></i>
            </button>
          </div>
        </div>

        {/* 업로드 패널 */}
        {showUploadPanel && (
          <div className="border-b bg-gray-50 p-4">
            {/* 카테고리 선택 */}
            <div className="flex items-center gap-4 mb-4">
              <label className="text-sm text-gray-600">업로드 카테고리:</label>
              <select
                value={uploadCategory}
                onChange={(e) => setUploadCategory(e.target.value)}
                className="px-3 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
              >
                {categories.map((cat) => (
                  <option key={cat.slug} value={cat.slug}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 드롭존 */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                isDragging
                  ? 'border-rose-500 bg-rose-50'
                  : 'border-gray-300 hover:border-rose-400 hover:bg-rose-50/50'
              }`}
            >
              <i className="fa-solid fa-cloud-arrow-up text-3xl text-gray-400 mb-2"></i>
              <p className="text-gray-600">
                이미지를 드래그하거나 <span className="text-rose-500 font-medium">클릭하여 선택</span>
              </p>
              <p className="text-xs text-gray-400 mt-1">여러 파일 동시 업로드 가능</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            {/* 업로드 대기 목록 */}
            {uploadingFiles.length > 0 && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">
                    {uploadingFiles.length}개 파일
                  </span>
                  <button
                    onClick={uploadAllFiles}
                    disabled={pendingCount === 0 || uploadingCount > 0}
                    className="px-4 py-1.5 bg-rose-500 text-white rounded-lg text-sm hover:bg-rose-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {uploadingCount > 0 ? (
                      <>
                        <i className="fa-solid fa-spinner animate-spin mr-2"></i>
                        업로드 중...
                      </>
                    ) : (
                      <>전체 업로드</>
                    )}
                  </button>
                </div>
                <div className="grid grid-cols-6 gap-2 max-h-32 overflow-y-auto">
                  {uploadingFiles.map((uf, idx) => (
                    <div key={idx} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100">
                      <img
                        src={uf.preview}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                      {/* 상태 오버레이 */}
                      <div
                        className={`absolute inset-0 flex items-center justify-center ${
                          uf.status === 'done'
                            ? 'bg-green-500/70'
                            : uf.status === 'error'
                            ? 'bg-red-500/70'
                            : uf.status === 'uploading'
                            ? 'bg-black/50'
                            : ''
                        }`}
                      >
                        {uf.status === 'done' && (
                          <i className="fa-solid fa-check text-white text-xl"></i>
                        )}
                        {uf.status === 'error' && (
                          <i className="fa-solid fa-xmark text-white text-xl"></i>
                        )}
                        {uf.status === 'uploading' && (
                          <i className="fa-solid fa-spinner animate-spin text-white text-xl"></i>
                        )}
                      </div>
                      {/* 삭제 버튼 (pending일 때만) */}
                      {uf.status === 'pending' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFromUpload(idx);
                          }}
                          className="absolute top-1 right-1 w-5 h-5 bg-black/60 text-white rounded-full text-xs hover:bg-black/80"
                        >
                          <i className="fa-solid fa-xmark"></i>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 필터 바 */}
        <div className="flex items-center gap-4 px-6 py-3 border-b bg-white">
          {/* 카테고리 필터 */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setCategoryFilter('all')}
              className={`px-3 py-1 text-sm rounded-full transition-colors ${
                categoryFilter === 'all'
                  ? 'bg-rose-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              전체
            </button>
            {categories.map((cat) => (
              <button
                key={cat.slug}
                onClick={() => setCategoryFilter(cat.slug)}
                className={`px-3 py-1 text-sm rounded-full transition-colors flex items-center gap-1.5 ${
                  categoryFilter === cat.slug
                    ? 'text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                style={{
                  backgroundColor: categoryFilter === cat.slug ? cat.color : undefined,
                }}
              >
                <i className={`fa-solid ${cat.icon} text-xs`}></i>
                {cat.name}
              </button>
            ))}
          </div>

          {/* 검색 */}
          <div className="flex-1 relative ml-auto max-w-xs">
            <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
            <input
              type="text"
              placeholder="검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>

          {/* 새로고침 */}
          <button
            onClick={loadFiles}
            disabled={loading}
            className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <i className={`fa-solid fa-refresh ${loading ? 'animate-spin' : ''}`}></i>
          </button>
        </div>

        {/* 본문 */}
        <div className="flex flex-1 overflow-hidden">
          {/* 이미지 그리드 */}
          <div className="flex-1 overflow-y-auto p-4">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-500"></div>
              </div>
            ) : filteredFiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <i className="fa-solid fa-images text-4xl mb-3"></i>
                <p>이미지가 없습니다</p>
              </div>
            ) : (
              <div className="grid grid-cols-5 gap-3">
                {filteredFiles.map((file) => (
                  <div
                    key={file.id}
                    onClick={() => setSelectedFile(file)}
                    className={`relative aspect-square rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${
                      selectedFile?.id === file.id
                        ? 'border-rose-500 ring-2 ring-rose-500/30'
                        : 'border-transparent hover:border-gray-300'
                    }`}
                  >
                    <img
                      src={file.file_url}
                      alt={file.alt_text || file.original_name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    {/* 카테고리 배지 */}
                    <div className="absolute bottom-1 left-1">
                      {(() => {
                        const catInfo = getCategoryInfo(file.category);
                        return (
                          <span
                            className="px-1.5 py-0.5 text-white text-[10px] rounded flex items-center gap-1"
                            style={{ backgroundColor: catInfo?.color || '#6b7280' }}
                          >
                            <i className={`fa-solid ${catInfo?.icon || 'fa-folder'}`}></i>
                            {catInfo?.name || '미분류'}
                          </span>
                        );
                      })()}
                    </div>
                    {selectedFile?.id === file.id && (
                      <div className="absolute top-2 right-2 w-6 h-6 bg-rose-500 rounded-full flex items-center justify-center">
                        <i className="fa-solid fa-check text-white text-xs"></i>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 사이드바 - 선택된 파일 정보 */}
          <div className="w-64 border-l bg-gray-50 p-4 flex flex-col">
            {selectedFile ? (
              <>
                {/* 미리보기 */}
                <div className="aspect-video bg-gray-200 rounded-lg overflow-hidden mb-4">
                  <img
                    src={selectedFile.file_url}
                    alt={selectedFile.alt_text || selectedFile.original_name}
                    className="w-full h-full object-contain"
                  />
                </div>

                {/* 파일 정보 */}
                <div className="space-y-2 text-sm mb-4">
                  <div>
                    <span className="text-gray-500">파일명:</span>
                    <p className="text-gray-800 truncate" title={selectedFile.original_name}>
                      {selectedFile.original_name}
                    </p>
                  </div>
                  <div className="flex gap-4">
                    <div>
                      <span className="text-gray-500">크기:</span>
                      <p className="text-gray-800">{formatBytes(selectedFile.file_size)}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">날짜:</span>
                      <p className="text-gray-800">{formatDate(selectedFile.created_at)}</p>
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-500">카테고리:</span>
                    {(() => {
                      const catInfo = getCategoryInfo(selectedFile.category);
                      return (
                        <p className="text-gray-800 flex items-center gap-1.5 mt-0.5">
                          <span
                            className="w-3 h-3 rounded-sm"
                            style={{ backgroundColor: catInfo?.color || '#6b7280' }}
                          ></span>
                          {catInfo?.name || '미분류'}
                        </p>
                      );
                    })()}
                  </div>
                </div>

                {/* Alt 텍스트 입력 */}
                <div className="mb-4">
                  <label className="block text-sm text-gray-600 mb-1">대체 텍스트 (alt)</label>
                  <input
                    type="text"
                    value={altText}
                    onChange={(e) => setAltText(e.target.value)}
                    placeholder="이미지 설명..."
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>

                {/* URL 복사 */}
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(selectedFile.file_url);
                    alert('URL이 복사되었습니다.');
                  }}
                  className="w-full px-3 py-2 text-sm text-gray-600 border rounded-lg hover:bg-gray-100 transition-colors mb-2"
                >
                  <i className="fa-solid fa-copy mr-2"></i>
                  URL 복사
                </button>

                {/* 삽입 버튼 */}
                <button
                  onClick={handleSelect}
                  className="w-full px-4 py-2 bg-rose-500 text-white rounded-lg hover:bg-rose-600 transition-colors mt-auto"
                >
                  <i className="fa-solid fa-plus mr-2"></i>
                  이미지 삽입
                </button>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <i className="fa-solid fa-image text-3xl mb-2"></i>
                <p className="text-sm">이미지를 선택하세요</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 카테고리 관리 모달 */}
      <MediaCategoryManager
        isOpen={showCategoryManager}
        onClose={() => setShowCategoryManager(false)}
        onCategoriesChange={loadCategories}
      />
    </div>
  );
}
