/**
 * 랜딩페이지 관리 - HTML 기반 에디터 + 미리보기
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

// DB에서 가져온 랜딩페이지 타입
interface LandingPageDB {
  id: string;
  title: string;
  slug: string;
  content: string | null;
  campaign_name: string | null;
  cta_text: string | null;
  cta_link: string | null;
  status: ContentStatus;
  short_url: string | null;
  start_date: string | null;
  end_date: string | null;
  views: number;
  clicks: number;
  conversions: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

type ViewMode = 'list' | 'edit';
type EditMode = 'code' | 'preview' | 'split';

interface LandingForm {
  id?: string;
  title: string;
  slug: string;
  content: string;
  campaignName: string;
  ctaText: string;
  ctaLink: string;
  status: ContentStatus;
  shortUrl: string;
  startDate: string;
  endDate: string;
}

const defaultForm: LandingForm = {
  title: '',
  slug: '',
  content: `<!DOCTYPE html>
<html>
<head>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Pretendard', sans-serif; }
    .landing-hero {
      background: linear-gradient(135deg, #f43f5e 0%, #ec4899 100%);
      color: white;
      padding: 80px 20px;
      text-align: center;
    }
    .landing-hero h1 {
      font-size: 36px;
      margin-bottom: 16px;
    }
    .landing-hero p {
      font-size: 18px;
      opacity: 0.9;
      margin-bottom: 32px;
    }
    .cta-button {
      display: inline-block;
      background: white;
      color: #f43f5e;
      padding: 16px 40px;
      border-radius: 50px;
      font-size: 18px;
      font-weight: 700;
      text-decoration: none;
      transition: transform 0.2s;
    }
    .cta-button:hover {
      transform: scale(1.05);
    }
    .section {
      padding: 60px 20px;
      max-width: 800px;
      margin: 0 auto;
    }
    .section h2 {
      font-size: 28px;
      color: #1f2937;
      margin-bottom: 24px;
      text-align: center;
    }
    .benefits {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 24px;
    }
    .benefit-card {
      background: #f9fafb;
      padding: 24px;
      border-radius: 12px;
      text-align: center;
    }
    .benefit-card h3 {
      font-size: 18px;
      color: #374151;
      margin-bottom: 8px;
    }
    .benefit-card p {
      color: #6b7280;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="landing-hero">
    <h1>제목을 입력하세요</h1>
    <p>부제목 또는 설명을 입력하세요</p>
    <a href="#" class="cta-button">지금 상담받기</a>
  </div>

  <div class="section">
    <h2>주요 혜택</h2>
    <div class="benefits">
      <div class="benefit-card">
        <h3>혜택 1</h3>
        <p>혜택 설명을 입력하세요</p>
      </div>
      <div class="benefit-card">
        <h3>혜택 2</h3>
        <p>혜택 설명을 입력하세요</p>
      </div>
      <div class="benefit-card">
        <h3>혜택 3</h3>
        <p>혜택 설명을 입력하세요</p>
      </div>
    </div>
  </div>
</body>
</html>`,
  campaignName: '',
  ctaText: '지금 상담받기',
  ctaLink: '',
  status: 'draft',
  shortUrl: '',
  startDate: '',
  endDate: '',
};

// HTML 템플릿
const htmlTemplates = [
  {
    name: '기본 랜딩',
    content: defaultForm.content,
  },
  {
    name: '다이어트 프로그램',
    content: `<!DOCTYPE html>
<html>
<head>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Pretendard', sans-serif; }
    .hero {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: white;
      padding: 80px 20px;
      text-align: center;
    }
    .hero h1 { font-size: 40px; margin-bottom: 16px; }
    .hero .subtitle { font-size: 20px; opacity: 0.9; margin-bottom: 8px; }
    .hero .highlight { font-size: 24px; font-weight: 700; margin-bottom: 32px; }
    .cta-btn {
      display: inline-block;
      background: #fbbf24;
      color: #1f2937;
      padding: 18px 48px;
      border-radius: 50px;
      font-size: 20px;
      font-weight: 700;
      text-decoration: none;
    }
    .section { padding: 60px 20px; max-width: 900px; margin: 0 auto; }
    .section h2 { font-size: 28px; text-align: center; margin-bottom: 40px; color: #1f2937; }
    .features { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
    .feature { text-align: center; padding: 24px; }
    .feature-icon { font-size: 48px; margin-bottom: 16px; }
    .feature h3 { font-size: 18px; color: #374151; margin-bottom: 8px; }
    .feature p { color: #6b7280; font-size: 14px; }
    .testimonial { background: #f0fdf4; padding: 40px; border-radius: 16px; text-align: center; }
    .testimonial p { font-size: 18px; color: #374151; font-style: italic; margin-bottom: 16px; }
    .testimonial .author { color: #059669; font-weight: 600; }
  </style>
</head>
<body>
  <div class="hero">
    <p class="subtitle">체질 맞춤형 한방 다이어트</p>
    <h1>건강하게 빼고, 요요 없이 유지!</h1>
    <p class="highlight">🎁 신규 상담 시 체성분 검사 무료</p>
    <a href="#" class="cta-btn">무료 상담 신청하기</a>
  </div>

  <div class="section">
    <h2>왜 한방 다이어트인가요?</h2>
    <div class="features">
      <div class="feature">
        <div class="feature-icon">🌿</div>
        <h3>체질 맞춤 처방</h3>
        <p>개인별 체질에 맞는 한약 처방으로 효과적인 감량</p>
      </div>
      <div class="feature">
        <div class="feature-icon">💪</div>
        <h3>요요 방지</h3>
        <p>기초대사량 향상으로 요요 현상 최소화</p>
      </div>
      <div class="feature">
        <div class="feature-icon">❤️</div>
        <h3>건강 개선</h3>
        <p>다이어트와 함께 전반적인 건강 상태 개선</p>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="testimonial">
      <p>"3개월 만에 12kg 감량! 체력도 좋아지고 피부도 좋아졌어요."</p>
      <span class="author">- 30대 직장인 김○○님</span>
    </div>
  </div>
</body>
</html>`,
  },
  {
    name: '이벤트/프로모션',
    content: `<!DOCTYPE html>
<html>
<head>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Pretendard', sans-serif; background: #fef2f2; }
    .event-banner {
      background: linear-gradient(135deg, #ef4444 0%, #f97316 100%);
      color: white;
      padding: 60px 20px;
      text-align: center;
    }
    .event-badge {
      display: inline-block;
      background: #fbbf24;
      color: #1f2937;
      padding: 8px 20px;
      border-radius: 20px;
      font-weight: 700;
      margin-bottom: 16px;
    }
    .event-banner h1 { font-size: 36px; margin-bottom: 12px; }
    .event-banner .period { font-size: 18px; opacity: 0.9; }
    .content { max-width: 600px; margin: -40px auto 40px; padding: 0 20px; }
    .benefit-box {
      background: white;
      border-radius: 16px;
      padding: 32px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.1);
      margin-bottom: 24px;
    }
    .benefit-box h2 { color: #ef4444; font-size: 24px; margin-bottom: 20px; text-align: center; }
    .benefit-list { list-style: none; }
    .benefit-list li {
      padding: 12px 0;
      border-bottom: 1px solid #f3f4f6;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .benefit-list li:last-child { border-bottom: none; }
    .benefit-list .icon { font-size: 24px; }
    .benefit-list .text { font-size: 16px; color: #374151; }
    .cta-section { text-align: center; padding: 20px; }
    .cta-btn {
      display: inline-block;
      background: #ef4444;
      color: white;
      padding: 18px 48px;
      border-radius: 50px;
      font-size: 20px;
      font-weight: 700;
      text-decoration: none;
    }
    .notice { text-align: center; color: #9ca3af; font-size: 14px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="event-banner">
    <span class="event-badge">🎉 특별 이벤트</span>
    <h1>봄맞이 건강 캠페인</h1>
    <p class="period">2024.03.01 ~ 2024.03.31</p>
  </div>

  <div class="content">
    <div class="benefit-box">
      <h2>이벤트 혜택</h2>
      <ul class="benefit-list">
        <li>
          <span class="icon">🎁</span>
          <span class="text">첫 방문 상담 무료</span>
        </li>
        <li>
          <span class="icon">💊</span>
          <span class="text">한약 처방 시 10% 할인</span>
        </li>
        <li>
          <span class="icon">🏥</span>
          <span class="text">침 치료 5회 + 1회 추가 제공</span>
        </li>
        <li>
          <span class="icon">📋</span>
          <span class="text">체성분 검사 무료</span>
        </li>
      </ul>
    </div>

    <div class="cta-section">
      <a href="#" class="cta-btn">이벤트 참여하기</a>
      <p class="notice">※ 본 이벤트는 조기 종료될 수 있습니다.</p>
    </div>
  </div>
</body>
</html>`,
  },
];

function LandingManagement() {
  const [landings, setLandings] = useState<LandingPageDB[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [editMode, setEditMode] = useState<EditMode>('split');
  const [filterStatus, setFilterStatus] = useState<ContentStatus | ''>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [form, setForm] = useState<LandingForm>(defaultForm);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showMediaLibrary, setShowMediaLibrary] = useState(false);
  const editorRef = useRef<HtmlCodeEditorRef>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // DB에서 랜딩페이지 목록 로드
  const loadLandings = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('landing_pages')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('랜딩페이지 로드 실패:', error);
        alert('랜딩페이지 목록을 불러오는데 실패했습니다.');
        return;
      }

      setLandings(data || []);
    } catch (err) {
      console.error('랜딩페이지 로드 오류:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // 초기 로드
  useEffect(() => {
    loadLandings();
  }, [loadLandings]);

  const filteredLandings = landings.filter((landing) => {
    if (filterStatus && landing.status !== filterStatus) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      if (
        !landing.title.toLowerCase().includes(term) &&
        !landing.campaign_name?.toLowerCase().includes(term)
      ) {
        return false;
      }
    }
    return true;
  });

  const stats = {
    total: landings.length,
    active: landings.filter((l) => l.status === 'published').length,
    totalViews: landings.reduce((sum, l) => sum + l.views, 0),
    totalConversions: landings.reduce((sum, l) => sum + l.conversions, 0),
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

  function getConversionRate(landing: LandingPageDB) {
    if (landing.views === 0) return '-';
    return ((landing.conversions / landing.views) * 100).toFixed(1) + '%';
  }

  function getCampaignStatus(landing: LandingPageDB) {
    if (!landing.start_date || !landing.end_date) return null;
    const now = new Date();
    const start = new Date(landing.start_date);
    const end = new Date(landing.end_date);

    if (now < start) return { label: '예정', color: 'bg-blue-100 text-blue-800' };
    if (now > end) return { label: '종료', color: 'bg-gray-100 text-gray-500' };
    return { label: '진행중', color: 'bg-green-100 text-green-800' };
  }

  function handleNew() {
    setForm(defaultForm);
    setViewMode('edit');
    setEditMode('split');
  }

  function handleEdit(landing: LandingPageDB) {
    setForm({
      id: landing.id,
      title: landing.title,
      slug: landing.slug,
      content: landing.content || '',
      campaignName: landing.campaign_name || '',
      ctaText: landing.cta_text || '',
      ctaLink: landing.cta_link || '',
      status: landing.status,
      shortUrl: landing.short_url || '',
      startDate: landing.start_date || '',
      endDate: landing.end_date || '',
    });
    setViewMode('edit');
    setEditMode('split');
  }

  async function handleSave() {
    if (!form.title.trim()) {
      alert('제목을 입력해주세요.');
      return;
    }

    const slug = form.slug.trim() || form.title.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9가-힣-]/g, '');
    const shortUrl = form.shortUrl.trim() || `/l/${slug}`;

    setSaving(true);
    try {
      if (form.id) {
        const { error } = await supabase
          .from('landing_pages')
          .update({
            title: form.title,
            slug,
            content: form.content,
            campaign_name: form.campaignName || null,
            cta_text: form.ctaText || null,
            cta_link: form.ctaLink || null,
            status: form.status,
            short_url: shortUrl,
            start_date: form.startDate || null,
            end_date: form.endDate || null,
          })
          .eq('id', form.id);

        if (error) {
          console.error('수정 실패:', error);
          alert('저장에 실패했습니다: ' + error.message);
          return;
        }
      } else {
        const { error } = await supabase
          .from('landing_pages')
          .insert({
            title: form.title,
            slug,
            content: form.content,
            campaign_name: form.campaignName || null,
            cta_text: form.ctaText || null,
            cta_link: form.ctaLink || null,
            status: form.status,
            short_url: shortUrl,
            start_date: form.startDate || null,
            end_date: form.endDate || null,
          });

        if (error) {
          console.error('생성 실패:', error);
          alert('저장에 실패했습니다: ' + error.message);
          return;
        }
      }

      await loadLandings();
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
        .from('landing_pages')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('삭제 실패:', error);
        alert('삭제에 실패했습니다: ' + error.message);
        return;
      }

      await loadLandings();
      alert('삭제되었습니다.');
    } catch (err) {
      console.error('삭제 오류:', err);
      alert('삭제 중 오류가 발생했습니다.');
    }
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
            <h2 className="text-2xl font-bold text-gray-900">랜딩페이지 관리</h2>
            <p className="text-gray-600 mt-1">
              마케팅 캠페인용 랜딩페이지를 관리하고 성과를 추적합니다.
            </p>
          </div>
          <button
            onClick={handleNew}
            className="px-4 py-2 bg-rose-500 text-white rounded-lg hover:bg-rose-600 transition-colors"
          >
            <i className="fa-solid fa-plus mr-2"></i>
            새 랜딩페이지
          </button>
        </div>

        {/* 통계 */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg border p-4">
            <p className="text-sm text-gray-500">전체 페이지</p>
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <p className="text-sm text-gray-500">활성 캠페인</p>
            <p className="text-2xl font-bold text-green-600">{stats.active}</p>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <p className="text-sm text-gray-500">총 조회수</p>
            <p className="text-2xl font-bold text-rose-600">{stats.totalViews.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <p className="text-sm text-gray-500">총 전환</p>
            <p className="text-2xl font-bold text-purple-600">{stats.totalConversions}</p>
          </div>
        </div>

        {/* 필터 */}
        <div className="bg-white rounded-lg border p-4 mb-4">
          <div className="grid grid-cols-3 gap-4">
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
            <div className="col-span-2">
              <label className="block text-xs text-gray-500 mb-1">검색</label>
              <input
                type="text"
                placeholder="제목, 캠페인명으로 검색"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
          </div>
        </div>

        {/* 랜딩페이지 목록 */}
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
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">캠페인</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">상태</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">기간</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">조회</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">전환</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">전환율</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredLandings.map((landing) => {
                    const campaignStatus = getCampaignStatus(landing);
                    return (
                      <tr key={landing.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{landing.title}</div>
                          {landing.short_url && (
                            <code className="text-xs text-gray-500">{landing.short_url}</code>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {landing.campaign_name || '-'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            <span
                              className={`inline-block px-2 py-0.5 text-xs rounded ${CONTENT_STATUS_COLORS[landing.status] || 'bg-gray-100 text-gray-800'}`}
                            >
                              {CONTENT_STATUS_LABELS[landing.status] || landing.status}
                            </span>
                            {campaignStatus && (
                              <span
                                className={`inline-block px-2 py-0.5 text-xs rounded ${campaignStatus.color}`}
                              >
                                {campaignStatus.label}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {landing.start_date && landing.end_date ? (
                            <>
                              {formatDate(landing.start_date)}
                              <br />~ {formatDate(landing.end_date)}
                            </>
                          ) : (
                            '상시'
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {landing.views > 0 ? (
                            <span className="font-medium">{landing.views.toLocaleString()}</span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {landing.conversions > 0 ? (
                            <span className="font-medium text-purple-600">{landing.conversions}</span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className="font-medium text-rose-600">
                            {getConversionRate(landing)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleEdit(landing)}
                              className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded"
                            >
                              수정
                            </button>
                            <button
                              onClick={() => handleDelete(landing.id)}
                              className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded"
                            >
                              삭제
                            </button>
                            {landing.status === 'published' && (
                              <button
                                onClick={() => window.open(`/l/${landing.slug}`, '_blank')}
                                className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded"
                              >
                                보기
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredLandings.length === 0 && (
                <div className="p-8 text-center text-gray-500">랜딩페이지가 없습니다.</div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  // 편집 화면
  return (
    <div className="h-full flex flex-col">
      {/* 통합 툴바 */}
      <div className="bg-white border-b px-3 py-2 flex items-center gap-3 flex-shrink-0">
        <button
          onClick={() => setViewMode('list')}
          className="p-1.5 text-gray-500 hover:bg-gray-100 rounded transition-colors"
          title="목록으로"
        >
          <i className="fa-solid fa-arrow-left"></i>
        </button>

        <input
          type="text"
          value={form.title}
          onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
          className="flex-1 min-w-[200px] border rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
          placeholder="랜딩페이지 제목"
        />

        <input
          type="text"
          value={form.campaignName}
          onChange={(e) => setForm((prev) => ({ ...prev, campaignName: e.target.value }))}
          className="w-40 border rounded px-2 py-1.5 text-sm"
          placeholder="캠페인명"
        />

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

        <div className="w-px h-6 bg-gray-200"></div>

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
            <div className="absolute top-full left-0 mt-1 bg-white border rounded-lg shadow-lg py-1 z-10 min-w-[160px]">
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

      {/* HTML 스니펫 툴바 */}
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
            onClick={() => insertHtmlSnippet('<div class="section"></div>')}
            className="px-2 py-0.5 text-xs bg-white border hover:bg-gray-100 rounded"
          >
            섹션
          </button>
          <div className="w-px h-4 bg-gray-300 mx-1"></div>
          <button
            onClick={() => insertHtmlSnippet('<a href="#" class="cta-button">CTA 버튼</a>')}
            className="px-2 py-0.5 text-xs bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 rounded"
          >
            CTA 버튼
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

export default LandingManagement;
