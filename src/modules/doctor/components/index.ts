/**
 * Doctor Module Components
 * 원장실 모듈 컴포넌트 내보내기
 */

// 대시보드 컴포넌트
export { DoctorSelectPanel } from './DoctorSelectPanel';
export { ActingQueuePanel } from './ActingQueuePanel';
export { PrescriptionPendingPanel } from './PrescriptionPendingPanel';
export { DosagePendingPanel } from './DosagePendingPanel';
export { ConsultationPanel } from './ConsultationPanel';

// 차트 컴포넌트
export { default as MedicalRecordList } from './MedicalRecordList';
export { default as MedicalRecordDetail } from './MedicalRecordDetail';
export { default as DiagnosisListView } from './DiagnosisListView';
export { default as InitialChartView } from './InitialChartView';
export { default as ProgressNoteView } from './ProgressNoteView';
export { default as PrescriptionInput } from './PrescriptionInput';
