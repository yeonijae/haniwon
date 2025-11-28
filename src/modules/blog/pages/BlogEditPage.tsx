/**
 * 블로그 글 작성/수정 페이지
 * WYSIWYG 에디터 사용
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  getPostById,
  createPost,
  updatePost,
  publishPost,
} from '@/lib/supabase';
import {
  BlogCategory,
  BLOG_CATEGORY_LABELS,
  BLOG_CATEGORY_COLORS,
} from '../types';
import WysiwygEditor from '../components/WysiwygEditor';

interface PostForm {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  category: BlogCategory;
  tags: string[];
  thumbnailUrl: string;
  authorName: string;
  authorTitle: string;
  metaTitle: string;
  metaDescription: string;
}

const defaultForm: PostForm = {
  title: '',
  slug: '',
  excerpt: '',
  content: '',
  category: 'health_info',
  tags: [],
  thumbnailUrl: '',
  authorName: '연이재한의원',
  authorTitle: '한의사',
  metaTitle: '',
  metaDescription: '',
};

export default function BlogEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const isNew = !id || id === 'new';

  // 현재 경로에 따라 뒤로가기 경로 결정
  const backPath = location.pathname.startsWith('/content') ? '/content/blog' : '/blog/manage';

  const [form, setForm] = useState<PostForm>(defaultForm);
  const [tagInput, setTagInput] = useState('');
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [showSEO, setShowSEO] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (!isNew && id) {
      loadPost(id);
    }
  }, [id, isNew]);

  const loadPost = async (postId: string) => {
    try {
      const post = await getPostById(postId);
      if (post) {
        setForm({
          title: post.title,
          slug: post.slug,
          excerpt: post.excerpt,
          content: post.content,
          category: post.category,
          tags: post.tags || [],
          thumbnailUrl: post.thumbnailUrl || '',
          authorName: post.authorName || '연이재한의원',
          authorTitle: post.authorTitle || '한의사',
          metaTitle: post.metaTitle || '',
          metaDescription: post.metaDescription || '',
        });
      }
    } catch (error) {
      console.error('Failed to load post:', error);
      alert('글을 불러오는데 실패했습니다.');
      navigate(backPath);
    } finally {
      setLoading(false);
    }
  };

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9가-힣\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  };

  const handleTitleChange = (title: string) => {
    setForm((prev) => ({
      ...prev,
      title,
      slug: prev.slug || generateSlug(title),
    }));
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !form.tags.includes(tagInput.trim())) {
      setForm((prev) => ({
        ...prev,
        tags: [...prev.tags, tagInput.trim()],
      }));
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setForm((prev) => ({
      ...prev,
      tags: prev.tags.filter((t) => t !== tag),
    }));
  };

  const handleSave = async (publish: boolean = false) => {
    if (!form.title.trim()) {
      alert('제목을 입력해주세요.');
      return;
    }
    if (!form.content.trim()) {
      alert('내용을 입력해주세요.');
      return;
    }
    if (!form.slug.trim()) {
      alert('URL 슬러그를 입력해주세요.');
      return;
    }

    setSaving(true);
    try {
      let postId = id;

      if (isNew) {
        const newPost = await createPost({
          ...form,
          status: 'draft',
        });
        postId = newPost.id;
      } else if (id) {
        await updatePost(id, form);
      }

      if (publish && postId) {
        await publishPost(postId);
        alert('글이 발행되었습니다!');
      } else {
        alert('저장되었습니다.');
      }

      navigate(backPath);
    } catch (error) {
      console.error('Save failed:', error);
      alert('저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(backPath)}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <i className="fa-solid fa-arrow-left"></i>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">
              {isNew ? '새 글 작성' : '글 수정'}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPreview(true)}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
          >
            <i className="fa-solid fa-eye"></i>
            미리보기
          </button>
          <button
            onClick={() => handleSave(false)}
            disabled={saving}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {saving ? '저장 중...' : '임시저장'}
          </button>
          <button
            onClick={() => handleSave(true)}
            disabled={saving}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <i className="fa-solid fa-paper-plane"></i>
            {saving ? '발행 중...' : '발행하기'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* 메인 에디터 */}
        <div className="xl:col-span-3 space-y-6">
          {/* 제목 */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <input
              type="text"
              placeholder="제목을 입력하세요"
              value={form.title}
              onChange={(e) => handleTitleChange(e.target.value)}
              className="w-full text-2xl font-bold border-none focus:outline-none focus:ring-0 placeholder:text-gray-300"
            />
          </div>

          {/* 요약 */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              요약 (검색 결과에 표시됨)
            </label>
            <textarea
              placeholder="글의 요약을 2-3문장으로 작성하세요..."
              value={form.excerpt}
              onChange={(e) => setForm((prev) => ({ ...prev, excerpt: e.target.value }))}
              rows={3}
              className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
            />
          </div>

          {/* 본문 - WYSIWYG 에디터 */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              본문
            </label>
            <WysiwygEditor
              content={form.content}
              onChange={(html) => setForm((prev) => ({ ...prev, content: html }))}
              placeholder="글 내용을 작성하세요..."
            />
          </div>
        </div>

        {/* 사이드바 */}
        <div className="space-y-6">
          {/* 기본 설정 */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="font-bold text-gray-800 mb-4">기본 설정</h3>

            {/* URL 슬러그 */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                URL 슬러그
              </label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">/post/</span>
                <input
                  type="text"
                  value={form.slug}
                  onChange={(e) => setForm((prev) => ({ ...prev, slug: e.target.value }))}
                  className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                />
              </div>
            </div>

            {/* 카테고리 */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                카테고리
              </label>
              <select
                value={form.category}
                onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value as BlogCategory }))}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                {Object.entries(BLOG_CATEGORY_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>

            {/* 태그 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                태그
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                  placeholder="태그 입력"
                  className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                />
                <button
                  onClick={handleAddTag}
                  className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  <i className="fa-solid fa-plus"></i>
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {form.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-sm flex items-center gap-1"
                  >
                    #{tag}
                    <button
                      onClick={() => handleRemoveTag(tag)}
                      className="text-gray-400 hover:text-red-500"
                    >
                      <i className="fa-solid fa-times text-xs"></i>
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* 썸네일 */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="font-bold text-gray-800 mb-4">썸네일</h3>
            <div className="mb-4">
              <input
                type="text"
                value={form.thumbnailUrl}
                onChange={(e) => setForm((prev) => ({ ...prev, thumbnailUrl: e.target.value }))}
                placeholder="이미지 URL 입력"
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
              />
            </div>
            {form.thumbnailUrl && (
              <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden">
                <img
                  src={form.thumbnailUrl}
                  alt="썸네일 미리보기"
                  className="w-full h-full object-cover"
                  onError={(e) => (e.currentTarget.style.display = 'none')}
                />
              </div>
            )}
          </div>

          {/* 작성자 */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="font-bold text-gray-800 mb-4">작성자</h3>
            <div className="mb-3">
              <input
                type="text"
                value={form.authorName}
                onChange={(e) => setForm((prev) => ({ ...prev, authorName: e.target.value }))}
                placeholder="작성자 이름"
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
              />
            </div>
            <div>
              <input
                type="text"
                value={form.authorTitle}
                onChange={(e) => setForm((prev) => ({ ...prev, authorTitle: e.target.value }))}
                placeholder="직함 (예: 한의사)"
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
              />
            </div>
          </div>

          {/* SEO 설정 */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <button
              onClick={() => setShowSEO(!showSEO)}
              className="flex items-center justify-between w-full"
            >
              <h3 className="font-bold text-gray-800">SEO 설정</h3>
              <i className={`fa-solid fa-chevron-${showSEO ? 'up' : 'down'} text-gray-400`}></i>
            </button>

            {showSEO && (
              <div className="mt-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    메타 타이틀
                  </label>
                  <input
                    type="text"
                    value={form.metaTitle}
                    onChange={(e) => setForm((prev) => ({ ...prev, metaTitle: e.target.value }))}
                    placeholder={form.title || '제목이 자동으로 사용됩니다'}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    메타 설명
                  </label>
                  <textarea
                    value={form.metaDescription}
                    onChange={(e) => setForm((prev) => ({ ...prev, metaDescription: e.target.value }))}
                    placeholder={form.excerpt || '요약이 자동으로 사용됩니다'}
                    rows={3}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm resize-none"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 미리보기 모달 */}
      {showPreview && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowPreview(false)}
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 미리보기 헤더 */}
            <div className="flex items-center justify-between p-4 border-b bg-gray-50">
              <div className="flex items-center gap-3">
                <i className="fa-solid fa-eye text-green-600"></i>
                <span className="font-bold text-gray-800">미리보기</span>
              </div>
              <button
                onClick={() => setShowPreview(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <i className="fa-solid fa-times"></i>
              </button>
            </div>

            {/* 미리보기 본문 */}
            <div className="flex-1 overflow-y-auto">
              {/* 썸네일 */}
              {form.thumbnailUrl && (
                <div className="w-full h-48 md:h-64 bg-gray-100">
                  <img
                    src={form.thumbnailUrl}
                    alt={form.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              <div className="p-6 md:p-8">
                {/* 카테고리 */}
                <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium mb-4 ${BLOG_CATEGORY_COLORS[form.category]}`}>
                  {BLOG_CATEGORY_LABELS[form.category]}
                </span>

                {/* 제목 */}
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
                  {form.title || '제목 없음'}
                </h1>

                {/* 메타 정보 */}
                <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 mb-6 pb-6 border-b">
                  <span className="flex items-center gap-1">
                    <i className="fa-solid fa-user"></i>
                    {form.authorName}
                  </span>
                  <span className="flex items-center gap-1">
                    <i className="fa-solid fa-calendar"></i>
                    {new Date().toLocaleDateString('ko-KR')}
                  </span>
                </div>

                {/* 요약 */}
                {form.excerpt && (
                  <div className="bg-gray-50 rounded-lg p-4 mb-6 text-gray-600 italic">
                    {form.excerpt}
                  </div>
                )}

                {/* 본문 - HTML 직접 렌더링 */}
                <article
                  className="prose prose-lg max-w-none"
                  dangerouslySetInnerHTML={{
                    __html: form.content || '<p class="text-gray-400">내용이 없습니다.</p>',
                  }}
                />

                {/* 태그 */}
                {form.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-8 pt-6 border-t">
                    {form.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 미리보기 푸터 */}
            <div className="flex items-center justify-end gap-3 p-4 border-t bg-gray-50">
              <button
                onClick={() => setShowPreview(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
              >
                닫기
              </button>
              <button
                onClick={() => {
                  setShowPreview(false);
                  handleSave(true);
                }}
                disabled={saving}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                <i className="fa-solid fa-paper-plane"></i>
                발행하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
