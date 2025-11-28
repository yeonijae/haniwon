/**
 * 안내페이지 관리 - HTML 기반 에디터 + 미리보기
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { ContentStatus } from '../types';
import {
  CONTENT_STATUS_LABELS,
  CONTENT_STATUS_COLORS,
} from '../types';
import HtmlCodeEditor, { type HtmlCodeEditorRef } from '../components/HtmlCodeEditor';
import MediaLibraryModal from '../components/MediaLibraryModal';
import { supabase } from '@shared/lib/supabase';

// DB에서 가져온 카테고리 타입
interface GuideCategoryDB {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

// DB에서 가져온 안내페이지 타입
interface GuidePageDB {
  id: string;
  title: string;
  slug: string;
  content: string | null;
  excerpt: string | null;
  category: string;
  status: ContentStatus;
  short_url: string | null;
  version: number;
  target_audience: string | null;
  views: number;
  clicks: number;
  conversions: number;
  tracking_enabled: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

type ViewMode = 'list' | 'edit';
type EditMode = 'code' | 'preview' | 'split';

interface GuideForm {
  id?: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  category: string;
  status: ContentStatus;
  shortUrl: string;
}

const defaultForm: GuideForm = {
  title: '',
  slug: '',
  content: `<!DOCTYPE html>
<html>
<head>
  <style>
    .guide-content {
      font-family: 'Pretendard', sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
    }
    .guide-content h1 {
      color: #1f2937;
      font-size: 24px;
      margin-bottom: 16px;
    }
    .guide-content h2 {
      color: #374151;
      font-size: 20px;
      margin-top: 24px;
      margin-bottom: 12px;
    }
    .guide-content p {
      color: #4b5563;
      line-height: 1.7;
      margin-bottom: 12px;
    }
    .guide-content ul, .guide-content ol {
      margin: 12px 0;
      padding-left: 24px;
    }
    .guide-content li {
      margin-bottom: 8px;
    }
  </style>
</head>
<body>
  <div class="guide-content">
    <h1>제목을 입력하세요</h1>
    <p>내용을 입력하세요.</p>
  </div>
</body>
</html>`,
  excerpt: '',
  category: 'visit',
  status: 'draft',
  shortUrl: '',
};

// HTML 템플릿
const htmlTemplates = [
  {
    name: '기본 안내',
    content: `<!DOCTYPE html>
<html>
<head>
  <style>
    .guide-content { font-family: 'Pretendard', sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    .guide-content h1 { color: #1f2937; font-size: 28px; margin-bottom: 20px; border-bottom: 2px solid #e5e7eb; padding-bottom: 12px; }
    .guide-content h2 { color: #374151; font-size: 20px; margin-top: 28px; margin-bottom: 12px; }
    .guide-content p { color: #4b5563; line-height: 1.8; margin-bottom: 14px; }
    .guide-content ul, .guide-content ol { margin: 14px 0; padding-left: 24px; }
    .guide-content li { margin-bottom: 10px; line-height: 1.6; }
    .highlight-box { background: #f0fdf4; border-left: 4px solid #22c55e; padding: 16px; margin: 20px 0; border-radius: 4px; }
    .warning-box { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 20px 0; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="guide-content">
    <h1>안내 제목</h1>
    <p>여기에 안내 내용을 작성하세요.</p>

    <h2>주요 안내사항</h2>
    <ul>
      <li>항목 1</li>
      <li>항목 2</li>
      <li>항목 3</li>
    </ul>

    <div class="highlight-box">
      <strong>💡 알려드립니다</strong>
      <p>중요한 안내사항을 여기에 작성하세요.</p>
    </div>
  </div>
</body>
</html>`,
  },
  {
    name: '복약 안내',
    content: `<!DOCTYPE html>
<html>
<head>
  <style>
    .guide-content { font-family: 'Pretendard', sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    .guide-content h1 { color: #166534; font-size: 28px; margin-bottom: 20px; }
    .guide-content h2 { color: #374151; font-size: 20px; margin-top: 28px; margin-bottom: 12px; }
    .guide-content p { color: #4b5563; line-height: 1.8; margin-bottom: 14px; }
    .med-card { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; margin: 16px 0; }
    .med-card h3 { color: #166534; font-size: 18px; margin-bottom: 12px; }
    .time-badge { display: inline-block; background: #dcfce7; color: #166534; padding: 4px 12px; border-radius: 20px; font-size: 14px; font-weight: 600; margin-right: 8px; }
    .warning-text { color: #dc2626; font-weight: 600; }
    .tip-box { background: #eff6ff; border-radius: 8px; padding: 16px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="guide-content">
    <h1>🌿 한약 복용 안내</h1>

    <div class="med-card">
      <h3>복용 시간</h3>
      <p>
        <span class="time-badge">아침</span>
        <span class="time-badge">점심</span>
        <span class="time-badge">저녁</span>
        식후 30분
      </p>
    </div>

    <h2>복용 방법</h2>
    <ul>
      <li>미지근한 물로 복용하세요.</li>
      <li>한 포를 한 번에 복용하세요.</li>
      <li>정해진 시간에 규칙적으로 복용하세요.</li>
    </ul>

    <h2>주의사항</h2>
    <ul>
      <li><span class="warning-text">⚠️ 냉장 보관</span>하세요.</li>
      <li>음주는 피해주세요.</li>
      <li>다른 약과 30분 이상 간격을 두세요.</li>
    </ul>

    <div class="tip-box">
      <strong>💡 Tip</strong>
      <p>한약을 데워서 드시면 더 좋습니다. 전자레인지에 30초 정도 데워주세요.</p>
    </div>
  </div>
</body>
</html>`,
  },
  {
    name: '방문 안내',
    content: `<!DOCTYPE html>
<html>
<head>
  <style>
    .guide-content { font-family: 'Pretendard', sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    .guide-content h1 { color: #1f2937; font-size: 28px; margin-bottom: 24px; text-align: center; }
    .step-container { display: flex; flex-direction: column; gap: 16px; }
    .step-item { display: flex; align-items: flex-start; gap: 16px; padding: 16px; background: #f9fafb; border-radius: 12px; }
    .step-number { width: 36px; height: 36px; background: #22c55e; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; flex-shrink: 0; }
    .step-content h3 { color: #1f2937; font-size: 16px; margin-bottom: 4px; }
    .step-content p { color: #6b7280; font-size: 14px; margin: 0; }
    .info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-top: 24px; }
    .info-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; text-align: center; }
    .info-card i { font-size: 24px; color: #22c55e; margin-bottom: 8px; }
    .info-card h4 { font-size: 14px; color: #374151; margin-bottom: 4px; }
    .info-card p { font-size: 16px; color: #1f2937; font-weight: 600; margin: 0; }
  </style>
</head>
<body>
  <div class="guide-content">
    <h1>🏥 연이재한의원 방문 안내</h1>

    <h2 style="color: #374151; margin-bottom: 16px;">진료 순서</h2>
    <div class="step-container">
      <div class="step-item">
        <div class="step-number">1</div>
        <div class="step-content">
          <h3>접수</h3>
          <p>신분증과 의료보험증을 제시해주세요.</p>
        </div>
      </div>
      <div class="step-item">
        <div class="step-number">2</div>
        <div class="step-content">
          <h3>문진표 작성</h3>
          <p>증상과 병력을 상세히 작성해주세요.</p>
        </div>
      </div>
      <div class="step-item">
        <div class="step-number">3</div>
        <div class="step-content">
          <h3>진료</h3>
          <p>원장님과 상담 및 진료를 받으세요.</p>
        </div>
      </div>
      <div class="step-item">
        <div class="step-number">4</div>
        <div class="step-content">
          <h3>치료 및 수납</h3>
          <p>필요한 치료 후 수납하세요.</p>
        </div>
      </div>
    </div>

    <div class="info-grid">
      <div class="info-card">
        <div>📞</div>
        <h4>전화번호</h4>
        <p>02-1234-5678</p>
      </div>
      <div class="info-card">
        <div>🕐</div>
        <h4>진료시간</h4>
        <p>월-금 9:00-18:00</p>
      </div>
    </div>
  </div>
</body>
</html>`,
  },
];

function GuideManagement() {
  const [guides, setGuides] = useState<GuidePageDB[]>([]);
  const [categories, setCategories] = useState<GuideCategoryDB[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [editMode, setEditMode] = useState<EditMode>('split');
  const [filterStatus, setFilterStatus] = useState<ContentStatus | ''>('');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [form, setForm] = useState<GuideForm>(defaultForm);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showMediaLibrary, setShowMediaLibrary] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [categoryForm, setCategoryForm] = useState({ id: '', name: '', slug: '', description: '' });
  const [categoryLoading, setCategoryLoading] = useState(false);
  const editorRef = useRef<HtmlCodeEditorRef>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // DB에서 카테고리 목록 로드
  const loadCategories = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('guide_categories')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) {
        console.error('카테고리 로드 실패:', error);
        return;
      }

      setCategories(data || []);
    } catch (err) {
      console.error('카테고리 로드 오류:', err);
    }
  }, []);

  // DB에서 안내페이지 목록 로드
  const loadGuides = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('guide_pages')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('안내페이지 로드 실패:', error);
        alert('안내페이지 목록을 불러오는데 실패했습니다.');
        return;
      }

      setGuides(data || []);
    } catch (err) {
      console.error('안내페이지 로드 오류:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // 초기 로드
  useEffect(() => {
    loadCategories();
    loadGuides();
  }, [loadCategories, loadGuides]);

  // 카테고리 이름 가져오기
  const getCategoryName = (slug: string) => {
    const cat = categories.find(c => c.slug === slug);
    return cat?.name || slug;
  };

  const filteredGuides = guides.filter((guide) => {
    if (filterStatus && guide.status !== filterStatus) return false;
    if (filterCategory && guide.category !== filterCategory) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      if (!guide.title.toLowerCase().includes(term)) return false;
    }
    return true;
  });

  const stats = {
    total: guides.length,
    published: guides.filter((g) => g.status === 'published').length,
    totalViews: guides.reduce((sum, g) => sum + g.views, 0),
  };

  // iframe 미리보기 업데이트
  useEffect(() => {
    if (iframeRef.current && (editMode === 'preview' || editMode === 'split')) {
      const iframe = iframeRef.current;
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(form.content);
        doc.close();
      }
    }
  }, [form.content, editMode]);

  function formatDate(dateStr: string) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  function handleNew() {
    setForm(defaultForm);
    setViewMode('edit');
    setEditMode('split');
  }

  function handleEdit(guide: GuidePageDB) {
    setForm({
      id: guide.id,
      title: guide.title,
      slug: guide.slug,
      content: guide.content || '',
      excerpt: guide.excerpt || '',
      category: guide.category,
      status: guide.status,
      shortUrl: guide.short_url || '',
    });
    setViewMode('edit');
    setEditMode('split');
  }

  async function handleSave() {
    if (!form.title.trim()) {
      alert('제목을 입력해주세요.');
      return;
    }

    // slug 자동 생성 (없으면 제목에서 생성)
    const slug = form.slug.trim() || form.title.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9가-힣-]/g, '');

    // 단축URL 자동 생성 (비어있으면 slug 기반으로 생성)
    const shortUrl = form.shortUrl.trim() || `/g/${slug}`;

    setSaving(true);
    try {
      if (form.id) {
        // 기존 페이지 수정
        const { error } = await supabase
          .from('guide_pages')
          .update({
            title: form.title,
            slug,
            content: form.content,
            excerpt: form.excerpt,
            category: form.category,
            status: form.status,
            short_url: shortUrl,
            published_at: form.status === 'published' ? new Date().toISOString() : null,
          })
          .eq('id', form.id);

        if (error) {
          console.error('수정 실패:', error);
          alert('저장에 실패했습니다: ' + error.message);
          return;
        }
      } else {
        // 새 페이지 생성
        const { error } = await supabase
          .from('guide_pages')
          .insert({
            title: form.title,
            slug,
            content: form.content,
            excerpt: form.excerpt,
            category: form.category,
            status: form.status,
            short_url: shortUrl,
            created_by: '관리자',
            published_at: form.status === 'published' ? new Date().toISOString() : null,
          });

        if (error) {
          console.error('생성 실패:', error);
          alert('저장에 실패했습니다: ' + error.message);
          return;
        }
      }

      await loadGuides();
      setViewMode('list');
      alert('저장되었습니다.');
    } catch (err) {
      console.error('저장 오류:', err);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('정말 삭제하시겠습니까?')) return;

    try {
      const { error } = await supabase
        .from('guide_pages')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('삭제 실패:', error);
        alert('삭제에 실패했습니다: ' + error.message);
        return;
      }

      await loadGuides();
      alert('삭제되었습니다.');
    } catch (err) {
      console.error('삭제 오류:', err);
      alert('삭제 중 오류가 발생했습니다.');
    }
  }

  // 카테고리 저장
  async function handleSaveCategory() {
    if (!categoryForm.name.trim()) {
      alert('카테고리 이름을 입력해주세요.');
      return;
    }

    const slug = categoryForm.slug.trim() || categoryForm.name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9가-힣-]/g, '');

    setCategoryLoading(true);
    try {
      if (categoryForm.id) {
        // 수정
        const { error } = await supabase
          .from('guide_categories')
          .update({
            name: categoryForm.name,
            slug,
            description: categoryForm.description || null,
          })
          .eq('id', categoryForm.id);

        if (error) {
          alert('카테고리 수정 실패: ' + error.message);
          return;
        }
      } else {
        // 신규
        const maxOrder = categories.length > 0 ? Math.max(...categories.map(c => c.sort_order)) : 0;
        const { error } = await supabase
          .from('guide_categories')
          .insert({
            name: categoryForm.name,
            slug,
            description: categoryForm.description || null,
            sort_order: maxOrder + 1,
          });

        if (error) {
          alert('카테고리 추가 실패: ' + error.message);
          return;
        }
      }

      await loadCategories();
      setCategoryForm({ id: '', name: '', slug: '', description: '' });
    } catch (err) {
      console.error('카테고리 저장 오류:', err);
      alert('카테고리 저장 중 오류가 발생했습니다.');
    } finally {
      setCategoryLoading(false);
    }
  }

  // 카테고리 삭제
  async function handleDeleteCategory(id: string) {
    // 해당 카테고리를 사용하는 안내페이지가 있는지 확인
    const cat = categories.find(c => c.id === id);
    if (!cat) return;

    const pagesUsingCategory = guides.filter(g => g.category === cat.slug);
    if (pagesUsingCategory.length > 0) {
      alert(`이 카테고리를 사용하는 안내페이지가 ${pagesUsingCategory.length}개 있습니다.\n먼저 해당 페이지의 카테고리를 변경해주세요.`);
      return;
    }

    if (!confirm(`'${cat.name}' 카테고리를 삭제하시겠습니까?`)) return;

    try {
      const { error } = await supabase
        .from('guide_categories')
        .delete()
        .eq('id', id);

      if (error) {
        alert('카테고리 삭제 실패: ' + error.message);
        return;
      }

      await loadCategories();
    } catch (err) {
      console.error('카테고리 삭제 오류:', err);
      alert('카테고리 삭제 중 오류가 발생했습니다.');
    }
  }

  // 카테고리 편집 시작
  function handleEditCategory(cat: GuideCategoryDB) {
    setCategoryForm({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      description: cat.description || '',
    });
  }

  function handleApplyTemplate(template: typeof htmlTemplates[0]) {
    setForm((prev) => ({ ...prev, content: template.content }));
    setShowTemplates(false);
  }

  function insertHtmlSnippet(snippet: string) {
    if (editorRef.current) {
      editorRef.current.insertText(snippet);
    }
  }

  function handleImageSelect(url: string, alt?: string) {
    const imgTag = `<img src="${url}" alt="${alt || ''}" style="max-width: 100%; height: auto;" />`;
    insertHtmlSnippet(imgTag);
  }

  // 목록 화면
  if (viewMode === 'list') {
    return (
      <div className="p-6">
        {/* 헤더 */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">안내페이지 관리</h2>
            <p className="text-gray-600 mt-1">
              방문안내, 복약안내, 주차안내 등 환자용 안내 페이지를 관리합니다.
            </p>
          </div>
          <button
            onClick={handleNew}
            className="px-4 py-2 bg-rose-500 text-white rounded-lg hover:bg-rose-600 transition-colors"
          >
            <i className="fa-solid fa-plus mr-2"></i>
            새 안내페이지
          </button>
        </div>

        {/* 통계 */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg border p-4">
            <p className="text-sm text-gray-500">전체 페이지</p>
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <p className="text-sm text-gray-500">활성 페이지</p>
            <p className="text-2xl font-bold text-green-600">{stats.published}</p>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <p className="text-sm text-gray-500">총 조회수</p>
            <p className="text-2xl font-bold text-rose-600">{stats.totalViews.toLocaleString()}</p>
          </div>
        </div>

        {/* 필터 */}
        <div className="bg-white rounded-lg border p-4 mb-4">
          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">상태</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as ContentStatus)}
                className="w-full border rounded px-3 py-2 text-sm"
              >
                <option value="">전체</option>
                {Object.entries(CONTENT_STATUS_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">카테고리</label>
              <div className="flex gap-2">
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="flex-1 border rounded px-3 py-2 text-sm"
                >
                  <option value="">전체</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.slug}>
                      {cat.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => setShowCategoryModal(true)}
                  className="px-2 py-1 text-gray-500 hover:bg-gray-100 rounded border"
                  title="카테고리 관리"
                >
                  <i className="fa-solid fa-cog"></i>
                </button>
              </div>
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-gray-500 mb-1">검색</label>
              <input
                type="text"
                placeholder="제목으로 검색"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
          </div>
        </div>

        {/* 안내페이지 목록 */}
        <div className="bg-white rounded-lg border">
          {loading ? (
            <div className="p-8 text-center text-gray-500">
              <i className="fa-solid fa-spinner fa-spin mr-2"></i>
              로딩 중...
            </div>
          ) : (
            <>
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">제목</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">카테고리</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">버전</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">상태</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">조회수</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">단축URL</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">수정일</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredGuides.map((guide) => (
                    <tr key={guide.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{guide.title}</div>
                        {guide.excerpt && (
                          <div className="text-xs text-gray-500 mt-0.5 truncate max-w-xs">
                            {guide.excerpt}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {getCategoryName(guide.category)}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className="text-gray-600">v{guide.version}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block px-2 py-1 text-xs rounded ${CONTENT_STATUS_COLORS[guide.status] || 'bg-gray-100 text-gray-800'}`}
                        >
                          {CONTENT_STATUS_LABELS[guide.status] || guide.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {guide.views > 0 ? (
                          <span className="text-rose-600 font-medium">{guide.views.toLocaleString()}</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {guide.short_url ? (
                          <code className="px-1.5 py-0.5 bg-gray-100 text-gray-700 text-xs rounded">
                            {guide.short_url}
                          </code>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {formatDate(guide.updated_at)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEdit(guide)}
                            className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded"
                          >
                            수정
                          </button>
                          <button
                            onClick={() => handleDelete(guide.id)}
                            className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded"
                          >
                            삭제
                          </button>
                          {guide.status === 'published' && (
                            <button
                              onClick={() => window.open(`/g/${guide.slug}`, '_blank')}
                              className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded"
                            >
                              보기
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredGuides.length === 0 && (
                <div className="p-8 text-center text-gray-500">안내페이지가 없습니다.</div>
              )}
            </>
          )}
        </div>

        {/* 카테고리 관리 모달 */}
        {showCategoryModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <h3 className="font-semibold text-gray-900">카테고리 관리</h3>
                <button
                  onClick={() => {
                    setShowCategoryModal(false);
                    setCategoryForm({ id: '', name: '', slug: '', description: '' });
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>

              <div className="p-4">
                {/* 카테고리 추가/수정 폼 */}
                <div className="bg-gray-50 rounded-lg p-3 mb-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">
                    {categoryForm.id ? '카테고리 수정' : '새 카테고리 추가'}
                  </h4>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <input
                      type="text"
                      value={categoryForm.name}
                      onChange={(e) => setCategoryForm(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="카테고리 이름"
                      className="border rounded px-3 py-2 text-sm"
                    />
                    <input
                      type="text"
                      value={categoryForm.slug}
                      onChange={(e) => setCategoryForm(prev => ({ ...prev, slug: e.target.value }))}
                      placeholder="slug (자동생성)"
                      className="border rounded px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={categoryForm.description}
                      onChange={(e) => setCategoryForm(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="설명 (선택)"
                      className="flex-1 border rounded px-3 py-2 text-sm"
                    />
                    <button
                      onClick={handleSaveCategory}
                      disabled={categoryLoading}
                      className="px-4 py-2 bg-rose-500 text-white rounded text-sm hover:bg-rose-600 disabled:opacity-50"
                    >
                      {categoryLoading ? (
                        <i className="fa-solid fa-spinner fa-spin"></i>
                      ) : categoryForm.id ? (
                        '수정'
                      ) : (
                        '추가'
                      )}
                    </button>
                    {categoryForm.id && (
                      <button
                        onClick={() => setCategoryForm({ id: '', name: '', slug: '', description: '' })}
                        className="px-3 py-2 text-gray-500 hover:bg-gray-100 rounded text-sm"
                      >
                        취소
                      </button>
                    )}
                  </div>
                </div>

                {/* 카테고리 목록 */}
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {categories.length === 0 ? (
                    <p className="text-center text-gray-500 py-4">카테고리가 없습니다.</p>
                  ) : (
                    categories.map((cat) => {
                      const pageCount = guides.filter(g => g.category === cat.slug).length;
                      return (
                        <div
                          key={cat.id}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                        >
                          <div>
                            <span className="font-medium text-gray-900">{cat.name}</span>
                            <span className="text-xs text-gray-500 ml-2">({cat.slug})</span>
                            {pageCount > 0 && (
                              <span className="text-xs text-rose-500 ml-2">
                                {pageCount}개 페이지
                              </span>
                            )}
                            {cat.description && (
                              <p className="text-xs text-gray-500 mt-0.5">{cat.description}</p>
                            )}
                          </div>
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleEditCategory(cat)}
                              className="px-2 py-1 text-xs text-gray-600 hover:bg-white rounded"
                            >
                              수정
                            </button>
                            <button
                              onClick={() => handleDeleteCategory(cat.id)}
                              className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded"
                            >
                              삭제
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="px-4 py-3 border-t flex justify-end">
                <button
                  onClick={() => {
                    setShowCategoryModal(false);
                    setCategoryForm({ id: '', name: '', slug: '', description: '' });
                  }}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded text-sm"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 편집 화면
  return (
    <div className="h-full flex flex-col">
      {/* 통합 툴바 - 한 줄로 모든 컨트롤 */}
      <div className="bg-white border-b px-3 py-2 flex items-center gap-3 flex-shrink-0">
        {/* 뒤로가기 */}
        <button
          onClick={() => setViewMode('list')}
          className="p-1.5 text-gray-500 hover:bg-gray-100 rounded transition-colors"
          title="목록으로"
        >
          <i className="fa-solid fa-arrow-left"></i>
        </button>

        {/* 제목 입력 */}
        <input
          type="text"
          value={form.title}
          onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
          className="flex-1 min-w-[200px] border rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
          placeholder="안내페이지 제목"
        />

        {/* 카테고리 */}
        <select
          value={form.category}
          onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
          className="border rounded px-2 py-1.5 text-sm min-w-[100px]"
        >
          {categories.map((cat) => (
            <option key={cat.id} value={cat.slug}>
              {cat.name}
            </option>
          ))}
        </select>

        {/* 상태 */}
        <select
          value={form.status}
          onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as ContentStatus }))}
          className="border rounded px-2 py-1.5 text-sm min-w-[80px]"
        >
          {Object.entries(CONTENT_STATUS_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>

        {/* 단축 URL */}
        <input
          type="text"
          value={form.shortUrl}
          onChange={(e) => setForm((prev) => ({ ...prev, shortUrl: e.target.value }))}
          className="w-28 border rounded px-2 py-1.5 text-sm"
          placeholder="/g/url"
        />

        <div className="w-px h-6 bg-gray-200"></div>

        {/* 모드 전환 */}
        <div className="flex items-center bg-gray-100 rounded p-0.5">
          <button
            onClick={() => setEditMode('code')}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              editMode === 'code'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
            title="코드 편집"
          >
            <i className="fa-solid fa-code"></i>
          </button>
          <button
            onClick={() => setEditMode('split')}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              editMode === 'split'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
            title="분할 보기"
          >
            <i className="fa-solid fa-columns"></i>
          </button>
          <button
            onClick={() => setEditMode('preview')}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              editMode === 'preview'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
            title="미리보기"
          >
            <i className="fa-solid fa-eye"></i>
          </button>
        </div>

        <div className="w-px h-6 bg-gray-200"></div>

        {/* 템플릿 드롭다운 */}
        <div className="relative">
          <button
            onClick={() => setShowTemplates(!showTemplates)}
            className={`px-2 py-1.5 text-sm rounded transition-colors flex items-center gap-1 ${
              showTemplates ? 'bg-yellow-100 text-yellow-700' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <i className="fa-solid fa-file-code"></i>
            <span className="hidden xl:inline">템플릿</span>
            <i className={`fa-solid fa-chevron-down text-xs transition-transform ${showTemplates ? 'rotate-180' : ''}`}></i>
          </button>
          {showTemplates && (
            <div className="absolute top-full left-0 mt-1 bg-white border rounded-lg shadow-lg py-1 z-10 min-w-[140px]">
              {htmlTemplates.map((template) => (
                <button
                  key={template.name}
                  onClick={() => handleApplyTemplate(template)}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-yellow-50 text-gray-700"
                >
                  {template.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 저장 버튼 */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-3 py-1.5 bg-rose-500 text-white rounded hover:bg-rose-600 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? (
            <>
              <i className="fa-solid fa-spinner fa-spin mr-1"></i>
              저장 중...
            </>
          ) : (
            <>
              <i className="fa-solid fa-save mr-1"></i>
              저장
            </>
          )}
        </button>
      </div>

      {/* HTML 스니펫 툴바 - 코드 모드에서만 */}
      {(editMode === 'code' || editMode === 'split') && (
        <div className="bg-gray-50 border-b px-3 py-1.5 flex items-center gap-1 flex-shrink-0 overflow-x-auto">
          <button
            onClick={() => insertHtmlSnippet('<h1></h1>')}
            className="px-2 py-0.5 text-xs bg-white border hover:bg-gray-100 rounded"
          >
            H1
          </button>
          <button
            onClick={() => insertHtmlSnippet('<h2></h2>')}
            className="px-2 py-0.5 text-xs bg-white border hover:bg-gray-100 rounded"
          >
            H2
          </button>
          <button
            onClick={() => insertHtmlSnippet('<p></p>')}
            className="px-2 py-0.5 text-xs bg-white border hover:bg-gray-100 rounded"
          >
            P
          </button>
          <button
            onClick={() => insertHtmlSnippet('<ul>\n  <li></li>\n</ul>')}
            className="px-2 py-0.5 text-xs bg-white border hover:bg-gray-100 rounded"
          >
            UL
          </button>
          <button
            onClick={() => insertHtmlSnippet('<ol>\n  <li></li>\n</ol>')}
            className="px-2 py-0.5 text-xs bg-white border hover:bg-gray-100 rounded"
          >
            OL
          </button>
          <div className="w-px h-4 bg-gray-300 mx-1"></div>
          <button
            onClick={() => insertHtmlSnippet('<div class="highlight-box">\n  <strong>💡 알려드립니다</strong>\n  <p></p>\n</div>')}
            className="px-2 py-0.5 text-xs bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 rounded"
          >
            하이라이트
          </button>
          <button
            onClick={() => insertHtmlSnippet('<div class="warning-box">\n  <strong>⚠️ 주의사항</strong>\n  <p></p>\n</div>')}
            className="px-2 py-0.5 text-xs bg-yellow-50 text-yellow-700 border border-yellow-200 hover:bg-yellow-100 rounded"
          >
            경고
          </button>
          <button
            onClick={() => setShowMediaLibrary(true)}
            className="px-2 py-0.5 text-xs bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 rounded flex items-center gap-1"
          >
            <i className="fa-solid fa-images text-[10px]"></i>
            미디어
          </button>
          <button
            onClick={() => insertHtmlSnippet('<a href="" target="_blank"></a>')}
            className="px-2 py-0.5 text-xs bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 rounded"
          >
            링크
          </button>
        </div>
      )}

      {/* 에디터 영역 */}
      <div className="flex-1 overflow-hidden">
        {editMode === 'code' && (
          <HtmlCodeEditor
            ref={editorRef}
            value={form.content}
            onChange={(value) => setForm((prev) => ({ ...prev, content: value }))}
          />
        )}

        {editMode === 'preview' && (
          <div className="h-full bg-white">
            <iframe
              ref={iframeRef}
              className="w-full h-full border-0"
              title="미리보기"
              sandbox="allow-same-origin"
            />
          </div>
        )}

        {editMode === 'split' && (
          <div className="h-full grid grid-cols-2">
            {/* 코드 영역 */}
            <div className="border-r overflow-hidden flex flex-col">
              <div className="bg-gray-800 text-gray-400 text-xs px-4 py-2 flex items-center gap-2 flex-shrink-0">
                <i className="fa-solid fa-code"></i>
                HTML 코드
              </div>
              <div className="flex-1 overflow-hidden">
                <HtmlCodeEditor
                  ref={editorRef}
                  value={form.content}
                  onChange={(value) => setForm((prev) => ({ ...prev, content: value }))}
                />
              </div>
            </div>
            {/* 미리보기 영역 */}
            <div className="overflow-hidden">
              <div className="bg-gray-100 text-gray-600 text-xs px-4 py-2 flex items-center gap-2">
                <i className="fa-solid fa-eye"></i>
                미리보기
              </div>
              <div className="h-[calc(100%-32px)] bg-white overflow-auto">
                <iframe
                  ref={iframeRef}
                  className="w-full h-full border-0"
                  title="미리보기"
                  sandbox="allow-same-origin"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 미디어 라이브러리 모달 */}
      <MediaLibraryModal
        isOpen={showMediaLibrary}
        onClose={() => setShowMediaLibrary(false)}
        onSelect={handleImageSelect}
      />
    </div>
  );
}

export default GuideManagement;
