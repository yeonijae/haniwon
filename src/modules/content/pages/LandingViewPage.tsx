/**
 * 공개 랜딩페이지 뷰어 - 로그인 없이 접근 가능
 */

import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@shared/lib/supabase';

interface LandingPage {
  id: string;
  title: string;
  slug: string;
  content: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  views: number;
}

function LandingViewPage() {
  const { slug } = useParams<{ slug: string }>();
  const [landing, setLanding] = useState<LandingPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (slug) {
      loadLanding(slug);
    }
  }, [slug]);

  async function loadLanding(landingSlug: string) {
    setLoading(true);
    setError(null);

    try {
      // slug로 랜딩페이지 조회
      const { data, error: fetchError } = await supabase
        .from('landing_pages')
        .select('id, title, slug, content, status, start_date, end_date, views')
        .eq('slug', landingSlug)
        .eq('status', 'published')
        .single();

      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          setError('존재하지 않거나 비공개된 랜딩페이지입니다.');
        } else {
          setError('랜딩페이지를 불러오는데 실패했습니다.');
        }
        return;
      }

      // 기간 체크
      const now = new Date();
      now.setHours(0, 0, 0, 0);

      if (data.start_date) {
        const startDate = new Date(data.start_date);
        if (now < startDate) {
          setError('아직 공개되지 않은 페이지입니다.');
          return;
        }
      }

      if (data.end_date) {
        const endDate = new Date(data.end_date);
        endDate.setHours(23, 59, 59, 999);
        if (now > endDate) {
          setError('종료된 이벤트입니다.');
          return;
        }
      }

      setLanding(data);

      // 조회수 증가
      await supabase
        .from('landing_pages')
        .update({ views: (data.views || 0) + 1 })
        .eq('id', data.id);

    } catch (err) {
      console.error('랜딩페이지 로드 오류:', err);
      setError('랜딩페이지를 불러오는데 실패했습니다.');
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
          <a
            href="/"
            className="inline-block px-4 py-2 bg-rose-500 text-white rounded-lg hover:bg-rose-600 transition-colors"
          >
            홈으로 돌아가기
          </a>
        </div>
      </div>
    );
  }

  if (!landing) {
    return null;
  }

  // 랜딩페이지는 전체 화면으로 콘텐츠 표시 (헤더 없이)
  return (
    <div className="min-h-screen bg-white">
      {landing.content ? (
        <iframe
          srcDoc={landing.content}
          className="w-full h-screen border-0"
          title={landing.title}
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
        />
      ) : (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center text-gray-500">
            <i className="fa-solid fa-file-circle-question text-4xl mb-4"></i>
            <p>콘텐츠가 없습니다.</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default LandingViewPage;
