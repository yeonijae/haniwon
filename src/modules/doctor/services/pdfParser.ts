/**
 * 브라우저에서 PDF 파일을 파싱하여 복용법 템플릿 데이터를 추출하는 서비스
 */

import * as pdfjsLib from 'pdfjs-dist';

// PDF.js 워커 설정
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export interface ParsedTemplate {
  category: string;
  subcategory: string;
  disease_name: string;
  condition_detail: string;
  description: string;
  dosage_method: string;
  precautions: string;
  keywords: string[];
  full_text: string;
  source_filename: string;
}

/**
 * PDF 파일에서 텍스트 추출
 */
export async function extractTextFromPDF(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  let fullText = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((item: any) => item.str)
      .join(' ');
    fullText += text + '\n';
  }

  return fullText.trim();
}

/**
 * 파일명에서 정보 추출
 * 예: [소아]ADHD-리열+심기부족(뉴).pdf
 *     [소화기]담적증(뉴)-반백천.pdf
 */
export function parseFilename(filename: string): {
  subcategory: string;
  diseaseName: string;
  conditionDetail: string;
} {
  // 확장자 제거
  const name = filename.replace(/\.pdf$/i, '');

  // [카테고리] 추출
  const categoryMatch = name.match(/^\[([^\]]+)\]/);
  const subcategory = categoryMatch ? categoryMatch[1] : '';

  // 나머지 부분
  const rest = name.replace(/^\[[^\]]+\]/, '').trim();

  // (뉴) 등의 태그 제거
  const cleanRest = rest.replace(/\([^)]*\)/g, '').trim();

  // - 로 분리하여 질환명과 세부상태 추출
  const parts = cleanRest.split('-');
  const diseaseName = parts[0] || '';
  const conditionDetail = parts.slice(1).join('-') || '';

  return {
    subcategory,
    diseaseName,
    conditionDetail
  };
}

/**
 * 텍스트에서 섹션별 내용 추출
 */
export function parseSections(fullText: string): {
  description: string;
  dosageMethod: string;
  precautions: string;
} {
  let description = '';
  let dosageMethod = '';
  let precautions = '';

  // 一. 설명 섹션
  const descMatch = fullText.match(/一\s*[\.．]\s*설명([\s\S]*?)(?=二\s*[\.．]|$)/);
  if (descMatch) {
    description = descMatch[1].trim();
  }

  // 二. 복용법 섹션
  const dosageMatch = fullText.match(/二\s*[\.．]\s*복용법([\s\S]*?)(?=三\s*[\.．]|$)/);
  if (dosageMatch) {
    dosageMethod = dosageMatch[1].trim();
  }

  // 三. 주의사항 섹션
  const precautionMatch = fullText.match(/三\s*[\.．]\s*주의사항([\s\S]*?)$/);
  if (precautionMatch) {
    precautions = precautionMatch[1].trim();
  }

  return { description, dosageMethod, precautions };
}

/**
 * 키워드 추출
 */
export function extractKeywords(
  diseaseName: string,
  conditionDetail: string
): string[] {
  const keywords = new Set<string>();

  // 질환명 추가
  if (diseaseName) {
    keywords.add(diseaseName);
    // 영문/한글 분리
    const parts = diseaseName.split(/[-+,\s]/);
    parts.forEach(p => p && keywords.add(p.trim()));
  }

  // 세부 상태 추가
  if (conditionDetail) {
    const parts = conditionDetail.split(/[-+,\s]/);
    parts.forEach(p => p && keywords.add(p.trim()));
  }

  return Array.from(keywords).filter(k => k.length > 1);
}

/**
 * PDF 파일을 파싱하여 템플릿 데이터 추출
 */
export async function parsePDFToTemplate(file: File): Promise<ParsedTemplate> {
  // PDF 텍스트 추출
  const fullText = await extractTextFromPDF(file);

  // 파일명 파싱
  const { subcategory, diseaseName, conditionDetail } = parseFilename(file.name);

  // 섹션별 파싱
  const { description, dosageMethod, precautions } = parseSections(fullText);

  // 키워드 추출
  const keywords = extractKeywords(diseaseName, conditionDetail);

  return {
    category: '', // 사용자가 선택하도록 비워둠
    subcategory,
    disease_name: diseaseName,
    condition_detail: conditionDetail,
    description,
    dosage_method: dosageMethod,
    precautions,
    keywords,
    full_text: fullText,
    source_filename: file.name
  };
}
