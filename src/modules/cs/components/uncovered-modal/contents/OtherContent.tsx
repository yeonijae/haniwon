import React from 'react';
import type { ContentComponentProps } from '../UncoveredItemModal';

const OtherContent: React.FC<ContentComponentProps> = ({ isEditMode }) => {
  if (isEditMode) {
    return (
      <div style={{
        padding: '12px 16px',
        background: '#FEF2F2',
        border: '1px solid #FECACA',
        borderRadius: 6,
        margin: '0 12px 12px',
        fontSize: '13px',
        color: '#92400E',
        textAlign: 'center',
      }}>
        이미 처리된 항목입니다. 아래 메모에서 수정/삭제할 수 있습니다.
      </div>
    );
  }

  return (
    <div style={{ padding: '12px 16px', color: '#6B7280', fontSize: '13px', textAlign: 'center' }}>
      아래 메모 섹션에서 메모를 입력하세요.
    </div>
  );
};

export default OtherContent;
