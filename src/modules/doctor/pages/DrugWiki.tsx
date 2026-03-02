import { useState, useEffect, useCallback, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const POSTGRES_API = import.meta.env.VITE_POSTGRES_API_URL || 'http://192.168.0.173:5200';

interface DrugEntry {
  name: string;
  category: string;
  filename: string;
  modified: string;
  matches?: string[];
}

interface DrugDetail {
  name: string;
  category: string;
  content: string;
  modified: string;
}

type CategoryFilter = '전체' | '기전' | '약물';

export default function DrugWiki() {
  const [drugs, setDrugs] = useState<DrugEntry[]>([]);
  const [selected, setSelected] = useState<DrugDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('전체');
  const [showNewModal, setShowNewModal] = useState(false);
  const [newDrugName, setNewDrugName] = useState('');
  const [creating, setCreating] = useState(false);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch drug list or search results
  useEffect(() => {
    const load = async () => {
      try {
        let url: string;
        if (debouncedQuery) {
          url = `${POSTGRES_API}/api/wiki/drugs/search?q=${encodeURIComponent(debouncedQuery)}`;
        } else {
          url = `${POSTGRES_API}/api/wiki/drugs`;
        }
        const res = await fetch(url);
        const data = await res.json();
        setDrugs(data);
      } catch (e) {
        console.error('약물 목록 로드 실패:', e);
      }
    };
    load();
  }, [debouncedQuery]);

  const filteredDrugs = useMemo(() => {
    if (categoryFilter === '전체') return drugs;
    return drugs.filter(d => d.category === categoryFilter);
  }, [drugs, categoryFilter]);

  const selectDrug = useCallback(async (name: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${POSTGRES_API}/api/wiki/drugs/${encodeURIComponent(name)}`);
      const data = await res.json();
      setSelected(data);
    } catch (e) {
      console.error('문서 로드 실패:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleCreateDrug = async () => {
    if (!newDrugName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch(`${POSTGRES_API}/api/wiki/drugs/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newDrugName.trim(), category: '약물' }),
      });
      const data = await res.json();
      if (data.success) {
        setShowNewModal(false);
        setNewDrugName('');
        setDebouncedQuery('');
        setSearchQuery('');
        // Refresh list
        const listRes = await fetch(`${POSTGRES_API}/api/wiki/drugs`);
        setDrugs(await listRes.json());
        // Select the new drug
        selectDrug(data.name);
      } else {
        alert(data.error || '등록 실패');
      }
    } catch (e) {
      console.error('등록 실패:', e);
      alert('등록 중 오류가 발생했습니다.');
    } finally {
      setCreating(false);
    }
  };

  const categories: CategoryFilter[] = ['전체', '기전', '약물'];

  return (
    <div className="flex h-full" style={{ height: 'calc(100vh - 120px)' }}>
      {/* Left panel - list */}
      <div className="flex flex-col border-r border-gray-200 bg-white" style={{ width: 320, minWidth: 320 }}>
        {/* Search */}
        <div className="p-3 border-b border-gray-200">
          <div className="relative">
            <input
              type="text"
              placeholder="약물 검색..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 pl-9 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <span className="absolute left-3 top-2.5 text-gray-400 text-sm">🔍</span>
          </div>
        </div>

        {/* Category filter tabs */}
        <div className="flex border-b border-gray-200">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${
                categoryFilter === cat
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* New drug button */}
        <div className="p-2 border-b border-gray-100">
          <button
            onClick={() => setShowNewModal(true)}
            className="w-full py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          >
            ➕ 신규 약물 등록
          </button>
        </div>

        {/* Drug list */}
        <div className="flex-1 overflow-y-auto">
          {filteredDrugs.length === 0 ? (
            <div className="p-4 text-center text-gray-400 text-sm">
              {debouncedQuery ? '검색 결과가 없습니다' : '문서가 없습니다'}
            </div>
          ) : (
            filteredDrugs.map(drug => (
              <button
                key={`${drug.category}-${drug.name}`}
                onClick={() => selectDrug(drug.name)}
                className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${
                  selected?.name === drug.name ? 'bg-blue-50 border-l-3 border-l-blue-500' : ''
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                    {drug.category}
                  </span>
                  <span className="text-sm font-medium text-gray-800 truncate">{drug.name}</span>
                </div>
                {drug.matches && drug.matches.length > 0 && (
                  <div className="mt-1 text-xs text-gray-400 truncate">
                    ...{drug.matches[0]}...
                  </div>
                )}
              </button>
            ))
          )}
        </div>

        <div className="p-2 border-t border-gray-200 text-xs text-gray-400 text-center">
          {filteredDrugs.length}개 문서
        </div>
      </div>

      {/* Right panel - viewer */}
      <div className="flex-1 overflow-y-auto bg-white">
        {loading ? (
          <div className="flex items-center justify-center h-full text-gray-400">
            로딩 중...
          </div>
        ) : selected ? (
          <div className="max-w-4xl mx-auto p-8">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-600 font-medium">
                {selected.category}
              </span>
              <span className="text-xs text-gray-400">
                {new Date(selected.modified).toLocaleDateString('ko-KR')}
              </span>
            </div>
            <article className="drug-wiki-content">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {selected.content}
              </ReactMarkdown>
            </article>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <span className="text-4xl mb-3">📖</span>
            <span className="text-sm">왼쪽 목록에서 문서를 선택하세요</span>
          </div>
        )}
      </div>

      {/* New drug modal */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-96">
            <h3 className="text-lg font-semibold mb-4">📖 신규 약물 등록</h3>
            <input
              type="text"
              placeholder="약물명을 입력하세요"
              value={newDrugName}
              onChange={e => setNewDrugName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreateDrug()}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 mb-4"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setShowNewModal(false); setNewDrugName(''); }}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                취소
              </button>
              <button
                onClick={handleCreateDrug}
                disabled={creating || !newDrugName.trim()}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {creating ? '생성 중...' : '등록'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
