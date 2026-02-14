import React from 'react';
import type { NokryongGrade } from '../../types';
import { NOKRYONG_GRADES } from '../../types';
import SharedChipSelector from './SharedChipSelector';

interface NokryongAdditionSectionProps {
  grade: NokryongGrade | '';
  count: number;
  onGradeChange: (grade: NokryongGrade | '') => void;
  onCountChange: (count: number) => void;
}

const NOKRYONG_COUNTS = [1, 2, 3, 4, 5, 6] as const;

export default function NokryongAdditionSection({
  grade,
  count,
  onGradeChange,
  onCountChange,
}: NokryongAdditionSectionProps) {
  return (
    <div className="herbal-draft-section">
      <span className="herbal-draft-section-label">녹용 추가</span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* 등급 선택 */}
        <div className="herbal-draft-chips">
          {NOKRYONG_GRADES.map(g => (
            <button
              key={g}
              type="button"
              className={`herbal-draft-chip${grade === g ? ' active-amber' : ''}`}
              onClick={() => onGradeChange(grade === g ? '' : g)}
            >
              {g}
            </button>
          ))}
        </div>
        {/* 횟수 선택 - 등급 선택 시에만 표시 */}
        {grade && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>횟수</span>
            <div className="herbal-draft-chips">
              {NOKRYONG_COUNTS.map(n => (
                <button
                  key={n}
                  type="button"
                  className={`herbal-draft-chip${count === n ? ' active-amber' : ''}`}
                  onClick={() => onCountChange(n)}
                >
                  {n}회분
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
