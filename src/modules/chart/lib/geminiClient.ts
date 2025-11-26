import { GoogleGenerativeAI } from '@google/generative-ai';

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

if (!API_KEY) {
  console.warn('Gemini API Key가 설정되지 않았습니다. .env.local에 VITE_GEMINI_API_KEY를 추가하세요.');
}

export const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;

// Gemini 2.0 Flash 모델 사용 (빠르고 무료 티어 있음)
export const getModel = () => {
  if (!genAI) return null;
  return genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
};
