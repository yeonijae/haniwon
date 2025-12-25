/**
 * 검사결과책 PDF 생성 컴포넌트
 * - 환자 검사결과 종합 PDF 생성
 * - 표지, 목차, 개별 검사 페이지
 * - AI 종합 분석 포함
 */

import { useState, useRef } from 'react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import type { Patient, ExamResult, ExamType } from '../types';
import { getExamTypeInfo, EXAM_TYPES } from '../types';
import { getFileUrl } from '../lib/fileUpload';
import { generateComprehensiveReport, type ComprehensiveReport } from '../services/aiService';

// jsPDF 확장 타입
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
    lastAutoTable: { finalY: number };
  }
}

interface ExamResultBookProps {
  patient: Patient;
  exams: ExamResult[];
  dateRange: { start: string; end: string };
  onClose: () => void;
}

const ExamResultBook: React.FC<ExamResultBookProps> = ({
  patient,
  exams,
  dateRange,
  onClose,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState('');
  const [includeAI, setIncludeAI] = useState(true);
  const [aiReport, setAiReport] = useState<ComprehensiveReport | null>(null);

  // 나이 계산
  const calculateAge = (birthDate?: string) => {
    if (!birthDate) return 0;
    const birth = new Date(birthDate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  // 이미지를 Base64로 변환
  const loadImageAsBase64 = async (url: string): Promise<string | null> => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  };

  // PDF 생성
  const generatePDF = async () => {
    setIsGenerating(true);
    setProgress(0);

    try {
      // 1. AI 종합 분석 요청 (선택적)
      if (includeAI && exams.length > 0) {
        setProgressText('AI 종합 분석 중...');
        setProgress(5);

        const period = `${dateRange.start} ~ ${dateRange.end}`;
        const result = await generateComprehensiveReport(
          patient.name,
          {
            age: calculateAge(patient.birth_date),
            gender: patient.gender,
          },
          exams,
          period
        );

        if (result.success) {
          setAiReport(result.report);
        }
      }

      setProgressText('PDF 생성 중...');
      setProgress(10);

      // jsPDF 초기화 (A4 세로)
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      // 한글 폰트는 기본 폰트 사용 (실제 환경에서는 한글 폰트 추가 필요)
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;

      // ===== 표지 =====
      setProgressText('표지 생성 중...');

      // 배경색
      doc.setFillColor(139, 92, 246); // purple-500
      doc.rect(0, 0, pageWidth, 100, 'F');

      // 병원명
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.text('하니원 한의원', pageWidth / 2, 40, { align: 'center' });

      // 제목
      doc.setFontSize(32);
      doc.text('검사결과 보고서', pageWidth / 2, 60, { align: 'center' });

      // 기간
      doc.setFontSize(12);
      doc.text(`${dateRange.start} ~ ${dateRange.end}`, pageWidth / 2, 80, { align: 'center' });

      // 환자 정보 박스
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(margin, 130, pageWidth - margin * 2, 60, 5, 5, 'F');

      doc.setTextColor(55, 65, 81); // gray-700
      doc.setFontSize(14);
      doc.text('환자 정보', margin + 10, 145);

      doc.setFontSize(12);
      const patientAge = calculateAge(patient.birth_date);
      const patientGender = patient.gender === 'M' ? '남성' : '여성';
      doc.text(`성명: ${patient.name}`, margin + 10, 160);
      doc.text(`차트번호: ${patient.chart_number || '-'}`, margin + 10, 172);
      doc.text(`나이/성별: ${patientAge}세 / ${patientGender}`, margin + 10, 184);

      // 검사 개요
      doc.setFillColor(249, 250, 251); // gray-50
      doc.roundedRect(margin, 210, pageWidth - margin * 2, 50, 5, 5, 'F');

      doc.setTextColor(55, 65, 81);
      doc.setFontSize(14);
      doc.text('검사 개요', margin + 10, 225);

      doc.setFontSize(11);
      doc.text(`총 검사 횟수: ${exams.length}회`, margin + 10, 240);

      // 검사 유형별 카운트
      const typeCounts: Record<string, number> = {};
      exams.forEach(e => {
        typeCounts[e.exam_type] = (typeCounts[e.exam_type] || 0) + 1;
      });
      const typeCountStr = Object.entries(typeCounts)
        .map(([type, count]) => {
          const info = getExamTypeInfo(type as ExamType);
          return `${info?.name || type}: ${count}회`;
        })
        .join(', ');
      doc.text(`검사 항목: ${typeCountStr}`, margin + 10, 252);

      setProgress(20);

      // ===== 목차 =====
      doc.addPage();
      setProgressText('목차 생성 중...');

      doc.setTextColor(55, 65, 81);
      doc.setFontSize(20);
      doc.text('목 차', pageWidth / 2, 30, { align: 'center' });

      let tocY = 50;
      let pageNum = 3;

      // 목차 항목
      doc.setFontSize(12);
      if (includeAI && aiReport) {
        doc.text(`1. AI 종합 분석 ............................................. ${pageNum}`, margin, tocY);
        tocY += 10;
        pageNum++;
      }

      const groupedByDate = exams.reduce((acc, exam) => {
        if (!acc[exam.exam_date]) acc[exam.exam_date] = [];
        acc[exam.exam_date].push(exam);
        return acc;
      }, {} as Record<string, ExamResult[]>);

      let sectionNum = includeAI && aiReport ? 2 : 1;
      Object.keys(groupedByDate).sort().forEach(date => {
        doc.text(`${sectionNum}. ${date} 검사결과 ......................................... ${pageNum}`, margin, tocY);
        tocY += 10;
        sectionNum++;
        pageNum += Math.ceil(groupedByDate[date].length / 2);
      });

      setProgress(30);

      // ===== AI 종합 분석 페이지 =====
      if (includeAI && aiReport) {
        doc.addPage();
        setProgressText('AI 분석 결과 추가 중...');

        doc.setFillColor(139, 92, 246);
        doc.rect(0, 0, pageWidth, 15, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(14);
        doc.text('AI 종합 분석', margin, 10);

        let y = 30;

        // 종합 요약
        doc.setTextColor(55, 65, 81);
        doc.setFontSize(14);
        doc.text('1. 종합 요약', margin, y);
        y += 8;

        doc.setFontSize(10);
        const summaryLines = doc.splitTextToSize(aiReport.summary, pageWidth - margin * 2);
        doc.text(summaryLines, margin, y);
        y += summaryLines.length * 5 + 10;

        // 검사별 분석
        if (Object.keys(aiReport.by_type).length > 0) {
          doc.setFontSize(14);
          doc.text('2. 검사별 분석', margin, y);
          y += 8;

          doc.setFontSize(10);
          Object.entries(aiReport.by_type).forEach(([type, analysis]) => {
            const info = getExamTypeInfo(type as ExamType);
            doc.setTextColor(139, 92, 246);
            doc.text(`[${info?.name || type}]`, margin, y);
            y += 5;
            doc.setTextColor(55, 65, 81);
            const lines = doc.splitTextToSize(analysis, pageWidth - margin * 2);
            doc.text(lines, margin, y);
            y += lines.length * 5 + 5;

            if (y > pageHeight - 40) {
              doc.addPage();
              y = 30;
            }
          });
          y += 5;
        }

        // 변화 추이
        if (aiReport.progress) {
          doc.setFontSize(14);
          doc.text('3. 변화 추이', margin, y);
          y += 8;

          doc.setFontSize(10);
          const progressLines = doc.splitTextToSize(aiReport.progress, pageWidth - margin * 2);
          doc.text(progressLines, margin, y);
          y += progressLines.length * 5 + 10;
        }

        // 권고사항
        if (aiReport.recommendations) {
          if (y > pageHeight - 60) {
            doc.addPage();
            y = 30;
          }

          doc.setFontSize(14);
          doc.text('4. 권고사항', margin, y);
          y += 8;

          doc.setFontSize(10);
          if (Array.isArray(aiReport.recommendations)) {
            aiReport.recommendations.forEach((rec, i) => {
              doc.text(`${i + 1}. ${rec}`, margin, y);
              y += 6;
            });
          } else {
            const recLines = doc.splitTextToSize(aiReport.recommendations, pageWidth - margin * 2);
            doc.text(recLines, margin, y);
          }
        }
      }

      setProgress(50);

      // ===== 개별 검사 페이지 =====
      const sortedDates = Object.keys(groupedByDate).sort((a, b) => b.localeCompare(a));

      for (let di = 0; di < sortedDates.length; di++) {
        const date = sortedDates[di];
        const dateExams = groupedByDate[date];

        setProgressText(`${date} 검사 추가 중...`);
        setProgress(50 + (di / sortedDates.length) * 40);

        doc.addPage();

        // 날짜 헤더
        doc.setFillColor(139, 92, 246);
        doc.rect(0, 0, pageWidth, 15, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(14);
        doc.text(`${date} 검사결과`, margin, 10);

        let y = 25;

        for (let ei = 0; ei < dateExams.length; ei++) {
          const exam = dateExams[ei];
          const typeInfo = getExamTypeInfo(exam.exam_type);

          // 새 페이지 확인
          if (y > pageHeight - 80) {
            doc.addPage();
            y = 25;
          }

          // 검사 유형 배지
          doc.setFillColor(139, 92, 246);
          doc.roundedRect(margin, y, 40, 8, 2, 2, 'F');
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(10);
          doc.text(typeInfo?.name || exam.exam_type, margin + 2, y + 5.5);

          y += 12;

          // 이미지 (있는 경우)
          if (exam.attachments && exam.attachments.length > 0) {
            const firstAttachment = exam.attachments[0];
            const imageUrl = getFileUrl(firstAttachment.file_path);

            try {
              const base64 = await loadImageAsBase64(imageUrl);
              if (base64) {
                const imgWidth = 80;
                const imgHeight = 60;
                doc.addImage(base64, 'JPEG', margin, y, imgWidth, imgHeight);

                // 소견 (이미지 옆에)
                if (exam.findings) {
                  doc.setTextColor(55, 65, 81);
                  doc.setFontSize(9);
                  const findingsLines = doc.splitTextToSize(exam.findings, pageWidth - margin * 2 - imgWidth - 10);
                  doc.text(findingsLines, margin + imgWidth + 5, y + 5);
                }

                y += imgHeight + 5;
              }
            } catch {
              // 이미지 로드 실패 - 소견만 표시
              if (exam.findings) {
                doc.setTextColor(55, 65, 81);
                doc.setFontSize(9);
                const findingsLines = doc.splitTextToSize(exam.findings, pageWidth - margin * 2);
                doc.text(findingsLines, margin, y);
                y += findingsLines.length * 4 + 5;
              }
            }
          } else if (exam.findings) {
            // 이미지 없이 소견만
            doc.setTextColor(55, 65, 81);
            doc.setFontSize(9);
            const findingsLines = doc.splitTextToSize(exam.findings, pageWidth - margin * 2);
            doc.text(findingsLines, margin, y);
            y += findingsLines.length * 4 + 5;
          }

          // 수치 데이터 (테이블)
          if (exam.values && exam.values.length > 0) {
            const tableData = exam.values.map(v => [
              v.item_name,
              `${v.item_value ?? '-'} ${v.unit || ''}`,
              v.reference_min !== undefined && v.reference_max !== undefined
                ? `${v.reference_min} ~ ${v.reference_max}`
                : '-',
            ]);

            doc.autoTable({
              startY: y,
              head: [['항목', '측정값', '참고범위']],
              body: tableData,
              margin: { left: margin, right: margin },
              styles: { fontSize: 8, cellPadding: 2 },
              headStyles: { fillColor: [139, 92, 246] },
              columnStyles: {
                0: { cellWidth: 50 },
                1: { cellWidth: 40 },
                2: { cellWidth: 40 },
              },
            });

            y = doc.lastAutoTable.finalY + 10;
          }

          y += 10;
        }
      }

      setProgress(95);
      setProgressText('PDF 저장 중...');

      // PDF 저장
      const fileName = `검사결과_${patient.name}_${dateRange.start}_${dateRange.end}.pdf`;
      doc.save(fileName);

      setProgress(100);
      setProgressText('완료!');

      setTimeout(() => {
        onClose();
      }, 1000);

    } catch (error) {
      console.error('PDF 생성 실패:', error);
      alert('PDF 생성에 실패했습니다.');
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
        {/* 헤더 */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">
            <i className="fas fa-file-pdf text-red-500 mr-2"></i>
            검사결과책 생성
          </h2>
          <button
            onClick={onClose}
            disabled={isGenerating}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            <i className="fas fa-times text-xl"></i>
          </button>
        </div>

        {/* 본문 */}
        <div className="p-6 space-y-6">
          {/* 환자 정보 */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <i className="fas fa-user text-gray-400 text-xl"></i>
              <div>
                <div className="font-medium text-gray-900">{patient.name}</div>
                <div className="text-sm text-gray-500">
                  {patient.chart_number} | {calculateAge(patient.birth_date)}세
                </div>
              </div>
            </div>
          </div>

          {/* 기간 */}
          <div className="bg-purple-50 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <i className="fas fa-calendar text-purple-500 text-xl"></i>
              <div>
                <div className="text-sm text-purple-700">검사 기간</div>
                <div className="font-medium text-purple-900">
                  {dateRange.start} ~ {dateRange.end}
                </div>
              </div>
            </div>
          </div>

          {/* 검사 통계 */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-3">
              <i className="fas fa-chart-bar text-gray-400 text-xl"></i>
              <span className="font-medium text-gray-700">포함될 검사</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {EXAM_TYPES.map(type => {
                const count = exams.filter(e => e.exam_type === type.code).length;
                if (count === 0) return null;
                return (
                  <div key={type.code} className="bg-white rounded px-2 py-1 text-sm">
                    <span className="text-gray-600">{type.name}:</span>
                    <span className="font-medium ml-1">{count}회</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* AI 분석 옵션 */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="includeAI"
              checked={includeAI}
              onChange={(e) => setIncludeAI(e.target.checked)}
              className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
            />
            <label htmlFor="includeAI" className="text-sm text-gray-700">
              <i className="fas fa-robot text-purple-500 mr-1"></i>
              AI 종합 분석 포함
            </label>
          </div>

          {/* 진행 상태 */}
          {isGenerating && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">{progressText}</span>
                <span className="text-purple-600 font-medium">{progress}%</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-600 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isGenerating}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
          >
            취소
          </button>
          <button
            onClick={generatePDF}
            disabled={isGenerating || exams.length === 0}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
          >
            {isGenerating ? (
              <>
                <i className="fas fa-spinner fa-spin"></i>
                생성 중...
              </>
            ) : (
              <>
                <i className="fas fa-download"></i>
                PDF 생성
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExamResultBook;
