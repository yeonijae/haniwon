import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import ExamCompareViewer from '../components/ExamCompareViewer';
import type { ExamResult } from '../types';

const ExamComparePopup: React.FC = () => {
  const [params] = useSearchParams();
  const key = params.get('key') || '';

  const exams = useMemo<ExamResult[]>(() => {
    if (!key) return [];
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [key]);

  if (!exams || exams.length === 0) {
    return (
      <div className="fixed inset-0 bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <p className="mb-3">비교 데이터가 없습니다.</p>
          <button
            onClick={() => window.close()}
            className="px-3 py-2 bg-gray-700 rounded"
          >
            닫기
          </button>
        </div>
      </div>
    );
  }

  return <ExamCompareViewer exams={exams} onClose={() => window.close()} />;
};

export default ExamComparePopup;
