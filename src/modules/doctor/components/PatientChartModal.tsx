/**
 * PatientChartModal - 환자통합차트 (메인 콘텐츠 내 오버레이)
 * CS의 PatientDashboard처럼 콘텐츠 영역에 꽉 차게 열림
 */
import { useEffect, useCallback } from 'react';
import PatientDetail from '../pages/PatientDetail';

interface Props {
  patientId: string;
  chartNumber?: string;
  onClose: () => void;
}

export default function PatientChartModal({ patientId, chartNumber, onClose }: Props) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="patient-chart-overlay">
      <PatientDetail
        patientId={patientId}
        chartNumber={chartNumber}
        onClose={onClose}
        isModal
      />
    </div>
  );
}
