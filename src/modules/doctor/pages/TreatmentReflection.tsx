import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { format } from 'date-fns';
import { query, execute, queryOne, escapeString, getCurrentDate } from '@shared/lib/postgres';

const MSSQL_API = import.meta.env.VITE_MSSQL_API_URL || 'http://192.168.0.173:3100';

// ─── Interfaces ───

interface ReceiptTreatment {
  id: number;
  item: string;
  name: string;
  diagnosis: string;
  doctor: string;
  amount: number;
  is_covered: boolean;
  time: string | null;
}

interface ReceiptItem {
  id: number;
  patient_id: number;
  patient_name: string;
  chart_no: string;
  age: number | null;
  receipt_time: string | null;
  insurance_self: number;
  insurance_claim: number;
  general_amount: number;
  total_amount: number;
  unpaid: number | null;
  cash: number;
  card: number;
  transfer: number;
  insurance_type: string;
  treatment_summary: {
    acupuncture: boolean;
    choona: boolean;
    yakchim: boolean;
    uncovered: { id: number; name: string; amount: number }[];
  };
  treatments: ReceiptTreatment[];
  package_info?: string;
  memo?: string;
}

interface PatientExtra {
  sex: string | null;
  address: string | null;
  birth: string | null;
}

interface ReflectionData {
  id?: number;
  strengths: string;
  weaknesses: string;
  improvements: string;
  next_plan: string;
  tags: string;
  director_comment: string;
  director_commented_at: string | null;
}

interface TableRow {
  receipt: ReceiptItem;
  patientExtra: PatientExtra | null;
  reflection: ReflectionData | null;
  doctorName: string;
  actingType: string;
}

// ─── Helpers ───

const DAYS = ['일','월','화','수','목','금','토'];

const formatSex = (sex: string | null) => sex === 'M' ? '남' : sex === 'F' ? '여' : '-';

const shortenAddress = (addr: string | null): string => {
  if (!addr) return '-';
  const parts = addr.replace(/특별시|광역시|특별자치시|특별자치도/g, '').split(/\s+/);
  if (parts.length >= 3) return `${parts[1]} ${parts[2]}`.replace(/시$/, '');
  if (parts.length >= 2) return parts[1];
  return parts[0] || '-';
};

const formatAmount = (n: number) => n ? n.toLocaleString() : '-';

const getActingType = (treatments: ReceiptTreatment[]): string => {
  for (const t of treatments) {
    const item = t.item || t.name || '';
    if (item.includes('초진')) return '초진';
    if (item.includes('재진')) return '재진';
  }
  return '-';
};

const getDoctorFromTreatments = (treatments: ReceiptTreatment[]): string => {
  for (const t of treatments) {
    if (t.doctor) return t.doctor;
  }
  return '-';
};

// ─── Component ───

interface TreatmentReflectionProps {
  doctorName?: string;
}

const TreatmentReflection: React.FC<TreatmentReflectionProps> = ({ doctorName: propDoctorName }) => {
  const [selectedDate, setSelectedDate] = useState(getCurrentDate());
  const [rows, setRows] = useState<TableRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRow, setSelectedRow] = useState<TableRow | null>(null);
  const [reflectionForm, setReflectionForm] = useState<ReflectionData>({
    strengths: '', weaknesses: '', improvements: '', next_plan: '', tags: '',
    director_comment: '', director_commented_at: null,
  });
  const [saving, setSaving] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // 로그인 의사
  const userName = useMemo(() => {
    try {
      const stored = localStorage.getItem('haniwon_user');
      if (stored) return JSON.parse(stored).name || '';
    } catch {}
    return '';
  }, []);

  // ─── 날짜 네비게이션 ───

  const moveDate = (delta: number) => {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() + delta);
    setSelectedDate(format(d, 'yyyy-MM-dd'));
  };

  const isToday = selectedDate === getCurrentDate();

  const dateDisplay = useMemo(() => {
    const d = new Date(selectedDate + 'T00:00:00');
    return `${d.getFullYear()}. ${String(d.getMonth() + 1).padStart(2, '0')}. ${String(d.getDate()).padStart(2, '0')}. (${DAYS[d.getDay()]})`;
  }, [selectedDate]);

  // ─── 데이터 로드 ───

  const loadData = useCallback(async () => {
    setLoading(true);
    setSelectedRow(null);
    try {
      // 1. MSSQL 수납 내역
      const res = await fetch(`${MSSQL_API}/api/receipts/by-date?date=${selectedDate}`);
      if (!res.ok) throw new Error(`MSSQL API 오류: ${res.status}`);
      const data = await res.json();
      const receipts: ReceiptItem[] = data.receipts || [];

      if (receipts.length === 0) {
        setRows([]);
        return;
      }

      // 2. MSSQL 환자 상세 (성별, 주소)
      const patientIds = [...new Set(receipts.map(r => r.patient_id))];
      let patientMap = new Map<number, PatientExtra>();
      try {
        const pRes = await fetch(`${MSSQL_API}/api/patients/by-ids`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: patientIds }),
        });
        const pData = await pRes.json();
        if (pData.patients) {
          for (const p of pData.patients) {
            patientMap.set(p.id || p.patientId, {
              sex: p.sex || p.gender || null,
              address: p.address || null,
              birth: p.birth || p.birthday || null,
            });
          }
        }
      } catch {}

      // 3. PostgreSQL 회고 데이터
      await execute(
        `CREATE TABLE IF NOT EXISTS consultation_reflections (
          id SERIAL PRIMARY KEY,
          reflection_date DATE NOT NULL,
          receipt_id INTEGER,
          doctor_name TEXT,
          patient_id INTEGER,
          chart_number TEXT,
          patient_name TEXT,
          acting_type TEXT,
          strengths TEXT DEFAULT '',
          weaknesses TEXT DEFAULT '',
          improvements TEXT DEFAULT '',
          next_plan TEXT DEFAULT '',
          tags TEXT DEFAULT '',
          director_comment TEXT DEFAULT '',
          director_commented_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )`
      );

      let reflectionMap = new Map<number, ReflectionData>();
      try {
        const refs = await query<any>(
          `SELECT * FROM consultation_reflections WHERE reflection_date = ${escapeString(selectedDate)}`
        );
        for (const r of (refs || [])) {
          reflectionMap.set(r.receipt_id, {
            id: r.id,
            strengths: r.strengths || '',
            weaknesses: r.weaknesses || '',
            improvements: r.improvements || '',
            next_plan: r.next_plan || '',
            tags: r.tags || '',
            director_comment: r.director_comment || '',
            director_commented_at: r.director_commented_at,
          });
        }
      } catch {}

      // 4. 조합
      const combined: TableRow[] = receipts.map(r => ({
        receipt: r,
        patientExtra: patientMap.get(r.patient_id) || null,
        reflection: reflectionMap.get(r.id) || null,
        doctorName: getDoctorFromTreatments(r.treatments || []),
        actingType: getActingType(r.treatments || []),
      }));

      // 담당의 필터 (선택된 의료진만)
      const filterName = propDoctorName || userName;
      const filtered = filterName
        ? combined.filter(r => r.doctorName === filterName)
        : combined;
      setRows(filtered);
    } catch (err) {
      console.error('데이터 로드 실패:', err);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, propDoctorName]);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── 회고 ───

  const openReflection = (row: TableRow) => {
    setSelectedRow(row);
    setReflectionForm(row.reflection || {
      strengths: '', weaknesses: '', improvements: '', next_plan: '', tags: '',
      director_comment: '', director_commented_at: null,
    });
  };

  const saveReflection = async () => {
    if (!selectedRow) return;
    setSaving(true);
    try {
      const r = selectedRow.receipt;
      const f = reflectionForm;

      if (f.id) {
        await execute(
          `UPDATE consultation_reflections SET
            strengths = ${escapeString(f.strengths)},
            weaknesses = ${escapeString(f.weaknesses)},
            improvements = ${escapeString(f.improvements)},
            next_plan = ${escapeString(f.next_plan)},
            tags = ${escapeString(f.tags)},
            director_comment = ${escapeString(f.director_comment)},
            ${f.director_comment && !f.director_commented_at ? "director_commented_at = NOW()," : ''}
            updated_at = NOW()
          WHERE id = ${f.id}`
        );
      } else {
        await execute(
          `INSERT INTO consultation_reflections
            (reflection_date, receipt_id, doctor_name, patient_id, chart_number, patient_name, acting_type,
             strengths, weaknesses, improvements, next_plan, tags)
          VALUES (
            ${escapeString(selectedDate)}, ${r.id}, ${escapeString(selectedRow.doctorName)},
            ${r.patient_id}, ${escapeString(r.chart_no)}, ${escapeString(r.patient_name)},
            ${escapeString(selectedRow.actingType)},
            ${escapeString(f.strengths)}, ${escapeString(f.weaknesses)}, ${escapeString(f.improvements)},
            ${escapeString(f.next_plan)}, ${escapeString(f.tags)}
          )`
        );
      }
      await loadData();
    } catch (err) {
      console.error('회고 저장 실패:', err);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  // ─── 통계 ───

  const stats = useMemo(() => ({
    total: rows.length,
    reflected: rows.filter(r => r.reflection && (r.reflection.strengths || r.reflection.weaknesses || r.reflection.next_plan)).length,
    totalAmount: rows.reduce((a, r) => a + (r.receipt.total_amount || 0), 0),
  }), [rows]);

  // ─── 수납 요약 텍스트 ───

  const receiptSummary = (r: ReceiptItem): string => {
    const parts: string[] = [];
    if (r.treatment_summary?.acupuncture) parts.push('침');
    if (r.treatment_summary?.choona) parts.push('추나');
    if (r.treatment_summary?.yakchim) parts.push('약침');
    if (r.treatment_summary?.uncovered?.length) {
      for (const u of r.treatment_summary.uncovered) {
        parts.push(u.name);
      }
    }
    if (r.general_amount > 0 && parts.length === 0) parts.push('비급여');
    if (r.insurance_self > 0 && !r.treatment_summary?.acupuncture) parts.push('급여');
    return parts.join(', ') || '-';
  };

  // ─── Render ───

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* 상단: 날짜 네비게이션 */}
      <div className="bg-white border-b px-4 py-3 flex items-center gap-3 shrink-0">
        <h1 className="text-lg font-bold text-gray-800 mr-2">🔍 진료회고</h1>

        {/* CS 스타일 날짜 네비게이션 */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => moveDate(-1)}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
          >
            ◀
          </button>
          <div className="relative">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => { setSelectedDate(e.target.value); setShowDatePicker(false); }}
              className="absolute inset-0 opacity-0 cursor-pointer"
              id="reflection-date-picker"
            />
            <button
              onClick={() => {
                const el = document.getElementById('reflection-date-picker') as HTMLInputElement;
                el?.showPicker?.();
              }}
              className="px-4 py-1.5 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-lg border transition-colors min-w-[180px]"
            >
              {dateDisplay}
            </button>
          </div>
          <button
            onClick={() => moveDate(1)}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
          >
            ▶
          </button>
          {!isToday && (
            <button
              onClick={() => setSelectedDate(getCurrentDate())}
              className="ml-1 px-3 py-1.5 text-xs bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 font-medium"
            >
              오늘
            </button>
          )}
        </div>

        {/* 통계 */}
        <div className="ml-auto flex items-center gap-4 text-sm text-gray-500">
          <span>전체 <strong className="text-gray-800">{stats.total}</strong>명</span>
          <span>회고 <strong className="text-purple-600">{stats.reflected}</strong>/{stats.total}</span>
          <span>매출 <strong className="text-green-600">{formatAmount(stats.totalAmount)}</strong>원</span>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* 테이블 */}
        <div className={`${selectedRow ? 'w-3/5' : 'w-full'} overflow-auto transition-all`}>
          {loading ? (
            <div className="p-8 text-center text-gray-400">
              <i className="fas fa-spinner fa-spin mr-2"></i>로딩 중...
            </div>
          ) : rows.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <div className="text-5xl mb-4">📋</div>
              <div className="text-lg">해당 날짜의 수납 기록이 없습니다</div>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-100 sticky top-0 z-10">
                <tr>
                  <th className="px-2 py-2.5 text-left font-medium text-gray-600 w-8">#</th>
                  <th className="px-2 py-2.5 text-left font-medium text-gray-600 w-14">시간</th>
                  <th className="px-2 py-2.5 text-left font-medium text-gray-600">환자명</th>
                  <th className="px-2 py-2.5 text-left font-medium text-gray-600 w-20">차트번호</th>
                  <th className="px-2 py-2.5 text-center font-medium text-gray-600 w-12">나이</th>
                  <th className="px-2 py-2.5 text-center font-medium text-gray-600 w-10">성별</th>
                  <th className="px-2 py-2.5 text-left font-medium text-gray-600 w-20">지역</th>
                  <th className="px-2 py-2.5 text-center font-medium text-gray-600 w-14">종별</th>
                  <th className="px-2 py-2.5 text-left font-medium text-gray-600">진료내용</th>
                  <th className="px-2 py-2.5 text-right font-medium text-gray-600 w-20">수납액</th>
                  <th className="px-2 py-2.5 text-center font-medium text-gray-600 w-10">회고</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((row, idx) => {
                  const isSelected = selectedRow?.receipt.id === row.receipt.id;
                  const hasReflection = row.reflection && (row.reflection.strengths || row.reflection.weaknesses || row.reflection.next_plan);
                  const r = row.receipt;
                  return (
                    <tr
                      key={r.id}
                      onClick={() => openReflection(row)}
                      className={`cursor-pointer hover:bg-blue-50 transition-colors ${
                        isSelected ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                      }`}
                    >
                      <td className="px-2 py-2.5 text-gray-400 text-xs">{idx + 1}</td>
                      <td className="px-2 py-2.5 text-gray-500 text-xs">
                        {r.receipt_time ? (() => { const m = r.receipt_time.match(/(\d{2}):(\d{2})/); return m ? `${m[1]}:${m[2]}` : '-'; })() : '-'}
                      </td>
                      <td className="px-2 py-2.5 font-medium text-gray-800">{r.patient_name}</td>
                      <td className="px-2 py-2.5 text-gray-500 font-mono text-xs">{r.chart_no}</td>
                      <td className="px-2 py-2.5 text-center text-gray-600 text-xs">{r.age || '-'}</td>
                      <td className="px-2 py-2.5 text-center text-gray-600 text-xs">{formatSex(row.patientExtra?.sex || null)}</td>
                      <td className="px-2 py-2.5 text-gray-500 text-xs">{shortenAddress(row.patientExtra?.address || null)}</td>
                      <td className="px-2 py-2.5 text-center">
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                          row.actingType === '초진' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {row.actingType}
                        </span>
                      </td>
                      <td className="px-2 py-2.5 text-gray-600 text-xs truncate max-w-40">{receiptSummary(r)}</td>
                      <td className="px-2 py-2.5 text-right text-gray-700 font-medium text-xs">
                        {formatAmount(r.total_amount)}
                      </td>
                      <td className="px-2 py-2.5 text-center">
                        {hasReflection ? (
                          <span className="text-green-500" title="회고 작성됨">✅</span>
                        ) : (
                          <span className="text-gray-300 hover:text-purple-500 transition-colors" title="회고 작성">✏️</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* 우측 사이드 패널: 회고 작성 */}
        {selectedRow && (
          <div className="w-2/5 border-l bg-white overflow-y-auto shrink-0">
            <div className="p-4">
              {/* 환자 요약 */}
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-base font-bold text-gray-800">
                    {selectedRow.receipt.patient_name}
                    <span className="ml-2 text-xs font-normal text-gray-400">#{selectedRow.receipt.chart_no}</span>
                  </h2>
                  <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-1.5">
                    <span>{selectedRow.receipt.age || '-'}세</span>
                    <span>/</span>
                    <span>{formatSex(selectedRow.patientExtra?.sex || null)}</span>
                    {selectedRow.patientExtra?.address && (
                      <><span>·</span><span>{shortenAddress(selectedRow.patientExtra.address)}</span></>
                    )}
                    <span>·</span>
                    <span className={`px-1 py-0.5 rounded text-xs ${
                      selectedRow.actingType === '초진' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                    }`}>{selectedRow.actingType}</span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedRow(null)}
                  className="text-gray-400 hover:text-gray-600 p-1"
                >
                  ✕
                </button>
              </div>

              {/* 수납 요약 */}
              <div className="bg-gray-50 rounded-lg p-2.5 mb-4 text-xs text-gray-600">
                <div className="flex justify-between">
                  <span>💰 {receiptSummary(selectedRow.receipt)}</span>
                  <span className="font-medium text-gray-800">{formatAmount(selectedRow.receipt.total_amount)}원</span>
                </div>
                {selectedRow.receipt.memo && (
                  <div className="mt-1 text-gray-500">📝 {selectedRow.receipt.memo}</div>
                )}
              </div>

              <hr className="mb-4" />

              {/* 회고 입력 폼 */}
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-green-700 block mb-1">
                    ✅ 잘한 점
                  </label>
                  <textarea
                    value={reflectionForm.strengths}
                    onChange={(e) => setReflectionForm({ ...reflectionForm, strengths: e.target.value })}
                    placeholder="이번 상담에서 잘한 점..."
                    className="w-full border rounded-lg p-2.5 text-sm resize-none h-20 focus:ring-2 focus:ring-green-300 focus:border-green-400"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-amber-700 block mb-1">
                    😔 아쉬운 점
                  </label>
                  <textarea
                    value={reflectionForm.weaknesses}
                    onChange={(e) => setReflectionForm({ ...reflectionForm, weaknesses: e.target.value })}
                    placeholder="아쉬웠던 부분..."
                    className="w-full border rounded-lg p-2.5 text-sm resize-none h-20 focus:ring-2 focus:ring-amber-300 focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-blue-700 block mb-1">
                    💡 개선할 점
                  </label>
                  <textarea
                    value={reflectionForm.improvements}
                    onChange={(e) => setReflectionForm({ ...reflectionForm, improvements: e.target.value })}
                    placeholder="다음에 개선할 점..."
                    className="w-full border rounded-lg p-2.5 text-sm resize-none h-20 focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-purple-700 block mb-1">
                    🎯 다음 진료 계획
                  </label>
                  <textarea
                    value={reflectionForm.next_plan}
                    onChange={(e) => setReflectionForm({ ...reflectionForm, next_plan: e.target.value })}
                    placeholder="다음 내원 시 확인할 사항, 처방 변경 계획..."
                    className="w-full border rounded-lg p-2.5 text-sm resize-none h-20 focus:ring-2 focus:ring-purple-300 focus:border-purple-400"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-600 block mb-1">
                    🏷️ 태그
                  </label>
                  <input
                    value={reflectionForm.tags}
                    onChange={(e) => setReflectionForm({ ...reflectionForm, tags: e.target.value })}
                    placeholder="#치료기간안내 #티칭충실 #공감부족 ..."
                    className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-gray-300"
                  />
                </div>

                {/* 대표원장 코멘트 */}
                <div className="bg-orange-50 rounded-lg p-3">
                  <label className="text-xs font-bold text-orange-700 block mb-1">
                    👨‍⚕️ 대표원장 코멘트
                  </label>
                  {reflectionForm.director_commented_at && (
                    <div className="text-xs text-orange-400 mb-1">
                      {format(new Date(reflectionForm.director_commented_at), 'MM/dd HH:mm')} 작성
                    </div>
                  )}
                  <textarea
                    value={reflectionForm.director_comment}
                    onChange={(e) => setReflectionForm({ ...reflectionForm, director_comment: e.target.value })}
                    placeholder="조언이나 코멘트..."
                    className="w-full border border-orange-200 rounded-lg p-2.5 text-sm resize-none h-16 focus:ring-2 focus:ring-orange-300 bg-white"
                  />
                </div>

                {/* 버튼 */}
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={saveReflection}
                    disabled={saving}
                    className="flex-1 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 text-sm font-medium"
                  >
                    {saving ? '저장 중...' : '💾 저장'}
                  </button>
                  <button
                    onClick={() => setSelectedRow(null)}
                    className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 text-sm"
                  >
                    닫기
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TreatmentReflection;
