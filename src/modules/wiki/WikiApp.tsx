import React, { useState, useCallback, useEffect } from 'react';
import { useDocumentTitle } from '@shared/hooks/useDocumentTitle';
import type { PortalUser } from '@shared/types';
import { WikiPage, WikiTreeNode } from './types';
import * as api from './lib/api';
import WikiSidebar from './components/WikiSidebar';
import WikiEditor from './components/WikiEditor';
import './styles/wiki.css';

interface WikiAppProps {
  user: PortalUser;
}

function WikiApp({ user }: WikiAppProps) {
  useDocumentTitle('위키');
  const [pages, setPages] = useState<WikiPage[]>([]);
  const [treeData, setTreeData] = useState<WikiTreeNode[]>([]);
  const [selectedPageId, setSelectedPageId] = useState<number | null>(null);
  const [selectedPage, setSelectedPage] = useState<WikiPage | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchResults, setSearchResults] = useState<WikiPage[] | null>(null);

  // Load all pages
  const loadPages = useCallback(async () => {
    try {
      setLoading(true);
      const allPages = await api.fetchAllPages();
      setPages(allPages);
      setTreeData(api.buildPageTree(allPages));
    } catch (error) {
      console.error('페이지 로드 오류:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load selected page
  const loadSelectedPage = useCallback(async (pageId: number) => {
    try {
      const page = await api.fetchPage(pageId);
      setSelectedPage(page);
    } catch (error) {
      console.error('페이지 로드 오류:', error);
    }
  }, []);

  useEffect(() => {
    loadPages();
  }, [loadPages]);

  useEffect(() => {
    if (selectedPageId) {
      loadSelectedPage(selectedPageId);
      setIsEditing(false);
    } else {
      setSelectedPage(null);
    }
  }, [selectedPageId, loadSelectedPage]);

  // Handlers
  const handleSelectPage = useCallback((pageId: number) => {
    setSelectedPageId(pageId);
    setSearchResults(null);
    setSearchKeyword('');
  }, []);

  const handleCreatePage = useCallback(async (parentId: number | null) => {
    try {
      const newPage = await api.createPage({
        title: '새 페이지',
        content: '',
        parent_id: parentId,
        display_order: pages.filter(p => p.parent_id === parentId).length,
        created_by: user.name,
        updated_by: user.name,
      });
      await loadPages();
      setSelectedPageId(newPage.id);
      setIsEditing(true);
    } catch (error) {
      console.error('페이지 생성 오류:', error);
      alert('페이지 생성에 실패했습니다.');
    }
  }, [pages, user.name, loadPages]);

  const handleUpdatePage = useCallback(async (pageId: number, data: Partial<WikiPage>) => {
    try {
      await api.updatePage(pageId, {
        ...data,
        updated_by: user.name,
      });
      await loadPages();
      await loadSelectedPage(pageId);
      setIsEditing(false);
    } catch (error) {
      console.error('페이지 수정 오류:', error);
      alert('페이지 수정에 실패했습니다.');
    }
  }, [user.name, loadPages, loadSelectedPage]);

  const handleDeletePage = useCallback(async (pageId: number) => {
    if (!confirm('이 페이지를 삭제하시겠습니까?\n하위 페이지는 최상위로 이동됩니다.')) return;

    try {
      await api.deletePage(pageId);
      await loadPages();
      if (selectedPageId === pageId) {
        setSelectedPageId(null);
        setSelectedPage(null);
      }
    } catch (error) {
      console.error('페이지 삭제 오류:', error);
      alert('페이지 삭제에 실패했습니다.');
    }
  }, [selectedPageId, loadPages]);

  const handleSearch = useCallback(async (keyword: string) => {
    setSearchKeyword(keyword);
    if (!keyword.trim()) {
      setSearchResults(null);
      return;
    }
    try {
      const results = await api.searchPages(keyword);
      setSearchResults(results);
    } catch (error) {
      console.error('검색 오류:', error);
    }
  }, []);

  const handleImageUpload = useCallback(async (file: File): Promise<string> => {
    if (!selectedPageId) throw new Error('페이지를 먼저 선택하세요.');

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64 = reader.result as string;
          const image = await api.uploadImage(selectedPageId, file.name, base64, file.type);
          // Return inline data URL for immediate display
          resolve(`data:${image.mime_type};base64,${image.data}`);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }, [selectedPageId]);

  return (
    <div className="wiki-app h-screen flex bg-gray-50">
      {/* Sidebar */}
      <WikiSidebar
        treeData={treeData}
        selectedPageId={selectedPageId}
        searchKeyword={searchKeyword}
        searchResults={searchResults}
        onSelectPage={handleSelectPage}
        onCreatePage={handleCreatePage}
        onDeletePage={handleDeletePage}
        onSearch={handleSearch}
        loading={loading}
      />

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📖</span>
            <div>
              <h1 className="text-lg font-bold text-gray-800">운영매뉴얼</h1>
              <p className="text-xs text-gray-500">한의원 운영 위키</p>
            </div>
          </div>
          {selectedPage && (
            <div className="flex items-center gap-2">
              {isEditing ? (
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
                >
                  취소
                </button>
              ) : (
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  편집
                </button>
              )}
            </div>
          )}
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-gray-500">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                <p>로딩 중...</p>
              </div>
            </div>
          ) : selectedPage ? (
            <WikiEditor
              page={selectedPage}
              isEditing={isEditing}
              onSave={(data) => handleUpdatePage(selectedPage.id, data)}
              onCancel={() => setIsEditing(false)}
              onImageUpload={handleImageUpload}
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-gray-400">
                <div className="text-6xl mb-4">📖</div>
                <p className="text-lg font-medium">위키 페이지를 선택하세요</p>
                <p className="text-sm mt-2">왼쪽 사이드바에서 페이지를 선택하거나<br />새 페이지를 만들 수 있습니다.</p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default WikiApp;
