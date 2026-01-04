/**
 * 로컬 서버 파일 업로드 유틸리티
 */

import type { UploadResult, ExamType } from '../types';

const FILE_API_URL = import.meta.env.VITE_POSTGRES_API_URL || 'http://192.168.0.173:3200';

/**
 * 로컬 서버에 파일 업로드
 */
export async function uploadExamFile(
  file: File,
  patientId: number,
  examType: ExamType
): Promise<UploadResult> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('patient_id', String(patientId));
  formData.append('exam_type', examType);
  formData.append('category', 'exams');

  const response = await fetch(`${FILE_API_URL}/api/files/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || '파일 업로드 실패');
  }

  return response.json();
}

/**
 * 여러 파일 업로드
 */
export async function uploadExamFiles(
  files: File[],
  patientId: number,
  examType: ExamType,
  onProgress?: (completed: number, total: number) => void
): Promise<UploadResult[]> {
  const results: UploadResult[] = [];

  for (let i = 0; i < files.length; i++) {
    const result = await uploadExamFile(files[i], patientId, examType);
    results.push(result);
    onProgress?.(i + 1, files.length);
  }

  return results;
}

/**
 * 파일 URL 생성
 */
export function getFileUrl(filePath: string): string {
  if (!filePath) return '';
  if (filePath.startsWith('http')) return filePath;
  return `${FILE_API_URL}/api/files/${filePath}`;
}

/**
 * 썸네일 URL 생성
 */
export function getThumbnailUrl(thumbnailPath: string | undefined): string {
  if (!thumbnailPath) return '';
  if (thumbnailPath.startsWith('http')) return thumbnailPath;
  return `${FILE_API_URL}/api/files/thumbnails/${thumbnailPath}`;
}

/**
 * 파일 삭제
 */
export async function deleteExamFile(filePath: string): Promise<boolean> {
  const response = await fetch(`${FILE_API_URL}/api/files/${filePath}`, {
    method: 'DELETE',
  });
  return response.ok;
}

/**
 * 파일 크기 포맷
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * 파일 확장자 확인
 */
export function isImageFile(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'tif'].includes(ext);
}

export function isPdfFile(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return ext === 'pdf';
}
