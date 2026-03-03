/**
 * AI 분석 서비스 (Gemini)
 */

import type { ExamResult, ExamType, ExamValue } from '../types';

const AI_API_URL = import.meta.env.VITE_POSTGRES_API_URL || 'http://192.168.0.173:5200';

export interface AnalysisResult {
  success: boolean;
  analysis: string;
  model: string;
  error?: string;
}

export interface ComprehensiveReport {
  summary: string;
  by_type: Record<string, string>;
  progress: string;
  recommendations: string | string[];
}

export interface ComprehensiveResult {
  success: boolean;
  report: ComprehensiveReport;
  model: string;
  error?: string;
}

/**
 * AI API 상태 확인
 */
export async function checkAIStatus(): Promise<{
  available: boolean;
  model: string;
  examTypes: string[];
}> {
  try {
    const response = await fetch(`${AI_API_URL}/api/ai/info`);
    const data = await response.json();
    return {
      available: data.available || false,
      model: data.model || '',
      examTypes: data.exam_types || [],
    };
  } catch (error) {
    return {
      available: false,
      model: '',
      examTypes: [],
    };
  }
}

/**
 * 검사 이미지 분석
 */
export async function analyzeExamImage(
  examType: ExamType,
  imageUrl: string,
  values?: ExamValue[],
  previousFindings?: string
): Promise<AnalysisResult> {
  try {
    const response = await fetch(`${AI_API_URL}/api/ai/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        exam_type: examType,
        image_url: imageUrl,
        values: values?.map(v => ({
          item_name: v.item_name,
          item_value: v.item_value,
          unit: v.unit,
        })),
        previous_findings: previousFindings,
      }),
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      return {
        success: false,
        analysis: '',
        model: '',
        error: data.error || 'AI 분석 요청 실패',
      };
    }

    return {
      success: true,
      analysis: data.analysis,
      model: data.model,
    };
  } catch (error: any) {
    return {
      success: false,
      analysis: '',
      model: '',
      error: error.message || 'AI 서비스 연결 실패',
    };
  }
}

/**
 * Base64 이미지로 분석
 */
export async function analyzeExamImageBase64(
  examType: ExamType,
  imageBase64: string,
  values?: ExamValue[],
  previousFindings?: string
): Promise<AnalysisResult> {
  try {
    const response = await fetch(`${AI_API_URL}/api/ai/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        exam_type: examType,
        image_base64: imageBase64,
        values: values?.map(v => ({
          item_name: v.item_name,
          item_value: v.item_value,
          unit: v.unit,
        })),
        previous_findings: previousFindings,
      }),
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      return {
        success: false,
        analysis: '',
        model: '',
        error: data.error || 'AI 분석 요청 실패',
      };
    }

    return {
      success: true,
      analysis: data.analysis,
      model: data.model,
    };
  } catch (error: any) {
    return {
      success: false,
      analysis: '',
      model: '',
      error: error.message || 'AI 서비스 연결 실패',
    };
  }
}

/**
 * 종합 분석 리포트 생성
 */
export async function generateComprehensiveReport(
  patientName: string,
  patientInfo: { age?: number; gender?: 'M' | 'F' },
  exams: ExamResult[],
  period: string
): Promise<ComprehensiveResult> {
  try {
    const response = await fetch(`${AI_API_URL}/api/ai/comprehensive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patient_name: patientName,
        patient_info: patientInfo,
        exams: exams.map(e => ({
          exam_type: e.exam_type,
          exam_date: e.exam_date,
          findings: e.findings,
          values: e.values?.map(v => ({
            item_name: v.item_name,
            item_value: v.item_value,
            unit: v.unit,
          })),
        })),
        period,
      }),
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      return {
        success: false,
        report: {
          summary: '',
          by_type: {},
          progress: '',
          recommendations: '',
        },
        model: '',
        error: data.error || '종합 분석 요청 실패',
      };
    }

    return {
      success: true,
      report: data.report,
      model: data.model,
    };
  } catch (error: any) {
    return {
      success: false,
      report: {
        summary: '',
        by_type: {},
        progress: '',
        recommendations: '',
      },
      model: '',
      error: error.message || 'AI 서비스 연결 실패',
    };
  }
}

/**
 * 검사 유형별 분석 프롬프트 힌트
 */
export const EXAM_ANALYSIS_HINTS: Record<ExamType, string> = {
  biochemistry: '간기능/신장기능/지질/혈당 등 생화학 수치를 분석합니다.',
  cbc: '혈구 수치(WBC, RBC, Hb, PLT 등)와 염증/빈혈 경향을 분석합니다.',
  hormone: '갑상선·성호르몬·스트레스 관련 호르몬 수치를 분석합니다.',
  inbody770: '체성분(근육량, 체지방률, 부위별 균형)을 분석합니다.',
  iris8000: '체열 분포, 좌우 대칭성, 순환 패턴을 분석합니다.',
  ibalance: '체형 정렬, 자세 불균형, 좌우 편차를 분석합니다.',
  omnifit: '뇌파 및 자율신경 균형(교감/부교감) 패턴을 분석합니다.',
  tongue: '설질, 설태, 설하맥 특징을 분석합니다.',
  pulse_dayo: '맥상, 맥력, 맥률 및 변동성을 분석합니다.',
  balance: '평형 감각과 무게중심 분포를 분석합니다.',
};
