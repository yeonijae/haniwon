/**
 * 스토리지 관리 페이지
 * - 미연결 이미지 조회 및 삭제
 * - 스토리지 용량 확인
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

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

function StorageManagement() {
  const [files, setFiles] = useState<StorageFile[]>([]);
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unlinked' | 'linked'>('unlinked');
  const [selectAll, setSelectAll] = useState(false);

  useEffect(() => {
    loadStorageData();
  }, []);

  async function loadStorageData() {
    setLoading(true);
    try {
      // 1. Storage에서 모든 파일 목록 가져오기
      const { data: storageFiles, error: storageError } = await supabase
        .storage
        .from('blog-images')
        .list('posts', {
          limit: 1000,
          sortBy: { column: 'created_at', order: 'desc' },
        });

      if (storageError) throw storageError;

      // 2. 블로그 포스트에서 사용중인 이미지 URL 가져오기
      const { data: posts, error: postsError } = await supabase
        .from('blog_posts')
        .select('content, thumbnail_url');

      if (postsError) throw postsError;

      // 사용중인 이미지 URL 추출
      const usedUrls = new Set<string>();
      posts?.forEach((post) => {
        // 썸네일
        if (post.thumbnail_url) {
          usedUrls.add(post.thumbnail_url);
        }
        // 본문 내 이미지 (src="..." 패턴)
        const imgMatches = post.content?.match(/src="([^"]+)"/g) || [];
        imgMatches.forEach((match: string) => {
          const url = match.replace('src="', '').replace('"', '');
          usedUrls.add(url);
        });
      });

      // 3. 파일 목록 생성
      const fileList: StorageFile[] = (storageFiles || [])
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

      setFiles(fileList);

      // 4. 통계 계산
      const totalSize = fileList.reduce((sum, f) => sum + f.size, 0);
      const linkedFiles = fileList.filter((f) => f.isLinked);
      const unlinkedFiles = fileList.filter((f) => !f.isLinked);
      const unlinkedSize = unlinkedFiles.reduce((sum, f) => sum + f.size, 0);

      setStats({
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
      setLoading(false);
    }
  }

  function formatBytes(bytes: number) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  function formatDate(dateStr: string) {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function handleSelectAll() {
    const newSelectAll = !selectAll;
    setSelectAll(newSelectAll);
    setFiles((prev) =>
      prev.map((f) => ({
        ...f,
        selected: filter === 'all' ? newSelectAll :
                  filter === 'unlinked' ? (!f.isLinked && newSelectAll) :
                  (f.isLinked && newSelectAll),
      }))
    );
  }

  function handleSelectFile(id: string) {
    setFiles((prev) =>
      prev.map((f) =>
        f.id === id ? { ...f, selected: !f.selected } : f
      )
    );
  }

  async function handleDeleteSelected() {
    const selectedFiles = files.filter((f) => f.selected);
    if (selectedFiles.length === 0) {
      alert('삭제할 파일을 선택해주세요.');
      return;
    }

    const linkedSelected = selectedFiles.filter((f) => f.isLinked);
    if (linkedSelected.length > 0) {
      const confirmLinked = confirm(
        `선택한 파일 중 ${linkedSelected.length}개가 현재 포스트에서 사용 중입니다.\n정말 삭제하시겠습니까?`
      );
      if (!confirmLinked) return;
    } else {
      const confirmDelete = confirm(
        `${selectedFiles.length}개의 파일을 삭제하시겠습니까?\n이 작업은 취소할 수 없습니다.`
      );
      if (!confirmDelete) return;
    }

    setDeleting(true);
    try {
      const filesToDelete = selectedFiles.map((f) => `posts/${f.name}`);

      const { error } = await supabase.storage
        .from('blog-images')
        .remove(filesToDelete);

      if (error) throw error;

      alert(`${selectedFiles.length}개의 파일이 삭제되었습니다.`);
      setSelectAll(false);
      await loadStorageData();
    } catch (error) {
      console.error('Delete failed:', error);
      alert('파일 삭제에 실패했습니다.');
    } finally {
      setDeleting(false);
    }
  }

  async function handleDeleteAllUnlinked() {
    const unlinkedFiles = files.filter((f) => !f.isLinked);
    if (unlinkedFiles.length === 0) {
      alert('삭제할 미연결 파일이 없습니다.');
      return;
    }

    const confirmDelete = confirm(
      `미연결 파일 ${unlinkedFiles.length}개 (${formatBytes(stats?.unlinkedSize || 0)})를 모두 삭제하시겠습니까?\n이 작업은 취소할 수 없습니다.`
    );
    if (!confirmDelete) return;

    setDeleting(true);
    try {
      const filesToDelete = unlinkedFiles.map((f) => `posts/${f.name}`);

      const { error } = await supabase.storage
        .from('blog-images')
        .remove(filesToDelete);

      if (error) throw error;

      alert(`${unlinkedFiles.length}개의 미연결 파일이 삭제되었습니다.`);
      await loadStorageData();
    } catch (error) {
      console.error('Delete failed:', error);
      alert('파일 삭제에 실패했습니다.');
    } finally {
      setDeleting(false);
    }
  }

  const filteredFiles = files.filter((f) => {
    if (filter === 'unlinked') return !f.isLinked;
    if (filter === 'linked') return f.isLinked;
    return true;
  });

  const selectedCount = files.filter((f) => f.selected).length;
  const selectedSize = files.filter((f) => f.selected).reduce((sum, f) => sum + f.size, 0);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-500 mx-auto mb-4"></div>
          <p className="text-gray-500">스토리지 데이터 로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* 헤더 */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">스토리지 관리</h2>
          <p className="text-gray-600 mt-1">
            업로드된 이미지 파일을 관리하고 미사용 파일을 정리합니다.
          </p>
        </div>
        <button
          onClick={loadStorageData}
          className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <i className="fa-solid fa-refresh mr-2"></i>
          새로고침
        </button>
      </div>

      {/* 통계 카드 */}
      {stats && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <i className="fa-solid fa-images text-blue-600"></i>
              </div>
              <div>
                <p className="text-sm text-gray-500">전체 파일</p>
                <p className="text-xl font-bold text-gray-900">{stats.totalFiles}개</p>
                <p className="text-xs text-gray-400">{formatBytes(stats.totalSize)}</p>
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
                <p className="text-xl font-bold text-green-600">{stats.linkedFiles}개</p>
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
                <p className="text-xl font-bold text-yellow-600">{stats.unlinkedFiles}개</p>
                <p className="text-xs text-gray-400">{formatBytes(stats.unlinkedSize)}</p>
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
                  disabled={deleting || stats.unlinkedFiles === 0}
                  className="text-sm text-rose-600 hover:text-rose-700 font-medium disabled:opacity-50"
                >
                  {formatBytes(stats.unlinkedSize)} 정리
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
                onClick={() => setFilter('unlinked')}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  filter === 'unlinked'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                미연결 ({stats?.unlinkedFiles || 0})
              </button>
              <button
                onClick={() => setFilter('linked')}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  filter === 'linked'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                사용 중 ({stats?.linkedFiles || 0})
              </button>
              <button
                onClick={() => setFilter('all')}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  filter === 'all'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                전체 ({stats?.totalFiles || 0})
              </button>
            </div>

            {/* 전체 선택 */}
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={selectAll}
                onChange={handleSelectAll}
                className="w-4 h-4 rounded border-gray-300 text-rose-500 focus:ring-rose-500"
              />
              전체 선택
            </label>
          </div>

          {/* 선택 삭제 */}
          {selectedCount > 0 && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600">
                {selectedCount}개 선택됨 ({formatBytes(selectedSize)})
              </span>
              <button
                onClick={handleDeleteSelected}
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
      {filteredFiles.length === 0 ? (
        <div className="bg-white rounded-lg border p-12 text-center">
          <i className="fa-solid fa-folder-open text-4xl text-gray-300 mb-4"></i>
          <p className="text-gray-500">
            {filter === 'unlinked' ? '미연결 파일이 없습니다.' :
             filter === 'linked' ? '사용 중인 파일이 없습니다.' :
             '파일이 없습니다.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {filteredFiles.map((file) => (
            <div
              key={file.id}
              className={`relative bg-white rounded-lg border overflow-hidden group cursor-pointer transition-all ${
                file.selected ? 'ring-2 ring-rose-500 border-rose-500' : 'hover:shadow-md'
              }`}
              onClick={() => handleSelectFile(file.id)}
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
                  file.selected || selectAll ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
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
                  <span className="text-xs text-gray-400">{formatDate(file.createdAt).split(' ')[0]}</span>
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
  );
}

export default StorageManagement;
