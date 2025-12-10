-- Supabase에서 가져온 사용자 추가 (id를 순번으로 변환)
INSERT OR REPLACE INTO portal_users (id, name, login_id, password_hash, role, permissions, is_active) VALUES (2, '데스크1', 'desk1', 'desk1234', 'staff', '["hani_man","inventory"]', 1);
INSERT OR REPLACE INTO portal_users (id, name, login_id, password_hash, role, permissions, is_active) VALUES (3, '데스크2', 'desk2', 'desk1234', 'staff', '["hani_man","inventory"]', 1);
INSERT OR REPLACE INTO portal_users (id, name, login_id, password_hash, role, permissions, is_active) VALUES (4, '데스크3', 'desk3', 'desk1234', 'staff', '["hani_man","inventory"]', 1);
INSERT OR REPLACE INTO portal_users (id, name, login_id, password_hash, role, permissions, is_active) VALUES (5, '치료실1', 'treat1', 'treat1234', 'staff', '["hani_man"]', 1);
INSERT OR REPLACE INTO portal_users (id, name, login_id, password_hash, role, permissions, is_active) VALUES (6, '치료실2', 'treat2', 'treat1234', 'staff', '["hani_man"]', 1);
INSERT OR REPLACE INTO portal_users (id, name, login_id, password_hash, role, permissions, is_active) VALUES (7, '탕전실', 'tang1', 'tang1234', 'staff', '["inventory"]', 1);
