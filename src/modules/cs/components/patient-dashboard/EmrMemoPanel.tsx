import React from 'react';

// 연속 줄바꿈을 1회로 축약
const trimMemo = (text: string): string => text.replace(/(\r?\n){2,}/g, '\n');

interface EmrMemoPanelProps {
  doctorMemo?: string | null;
  nurseMemo?: string | null;
  etcMemo?: string | null;
  /** 'horizontal' (default) or 'vertical' for sidebar layout */
  layout?: 'horizontal' | 'vertical';
}

const EmrMemoPanel: React.FC<EmrMemoPanelProps> = ({ doctorMemo, nurseMemo, etcMemo, layout = 'horizontal' }) => {
  return (
    <div className={`emr-memo-grid${layout === 'vertical' ? ' vertical' : ''}`}>
      <div className="emr-memo-card doctor">
        <div className="emr-memo-label">주치의 메모</div>
        <pre className="emr-memo-content">{doctorMemo ? trimMemo(doctorMemo) : '-'}</pre>
      </div>
      <div className="emr-memo-card nurse">
        <div className="emr-memo-label">간호사 메모</div>
        <pre className="emr-memo-content">{nurseMemo ? trimMemo(nurseMemo) : '-'}</pre>
      </div>
      <div className="emr-memo-card etc">
        <div className="emr-memo-label">기타 메모</div>
        <pre className="emr-memo-content">{etcMemo ? trimMemo(etcMemo) : '-'}</pre>
      </div>
    </div>
  );
};

export default EmrMemoPanel;
