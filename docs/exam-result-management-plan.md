# 검사결과 관리 시스템 - 개발계획서

> 작성일: 2024-12-25
> 상태: 계획 단계

---

## 1. 개요

| 항목 | 내용 |
|------|------|
| **프로젝트명** | 검사결과 관리 시스템 (Exam Result Management) |
| **형태** | 통합포탈 앱 모듈 (`/exam`) |
| **저장 방식** | 로컬 서버 (unified-server) |
| **AI 모델** | Gemini 2.5 Flash (추후 조정 가능) |
| **예상 월 비용** | ~200원 (AI API) |

---

## 2. 검사 항목 (9종)

| # | 검사명 | 코드 | 데이터 형태 |
|---|--------|------|-------------|
| 1 | 적외선 체열검사 | `thermography` | 이미지 (전면/후면) |
| 2 | 인바디 체성분검사 | `inbody` | 이미지 + 수치 |
| 3 | 체형 검사 | `body_shape` | 이미지 (정면/측면/후면) |
| 4 | 평형 검사 | `balance` | 이미지 + 수치 |
| 5 | 설진 검사 | `tongue` | 이미지 |
| 6 | 맥진 검사 | `pulse` | 이미지 + 수치 |
| 7 | 뇌파 검사 | `eeg` | 이미지 + PDF |
| 8 | 자율신경 검사 | `ans` | 이미지 + 수치 |
| 9 | 피부사진 | `skin` | 이미지 (복수/일) |

> ※ 혈액검사: 보류 (별도 기기 연동)

---

## 3. 시스템 구조

```
┌─────────────────────────────────────────────────────────────────┐
│                      통합포탈 (Portal)                          │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────────┐          │
│  │진료 │ │수납 │ │원무 │ │닥터 │ │블로그│ │검사결과 │ ← 신규   │
│  │chart│ │cs   │ │manage│ │pad  │ │blog │ │  exam   │          │
│  └─────┘ └─────┘ └─────┘ └─────┘ └─────┘ └─────────┘          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Unified Server (192.168.0.173)               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ PostgreSQL   │  │ MSSQL API    │  │ File API (신규)      │  │
│  │ API :3200    │  │ :3100        │  │ :3200                │  │
│  │ - exam_results│ │ - 환자정보   │  │ - POST /api/files/   │  │
│  │ - attachments │ │              │  │ - GET /api/files/    │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌──────────────────────┐        ┌──────────────────────────────┐
│   PostgreSQL DB      │        │   로컬 파일 저장소            │
│   haniwon.db         │        │   C:\haniwon_data\exams\     │
└──────────────────────┘        └──────────────────────────────┘
```

---

## 4. 데이터베이스 설계

### 4.1 exam_results (검사결과)

```sql
CREATE TABLE exam_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL,
  exam_date DATE NOT NULL,
  exam_type TEXT NOT NULL,
  exam_name TEXT,
  findings TEXT,
  memo TEXT,
  doctor_name TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_exam_results_patient ON exam_results(patient_id);
CREATE INDEX idx_exam_results_date ON exam_results(exam_date);
CREATE INDEX idx_exam_results_type ON exam_results(exam_type);
```

### 4.2 exam_attachments (첨부파일)

```sql
CREATE TABLE exam_attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  exam_result_id INTEGER NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  thumbnail_path TEXT,
  sort_order INTEGER DEFAULT 0,
  uploaded_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY(exam_result_id) REFERENCES exam_results(id) ON DELETE CASCADE
);

CREATE INDEX idx_exam_attachments_result ON exam_attachments(exam_result_id);
```

### 4.3 exam_values (수치 데이터)

```sql
CREATE TABLE exam_values (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  exam_result_id INTEGER NOT NULL,
  item_name TEXT NOT NULL,
  item_value REAL,
  unit TEXT,
  reference_min REAL,
  reference_max REAL,
  FOREIGN KEY(exam_result_id) REFERENCES exam_results(id) ON DELETE CASCADE
);

CREATE INDEX idx_exam_values_result ON exam_values(exam_result_id);
```

---

## 5. 파일 저장 구조

```
C:\haniwon_data\
├── exams\
│   └── {patient_id}\
│       └── {exam_type}\
│           └── {yyyy-mm}\
│               └── {yyyymmdd}_{seq}.jpg
└── thumbnails\
    └── exams\
        └── {patient_id}\
            └── thumb_*.jpg
```

### 검사유형별 폴더

| 코드 | 폴더명 |
|------|--------|
| thermography | `thermography/` |
| inbody | `inbody/` |
| body_shape | `body_shape/` |
| balance | `balance/` |
| tongue | `tongue/` |
| pulse | `pulse/` |
| eeg | `eeg/` |
| ans | `ans/` |
| skin | `skin/` |

---

## 6. 프론트엔드 구조

```
src/modules/exam/                    ← 신규 모듈
├── ExamApp.tsx                      # 앱 진입점
├── pages/
│   └── ExamManagement.tsx           # 메인 페이지
├── components/
│   ├── ExamPatientSearch.tsx        # 환자 검색
│   ├── ExamResultList.tsx           # 검사 목록 (날짜별)
│   ├── ExamResultForm.tsx           # 등록/수정 폼
│   ├── ExamResultDetail.tsx         # 상세보기
│   ├── ExamTypeSelector.tsx         # 9개 유형 선택
│   ├── ExamFileUploader.tsx         # 파일 업로드
│   ├── ExamImageViewer.tsx          # 이미지 뷰어
│   └── ExamCompareViewer.tsx        # 날짜 비교
├── services/
│   └── examService.ts               # API 호출
├── lib/
│   └── fileUpload.ts                # 파일 업로드 유틸
└── types.ts                         # 타입 정의
```

---

## 7. 개발 단계 (Phase)

### Phase 1: 기반 구축

| # | 작업 | 상세 |
|---|------|------|
| 1-1 | File API 추가 | `unified-server/routes/file_routes.py` |
| 1-2 | DB 테이블 생성 | exam_results, exam_attachments, exam_values |
| 1-3 | 앱 모듈 생성 | `src/modules/exam/` 폴더 구조 |
| 1-4 | 포탈 메뉴 추가 | Portal에 "검사결과" 앱 카드 추가 |
| 1-5 | 라우팅 설정 | `/exam` 경로 추가 |

### Phase 2: 기본 CRUD

| # | 작업 | 상세 |
|---|------|------|
| 2-1 | 메인 페이지 | 좌측 환자검색 + 우측 검사목록 |
| 2-2 | 환자 검색 | MSSQL 연동, 최근 환자 표시 |
| 2-3 | 검사 목록 | 날짜별 그룹핑, 썸네일 미리보기 |
| 2-4 | 검사 등록 | 9개 유형 선택, 파일 업로드 |
| 2-5 | 검사 상세 | 보기/수정/삭제 |

### Phase 3: 이미지 뷰어

| # | 작업 | 상세 |
|---|------|------|
| 3-1 | 이미지 뷰어 | 확대/축소/회전 |
| 3-2 | 비교 뷰어 | 좌우 날짜별 비교 |
| 3-3 | 갤러리 뷰 | 썸네일 그리드 |

### Phase 4: AI 분석 & 검사결과책

| # | 작업 | 상세 |
|---|------|------|
| 4-1 | AI 소견 생성 | Gemini 2.5 Flash 연동 |
| 4-2 | 수치 입력 | 인바디, 맥진 등 수치 데이터 |
| 4-3 | 추이 그래프 | 시계열 변화 시각화 |
| 4-4 | 검사결과책 | PDF 생성, AI 종합 소견 |

---

## 8. 화면 설계

### 8.1 메인 화면

```
┌─────────────────────────────────────────────────────────────────┐
│  🔬 검사결과 관리                              [사용자] [닫기]  │
├─────────────────────────────────────────────────────────────────┤
│ ┌───────────────┬─────────────────────────────────────────────┐ │
│ │ 환자 검색     │ 홍길동 (M/45) - 검사이력                    │ │
│ │ [🔍 검색    ] │─────────────────────────────────────────────│ │
│ │               │ 유형: [전체▼]  기간: [    ] [+ 검사등록]    │ │
│ │ ── 최근 ──   │─────────────────────────────────────────────│ │
│ │ • 홍길동      │ 📅 2024-12-25                               │ │
│ │ • 김영희      │  🌡️체열  ⚖️인바디  👅설진                  │ │
│ │ • 박철수      │─────────────────────────────────────────────│ │
│ │               │ 📅 2024-12-20                               │ │
│ │               │  🧍체형  📷피부(3)                          │ │
│ └───────────────┴─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 8.2 검사 등록 폼

```
┌──────────────────────────────────────────────────────────────┐
│  검사 등록                                          [X 닫기] │
├──────────────────────────────────────────────────────────────┤
│  환자: 홍길동         검사일: [2024-12-25 📅]                │
├──────────────────────────────────────────────────────────────┤
│  검사유형:                                                   │
│  [🌡️체열] [⚖️인바디] [🧍체형] [⚖️평형] [👅설진]            │
│  [💓맥진] [🧠뇌파] [❤️자율신경] [📷피부]                    │
├──────────────────────────────────────────────────────────────┤
│  📁 파일 업로드 (드래그 또는 클릭)                           │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  [🖼️ img1.jpg ✕] [🖼️ img2.jpg ✕]                      │  │
│  └────────────────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────────────────┤
│  소견: [                                                  ]  │
│  담당의: [원장 ▼]                                            │
├──────────────────────────────────────────────────────────────┤
│                                    [취소]  [저장]            │
└──────────────────────────────────────────────────────────────┘
```

### 8.3 이미지 비교 뷰어

```
┌──────────────────────────────────────────────────────────────┐
│  설진 검사 비교                                     [X 닫기] │
├──────────────────────────────────────────────────────────────┤
│  [◀ 이전] 2024-12-25 vs 2024-11-20 [다음 ▶]                 │
├─────────────────────────┬────────────────────────────────────┤
│                         │                                    │
│     [2024-12-25]        │        [2024-11-20]               │
│                         │                                    │
│    ┌─────────────┐      │      ┌─────────────┐              │
│    │             │      │      │             │              │
│    │   혀 사진   │      │      │   혀 사진   │              │
│    │             │      │      │             │              │
│    └─────────────┘      │      └─────────────┘              │
│                         │                                    │
│  [🔍+] [🔍-] [↻회전]    │  [🔍+] [🔍-] [↻회전]              │
├─────────────────────────┴────────────────────────────────────┤
│  소견: 설태 감소, 혀색 호전                                  │
└──────────────────────────────────────────────────────────────┘
```

---

## 9. 서버 API 설계

### 9.1 File API (신규)

| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/api/files/upload` | 파일 업로드 |
| GET | `/api/files/{path}` | 파일 다운로드 |
| DELETE | `/api/files/{path}` | 파일 삭제 |
| GET | `/api/files/thumbnails/{path}` | 썸네일 조회 |

### 9.2 업로드 요청 형식

```
POST /api/files/upload
Content-Type: multipart/form-data

- file: 파일 데이터
- patient_id: 환자 ID
- category: exams
- exam_type: thermography (검사유형)
```

### 9.3 업로드 응답

```json
{
  "success": true,
  "file_path": "exams/12345/thermography/2024-12/20241225_001.jpg",
  "file_url": "/api/files/exams/12345/thermography/2024-12/20241225_001.jpg",
  "thumbnail_url": "/api/files/thumbnails/exams/12345/thumb_20241225_001.jpg",
  "file_size": 1234567,
  "mime_type": "image/jpeg"
}
```

---

## 10. 기술 스택

| 영역 | 기술 |
|------|------|
| Frontend | React + TypeScript + Tailwind CSS |
| Backend | Flask (unified-server) |
| Database | PostgreSQL (검사결과), MSSQL (환자정보) |
| File Storage | 로컬 서버 (`C:\haniwon_data`) |
| AI | Gemini 2.5 Flash API |
| 썸네일 생성 | Pillow (Python) |
| PDF 생성 | html2canvas + jsPDF (또는 react-pdf) |

---

## 11. 포탈 통합

### 11.1 라우팅 추가 (App.tsx)

```typescript
<Route path="/exam/*" element={
  <ProtectedRoute allowedRoles={['doctor', 'admin']}>
    <ExamApp user={user} />
  </ProtectedRoute>
} />
```

### 11.2 앱 카드 추가 (Portal.tsx)

```typescript
{
  id: 'exam',
  name: '검사결과',
  icon: 'fa-microscope',
  path: '/exam',
  color: 'purple',
  description: '검사결과 관리 및 분석'
}
```

---

## 12. 비용 분석

### 12.1 인프라 비용

| 항목 | 비용 |
|------|------|
| 로컬 서버 | 무료 (기존 활용) |
| 파일 저장소 | 무료 (로컬 HDD) |
| PostgreSQL DB | 무료 |

### 12.2 AI API 비용 (Gemini 2.5 Flash)

| 시나리오 | 월 예상 비용 |
|----------|-------------|
| 검사 500건 분석 | ~150원 |
| 검사결과책 50권 | ~50원 |
| **월 합계** | **~200원** |

### 12.3 향후 모델 업그레이드 옵션

| 모델 | 월 비용 (500건 기준) |
|------|---------------------|
| Gemini 2.5 Flash | ~200원 |
| Gemini 3 Flash | ~1,750원 |
| Gemini 3 Pro | ~7,000원 |

---

## 13. 향후 확장 계획

1. **검사결과책 PDF 생성**
   - 기간별 검사 종합
   - AI 종합 소견
   - 인쇄용 레이아웃

2. **추이 분석 그래프**
   - 동일 검사 시계열 비교
   - 수치 변화 시각화

3. **진료 모듈 연동**
   - PatientDetail에 검사결과 탭 추가
   - 초진/경과 기록에서 검사결과 참조

4. **혈액검사 연동** (보류)
   - 기기 연동 프로그램과 통합 검토

---

## 변경 이력

| 날짜 | 버전 | 내용 |
|------|------|------|
| 2024-12-25 | 0.1 | 최초 작성 |
