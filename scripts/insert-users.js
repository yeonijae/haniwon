/**
 * 포털 사용자 데이터 SQLite 삽입 스크립트
 */

const POSTGRES_API_URL = 'http://192.168.0.173:3200';

const users = [
  {
    id: 1,
    name: '관리자',
    login_id: 'admin',
    password_hash: '7582',
    role: 'super_admin',
    permissions: ["manage","chart","inventory","treatment","acting","herbal","funnel","content","reservation","doctor_pad","statistics","db_admin","staff"]
  },
  {
    id: 2,
    name: '데스크1',
    login_id: 'desk1',
    password_hash: 'desk1234',
    role: 'desk',
    permissions: ["manage","chart","reservation","statistics"]
  },
  {
    id: 3,
    name: '데스크2',
    login_id: 'desk2',
    password_hash: 'desk1234',
    role: 'desk',
    permissions: ["manage","chart","reservation","statistics"]
  },
  {
    id: 4,
    name: '데스크3',
    login_id: 'desk3',
    password_hash: 'desk1234',
    role: 'desk',
    permissions: ["manage","chart","reservation","statistics"]
  },
  {
    id: 5,
    name: '치료실1',
    login_id: 'treat1',
    password_hash: 'treat1234',
    role: 'treatment',
    permissions: ["treatment","acting"]
  },
  {
    id: 6,
    name: '치료실2',
    login_id: 'treat2',
    password_hash: 'treat1234',
    role: 'treatment',
    permissions: ["treatment","acting"]
  },
  {
    id: 7,
    name: '탕전실',
    login_id: 'tang1',
    password_hash: 'tang1234',
    role: 'decoction',
    permissions: ["inventory","herbal"]
  },
  {
    id: 8,
    name: '김대현',
    login_id: 'doctor1',
    password_hash: 'doc1234',
    role: 'medical_staff',
    permissions: ["manage","chart","doctor_pad","statistics","acting"]
  },
  {
    id: 9,
    name: '강희종',
    login_id: 'doctor2',
    password_hash: 'doc1234',
    role: 'medical_staff',
    permissions: ["manage","chart","doctor_pad","statistics","acting"]
  },
  {
    id: 10,
    name: '임세열',
    login_id: 'doctor3',
    password_hash: 'doc1234',
    role: 'medical_staff',
    permissions: ["manage","chart","doctor_pad","statistics","acting"]
  },
  {
    id: 11,
    name: '전인태',
    login_id: 'doctor4',
    password_hash: 'doc1234',
    role: 'medical_staff',
    permissions: ["manage","chart","doctor_pad","statistics","acting"]
  },
  {
    id: 12,
    name: '상담실1',
    login_id: 'counsel1',
    password_hash: 'counsel1234',
    role: 'counseling',
    permissions: ["manage","chart","funnel","herbal"]
  }
];

async function insertUser(user) {
  const permissionsJson = JSON.stringify(user.permissions).replace(/'/g, "''");
  const sql = `INSERT OR REPLACE INTO portal_users (id, name, login_id, password_hash, role, permissions, is_active, created_at, updated_at)
VALUES (${user.id}, '${user.name}', '${user.login_id}', '${user.password_hash}', '${user.role}', '${permissionsJson}', 1, datetime('now'), datetime('now'))`;

  try {
    const res = await fetch(`${POSTGRES_API_URL}/api/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql })
    });
    const data = await res.json();
    if (data.error) {
      console.error(`❌ ${user.name} (${user.login_id}): ${data.error}`);
    } else {
      console.log(`✅ ${user.name} (${user.login_id}) - ${user.role}`);
    }
  } catch (error) {
    console.error(`❌ ${user.name}: ${error.message}`);
  }
}

async function main() {
  console.log('=== 포털 사용자 삽입 시작 ===\n');

  for (const user of users) {
    await insertUser(user);
  }

  console.log('\n=== 완료 ===');

  // 확인 쿼리
  const res = await fetch(`${POSTGRES_API_URL}/api/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql: 'SELECT id, name, login_id, role FROM portal_users ORDER BY id' })
  });
  const data = await res.json();
  console.log('\n현재 등록된 사용자:');
  if (data.rows) {
    data.rows.forEach(row => {
      console.log(`  ${row[0]}. ${row[1]} (${row[2]}) - ${row[3]}`);
    });
  }
}

main();
