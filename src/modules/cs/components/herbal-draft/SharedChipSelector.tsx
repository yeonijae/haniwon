import React from 'react';

interface SharedChipSelectorProps<T extends string> {
  label: string;
  options: readonly T[];
  selected: T | T[] | '';
  onSelect: (value: T | T[]) => void;
  multi?: boolean;
  colorVariant?: 'blue' | 'green' | 'amber' | 'red';
  labelMap?: Record<T, string>;
}

export default function SharedChipSelector<T extends string>({
  label,
  options,
  selected,
  onSelect,
  multi = false,
  colorVariant = 'blue',
  labelMap,
}: SharedChipSelectorProps<T>) {
  const colorClass = colorVariant === 'blue' ? 'active' :
    colorVariant === 'green' ? 'active-green' :
    colorVariant === 'red' ? 'active-red' : 'active-amber';

  const isSelected = (opt: T): boolean => {
    if (multi && Array.isArray(selected)) return selected.includes(opt);
    return selected === opt;
  };

  const handleClick = (opt: T) => {
    if (multi) {
      const arr = Array.isArray(selected) ? selected : [];
      if (arr.includes(opt)) {
        onSelect(arr.filter(v => v !== opt) as T[]);
      } else {
        onSelect([...arr, opt] as T[]);
      }
    } else {
      // 토글: 같은 값 클릭 시 해제
      onSelect(selected === opt ? '' as unknown as T : opt);
    }
  };

  return (
    <div className="herbal-draft-section">
      <span className="herbal-draft-section-label">{label}</span>
      <div className="herbal-draft-chips">
        {options.map(opt => (
          <button
            key={opt}
            type="button"
            className={`herbal-draft-chip${isSelected(opt) ? ` ${colorClass}` : ''}`}
            onClick={() => handleClick(opt)}
          >
            {labelMap ? labelMap[opt] : opt}
          </button>
        ))}
      </div>
    </div>
  );
}
