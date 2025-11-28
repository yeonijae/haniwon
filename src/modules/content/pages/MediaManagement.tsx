/**
 * 미디어 관리 페이지
 * - 이미지 업로드 및 관리
 * - 카테고리별 분류
 * - 검색 및 필터링
 * - 스토리지 정리
 */

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import MediaCategoryManager, { MediaCategory, DEFAULT_CATEGORIES } from '../components/MediaCategoryManager';

interface MediaFile {
  id: string;
  file_name: string;
  original_name: string;
  file_url: string;
  file_path: string;
  file_size: number;
  category: string;
  alt_text?: string;
  description?: string;
  created_at: string;
}

interface UploadingFile {
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'done' | 'error';
  preview: string;
}

// 스토리지 파일 인터페이스
interface StorageFile {
  id: string;
  name: string;
  url: string;
  size: number;
  createdAt: string;
  isLinked: boolean;
  selected: boolean;
}

interface StorageStats {
  totalFiles: number;
  totalSize: number;
  linkedFiles: number;
  unlinkedFiles: number;
  unlinkedSize: number;
}

export default function MediaManagement() {
  // 탭 상태
  const [activeTab, setActiveTab] = useState<'library' | 'storage'>('library');

  const [files, setFiles] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | 'all'>('all');

  // 카테고리 관련
  const [categories, setCategories] = useState<MediaCategory[]>(DEFAULT_CATEGORIES);
  const [showCategoryManager, setShowCategoryManager] = useState(false);

  // 업로드 관련
  const [showUploadPanel, setShowUploadPanel] = useState(false);
  const [uploadCategory, setUploadCategory] = useState<string>('uncategorized');
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 상세 보기
  const [selectedFile, setSelectedFile] = useState<MediaFile | null>(null);
  const [editingAlt, setEditingAlt] = useState('');
  const [editingDescription, setEditingDescription] = useState('');
  const [editingCategory, setEditingCategory] = useState('');
  const [saving, setSaving] = useState(false);

  // 뷰 모드
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // 스토리지 정리 관련 상태
  const [storageFiles, setStorageFiles] = useState<StorageFile[]>([]);
  const [storageStats, setStorageStats] = useState<StorageStats | null>(null);
  const [storageLoading, setStorageLoading] = useState(false);
  const [storageFilter, setStorageFilter] = useState<'all' | 'unlinked' | 'linked'>('unlinked');
  const [storageSelectAll, setStorageSelectAll] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadCategories();
    loadFiles();
  }, []);

  useEffect(() => {
    if (activeTab === 'storage' && storageFiles.length === 0) {
      loadStorageData();
    }
  }, [activeTab]);

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
      const { data, error } = await supabase
        .from('media_files')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('DB 조회 실패, Storage에서 로드:', error);
        await loadFilesFromStorage();
        return;
      }

      setFiles(data || []);
    } catch (error) {
      console.error('Failed to load files:', error);
      await loadFilesFromStorage();
    } finally {
      setLoading(false);
    }
  }

  async function loadFilesFromStorage() {
    try {
      const { data: storageFiles, error } = await supabase.storage
        .from('blog-images')
        .list('posts', {
          limit: 200,
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
            file_path: `posts/${file.name}`,
            file_size: file.metadata?.size || 0,
            category: 'uncategorized',
            created_at: file.created_at || '',
          };
        });

      setFiles(fileList);
    } catch (error) {
      console.error('Storage load failed:', error);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(e.target.files || []);
    addFilesToUpload(selectedFiles);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files).filter((f) =>
      f.type.startsWith('image/')
    );
    addFilesToUpload(droppedFiles);
  }

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

  function removeFromUpload(index: number) {
    setUploadingFiles((prev) => {
      const newList = [...prev];
      URL.revokeObjectURL(newList[index].preview);
      newList.splice(index, 1);
      return newList;
    });
  }

  async function uploadAllFiles() {
    const pendingFiles = uploadingFiles.filter((f) => f.status === 'pending');
    if (pendingFiles.length === 0) return;

    for (let i = 0; i < uploadingFiles.length; i++) {
      if (uploadingFiles[i].status !== 'pending') continue;

      setUploadingFiles((prev) =>
        prev.map((f, idx) => (idx === i ? { ...f, status: 'uploading' } : f))
      );

      try {
        const file = uploadingFiles[i].file;
        const fileExt = file.name.split('.').pop() || 'png';
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `posts/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('blog-images')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('blog-images')
          .getPublicUrl(filePath);

        await supabase.from('media_files').insert({
          file_name: fileName,
          original_name: file.name,
          file_path: filePath,
          file_url: urlData.publicUrl,
          file_size: file.size,
          mime_type: file.type,
          category: uploadCategory,
        });

        setUploadingFiles((prev) =>
          prev.map((f, idx) => (idx === i ? { ...f, status: 'done', progress: 100 } : f))
        );
      } catch (error) {
        console.error('Upload failed:', error);
        setUploadingFiles((prev) =>
          prev.map((f, idx) => (idx === i ? { ...f, status: 'error' } : f))
        );
      }
    }

    await loadFiles();
  }

  function clearCompletedUploads() {
    setUploadingFiles((prev) => {
      prev.forEach((f) => {
        if (f.status === 'done' || f.status === 'error') {
          URL.revokeObjectURL(f.preview);
        }
      });
      return prev.filter((f) => f.status === 'pending' || f.status === 'uploading');
    });
  }

  function toggleSelect(id: string) {
    setSelectedFiles((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }

  function selectAll() {
    const allIds = filteredFiles.map((f) => f.id);
    setSelectedFiles(new Set(allIds));
  }

  function clearSelection() {
    setSelectedFiles(new Set());
  }

  async function deleteSelected() {
    if (selectedFiles.size === 0) return;
    if (!confirm(`${selectedFiles.size}개의 이미지를 삭제하시겠습니까?`)) return;

    try {
      for (const id of selectedFiles) {
        const file = files.find((f) => f.id === id);
        if (!file) continue;

        // Storage에서 삭제
        await supabase.storage.from('blog-images').remove([file.file_path]);

        // DB에서 삭제
        await supabase.from('media_files').delete().eq('id', id);
      }

      await loadFiles();
      setSelectedFiles(new Set());
    } catch (error) {
      console.error('Delete failed:', error);
      alert('삭제 중 오류가 발생했습니다.');
    }
  }

  async function updateFileDetails() {
    if (!selectedFile) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('media_files')
        .update({
          alt_text: editingAlt.trim() || null,
          description: editingDescription.trim() || null,
          category: editingCategory,
        })
        .eq('id', selectedFile.id);

      if (error) throw error;

      await loadFiles();
      setSelectedFile((prev) =>
        prev
          ? {
              ...prev,
              alt_text: editingAlt.trim(),
              description: editingDescription.trim(),
              category: editingCategory,
            }
          : null
      );
    } catch (error) {
      console.error('Update failed:', error);
      alert('저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  function openFileDetail(file: MediaFile) {
    setSelectedFile(file);
    setEditingAlt(file.alt_text || '');
    setEditingDescription(file.description || '');
    setEditingCategory(file.category);
  }

  function closeFileDetail() {
    setSelectedFile(null);
    setEditingAlt('');
    setEditingDescription('');
    setEditingCategory('');
  }

  function getCategoryInfo(slug: string): MediaCategory | undefined {
    return categories.find((c) => c.slug === slug);
  }

  // ==================== 스토리지 정리 함수들 ====================
  async function loadStorageData() {
    setStorageLoading(true);
    try {
      // Storage에서 모든 파일 목록 가져오기
      const { data: storageFilesData, error: storageError } = await supabase
        .storage
        .from('blog-images')
        .list('posts', {
          limit: 1000,
          sortBy: { column: 'created_at', order: 'desc' },
        });

      if (storageError) throw storageError;

      // 블로그 포스트에서 사용중인 이미지 URL 가져오기
      const { data: posts, error: postsError } = await supabase
        .from('blog_posts')
        .select('content, thumbnail_url');

      if (postsError) throw postsError;

      // 사용중인 이미지 URL 추출
      const usedUrls = new Set<string>();
      posts?.forEach((post) => {
        if (post.thumbnail_url) {
          usedUrls.add(post.thumbnail_url);
        }
        const imgMatches = post.content?.match(/src="([^"]+)"/g) || [];
        imgMatches.forEach((match: string) => {
          const url = match.replace('src="', '').replace('"', '');
          usedUrls.add(url);
        });
      });

      // 파일 목록 생성
      const fileList: StorageFile[] = (storageFilesData || [])
        .filter((file) => file.name !== '.emptyFolderPlaceholder')
        .map((file) => {
          const { data: urlData } = supabase.storage
            .from('blog-images')
            .getPublicUrl(`posts/${file.name}`);

          const url = urlData.publicUrl;
          const isLinked = usedUrls.has(url);

          return {
            id: file.id || file.name,
            name: file.name,
            url,
            size: file.metadata?.size || 0,
            createdAt: file.created_at || '',
            isLinked,
            selected: false,
          };
        });

      setStorageFiles(fileList);

      // 통계 계산
      const totalSize = fileList.reduce((sum, f) => sum + f.size, 0);
      const linkedFiles = fileList.filter((f) => f.isLinked);
      const unlinkedFiles = fileList.filter((f) => !f.isLinked);
      const unlinkedSize = unlinkedFiles.reduce((sum, f) => sum + f.size, 0);

      setStorageStats({
        totalFiles: fileList.length,
        totalSize,
        linkedFiles: linkedFiles.length,
        unlinkedFiles: unlinkedFiles.length,
        unlinkedSize,
      });
    } catch (error) {
      console.error('Failed to load storage data:', error);
      alert('스토리지 데이터를 불러오는데 실패했습니다.');
    } finally {
      setStorageLoading(false);
    }
  }

  function handleStorageSelectAll() {
    const newSelectAll = !storageSelectAll;
    setStorageSelectAll(newSelectAll);
    setStorageFiles((prev) =>
      prev.map((f) => ({
        ...f,
        selected: storageFilter === 'all' ? newSelectAll :
                  storageFilter === 'unlinked' ? (!f.isLinked && newSelectAll) :
                  (f.isLinked && newSelectAll),
      }))
    );
  }

  function handleStorageSelectFile(id: string) {
    setStorageFiles((prev) =>
      prev.map((f) =>
        f.id === id ? { ...f, selected: !f.selected } : f
      )
    );
  }

  async function handleStorageDeleteSelected() {
    const selectedStorageFiles = storageFiles.filter((f) => f.selected);
    if (selectedStorageFiles.length === 0) {
      alert('삭제할 파일을 선택해주세요.');
      return;
    }

    const linkedSelected = selectedStorageFiles.filter((f) => f.isLinked);
    if (linkedSelected.length > 0) {
      const confirmLinked = confirm(
        `선택한 파일 중 ${linkedSelected.length}개가 현재 포스트에서 사용 중입니다.\n정말 삭제하시겠습니까?`
      );
      if (!confirmLinked) return;
    } else {
      const confirmDelete = confirm(
        `${selectedStorageFiles.length}개의 파일을 삭제하시겠습니까?\n이 작업은 취소할 수 없습니다.`
      );
      if (!confirmDelete) return;
    }

    setDeleting(true);
    try {
      const filesToDelete = selectedStorageFiles.map((f) => `posts/${f.name}`);
      const { error } = await supabase.storage
        .from('blog-images')
        .remove(filesToDelete);

      if (error) throw error;

      alert(`${selectedStorageFiles.length}개의 파일이 삭제되었습니다.`);
      setStorageSelectAll(false);
      await loadStorageData();
    } catch (error) {
      console.error('Delete failed:', error);
      alert('파일 삭제에 실패했습니다.');
    } finally {
      setDeleting(false);
    }
  }

  async function handleDeleteAllUnlinked() {
    const unlinkedStorageFiles = storageFiles.filter((f) => !f.isLinked);
    if (unlinkedStorageFiles.length === 0) {
      alert('삭제할 미연결 파일이 없습니다.');
      return;
    }

    const confirmDelete = confirm(
      `미연결 파일 ${unlinkedStorageFiles.length}개 (${formatBytes(storageStats?.unlinkedSize || 0)})를 모두 삭제하시겠습니까?\n이 작업은 취소할 수 없습니다.`
    );
    if (!confirmDelete) return;

    setDeleting(true);
    try {
      const filesToDelete = unlinkedStorageFiles.map((f) => `posts/${f.name}`);
      const { error } = await supabase.storage
        .from('blog-images')
        .remove(filesToDelete);

      if (error) throw error;

      alert(`${unlinkedStorageFiles.length}개의 미연결 파일이 삭제되었습니다.`);
      await loadStorageData();
    } catch (error) {
      console.error('Delete failed:', error);
      alert('파일 삭제에 실패했습니다.');
    } finally {
      setDeleting(false);
    }
  }

  const filteredStorageFiles = storageFiles.filter((f) => {
    if (storageFilter === 'unlinked') return !f.isLinked;
    if (storageFilter === 'linked') return f.isLinked;
    return true;
  });

  const storageSelectedCount = storageFiles.filter((f) => f.selected).length;
  const storageSelectedSize = storageFiles.filter((f) => f.selected).reduce((sum, f) => sum + f.size, 0);

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
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  // 필터링
  const filteredFiles = files.filter((file) => {
    if (categoryFilter !== 'all' && file.category !== categoryFilter) return false;
    if (searchTerm && !file.original_name.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    return true;
  });

  const pendingCount = uploadingFiles.filter((f) => f.status === 'pending').length;
  const uploadingCount = uploadingFiles.filter((f) => f.status === 'uploading').length;
  const completedCount = uploadingFiles.filter((f) => f.status === 'done' || f.status === 'error').length;

  // 카테고리별 통계
  const categoryStats = categories.map((cat) => ({
    ...cat,
    count: files.filter((f) => f.category === cat.slug).length,
  }));

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* 상단 헤더 */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-gray-800">
              <i className="fa-solid fa-photo-film text-rose-500 mr-2"></i>
              미디어 관리
            </h2>
            {/* 탭 전환 */}
            <div className="flex items-center bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setActiveTab('library')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'library'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <i className="fa-solid fa-images mr-2"></i>
                라이브러리
              </button>
              <button
                onClick={() => setActiveTab('storage')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'storage'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <i className="fa-solid fa-hard-drive mr-2"></i>
                스토리지 정리
                {storageStats && storageStats.unlinkedFiles > 0 && (
                  <span className="ml-2 px-1.5 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full">
                    {storageStats.unlinkedFiles}
                  </span>
                )}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {activeTab === 'library' && (
              <>
                {/* 뷰 모드 전환 */}
                <div className="flex items-center bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-2 rounded ${viewMode === 'grid' ? 'bg-white shadow-sm' : 'text-gray-500'}`}
                  >
                    <i className="fa-solid fa-grid-2"></i>
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-2 rounded ${viewMode === 'list' ? 'bg-white shadow-sm' : 'text-gray-500'}`}
                  >
                    <i className="fa-solid fa-list"></i>
                  </button>
                </div>

                {/* 카테고리 관리 */}
                <button
                  onClick={() => setShowCategoryManager(true)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-2"
                >
                  <i className="fa-solid fa-tags"></i>
                  카테고리 관리
                </button>
              </>
            )}

            {activeTab === 'library' && (
              /* 업로드 버튼 */
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
            )}

            {activeTab === 'storage' && (
              <button
                onClick={loadStorageData}
                disabled={storageLoading}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <i className={`fa-solid fa-refresh mr-2 ${storageLoading ? 'animate-spin' : ''}`}></i>
                새로고침
              </button>
            )}
          </div>
        </div>

        {/* 라이브러리 탭: 검색 및 필터 */}
        {activeTab === 'library' && (
          <div className="flex items-center gap-4 mt-4">
            {/* 검색 */}
            <div className="relative flex-1 max-w-md">
              <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
              <input
                type="text"
                placeholder="파일명으로 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            {/* 카테고리 필터 */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setCategoryFilter('all')}
                className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
                  categoryFilter === 'all'
                    ? 'bg-rose-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                전체 ({files.length})
              </button>
              {categoryStats.map((cat) => (
              <button
                key={cat.slug}
                onClick={() => setCategoryFilter(cat.slug)}
                className={`px-3 py-1.5 text-sm rounded-full transition-colors flex items-center gap-1.5 ${
                  categoryFilter === cat.slug
                    ? 'text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                style={{
                  backgroundColor: categoryFilter === cat.slug ? cat.color : undefined,
                }}
              >
                <i className={`fa-solid ${cat.icon} text-xs`}></i>
                {cat.name} ({cat.count})
              </button>
            ))}
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
        )}
      </div>

      {/* 업로드 패널 - 라이브러리 탭에서만 */}
      {activeTab === 'library' && showUploadPanel && (
        <div className="bg-gray-50 border-b p-4">
          <div className="max-w-4xl mx-auto">
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
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                isDragging
                  ? 'border-rose-500 bg-rose-50'
                  : 'border-gray-300 hover:border-rose-400 hover:bg-rose-50/50'
              }`}
            >
              <i className="fa-solid fa-cloud-arrow-up text-4xl text-gray-400 mb-3"></i>
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
                  <span className="text-sm text-gray-600">{uploadingFiles.length}개 파일</span>
                  <div className="flex items-center gap-2">
                    {completedCount > 0 && (
                      <button
                        onClick={clearCompletedUploads}
                        className="px-3 py-1 text-sm text-gray-500 hover:text-gray-700"
                      >
                        완료된 항목 지우기
                      </button>
                    )}
                    <button
                      onClick={uploadAllFiles}
                      disabled={pendingCount === 0 || uploadingCount > 0}
                      className="px-4 py-1.5 bg-rose-500 text-white rounded-lg text-sm hover:bg-rose-600 disabled:opacity-50"
                    >
                      {uploadingCount > 0 ? (
                        <>
                          <i className="fa-solid fa-spinner animate-spin mr-2"></i>
                          업로드 중...
                        </>
                      ) : (
                        '전체 업로드'
                      )}
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-8 gap-2 max-h-40 overflow-y-auto">
                  {uploadingFiles.map((uf, idx) => (
                    <div key={idx} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100">
                      <img src={uf.preview} alt="" className="w-full h-full object-cover" />
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
                        {uf.status === 'done' && <i className="fa-solid fa-check text-white text-xl"></i>}
                        {uf.status === 'error' && <i className="fa-solid fa-xmark text-white text-xl"></i>}
                        {uf.status === 'uploading' && (
                          <i className="fa-solid fa-spinner animate-spin text-white text-xl"></i>
                        )}
                      </div>
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
        </div>
      )}

      {/* ==================== 라이브러리 탭 ==================== */}
      {activeTab === 'library' && (
        <>
          {/* 선택 모드 툴바 */}
          {selectedFiles.size > 0 && (
            <div className="bg-rose-50 border-b px-6 py-3 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-rose-600 font-medium">
                  {selectedFiles.size}개 선택됨
                </span>
                <button
                  onClick={selectAll}
                  className="text-sm text-gray-600 hover:text-gray-800"
                >
                  전체 선택
                </button>
                <button
                  onClick={clearSelection}
                  className="text-sm text-gray-600 hover:text-gray-800"
                >
                  선택 해제
                </button>
              </div>
              <button
                onClick={deleteSelected}
                className="px-4 py-1.5 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600"
              >
                <i className="fa-solid fa-trash mr-2"></i>
                삭제
              </button>
            </div>
          )}

          {/* 메인 콘텐츠 */}
          <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-rose-500"></div>
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <i className="fa-solid fa-images text-5xl mb-4"></i>
            <p className="text-lg">이미지가 없습니다</p>
            <p className="text-sm mt-1">이미지를 업로드해 주세요</p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
            {filteredFiles.map((file) => {
              const catInfo = getCategoryInfo(file.category);
              const isSelected = selectedFiles.has(file.id);
              return (
                <div
                  key={file.id}
                  className={`relative aspect-square rounded-lg overflow-hidden cursor-pointer group border-2 transition-all ${
                    isSelected
                      ? 'border-rose-500 ring-2 ring-rose-500/30'
                      : 'border-transparent hover:border-gray-300'
                  }`}
                  onClick={() => openFileDetail(file)}
                >
                  <img
                    src={file.file_url}
                    alt={file.alt_text || file.original_name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  {/* 호버 오버레이 */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors">
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <i className="fa-solid fa-expand text-white text-xl"></i>
                    </div>
                  </div>
                  {/* 카테고리 배지 */}
                  <div className="absolute bottom-1 left-1">
                    <span
                      className="px-1.5 py-0.5 text-white text-[10px] rounded flex items-center gap-1"
                      style={{ backgroundColor: catInfo?.color || '#6b7280' }}
                    >
                      <i className={`fa-solid ${catInfo?.icon || 'fa-folder'}`}></i>
                      {catInfo?.name || '미분류'}
                    </span>
                  </div>
                  {/* 선택 체크박스 */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSelect(file.id);
                    }}
                    className={`absolute top-2 left-2 w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${
                      isSelected
                        ? 'bg-rose-500 border-rose-500 text-white'
                        : 'bg-white/80 border-gray-300 text-transparent hover:border-rose-400'
                    }`}
                  >
                    <i className="fa-solid fa-check text-xs"></i>
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="w-12 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedFiles.size === filteredFiles.length && filteredFiles.length > 0}
                      onChange={(e) => (e.target.checked ? selectAll() : clearSelection())}
                      className="rounded"
                    />
                  </th>
                  <th className="w-16 px-4 py-3"></th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">파일명</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">카테고리</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">크기</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">날짜</th>
                  <th className="w-20 px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filteredFiles.map((file) => {
                  const catInfo = getCategoryInfo(file.category);
                  const isSelected = selectedFiles.has(file.id);
                  return (
                    <tr
                      key={file.id}
                      className={`border-t hover:bg-gray-50 ${isSelected ? 'bg-rose-50' : ''}`}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(file.id)}
                          className="rounded"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="w-12 h-12 rounded overflow-hidden">
                          <img
                            src={file.file_url}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-gray-800 truncate max-w-xs" title={file.original_name}>
                          {file.original_name}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="px-2 py-1 text-white text-xs rounded flex items-center gap-1 w-fit"
                          style={{ backgroundColor: catInfo?.color || '#6b7280' }}
                        >
                          <i className={`fa-solid ${catInfo?.icon || 'fa-folder'}`}></i>
                          {catInfo?.name || '미분류'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {formatBytes(file.file_size)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {formatDate(file.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => openFileDetail(file)}
                          className="text-gray-400 hover:text-rose-500"
                        >
                          <i className="fa-solid fa-ellipsis-vertical"></i>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          )}
          </div>
        </>
      )}

      {/* ==================== 스토리지 정리 탭 ==================== */}
      {activeTab === 'storage' && (
        <div className="flex-1 overflow-y-auto p-6">
          {/* 통계 카드 */}
          {storageStats && (
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-lg border p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <i className="fa-solid fa-images text-blue-600"></i>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">전체 파일</p>
                    <p className="text-xl font-bold text-gray-900">{storageStats.totalFiles}개</p>
                    <p className="text-xs text-gray-400">{formatBytes(storageStats.totalSize)}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-lg border p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <i className="fa-solid fa-link text-green-600"></i>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">사용 중</p>
                    <p className="text-xl font-bold text-green-600">{storageStats.linkedFiles}개</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-lg border p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                    <i className="fa-solid fa-link-slash text-yellow-600"></i>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">미연결</p>
                    <p className="text-xl font-bold text-yellow-600">{storageStats.unlinkedFiles}개</p>
                    <p className="text-xs text-gray-400">{formatBytes(storageStats.unlinkedSize)}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-lg border p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-rose-100 rounded-lg flex items-center justify-center">
                    <i className="fa-solid fa-trash text-rose-600"></i>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">정리 가능</p>
                    <button
                      onClick={handleDeleteAllUnlinked}
                      disabled={deleting || storageStats.unlinkedFiles === 0}
                      className="text-sm text-rose-600 hover:text-rose-700 font-medium disabled:opacity-50"
                    >
                      {formatBytes(storageStats.unlinkedSize)} 정리
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 필터 및 액션 */}
          <div className="bg-white rounded-lg border p-4 mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {/* 필터 탭 */}
                <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={() => setStorageFilter('unlinked')}
                    className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                      storageFilter === 'unlinked'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    미연결 ({storageStats?.unlinkedFiles || 0})
                  </button>
                  <button
                    onClick={() => setStorageFilter('linked')}
                    className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                      storageFilter === 'linked'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    사용 중 ({storageStats?.linkedFiles || 0})
                  </button>
                  <button
                    onClick={() => setStorageFilter('all')}
                    className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                      storageFilter === 'all'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    전체 ({storageStats?.totalFiles || 0})
                  </button>
                </div>

                {/* 전체 선택 */}
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={storageSelectAll}
                    onChange={handleStorageSelectAll}
                    className="w-4 h-4 rounded border-gray-300 text-rose-500 focus:ring-rose-500"
                  />
                  전체 선택
                </label>
              </div>

              {/* 선택 삭제 */}
              {storageSelectedCount > 0 && (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-600">
                    {storageSelectedCount}개 선택됨 ({formatBytes(storageSelectedSize)})
                  </span>
                  <button
                    onClick={handleStorageDeleteSelected}
                    disabled={deleting}
                    className="px-4 py-2 bg-rose-500 text-white rounded-lg hover:bg-rose-600 transition-colors disabled:opacity-50"
                  >
                    {deleting ? (
                      <>
                        <i className="fa-solid fa-spinner animate-spin mr-2"></i>
                        삭제 중...
                      </>
                    ) : (
                      <>
                        <i className="fa-solid fa-trash mr-2"></i>
                        선택 삭제
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* 파일 그리드 */}
          {storageLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-500 mx-auto mb-4"></div>
                <p className="text-gray-500">스토리지 데이터 로딩 중...</p>
              </div>
            </div>
          ) : filteredStorageFiles.length === 0 ? (
            <div className="bg-white rounded-lg border p-12 text-center">
              <i className="fa-solid fa-folder-open text-4xl text-gray-300 mb-4"></i>
              <p className="text-gray-500">
                {storageFilter === 'unlinked' ? '미연결 파일이 없습니다.' :
                 storageFilter === 'linked' ? '사용 중인 파일이 없습니다.' :
                 '파일이 없습니다.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {filteredStorageFiles.map((file) => (
                <div
                  key={file.id}
                  className={`relative bg-white rounded-lg border overflow-hidden group cursor-pointer transition-all ${
                    file.selected ? 'ring-2 ring-rose-500 border-rose-500' : 'hover:shadow-md'
                  }`}
                  onClick={() => handleStorageSelectFile(file.id)}
                >
                  {/* 이미지 */}
                  <div className="aspect-square bg-gray-100 relative">
                    <img
                      src={file.url}
                      alt={file.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />

                    {/* 체크박스 */}
                    <div className={`absolute top-2 left-2 transition-opacity ${
                      file.selected || storageSelectAll ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                    }`}>
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                        file.selected ? 'bg-rose-500 text-white' : 'bg-white/80 text-gray-400'
                      }`}>
                        <i className={`fa-solid ${file.selected ? 'fa-check' : 'fa-circle'} text-xs`}></i>
                      </div>
                    </div>

                    {/* 연결 상태 배지 */}
                    <div className="absolute top-2 right-2">
                      <span className={`px-2 py-0.5 text-xs rounded-full ${
                        file.isLinked
                          ? 'bg-green-100 text-green-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {file.isLinked ? '사용 중' : '미연결'}
                      </span>
                    </div>

                    {/* 호버 오버레이 */}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <a
                        href={file.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="p-2 bg-white rounded-full text-gray-700 hover:bg-gray-100"
                      >
                        <i className="fa-solid fa-external-link"></i>
                      </a>
                    </div>
                  </div>

                  {/* 파일 정보 */}
                  <div className="p-2">
                    <p className="text-xs text-gray-600 truncate" title={file.name}>
                      {file.name}
                    </p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-gray-400">{formatBytes(file.size)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 안내 */}
          <div className="mt-6 bg-blue-50 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <i className="fa-solid fa-info-circle text-blue-500 mt-0.5"></i>
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">스토리지 정리 안내</p>
                <ul className="list-disc list-inside space-y-1 text-blue-700">
                  <li><strong>미연결</strong>: 블로그 포스트에서 사용되지 않는 이미지 (안전하게 삭제 가능)</li>
                  <li><strong>사용 중</strong>: 현재 발행된 포스트에서 참조 중인 이미지 (삭제 시 주의)</li>
                  <li>임시저장 글의 이미지는 '사용 중'으로 표시됩니다.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 파일 상세 사이드패널 */}
      {selectedFile && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/30" onClick={closeFileDetail} />
          <div className="relative w-96 bg-white h-full shadow-xl flex flex-col">
            {/* 헤더 */}
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h3 className="font-semibold text-gray-800">파일 상세</h3>
              <button
                onClick={closeFileDetail}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            {/* 콘텐츠 */}
            <div className="flex-1 overflow-y-auto p-4">
              {/* 미리보기 */}
              <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden mb-4">
                <img
                  src={selectedFile.file_url}
                  alt={selectedFile.alt_text || selectedFile.original_name}
                  className="w-full h-full object-contain"
                />
              </div>

              {/* 파일 정보 */}
              <div className="space-y-3 text-sm mb-6">
                <div>
                  <span className="text-gray-500">파일명</span>
                  <p className="text-gray-800 break-all">{selectedFile.original_name}</p>
                </div>
                <div className="flex gap-6">
                  <div>
                    <span className="text-gray-500">크기</span>
                    <p className="text-gray-800">{formatBytes(selectedFile.file_size)}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">날짜</span>
                    <p className="text-gray-800">{formatDate(selectedFile.created_at)}</p>
                  </div>
                </div>
              </div>

              {/* 편집 폼 */}
              <div className="space-y-4">
                {/* 카테고리 */}
                <div>
                  <label className="block text-sm text-gray-600 mb-1">카테고리</label>
                  <select
                    value={editingCategory}
                    onChange={(e) => setEditingCategory(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
                  >
                    {categories.map((cat) => (
                      <option key={cat.slug} value={cat.slug}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Alt 텍스트 */}
                <div>
                  <label className="block text-sm text-gray-600 mb-1">대체 텍스트 (alt)</label>
                  <input
                    type="text"
                    value={editingAlt}
                    onChange={(e) => setEditingAlt(e.target.value)}
                    placeholder="이미지 설명..."
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>

                {/* 설명 */}
                <div>
                  <label className="block text-sm text-gray-600 mb-1">설명</label>
                  <textarea
                    value={editingDescription}
                    onChange={(e) => setEditingDescription(e.target.value)}
                    placeholder="파일 설명..."
                    rows={3}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 resize-none"
                  />
                </div>

                {/* 저장 버튼 */}
                <button
                  onClick={updateFileDetails}
                  disabled={saving}
                  className="w-full py-2 bg-rose-500 text-white rounded-lg hover:bg-rose-600 disabled:opacity-50"
                >
                  {saving ? '저장 중...' : '저장'}
                </button>
              </div>

              {/* URL 복사 */}
              <div className="mt-6 pt-6 border-t">
                <label className="block text-sm text-gray-600 mb-2">이미지 URL</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={selectedFile.file_url}
                    readOnly
                    className="flex-1 px-3 py-2 bg-gray-50 border rounded-lg text-sm text-gray-600"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(selectedFile.file_url);
                      alert('URL이 복사되었습니다.');
                    }}
                    className="px-3 py-2 border rounded-lg hover:bg-gray-50"
                  >
                    <i className="fa-solid fa-copy"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 카테고리 관리 모달 */}
      <MediaCategoryManager
        isOpen={showCategoryManager}
        onClose={() => setShowCategoryManager(false)}
        onCategoriesChange={loadCategories}
      />
    </div>
  );
}
