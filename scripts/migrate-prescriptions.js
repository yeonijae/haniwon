/**
 * gosibang의 처방 데이터를 haniwon SQLite로 마이그레이션
 * 사용법: node scripts/migrate-prescriptions.js
 */

const POSTGRES_API_URL = process.env.POSTGRES_API_URL || 'http://192.168.0.173:3200';

// gosibang에서 가져온 처방 데이터 (308개)
const PRESCRIPTION_DEFINITIONS = [
  { name: "가온체감탕", alias: "", category: "다이어트", source: "", composition: "의이인:300/숙지황:160/용안육:120/당귀:120/황기:120/괄루근:80/산약:80/상백피:80/귤피:80/천궁:60/마황:150" },
  { name: "가온체감탕0", alias: "체감탕", category: "다이어트", source: "", composition: "의이인:300/숙지황:160/용안육:120/당귀:120/황기:120/괄루근:80/산약:80/상백피:80/귤피:80/천궁:60" },
  { name: "갈근가반하탕", alias: "", category: "마황탕", source: "상한금궤", composition: "마황:6/계지:4/자감초:4/갈근:8/작약:4/대추:6/생강:6/반하:16" },
  { name: "갈근가천신반", alias: "", category: "", source: "창방", composition: "마황:6/계지:4/자감초:4/갈근:8/작약:4/대추:6/생강:6/반하:16/천궁:4/신이:4" },
  { name: "갈근비염방", alias: "", category: "", source: "창방", composition: "마황:8/행인:4/의이인:8/계지:4/자감초:4/갈근:8/작약:4/대추:6/생강:6/반하:16/과루인:16/천궁:4/신이:4/길경:6/황련:3/맥문동:20/석고:8" },
  { name: "갈근탕", alias: "", category: "마황제", source: "상한금궤", composition: "마황:6/계지:4/자감초:4/갈근:8/작약:4/대추:6/생강:6" },
  { name: "갈근탕가천궁신이", alias: "갈근가천신", category: "", source: "후세방", composition: "마황:6/계지:4/자감초:4/갈근:8/작약:4/대추:6/생강:6/천궁:4/신이:4" },
  { name: "갈근황금황련탕", alias: "갈금련", category: "금련제", source: "상한금궤", composition: "갈근:16/황련:6/황금:6/자감초:6" },
  { name: "감맥대조탕", alias: "", category: "감초제", source: "상한금궤", composition: "생감초:6/대추:5/부소맥:28" },
  { name: "감수반하탕", alias: "", category: "함흉제", source: "상한금궤", composition: "감수:0.6/반하:2/작약:2/자감초:1.4" },
  { name: "감초건강탕", alias: "", category: "건강제", source: "상한금궤", composition: "자감초:8/건강:6" },
  { name: "감초부자탕", alias: "", category: "계지제", source: "상한금궤", composition: "계지:8/자감초:4/부자:2/백출:4" },
  { name: "감초사심탕", alias: "감사", category: "금련제", source: "상한금궤", composition: "황련:2/황금:6/인삼:6/반하:16/자감초:8/대추:6/건강:6" },
  { name: "감초탕", alias: "", category: "감초제", source: "상한금궤", composition: "생감초:4" },
  { name: "강삼조이", alias: "", category: "", source: "후세방", composition: "생강:6/대추:6" },
  { name: "건강부자탕", alias: "", category: "부자제", source: "상한금궤", composition: "건강:2/부자:2" },
  { name: "건강황금황련인삼탕", alias: "강금련인", category: "금련제", source: "상한금궤", composition: "건강:6/황금:6/황련:6/인삼:6" },
  { name: "건조비염방", alias: "", category: "", source: "창방", composition: "마황:4/행인:4/의이인:4/계지:6/자감초:6/갈근:8/작약:4/대추:6/생강:8/반하:32/과루실:16/천궁:4/신이:4/길경:6/맥문동:20/건지황:10/황기:6" },
  { name: "계강조초황신부탕", alias: "", category: "계지제", source: "상한금궤", composition: "계지:6/작약:6/자감초:4/대추:6/마황:4/세신:4/부자:1" },
  { name: "계마각반탕", alias: "", category: "마황제", source: "상한금궤", composition: "마황:2/계지:3/자감초:2/행인:7/작약:2/대추:2/생강:2" },
  { name: "계작지모탕", alias: "", category: "계지제", source: "상한금궤", composition: "계지:8/작약:6/자감초:4/생강:10/지모:8/방풍:8/마황:4/백출:10/부자:2" },
  { name: "계지가갈근탕", alias: "", category: "계지제", source: "상한금궤", composition: "계지:6/작약:6/자감초:4/대추:6/생강:6/갈근:8" },
  { name: "계지가계탕", alias: "", category: "계지제", source: "상한금궤", composition: "계지:10/작약:6/자감초:4/대추:6/생강:6" },
  { name: "계지가대황탕", alias: "", category: "계지제", source: "상한금궤", composition: "계지:6/작약:12/자감초:4/대추:6/생강:6/대황:4" },
  { name: "계지가부자탕", alias: "", category: "계지제", source: "상한금궤", composition: "계지:6/작약:6/자감초:6/대추:6/생강:6/부자:1" },
  { name: "계지가용골모려탕", alias: "계용모", category: "계지제", source: "상한금궤", composition: "계지:6/작약:6/자감초:4/대추:6/생강:6/용골:6/모려:6" },
  { name: "계지가작약생강인삼신가탕", alias: "신가탕", category: "계지제", source: "상한금궤", composition: "계지:6/작약:8/자감초:4/대추:6/생강:8/인삼:6" },
  { name: "계지가작약탕", alias: "", category: "계지제", source: "상한금궤", composition: "계지:6/작약:12/자감초:4/대추:6/생강:6" },
  { name: "계지가황기탕", alias: "", category: "계지제", source: "상한금궤", composition: "계지:6/작약:6/자감초:4/대추:6/생강:6/황기:4" },
  { name: "계지가후박행자탕", alias: "", category: "계지제", source: "상한금궤", composition: "계지:6/작약:6/자감초:4/대추:6/생강:6/후박:4/행인:15" },
  { name: "계지거계가복령백출탕", alias: "거계가영출탕", category: "계지제", source: "상한금궤", composition: "작약:6/자감초:4/대추:6/생강:6/백출:6/복령:6" },
  { name: "계지거작약가부자탕", alias: "", category: "계지제", source: "상한금궤", composition: "계지:6/자감초:4/생강:6/대추:6/부자:1" },
  { name: "계지거작약탕", alias: "", category: "계지제", source: "상한금궤", composition: "계지:6/자감초:4/대추:6/생강:6" },
  { name: "계지복령환", alias: "계령", category: "도인제", source: "상한금궤", composition: "계지:6/복령:8/도인:6/목단피:6/작약:6" },
  { name: "계지부자탕", alias: "", category: "계지제", source: "상한금궤", composition: "계지:8/자감초:4/대추:6/생강:6/부자:3" },
  { name: "계지생강지실탕", alias: "계생지", category: "계지제", source: "상한금궤", composition: "계지:6/생강:6/지실:10" },
  { name: "계지인삼탕", alias: "", category: "건강제", source: "상한금궤", composition: "인삼:6/백출:6/자감초:8/건강:6/계지:8" },
  { name: "계지탕", alias: "", category: "계지제", source: "상한금궤", composition: "계지:6/작약:6/자감초:4/대추:6/생강:6" },
  { name: "과루계지탕", alias: "", category: "계지제", source: "상한금궤", composition: "괄루근:4/계지:6/작약:6/자감초:4/생강:6/대추:6" },
  { name: "과루해백반하탕", alias: "", category: "해백제", source: "상한금궤", composition: "해백:6/과루인:16/반하:16" },
  { name: "과루해백백주탕", alias: "", category: "해백제", source: "상한금궤", composition: "해백:16/과루인:16" },
  { name: "곽향정기산", alias: "곽정", category: "", source: "후세방", composition: "곽향:7.5/자소엽:5/백지:2.5/대복피:2.5/복령:2.5/후박:2.5/백출:2.5/귤피:2.5/반하:2.5/길경:2.5/자감초:2.5/생강:3/대추:3" },
  { name: "교애사물탕", alias: "", category: "", source: "후세방", composition: "당귀:6/작약:8/천궁:4/아교주:4/자감초:4/애엽:6/숙지황:8" },
  { name: "구미강활탕", alias: "", category: "", source: "후세방", composition: "강활:7.5/방풍:7.5/천궁:6/백지:6/백출:6/황금:6/건지황:6/세신:2.5/자감초:2.5" },
  { name: "궁귀교애탕", alias: "", category: "당귀제", source: "상한금궤", composition: "당귀:6/작약:8/천궁:4/아교주:4/자감초:4/애엽:6/건지황:8" },
  { name: "귀비온담탕", alias: "", category: "", source: "후세방", composition: "귀비탕+온담탕" },
  { name: "귀비탕", alias: "", category: "", source: "후세방", composition: "당귀:5/용안육:5/산조인:5/원지:5/인삼:5/황기:5/백출:5/복령:5/목향:2.5/자감초:1.5/생강:3/대추:3" },
  { name: "귀비탕2", alias: "", category: "", source: "후세방", composition: "당귀:5/용안육:5/길초근:2/원지:5/인삼:5/황기:5/백출:5/복령:5/목향:2.5/자감초:1.5/생강:3/대추:3" },
  { name: "귀출파징탕", alias: "", category: "", source: "후세방", composition: "향부자:7.5/삼릉:5/봉출:5/작약:5/당귀미:5/청피:5/오약:3.5/홍화:2.5/소목:2.5/육계:2.5" },
  { name: "귤피대황박초탕", alias: "", category: "귤피제", source: "상한금궤", composition: "귤피:3/대황:6/망초:6" },
  { name: "귤피죽여탕", alias: "귤죽", category: "귤피제", source: "상한금궤", composition: "귤피:16/죽여:4/대추:15/생강:16/자감초:10/인삼:2" },
  { name: "귤피지실생강탕", alias: "귤지생", category: "귤피제", source: "상한금궤", composition: "귤피:32/지실:6/생강:16" },
  { name: "귤피탕", alias: "", category: "귤피제", source: "상한금궤", composition: "귤피:8/생강:16" },
  { name: "금은화연교", alias: "", category: "", source: "후세방", composition: "금은화:16/연교:8" },
  { name: "기울요통방", alias: "", category: "", source: "고시방", composition: "향사평위산+당귀작약산+계령+육미" },
  { name: "길경탕", alias: "", category: "감초제", source: "상한금궤", composition: "생감초:4/길경:2" },
  { name: "녹용쌍금탕", alias: "", category: "", source: "후세방", composition: "숙지황:5/황기:5/당귀:5/천궁:5/육계:3.5/작약:12.5/백출:10/후박:5/귤피:5/곽향:5/반하:5/자감초:5/생강:3/대추:3/뉴분골:2" },
  { name: "녹용쌍패탕", alias: "", category: "", source: "후세방", composition: "숙지황:5/황기:5/당귀:5/천궁:5/육계:3.5/작약:12.5/인삼:5/시호:5/전호:5/독활:5/강활:5/지각:5/길경:5/복령:5/자감초:5/생강:3/대추:3/박하:3/뉴분골:2" },
  { name: "녹용쌍화탕", alias: "", category: "", source: "후세방", composition: "숙지황:5/황기:5/당귀:5/천궁:5/계지:3.5/자감초:3.5/작약:12.5/생강:3/대추:3/뉴분골:2.5" },
  { name: "소시호탕", alias: "", category: "시호제", source: "상한금궤", composition: "시호:16/반하:16/황금:6/인삼:6/자감초:6/생강:6/대추:6" },
  { name: "대시호탕", alias: "", category: "시호제", source: "상한금궤", composition: "시호:16/반하:16/황금:6/지실:8/작약:6/대황:4/생강:10/대추:6" },
  { name: "반하사심탕", alias: "반사", category: "금련제", source: "상한금궤", composition: "황련:2/황금:6/인삼:6/반하:16/자감초:6/대추:6/건강:6" },
  { name: "당귀작약산", alias: "당작", category: "당귀제", source: "상한금궤", composition: "당귀:6/작약:12/천궁:12/복령:8/백출:8/택사:12" },
  { name: "오령산", alias: "", category: "복령제", source: "상한금궤", composition: "복령:6/계지:4/백출:6/택사:10/저령:6" },
  { name: "육미지황탕", alias: "육미", category: "복령제", source: "상한금궤", composition: "건지황:16/산약:8/산수유:8/복령:6/택사:6/목단피:6" },
  { name: "팔미환", alias: "팔미", category: "복령제", source: "상한금궤", composition: "건지황:16/산약:8/산수유:8/복령:6/택사:6/목단피:6/계지:2/부자:2" },
  { name: "보중익기탕", alias: "", category: "", source: "후세방", composition: "황기:7.5/인삼:5/백출:5/자감초:5/당귀:2.5/귤피:2.5/승마:1.5/시호:1.5" },
  { name: "십전대보탕", alias: "", category: "", source: "후세방", composition: "인삼:6/백출:6/복령:6/자감초:6/숙지황:6/작약:6/천궁:6/당귀:6/황기:5/육계:5/생강:5/대추:5" },
  { name: "일반쌍화탕", alias: "", category: "", source: "후세방", composition: "숙지황:5/황기:5/당귀:5/천궁:5/계지:3.5/자감초:3.5/작약:12.5/생강:3/대추:3" },
  { name: "소건중탕", alias: "", category: "계지제", source: "상한금궤", composition: "계지:6/작약:12/자감초:4/대추:6/생강:6/교이:40" },
  { name: "마황탕", alias: "", category: "마황제", source: "상한금궤", composition: "마황:6/계지:4/자감초:2/행인:21" },
  { name: "소청룡탕", alias: "", category: "마황제", source: "상한금궤", composition: "마황:6/계지:6/자감초:6/작약:6/오미자:6/반하:16/건강:6/세신:6" },
  { name: "마행의감탕", alias: "", category: "마황제", source: "상한금궤", composition: "마황:8/행인:4/의이인:12/자감초:4" },
  { name: "소함흉탕", alias: "", category: "함흉제", source: "상한금궤", composition: "황련:3/반하:16/과루인:16" },
  { name: "대승기탕", alias: "", category: "대황제", source: "상한금궤", composition: "대황:8/망초:7/후박:16/지실:10" },
  { name: "백호탕", alias: "", category: "석고제", source: "상한금궤", composition: "석고:32/지모:12/갱미:18/자감초:4" },
  { name: "진무탕", alias: "", category: "부자제", source: "상한금궤", composition: "부자:1/백출:4/복령:6/작약:6/생강:6" },
  { name: "사역탕", alias: "", category: "부자제", source: "상한금궤", composition: "부자:2/자감초:4/건강:3" },
  { name: "치자시탕", alias: "치시", category: "치자제", source: "상한금궤", composition: "치자:14/두시:20" },
  { name: "반하후박탕", alias: "", category: "반하제", source: "상한금궤", composition: "반하:32/생강:10/복령:8/후박:6/자소엽:4" },
];

async function executeSql(sql) {
  try {
    const res = await fetch(POSTGRES_API_URL + '/api/sqlite/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql })
    });
    const data = await res.json();
    return !data.error;
  } catch (error) {
    return false;
  }
}

function escapeStr(str) {
  if (!str) return 'NULL';
  return "'" + str.replace(/'/g, "''") + "'";
}

async function main() {
  console.log('처방 데이터 마이그레이션 시작... (' + PRESCRIPTION_DEFINITIONS.length + '개)');

  let updated = 0;
  let inserted = 0;

  for (const p of PRESCRIPTION_DEFINITIONS) {
    // 먼저 UPDATE 시도
    const updateSql = 'UPDATE prescription_definitions SET ' +
      'alias = ' + escapeStr(p.alias) + ', ' +
      'category = ' + escapeStr(p.category) + ', ' +
      'source = ' + escapeStr(p.source) + ', ' +
      'composition = ' + escapeStr(p.composition) + ' ' +
      'WHERE name = ' + escapeStr(p.name);

    await executeSql(updateSql);
    updated++;

    // INSERT OR IGNORE로 새 항목 추가
    const insertSql = 'INSERT OR IGNORE INTO prescription_definitions (name, alias, category, source, composition, is_active) VALUES (' +
      escapeStr(p.name) + ', ' +
      escapeStr(p.alias) + ', ' +
      escapeStr(p.category) + ', ' +
      escapeStr(p.source) + ', ' +
      escapeStr(p.composition) + ', 1)';

    await executeSql(insertSql);
  }

  console.log('마이그레이션 완료: ' + PRESCRIPTION_DEFINITIONS.length + '개 처리');
}

main();
