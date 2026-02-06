/**
 * Chart 모듈 SQLite 테이블 초기화 스크립트
 * 사용법: node scripts/init-chart-tables.js
 */

const POSTGRES_API_URL = process.env.POSTGRES_API_URL || 'http://192.168.0.173:3200';

async function executeSql(sql) {
  try {
    const res = await fetch(`${POSTGRES_API_URL}/api/sqlite/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql })
    });
    const data = await res.json();
    if (data.error) {
      console.error('Error:', data.error);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Fetch error:', error.message);
    return false;
  }
}

const statements = [
  // 1. 초진 차트
  `CREATE TABLE IF NOT EXISTS initial_charts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER NOT NULL,
    chart_date TEXT NOT NULL DEFAULT (date('now')),
    notes TEXT,
    is_auto_saved INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`,

  `CREATE INDEX IF NOT EXISTS idx_initial_charts_patient ON initial_charts(patient_id)`,
  `CREATE INDEX IF NOT EXISTS idx_initial_charts_date ON initial_charts(chart_date)`,

  // 2. 진단 기록
  `CREATE TABLE IF NOT EXISTS diagnoses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER NOT NULL,
    diagnosis_name TEXT NOT NULL,
    icd_code TEXT,
    diagnosis_date TEXT NOT NULL DEFAULT (date('now')),
    status TEXT DEFAULT 'active',
    severity TEXT DEFAULT 'moderate',
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`,

  `CREATE INDEX IF NOT EXISTS idx_diagnoses_patient ON diagnoses(patient_id)`,
  `CREATE INDEX IF NOT EXISTS idx_diagnoses_status ON diagnoses(status)`,

  // 3. 경과 기록 - SOAP 형식 (기존 테이블 확장)
  `ALTER TABLE progress_notes ADD COLUMN subjective TEXT`,
  `ALTER TABLE progress_notes ADD COLUMN objective TEXT`,
  `ALTER TABLE progress_notes ADD COLUMN assessment TEXT`,
  `ALTER TABLE progress_notes ADD COLUMN plan TEXT`,
  `ALTER TABLE progress_notes ADD COLUMN follow_up_plan TEXT`,
  `ALTER TABLE progress_notes ADD COLUMN notes TEXT`,

  // 4. 처방전
  `CREATE TABLE IF NOT EXISTS prescriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER NOT NULL,
    patient_name TEXT,
    patient_age INTEGER,
    patient_gender TEXT,
    chart_number TEXT,
    formula TEXT,
    merged_herbs TEXT,
    final_herbs TEXT,
    days INTEGER DEFAULT 15,
    packs INTEGER,
    total_amount REAL,
    source_type TEXT,
    source_id INTEGER,
    status TEXT DEFAULT 'draft',
    issued_at TEXT,
    completed_at TEXT,
    dosage_instruction_created INTEGER DEFAULT 0,
    dosage_instruction_created_at TEXT,
    dosage_instruction_data TEXT,
    prescription_issued INTEGER DEFAULT 0,
    prescription_issued_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`,

  `CREATE INDEX IF NOT EXISTS idx_prescriptions_patient ON prescriptions(patient_id)`,
  `CREATE INDEX IF NOT EXISTS idx_prescriptions_status ON prescriptions(status)`,
  `CREATE INDEX IF NOT EXISTS idx_prescriptions_issued ON prescriptions(issued_at)`,

  // 5. 처방 정의 확장 (기존 테이블에 컬럼 추가)
  `ALTER TABLE prescription_definitions ADD COLUMN alias TEXT`,
  `ALTER TABLE prescription_definitions ADD COLUMN source TEXT`,
  `ALTER TABLE prescription_definitions ADD COLUMN composition TEXT`,
  `ALTER TABLE prescription_definitions ADD COLUMN created_by TEXT DEFAULT '관리자'`,

  // 6. 처방 카테고리
  `CREATE TABLE IF NOT EXISTS prescription_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  )`,

  // 7. 복용법 템플릿
  `CREATE TABLE IF NOT EXISTS dosage_instructions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    subcategory TEXT,
    disease_name TEXT NOT NULL,
    condition_detail TEXT,
    description TEXT,
    dosage_method TEXT,
    precautions TEXT,
    keywords TEXT,
    full_text TEXT,
    source_filename TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`,

  `CREATE INDEX IF NOT EXISTS idx_dosage_instructions_category ON dosage_instructions(category)`,
  `CREATE INDEX IF NOT EXISTS idx_dosage_instructions_disease ON dosage_instructions(disease_name)`,

  // 8. 주의사항 프리셋
  `CREATE TABLE IF NOT EXISTS precaution_presets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    items TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`,

  // 9. 사후관리 통화 기록
  `CREATE TABLE IF NOT EXISTS aftercare_calls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER NOT NULL,
    prescription_id INTEGER NOT NULL,
    call_date TEXT NOT NULL,
    call_result TEXT NOT NULL,
    notes TEXT,
    next_action TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`,

  `CREATE INDEX IF NOT EXISTS idx_aftercare_calls_patient ON aftercare_calls(patient_id)`,
  `CREATE INDEX IF NOT EXISTS idx_aftercare_calls_prescription ON aftercare_calls(prescription_id)`,
];

async function main() {
  console.log('Chart 모듈 테이블 초기화 시작...');
  console.log(`API URL: ${POSTGRES_API_URL}`);

  let success = 0;
  let failed = 0;

  for (let i = 0; i < statements.length; i++) {
    const sql = statements[i];
    const shortSql = sql.substring(0, 60).replace(/\n/g, ' ') + '...';
    process.stdout.write(`[${i + 1}/${statements.length}] ${shortSql} `);

    const result = await executeSql(sql);
    if (result) {
      console.log('✓');
      success++;
    } else {
      console.log('✗ (이미 존재할 수 있음)');
      failed++;
    }
  }

  console.log(`\n완료: ${success} 성공, ${failed} 실패 (이미 존재하는 항목은 실패로 표시됨)`);
}

main();
