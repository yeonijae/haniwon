import { useState } from 'react';
import { getHerbUsageStats } from '../lib/api';
import type { HerbUsageStatRow } from '../types';

function defaultStartDate() {
  const date = new Date();
  date.setDate(date.getDate() - 30);
  return date.toISOString().slice(0, 10);
}

export default function HerbUsageStatsView() {
  const [startDate, setStartDate] = useState(defaultStartDate());
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<HerbUsageStatRow[]>([]);

  async function handleSearch() {
    const result = await getHerbUsageStats(startDate, endDate);
    setRows(result.map((row) => ({ ...row, used_qty: Number(row.used_qty || 0), used_cost: Number(row.used_cost || 0) })));
  }

  return (
    <div className="decoction-view decoction-herb-view">
      <h2>📈 사용통계</h2>
      <section className="decoction-card">
        <h3>기간별 사용량/사용금액 조회</h3>
        <div className="decoction-order-row">
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          <button className="decoction-btn" onClick={handleSearch}>조회</button>
        </div>
        {rows.length > 0 && (
          <table className="decoction-table">
            <thead><tr><th>약재</th><th>사용량</th><th>사용금액</th></tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.herb_id}>
                  <td>{row.herb_name}</td>
                  <td>{row.used_qty.toFixed(1)} {row.unit}</td>
                  <td>{row.used_cost.toLocaleString()}원</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
