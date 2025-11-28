/**
 * 블로그 구독 페이지
 * - 카카오 알림톡 구독
 * - 이메일 구독
 * - 카테고리 선택
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { SEOHead } from '../components/SEOHead';
import type { SubscribeForm, BlogCategory, SubscribeType } from '../types';
import { BLOG_CATEGORY_LABELS, BLOG_CATEGORY_ICONS } from '../types';

const SubscribePage: React.FC = () => {
  const [step, setStep] = useState<'form' | 'success'>('form');
  const [subscribeType, setSubscribeType] = useState<SubscribeType>('kakao');
  const [form, setForm] = useState<SubscribeForm>({
    name: '',
    phone: '',
    email: '',
    subscribeType: 'kakao',
    categories: [],
    marketingConsent: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const categories = Object.keys(BLOG_CATEGORY_LABELS) as BlogCategory[];

  // 카테고리 토글
  const toggleCategory = (cat: BlogCategory) => {
    setForm((prev) => ({
      ...prev,
      categories: prev.categories?.includes(cat)
        ? prev.categories.filter((c) => c !== cat)
        : [...(prev.categories || []), cat],
    }));
  };

  // 구독 제출
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 유효성 검사
    if (!form.name?.trim()) {
      alert('이름을 입력해주세요.');
      return;
    }

    if (subscribeType === 'kakao' || subscribeType === 'both') {
      if (!form.phone?.trim()) {
        alert('휴대폰 번호를 입력해주세요.');
        return;
      }
      // 휴대폰 번호 형식 검사
      const phoneRegex = /^01[0-9]-?[0-9]{4}-?[0-9]{4}$/;
      if (!phoneRegex.test(form.phone.replace(/-/g, ''))) {
        alert('올바른 휴대폰 번호를 입력해주세요.');
        return;
      }
    }

    if (subscribeType === 'email' || subscribeType === 'both') {
      if (!form.email?.trim()) {
        alert('이메일을 입력해주세요.');
        return;
      }
      // 이메일 형식 검사
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(form.email)) {
        alert('올바른 이메일 주소를 입력해주세요.');
        return;
      }
    }

    if (!form.marketingConsent) {
      alert('마케팅 정보 수신에 동의해주세요.');
      return;
    }

    setIsSubmitting(true);

    try {
      // API 호출 (실제 구현 시)
      // await fetch('/api/blog/subscribe', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ ...form, subscribeType }),
      // });

      console.log('Subscribe:', { ...form, subscribeType });

      // 성공
      await new Promise((resolve) => setTimeout(resolve, 1000)); // 시뮬레이션
      setStep('success');
    } catch (error) {
      alert('구독 신청 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // SEO
  const seoMetadata = {
    title: '건강정보 구독하기 | 연이재한의원',
    description: '연이재한의원의 건강정보를 카카오톡이나 이메일로 받아보세요. 새 글 알림을 가장 먼저 받아볼 수 있습니다.',
    canonicalUrl: `${window.location.origin}/blog/subscribe`,
    ogType: 'website' as const,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <SEOHead metadata={seoMetadata} />

      {/* 헤더 */}
      <header className="bg-white shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <Link to="/blog" className="flex items-center gap-3">
            <span className="text-2xl">🏥</span>
            <div>
              <h1 className="text-lg font-bold text-gray-800">연이재한의원</h1>
              <p className="text-xs text-gray-500">건강정보 블로그</p>
            </div>
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-12">
        {step === 'form' ? (
          <>
            {/* 타이틀 */}
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="fa-solid fa-bell text-3xl text-yellow-600"></i>
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">
                건강정보 구독하기
              </h2>
              <p className="text-gray-600">
                새로운 건강정보를 가장 먼저 받아보세요!
              </p>
            </div>

            {/* 구독 방식 선택 */}
            <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
              <h3 className="font-bold text-gray-800 mb-4">알림 받을 방법</h3>
              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setSubscribeType('kakao')}
                  className={`p-4 rounded-lg border-2 transition-colors ${
                    subscribeType === 'kakao'
                      ? 'border-yellow-400 bg-yellow-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <i className="fa-solid fa-comment text-2xl text-yellow-500 mb-2"></i>
                  <p className="font-medium text-gray-800">카카오톡</p>
                  <p className="text-xs text-gray-500">알림톡 발송</p>
                </button>

                <button
                  type="button"
                  onClick={() => setSubscribeType('email')}
                  className={`p-4 rounded-lg border-2 transition-colors ${
                    subscribeType === 'email'
                      ? 'border-blue-400 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <i className="fa-solid fa-envelope text-2xl text-blue-500 mb-2"></i>
                  <p className="font-medium text-gray-800">이메일</p>
                  <p className="text-xs text-gray-500">뉴스레터</p>
                </button>

                <button
                  type="button"
                  onClick={() => setSubscribeType('both')}
                  className={`p-4 rounded-lg border-2 transition-colors ${
                    subscribeType === 'both'
                      ? 'border-green-400 bg-green-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <i className="fa-solid fa-check-double text-2xl text-green-500 mb-2"></i>
                  <p className="font-medium text-gray-800">둘 다</p>
                  <p className="text-xs text-gray-500">놓치지 않게</p>
                </button>
              </div>
            </div>

            {/* 구독 폼 */}
            <form onSubmit={handleSubmit}>
              <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                <h3 className="font-bold text-gray-800 mb-4">기본 정보</h3>

                {/* 이름 */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    이름 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="홍길동"
                    className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>

                {/* 휴대폰 */}
                {(subscribeType === 'kakao' || subscribeType === 'both') && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      휴대폰 번호 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                      placeholder="010-1234-5678"
                      className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      카카오톡 알림톡으로 새 글 알림을 보내드립니다.
                    </p>
                  </div>
                )}

                {/* 이메일 */}
                {(subscribeType === 'email' || subscribeType === 'both') && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      이메일 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                      placeholder="example@email.com"
                      className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                )}
              </div>

              {/* 관심 카테고리 */}
              <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                <h3 className="font-bold text-gray-800 mb-2">관심 카테고리</h3>
                <p className="text-sm text-gray-500 mb-4">
                  선택하지 않으면 모든 글의 알림을 받습니다.
                </p>

                <div className="grid grid-cols-2 gap-3">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => toggleCategory(cat)}
                      className={`p-3 rounded-lg border text-left transition-colors flex items-center gap-2 ${
                        form.categories?.includes(cat)
                          ? 'border-green-500 bg-green-50 text-green-700'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <i className={`${BLOG_CATEGORY_ICONS[cat]} text-lg`}></i>
                      <span className="font-medium">{BLOG_CATEGORY_LABELS[cat]}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 동의 */}
              <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.marketingConsent}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, marketingConsent: e.target.checked }))
                    }
                    className="mt-1 w-5 h-5 text-green-600 rounded focus:ring-green-500"
                  />
                  <div>
                    <p className="font-medium text-gray-800">
                      마케팅 정보 수신 동의 <span className="text-red-500">*</span>
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      연이재한의원의 건강정보, 이벤트, 프로모션 등의 소식을 받아보시겠습니까?
                      언제든지 구독을 취소할 수 있습니다.
                    </p>
                  </div>
                </label>
              </div>

              {/* 제출 버튼 */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-4 bg-green-600 text-white rounded-xl font-bold text-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <i className="fa-solid fa-spinner animate-spin"></i>
                    구독 신청 중...
                  </span>
                ) : (
                  '구독하기'
                )}
              </button>
            </form>
          </>
        ) : (
          /* 성공 화면 */
          <div className="text-center py-12">
            <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <i className="fa-solid fa-check text-4xl text-green-600"></i>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-4">
              구독 신청 완료!
            </h2>
            <p className="text-gray-600 mb-8">
              {subscribeType === 'kakao' && '카카오톡으로 새 글 알림을 보내드릴게요.'}
              {subscribeType === 'email' && '이메일로 새 글 알림을 보내드릴게요.'}
              {subscribeType === 'both' && '카카오톡과 이메일로 새 글 알림을 보내드릴게요.'}
            </p>

            <div className="bg-yellow-50 rounded-xl p-6 mb-8 max-w-md mx-auto">
              <p className="text-sm text-gray-700">
                <i className="fa-solid fa-lightbulb text-yellow-500 mr-2"></i>
                첫 알림을 받으시면 발신번호를 저장해두시면 스팸으로 분류되지 않아요!
              </p>
            </div>

            <Link
              to="/blog"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <i className="fa-solid fa-arrow-left"></i>
              블로그로 돌아가기
            </Link>
          </div>
        )}
      </main>

      {/* 푸터 */}
      <footer className="bg-gray-800 text-gray-300 py-8 mt-auto">
        <div className="max-w-2xl mx-auto px-4 text-center text-sm">
          <p>&copy; 2024 연이재한의원. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default SubscribePage;
