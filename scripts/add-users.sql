-- =====================================================
-- 포털 사용자 데이터 (SQLite)
-- 생성일: 2024-12-22
-- =====================================================

-- 기존 사용자 삭제 (선택사항)
-- DELETE FROM portal_users;

-- 관리자 계정
INSERT OR REPLACE INTO portal_users (id, name, login_id, password_hash, role, permissions, is_active, created_at, updated_at)
VALUES (1, '관리자', 'admin', '7582', 'super_admin', '["manage","chart","inventory","treatment","acting","herbal","funnel","content","reservation","doctor_pad","statistics","db_admin","staff"]', 1, datetime('now'), datetime('now'));

-- 데스크 계정
INSERT OR REPLACE INTO portal_users (id, name, login_id, password_hash, role, permissions, is_active, created_at, updated_at)
VALUES (2, '데스크1', 'desk1', 'desk1234', 'desk', '["manage","chart","reservation","statistics"]', 1, datetime('now'), datetime('now'));

INSERT OR REPLACE INTO portal_users (id, name, login_id, password_hash, role, permissions, is_active, created_at, updated_at)
VALUES (3, '데스크2', 'desk2', 'desk1234', 'desk', '["manage","chart","reservation","statistics"]', 1, datetime('now'), datetime('now'));

INSERT OR REPLACE INTO portal_users (id, name, login_id, password_hash, role, permissions, is_active, created_at, updated_at)
VALUES (4, '데스크3', 'desk3', 'desk1234', 'desk', '["manage","chart","reservation","statistics"]', 1, datetime('now'), datetime('now'));

-- 치료실 계정
INSERT OR REPLACE INTO portal_users (id, name, login_id, password_hash, role, permissions, is_active, created_at, updated_at)
VALUES (5, '치료실1', 'treat1', 'treat1234', 'treatment', '["treatment","acting"]', 1, datetime('now'), datetime('now'));

INSERT OR REPLACE INTO portal_users (id, name, login_id, password_hash, role, permissions, is_active, created_at, updated_at)
VALUES (6, '치료실2', 'treat2', 'treat1234', 'treatment', '["treatment","acting"]', 1, datetime('now'), datetime('now'));

-- 탕전실 계정
INSERT OR REPLACE INTO portal_users (id, name, login_id, password_hash, role, permissions, is_active, created_at, updated_at)
VALUES (7, '탕전실', 'tang1', 'tang1234', 'decoction', '["inventory","herbal"]', 1, datetime('now'), datetime('now'));

-- 의료진 계정 (원장)
INSERT OR REPLACE INTO portal_users (id, name, login_id, password_hash, role, permissions, is_active, created_at, updated_at)
VALUES (8, '김대현', 'doctor1', 'doc1234', 'medical_staff', '["manage","chart","doctor_pad","statistics","acting"]', 1, datetime('now'), datetime('now'));

INSERT OR REPLACE INTO portal_users (id, name, login_id, password_hash, role, permissions, is_active, created_at, updated_at)
VALUES (9, '강희종', 'doctor2', 'doc1234', 'medical_staff', '["manage","chart","doctor_pad","statistics","acting"]', 1, datetime('now'), datetime('now'));

INSERT OR REPLACE INTO portal_users (id, name, login_id, password_hash, role, permissions, is_active, created_at, updated_at)
VALUES (10, '임세열', 'doctor3', 'doc1234', 'medical_staff', '["manage","chart","doctor_pad","statistics","acting"]', 1, datetime('now'), datetime('now'));

INSERT OR REPLACE INTO portal_users (id, name, login_id, password_hash, role, permissions, is_active, created_at, updated_at)
VALUES (11, '전인태', 'doctor4', 'doc1234', 'medical_staff', '["manage","chart","doctor_pad","statistics","acting"]', 1, datetime('now'), datetime('now'));

-- 상담실 계정
INSERT OR REPLACE INTO portal_users (id, name, login_id, password_hash, role, permissions, is_active, created_at, updated_at)
VALUES (12, '상담실1', 'counsel1', 'counsel1234', 'counseling', '["manage","chart","funnel","herbal"]', 1, datetime('now'), datetime('now'));
