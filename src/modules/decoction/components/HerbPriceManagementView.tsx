import { useEffect, useState } from 'react';
import { createHerbPriceHistory, getHerbList, getHerbPriceTrend } from '../lib/api';
import type { HerbMaster } from '../types';

export default function HerbPriceManagementView() {
  const [herbs, setHerbs] = useState<HerbMaster[]>([]);
  const [herbId, setHerbId] = useState<number | ''>('');
  const [price, setPrice] = useState('');
  const [supplier, setSupplier] = useState('');
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().slice(0, 10));
  const [trend, setTrend] = useState<Array<{ id: number; price: number; supplier: string | null; effective_date: string }>>([]);

  useEffect(() => {
    getHerbList().then((list) => {
      setHerbs(list);
      if (list[0]) setHerbId(list[0].id);
    }).catch(console.error);
  }, []);

  useEffect(() => {
    if (!herbId) return;
    getHerbPriceTrend(herbId).then(setTrend).catch(console.error);
  }, [herbId]);

  async function handleAddPrice() {
    if (!herbId || !price) return;
    await createHerbPriceHistory({ herbId, price: Number(price), supplier, effectiveDate });
    setPrice('');
    setSupplier('');
    setTrend(await getHerbPriceTrend(herbId));
  }

  return (
    <div className="decoction-view decoction-herb-view">
      <h2>💹 단가관리</h2>
      <section className="decoction-card">
        <h3>수동 단가 입력</h3>
        <div className="decoction-order-row">
          <select value={herbId} onChange={(e) => setHerbId(Number(e.target.value))}>
            {herbs.map((herb) => <option key={herb.id} value={herb.id}>{herb.name}</option>)}
          </select>
          <input placeholder="단가" value={price} onChange={(e) => setPrice(e.target.value)} />
          <input placeholder="공급업체" value={supplier} onChange={(e) => setSupplier(e.target.value)} />
          <input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
          <button className="decoction-btn" onClick={handleAddPrice}>저장</button>
        </div>
      </section>

      <section className="decoction-card">
        <h3>거래명세표 OCR</h3>
        <p>거래명세표 이미지를 업로드하고 OCR로 단가 후보를 추출하는 기본 플로우 진입점입니다.</p>
        <div className="decoction-inline-actions">
          <button className="decoction-btn ghost" onClick={() => alert('OCR 업로드 화면(예정)으로 이동합니다.')}>거래명세표 업로드</button>
          <button className="decoction-btn ghost" onClick={() => alert('OCR 결과 검수 화면(예정)입니다.')}>OCR 결과 검수</button>
        </div>
      </section>

      <section className="decoction-card">
        <h3>단가 변동 추이</h3>
        {trend.length === 0 ? <p className="decoction-empty">등록된 단가 이력이 없습니다.</p> : (
          <table className="decoction-table compact">
            <thead><tr><th>적용일</th><th>단가</th><th>공급업체</th></tr></thead>
            <tbody>
              {trend.map((row) => (
                <tr key={row.id}>
                  <td>{row.effective_date}</td>
                  <td>{Number(row.price).toLocaleString()}</td>
                  <td>{row.supplier || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
