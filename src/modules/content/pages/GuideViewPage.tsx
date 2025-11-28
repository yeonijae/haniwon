/**
 * 공개 안내페이지 뷰어 - 로그인 없이 접근 가능
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@shared/lib/supabase';

interface GuidePage {
  id: string;
  title: string;
  slug: string;
  content: string | null;
  status: string;
  views: number;
}

function GuideViewPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [guide, setGuide] = useState<GuidePage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (slug) {
      loadGuide(slug);
    }
  }, [slug]);

  async function loadGuide(guideSlug: string) {
    setLoading(true);
    setError(null);

    try {
      // slug로 안내페이지 조회
      const { data, error: fetchError } = await supabase
        .from('guide_pages')
        .select('id, title, slug, content, status, views')
        .eq('slug', guideSlug)
        .eq('status', 'published')
        .single();

      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          setError('존재하지 않거나 비공개된 안내페이지입니다.');
        } else {
          setError('안내페이지를 불러오는데 실패했습니다.');
        }
        return;
      }

      setGuide(data);

      // 조회수 증가
      await supabase
        .from('guide_pages')
        .update({ views: (data.views || 0) + 1 })
        .eq('id', data.id);

    } catch (err) {
      console.error('안내페이지 로드 오류:', err);
      setError('안내페이지를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">로딩 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="fa-solid fa-file-circle-xmark text-2xl text-gray-400"></i>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">페이지를 찾을 수 없습니다</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-rose-500 text-white rounded-lg hover:bg-rose-600 transition-colors"
          >
            홈으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  if (!guide) {
    return null;
  }

  return (
    <div className="min-h-screen bg-white">
      {/* 헤더 */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <i className="fa-solid fa-arrow-left"></i>
          </button>
          <h1 className="text-lg font-semibold text-gray-900 truncate mx-4">{guide.title}</h1>
          <div className="w-10"></div> {/* 균형을 위한 빈 공간 */}
        </div>
      </header>

      {/* 콘텐츠 */}
      <main className="max-w-4xl mx-auto">
        {guide.content ? (
          <iframe
            srcDoc={guide.content}
            className="w-full border-0"
            style={{ minHeight: 'calc(100vh - 60px)' }}
            title={guide.title}
            sandbox="allow-same-origin allow-scripts"
          />
        ) : (
          <div className="p-8 text-center text-gray-500">
            콘텐츠가 없습니다.
          </div>
        )}
      </main>

      {/* 푸터 */}
      <footer className="bg-gray-50 border-t py-6 mt-8">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <p className="text-sm text-gray-500">연이재한의원</p>
        </div>
      </footer>
    </div>
  );
}

export default GuideViewPage;
