# Haniwon - 기술 스택

## 기술 스택 개요

| 카테고리 | 기술 | 버전 |
|----------|------|------|
| 언어 | TypeScript | 5.3.3 |
| 프레임워크 | React | 18.2.0 |
| 빌드 도구 | Vite | 5.0.8 |
| 스타일링 | Tailwind CSS | 3.4.0 |
| 상태 관리 | Zustand, TanStack Query | 5.0.9, 5.90.16 |
| 라우팅 | React Router | 6.22.0 |
| 데이터베이스 | PostgreSQL, MSSQL | - |
| 실시간 통신 | Socket.IO | 4.8.3 |

## 프론트엔드 스택

### 핵심 프레임워크

| 라이브러리 | 버전 | 용도 |
|-----------|------|------|
| React | 18.2.0 | UI 프레임워크 |
| React DOM | 18.2.0 | DOM 렌더링 |
| React Router DOM | 6.22.0 | 클라이언트 사이드 라우팅 |
| TypeScript | 5.3.3 | 정적 타입 언어 |

### 상태 관리

| 라이브러리 | 버전 | 용도 |
|-----------|------|------|
| Zustand | 5.0.9 | 전역 상태 관리 |
| TanStack Query | 5.90.16 | 서버 상태 관리, 캐싱 |

### 스타일링

| 라이브러리 | 버전 | 용도 |
|-----------|------|------|
| Tailwind CSS | 3.4.0 | 유틸리티 CSS 프레임워크 |
| PostCSS | 8.4.32 | CSS 후처리 |
| Autoprefixer | 10.4.16 | 브라우저 접두사 자동 추가 |
| clsx | 2.1.1 | 조건부 클래스 조합 |

### UI 컴포넌트

| 라이브러리 | 버전 | 용도 |
|-----------|------|------|
| @dnd-kit/core | 6.3.1 | 드래그앤드롭 코어 |
| @dnd-kit/sortable | 10.0.0 | 정렬 가능한 목록 |
| @dnd-kit/utilities | 3.2.2 | DnD 유틸리티 |
| Recharts | 3.6.0 | 차트 시각화 |

### 에디터

| 라이브러리 | 버전 | 용도 |
|-----------|------|------|
| @tiptap/react | 3.14.0 | Rich Text 에디터 |
| @tiptap/starter-kit | 3.14.0 | 기본 에디터 기능 |
| @tiptap/extension-bubble-menu | 3.14.0 | 버블 메뉴 |
| @tiptap/extension-image | 3.14.0 | 이미지 삽입 |
| @tiptap/extension-link | 3.14.0 | 링크 삽입 |
| @tiptap/extension-placeholder | 3.14.0 | 플레이스홀더 |
| @tiptap/extension-underline | 3.11.0 | 밑줄 |
| @tiptap/pm | 3.14.0 | ProseMirror 바인딩 |
| CodeMirror | 6.0.2 | 코드 에디터 |
| @codemirror/lang-css | 6.3.1 | CSS 문법 하이라이팅 |
| @codemirror/lang-html | 6.4.11 | HTML 문법 하이라이팅 |
| @codemirror/state | 6.5.2 | 에디터 상태 관리 |
| @codemirror/view | 6.38.8 | 에디터 뷰 |
| @codemirror/theme-one-dark | 6.1.3 | 다크 테마 |

### 문서 처리

| 라이브러리 | 버전 | 용도 |
|-----------|------|------|
| jsPDF | 3.0.3 | PDF 생성 |
| jspdf-autotable | 5.0.2 | PDF 테이블 생성 |
| pdfjs-dist | 5.4.394 | PDF 뷰어 |
| xlsx | 0.18.5 | Excel 파일 처리 |

### 유틸리티

| 라이브러리 | 버전 | 용도 |
|-----------|------|------|
| date-fns | 4.1.0 | 날짜 처리 |
| Axios | 1.13.2 | HTTP 클라이언트 |

## 백엔드 연동

### 서버 아키텍처

#### unified-server

exe로 패키징된 통합 서버로, 3개의 포트를 제공합니다.

| 포트 | 역할 | 설명 |
|------|------|------|
| 11111 | 정적 파일 서빙 | 프로덕션 빌드(`dist/`) 배포 |
| 3100 | MSSQL API | 오케이차트 EMR 연동 (환자정보, 예약, 진료기록) |
| 3200 | PostgreSQL API | 하니원 앱 데이터 (복약관리, 블로그, 치료기록 등) |

#### hani-api-server

| 포트 | 역할 | 설명 |
|------|------|------|
| 3001 | 약재 재고 API | 약재 재고 관리 전용 서버 (unified-server와 별도) |

#### 개발 서버 (계획 중)

Python FastAPI를 사용한 개발 서버가 exe 패키징된 unified-server의 개발 대안으로 검토 중입니다.

### 데이터베이스

| 데이터베이스 | 용도 | 연결 방식 |
|-------------|------|-----------|
| PostgreSQL | 앱 자체 데이터 (복약관리, 치료기록, 블로그 등) | unified-server API (포트 3200) |
| MSSQL | EMR 연동 (환자정보, 예약, 진료기록) | unified-server API (포트 3100) |
| Supabase | 블로그 시스템 전용 (향후 사용 예정) | @supabase/supabase-js |

### API 패턴

#### PostgreSQL API (포트 3200)

| 메서드 | 엔드포인트 | 설명 |
|--------|-----------|------|
| POST | `/api/execute` | SQL 실행 (SELECT, INSERT, UPDATE, DELETE) |
| POST | `/api/metrics/*` | 통계 관련 엔드포인트 |
| POST | `/api/tables/{tableName}/update` | 테이블 레코드 업데이트 |
| POST | `/api/tables/{tableName}/delete` | 테이블 레코드 삭제 |

#### MSSQL API (포트 3100)

| 메서드 | 엔드포인트 | 설명 |
|--------|-----------|------|
| POST | `/api/execute` | MSSQL SQL 실행 |
| GET | `/api/reservations` | 예약 목록 조회 |
| GET | `/api/patients/search` | 환자 검색 |
| GET | `/api/doctors` | 의사 목록 조회 |

### API 클라이언트 라이브러리

`src/shared/lib/postgres.ts`에 정의된 PostgreSQL API 클라이언트입니다.

| 함수 | 용도 |
|------|------|
| `query<T>(sql)` | SELECT 쿼리 실행, 객체 배열 반환 |
| `queryOne<T>(sql)` | 단일 행 조회, 첫 번째 결과 또는 null 반환 |
| `execute(sql)` | INSERT/UPDATE/DELETE 실행, 영향 행 수 반환 |
| `insert(sql)` | INSERT 후 RETURNING id로 삽입 ID 반환 |
| `escapeString(value)` | SQL Injection 방지를 위한 문자열 이스케이프 |
| `toSqlValue(value)` | 값을 SQL 형식으로 변환 (null, number, boolean, Date, string) |
| `getCurrentDate()` | 로컬 시간 기준 현재 날짜 (YYYY-MM-DD) |
| `getCurrentTimestamp()` | ISO 8601 형식 현재 시간 |
| `tableExists(name)` | information_schema를 통한 테이블 존재 여부 확인 |
| `getTables()` | public 스키마의 모든 테이블 목록 조회 |
| `isTableInitialized(key)` | 테이블 초기화 캐시 확인 |
| `markTableInitialized(key)` | 테이블 초기화 완료 마킹 |

모든 API 호출은 `POST /api/execute`에 `{ sql: string }` 형태로 SQL을 전송하는 방식입니다.

### 실시간 통신

| 라이브러리 | 버전 | 용도 |
|-----------|------|------|
| Socket.IO Client | 4.8.3 | 실시간 이벤트 통신 |

### 외부 서비스

| 서비스 | 라이브러리 | 용도 |
|--------|-----------|------|
| Supabase | @supabase/supabase-js 2.86.0 | 블로그 시스템 전용 (향후 사용 예정) |
| Google Generative AI | @google/generative-ai 0.24.1 | AI 기능 |

## 프레임워크 선택 이유

### React 18

- **Concurrent Features**: Suspense, Transitions 등 최신 동시성 기능
- **생태계**: 풍부한 라이브러리와 커뮤니티
- **컴포넌트 기반**: 재사용 가능한 UI 컴포넌트
- **TypeScript 지원**: 완전한 타입 안전성

### Vite

- **빠른 개발 서버**: ESM 기반 즉각적인 HMR
- **최적화된 빌드**: Rollup 기반 프로덕션 빌드
- **설정 간소화**: 최소한의 설정으로 시작
- **플러그인 생태계**: 다양한 확장 기능

### Tailwind CSS

- **유틸리티 퍼스트**: 빠른 스타일링
- **일관성**: 디자인 시스템 기반
- **번들 최적화**: 사용하지 않는 CSS 자동 제거
- **반응형**: 내장된 반응형 유틸리티

### TanStack Query

- **서버 상태 관리**: API 데이터 캐싱 및 동기화
- **자동 리페치**: 백그라운드 데이터 갱신
- **낙관적 업데이트**: 빠른 UI 반응
- **오류 처리**: 내장된 재시도 로직

### Zustand

- **간단한 API**: 보일러플레이트 최소화
- **TypeScript 친화적**: 완전한 타입 추론
- **성능**: 최소한의 리렌더링
- **devtools**: Redux DevTools 지원

## 개발 환경 요구사항

### 시스템 요구사항

| 항목 | 요구사항 |
|------|----------|
| Node.js | 18.x 이상 |
| npm | 9.x 이상 |
| OS | Windows 10/11, macOS, Linux |
| 브라우저 | Chrome 90+, Edge 90+, Firefox 90+ |

### 환경 변수

`.env.local` 파일에 다음 변수를 설정해야 합니다:

| 변수 | 설명 | 예시 |
|------|------|------|
| VITE_POSTGRES_API_URL | PostgreSQL API 서버 주소 | http://192.168.0.173:3200 |
| VITE_MSSQL_API_URL | MSSQL API 서버 주소 | http://192.168.0.173:3100 |

### 네트워크 요구사항

- 내부 네트워크 접근 (192.168.0.x 대역)
- API 서버 (192.168.0.173) 접근 가능
- hani-api-server (localhost:3001) 접근 가능

## 빌드 및 배포 설정

### 개발 서버

```bash
# 의존성 설치
npm install

# 개발 서버 실행 (포트 5170)
npm run dev
```

개발 서버 설정 (`vite.config.ts`):
- 포트: 5170
- 호스트: 0.0.0.0 (모든 네트워크 인터페이스)

### 프로덕션 빌드

```bash
# 타입 체크
npm run typecheck

# 프로덕션 빌드
npm run build

# 빌드 미리보기
npm run preview
```

빌드 출력:
- 출력 디렉토리: `dist/`
- 에셋 최적화: 코드 분할, 트리 쉐이킹
- 정적 파일 서빙: unified-server (포트 11111)

### TypeScript 설정

`tsconfig.json` 주요 설정:

| 설정 | 값 | 설명 |
|------|-----|------|
| target | ES2020 | ECMAScript 2020 타겟 |
| module | ESNext | ES 모듈 시스템 |
| strict | false | 타입 검사 (비엄격 모드) |
| jsx | react-jsx | React 17+ JSX 변환 |
| moduleResolution | bundler | 번들러 모듈 해석 |
| isolatedModules | true | 격리된 모듈 변환 |

### 경로 별칭

`vite.config.ts`에 정의된 경로 별칭:

| 별칭 | 경로 |
|------|------|
| @ | ./src |
| @shared | ./src/shared |
| @modules | ./src/modules |
| @portal | ./src/modules/portal |
| @manage | ./src/modules/manage |
| @doctor | ./src/modules/doctor |
| @inventory | ./src/modules/inventory |
| @treatment | ./src/modules/treatment |
| @funnel | ./src/modules/funnel |
| @content | ./src/modules/content |
| @blog | ./src/modules/blog |
| @acting | ./src/modules/acting |
| @chat | ./src/modules/chat |

## 아키텍처 패턴

### 모듈러 모놀리스

- **21개 기능 모듈**: 독립적인 도메인 분리
- **공유 모듈**: 공통 컴포넌트, 유틸리티, 타입
- **명확한 경계**: 모듈 간 의존성 최소화

### 컴포넌트 구조

- **Container/Presenter**: 로직과 UI 분리
- **Custom Hooks**: 재사용 가능한 상태 로직
- **Context API**: 전역 상태 주입

### 데이터 흐름

```
Component -> TanStack Query -> API Client -> unified-server -> Database
                 ^
             Zustand (전역 상태)
```

---

*마지막 업데이트: 2026-02-06*
