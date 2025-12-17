# Claude Context - 연이재한의원 프로젝트

> 이 파일은 Claude Code 세션 간 작업 연속성을 위한 컨텍스트 파일입니다.
> 새 세션 시작 시 이 파일을 읽어주세요.

## 프로젝트 구조

이 프로젝트는 **두 개의 연관된 저장소**로 구성됩니다:

```
C:\Users\crimm\Documents\project\
├── haniwon/          # 프론트엔드 (React + Vite + TypeScript)
└── unified-server/   # 백엔드 API 서버 (Python Flask)
```

## 서버 아키텍처

| 서버 | 포트 | 역할 | 위치 |
|------|------|------|------|
| unified-server (Static) | 11111 | 정적 파일 서빙 | 192.168.0.173 |
| unified-server (MSSQL API) | 3100 | 오케이차트 MSSQL 프록시 | 192.168.0.173 |
| unified-server (SQLite API) | 3200 | haniwon 앱 데이터 저장 | 192.168.0.173 |
| Vite Dev Server | 5173 | 개발 서버 (로컬) | localhost |

## 데이터베이스

### 1. MSSQL (오케이차트 - 읽기 전용)
- **서버**: 192.168.0.173:55555
- **DB**: MasterDB
- **용도**: 환자정보(Customer), 진료기록(Detail), 결제(Receipt), 예약(Reservation) 등
- **접근**: unified-server `/api/execute` 엔드포인트 통해 SQL 실행

### 2. SQLite (haniwon 앱 데이터)
- **API**: http://192.168.0.173:3200
- **용도**: 블로그, 콘텐츠, 복약관리, 퍼널 등 haniwon 자체 데이터
- **접근**: `@shared/lib/sqlite.ts`의 query/execute 함수 사용

### 3. Supabase (사용 안 함)
- 현재 프로젝트에서 Supabase는 사용하지 않습니다.
- `src/lib/supabase.ts` 파일이 있지만 레거시 코드입니다.

## 주요 모듈

| 모듈 | 경로 | 설명 |
|------|------|------|
| manage | `/manage/*` | 접수/수납 관리 |
| chart | `/chart/*` | 차트 관리 |
| herbal | `/herbal/*` | 복약관리 (한약) |
| reservation | `/reservation/*` | 예약 관리 |
| doctor-pad | `/doctor-pad/*` | 원장용 진료패드 |
| statistics | `/statistics/*` | 통계 대시보드 |
| content | `/content/*` | 블로그/가이드/랜딩페이지 |
| funnel | `/funnel/*` | 마케팅 퍼널 |

## 복약관리 모듈 (herbal) 상세

### 기능
- 고액 비급여 결제(≥200,000원) 자동 감지 → 가상과제로 표시
- 한약 종류: 탕약(tang), 공진단(hwan), 경옥고(go)
- 콜 스케줄: 복약콜(시작+2일), 내원콜(종료-3일)
- 이벤트 혜택 관리 (공진단/경옥고)

### 데이터 흐름
```
MSSQL (Receipt) → unified-server /api/execute → 프론트엔드 가상과제 표시
                                                      ↓
                                              복약관리 설정 모달
                                                      ↓
SQLite (herbal_purchases, herbal_calls) ← 저장
```

### 관련 파일
- `src/modules/herbal/api/herbalApi.ts` - API 함수들
- `src/modules/herbal/types.ts` - 타입 정의
- `database/phase6_herbal_management_sqlite.sql` - SQLite 스키마

## API 사용 패턴

### MSSQL 쿼리 실행
```typescript
// unified-server의 /api/execute 사용
const response = await fetch('http://192.168.0.173:3100/api/execute', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ sql: 'SELECT * FROM Customer WHERE ...' })
});
const { columns, rows } = await response.json();
```

### SQLite 쿼리 실행
```typescript
import { query, execute } from '@shared/lib/sqlite';

// 조회
const data = await query<MyType>('SELECT * FROM my_table');

// 실행
await execute('INSERT INTO my_table (col) VALUES (...)');
```

## 개발 환경

```bash
# haniwon 개발 서버 실행
cd C:\Users\crimm\Documents\project\haniwon
npm run dev

# unified-server는 192.168.0.173에서 항상 실행 중
# (별도 실행 필요 없음)
```

## 자주 사용하는 명령어

```bash
# 타입 체크
npx tsc --noEmit --skipLibCheck

# MSSQL 테스트 쿼리
curl -X POST "http://192.168.0.173:3100/api/execute" \
  -H "Content-Type: application/json" \
  -d '{"sql": "SELECT TOP 10 * FROM Customer"}'

# SQLite 테스트 쿼리
curl -X POST "http://192.168.0.173:3200/api/query" \
  -H "Content-Type: application/json" \
  -d '{"sql": "SELECT * FROM herbal_purchases LIMIT 10"}'
```

## 주의사항

1. **MSSQL은 읽기 전용**: 오케이차트 데이터는 조회만 가능
2. **SQLite 테이블 생성**: unified-server API로 CREATE TABLE 실행
3. **인증**: Portal 로그인 후 각 모듈 접근 가능 (PortalUser)
4. **CORS**: unified-server에서 모든 origin 허용 설정됨

---
*마지막 업데이트: 2025-12-17*
