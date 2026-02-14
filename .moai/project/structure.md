# Haniwon - 프로젝트 구조

## 전체 디렉토리 트리

```
haniwon/
├── .claude/                 # Claude Code 설정
│   ├── agents/              # 에이전트 정의
│   ├── hooks/               # 훅 스크립트
│   ├── rules/               # 규칙 파일
│   ├── settings.json        # 설정 파일
│   └── skills/              # 스킬 정의
├── .github/                 # GitHub 설정
│   └── workflows/           # GitHub Actions
├── .moai/                   # MoAI 프로젝트 관리
│   ├── announcements/       # 공지사항
│   ├── cache/               # 캐시 데이터
│   ├── config/              # 설정 파일
│   ├── llm-configs/         # LLM 설정
│   ├── memory/              # 메모리 저장소
│   ├── project/             # 프로젝트 문서
│   ├── reports/             # 리포트
│   └── specs/               # SPEC 문서
├── database/                # 데이터베이스 스키마
├── dist/                    # 빌드 출력
├── docs/                    # 문서
├── node_modules/            # npm 의존성
├── scripts/                 # 유틸리티 스크립트
├── src/                     # 소스 코드
│   ├── lib/                 # 라이브러리 설정
│   ├── modules/             # 기능 모듈 (21개)
│   └── shared/              # 공유 모듈
├── supabase/                # Supabase 설정 (블로그 시스템 전용, 향후 사용 예정)
├── CLAUDE.md                # Claude Code 지침
├── CLAUDE_CONTEXT.md        # 세션 컨텍스트
├── README.md                # 프로젝트 README
├── index.html               # HTML 진입점
├── package.json             # npm 패키지 설정
├── tsconfig.json            # TypeScript 설정
└── vite.config.ts           # Vite 빌드 설정
```

## 디렉토리 상세 설명

### src/ - 소스 코드

프로젝트의 핵심 소스 코드가 위치하는 디렉토리입니다.

| 디렉토리 | 설명 |
|----------|------|
| src/lib/ | 외부 라이브러리 설정 (Supabase 등) |
| src/modules/ | 기능별 모듈 (21개) |
| src/shared/ | 공통 컴포넌트, 유틸리티, 타입 |

#### src/modules/ - 기능 모듈

총 21개의 기능 모듈로 구성된 모듈러 모놀리스 아키텍처입니다.

| 모듈 | 경로 | 설명 |
|------|------|------|
| manage | `/manage/*` | 접수/수납 관리 |
| doctor | `/doctor/*` | 원장실 (차트, 처방, 메트릭) |
| treatment | `/treatment/*` | 치료실 관리 |
| acting | `/acting/*` | 액팅 대기열 관리 |
| pad | `/pad/*` | 원장 태블릿 인터페이스 |
| inventory | `/inventory/*` | 재고 관리 |
| herbal | `/herbal/*` | 한약/복약 관리 |
| reservation | `/reservation/*` | 예약 관리 |
| blog | `/blog/*` | 블로그 콘텐츠 |
| content | `/content/*` | CMS 관리 |
| funnel | `/funnel/*` | 마케팅 퍼널 |
| staff | `/staff/*` | 직원 관리 |
| statistics | `/statistics/*` | 통계 대시보드 |
| metrics | `/metrics/*` | KPI/메트릭 |
| exam | `/exam/*` | 검사 결과 |
| db-admin | `/db-admin/*` | DB 관리 도구 |
| wiki | `/wiki/*` | 운영 매뉴얼 |
| cs | `/cs/*` | 고객 서비스 |
| chat | `/chat/*` | 메시징 시스템 |
| portal | `/portal/*` | 인증/대시보드 |
| patient-care | `/patient-care/*` | 환자 케어 (herbal로 리다이렉트) |

#### src/shared/ - 공유 모듈

모든 모듈에서 공통으로 사용하는 코드입니다.

| 디렉토리 | 설명 |
|----------|------|
| shared/api/ | 공용 API 클라이언트 |
| shared/components/ | 공용 UI 컴포넌트 |
| shared/constants/ | 상수 정의 |
| shared/contexts/ | React Context |
| shared/hooks/ | 공용 커스텀 훅 |
| shared/lib/ | 유틸리티 (postgres, auth) |
| shared/styles/ | 공용 스타일 |
| shared/types/ | 공용 TypeScript 타입 |

### database/ - 데이터베이스 스키마

PostgreSQL 데이터베이스 스키마 및 마이그레이션 파일입니다.

| 파일 | 설명 |
|------|------|
| full_schema.sql | 전체 스키마 (통합) |
| phase1_treatment_records.sql | Phase 1: 치료 기록 |
| phase2_tasks.sql | Phase 2: 태스크 관리 |
| phase3_patient_care.sql | Phase 3: 환자 케어 |
| phase4_blog_system.sql | Phase 4: 블로그 시스템 |
| phase5_supply_requests.sql | Phase 5: 비품 요청 |
| phase6_herbal_management.sql | Phase 6: 한약 관리 |

### scripts/ - 유틸리티 스크립트

빌드, 배포, 초기화 등을 위한 스크립트입니다.

## 모듈 구조

각 기능 모듈은 다음과 같은 표준 구조를 따릅니다:

```
modules/{module-name}/
├── {ModuleName}App.tsx      # 모듈 진입점
├── api/                     # API 클라이언트
│   └── {module}Api.ts
├── components/              # UI 컴포넌트
│   ├── {Component}1.tsx
│   └── {Component}2.tsx
├── hooks/                   # 커스텀 훅
│   └── use{Hook}.ts
├── lib/                     # 유틸리티
│   └── {util}.ts
├── pages/                   # 페이지 컴포넌트
│   └── {Page}.tsx
├── services/                # 비즈니스 로직
│   └── {service}.ts
├── styles/                  # 모듈별 스타일
│   └── {module}.css
├── types.ts                 # 타입 정의
├── constants.ts             # 상수 정의
└── utils/                   # 유틸리티 함수
    └── {util}.ts
```

### 모듈 예시: doctor

```
modules/doctor/
├── DoctorApp.tsx            # 원장실 메인 앱
├── api/                     # API 함수
│   └── doctorApi.ts
├── components/              # 컴포넌트
│   ├── ChartView.tsx
│   ├── PatientList.tsx
│   └── PrescriptionForm.tsx
├── lib/                     # 유틸리티
│   └── chartUtils.ts
├── pages/                   # 페이지
│   ├── Dashboard.tsx
│   └── Metrics.tsx
├── services/                # 서비스
│   └── patientService.ts
├── styles/                  # 스타일
│   └── doctor.css
└── types.ts                 # 타입 정의
```

### 모듈 예시: manage

```
modules/manage/
├── ManageApp.tsx            # 접수/수납 메인 앱 (47,355 lines)
├── components/              # 컴포넌트
│   ├── PatientInfo.tsx
│   ├── PaymentForm.tsx
│   └── WaitingList.tsx
├── hooks/                   # 커스텀 훅
│   └── usePatient.ts
├── lib/                     # 유틸리티
│   └── paymentUtils.ts
├── utils/                   # 유틸리티 함수
│   └── formatters.ts
├── types.ts                 # 타입 정의 (14,530 lines)
└── constants.ts             # 상수 정의 (17,417 lines)
```

## 주요 파일 위치

### 설정 파일

| 파일 | 설명 |
|------|------|
| `/package.json` | npm 패키지 및 스크립트 설정 |
| `/tsconfig.json` | TypeScript 컴파일러 설정 |
| `/vite.config.ts` | Vite 빌드 도구 설정 |
| `/tailwind.config.js` | Tailwind CSS 설정 |
| `/postcss.config.js` | PostCSS 설정 |
| `/.env.example` | 환경 변수 예시 |

### 진입점

| 파일 | 설명 |
|------|------|
| `/index.html` | HTML 진입점 |
| `/src/main.tsx` | React 애플리케이션 진입점 |
| `/src/App.tsx` | 메인 앱 컴포넌트 및 라우팅 |

### 공용 라이브러리

| 파일 | 설명 |
|------|------|
| `/src/shared/lib/postgres.ts` | PostgreSQL API 클라이언트 |
| `/src/shared/lib/auth.ts` | 인증 유틸리티 |
| `/src/lib/supabase.ts` | Supabase 클라이언트 (블로그 시스템 전용, 향후 사용 예정) |

### 타입 정의

| 파일 | 설명 |
|------|------|
| `/src/shared/types/*.ts` | 공용 타입 정의 |
| `/src/modules/*/types.ts` | 모듈별 타입 정의 |
| `/src/vite-env.d.ts` | Vite 환경 타입 |

## 경로 별칭 (Path Aliases)

`vite.config.ts`에 정의된 경로 별칭입니다:

| 별칭 | 실제 경로 |
|------|----------|
| `@` | `./src` |
| `@shared` | `./src/shared` |
| `@modules` | `./src/modules` |
| `@portal` | `./src/modules/portal` |
| `@manage` | `./src/modules/manage` |
| `@doctor` | `./src/modules/doctor` |
| `@inventory` | `./src/modules/inventory` |
| `@treatment` | `./src/modules/treatment` |
| `@funnel` | `./src/modules/funnel` |
| `@content` | `./src/modules/content` |
| `@blog` | `./src/modules/blog` |
| `@acting` | `./src/modules/acting` |
| `@chat` | `./src/modules/chat` |

## 라우팅 구조

`App.tsx`에서 정의된 라우팅 구조입니다:

```
/                           # 포털 (로그인)
├── /portal/*               # 포털 모듈
├── /manage/*               # 접수/수납 관리
├── /doctor/*               # 원장실
├── /treatment/*            # 치료실
├── /acting/*               # 액팅 관리
├── /pad/*                  # 원장 패드
├── /reservation/*          # 예약 관리
├── /herbal/*               # 한약/복약 관리
├── /inventory/*            # 재고 관리
├── /blog/*                 # 블로그
├── /content/*              # 콘텐츠 관리
├── /funnel/*               # 마케팅 퍼널
├── /staff/*                # 직원 관리
├── /statistics/*           # 통계
├── /metrics/*              # 메트릭
├── /exam/*                 # 검사 결과
├── /db-admin/*             # DB 관리
├── /wiki/*                 # 운영 매뉴얼
├── /cs/*                   # 고객 서비스
├── /chat/*                 # 메시징
└── /patient-care/*         # 환자 케어 (-> /herbal 리다이렉트)
```

---

*마지막 업데이트: 2026-02-06*
