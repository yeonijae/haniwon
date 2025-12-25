import { useState, useRef } from 'react';
import type { Patient, ExamType, UploadResult } from '../types';
import { EXAM_TYPES, getExamTypeInfo } from '../types';
import { uploadExamFile, formatFileSize } from '../lib/fileUpload';
import { createExamResult, addExamAttachment, addExamValue } from '../services/examService';
import ExamValueEditor, { type ValueInput } from './ExamValueEditor';

interface ExamResultFormProps {
  patient: Patient;
  onClose: () => void;
  onSave: () => void;
}

interface UploadedFile {
  file: File;
  preview: string;
  uploading: boolean;
  uploaded: boolean;
  result?: UploadResult;
  error?: string;
}

const ExamResultForm: React.FC<ExamResultFormProps> = ({ patient, onClose, onSave }) => {
  const [examDate, setExamDate] = useState(new Date().toISOString().split('T')[0]);
  const [examType, setExamType] = useState<ExamType | ''>('');
  const [findings, setFindings] = useState('');
  const [memo, setMemo] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [values, setValues] = useState<ValueInput[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 현재 검사 유형이 수치 데이터를 지원하는지 확인
  const currentTypeInfo = examType ? getExamTypeInfo(examType) : null;
  const hasValues = currentTypeInfo?.hasValues || false;

  // 검사 유형 변경 시 수치 데이터 초기화
  const handleExamTypeChange = (type: ExamType) => {
    setExamType(type);
    setValues([]);  // 유형 변경 시 수치 초기화
  };

  // 파일 추가
  const handleFiles = (fileList: FileList) => {
    const newFiles: UploadedFile[] = Array.from(fileList).map((file) => ({
      file,
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : '',
      uploading: false,
      uploaded: false,
    }));
    setFiles((prev) => [...prev, ...newFiles]);
  };

  // 파일 제거
  const removeFile = (index: number) => {
    setFiles((prev) => {
      const newFiles = [...prev];
      if (newFiles[index].preview) {
        URL.revokeObjectURL(newFiles[index].preview);
      }
      newFiles.splice(index, 1);
      return newFiles;
    });
  };

  // 드래그 앤 드롭
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  // 저장
  const handleSave = async () => {
    if (!examType) {
      alert('검사 유형을 선택하세요.');
      return;
    }

    if (files.length === 0) {
      alert('파일을 업로드하세요.');
      return;
    }

    setIsSaving(true);

    try {
      // 1. 파일 업로드
      const uploadedFiles: UploadResult[] = [];
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        if (!f.uploaded) {
          setFiles((prev) => {
            const newFiles = [...prev];
            newFiles[i] = { ...newFiles[i], uploading: true };
            return newFiles;
          });

          try {
            const result = await uploadExamFile(f.file, patient.id, examType);
            uploadedFiles.push(result);

            setFiles((prev) => {
              const newFiles = [...prev];
              newFiles[i] = { ...newFiles[i], uploading: false, uploaded: true, result };
              return newFiles;
            });
          } catch (error: any) {
            setFiles((prev) => {
              const newFiles = [...prev];
              newFiles[i] = { ...newFiles[i], uploading: false, error: error.message };
              return newFiles;
            });
            throw error;
          }
        } else if (f.result) {
          uploadedFiles.push(f.result);
        }
      }

      // 2. 검사결과 생성
      const examId = await createExamResult({
        patient_id: patient.id,
        exam_date: examDate,
        exam_type: examType,
        findings,
        memo,
        doctor_name: doctorName,
      });

      // 3. 첨부파일 연결
      for (let i = 0; i < uploadedFiles.length; i++) {
        const uf = uploadedFiles[i];
        await addExamAttachment(examId, {
          file_name: uf.original_name,
          file_path: uf.file_path,
          file_size: uf.file_size,
          mime_type: uf.mime_type,
          thumbnail_path: uf.thumbnail_path,
          sort_order: i,
        });
      }

      // 4. 수치 데이터 저장
      for (const val of values) {
        if (val.item_value !== '' && val.item_value !== null) {
          await addExamValue(examId, {
            item_name: val.item_name,
            item_value: Number(val.item_value),
            unit: val.unit,
            reference_min: val.reference_min,
            reference_max: val.reference_max,
          });
        }
      }

      onSave();
    } catch (error) {
      console.error('저장 실패:', error);
      alert('저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* 헤더 */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">검사 등록</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <i className="fas fa-times text-xl"></i>
          </button>
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* 환자 정보 */}
          <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
            <i className="fas fa-user text-gray-400"></i>
            <div>
              <div className="font-medium text-gray-900">{patient.name}</div>
              <div className="text-sm text-gray-500">{patient.chart_number}</div>
            </div>
          </div>

          {/* 검사일 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              검사일 <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={examDate}
              onChange={(e) => setExamDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* 검사 유형 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              검사 유형 <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {EXAM_TYPES.map((type) => (
                <button
                  key={type.code}
                  onClick={() => handleExamTypeChange(type.code)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                    examType === type.code
                      ? 'border-purple-500 bg-purple-50 text-purple-700'
                      : 'border-gray-200 hover:border-purple-300'
                  }`}
                >
                  <i className={`fas ${type.icon} text-sm`}></i>
                  <span className="text-sm">{type.name}</span>
                  {type.hasValues && (
                    <span className="text-xs text-purple-500" title="수치 입력 가능">
                      <i className="fas fa-chart-line"></i>
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* 파일 업로드 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              파일 업로드 <span className="text-red-500">*</span>
            </label>
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                dragOver
                  ? 'border-purple-500 bg-purple-50'
                  : 'border-gray-300 hover:border-purple-400'
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,.pdf"
                className="hidden"
                onChange={(e) => e.target.files && handleFiles(e.target.files)}
              />
              <i className="fas fa-cloud-upload-alt text-3xl text-gray-400 mb-2"></i>
              <p className="text-gray-600">파일을 드래그하거나 클릭하여 업로드</p>
              <p className="text-xs text-gray-400 mt-1">JPG, PNG, PDF (최대 20MB)</p>
            </div>

            {/* 업로드된 파일 목록 */}
            {files.length > 0 && (
              <div className="mt-3 space-y-2">
                {files.map((f, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg"
                  >
                    {/* 썸네일 */}
                    {f.preview ? (
                      <img
                        src={f.preview}
                        alt=""
                        className="w-12 h-12 object-cover rounded"
                      />
                    ) : (
                      <div className="w-12 h-12 bg-gray-200 rounded flex items-center justify-center">
                        <i className="fas fa-file-pdf text-red-500"></i>
                      </div>
                    )}

                    {/* 파일 정보 */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-700 truncate">
                        {f.file.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatFileSize(f.file.size)}
                        {f.uploading && ' - 업로드 중...'}
                        {f.uploaded && ' - 완료'}
                        {f.error && ` - 오류: ${f.error}`}
                      </p>
                    </div>

                    {/* 상태 아이콘 */}
                    {f.uploading ? (
                      <i className="fas fa-spinner fa-spin text-purple-600"></i>
                    ) : f.uploaded ? (
                      <i className="fas fa-check-circle text-green-500"></i>
                    ) : f.error ? (
                      <i className="fas fa-exclamation-circle text-red-500"></i>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); removeFile(index); }}
                        className="text-gray-400 hover:text-red-500"
                      >
                        <i className="fas fa-times"></i>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 수치 데이터 입력 (지원하는 검사 유형만) */}
          {hasValues && examType && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <i className="fas fa-chart-line mr-1 text-purple-500"></i>
                수치 데이터
              </label>
              <div className="border border-gray-200 rounded-lg p-4">
                <ExamValueEditor
                  examType={examType}
                  values={values}
                  onChange={setValues}
                />
              </div>
            </div>
          )}

          {/* 소견 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              소견
            </label>
            <textarea
              value={findings}
              onChange={(e) => setFindings(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              placeholder="검사 소견을 입력하세요..."
            />
          </div>

          {/* 메모 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              메모
            </label>
            <input
              type="text"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              placeholder="추가 메모..."
            />
          </div>

          {/* 담당의 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              담당의
            </label>
            <input
              type="text"
              value={doctorName}
              onChange={(e) => setDoctorName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              placeholder="담당의 이름"
            />
          </div>
        </div>

        {/* 푸터 */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !examType || files.length === 0}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSaving && <i className="fas fa-spinner fa-spin"></i>}
            저장
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExamResultForm;
