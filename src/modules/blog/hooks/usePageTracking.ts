/**
 * 페이지 추적 훅
 * - 방문자 ID 관리
 * - 체류 시간 측정
 * - 스크롤 깊이 추적
 * - 읽기 완료율 계산
 */

import { useEffect, useRef, useCallback } from 'react';
import type { PageViewEvent, PageExitEvent, ConversionEvent } from '../types';

// 방문자 ID 생성/가져오기
function getVisitorId(): string {
  const key = 'yeonijae_visitor_id';
  let visitorId = localStorage.getItem(key);

  if (!visitorId) {
    visitorId = `v_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    localStorage.setItem(key, visitorId);
  }

  return visitorId;
}

// 세션 ID 생성/가져오기
function getSessionId(): string {
  const key = 'yeonijae_session_id';
  const expireKey = 'yeonijae_session_expire';
  const sessionDuration = 30 * 60 * 1000; // 30분

  const now = Date.now();
  const expire = parseInt(sessionStorage.getItem(expireKey) || '0');

  if (expire && now < expire) {
    // 세션 유효 - 만료 시간 연장
    sessionStorage.setItem(expireKey, String(now + sessionDuration));
    return sessionStorage.getItem(key) || '';
  }

  // 새 세션 생성
  const sessionId = `s_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  sessionStorage.setItem(key, sessionId);
  sessionStorage.setItem(expireKey, String(now + sessionDuration));

  return sessionId;
}

// UTM 파라미터 파싱
function getUtmParams(): { source?: string; medium?: string; campaign?: string; trackingId?: string } {
  const params = new URLSearchParams(window.location.search);
  return {
    source: params.get('utm_source') || undefined,
    medium: params.get('utm_medium') || undefined,
    campaign: params.get('utm_campaign') || undefined,
    trackingId: params.get('t') || params.get('tid') || undefined,  // DM 추적 ID
  };
}

interface UsePageTrackingOptions {
  postId: string;
  onPageView?: (event: PageViewEvent) => void;
  onPageExit?: (event: PageExitEvent) => void;
  onConversion?: (event: ConversionEvent) => void;
  contentSelector?: string;  // 본문 영역 선택자 (스크롤 계산용)
}

export function usePageTracking({
  postId,
  onPageView,
  onPageExit,
  onConversion,
  contentSelector = '.blog-content',
}: UsePageTrackingOptions) {
  const startTime = useRef<number>(Date.now());
  const maxScrollDepth = useRef<number>(0);
  const visitorId = useRef<string>('');
  const sessionId = useRef<string>('');
  const hasTrackedView = useRef<boolean>(false);

  // 스크롤 깊이 계산
  const calculateScrollDepth = useCallback((): number => {
    const content = document.querySelector(contentSelector);
    if (!content) {
      // 전체 페이지 기준
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      return docHeight > 0 ? Math.round((scrollTop / docHeight) * 100) : 0;
    }

    // 본문 영역 기준
    const rect = content.getBoundingClientRect();
    const contentTop = rect.top + window.scrollY;
    const contentHeight = rect.height;
    const scrollBottom = window.scrollY + window.innerHeight;
    const scrolledContent = scrollBottom - contentTop;

    return contentHeight > 0
      ? Math.min(100, Math.max(0, Math.round((scrolledContent / contentHeight) * 100)))
      : 0;
  }, [contentSelector]);

  // 읽기 완료율 계산 (체류시간 + 스크롤 기반)
  const calculateReadCompletion = useCallback((dwellTime: number, scrollDepth: number): number => {
    // 스크롤 70% 이상 + 체류시간 가중치
    const scrollWeight = Math.min(scrollDepth / 100, 1);
    const timeWeight = Math.min(dwellTime / 180, 1);  // 3분 기준

    // 두 가중치의 평균
    return Math.round(((scrollWeight * 0.6) + (timeWeight * 0.4)) * 100);
  }, []);

  // 페이지 뷰 이벤트 발송
  const trackPageView = useCallback(() => {
    if (hasTrackedView.current) return;
    hasTrackedView.current = true;

    visitorId.current = getVisitorId();
    sessionId.current = getSessionId();
    const utm = getUtmParams();

    const event: PageViewEvent = {
      postId,
      visitorId: visitorId.current,
      sessionId: sessionId.current,
      referrer: document.referrer || undefined,
      utmSource: utm.source,
      utmMedium: utm.medium,
      utmCampaign: utm.campaign,
      trackingId: utm.trackingId,
    };

    onPageView?.(event);

    // API 호출 (실제 구현 시)
    // fetch('/api/blog/track/view', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(event),
    // });

    console.log('[PageTracking] View:', event);
  }, [postId, onPageView]);

  // 페이지 이탈 이벤트 발송
  const trackPageExit = useCallback(() => {
    const dwellTime = Math.round((Date.now() - startTime.current) / 1000);
    const scrollDepth = maxScrollDepth.current;
    const readCompletion = calculateReadCompletion(dwellTime, scrollDepth);

    const event: PageExitEvent = {
      postId,
      visitorId: visitorId.current,
      sessionId: sessionId.current,
      dwellTime,
      scrollDepth,
      readCompletion,
    };

    onPageExit?.(event);

    // Beacon API로 안전하게 전송 (페이지 이탈 시에도 전송 보장)
    // navigator.sendBeacon('/api/blog/track/exit', JSON.stringify(event));

    console.log('[PageTracking] Exit:', event);
  }, [postId, onPageExit, calculateReadCompletion]);

  // 전환 이벤트 추적
  const trackConversion = useCallback((
    conversionType: ConversionEvent['conversionType']
  ) => {
    const event: ConversionEvent = {
      postId,
      visitorId: visitorId.current,
      conversionType,
    };

    onConversion?.(event);

    // API 호출 (실제 구현 시)
    // fetch('/api/blog/track/conversion', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(event),
    // });

    console.log('[PageTracking] Conversion:', event);
  }, [postId, onConversion]);

  // 스크롤 이벤트 핸들러
  useEffect(() => {
    const handleScroll = () => {
      const currentDepth = calculateScrollDepth();
      if (currentDepth > maxScrollDepth.current) {
        maxScrollDepth.current = currentDepth;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [calculateScrollDepth]);

  // 페이지 진입 시 추적
  useEffect(() => {
    trackPageView();
  }, [trackPageView]);

  // 페이지 이탈 시 추적
  useEffect(() => {
    const handleBeforeUnload = () => {
      trackPageExit();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        trackPageExit();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      trackPageExit();  // 컴포넌트 언마운트 시
    };
  }, [trackPageExit]);

  return {
    visitorId: visitorId.current,
    sessionId: sessionId.current,
    trackConversion,
    getStats: () => ({
      dwellTime: Math.round((Date.now() - startTime.current) / 1000),
      scrollDepth: maxScrollDepth.current,
    }),
  };
}

export default usePageTracking;
