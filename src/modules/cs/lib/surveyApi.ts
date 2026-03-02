/**
 * Survey API - PostgreSQL CRUD functions
 */
import { query, queryOne, execute, insert, escapeString, tableExists, isTableInitialized, markTableInitialized } from '@shared/lib/postgres';
import type { SurveyTemplate, SurveySession, SurveyResponse, SurveyAnswer, SurveyQuestion } from '../types';

const INIT_KEY = 'survey_tables_v1';

// ============================================
// 초기 템플릿 데이터 (gosibang 여성설문 기반)
// ============================================
const FEMALE_HEALTH_SURVEY_QUESTIONS: SurveyQuestion[] = [
  { id: 'name', question_text: '이름', question_type: 'text', required: true, order: 1 },
  { id: 'chart_number', question_text: '차트번호', question_type: 'text', required: false, order: 2 },
  { id: 'doctor', question_text: '담당의', question_type: 'text', required: false, order: 3 },
  { id: 'gender_age', question_text: '성별/나이', question_type: 'text', required: true, order: 4 },
  { id: 'height_weight', question_text: '키/몸무게', question_type: 'text', required: true, order: 5 },
  { id: 'meal_pattern', question_text: '> 식사패턴', question_type: 'single_choice', options: ['규칙적', '불규칙', '교대근무'], required: true, order: 6 },
  { id: 'meal_breakfast', question_text: '- 아침식사 (복수선택)', question_type: 'multiple_choice', options: ['6시','7시','8시','9시','10시','불규칙한 시간','안먹는다','간단하게','밥1/2공기','밥1공기'], required: false, order: 7 },
  { id: 'meal_lunch', question_text: '- 점심식사 (복수선택)', question_type: 'multiple_choice', options: ['11시','12시','1시','2시','3시','불규칙한 시간','안먹는다','간단하게','밥1/2공기','밥1공기','밥2공기'], required: false, order: 8 },
  { id: 'meal_dinner', question_text: '- 저녁식사 (복수선택)', question_type: 'multiple_choice', options: ['5시','6시','7시','8시','9시','불규칙한 시간','안먹는다','간단하게','밥1/2공기','밥1공기','밥2공기'], required: false, order: 9 },
  { id: 'meal_night', question_text: '- 야식 (10시이후)', question_type: 'single_choice', options: ['안먹는다','가끔 먹는다.','주1~2회','주3~4회','주5~6회','매일 먹는다.'], required: false, order: 10 },
  { id: 'eating_habit', question_text: '- 식습관', question_type: 'multiple_choice', options: ['밥보다 반찬을 더 많이','밥 위주로 먹고, 반찬은 적게','국이나 물 말아먹어야 한다.','밥보다 간식 종류를 좋아한다.'], required: false, order: 11 },
  { id: 'appetite_digestion', question_text: '> 식욕/소화', question_type: 'text', required: false, order: 12 },
  { id: 'hunger', question_text: '- 배고픔', question_type: 'single_choice', options: ['잘 못느낀다.','가끔 느낀다.','때가 되면 느낀다.','항상 배가 고프다.'], required: false, order: 13 },
  { id: 'appetite', question_text: '- 입맛', question_type: 'single_choice', options: ['항상 입맛이 없다.','아침에만 입맛이 없다.','스트레스 받으면 입맛이 없다.','입맛 괜찮다.','입맛이 매우 좋다.'], required: false, order: 14 },
  { id: 'digestion', question_text: '- 소화상태 (복수선택)', question_type: 'multiple_choice', options: ['잘 체함','더부룩함','속쓰림','트림 자주','신물 자주','소화제 자주'], required: false, order: 15 },
  { id: 'food_preference', question_text: '> 음식/기호', question_type: 'text', required: false, order: 16 },
  { id: 'food_meat', question_text: '- 고기', question_type: 'single_choice', options: ['자주 먹는다.','반찬수준으로 먹는다.','잘 안먹는다.','일부러 먹는다.'], required: false, order: 17 },
  { id: 'food_seafood', question_text: '- 해산물', question_type: 'single_choice', options: ['자주 먹는다.','반찬수준으로 먹는다.','잘 안먹는다.','일부러 먹는다.'], required: false, order: 18 },
  { id: 'food_vegetable', question_text: '- 생야채', question_type: 'single_choice', options: ['자주 먹는다.','반찬수준으로 먹는다.','잘 안먹는다.','일부러 먹는다.'], required: false, order: 19 },
  { id: 'food_flour', question_text: '- 밀가루류', question_type: 'single_choice', options: ['자주 먹는다.','반찬수준으로 먹는다.','잘 안먹는다.','일부러 먹는다.'], required: false, order: 20 },
  { id: 'food_spicy', question_text: '- 매운것 (복수선택)', question_type: 'multiple_choice', options: ['잘 먹는다.','못먹는다.','자주 먹는다.','매운 것을 피한다.','먹으면 배아프다.','먹으면 설사한다.'], required: false, order: 21 },
  { id: 'food_dairy', question_text: '- 유제품 (복수선택)', question_type: 'multiple_choice', options: ['매일','자주','가끔','먹으면 배아프다.','먹으면 설사한다.','우유','요거트','장 음료'], required: false, order: 22 },
  { id: 'beverage', question_text: '- 음료수', question_type: 'single_choice', options: ['매일','자주','가끔','잘안마신다.'], required: false, order: 23 },
  { id: 'beverage_type', question_text: '- 음료수 종류 (복수선택)', question_type: 'multiple_choice', options: ['제로콜라','과일주스','일반 탄산음료','이온음료','에너지 드링크','기타(보기에 없음)'], required: false, order: 24 },
  { id: 'fruit', question_text: '- 과일', question_type: 'single_choice', options: ['매일','자주','가끔','잘안먹는다.'], required: false, order: 25 },
  { id: 'fruit_prefer', question_text: '- 좋아하는 과일 (복수선택)', question_type: 'multiple_choice', options: ['바나나','귤,오렌지','딸기','사과,배','참외,멜론,수박','복숭아,자두','기타(보기에 없음)'], required: false, order: 26 },
  { id: 'water_habit', question_text: '> 물', question_type: 'single_choice', options: ['일부러 마시려고 노력한다.','갈증 나서 마신다.','입이 말라서 마신다.'], required: false, order: 27 },
  { id: 'water_amount', question_text: '- 물의 양 (순수하게 물만)', question_type: 'single_choice', options: ['하루1~2잔','하루3~4잔','500미리','800미리','1리터','1.5리터','2리터','3리터','거의 안마신다.','기타(보기에 없음)'], required: false, order: 28 },
  { id: 'water_temp', question_text: '- 물 종류', question_type: 'single_choice', options: ['찬물이 좋다.','따뜻한 물이 좋다.','찬물이 좋지만, 미지근하게 마신다.','찬물이 좋지만, 따뜻하게 마신다.'], required: false, order: 29 },
  { id: 'coffee', question_text: '> 커피', question_type: 'single_choice', options: ['안마신다','가끔 마신다.','하루 딱 1잔','하루1~2잔','하루2~3잔','하루3잔 이상'], required: false, order: 30 },
  { id: 'coffee_type', question_text: '- 커피 종류 (복수선택)', question_type: 'multiple_choice', options: ['커피믹스','블랙커피(인스턴트)','아메리카노','카페라떼','에스프레소','디카페인','편의점 커피','기타(보기에 없음)'], required: false, order: 31 },
  { id: 'coffee_effect', question_text: '- 커피 반응 (복수선택)', question_type: 'multiple_choice', options: ['잠이 안온다.','소변을 자주 본다.','소화가 안된다.','배가 아프다.','머리가 아프다.','두근거린다.'], required: false, order: 32 },
  { id: 'alcohol', question_text: '> 술', question_type: 'single_choice', options: ['술 안마신다.','한달에 1~2회','주1~2회','주3~4회','주5~6회','매일'], required: false, order: 33 },
  { id: 'alcohol_when', question_text: '- 술 자리 (복수선택)', question_type: 'multiple_choice', options: ['비지니스','회식으로','모임으로','집에서 반주로'], required: false, order: 34 },
  { id: 'alcohol_type', question_text: '- 술 종류/양 (복수선택)', question_type: 'multiple_choice', options: ['맥주 1~2캔','맥주 2000cc 이상','소주 3~4잔','소주 1~2병','막걸리','와인','40도 이상','기타(보기에 없음)'], required: false, order: 35 },
  { id: 'stool_frequency', question_text: '> 대변', question_type: 'single_choice', options: ['매일 한번','하루 1~2회','하루 3회 이상','1~2일에 한번','2~3일에 한번','3~4일에 한번','1주일에 한번','심한 변비'], required: false, order: 36 },
  { id: 'stool_form', question_text: '- 대변 형태 (복수선택)', question_type: 'multiple_choice', options: ['보통이다','가늘다','물설사','약간 묽다','딱딱하다','토끼똥','불규칙하다','콧물변'], required: false, order: 37 },
  { id: 'stool_feeling', question_text: '- 대변 느낌 (복수선택)', question_type: 'multiple_choice', options: ['시원하다','덜 본것 같다','힘들게 나온다','휴지를 많이 쓴다','오래 앉아있다','변 볼때 아프다.'], required: false, order: 38 },
  { id: 'gas_pain', question_text: '- 가스/복통 (복수선택)', question_type: 'multiple_choice', options: ['가스가 자주 찬다.','방귀냄새가 안좋다.','방귀가 잘 안나온다.','배가 자주 아프다.','배에서 소리가 많이 난다.'], required: false, order: 39 },
  { id: 'urine_frequency', question_text: '> 소변', question_type: 'single_choice', options: ['하루 1~2회','하루 2~3회','하루 3~4회','3~4시간에 한번','2~3시간에 한번','1~2시간에 한번','1시간에 한번','더 자주 본다.'], required: false, order: 40 },
  { id: 'urine_night', question_text: '- 야간뇨', question_type: 'single_choice', options: ['가끔 소변 때문에 잠에서 깬다.','거의 매일 한번씩 소변 때문에 깬다.','매일 1~2회 자다가 소변 본다.','거의 2시간마다 깨서 소변 본다.','거의 1시간마다 깨서 소변 본다.'], required: false, order: 41 },
  { id: 'urine_color', question_text: '- 소변 형태 (복수선택)', question_type: 'multiple_choice', options: ['보통이다','진하다','거품이 많다','맑고 양이 많다','조금씩 자주 본다'], required: false, order: 42 },
  { id: 'urine_feeling', question_text: '- 소변 느낌 (복수선택)', question_type: 'multiple_choice', options: ['시원하다','덜 시원하다','느리게 나온다','금방 다시 마렵다','갑자기 참기 어렵다','힘들게 나온다.','소변 나올 때 아프다','소변 보고나면 아프다','항상 들어있는 것 같다','요실금'], required: false, order: 43 },
  { id: 'sleep_pattern', question_text: '> 수면', question_type: 'single_choice', options: ['규칙적','불규칙','교대근무'], required: false, order: 44 },
  { id: 'sleep_bedtime', question_text: '- 눕는시간', question_type: 'single_choice', options: ['9~10시','10시~11시','11시~12시','12시~1시','1시~2시','2시~3시','기타(보기에 없음)'], required: false, order: 45 },
  { id: 'sleep_waketime', question_text: '- 일어나는 시간', question_type: 'single_choice', options: ['5시~6시','6시~7시','7시~8시','8시~9시','9시~10시','10시~11시','기타(보기에 없음)'], required: false, order: 46 },
  { id: 'sleep_onset', question_text: '- 잠드는데 걸리는 시간', question_type: 'single_choice', options: ['금방 잠든다','10~20분 걸림','30~40분 걸림','1시간 정도 걸림','12시간 걸림','거의 못 잠'], required: false, order: 47 },
  { id: 'sleep_maintenance', question_text: '- 수면유지 (복수선택)', question_type: 'multiple_choice', options: ['잠이 깊이 안든다','중간에 자주 깬다','새벽에 깨서 잠이 안온다','소변 때문에 깬다','잠이 너무 일찍 깬다'], required: false, order: 48 },
  { id: 'dream', question_text: '- 꿈 (복수선택)', question_type: 'multiple_choice', options: ['안꾼다','꾸는데 기억안남','많이 꾼다','이상한 꿈','현실적인 내용','무서운 꿈','싸우는 꿈','가위에 잘 눌린다','잠꼬대 많이 한다'], required: false, order: 49 },
  { id: 'fatigue', question_text: '> 피로감 (복수선택)', question_type: 'multiple_choice', options: ['많이 자도 피곤하다.','아침에만 일어나기 힘들다.','아침부터 하루종일 피곤하다.','오후3~4시부터 피곤하다.','해질/퇴근 무렵에 피곤해진다.','초저녁에 피곤해서 잠든다.'], required: false, order: 50 },
  { id: 'cold_heat', question_text: '> 한열 (복수선택)', question_type: 'multiple_choice', options: ['더위를 많이 탄다','추위를 많이 탄다','더위/추위 둘다 탄다','바람이 닿으면 싫다','사우나가 싫다','기타(보기에 없음)'], required: false, order: 51 },
  { id: 'cold_area', question_text: '- 국소적 (복수선택)', question_type: 'multiple_choice', options: ['손이 차다','발이 차다','배가 차다','손이 뜨겁다','발이 뜨겁다','얼굴이 붉고 뜨겁다','갱년기처럼 열이 오르내린다','기타(보기에 없음)'], required: false, order: 52 },
  { id: 'sweat', question_text: '> 땀 (복수선택)', question_type: 'multiple_choice', options: ['더우면 많이 난다','덥지 않아도 많이 난다','식은땀이 잘난다','땀이 거의 안난다','보통이다.(다른 사람과 비슷하게)','자고 나면 땀에 젖어있다','땀이 나면 기운이 빠진다','항상 찝찝하고 끈적하게 난다'], required: false, order: 53 },
  { id: 'sweat_area', question_text: '- 땀 많이 나는 부위 (복수선택)', question_type: 'multiple_choice', options: ['손바닥','발바닥','겨드랑이','얼굴','머리','가슴','등','사타구니','엉덩이','기타(보기에 없음)'], required: false, order: 54 },
  { id: 'menstrual_cycle', question_text: '> 월경 - 주기', question_type: 'single_choice', options: ['불규칙하다','28~30일','30~35일','35~40일','40~45일','2~3개월에 한번','3개월 이상 무월경','생리가 끝남'], required: false, order: 55 },
  { id: 'menstrual_recent', question_text: '- 최근 생리일자', question_type: 'single_choice', options: ['기억 안남','기억 함(진료시 말씀해주세요)'], required: false, order: 56 },
  { id: 'menstrual_duration', question_text: '- 생리기간', question_type: 'single_choice', options: ['1~2일','3~4일','5~7일','7~10일','10일 이상 지속됨'], required: false, order: 57 },
  { id: 'menstrual_pain', question_text: '- 생리통 (복수선택)', question_type: 'multiple_choice', options: ['전혀 없음','진통제 없이 참을만함','진통제 먹으면 참을 만함','심하면 진통제를 먹는다','미리 진통제를 먹는다','진통제가 효과 없다'], required: false, order: 58 },
  { id: 'menstrual_pain_area', question_text: '- 생리통 부위 (복수선택)', question_type: 'multiple_choice', options: ['아랫배','골반 전체','복부 전체','허리','명치','가슴','머리','기타(보기에 없음)'], required: false, order: 59 },
  { id: 'menstrual_amount', question_text: '- 생리양', question_type: 'single_choice', options: ['보통이다(다른 사람과 비슷)','원래 많은 편이다.','원래 적은 편이다.','예전보다 줄었다.','예전보다 늘었다.'], required: false, order: 60 },
  { id: 'menstrual_color', question_text: '- 생리혈 (복수선택)', question_type: 'multiple_choice', options: ['보통이다(맑은 선홍색)','아주 묽게 나온다.','찌꺼기가 많이 보인다.','큰 덩어리가 많다.','냄새가 많이 난다.'], required: false, order: 61 },
  { id: 'menstrual_pms', question_text: '- 월경전증후군 (복수선택)', question_type: 'multiple_choice', options: ['어지러움','두통','소화불량','식욕항진','체중증가','부종','짜증폭발','기타(보기에 없음)'], required: false, order: 62 },
  { id: 'supplement', question_text: '> 건강기능식품', question_type: 'single_choice', options: ['특별히 먹는게 없다.','가끔 먹는다.','항상 먹는다.'], required: false, order: 63 },
  { id: 'medication', question_text: '> 양약 (복수선택)', question_type: 'multiple_choice', options: ['고혈압약','고지혈증약','당뇨약','식도염약','비염약','알레르기약','감기약','정형외과약','정신의학과약','기타(보기에 없음)'], required: false, order: 64 },
  { id: 'disease', question_text: '> 평소 질환 (복수선택)', question_type: 'multiple_choice', options: ['소화기 질환','심장 질환','호흡기 질환(비염)','피부 질환','부인과 질환','B형 간염 보균자','콩팥 질환','기타(보기에 없음)'], required: false, order: 65 },
];

// ============================================
// 테이블 초기화
// ============================================

// survey_sessions 변경 시 NOTIFY 트리거 설치
async function ensureSurveyNotifyTrigger(): Promise<void> {
  const key = 'survey_notify_trigger';
  if (isTableInitialized(key)) return;
  try {
    await execute(`
      CREATE OR REPLACE FUNCTION notify_survey_change() RETURNS trigger AS $$
      BEGIN
        PERFORM pg_notify('table_change', json_build_object(
          'table', 'survey_sessions',
          'operation', TG_OP,
          'id', COALESCE(NEW.id, OLD.id)
        )::text);
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    await execute(`
      DROP TRIGGER IF EXISTS survey_sessions_notify ON survey_sessions
    `);
    await execute(`
      CREATE TRIGGER survey_sessions_notify
      AFTER INSERT OR UPDATE OR DELETE ON survey_sessions
      FOR EACH ROW EXECUTE FUNCTION notify_survey_change()
    `);
    markTableInitialized(key);
  } catch (e) {
    console.error('Survey notify trigger 설치 실패:', e);
  }
}

export async function ensureSurveyTables(): Promise<void> {
  if (isTableInitialized(INIT_KEY)) return;

  const exists = await tableExists('survey_templates');
  if (!exists) {
    await execute(`
      CREATE TABLE IF NOT EXISTS survey_templates (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        questions JSONB NOT NULL,
        display_mode TEXT DEFAULT 'single_page',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await execute(`
      CREATE TABLE IF NOT EXISTS survey_sessions (
        id SERIAL PRIMARY KEY,
        patient_id INTEGER,
        patient_name TEXT,
        chart_number TEXT,
        age INTEGER,
        gender TEXT,
        template_id INTEGER REFERENCES survey_templates(id),
        doctor_name TEXT,
        status TEXT DEFAULT 'waiting',
        created_by TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        completed_at TIMESTAMP
      )
    `);
    await execute(`
      CREATE TABLE IF NOT EXISTS survey_responses (
        id SERIAL PRIMARY KEY,
        session_id INTEGER REFERENCES survey_sessions(id),
        template_id INTEGER REFERENCES survey_templates(id),
        patient_id INTEGER,
        answers JSONB NOT NULL,
        submitted_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // 초기 템플릿 삽입
    await insertDefaultTemplate();
  } else {
    // 테이블 존재하지만 초기 템플릿이 없을 수 있음
    const count = await queryOne<{ cnt: number }>(`SELECT COUNT(*)::int as cnt FROM survey_templates`);
    if (count && count.cnt === 0) {
      await insertDefaultTemplate();
    }
  }

  markTableInitialized(INIT_KEY);

  // NOTIFY 트리거 설치
  await ensureSurveyNotifyTrigger();
}

async function insertDefaultTemplate(): Promise<void> {
  const questionsJson = JSON.stringify(FEMALE_HEALTH_SURVEY_QUESTIONS).replace(/'/g, "''");
  await execute(`
    INSERT INTO survey_templates (name, description, questions, display_mode, is_active)
    VALUES ('기본설문지-여성', '여성 환자용 기본 건강 설문지입니다.', '${questionsJson}', 'single_page', true)
  `);
}

// ============================================
// Template CRUD
// ============================================

export async function getTemplates(): Promise<SurveyTemplate[]> {
  await ensureSurveyTables();
  return query<SurveyTemplate>(`SELECT * FROM survey_templates WHERE is_active = true ORDER BY id`);
}

export async function getAllTemplates(): Promise<SurveyTemplate[]> {
  await ensureSurveyTables();
  return query<SurveyTemplate>(`SELECT * FROM survey_templates ORDER BY id`);
}

export async function getTemplate(id: number): Promise<SurveyTemplate | null> {
  await ensureSurveyTables();
  return queryOne<SurveyTemplate>(`SELECT * FROM survey_templates WHERE id = ${id}`);
}

export async function createTemplate(data: { name: string; description?: string; questions: SurveyQuestion[]; display_mode?: string }): Promise<number> {
  await ensureSurveyTables();
  const questionsJson = JSON.stringify(data.questions).replace(/'/g, "''");
  return insert(`
    INSERT INTO survey_templates (name, description, questions, display_mode)
    VALUES (${escapeString(data.name)}, ${escapeString(data.description || null)}, '${questionsJson}', ${escapeString(data.display_mode || 'single_page')})
  `);
}

export async function updateTemplate(id: number, data: { name?: string; description?: string; questions?: SurveyQuestion[]; display_mode?: string; is_active?: boolean }): Promise<void> {
  await ensureSurveyTables();
  const sets: string[] = [];
  if (data.name !== undefined) sets.push(`name = ${escapeString(data.name)}`);
  if (data.description !== undefined) sets.push(`description = ${escapeString(data.description)}`);
  if (data.questions !== undefined) {
    const questionsJson = JSON.stringify(data.questions).replace(/'/g, "''");
    sets.push(`questions = '${questionsJson}'`);
  }
  if (data.display_mode !== undefined) sets.push(`display_mode = ${escapeString(data.display_mode)}`);
  if (data.is_active !== undefined) sets.push(`is_active = ${data.is_active}`);
  sets.push(`updated_at = NOW()`);
  await execute(`UPDATE survey_templates SET ${sets.join(', ')} WHERE id = ${id}`);
}

export async function deleteTemplate(id: number): Promise<void> {
  await execute(`UPDATE survey_templates SET is_active = false, updated_at = NOW() WHERE id = ${id}`);
}

export async function duplicateTemplate(id: number): Promise<number> {
  const tmpl = await getTemplate(id);
  if (!tmpl) throw new Error('Template not found');
  return createTemplate({ name: `${tmpl.name} (복사)`, description: tmpl.description, questions: tmpl.questions, display_mode: tmpl.display_mode });
}

// ============================================
// Session CRUD
// ============================================

export async function createSession(data: {
  patient_id?: number;
  patient_name?: string;
  chart_number?: string;
  age?: number;
  gender?: string;
  template_id: number;
  doctor_name?: string;
  created_by?: string;
}): Promise<number> {
  await ensureSurveyTables();
  return insert(`
    INSERT INTO survey_sessions (patient_id, patient_name, chart_number, age, gender, template_id, doctor_name, status, created_by)
    VALUES (${data.patient_id || 'NULL'}, ${escapeString(data.patient_name || null)}, ${escapeString(data.chart_number || null)},
            ${data.age || 'NULL'}, ${escapeString(data.gender || null)}, ${data.template_id},
            ${escapeString(data.doctor_name || null)}, 'waiting', ${escapeString(data.created_by || null)})
  `);
}

export async function getSessionsByDate(date: string, statusFilter?: string): Promise<SurveySession[]> {
  await ensureSurveyTables();
  let where = `WHERE s.created_at::date = '${date}'`;
  if (statusFilter && statusFilter !== 'all') {
    where += ` AND s.status = ${escapeString(statusFilter)}`;
  }
  return query<SurveySession>(`
    SELECT s.*, t.name as template_name
    FROM survey_sessions s
    LEFT JOIN survey_templates t ON s.template_id = t.id
    ${where}
    ORDER BY s.created_at DESC
  `);
}

export async function getTodaySessions(statusFilter?: string): Promise<SurveySession[]> {
  await ensureSurveyTables();
  const today = new Date().toISOString().split('T')[0];
  let where = `WHERE s.created_at::date = '${today}'`;
  if (statusFilter && statusFilter !== 'all') {
    where += ` AND s.status = ${escapeString(statusFilter)}`;
  }
  return query<SurveySession>(`
    SELECT s.*, t.name as template_name
    FROM survey_sessions s
    LEFT JOIN survey_templates t ON s.template_id = t.id
    ${where}
    ORDER BY s.created_at DESC
  `);
}

export async function getWaitingSessions(): Promise<SurveySession[]> {
  await ensureSurveyTables();
  const today = new Date().toISOString().split('T')[0];
  return query<SurveySession>(`
    SELECT s.*, t.name as template_name
    FROM survey_sessions s
    LEFT JOIN survey_templates t ON s.template_id = t.id
    WHERE s.status = 'waiting' AND s.created_at::date = '${today}'
    ORDER BY s.created_at DESC
  `);
}

export async function updateSessionStatus(id: number, status: string): Promise<void> {
  const extra = status === 'completed' ? ', completed_at = NOW()' : '';
  await execute(`UPDATE survey_sessions SET status = ${escapeString(status)}${extra} WHERE id = ${id}`);
}

export async function deleteSession(id: number): Promise<void> {
  await execute(`DELETE FROM survey_responses WHERE session_id = ${id}`);
  await execute(`DELETE FROM survey_sessions WHERE id = ${id}`);
}

// ============================================
// Response CRUD
// ============================================

export async function submitResponse(data: {
  session_id: number;
  template_id: number;
  patient_id?: number;
  answers: SurveyAnswer[];
}): Promise<number> {
  const answersJson = JSON.stringify(data.answers).replace(/'/g, "''");
  const id = await insert(`
    INSERT INTO survey_responses (session_id, template_id, patient_id, answers)
    VALUES (${data.session_id}, ${data.template_id}, ${data.patient_id || 'NULL'}, '${answersJson}')
  `);
  await updateSessionStatus(data.session_id, 'completed');
  return id;
}

export async function getResponseBySession(sessionId: number): Promise<SurveyResponse | null> {
  return queryOne<SurveyResponse>(`SELECT * FROM survey_responses WHERE session_id = ${sessionId} ORDER BY submitted_at DESC LIMIT 1`);
}
