import React, { useState, useCallback } from 'react';
import { WikiTreeNode, WikiPage } from '../types';

interface WikiSidebarProps {
  treeData: WikiTreeNode[];
  selectedPageId: number | null;
  searchKeyword: string;
  searchResults: WikiPage[] | null;
  onSelectPage: (pageId: number) => void;
  onCreatePage: (parentId: number | null) => void;
  onDeletePage: (pageId: number) => void;
  onSearch: (keyword: string) => void;
  loading: boolean;
}

interface TreeNodeProps {
  node: WikiTreeNode;
  level: number;
  selectedPageId: number | null;
  expandedIds: Set<number>;
  onToggle: (id: number) => void;
  onSelect: (id: number) => void;
  onCreateChild: (parentId: number) => void;
  onDelete: (id: number) => void;
}

function TreeNode({ node, level, selectedPageId, expandedIds, onToggle, onSelect, onCreateChild, onDelete }: TreeNodeProps) {
  const hasChildren = node.children.length > 0;
  const isExpanded = expandedIds.has(node.id);
  const isSelected = selectedPageId === node.id;

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    // Simple context menu via prompt
    const action = window.prompt(
      `페이지: ${node.title}\n\n1: 하위 페이지 추가\n2: 삭제\n\n번호를 입력하세요:`,
      ''
    );
    if (action === '1') {
      onCreateChild(node.id);
    } else if (action === '2') {
      onDelete(node.id);
    }
  }, [node, onCreateChild, onDelete]);

  return (
    <div>
      <div
        className={`flex items-center gap-1 px-2 py-1.5 cursor-pointer hover:bg-gray-100 rounded-md group ${
          isSelected ? 'bg-blue-100 text-blue-700' : 'text-gray-700'
        }`}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={() => onSelect(node.id)}
        onContextMenu={handleContextMenu}
      >
        {/* Expand/Collapse button */}
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggle(node.id);
            }}
            className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-600"
          >
            <svg
              className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        ) : (
          <span className="w-5" />
        )}

        {/* Page icon */}
        <span className="text-sm">
          {hasChildren ? (isExpanded ? '📂' : '📁') : '📄'}
        </span>

        {/* Title */}
        <span className="flex-1 text-sm truncate">{node.title}</span>

        {/* Action buttons (on hover) */}
        <div className="hidden group-hover:flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCreateChild(node.id);
            }}
            className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-green-600"
            title="하위 페이지 추가"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(node.id);
            }}
            className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-red-600"
            title="삭제"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div>
          {node.children.map(child => (
            <TreeNode
              key={child.id}
              node={child}
              level={level + 1}
              selectedPageId={selectedPageId}
              expandedIds={expandedIds}
              onToggle={onToggle}
              onSelect={onSelect}
              onCreateChild={onCreateChild}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function WikiSidebar({
  treeData,
  selectedPageId,
  searchKeyword,
  searchResults,
  onSelectPage,
  onCreatePage,
  onDeletePage,
  onSearch,
  loading,
}: WikiSidebarProps) {
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const handleToggle = useCallback((id: number) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleExpandAll = useCallback(() => {
    const allIds = new Set<number>();
    const collectIds = (nodes: WikiTreeNode[]) => {
      nodes.forEach(node => {
        if (node.children.length > 0) {
          allIds.add(node.id);
          collectIds(node.children);
        }
      });
    };
    collectIds(treeData);
    setExpandedIds(allIds);
  }, [treeData]);

  const handleCollapseAll = useCallback(() => {
    setExpandedIds(new Set());
  }, []);

  return (
    <aside className="w-72 bg-white border-r border-gray-200 flex flex-col">
      {/* Search */}
      <div className="p-3 border-b border-gray-200">
        <div className="relative">
          <input
            type="text"
            value={searchKeyword}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="페이지 검색..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <svg
            className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {/* Actions */}
      <div className="px-3 py-2 border-b border-gray-200 flex items-center justify-between">
        <button
          onClick={() => onCreatePage(null)}
          className="flex items-center gap-1 px-2 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          새 페이지
        </button>
        <div className="flex items-center gap-1">
          <button
            onClick={handleExpandAll}
            className="p-1 text-gray-400 hover:text-gray-600"
            title="모두 펼치기"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          </button>
          <button
            onClick={handleCollapseAll}
            className="p-1 text-gray-400 hover:text-gray-600"
            title="모두 접기"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Tree or Search Results */}
      <div className="flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : searchResults ? (
          <div>
            <div className="px-2 py-1 text-xs text-gray-500 mb-2">
              검색 결과: {searchResults.length}건
            </div>
            {searchResults.length === 0 ? (
              <div className="text-center text-gray-400 py-4 text-sm">
                검색 결과가 없습니다.
              </div>
            ) : (
              searchResults.map(page => (
                <div
                  key={page.id}
                  className={`px-3 py-2 cursor-pointer hover:bg-gray-100 rounded-md ${
                    selectedPageId === page.id ? 'bg-blue-100 text-blue-700' : 'text-gray-700'
                  }`}
                  onClick={() => onSelectPage(page.id)}
                >
                  <div className="flex items-center gap-2">
                    <span>📄</span>
                    <span className="text-sm truncate">{page.title}</span>
                  </div>
                  {page.content && (
                    <p className="text-xs text-gray-500 mt-1 truncate pl-6">
                      {page.content.replace(/<[^>]*>/g, '').substring(0, 50)}...
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        ) : treeData.length === 0 ? (
          <div className="text-center text-gray-400 py-8">
            <div className="text-4xl mb-2">📝</div>
            <p className="text-sm">페이지가 없습니다.</p>
            <p className="text-xs mt-1">새 페이지를 만들어보세요.</p>
          </div>
        ) : (
          treeData.map(node => (
            <TreeNode
              key={node.id}
              node={node}
              level={0}
              selectedPageId={selectedPageId}
              expandedIds={expandedIds}
              onToggle={handleToggle}
              onSelect={onSelectPage}
              onCreateChild={onCreatePage}
              onDelete={onDeletePage}
            />
          ))
        )}
      </div>
    </aside>
  );
}

export default WikiSidebar;
