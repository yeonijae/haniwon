import { useEffect, useState, type ReactNode } from 'react';
import { getDecoctionDashboardData } from '../lib/api';
import type { DecoctionDashboardData } from '../types';

const initialData: DecoctionDashboardData = {
  summary: {
    waitingDecoction: 0,
    pendingPrescription: 0,
    pendingDosage: 0,
    lowHerbCount: 0,
    lowReadyMedicineCount: 0,
    outboundPending: 0,
    outboundToday: 0,
  },
  waitingDrafts: [],
  pendingPrescriptionDrafts: [],
  pendingDosageDrafts: [],
  lowHerbs: [],
  lowReadyMedicines: [],
  outboundPendingList: [],
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

function ListBox({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 min-h-[220px]">
      <h4 className="text-sm font-semibold text-gray-700 mb-3">{title}</h4>
      {children}
    </div>
  );
}

function Empty() {
  return <div className="text-sm text-gray-400">항목이 없습니다.</div>;
}

export default function DecoctionDashboardView() {
  const [data, setData] = useState<DecoctionDashboardData>(initialData);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const next = await getDecoctionDashboardData();
        if (mounted) setData(next);
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

  if (loading) return <div className="p-4 text-gray-500">대시보드 로딩 중...</div>;

  const s = data.summary;

  return (
    <div className="p-4 h-full overflow-auto space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4">
        <Card title="탕전대기" icon="⏳" main={`${s.waitingDecoction}건`} sub="미배정 탕약초안" />
        <Card title="처방전대기" icon="💊" main={`${s.pendingPrescription}건`} sub="일정 있음 · 처방전 미연결" />
        <Card title="복용법대기" icon="📝" main={`${s.pendingDosage}건`} sub="처방 연결됨 · 복용법 미작성" />
        <Card title="약재관리" icon="🌿" main={`${s.lowHerbCount}건`} sub="안전재고 미만" />
        <Card title="상비약관리" icon="🏷️" main={`${s.lowReadyMedicineCount}건`} sub="재고 0개" />
        <Card title="출고관리" icon="📦" main={`${s.outboundPending}건`} sub={`출고대기 · 오늘출고 ${s.outboundToday}건`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        <ListBox title="처방전대기 목록">
          {data.pendingPrescriptionDrafts.length === 0 ? <Empty /> : (
            <ul className="space-y-2 text-sm">
              {data.pendingPrescriptionDrafts.map((d) => (
                <li key={d.id} className="border rounded px-2 py-1">
                  {d.patient_name} ({d.chart_number}) · {d.shipping_date || d.decoction_date || '-'}
                </li>
              ))}
            </ul>
          )}
        </ListBox>

        <ListBox title="복용법대기 목록">
          {data.pendingDosageDrafts.length === 0 ? <Empty /> : (
            <ul className="space-y-2 text-sm">
              {data.pendingDosageDrafts.map((d) => (
                <li key={d.id} className="border rounded px-2 py-1">
                  {d.patient_name} ({d.chart_number}) · {d.shipping_date || d.decoction_date || '-'}
                </li>
              ))}
            </ul>
          )}
        </ListBox>

        <ListBox title="탕전대기 목록">
          {data.waitingDrafts.length === 0 ? <Empty /> : (
            <ul className="space-y-2 text-sm">
              {data.waitingDrafts.map((d) => (
                <li key={d.id} className="border rounded px-2 py-1">
                  {d.patient_name} ({d.chart_number}) · {d.doctor || '-'}
                </li>
              ))}
            </ul>
          )}
        </ListBox>
      </div>
    </div>
  );
}
