import { GoogleGenerativeAI } from '@google/generative-ai';

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

if (!API_KEY) {
  console.warn('Gemini API Key가 설정되지 않았습니다. .env.local에 VITE_GEMINI_API_KEY를 추가하세요.');
}

export const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;

// Gemini 2.5 Flash 모델 사용 (최신 버전, 더 높은 성능)
export const getModel = () => {
  if (!genAI) return null;
  return genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
};
