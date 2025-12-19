-- ==============================================
-- 직원관리 시스템 SQLite 스키마
-- ==============================================

-- 1. 직원 기본 정보 테이블
CREATE TABLE IF NOT EXISTS staff (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_type TEXT NOT NULL CHECK(employee_type IN ('doctor', 'staff')),  -- 원장/직원
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    position TEXT,              -- 직책: 원장, 대표원장, 실장, 데스크 등
    hire_date TEXT,             -- 입사일
    resign_date TEXT,           -- 퇴사일
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'resigned', 'leave')),
    profile_color TEXT DEFAULT '#3B82F6',  -- 캘린더 표시 색상
    memo TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- 2. 근무 패턴 테이블 (원장용 - 기간별 근무 패턴)
CREATE TABLE IF NOT EXISTS work_patterns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    staff_id INTEGER NOT NULL,
    pattern_name TEXT,          -- 패턴명: "정규 근무", "오전 근무" 등
    start_date TEXT NOT NULL,   -- 적용 시작일
    end_date TEXT,              -- 적용 종료일 (NULL이면 현재까지)

    -- 요일별 근무 시간 (NULL이면 휴무)
    mon_start TEXT,
    mon_end TEXT,
    tue_start TEXT,
    tue_end TEXT,
    wed_start TEXT,
    wed_end TEXT,
    thu_start TEXT,
    thu_end TEXT,
    fri_start TEXT,
    fri_end TEXT,
    sat_start TEXT,
    sat_end TEXT,
    sun_start TEXT,
    sun_end TEXT,

    memo TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE
);

-- 3. 근무 일정 테이블 (직원용 - 일별 스케줄)
CREATE TABLE IF NOT EXISTS work_schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    staff_id INTEGER NOT NULL,
    work_date TEXT NOT NULL,
    shift_type TEXT NOT NULL CHECK(shift_type IN ('full', 'am', 'pm', 'off', 'half_am', 'half_pm')),
    -- full: 풀타임, am: 오전, pm: 오후, off: 휴무, half_am: 오전반차, half_pm: 오후반차
    start_time TEXT,            -- 실제 시작 시간 (옵션)
    end_time TEXT,              -- 실제 종료 시간 (옵션)
    memo TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE,
    UNIQUE(staff_id, work_date)
);

-- 4. 급여/면담 타임라인 테이블 (원장용)
CREATE TABLE IF NOT EXISTS salary_interviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    staff_id INTEGER NOT NULL,
    event_type TEXT NOT NULL CHECK(event_type IN ('salary_change', 'interview', 'contract', 'bonus', 'other')),
    event_date TEXT NOT NULL,

    -- 급여 관련 필드
    salary_amount INTEGER,      -- 월급/연봉 금액
    salary_type TEXT,           -- 'monthly', 'yearly'
    previous_amount INTEGER,    -- 이전 금액 (급여 변경 시)

    -- 면담 관련 필드
    interview_type TEXT,        -- 'regular', 'salary', 'evaluation', 'counseling'
    interview_summary TEXT,     -- 면담 내용 요약

    -- 공통 필드
    title TEXT,                 -- 이벤트 제목
    description TEXT,           -- 상세 내용
    attachments TEXT,           -- JSON: 첨부파일 목록

    created_by TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE
);

-- 5. 휴가/휴무 테이블
CREATE TABLE IF NOT EXISTS leave_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    staff_id INTEGER NOT NULL,
    leave_type TEXT NOT NULL CHECK(leave_type IN ('annual', 'sick', 'personal', 'maternity', 'unpaid', 'other')),
    -- annual: 연차, sick: 병가, personal: 경조사, maternity: 출산휴가, unpaid: 무급휴가, other: 기타
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    days_count REAL,            -- 휴가 일수 (반차는 0.5)
    reason TEXT,
    status TEXT DEFAULT 'approved' CHECK(status IN ('pending', 'approved', 'rejected', 'cancelled')),
    approved_by TEXT,
    approved_at TEXT,
    memo TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE
);

-- 6. 근무 패턴 템플릿 테이블 (일괄입력용)
CREATE TABLE IF NOT EXISTS schedule_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_name TEXT NOT NULL,
    description TEXT,

    -- 요일별 기본 근무 타입
    mon_shift TEXT DEFAULT 'full',
    tue_shift TEXT DEFAULT 'full',
    wed_shift TEXT DEFAULT 'full',
    thu_shift TEXT DEFAULT 'full',
    fri_shift TEXT DEFAULT 'full',
    sat_shift TEXT DEFAULT 'off',
    sun_shift TEXT DEFAULT 'off',

    is_default INTEGER DEFAULT 0,  -- 기본 템플릿 여부
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_staff_type ON staff(employee_type);
CREATE INDEX IF NOT EXISTS idx_staff_status ON staff(status);
CREATE INDEX IF NOT EXISTS idx_work_patterns_staff ON work_patterns(staff_id);
CREATE INDEX IF NOT EXISTS idx_work_patterns_date ON work_patterns(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_work_schedules_staff ON work_schedules(staff_id);
CREATE INDEX IF NOT EXISTS idx_work_schedules_date ON work_schedules(work_date);
CREATE INDEX IF NOT EXISTS idx_salary_interviews_staff ON salary_interviews(staff_id);
CREATE INDEX IF NOT EXISTS idx_salary_interviews_date ON salary_interviews(event_date);
CREATE INDEX IF NOT EXISTS idx_leave_records_staff ON leave_records(staff_id);
CREATE INDEX IF NOT EXISTS idx_leave_records_date ON leave_records(start_date, end_date);

-- 기본 템플릿 데이터 삽입
INSERT OR IGNORE INTO schedule_templates (id, template_name, description, mon_shift, tue_shift, wed_shift, thu_shift, fri_shift, sat_shift, sun_shift, is_default)
VALUES
    (1, '정규 근무', '월-금 풀타임, 토일 휴무', 'full', 'full', 'full', 'full', 'full', 'off', 'off', 1),
    (2, '토요 근무', '월-토 풀타임, 일 휴무', 'full', 'full', 'full', 'full', 'full', 'am', 'off', 0),
    (3, '격주 토요', '월-금 풀타임, 격주 토요 오전', 'full', 'full', 'full', 'full', 'full', 'off', 'off', 0);
