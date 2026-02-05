/**
 * 지표관리 모듈 (통합포탈용)
 * 원장실의 지표관리 페이지를 재사용
 */

import { useDocumentTitle } from '@shared/hooks/useDocumentTitle';
import type { PortalUser } from '@shared/types';
import Metrics from '../doctor/pages/Metrics';

interface MetricsAppProps {
  user: PortalUser;
}

function MetricsApp({ user: _user }: MetricsAppProps) {
  useDocumentTitle('지표관리');

  return (
    <div className="h-screen bg-clinic-background flex flex-col overflow-hidden">
      {/* 메인 콘텐츠 - 원장실 Metrics 컴포넌트 재사용 */}
      <main className="flex-1 overflow-hidden">
        <Metrics />
      </main>
    </div>
  );
}

export default MetricsApp;
