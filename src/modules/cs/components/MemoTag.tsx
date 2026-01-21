import React from 'react';
import { type MemoSummaryItem, type MemoTagType } from '../types';

interface MemoTagProps {
  item: MemoSummaryItem;
  onClick: (item: MemoSummaryItem) => void;
}

// 타입별 CSS 클래스 매핑
const TAG_TYPE_CLASSES: Record<MemoTagType, string> = {
  'yakchim-membership': 'memo-tag--yakchim',
  'yakchim-package': 'memo-tag--yakchim',
  'yakchim-onetime': 'memo-tag--yakchim-onetime',
  'treatment-package': 'memo-tag--treatment',
  'herbal-package': 'memo-tag--herbal',
  'nokryong-package': 'memo-tag--nokryong',
  'point-used': 'memo-tag--point-used',
  'point-earned': 'memo-tag--point-earned',
  'membership': 'memo-tag--membership',
  'herbal-dispensing': 'memo-tag--dispensing',
  'gift-dispensing': 'memo-tag--gift',
  'document': 'memo-tag--document',
  'medicine': 'memo-tag--medicine',
};

export const MemoTag: React.FC<MemoTagProps> = ({ item, onClick }) => {
  const typeClass = TAG_TYPE_CLASSES[item.type] || '';

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick(item);
  };

  return (
    <span
      className={`memo-tag ${typeClass}`}
      onClick={handleClick}
      title={`클릭하여 수정`}
    >
      {item.label}
    </span>
  );
};

interface MemoTagListProps {
  items: MemoSummaryItem[];
  onTagClick: (item: MemoSummaryItem) => void;
  onAddClick?: () => void;
}

export const MemoTagList: React.FC<MemoTagListProps> = ({ items, onTagClick, onAddClick }) => {
  return (
    <div className="memo-tag-list">
      {items.map((item, idx) => (
        <MemoTag key={`${item.type}-${idx}`} item={item} onClick={onTagClick} />
      ))}
      {onAddClick && (
        <span
          className="memo-tag memo-tag--add"
          onClick={(e) => {
            e.stopPropagation();
            onAddClick();
          }}
          title="메모 추가"
        >
          +메모
        </span>
      )}
    </div>
  );
};
