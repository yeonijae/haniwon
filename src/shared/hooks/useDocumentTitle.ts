import { useEffect } from 'react';

/**
 * 브라우저 탭 타이틀을 설정하는 훅
 * @param title - 표시할 타이틀 (예: "진료관리")
 * @param suffix - 접미사 (기본값: "연이재한의원")
 */
export function useDocumentTitle(title: string, suffix: string = '연이재한의원') {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = `${title} | ${suffix}`;

    return () => {
      document.title = previousTitle;
    };
  }, [title, suffix]);
}

export default useDocumentTitle;
