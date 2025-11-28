/**
 * SEO Head 컴포넌트
 * - 메타 태그 관리
 * - Open Graph
 * - Twitter Card
 * - JSON-LD 구조화 데이터
 */

import { useEffect } from 'react';
import type { SEOMetadata, BlogPost } from '../types';

interface SEOHeadProps {
  metadata: SEOMetadata;
}

// 메타 태그 설정 헬퍼
function setMetaTag(name: string, content: string, isProperty = false) {
  const attr = isProperty ? 'property' : 'name';
  let element = document.querySelector(`meta[${attr}="${name}"]`);

  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attr, name);
    document.head.appendChild(element);
  }

  element.setAttribute('content', content);
}

// 링크 태그 설정 헬퍼
function setLinkTag(rel: string, href: string) {
  let element = document.querySelector(`link[rel="${rel}"]`);

  if (!element) {
    element = document.createElement('link');
    element.setAttribute('rel', rel);
    document.head.appendChild(element);
  }

  element.setAttribute('href', href);
}

// JSON-LD 스크립트 설정
function setJsonLd(data: Record<string, unknown>) {
  const scriptId = 'json-ld-seo';
  let script = document.getElementById(scriptId) as HTMLScriptElement;

  if (!script) {
    script = document.createElement('script');
    script.id = scriptId;
    script.type = 'application/ld+json';
    document.head.appendChild(script);
  }

  script.textContent = JSON.stringify(data);
}

export const SEOHead: React.FC<SEOHeadProps> = ({ metadata }) => {
  useEffect(() => {
    // 타이틀 설정
    document.title = metadata.title;

    // 기본 메타 태그
    setMetaTag('description', metadata.description);
    if (metadata.keywords?.length) {
      setMetaTag('keywords', metadata.keywords.join(', '));
    }

    // Canonical URL
    if (metadata.canonicalUrl) {
      setLinkTag('canonical', metadata.canonicalUrl);
    }

    // Open Graph
    setMetaTag('og:type', metadata.ogType || 'website', true);
    setMetaTag('og:title', metadata.ogTitle || metadata.title, true);
    setMetaTag('og:description', metadata.ogDescription || metadata.description, true);
    if (metadata.ogImage) {
      setMetaTag('og:image', metadata.ogImage, true);
    }
    if (metadata.canonicalUrl) {
      setMetaTag('og:url', metadata.canonicalUrl, true);
    }
    setMetaTag('og:site_name', '연이재한의원 건강정보', true);
    setMetaTag('og:locale', 'ko_KR', true);

    // Twitter Card
    setMetaTag('twitter:card', metadata.twitterCard || 'summary_large_image');
    setMetaTag('twitter:title', metadata.ogTitle || metadata.title);
    setMetaTag('twitter:description', metadata.ogDescription || metadata.description);
    if (metadata.ogImage) {
      setMetaTag('twitter:image', metadata.ogImage);
    }

    // JSON-LD 구조화 데이터
    if (metadata.jsonLd) {
      setJsonLd(metadata.jsonLd);
    }

    // 클린업
    return () => {
      // JSON-LD 제거
      const script = document.getElementById('json-ld-seo');
      if (script) {
        script.remove();
      }
    };
  }, [metadata]);

  return null;
};

// 블로그 포스트용 SEO 메타데이터 생성
export function generatePostSEO(post: BlogPost, baseUrl: string): SEOMetadata {
  const url = `${baseUrl}/blog/${post.slug}`;
  const image = post.ogImage || post.thumbnailUrl;

  // Article JSON-LD
  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.excerpt,
    image: image ? [image] : undefined,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt || post.publishedAt,
    author: {
      '@type': 'Person',
      name: post.authorName,
    },
    publisher: {
      '@type': 'Organization',
      name: '연이재한의원',
      logo: {
        '@type': 'ImageObject',
        url: `${baseUrl}/logo.png`,
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': url,
    },
  };

  return {
    title: post.metaTitle || `${post.title} | 연이재한의원`,
    description: post.metaDescription || post.excerpt,
    keywords: post.metaKeywords || post.tags,
    canonicalUrl: post.canonicalUrl || url,
    ogType: 'article',
    ogTitle: post.metaTitle || post.title,
    ogDescription: post.metaDescription || post.excerpt,
    ogImage: image,
    twitterCard: 'summary_large_image',
    jsonLd,
  };
}

// 블로그 목록 페이지용 SEO 메타데이터
export function generateListSEO(
  category?: string,
  page?: number,
  baseUrl?: string
): SEOMetadata {
  const categoryLabel = category
    ? {
        health_info: '건강정보',
        treatment_guide: '치료안내',
        clinic_news: '한의원소식',
        lifestyle: '생활건강',
        case_study: '치료사례',
        faq: 'FAQ',
      }[category] || category
    : null;

  const title = categoryLabel
    ? `${categoryLabel} | 연이재한의원 건강정보`
    : '건강정보 블로그 | 연이재한의원';

  const description = categoryLabel
    ? `연이재한의원의 ${categoryLabel} 관련 건강정보를 확인하세요. 한의학 전문의가 알려드리는 건강 꿀팁!`
    : '연이재한의원의 건강정보 블로그입니다. 디스크, 관절, 통증 치료 정보와 생활건강 팁을 확인하세요.';

  const url = baseUrl
    ? category
      ? `${baseUrl}/blog/category/${category}${page && page > 1 ? `?page=${page}` : ''}`
      : `${baseUrl}/blog${page && page > 1 ? `?page=${page}` : ''}`
    : undefined;

  // WebSite JSON-LD
  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: '연이재한의원 건강정보',
    description,
    url: baseUrl ? `${baseUrl}/blog` : undefined,
    publisher: {
      '@type': 'Organization',
      name: '연이재한의원',
    },
  };

  return {
    title,
    description,
    canonicalUrl: url,
    ogType: 'website',
    ogTitle: title,
    ogDescription: description,
    twitterCard: 'summary',
    jsonLd,
  };
}

export default SEOHead;
