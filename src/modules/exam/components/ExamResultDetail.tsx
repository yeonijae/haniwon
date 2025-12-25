import { useState } from 'react';
import type { ExamResult, ExamAttachment } from '../types';
import { getExamTypeInfo, getExamTypeStyles } from '../types';
import { getFileUrl, getThumbnailUrl, isImageFile, isPdfFile } from '../lib/fileUpload';
import { deleteExamResult, updateExamResult, updateAttachmentCaption } from '../services/examService';
import ExamImageViewer from './ExamImageViewer';
import ExamAIAnalysis from './ExamAIAnalysis';

interface ExamResultDetailProps {
  exam: ExamResult;
  onClose: () => void;
  onUpdate: () => void;
}

const ExamResultDetail: React.FC<ExamResultDetailProps> = ({ exam, onClose, onUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [findings, setFindings] = useState(exam.findings || '');
  const [memo, setMemo] = useState(exam.memo || '');
  const [isSaving, setIsSaving] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [localAttachments, setLocalAttachments] = useState<ExamAttachment[]>(exam.attachments || []);

  const typeInfo = getExamTypeInfo(exam.exam_type);
  const typeStyles = getExamTypeStyles(exam.exam_type);
  const images = localAttachments.filter(a => isImageFile(a.file_name));
  const pdfs = localAttachments.filter(a => isPdfFile(a.file_name));

  // 캡션 업데이트 핸들러
  const handleCaptionUpdate = async (attachmentId: number, caption: string) => {
    await updateAttachmentCaption(attachmentId, caption);
    setLocalAttachments(prev =>
      prev.map(att =>
        att.id === attachmentId ? { ...att, caption } : att
      )
    );
  };

  // 저장
  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateExamResult(exam.id, { findings, memo });
      setIsEditing(false);
      onUpdate();
    } catch (error) {
      console.error('수정 실패:', error);
      alert('수정에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  // 삭제
  const handleDelete = async () => {
    if (!confirm('이 검사결과를 삭제하시겠습니까?\n첨부된 파일도 함께 삭제됩니다.')) {
      return;
    }

    try {
      await deleteExamResult(exam.id);
      onClose();
      onUpdate();
    } catch (error) {
      console.error('삭제 실패:', error);
      alert('삭제에 실패했습니다.');
    }
  };

  // 이미지 다운로드
  const handleDownload = (filePath: string, fileName: string) => {
    const link = document.createElement('a');
    link.href = getFileUrl(filePath);
    link.download = fileName;
    link.click();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* 헤더 */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${typeStyles.badge}`}>
              <i className={`fas ${typeInfo?.icon || 'fa-file'} mr-2`}></i>
              {typeInfo?.name || exam.exam_type}
            </span>
            <span className="text-gray-500">{exam.exam_date}</span>
          </div>
          <div className="flex items-center gap-2">
            {!isEditing && (
              <>
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  <i className="fas fa-edit mr-1"></i>
                  수정
                </button>
                <button
                  onClick={handleDelete}
                  className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg"
                >
                  <i className="fas fa-trash mr-1"></i>
                  삭제
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 ml-2"
            >
              <i className="fas fa-times text-xl"></i>
            </button>
          </div>
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto flex">
          {/* 이미지 뷰어 */}
          <div className="flex-1 bg-gray-900 flex flex-col">
            {images.length > 0 ? (
              <>
                {/* 메인 이미지 */}
                <div
                  className="flex-1 flex items-center justify-center p-4 cursor-pointer group relative"
                  onClick={() => setShowImageViewer(true)}
                >
                  <img
                    src={getFileUrl(images[selectedImageIndex].file_path)}
                    alt=""
                    className="max-w-full max-h-full object-contain"
                  />
                  {/* 확대 힌트 */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 px-4 py-2 rounded-lg text-white text-sm">
                      <i className="fas fa-search-plus mr-2"></i>
                      클릭하여 확대
                    </div>
                  </div>
                </div>

                {/* 썸네일 네비게이션 */}
                {images.length > 1 && (
                  <div className="px-4 py-3 bg-gray-800 flex gap-2 overflow-x-auto">
                    {images.map((img, idx) => (
                      <button
                        key={img.id}
                        onClick={() => setSelectedImageIndex(idx)}
                        className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden ring-2 transition-all ${
                          idx === selectedImageIndex
                            ? 'ring-purple-500'
                            : 'ring-transparent hover:ring-gray-500'
                        }`}
                      >
                        <img
                          src={getThumbnailUrl(img.thumbnail_path)}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <i className="fas fa-image text-4xl mb-2"></i>
                  <p>이미지 없음</p>
                </div>
              </div>
            )}
          </div>

          {/* 정보 패널 */}
          <div className="w-80 border-l border-gray-200 flex flex-col">
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* 소견 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  소견
                </label>
                {isEditing ? (
                  <textarea
                    value={findings}
                    onChange={(e) => setFindings(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-sm"
                  />
                ) : (
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">
                    {exam.findings || '-'}
                  </p>
                )}
              </div>

              {/* 메모 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  메모
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={memo}
                    onChange={(e) => setMemo(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-sm"
                  />
                ) : (
                  <p className="text-sm text-gray-600">
                    {exam.memo || '-'}
                  </p>
                )}
              </div>

              {/* 담당의 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  담당의
                </label>
                <p className="text-sm text-gray-600">
                  {exam.doctor_name || '-'}
                </p>
              </div>

              {/* 수치 데이터 */}
              {exam.values && exam.values.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    측정값
                  </label>
                  <div className="space-y-2">
                    {exam.values.map((v) => (
                      <div
                        key={v.id}
                        className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
                      >
                        <span className="text-sm text-gray-700">{v.item_name}</span>
                        <span className="text-sm font-medium">
                          {v.item_value} {v.unit}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 첨부 파일 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  첨부파일 ({localAttachments.length})
                </label>
                <div className="space-y-2">
                  {localAttachments.map((att) => (
                    <div
                      key={att.id}
                      className="p-2 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center gap-2">
                        <i className={`fas ${isImageFile(att.file_name) ? 'fa-image text-blue-500' : 'fa-file-pdf text-red-500'}`}></i>
                        <span className="flex-1 text-sm text-gray-700 truncate">
                          {att.file_name}
                        </span>
                        <button
                          onClick={() => handleDownload(att.file_path, att.file_name)}
                          className="text-gray-400 hover:text-purple-600"
                          title="다운로드"
                        >
                          <i className="fas fa-download"></i>
                        </button>
                      </div>
                      {att.caption && (
                        <p className="text-xs text-gray-500 mt-1 ml-6">{att.caption}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* PDF 파일 */}
              {pdfs.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    PDF 문서
                  </label>
                  <div className="space-y-2">
                    {pdfs.map((pdf) => (
                      <a
                        key={pdf.id}
                        href={getFileUrl(pdf.file_path)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 p-2 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                      >
                        <i className="fas fa-file-pdf text-red-500"></i>
                        <span className="flex-1 text-sm text-gray-700 truncate">
                          {pdf.file_name}
                        </span>
                        <i className="fas fa-external-link-alt text-gray-400"></i>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* AI 분석 */}
              {images.length > 0 && (
                <ExamAIAnalysis
                  exam={exam}
                  onApplyFindings={isEditing ? (text) => setFindings(text) : undefined}
                />
              )}
            </div>

            {/* 수정 모드 버튼 */}
            {isEditing && (
              <div className="p-4 border-t border-gray-200 flex gap-2">
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setFindings(exam.findings || '');
                    setMemo(exam.memo || '');
                  }}
                  className="flex-1 px-3 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  취소
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex-1 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSaving && <i className="fas fa-spinner fa-spin"></i>}
                  저장
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 전체화면 이미지 뷰어 */}
      {showImageViewer && images.length > 0 && (
        <ExamImageViewer
          images={images}
          initialIndex={selectedImageIndex}
          onClose={() => setShowImageViewer(false)}
          onCaptionUpdate={handleCaptionUpdate}
        />
      )}
    </div>
  );
};

export default ExamResultDetail;
