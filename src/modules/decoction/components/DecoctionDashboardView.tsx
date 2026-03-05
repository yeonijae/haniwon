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

function ListBox({ title, badge, children }: { title: string; badge: string; children: ReactNode }) {
  const styleMap: Record<string, { iconClass: string; headerBg: string; iconBg: string; iconFg: string; badgeBg: string; badgeFg: string }> = {
    처방전대기: { iconClass: 'fa-solid fa-file-prescription', headerBg: 'bg-blue-50', iconBg: 'bg-blue-500', iconFg: 'text-white', badgeBg: 'bg-blue-100', badgeFg: 'text-blue-700' },
    탕전대기: { iconClass: 'fa-solid fa-fire-burner', headerBg: 'bg-orange-50', iconBg: 'bg-orange-500', iconFg: 'text-white', badgeBg: 'bg-orange-100', badgeFg: 'text-orange-700' },
    복용법대기: { iconClass: 'fa-solid fa-notes-medical', headerBg: 'bg-indigo-50', iconBg: 'bg-indigo-500', iconFg: 'text-white', badgeBg: 'bg-indigo-100', badgeFg: 'text-indigo-700' },
    약재관리: { iconClass: 'fa-solid fa-leaf', headerBg: 'bg-green-50', iconBg: 'bg-green-500', iconFg: 'text-white', badgeBg: 'bg-green-100', badgeFg: 'text-green-700' },
    상비약관리: { iconClass: 'fa-solid fa-pills', headerBg: 'bg-purple-50', iconBg: 'bg-purple-500', iconFg: 'text-white', badgeBg: 'bg-purple-100', badgeFg: 'text-purple-700' },
    출고관리: { iconClass: 'fa-solid fa-box', headerBg: 'bg-teal-50', iconBg: 'bg-teal-500', iconFg: 'text-white', badgeBg: 'bg-teal-100', badgeFg: 'text-teal-700' },
  };
  const s = styleMap[title] || styleMap['처방전대기'];

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 h-full flex-1 basis-0 min-w-0 flex flex-col overflow-hidden">
      <div className={`flex items-center justify-between px-3 py-2 border-b border-gray-100 ${s.headerBg}`}>
        <div className="flex items-center gap-2 min-w-0">
          <span className={`inline-flex items-center justify-center w-6 h-6 rounded-md text-xs ${s.iconBg} ${s.iconFg}`}>
            <i className={s.iconClass}></i>
          </span>
          <h4 className="text-[18px] leading-none font-semibold text-gray-800 truncate">{title}</h4>
        </div>
        <span className={`inline-flex items-center justify-center min-w-8 px-2 h-6 rounded-full text-xs font-semibold ${s.badgeBg} ${s.badgeFg}`}>
          {badge}
        </span>
      </div>
      <div className="flex-1 overflow-auto p-3">
        {children}
      </div>
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
    <div className="p-0 h-full overflow-auto">
      <div className="flex gap-4 w-full h-full items-stretch">
        <ListBox title="처방전대기" badge={`${s.pendingPrescription}`}>
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

        <ListBox title="탕전대기" badge={`${s.waitingDecoction}`}>
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

        <ListBox title="복용법대기" badge={`${s.pendingDosage}`}>
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

        <ListBox title="약재관리" badge={`${s.lowHerbCount}`}>
          {data.lowHerbs.length === 0 ? <Empty /> : (
            <ul className="space-y-2 text-sm">
              {data.lowHerbs.map((h) => (
                <li key={h.herb_id} className="border rounded px-2 py-1">
                  {h.herb_name} · 부족 {Number(h.shortage_qty || 0).toFixed(1)} {h.unit}
                </li>
              ))}
            </ul>
          )}
        </ListBox>

        <ListBox title="상비약관리" badge={`${s.lowReadyMedicineCount}`}>
          {data.lowReadyMedicines.length === 0 ? <Empty /> : (
            <ul className="space-y-2 text-sm">
              {data.lowReadyMedicines.map((m) => (
                <li key={m.id} className="border rounded px-2 py-1">
                  {m.name} · 재고 {m.current_stock}{m.unit ? ` ${m.unit}` : ''}
                </li>
              ))}
            </ul>
          )}
        </ListBox>

        <ListBox title="출고관리" badge={`${s.outboundPending} / 오늘 ${s.outboundToday}`}>
          {data.outboundPendingList.length === 0 ? <Empty /> : (
            <ul className="space-y-2 text-sm">
              {data.outboundPendingList.map((q) => (
                <li key={q.id} className="border rounded px-2 py-1">
                  {q.patient_name} ({q.chart_number}) · {q.assigned_date || '-'} {q.assigned_slot || ''}
                </li>
              ))}
            </ul>
          )}
        </ListBox>
      </div>
    </div>
  );
}
