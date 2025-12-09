# Haniwon (하니원) - 한의원 통합 관리 시스템

한의원 업무를 위한 통합 클리닉 관리 시스템입니다.

## 주요 기능

### 환자 관리 (manage)
- 접수/대기 관리
- 환자 정보 조회 및 검색
- 수납 처리 (현금, 카드, 계좌이체, 미수금 관리)
- 치료실 배정

### 예약 관리 (reservation)
- 월간/일간 캘린더 뷰
- MSSQL 연동 예약 조회
- 예약 생성/수정/삭제

### 치료 관리 (treatment)
- 치료실 현황 모니터링
- 치료 항목 관리
- 환자별 기본 치료 설정

### 액팅 관리 (acting)
- 실시간 액팅 대기열 관리
- 드래그앤드롭 순서 변경
- 액팅 유형별 분류 (침, 추나, 초음파, 향기, 약침 등)

### 닥터패드 (doctor-pad)
- 원장 전용 진료 화면
- 실시간 환자 대기 현황
- 빠른 액팅 지시

### 환자 케어 (patient-care)
- 환자별 관리 항목 추적
- 추적 관찰 필요 환자 관리
- 케어 룰 설정

### 재고 관리 (inventory)
- 약재 관리
- 처방 정의
- 비품 요청

### 블로그 (blog)
- 콘텐츠 작성 및 관리
- 미디어 업로드
- 페이지 조회수 통계

### 포털 (portal)
- 직원 로그인/인증
- 역할 기반 메뉴 접근

## 기술 스택

- **Frontend**: React 18, TypeScript, Vite
- **Styling**: Tailwind CSS
- **State Management**: React Query (TanStack Query)
- **Database**: SQLite (내부 서버), MSSQL (EMR 연동)
- **Editor**: TipTap (Rich Text), CodeMirror (Code)
- **PDF**: jsPDF, pdf.js

## 프로젝트 구조

```
src/
├── modules/           # 기능별 모듈
│   ├── acting/        # 액팅 관리
│   ├── blog/          # 블로그
│   ├── chart/         # 차트
│   ├── content/       # 콘텐츠 관리
│   ├── doctor-pad/    # 닥터패드
│   ├── funnel/        # 퍼널
│   ├── inventory/     # 재고 관리
│   ├── manage/        # 환자/수납 관리
│   ├── patient-care/  # 환자 케어
│   ├── portal/        # 포털/인증
│   ├── reservation/   # 예약 관리
│   └── treatment/     # 치료 관리
├── shared/            # 공통 모듈
│   ├── api/           # 공용 API
│   ├── components/    # 공용 컴포넌트
│   ├── hooks/         # 공용 훅
│   ├── lib/           # 유틸리티 (sqlite, auth)
│   └── types/         # 공용 타입
└── scripts/           # 스크립트
    └── init-sqlite-schema.sql  # DB 스키마
```

## 설치 및 실행

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev

# 프로덕션 빌드
npm run build

# 타입 체크
npm run typecheck
```

## 환경 설정

`.env.local` 파일 생성:

```env
VITE_SQLITE_API_URL=http://192.168.0.173:3200
VITE_MSSQL_API_URL=http://192.168.0.173:3100
```

## API 서버

- **SQLite API**: `192.168.0.173:3200` - 내부 데이터 저장
- **MSSQL API**: `192.168.0.173:3100` - EMR 시스템 연동 (환자정보, 예약)

## 라이선스

Private - All rights reserved
