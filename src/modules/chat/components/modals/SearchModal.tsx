import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

interface SearchResult {
  id: string;
  channel_id: string;
  channel_name: string | null;
  channel_type: 'direct' | 'group' | 'topic';
  content: string;
  created_at: string;
  sender: {
    id: string;
    display_name: string;
    avatar_url: string | null;
    avatar_color: string | null;
  };
}

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMessage: (channelId: string, messageId: string) => void;
  currentChannelId?: string;
}

export default function SearchModal({ isOpen, onClose, onSelectMessage, currentChannelId }: SearchModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchScope, setSearchScope] = useState<'all' | 'channel'>('all');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setSearchQuery('');
      setDebouncedQuery('');
    }
  }, [isOpen]);

  // Search query
  const { data: results = [], isLoading } = useQuery<SearchResult[]>({
    queryKey: ['messageSearch', debouncedQuery, searchScope, currentChannelId],
    queryFn: async () => {
      if (!debouncedQuery.trim()) return [];
      const params = new URLSearchParams({ q: debouncedQuery });
      if (searchScope === 'channel' && currentChannelId) {
        params.append('channel_id', currentChannelId);
      }
      const response = await api.get(`/messages/search?${params}`);
      return response.data.data;
    },
    enabled: debouncedQuery.length >= 2,
  });

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSelectResult = (result: SearchResult) => {
    onSelectMessage(result.channel_id, result.id);
    onClose();
  };

  const highlightMatch = (text: string, query: string) => {
    if (!query.trim()) return text;
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? <mark key={i} className="bg-yellow-200 px-0.5 rounded">{part}</mark> : part
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center pt-20 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[70vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="메시지 검색..."
              className="flex-1 text-lg outline-none"
            />
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Search scope toggle */}
          {currentChannelId && (
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => setSearchScope('all')}
                className={`px-3 py-1 text-sm rounded-full ${
                  searchScope === 'all'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                전체 검색
              </button>
              <button
                onClick={() => setSearchScope('channel')}
                className={`px-3 py-1 text-sm rounded-full ${
                  searchScope === 'channel'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                현재 채널만
              </button>
            </div>
          )}
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto">
          {isLoading && (
            <div className="p-4 text-center text-gray-500">검색 중...</div>
          )}

          {!isLoading && debouncedQuery.length < 2 && (
            <div className="p-4 text-center text-gray-500">
              2글자 이상 입력하세요
            </div>
          )}

          {!isLoading && debouncedQuery.length >= 2 && results.length === 0 && (
            <div className="p-4 text-center text-gray-500">
              검색 결과가 없습니다
            </div>
          )}

          {results.length > 0 && (
            <ul className="divide-y">
              {results.map((result) => (
                <li key={result.id}>
                  <button
                    onClick={() => handleSelectResult(result)}
                    className="w-full px-4 py-3 hover:bg-gray-50 text-left"
                  >
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                        {result.channel_type === 'direct' ? '@' : '#'}
                        {result.channel_name || (result.channel_type === 'direct' ? result.sender?.display_name : '채널')}
                      </span>
                      <span className="font-medium text-sm text-gray-900">
                        {result.sender?.display_name || '알 수 없음'}
                      </span>
                      <span className="text-xs text-gray-500">
                        {format(new Date(result.created_at), 'yyyy.MM.dd a h:mm', { locale: ko })}
                      </span>
                    </div>
                    <div className="text-sm text-gray-700 line-clamp-2">
                      {highlightMatch(result.content.replace(/<[^>]*>/g, ''), searchQuery)}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t bg-gray-50 text-xs text-gray-500 text-center">
          Esc로 닫기 · Enter로 선택
        </div>
      </div>
    </div>
  );
}
