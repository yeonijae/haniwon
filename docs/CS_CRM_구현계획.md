# CS/CRM 통합 구현 계획

> 작성일: 2026-01-24
> 상태: Phase 4 완료

---

## 목표

1. **환자 통합 대시보드**: 전화 응대 시 환자의 모든 정보를 한 화면에서 조회/관리
2. **아웃바운드 콜 센터**: 조건별 대상자 리스트업 및 콜/메시지 관리

---

## 현재 문제점

- MSSQL(EMR)과 PostgreSQL(haniwon 앱) 데이터가 분리됨
- 복잡한 조건 쿼리(콜 대상자 리스트업) 어려움
- CRM, 문의, 비급여관리 기능이 중복/분산됨

---

## 의존성 구조

```
Phase 0: 기반 인프라
    └── 환자 테이블 + MSSQL 동기화
            ↓
Phase 1: 데이터 구조
    └── 응대기록 테이블, 콜 큐 테이블
            ↓
Phase 2: 환자 통합 대시보드
    └── 조회 + 입력 + 빠른 예약
            ↓
Phase 3: 아웃바운드 콜 센터
    └── 조건별 리스트업 + 콜 관리
            ↓
Phase 4: 메시지 발송 (후순위)
    └── SMS/카카오 연동
```

---

## Phase 0: 기반 인프라

### 0-1. 환자 테이블 (기존 테이블 확장)

**위치**: Local PostgreSQL (192.168.0.173:3200)

기존 `patients` 테이블에 추가된 컬럼:
- `address TEXT` - 주소
- `first_visit_date TEXT` - 초진일
- `last_visit_date TEXT` - 최근 내원일
- `total_visits INTEGER DEFAULT 0` - 총 방문 횟수
- `synced_at TEXT` - 마지막 동기화 시각

추가된 인덱스:
- `idx_patients_mssql_id` - UNIQUE (mssql_id)
- `idx_patients_chart_number` - UNIQUE (chart_number)

### 0-2. 동기화 함수 (구현 완료)

**파일**: `src/modules/cs/lib/patientSync.ts`

**unified-server REST API 사용**:
- `GET /api/patients/search?q=검색어` - 환자 검색 (MSSQL 3100 포트)
- `GET /api/patients/:id` - 환자 상세 조회

```typescript
// MSSQL에서 환자 조회 (unified-server API 사용)
searchPatientsFromMssql(searchTerm: string, limit?: number): Promise<MssqlPatient[]>
fetchPatientFromMssql(mssqlId: number): Promise<MssqlPatient | null>

// 로컬 PostgreSQL 조회
getLocalPatientByMssqlId(mssqlId: number): Promise<LocalPatient | null>
getLocalPatientByChartNo(chartNo: string): Promise<LocalPatient | null>

// 동기화 (MSSQL → PostgreSQL upsert)
syncPatient(mssqlPatient: MssqlPatient): Promise<LocalPatient | null>
syncPatientById(mssqlId: number): Promise<LocalPatient | null>
syncPatientByChartNo(chartNo: string): Promise<LocalPatient | null>

// 검색 + 동기화 (UI용)
searchAndSyncPatients(searchTerm: string): Promise<LocalPatient[]>

// MSSQL만 검색 (동기화 없음)
searchPatientsOnly(searchTerm: string): Promise<MssqlPatient[]>
```

**동기화 전략**: 실시간 동기화
- 환자 검색 시 unified-server API로 MSSQL 조회 → PostgreSQL에 upsert
- 배치 동기화 필요시 unified-server에 별도 엔드포인트 추가 필요

### 0-3. 체크리스트

- [x] patients 테이블 확인 및 확장 (기존 테이블에 address, first_visit_date, last_visit_date, total_visits, synced_at 컬럼 추가)
- [x] 중복 데이터 정리 및 UNIQUE 인덱스 추가 (mssql_id, chart_number)
- [x] syncPatient 함수 구현 (`src/modules/cs/lib/patientSync.ts`)
- [x] syncRecentPatients 함수 구현 (배치용)
- [x] searchAndSyncPatients 함수 구현 (실시간 검색+동기화)
- [x] PatientSearchView.tsx를 새 동기화 모듈 사용하도록 수정

### 0-4. MSSQL 컬럼 매핑 (Customer 테이블)

| MSSQL (Customer) | PostgreSQL (patients) |
|-----------------|----------------------|
| Customer_PK | mssql_id |
| sn | chart_number |
| name | name |
| cell/tel | phone |
| birth | birth_date |
| sex (0=여, 1=남) | gender |
| address | address |
| reg_date | first_visit_date |
| recent | last_visit_date |

---

## Phase 1: 데이터 구조

### 1-1. 응대기록 테이블

**파일**: `supabase/migrations/YYYYMMDD_create_contact_logs.sql`

```sql
CREATE TABLE patient_contact_logs (
  id SERIAL PRIMARY KEY,
  patient_id INT REFERENCES patients(id),

  -- 방향 & 채널
  direction VARCHAR(10) NOT NULL,  -- 'inbound' | 'outbound'
  channel VARCHAR(10) NOT NULL,     -- 'phone' | 'kakao' | 'sms' | 'visit' | 'naver'

  -- 유형
  contact_type VARCHAR(20) NOT NULL,
  -- inbound: 'inquiry' | 'reservation' | 'complaint' | 'other'
  -- outbound: 'delivery_call' | 'visit_call' | 'after_call' | 'marketing' | 'follow_up'

  -- 내용
  content TEXT,
  result TEXT,           -- 통화 결과

  -- 연관 데이터
  related_type VARCHAR(20),  -- 'herbal_package' | 'reservation' | 'treatment_package'
  related_id INT,

  -- 메타
  created_by VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_contact_logs_patient ON patient_contact_logs(patient_id);
CREATE INDEX idx_contact_logs_date ON patient_contact_logs(created_at DESC);
CREATE INDEX idx_contact_logs_type ON patient_contact_logs(contact_type);
```

### 1-2. 콜 큐 테이블

**파일**: `supabase/migrations/YYYYMMDD_create_call_queue.sql`

```sql
CREATE TABLE outbound_call_queue (
  id SERIAL PRIMARY KEY,
  patient_id INT REFERENCES patients(id),

  -- 콜 유형
  call_type VARCHAR(20) NOT NULL,
  -- 'delivery_call' | 'visit_call' | 'after_call' | 'unconsumed' | 'vip_care' | 'churn_risk'

  -- 연관 데이터
  related_type VARCHAR(20),
  related_id INT,

  -- 일정
  due_date DATE NOT NULL,
  priority INT DEFAULT 0,

  -- 상태
  status VARCHAR(20) DEFAULT 'pending',
  -- 'pending' | 'completed' | 'postponed' | 'cancelled' | 'no_answer'

  postponed_to DATE,
  completed_at TIMESTAMP,
  contact_log_id INT REFERENCES patient_contact_logs(id),

  -- 메타
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_call_queue_due ON outbound_call_queue(due_date, status);
CREATE INDEX idx_call_queue_type ON outbound_call_queue(call_type, status);
```

### 1-3. 콜 조건 설정 테이블

```sql
CREATE TABLE call_condition_settings (
  id SERIAL PRIMARY KEY,
  call_type VARCHAR(20) UNIQUE NOT NULL,
  label VARCHAR(50) NOT NULL,
  description TEXT,
  condition_params JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 기본 데이터
INSERT INTO call_condition_settings (call_type, label, condition_params) VALUES
  ('delivery_call', '배송콜', '{"days_after_delivery": 3}'),
  ('visit_call', '내원콜', '{"days_remaining": 3}'),
  ('after_call', '애프터콜', '{"days_after_complete": 7}'),
  ('unconsumed', '미복용', '{"months_since_purchase": 2}'),
  ('vip_care', 'VIP관리', '{"product_types": ["공진단", "녹용경옥고", "녹용쌍패탕"]}'),
  ('churn_risk_1', '이탈위험(1회)', '{"max_visits": 1, "days_since_last": 14}'),
  ('churn_risk_3', '재방문유도', '{"max_visits": 3, "days_since_last": 30}');
```

### 1-4. 체크리스트

- [x] patient_contact_logs 테이블 생성
- [x] outbound_call_queue 테이블 생성
- [x] call_condition_settings 테이블 생성 + 기본 데이터 삽입
- [x] 인덱스 생성 (patient_id, created_at, contact_type, due_date, status 등)
- [x] 타입 정의 (`src/modules/cs/types/crm.ts`에 추가)
- [x] API 함수 구현
  - `src/modules/cs/lib/contactLogApi.ts` - 응대 기록 CRUD
  - `src/modules/cs/lib/callQueueApi.ts` - 콜 큐 CRUD + 통계

---

## Phase 2: 환자 통합 대시보드

### 2-1. 컴포넌트 구조

```
PatientDashboardModal.tsx (팝업)
├── 헤더: 환자 기본정보 + [예약하기] 버튼
├── PatientVisitHistory.tsx      -- 진료/수납 이력 (MSSQL)
├── PatientReservationHistory.tsx -- 예약 이력
├── PatientPackageStatus.tsx     -- 보유 패키지
├── PatientHerbalHistory.tsx     -- 한약 수령 이력
├── PatientContactLogs.tsx       -- 응대 기록
│   └── ContactLogForm.tsx       -- 기록 입력 폼
└── QuickActions.tsx             -- 빠른 예약, 메모 추가
```

### 2-2. 표시 정보

| 섹션 | 데이터 소스 | 내용 |
|------|------------|------|
| 기본정보 | patients | 이름, 차트번호, 연락처, 나이, 성별 |
| 진료/수납 | MSSQL | 최근 진료 목록, 수납 내역 |
| 예약 | reservations | 다음 예약, 예약 이력 |
| 패키지 | herbal_packages, treatment_packages 등 | 잔여 수량/금액 |
| 한약 수령 | herbal_pickups | 수령 이력, 배송 상태 |
| 응대 기록 | patient_contact_logs | 시간순 기록 |

### 2-3. 구현 순서

| 순서 | 작업 | 파일 |
|------|------|------|
| 2-1-1 | 환자 검색 + 동기화 API | `lib/patientApi.ts` |
| 2-1-2 | 대시보드 모달 레이아웃 | `PatientDashboardModal.tsx` |
| 2-2-1 | 진료/수납 이력 컴포넌트 | `PatientVisitHistory.tsx` |
| 2-2-2 | 예약 이력 컴포넌트 | `PatientReservationHistory.tsx` |
| 2-2-3 | 패키지 현황 컴포넌트 | `PatientPackageStatus.tsx` |
| 2-2-4 | 한약 수령 이력 컴포넌트 | `PatientHerbalHistory.tsx` |
| 2-3-1 | 응대기록 조회 컴포넌트 | `PatientContactLogs.tsx` |
| 2-3-2 | 응대기록 입력 폼 | `ContactLogForm.tsx` |
| 2-4-1 | 빠른 예약 연동 | 기존 QuickReservationModal 활용 |
| 2-5-1 | CSApp에 진입점 추가 | 검색창 또는 단축키 |

### 2-4. 구현 완료 파일

**`src/modules/cs/components/patient-dashboard/`**:
- `PatientDashboardModal.tsx` - 메인 모달 (탭: 종합현황, 진료이력, 응대기록, 패키지)
- `PatientInfoHeader.tsx` - 환자 기본정보 헤더 (이름, 차트번호, 성별, 나이, 연락처, 메타정보)
- `PatientVisitHistory.tsx` - 진료/수납 이력 (MSSQL Receipt 테이블 조회)
- `PatientContactHistory.tsx` - 응대 기록 표시 컴포넌트
- `ContactLogForm.tsx` - 응대 기록 입력 폼
- `PatientDashboardModal.css` - 스타일
- `index.ts` - export

**통합**:
- `PatientSearchView.tsx`에 "통합정보" 버튼 추가 → PatientDashboardModal 연동

### 2-5. 체크리스트

- [x] 환자 검색 API (patientSync.ts 활용)
- [x] 대시보드 모달 레이아웃 (PatientDashboardModal.tsx)
- [x] 진료/수납 이력 컴포넌트 (PatientVisitHistory.tsx)
- [x] 응대기록 조회/입력 (PatientContactHistory.tsx, ContactLogForm.tsx)
- [x] CSApp 통합 (PatientSearchView.tsx에서 모달 열기)
- [ ] 예약 이력 컴포넌트 (PatientReservationHistory.tsx) - 추후 필요시
- [ ] 패키지 현황 컴포넌트 (PatientPackageStatus.tsx) - 추후 필요시
- [ ] 한약 수령 이력 컴포넌트 (PatientHerbalHistory.tsx) - 추후 필요시
- [ ] 빠른 예약 연동 - 추후 필요시

---

## Phase 3: 아웃바운드 콜 센터

### 3-1. 콜 유형별 조건 쿼리

| 유형 | 조건 | 쿼리 로직 |
|------|------|----------|
| 배송콜 | 배송 후 3일 | herbal_pickups.delivery_date = TODAY - 3 |
| 내원콜 | 한약 3일치 남음 | 복용 스케줄 기반 계산 |
| 애프터콜 | 복용 완료 후 7일 | 마지막 복용일 + 7 |
| 미복용 | 선결제 후 2개월+ | herbal_packages.created_at < TODAY - 60, used < total |
| VIP관리 | 공진단/녹용 구매 | 특정 패키지 보유자 |
| 이탈위험(1회) | 침 1회만 | total_visits = 1, last_visit < TODAY - 14 |
| 재방문유도 | 침 3회 미만 | total_visits < 3, last_visit < TODAY - 30 |

### 3-2. 컴포넌트 구조

```
OutboundCallCenter.tsx (페이지 또는 탭)
├── CallTypeFilter.tsx          -- 콜 유형 필터
├── CallTargetList.tsx          -- 대상자 목록
│   ├── 체크박스 (일괄 선택)
│   ├── 환자 정보 + 사유
│   ├── 상태 배지
│   └── 액션 버튼 (콜완료, 미루기, 취소)
├── BulkActions.tsx             -- 일괄 메시지 발송
└── (연동) PatientDashboardModal
```

### 3-3. 구현 순서

| 순서 | 작업 |
|------|------|
| 3-1-1 | 조건별 쿼리 함수 작성 |
| 3-1-2 | 쿼리 테스트 및 성능 최적화 |
| 3-2-1 | 콜 센터 페이지 레이아웃 |
| 3-2-2 | 콜 유형 필터 컴포넌트 |
| 3-2-3 | 대상자 목록 컴포넌트 |
| 3-2-4 | 콜 완료 처리 (contact_logs 연동) |
| 3-2-5 | 미루기 기능 |
| 3-2-6 | 환자 대시보드 연동 |
| 3-3-1 | CSApp 메뉴에 추가 |

### 3-4. 구현 완료 파일

**`src/modules/cs/lib/callQueueApi.ts`** (확장):
- `getDeliveryCallTargets()` - 배송콜 대상자 조회
- `getChurnRisk1Targets()` - 이탈위험(1회) 대상자 조회
- `getChurnRisk3Targets()` - 재방문유도 대상자 조회
- `getUnconsumedTargets()` - 미복용 대상자 조회
- `getVipCareTargets()` - VIP관리 대상자 조회
- `getAllCallTargets()` - 전체 콜 대상자 통합 조회
- `addTargetToQueue()` - 대상자를 콜 큐에 등록

**`src/modules/cs/components/call-center/`**:
- `OutboundCallCenter.tsx` - 메인 콜 센터 컴포넌트
- `CallTargetList.tsx` - 대상자 목록 컴포넌트
- `CallResultModal.tsx` - 콜 결과 입력 모달
- `OutboundCallCenter.css` - 스타일
- `index.ts` - export

**통합**:
- `CRMView.tsx`에 모드 탭 추가 (아웃바운드 콜센터 / 환자별 관리)

### 3-5. 체크리스트

- [x] 조건별 쿼리 함수 (배송콜, 이탈위험, 재방문유도, 미복용, VIP)
- [x] 콜 센터 레이아웃 (OutboundCallCenter.tsx)
- [x] 필터 컴포넌트 (유형별 필터 버튼)
- [x] 대상자 목록 (CallTargetList.tsx)
- [x] 콜 완료/미루기/부재중 처리
- [x] 환자 대시보드 연동 (PatientDashboardModal)
- [x] CRMView 통합 (모드 탭)
- [ ] 내원콜 조건 쿼리 (복용 스케줄 기반) - 추후 필요시
- [ ] 애프터콜 조건 쿼리 (복용 완료 후 7일) - 추후 필요시

---

## Phase 4: 메시지 발송

### 4-1. 외부 서비스 연동

| 서비스 | 용도 | 비고 |
|--------|------|------|
| SMS API | 문자 발송 | 알리고, 비즈뿌리오 등 |
| 카카오 알림톡 | 카카오 메시지 | 비즈니스 채널 필요 |

### 4-2. 테이블

```sql
CREATE TABLE message_templates (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  channel VARCHAR(10) NOT NULL,  -- 'sms' | 'kakao'
  category VARCHAR(50),
  content TEXT NOT NULL,
  variables JSONB DEFAULT '[]',  -- ['name', 'date'] 등
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE message_logs (
  id SERIAL PRIMARY KEY,
  patient_id INT REFERENCES patients(id),
  template_id INT REFERENCES message_templates(id),
  channel VARCHAR(10) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  content TEXT NOT NULL,
  variables_used JSONB,
  status VARCHAR(20) DEFAULT 'pending',  -- 'pending' | 'sent' | 'delivered' | 'failed'
  error_message TEXT,
  external_id VARCHAR(100),  -- 외부 API 응답 ID
  sent_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  created_by VARCHAR(50)
);
```

### 4-3. 기본 템플릿

| 템플릿명 | 채널 | 분류 | 내용 |
|----------|------|------|------|
| 예약 확인 | SMS | 예약 | [한의원] {{name}}님, {{date}} {{time}} 예약이 확정되었습니다. |
| 예약 리마인더 | SMS | 예약 | [한의원] {{name}}님, 내일 {{time}} 예약이 있습니다. |
| 한약 배송 안내 | SMS | 배송 | [한의원] {{name}}님, 한약이 발송되었습니다. 택배번호: {{tracking}} |
| 내원 안내 | SMS | 안내 | [한의원] {{name}}님, 한약이 {{remaining}}일치 남았습니다. 내원 예약 부탁드립니다. |
| 재방문 안내 | 카카오 | 안내 | 안녕하세요 {{name}}님, 지난번 치료 경과가 궁금합니다. 편하실 때 방문해주세요. |

### 4-4. 구현 완료 파일

**`src/modules/cs/types/crm.ts`** (확장):
- `MessageChannel` - 'sms' | 'kakao'
- `MessageStatus` - 'pending' | 'sent' | 'delivered' | 'failed'
- `MessageTemplate` - 템플릿 인터페이스
- `MessageLog` - 발송 기록 인터페이스
- `SendMessageRequest` - 발송 요청 인터페이스
- `MessageStats` - 발송 통계 인터페이스

**`src/modules/cs/lib/messageApi.ts`**:
- `getMessageTemplates()` - 템플릿 목록 조회
- `getTemplatesByChannel()` - 채널별 템플릿 조회
- `createTemplate()` - 템플릿 생성
- `updateTemplate()` - 템플릿 수정
- `deleteTemplate()` - 템플릿 삭제
- `replaceTemplateVariables()` - 변수 치환
- `sendMessage()` - 메시지 발송 (로그 저장)
- `sendBulkMessages()` - 일괄 발송
- `getMessageLogs()` - 발송 이력 조회
- `getMessageStats()` - 발송 통계

**`src/modules/cs/components/messaging/`**:
- `MessageSendModal.tsx` - 메시지 발송 모달 (템플릿 선택, 변수 입력, 미리보기)
- `MessageSendModal.css` - 스타일
- `MessageTemplateManager.tsx` - 템플릿 관리 컴포넌트 (CRUD)
- `MessageTemplateManager.css` - 스타일
- `index.ts` - export

**통합**:
- `OutboundCallCenter.tsx`에 메시지 발송 버튼 추가 (큐 아이템, 대상자)
- `CallTargetList.tsx`에 문자 발송 버튼 추가

### 4-5. 체크리스트

- [x] 템플릿 테이블 생성 (message_templates)
- [x] 발송 이력 테이블 생성 (message_logs)
- [x] 기본 템플릿 5개 등록
- [x] 타입 정의 (MessageChannel, MessageTemplate, MessageLog 등)
- [x] API 함수 구현 (messageApi.ts)
- [x] 템플릿 관리 UI (MessageTemplateManager.tsx)
- [x] 메시지 발송 모달 (MessageSendModal.tsx)
- [x] 콜 센터 연동 (큐 아이템/대상자 → 문자 발송)
- [ ] SMS 외부 API 연동 (알리고 등) - 추후 연동 필요
- [ ] 카카오 알림톡 API 연동 - 추후 연동 필요

---

## 파일 구조 (실제)

```
src/modules/cs/
├── components/
│   ├── patient-dashboard/
│   │   ├── PatientDashboardModal.tsx
│   │   ├── PatientDashboardModal.css
│   │   ├── PatientInfoHeader.tsx
│   │   ├── PatientVisitHistory.tsx
│   │   ├── PatientContactHistory.tsx
│   │   ├── ContactLogForm.tsx
│   │   └── index.ts
│   ├── call-center/
│   │   ├── OutboundCallCenter.tsx
│   │   ├── OutboundCallCenter.css
│   │   ├── CallTargetList.tsx
│   │   ├── CallResultModal.tsx
│   │   └── index.ts
│   ├── messaging/
│   │   ├── MessageSendModal.tsx
│   │   ├── MessageSendModal.css
│   │   ├── MessageTemplateManager.tsx
│   │   ├── MessageTemplateManager.css
│   │   └── index.ts
│   └── ... (기존 컴포넌트)
├── lib/
│   ├── patientSync.ts      -- 환자 동기화
│   ├── contactLogApi.ts    -- 응대기록 API
│   ├── callQueueApi.ts     -- 콜 큐/대상자 API
│   └── messageApi.ts       -- 메시지 발송 API
├── types/
│   └── crm.ts              -- CRM 관련 타입 통합
└── views/
    ├── CRMView.tsx         -- CRM 메인 (콜센터/환자관리 탭)
    └── PatientSearchView.tsx
```

---

## 진행 상태

| Phase | 상태 | 시작일 | 완료일 |
|-------|------|--------|--------|
| Phase 0 | ✅ 완료 | 2026-01-24 | 2026-01-24 |
| Phase 1 | ✅ 완료 | 2026-01-24 | 2026-01-24 |
| Phase 2 | ✅ 완료 | 2026-01-24 | 2026-01-24 |
| Phase 3 | ✅ 완료 | 2026-01-24 | 2026-01-24 |
| Phase 4 | ✅ 완료 | 2026-01-24 | 2026-01-24 |

---

## 참고 사항

- 기존 CRM, 문의, 비급여관리 탭은 새 기능 완성 후 통합/제거 검토
- 환자 동기화는 하이브리드 방식 (실시간 + 배치)
- 콜 대상자는 실시간 쿼리 (배치 생성 X)
