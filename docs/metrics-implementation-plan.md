# 지표관리 구현 계획

> 작성일: 2026-02-05
> 상태: 계획 수립 완료

---

## 1. 개요

### 1.1 목적
원장별 진료 성과 지표를 체계적으로 관리하고 분석하는 기능 구현

### 1.2 핵심 지표
- **초진 관리**: 침환자/자보환자/약환자 초진 및 재초진 현황
- **재진율**: 초진 후 3주 내 2회 이상 방문 비율
- **삼진율**: 초진 후 3주 내 3회 이상 방문 비율
- **이탈율**: 초진 후 재방문하지 않은 비율
- **객단가**: 환자 1인당 평균 진료비

---

## 2. 핵심 정의

| 항목 | 정의 |
|------|------|
| **추적 기간** | 달력 기준 21일 (설정 변경 가능) |
| **이탈율 계산** | 주차별 - 해당 주 초진 환자를 +3주 추적 후 계산 |
| **객단가** | (수납금 + 미수금) / 환자수 |
| **누적 통계** | 담당의 입사일부터 / 최근 3개월 / 최근 6개월 |

### 2.1 환자 분류

```
침환자 = CheongGu_Money > 0 AND NOT 자보
  ├─ 건보 (직장/지역)
  ├─ 의료급여 1종/2종
  ├─ 차상위
  ├─ 산정특례
  └─ 임산부

자보환자 = TxItem LIKE '%자동차보험%'

약환자 = CheongGu_Money = 0 AND General_Money > 0
```

### 2.2 초진/재초진 판정

```
신규초진 = reg_date = TxDate (첫 등록일 = 진료일)
재초진 = reg_date < TxDate AND PxName = '진찰료(초진)'
```

### 2.3 이탈율 계산 예시

```
예: 21주차 (2026-05-18 ~ 2026-05-24) 초진 환자
  → 추적 기간: 2026-05-18 ~ 2026-06-14 (+21일)
  → 계산 가능 시점: 2026-06-15 (25주차)
  → 결과: 해당 기간 내 방문 횟수에 따라 재진/삼진/이탈 분류
```

---

## 3. 데이터베이스 설계

### 3.1 PostgreSQL 테이블

#### doctor_metrics_summary (원장별 누적 지표)

```sql
CREATE TABLE doctor_metrics_summary (
  id SERIAL PRIMARY KEY,
  doctor_id VARCHAR(20) NOT NULL,        -- doctor_3
  doctor_name VARCHAR(50) NOT NULL,
  hire_date DATE,                         -- 입사일

  -- 누적 (입사일부터)
  total_chim_choojin INT DEFAULT 0,
  total_jabo_choojin INT DEFAULT 0,
  total_yak_choojin INT DEFAULT 0,
  total_rejin_count INT DEFAULT 0,        -- 재진 달성
  total_samjin_count INT DEFAULT 0,       -- 삼진 달성
  total_ital_count INT DEFAULT 0,         -- 이탈

  -- 매출 누적
  total_insurance_revenue BIGINT DEFAULT 0,
  total_jabo_revenue BIGINT DEFAULT 0,
  total_uncovered_revenue BIGINT DEFAULT 0,

  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(doctor_id)
);
```

#### doctor_metrics_weekly (주차별 지표 히스토리)

```sql
CREATE TABLE doctor_metrics_weekly (
  id SERIAL PRIMARY KEY,
  year INT NOT NULL,
  week INT NOT NULL,                      -- ISO 주차 (1-53)
  doctor_id VARCHAR(20) NOT NULL,
  doctor_name VARCHAR(50),

  -- 초진 수
  chim_new INT DEFAULT 0,                 -- 침 신규초진
  chim_re INT DEFAULT 0,                  -- 침 재초진
  jabo_new INT DEFAULT 0,
  jabo_re INT DEFAULT 0,
  yak_new INT DEFAULT 0,
  yak_re INT DEFAULT 0,

  -- 재진율/삼진율/이탈율 (해당 주 초진 기준, +3주 후 계산)
  rejin_rate DECIMAL(5,2),                -- %
  samjin_rate DECIMAL(5,2),
  ital_rate DECIMAL(5,2),
  tracking_completed BOOLEAN DEFAULT FALSE,

  -- 매출
  insurance_revenue BIGINT DEFAULT 0,
  jabo_revenue BIGINT DEFAULT 0,
  uncovered_revenue BIGINT DEFAULT 0,

  -- 환자수 (객단가 계산용)
  insurance_patients INT DEFAULT 0,
  jabo_patients INT DEFAULT 0,
  uncovered_patients INT DEFAULT 0,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(year, week, doctor_id)
);
```

#### choojin_visit_tracking (초진 환자 방문 추적)

```sql
CREATE TABLE choojin_visit_tracking (
  id SERIAL PRIMARY KEY,
  customer_pk INT NOT NULL,               -- MSSQL Customer_PK
  chart_no VARCHAR(20),
  patient_name VARCHAR(50),
  choojin_date DATE NOT NULL,             -- 초진일
  choojin_type VARCHAR(10),               -- chim/jabo/yak
  choojin_sub_type VARCHAR(10),           -- new/re
  doctor_id VARCHAR(20),
  doctor_name VARCHAR(50),
  insurance_type VARCHAR(20),             -- 건보/1종/2종/차상위/산정특례/임산부/자보

  -- 추적 결과 (+21일 후 계산)
  visit_count INT DEFAULT 1,              -- 총 방문 횟수
  last_visit_date DATE,
  is_rejin BOOLEAN,                       -- 2회 이상
  is_samjin BOOLEAN,                      -- 3회 이상
  is_ital BOOLEAN,                        -- 1회만
  tracking_end_date DATE,                 -- 추적 종료일 (초진+21일)
  tracking_completed BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(customer_pk, choojin_date)
);
```

---

## 4. API 설계 (unified-server)

### 4.1 초진 환자 목록

```
GET /api/metrics/choojin-list
  ?start_date=2026-01-01
  &end_date=2026-01-31
  &type=all|chim|jabo|yak
  &doctor_id=doctor_3 (optional)
```

**Response:**
```json
{
  "patients": [
    {
      "customer_pk": 12345,
      "chart_no": "1234",
      "name": "홍길동",
      "choojin_date": "2026-01-15",
      "type": "chim",
      "sub_type": "new",
      "doctor": "김대현",
      "insurance_type": "건보"
    }
  ],
  "summary": {
    "chim": { "new": 20, "re": 10 },
    "jabo": { "new": 5, "re": 3 },
    "yak": { "new": 8, "re": 2 }
  }
}
```

### 4.2 재진율/삼진율/이탈율

```
GET /api/metrics/revisit-rate
  ?year=2026
  &week=21
  &doctor_id=doctor_3 (optional)
```

**Response:**
```json
{
  "week_info": {
    "year": 2026,
    "week": 21,
    "start_date": "2026-05-18",
    "end_date": "2026-05-24",
    "tracking_end": "2026-06-14",
    "can_calculate": true
  },
  "by_doctor": [
    {
      "doctor_id": "doctor_3",
      "doctor_name": "김대현",
      "chim": {
        "total_choojin": 30,
        "rejin_count": 20,
        "samjin_count": 15,
        "ital_count": 5,
        "rejin_rate": 66.67,
        "samjin_rate": 50.00,
        "ital_rate": 16.67
      },
      "jabo": {},
      "yak": {}
    }
  ]
}
```

### 4.3 객단가

```
GET /api/metrics/revenue-per-patient
  ?start_date=2026-01-01
  &end_date=2026-01-31
  &doctor_id=doctor_3 (optional)
```

**Response:**
```json
{
  "by_doctor": [
    {
      "doctor_id": "doctor_3",
      "doctor_name": "김대현",
      "insurance": {
        "revenue": 30000000,
        "patients": 150,
        "avg": 200000
      },
      "jabo": {},
      "uncovered": {},
      "total": {
        "revenue": 50000000,
        "patients": 200,
        "avg": 250000
      }
    }
  ]
}
```

### 4.4 누적 통계

```
GET /api/metrics/cumulative
  ?doctor_id=doctor_3
  &period=all|3m|6m
```

**Response:**
```json
{
  "doctor": {
    "id": "doctor_3",
    "name": "김대현",
    "hire_date": "2012-03-12"
  },
  "period": {
    "type": "all",
    "start_date": "2012-03-12",
    "end_date": "2026-02-05"
  },
  "metrics": {
    "choojin": {
      "chim": { "new": 5000, "re": 2000 },
      "jabo": { "new": 500, "re": 200 },
      "yak": { "new": 1000, "re": 300 }
    },
    "rates": {
      "rejin_rate": 72.5,
      "samjin_rate": 58.3,
      "ital_rate": 12.1
    },
    "revenue": {
      "insurance": { "total": 2000000000, "avg_per_patient": 180000 },
      "jabo": {},
      "uncovered": {}
    }
  }
}
```

### 4.5 환자 방문 상세 추적

```
GET /api/metrics/patient-visits
  ?customer_pk=12345
  &from_date=2026-01-01 (optional)
```

**Response:**
```json
{
  "patient": {
    "customer_pk": 12345,
    "chart_no": "1234",
    "name": "홍길동"
  },
  "visits": [
    { "date": "2026-01-15", "type": "초진", "doctor": "김대현" },
    { "date": "2026-01-22", "type": "재진", "doctor": "김대현" }
  ],
  "summary": {
    "total_visits": 5,
    "first_visit": "2026-01-15",
    "last_visit": "2026-02-01",
    "days_span": 17
  }
}
```

---

## 5. 프론트엔드 UI 설계

### 5.1 탭 구조

```
┌─────────┬─────────┬─────────┬─────────┐
│  종합   │ 초진분석 │ 재진율  │ 매출분석 │
└─────────┴─────────┴─────────┴─────────┘
```

### 5.2 기간 선택 옵션

- **주간**: 특정 주차 선택
- **월간**: 특정 월 선택
- **3개월**: 최근 3개월
- **원장 필터**: 전체 / 개별 원장

### 5.3 종합 탭

```
┌──────────────────────────────────────────────────┐
│ 기간 선택: [주간▼] [2026년 21주차▼] [원장:전체▼] │
├──────────────────────────────────────────────────┤
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ │
│ │ 총초진  │ │ 재진율  │ │ 삼진율  │ │ 이탈율  │ │
│ │   45    │ │  68.5%  │ │  52.3%  │ │  14.2%  │ │
│ │ ▲ +5    │ │ ▲ +2.1p │ │ ▼ -1.5p │ │ ▼ -0.8p │ │
│ └─────────┘ └─────────┘ └─────────┘ └─────────┘ │
├──────────────────────────────────────────────────┤
│ 원장별 요약                                      │
│ ┌────────┬──────┬──────┬──────┬──────┬────────┐ │
│ │ 원장   │ 초진 │재진율│삼진율│이탈율│ 객단가 │ │
│ ├────────┼──────┼──────┼──────┼──────┼────────┤ │
│ │ 김대현 │  15  │ 72%  │ 55%  │ 12%  │ 25만원 │ │
│ │ 강희종 │  12  │ 65%  │ 48%  │ 18%  │ 22만원 │ │
│ └────────┴──────┴──────┴──────┴──────┴────────┘ │
├──────────────────────────────────────────────────┤
│ 추이 차트 (최근 12주)                            │
│ [재진율/삼진율/이탈율 라인 차트]                 │
└──────────────────────────────────────────────────┘
```

### 5.4 초진분석 탭

```
┌──────────────────────────────────────────────────┐
│ 초진 현황                                        │
│ ┌───────────────────────────────────────────────┐│
│ │        │ 신규초진 │ 재초진  │  합계   │ 비율  ││
│ ├────────┼─────────┼─────────┼─────────┼───────┤│
│ │ 침환자 │    25   │   10    │   35    │ 70%   ││
│ │ 자보   │     5   │    3    │    8    │ 16%   ││
│ │ 약환자 │     5   │    2    │    7    │ 14%   ││
│ └────────┴─────────┴─────────┴─────────┴───────┘│
├──────────────────────────────────────────────────┤
│ 침환자 보험유형별                                │
│ [건보: 20] [1종: 5] [2종: 3] [차상위: 2]         │
│ [산정특례: 3] [임산부: 2]                        │
├──────────────────────────────────────────────────┤
│ 초진 환자 목록                   [엑셀 다운로드] │
│ ┌────┬────────┬────────┬────┬────────┬────────┐ │
│ │번호│차트번호│ 환자명 │구분│보험유형│ 담당의 │ │
│ └────┴────────┴────────┴────┴────────┴────────┘ │
└──────────────────────────────────────────────────┘
```

### 5.5 재진율 탭

```
┌──────────────────────────────────────────────────┐
│ 21주차 초진 환자 추적 결과 (추적완료: 2026-06-14)│
├──────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────┐  │
│ │  [====재진 68%====][삼진 52%][이탈 14%]     │  │
│ │       30명 중 20명   15명      5명          │  │
│ └─────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────┤
│ 원장별 상세                                      │
│ ┌────────┬────────────────────────────────────┐ │
│ │        │ 침환자      │ 자보       │ 약환자  │ │
│ │ 김대현 │ 재72/삼55% │ 재65/삼50% │ -       │ │
│ │ 강희종 │ 재65/삼48% │ -          │ 재70%   │ │
│ └────────┴────────────────────────────────────┘ │
├──────────────────────────────────────────────────┤
│ 누적 통계 (입사일~현재)                          │
│ ┌────────┬───────┬───────┬───────┬────────────┐ │
│ │ 원장   │재진율 │삼진율 │이탈율 │ 총 초진    │ │
│ │ 김대현 │ 72.5% │ 58.3% │ 12.1% │ 7,500명    │ │
│ │ (14년) │       │       │       │            │ │
│ └────────┴───────┴───────┴───────┴────────────┘ │
├──────────────────────────────────────────────────┤
│ 추이 차트                     [3개월][6개월][1년]│
│ [재진율/삼진율/이탈율 라인 차트]                 │
└──────────────────────────────────────────────────┘
```

### 5.6 매출분석 탭

```
┌──────────────────────────────────────────────────┐
│ 객단가 현황                                      │
│ ┌─────────┬─────────┬─────────┬─────────┐       │
│ │  전체   │  급여   │  자보   │ 비급여  │       │
│ │ 25만원  │ 18만원  │ 45만원  │ 12만원  │       │
│ └─────────┴─────────┴─────────┴─────────┘       │
├──────────────────────────────────────────────────┤
│ 원장별 객단가                                    │
│ ┌────────┬────────┬────────┬────────┬────────┐ │
│ │ 원장   │ 급여   │ 자보   │ 비급여 │ 전체   │ │
│ ├────────┼────────┼────────┼────────┼────────┤ │
│ │ 김대현 │ 20만   │ 50만   │ 15만   │ 28만   │ │
│ │ 강희종 │ 18만   │ 42만   │ 10만   │ 22만   │ │
│ └────────┴────────┴────────┴────────┴────────┘ │
├──────────────────────────────────────────────────┤
│ 매출 구성                                        │
│ [급여 60%][자보 25%][비급여 15%] = 5,000만원    │
├──────────────────────────────────────────────────┤
│ 객단가 추이 차트                                 │
│ [급여/자보/비급여 객단가 라인 차트]              │
└──────────────────────────────────────────────────┘
```

---

## 6. 파일 구조

```
haniwon/src/modules/doctor/
├── pages/
│   └── Metrics.tsx              # 메인 페이지
├── components/
│   └── metrics/
│       ├── MetricsOverview.tsx  # 종합 탭
│       ├── ChoojinAnalysis.tsx  # 초진분석 탭
│       ├── RevisitRates.tsx     # 재진율 탭
│       ├── RevenueAnalysis.tsx  # 매출분석 탭
│       ├── PeriodSelector.tsx   # 기간 선택 컴포넌트
│       └── MetricsChart.tsx     # 차트 컴포넌트
└── lib/
    └── metricsApi.ts            # API 호출 함수

unified-server/routes/
└── metrics_routes.py            # 새 API 라우트

scripts/
└── migration_metrics_tables.sql # DB 마이그레이션
```

---

## 7. 구현 순서

| 단계 | 작업 | 상세 | 예상 난이도 |
|------|------|------|-------------|
| **1** | PostgreSQL 테이블 생성 | doctor_metrics_summary, doctor_metrics_weekly, choojin_visit_tracking | 낮음 |
| **2** | unified-server API: choojin-list | 초진 환자 목록 조회 | 중 |
| **3** | unified-server API: revisit-rate | 재진율/삼진율/이탈율 계산 | 높음 |
| **4** | unified-server API: revenue-per-patient | 객단가 계산 | 중 |
| **5** | unified-server API: cumulative | 누적 통계 | 중 |
| **6** | Metrics.tsx 기본 구조 | 탭, 기간선택, 원장선택 컴포넌트 | 중 |
| **7** | 종합 탭 구현 | 카드 + 테이블 + 차트 | 중 |
| **8** | 초진분석 탭 구현 | 분류표 + 환자목록 | 중 |
| **9** | 재진율 탭 구현 | 게이지 + 누적통계 + 차트 | 중 |
| **10** | 매출분석 탭 구현 | 객단가 테이블 + 차트 | 낮음 |
| **11** | 주간 배치 스크립트 | 초진 추적 및 통계 자동 업데이트 | 중 |

---

## 8. 데이터 소스

### 8.1 MSSQL 테이블 (기존)

| 테이블 | 용도 |
|--------|------|
| Customer | 환자 정보, 보험유형, 등록일 |
| Detail | 진료 상세, 방문일, 담당의 |
| Receipt | 수납 정보, 매출 |

### 8.2 기존 통계 API 활용

| API | 용도 |
|-----|------|
| `/api/stats/all` | 기본 통계 데이터 |
| `/api/doctor-order` | 원장 입사순서 |

---

## 9. 향후 확장 고려사항

1. **알림 기능**: 이탈율 급증 시 알림
2. **목표 설정**: 원장별 재진율 목표 설정 및 달성률 표시
3. **비교 분석**: 동기간 전년 대비, 전월 대비 비교
4. **엑셀 내보내기**: 상세 데이터 엑셀 다운로드
5. **대시보드 위젯**: 메인 대시보드에 핵심 지표 위젯 추가

---

## 변경 이력

| 날짜 | 변경 내용 |
|------|-----------|
| 2026-02-05 | 최초 작성 |
