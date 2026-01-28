import React from 'react';
import type { PackageStatusSummary } from '../types/crm';

interface PatientPackageStatusProps {
  status: PackageStatusSummary;
  compact?: boolean;
  onPackageClick?: (type: 'tongma' | 'herbal' | 'nokryong' | 'membership') => void;
}

const PatientPackageStatus: React.FC<PatientPackageStatusProps> = ({
  status,
  compact = false,
  onPackageClick,
}) => {
  const hasAnyPackage = status.tongma || status.herbal || status.nokryong || status.membership;

  if (!hasAnyPackage) {
    return (
      <div className="package-status-empty">
        <p>활성 패키지 없음</p>
      </div>
    );
  }

  // 만료일 포맷
  const formatExpireDate = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return `~${date.getMonth() + 1}/${date.getDate()}`;
  };

  // 잔여량 계산 (진행률)
  const getProgress = (used: number, total: number) => {
    if (total === 0) return 0;
    return ((total - used) / total) * 100;
  };

  if (compact) {
    // 컴팩트 모드 (메모 요약용)
    return (
      <div className="package-status-compact">
        {status.tongma && (
          <span
            className="package-tag tongma"
            onClick={() => onPackageClick?.('tongma')}
          >
            통마 [{status.tongma.remainingCount}/{status.tongma.totalCount}]
          </span>
        )}
        {status.herbal && (
          <span
            className="package-tag herbal"
            onClick={() => onPackageClick?.('herbal')}
          >
            한약 [{status.herbal.remainingCount}/{status.herbal.totalCount}회]
          </span>
        )}
        {status.nokryong && (
          <span
            className="package-tag nokryong"
            onClick={() => onPackageClick?.('nokryong')}
          >
            녹용 [{status.nokryong.remainingMonths}/{status.nokryong.totalMonths}회]
          </span>
        )}
        {status.membership && (
          <span
            className="package-tag membership"
            onClick={() => onPackageClick?.('membership')}
          >
            {status.membership.membershipType}
          </span>
        )}
      </div>
    );
  }

  // 전체 모드 (CRM 페이지용)
  return (
    <div className="package-status-full">
      {/* 통마 */}
      {status.tongma && (
        <div
          className="package-card tongma"
          onClick={() => onPackageClick?.('tongma')}
        >
          <div className="package-card-header">
            <span className="package-icon">💉</span>
            <span className="package-name">통증마일리지</span>
          </div>
          <div className="package-card-body">
            <div className="package-count">
              <span className="remaining">{status.tongma.remainingCount}</span>
              <span className="separator">/</span>
              <span className="total">{status.tongma.totalCount}회</span>
            </div>
            <div className="package-progress">
              <div
                className="progress-bar"
                style={{ width: `${getProgress(status.tongma.usedCount, status.tongma.totalCount)}%` }}
              />
            </div>
            {status.tongma.expireDate && (
              <div className="package-expire">
                {formatExpireDate(status.tongma.expireDate)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 한약 선결 */}
      {status.herbal && (
        <div
          className="package-card herbal"
          onClick={() => onPackageClick?.('herbal')}
        >
          <div className="package-card-header">
            <span className="package-icon">💊</span>
            <span className="package-name">
              {status.herbal.herbalName || '한약 선결'}
            </span>
          </div>
          <div className="package-card-body">
            <div className="package-count">
              <span className="remaining">{status.herbal.remainingCount}</span>
              <span className="separator">/</span>
              <span className="total">{status.herbal.totalCount}회</span>
            </div>
            <div className="package-progress">
              <div
                className="progress-bar"
                style={{ width: `${getProgress(status.herbal.usedCount, status.herbal.totalCount)}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* 녹용 선결 */}
      {status.nokryong && (
        <div
          className="package-card nokryong"
          onClick={() => onPackageClick?.('nokryong')}
        >
          <div className="package-card-header">
            <span className="package-icon">🦌</span>
            <span className="package-name">
              {status.nokryong.packageName || '녹용 선결'}
            </span>
          </div>
          <div className="package-card-body">
            <div className="package-count">
              <span className="remaining">{status.nokryong.remainingMonths}</span>
              <span className="separator">/</span>
              <span className="total">{status.nokryong.totalMonths}회</span>
            </div>
            <div className="package-progress">
              <div
                className="progress-bar"
                style={{ width: `${getProgress(status.nokryong.totalMonths - status.nokryong.remainingMonths, status.nokryong.totalMonths)}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* 멤버십 */}
      {status.membership && (
        <div
          className="package-card membership"
          onClick={() => onPackageClick?.('membership')}
        >
          <div className="package-card-header">
            <span className="package-icon">🎫</span>
            <span className="package-name">{status.membership.membershipType}</span>
          </div>
          <div className="package-card-body">
            <div className="package-info">
              <span className="quantity">{status.membership.quantity}개</span>
              <span className="expire">{formatExpireDate(status.membership.expireDate)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientPackageStatus;
