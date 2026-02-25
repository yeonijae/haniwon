/**
 * DiseaseTagInput - 질환명 태그 입력 컴포넌트
 * 기존 태그 자동완성 + 새 태그 자동 등록
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { query, execute, insert } from '@shared/lib/postgres';

interface DiseaseTag {
  id: number;
  name: string;
  category: string | null;
  use_count: number;
}

interface Props {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}

export default function DiseaseTagInput({ value, onChange, placeholder = '질환명 입력 후 Enter' }: Props) {
  const [input, setInput] = useState('');
  const [suggestions, setSuggestions] = useState<DiseaseTag[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const [allTags, setAllTags] = useState<DiseaseTag[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // 전체 태그 로드
  useEffect(() => {
    query<DiseaseTag>('SELECT * FROM disease_tags ORDER BY use_count DESC, name')
      .then(setAllTags)
      .catch(() => {});
  }, []);

  // 외부 클릭 닫기
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // 검색 필터
  useEffect(() => {
    if (!input.trim()) {
      setSuggestions(allTags.filter(t => !value.includes(t.name)).slice(0, 8));
    } else {
      const q = input.toLowerCase();
      setSuggestions(
        allTags
          .filter(t => t.name.toLowerCase().includes(q) && !value.includes(t.name))
          .slice(0, 8)
      );
    }
    setHighlightIdx(-1);
  }, [input, allTags, value]);

  const addTag = useCallback(async (tagName: string) => {
    const trimmed = tagName.trim();
    if (!trimmed || value.includes(trimmed)) return;

    onChange([...value, trimmed]);
    setInput('');
    setShowSuggestions(false);

    // DB에 태그 등록 또는 use_count 증가
    const existing = allTags.find(t => t.name === trimmed);
    if (existing) {
      await execute(`UPDATE disease_tags SET use_count = use_count + 1 WHERE id = ${existing.id}`).catch(() => {});
      setAllTags(prev => prev.map(t => t.id === existing.id ? { ...t, use_count: t.use_count + 1 } : t));
    } else {
      try {
        const newId = await insert(`INSERT INTO disease_tags (name, use_count) VALUES ('${trimmed.replace(/'/g, "''")}', 1)`);
        setAllTags(prev => [...prev, { id: newId, name: trimmed, category: null, use_count: 1 }]);
      } catch {
        // 이미 존재하면 무시
      }
    }
  }, [value, onChange, allTags]);

  const removeTag = (tag: string) => {
    onChange(value.filter(t => t !== tag));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (highlightIdx >= 0 && suggestions[highlightIdx]) {
        addTag(suggestions[highlightIdx].name);
      } else if (input.trim()) {
        addTag(input);
      }
    } else if (e.key === 'Backspace' && !input && value.length > 0) {
      removeTag(value[value.length - 1]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIdx(prev => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIdx(prev => Math.max(prev - 1, -1));
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <div
        style={{
          display: 'flex', flexWrap: 'wrap', gap: 6, padding: '8px 12px',
          border: '1px solid #d1d5db', borderRadius: 8, background: 'white',
          minHeight: 42, alignItems: 'center', cursor: 'text',
        }}
        onClick={() => inputRef.current?.focus()}
      >
        {value.map(tag => {
          const isExisting = allTags.some(t => t.name === tag);
          return (
            <span
              key={tag}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '3px 10px', borderRadius: 6, fontSize: 13, fontWeight: 600,
                background: isExisting ? '#dcfce7' : '#dbeafe',
                color: isExisting ? '#16a34a' : '#2563eb',
              }}
            >
              {tag}
              <button
                onClick={(e) => { e.stopPropagation(); removeTag(tag); }}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'inherit', fontSize: 14, lineHeight: 1, padding: 0, marginLeft: 2,
                }}
              >×</button>
            </span>
          );
        })}
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => { setInput(e.target.value); setShowSuggestions(true); }}
          onFocus={() => setShowSuggestions(true)}
          onKeyDown={handleKeyDown}
          placeholder={value.length === 0 ? placeholder : ''}
          style={{
            flex: 1, minWidth: 100, border: 'none', outline: 'none',
            fontSize: 14, background: 'transparent',
          }}
        />
      </div>

      {/* 자동완성 드롭다운 */}
      {showSuggestions && suggestions.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
          background: 'white', border: '1px solid #e5e7eb', borderRadius: 8,
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 100, maxHeight: 200, overflowY: 'auto',
        }}>
          {suggestions.map((tag, idx) => (
            <div
              key={tag.id}
              onClick={() => addTag(tag.name)}
              style={{
                padding: '8px 14px', cursor: 'pointer', fontSize: 13,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: idx === highlightIdx ? '#f3f4f6' : 'transparent',
              }}
              onMouseEnter={() => setHighlightIdx(idx)}
            >
              <span style={{ fontWeight: 500 }}>{tag.name}</span>
              <span style={{ fontSize: 11, color: '#9ca3af' }}>{tag.use_count}회</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
