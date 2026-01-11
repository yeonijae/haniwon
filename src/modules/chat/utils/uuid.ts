/**
 * HTTP에서도 작동하는 UUID 생성 함수
 * crypto.randomUUID()는 HTTPS에서만 작동하므로 폴백 제공
 */
export function generateUUID(): string {
  // crypto.randomUUID가 있으면 사용 (HTTPS 환경)
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  // 폴백: HTTP 환경에서도 작동하는 UUID v4 생성
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
