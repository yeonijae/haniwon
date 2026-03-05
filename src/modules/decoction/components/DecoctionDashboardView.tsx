import { useEffect, useState } from 'react';
import { getDecoctionDashboardSummary } from '../lib/api';
import type { DecoctionDashboardSummary } from '../types';

const initialSummary: DecoctionDashboardSummary = {
  waitingDecoction: 0,
  pendingDosage: 0,
  lowHerbCount: 0,
  lowReadyMedicineCount: 0,
  outboundPending: 0,
  outboundToday: 0,
};

function Card({ title, icon, main, sub }: { title: string; icon: string; main: string; sub: string }) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold text-gray-800">{title}</h3>
        <span className="text-xl">{icon}</span>
      </div>
      <div className="text-2xl font-bold text-gray-900">{main}</div>
      <div className="text-sm text-gray-500 mt-1">{sub}</div>
    </div>
  );
}

export default function DecoctionDashboardView() {
  const [summary, setSummary] = useState<DecoctionDashboardSummary>(initialSummary);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const data = await getDecoctionDashboardSummary();
        if (mounted) setSummary(data);
      } catch (e) {
        console.error('탕전실 대시보드 로드 실패:', e);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    const timer = setInterval(load, 15000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);

  if (loading) {
    return <div className="p-4 text-gray-500">대시보드 로딩 중...</div>;
  }

  return (
    <div className="p-4 h-full overflow-auto">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
        <Card title="탕전대기" icon="⏳" main={`${summary.waitingDecoction}건`} sub="미배정 탕약초안" />
        <Card title="복용법대기" icon="📝" main={`${summary.pendingDosage}건`} sub="처방 연결됨 · 복용법 미작성" />
        <Card title="약재관리" icon="🌿" main={`${summary.lowHerbCount}건`} sub="안전재고 미만 약재" />
        <Card title="상비약관리" icon="💊" main={`${summary.lowReadyMedicineCount}건`} sub="재고 0개 항목" />
        <Card title="출고관리" icon="📦" main={`${summary.outboundPending}건`} sub={`출고대기 · 오늘출고 ${summary.outboundToday}건`} />
      </div>
    </div>
  );
}
