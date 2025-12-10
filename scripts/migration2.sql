-- Supabase → SQLite 마이그레이션 SQL
-- 생성일: 2025-12-10T01:11:38.269Z

-- ============================================
-- portal_users (7개 행)
-- ============================================
INSERT OR REPLACE INTO portal_users (id, name, login_id, password_hash, role, permissions, is_active, created_at, updated_at) VALUES ('2de72963-502f-4969-ab9b-4209dc6d80d0', '데스크1', 'migrated_user', '$2b$10$placeholder_hash_for_migration', 'staff', '["hani_man","inventory"]', NULL, '2025-11-25T16:48:54.093433+00:00', '2025-11-25T16:48:54.093433+00:00');
INSERT OR REPLACE INTO portal_users (id, name, login_id, password_hash, role, permissions, is_active, created_at, updated_at) VALUES ('f6cdf636-f654-4c0d-bae2-12573652a786', '데스크2', 'migrated_user', '$2b$10$placeholder_hash_for_migration', 'staff', '["hani_man","inventory"]', NULL, '2025-11-25T16:48:54.093433+00:00', '2025-11-25T16:48:54.093433+00:00');
INSERT OR REPLACE INTO portal_users (id, name, login_id, password_hash, role, permissions, is_active, created_at, updated_at) VALUES ('1058454b-7e4d-4887-b0d1-ca8ba9356a07', '데스크3', 'migrated_user', '$2b$10$placeholder_hash_for_migration', 'staff', '["hani_man","inventory"]', NULL, '2025-11-25T16:48:54.093433+00:00', '2025-11-25T16:48:54.093433+00:00');
INSERT OR REPLACE INTO portal_users (id, name, login_id, password_hash, role, permissions, is_active, created_at, updated_at) VALUES ('69750b3d-3eb6-4ef6-9df7-b230548dab4d', '치료실1', 'migrated_user', '$2b$10$placeholder_hash_for_migration', 'staff', '["hani_man"]', NULL, '2025-11-25T16:48:54.093433+00:00', '2025-11-25T16:48:54.093433+00:00');
INSERT OR REPLACE INTO portal_users (id, name, login_id, password_hash, role, permissions, is_active, created_at, updated_at) VALUES ('8b9a2c2e-a531-4743-b2e9-fc4702a6f694', '치료실2', 'migrated_user', '$2b$10$placeholder_hash_for_migration', 'staff', '["hani_man"]', NULL, '2025-11-25T16:48:54.093433+00:00', '2025-11-25T16:48:54.093433+00:00');
INSERT OR REPLACE INTO portal_users (id, name, login_id, password_hash, role, permissions, is_active, created_at, updated_at) VALUES ('c7b7a758-6574-4a1f-82b3-1b0503e2a9fe', '탕전실', 'migrated_user', '$2b$10$placeholder_hash_for_migration', 'staff', '["inventory"]', NULL, '2025-11-25T16:48:54.093433+00:00', '2025-11-25T16:48:54.093433+00:00');
INSERT OR REPLACE INTO portal_users (id, name, login_id, password_hash, role, permissions, is_active, created_at, updated_at) VALUES ('7b715cd8-0762-49ec-9b96-8250d1790ff5', '관리자', 'migrated_user', '$2b$10$placeholder_hash_for_migration', 'super_admin', '["hani_man","patient_chart","inventory"]', NULL, '2025-11-25T16:48:54.093433+00:00', '2025-11-25T16:48:54.093433+00:00');

-- ============================================
-- acting_types (10개 행)
-- ============================================
INSERT OR REPLACE INTO acting_types (id, name, category, standard_min, slot_usage, display_order, is_active, created_at) VALUES (1, '침', 'basic', 5, 1, 1, 1, '2025-12-08T16:01:31.12324+00:00');
INSERT OR REPLACE INTO acting_types (id, name, category, standard_min, slot_usage, display_order, is_active, created_at) VALUES (2, '추나', 'basic', 8, 1, 2, 1, '2025-12-08T16:01:31.12324+00:00');
INSERT OR REPLACE INTO acting_types (id, name, category, standard_min, slot_usage, display_order, is_active, created_at) VALUES (3, '부항', 'basic', 5, 1, 3, 1, '2025-12-08T16:01:31.12324+00:00');
INSERT OR REPLACE INTO acting_types (id, name, category, standard_min, slot_usage, display_order, is_active, created_at) VALUES (4, '뜸', 'basic', 5, 1, 4, 1, '2025-12-08T16:01:31.12324+00:00');
INSERT OR REPLACE INTO acting_types (id, name, category, standard_min, slot_usage, display_order, is_active, created_at) VALUES (5, '약침', 'basic', 5, 1, 5, 1, '2025-12-08T16:01:31.12324+00:00');
INSERT OR REPLACE INTO acting_types (id, name, category, standard_min, slot_usage, display_order, is_active, created_at) VALUES (6, '초음파', 'basic', 10, 1, 6, 1, '2025-12-08T16:01:31.12324+00:00');
INSERT OR REPLACE INTO acting_types (id, name, category, standard_min, slot_usage, display_order, is_active, created_at) VALUES (7, '상담', 'consult', 15, 2, 7, 1, '2025-12-08T16:01:31.12324+00:00');
INSERT OR REPLACE INTO acting_types (id, name, category, standard_min, slot_usage, display_order, is_active, created_at) VALUES (8, '재초진', 'consult', 10, 2, 8, 1, '2025-12-08T16:01:31.12324+00:00');
INSERT OR REPLACE INTO acting_types (id, name, category, standard_min, slot_usage, display_order, is_active, created_at) VALUES (9, '신규약상담', 'consult', 30, 6, 9, 1, '2025-12-08T16:01:31.12324+00:00');
INSERT OR REPLACE INTO acting_types (id, name, category, standard_min, slot_usage, display_order, is_active, created_at) VALUES (10, '약재진', 'consult', 15, 3, 10, 1, '2025-12-08T16:01:31.12324+00:00');

-- doctor_status: 데이터 없음
-- ============================================
-- treatment_rooms (17개 행)
-- ============================================
INSERT OR REPLACE INTO treatment_rooms (id, name, room_type, display_order, is_active, patient_id, patient_name, in_time, status, created_at, updated_at) VALUES (5, '1-5', NULL, NULL, NULL, NULL, NULL, NULL, '사용가능', '2025-11-13T02:10:31.941996', '2025-11-13T02:10:31.941996');
INSERT OR REPLACE INTO treatment_rooms (id, name, room_type, display_order, is_active, patient_id, patient_name, in_time, status, created_at, updated_at) VALUES (3, '1-3', NULL, NULL, NULL, NULL, NULL, NULL, '사용가능', '2025-11-13T02:10:31.941996', '2025-11-17T07:57:57.432');
INSERT OR REPLACE INTO treatment_rooms (id, name, room_type, display_order, is_active, patient_id, patient_name, in_time, status, created_at, updated_at) VALUES (10, '2-5', NULL, NULL, NULL, NULL, NULL, NULL, '사용가능', '2025-11-13T02:10:31.941996', '2025-11-13T02:10:31.941996');
INSERT OR REPLACE INTO treatment_rooms (id, name, room_type, display_order, is_active, patient_id, patient_name, in_time, status, created_at, updated_at) VALUES (11, '2-6', NULL, NULL, NULL, NULL, NULL, NULL, '사용가능', '2025-11-13T02:10:31.941996', '2025-11-13T02:10:31.941996');
INSERT OR REPLACE INTO treatment_rooms (id, name, room_type, display_order, is_active, patient_id, patient_name, in_time, status, created_at, updated_at) VALUES (12, '2-7', NULL, NULL, NULL, NULL, NULL, NULL, '사용가능', '2025-11-13T02:10:31.941996', '2025-11-13T02:10:31.941996');
INSERT OR REPLACE INTO treatment_rooms (id, name, room_type, display_order, is_active, patient_id, patient_name, in_time, status, created_at, updated_at) VALUES (13, '2-8', NULL, NULL, NULL, NULL, NULL, NULL, '사용가능', '2025-11-13T02:10:31.941996', '2025-11-13T02:10:31.941996');
INSERT OR REPLACE INTO treatment_rooms (id, name, room_type, display_order, is_active, patient_id, patient_name, in_time, status, created_at, updated_at) VALUES (14, '3-1', NULL, NULL, NULL, NULL, NULL, NULL, '사용가능', '2025-11-13T02:10:31.941996', '2025-11-13T02:10:31.941996');
INSERT OR REPLACE INTO treatment_rooms (id, name, room_type, display_order, is_active, patient_id, patient_name, in_time, status, created_at, updated_at) VALUES (15, '3-2', NULL, NULL, NULL, NULL, NULL, NULL, '사용가능', '2025-11-13T02:10:31.941996', '2025-11-13T02:10:31.941996');
INSERT OR REPLACE INTO treatment_rooms (id, name, room_type, display_order, is_active, patient_id, patient_name, in_time, status, created_at, updated_at) VALUES (16, '4-1', NULL, NULL, NULL, NULL, NULL, NULL, '사용가능', '2025-11-13T02:10:31.941996', '2025-11-13T02:10:31.941996');
INSERT OR REPLACE INTO treatment_rooms (id, name, room_type, display_order, is_active, patient_id, patient_name, in_time, status, created_at, updated_at) VALUES (17, '4-2', NULL, NULL, NULL, NULL, NULL, NULL, '사용가능', '2025-11-13T02:10:31.941996', '2025-11-13T02:10:31.941996');
INSERT OR REPLACE INTO treatment_rooms (id, name, room_type, display_order, is_active, patient_id, patient_name, in_time, status, created_at, updated_at) VALUES (2, '1-2', NULL, NULL, NULL, 6736, '이재은', '2025-12-08T16:40:40.325', '사용중', '2025-11-13T02:10:31.941996', '2025-11-25T15:22:52.605');
INSERT OR REPLACE INTO treatment_rooms (id, name, room_type, display_order, is_active, patient_id, patient_name, in_time, status, created_at, updated_at) VALUES (6, '2-1', NULL, NULL, NULL, NULL, NULL, NULL, '사용가능', '2025-11-13T02:10:31.941996', '2025-11-16T12:36:04.697');
INSERT OR REPLACE INTO treatment_rooms (id, name, room_type, display_order, is_active, patient_id, patient_name, in_time, status, created_at, updated_at) VALUES (4, '1-4', NULL, NULL, NULL, NULL, NULL, NULL, '사용가능', '2025-11-13T02:10:31.941996', '2025-11-14T07:53:10.448');
INSERT OR REPLACE INTO treatment_rooms (id, name, room_type, display_order, is_active, patient_id, patient_name, in_time, status, created_at, updated_at) VALUES (8, '2-3', NULL, NULL, NULL, NULL, NULL, NULL, '사용가능', '2025-11-13T02:10:31.941996', '2025-11-13T02:10:31.941996');
INSERT OR REPLACE INTO treatment_rooms (id, name, room_type, display_order, is_active, patient_id, patient_name, in_time, status, created_at, updated_at) VALUES (9, '2-4', NULL, NULL, NULL, NULL, NULL, NULL, '사용가능', '2025-11-13T02:10:31.941996', '2025-11-13T02:10:31.941996');
INSERT OR REPLACE INTO treatment_rooms (id, name, room_type, display_order, is_active, patient_id, patient_name, in_time, status, created_at, updated_at) VALUES (7, '2-2', NULL, NULL, NULL, NULL, NULL, NULL, '사용가능', '2025-11-13T02:10:31.941996', '2025-11-16T13:34:10.759');
INSERT OR REPLACE INTO treatment_rooms (id, name, room_type, display_order, is_active, patient_id, patient_name, in_time, status, created_at, updated_at) VALUES (1, '1-1', NULL, NULL, NULL, NULL, NULL, NULL, '사용가능', '2025-11-13T02:10:31.941996', '2025-11-14T07:16:39.381');

-- ============================================
-- treatment_items (10개 행)
-- ============================================
INSERT OR REPLACE INTO treatment_items (id, name, category, default_duration, display_order, is_active, created_at) VALUES (9, '초음파', NULL, 10, 9, NULL, '2025-11-16T12:21:21.421826+00:00');
INSERT OR REPLACE INTO treatment_items (id, name, category, default_duration, display_order, is_active, created_at) VALUES (4, '핫팩', NULL, 10, 4, NULL, '2025-11-16T12:21:21.421826+00:00');
INSERT OR REPLACE INTO treatment_items (id, name, category, default_duration, display_order, is_active, created_at) VALUES (2, '추나', NULL, 5, 1, NULL, '2025-11-16T12:21:21.421826+00:00');
INSERT OR REPLACE INTO treatment_items (id, name, category, default_duration, display_order, is_active, created_at) VALUES (10, '고주파', NULL, 10, 3, NULL, '2025-11-16T12:21:21.421826+00:00');
INSERT OR REPLACE INTO treatment_items (id, name, category, default_duration, display_order, is_active, created_at) VALUES (1, '침', NULL, 10, 0, NULL, '2025-11-16T12:21:21.421826+00:00');
INSERT OR REPLACE INTO treatment_items (id, name, category, default_duration, display_order, is_active, created_at) VALUES (5, '물치', NULL, 10, 5, NULL, '2025-11-16T12:21:21.421826+00:00');
INSERT OR REPLACE INTO treatment_items (id, name, category, default_duration, display_order, is_active, created_at) VALUES (8, '습부', NULL, 5, 8, NULL, '2025-11-16T12:21:21.421826+00:00');
INSERT OR REPLACE INTO treatment_items (id, name, category, default_duration, display_order, is_active, created_at) VALUES (3, '약침', NULL, 10, 2, NULL, '2025-11-16T12:21:21.421826+00:00');
INSERT OR REPLACE INTO treatment_items (id, name, category, default_duration, display_order, is_active, created_at) VALUES (6, '향기요법', NULL, 5, 6, NULL, '2025-11-16T12:21:21.421826+00:00');
INSERT OR REPLACE INTO treatment_items (id, name, category, default_duration, display_order, is_active, created_at) VALUES (7, '엠티', NULL, 10, 7, NULL, '2025-11-16T12:21:21.421826+00:00');

-- ============================================
-- herbs (151개 행)
-- ============================================
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (554, '과루실', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:42.211998+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (596, '패장', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:47.264637+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (597, '백두옹', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:47.378726+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (598, '선복화', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:47.487641+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (599, '대자석', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:47.601335+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (600, '적석지', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:47.709181+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (601, '활석', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:47.81819+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (602, '갱미', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:47.926068+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (603, '뉴분골', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:48.040808+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (604, '원분골', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:48.16213+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (605, '어혈환', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:48.274674+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (606, '뉴상대', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:48.381618+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (594, '교이', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:47.029507+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (478, '건지황', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:32.723314+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (456, '향부자', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:30.039238+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (457, '화피', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:30.188152+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (458, '지모', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:30.318021+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (459, '자감초', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:30.459263+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (460, '인삼', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:30.583484+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (461, '시호', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:30.697281+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (462, '반하', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:30.805616+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (463, '황금', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:30.91476+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (464, '생강', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:31.036824+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (465, '대추', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:31.152321+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (466, '지실', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:31.269018+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (467, '작약', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:31.390825+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (468, '대황', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:31.52682+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (469, '황련', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:31.6574+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (470, '건강', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:31.78403+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (471, '과루인', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:31.907737+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (472, '갈근', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:32.019828+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (473, '계지', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:32.132734+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (555, '창이자', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:42.336638+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (556, '지각', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:42.460611+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (474, '복령', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:32.247052+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (557, '백자인', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:42.595952+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (475, '저령', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:32.361581+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (476, '택사', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:32.494653+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (477, '백출', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:32.612083+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (558, '육계', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:42.747943+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (559, '구기자', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:42.874819+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (479, '산약', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:32.836435+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (480, '산수유', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:32.957666+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (560, '천마', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:43.010182+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (561, '신곡', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:43.128516+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (562, '조각자', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:43.250505+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (481, '목단피', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:33.085486+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (563, '조구등', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:43.369665+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (564, '금은화', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:43.498134+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (482, '도인', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:33.20034+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (565, '연자육', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:43.690213+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (483, '당귀', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:33.324877+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (566, '천문동', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:43.812699+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (567, '석창포', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:43.924332+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (484, '천궁', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:33.440023+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (485, '방기', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:33.55035+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (568, '나복자', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:44.038606+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (486, '황기', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:33.664096+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (569, '감국', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:44.148398+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (487, '치자', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:33.782016+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (570, '봉출', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:44.266442+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (571, '삼릉', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:44.377658+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (488, '두시', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:33.893532+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (489, '황백', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:34.00531+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (490, '후박', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:34.122235+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (572, '계혈등', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:44.490628+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (491, '마황', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:34.239559+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (573, '현호색', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:44.602133+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (574, '단삼', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:44.716047+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (492, '행인', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:34.356917+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (493, '부자', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:34.469099+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (575, '강활', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:44.832389+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (576, '홍화', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:44.952545+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (577, '독활', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:45.06306+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (494, '감수', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:34.844298+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (495, '생감초', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:34.957968+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (496, '괄루근', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:35.077638+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (497, '귤피', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:35.198386+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (498, '길경', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:35.331779+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (499, '동과자', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:35.459336+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (500, '마자인', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:35.576609+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (501, '맥문동', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:35.701059+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (502, '목통', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:35.825864+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (578, '토사자', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:45.189857+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (503, '부소맥', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:35.947254+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (579, '사상자', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:45.307678+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (580, '육종용', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:45.444771+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (504, '세신', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:36.067875+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (505, '애엽', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:36.198978+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (581, '복분자', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:45.568313+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (506, '오미자', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:36.330892+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (582, '백두구', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:45.685742+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (583, '산사', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:45.794334+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (507, '오수유', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:36.45583+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (508, '의이인', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:36.567962+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (509, '인진호', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:36.679621+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (510, '자소엽', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:36.794537+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (511, '적소두', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:36.90911+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (584, '용담초', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:45.901801+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (512, '죽여', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:37.027041+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (513, '죽엽', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:37.159258+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (514, '해백', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:37.273324+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (515, '방풍', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:37.38831+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (516, '촉초', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:37.505377+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (517, '정력자', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:37.619621+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (585, '길초근', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:46.021199+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (586, '소목', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:46.130628+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (518, '연교', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:37.73463+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (519, '상백피', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:37.849909+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (587, '당귀미', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:46.249328+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (520, '고삼', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:37.971002+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (588, '청피', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:46.358676+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (521, '오매', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:38.082644+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (522, '원지', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:38.196479+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (523, '관동화', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:38.312573+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (524, '측백엽', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:38.428809+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (589, '울금', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:46.469244+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (525, '숙지황', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:38.549977+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (526, '속단', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:38.663476+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (527, '두충', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:38.778258+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (528, '모과', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:38.890051+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (529, '용골', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:39.010136+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (530, '모려', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:39.135422+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (531, '망초', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:39.248153+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (532, '석고', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:39.359214+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (533, '아교주', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:39.468975+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (534, '원상대', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:39.599564+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (535, '맥아', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:39.760114+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (536, '백지', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:39.950438+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (537, '대복피', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:40.076249+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (538, '곽향', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:40.197867+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (539, '승마', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:40.316404+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (540, '진피', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:40.43212+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (541, '목향', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:40.623227+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (542, '자완', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:40.759444+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (543, '용안육', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:40.876835+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (544, '형개', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:41.005079+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (545, '창출', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:41.118072+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (546, '뉴중대', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:41.249322+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (547, '사간', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:41.362759+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (548, '우슬', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:41.479605+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (549, '신이', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:41.613981+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (550, '사인', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:41.737638+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (551, '오약', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:41.84861+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (552, '익지인', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:41.970865+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (553, '차전자', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:42.088458+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (590, '원중대', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:46.580849+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (591, '진교', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:46.692973+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (592, '상기생', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:46.79842+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (593, '적작약', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:46.905853+00:00');
INSERT OR REPLACE INTO herbs (id, name, category, unit, default_amount, price_per_unit, is_active, created_at) VALUES (595, '산조인', NULL, 'g', NULL, NULL, 1, '2025-11-17T14:44:47.139915+00:00');

-- ============================================
-- prescription_definitions (311개 행)
-- ============================================
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (1, '계지탕', NULL, NULL, NULL, 1, '2025-11-18T07:11:33.369+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (2, '계지탕', '계지제', NULL, NULL, 1, '2025-11-22T03:28:00.092+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (3, '계지가계탕', '계지제', NULL, NULL, 1, '2025-11-22T03:28:01.306+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (4, '계지가황기탕', '계지제', NULL, NULL, 1, '2025-11-22T03:28:01.531+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (5, '계지가갈근탕', '계지제', NULL, NULL, 1, '2025-11-22T03:28:01.682+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (6, '계지가후박행자탕', '계지제', NULL, NULL, 1, '2025-11-22T03:28:01.878+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (7, '계지가용골모려탕', '계지제', NULL, NULL, 1, '2025-11-22T03:28:02.009+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (8, '계작지모탕', '계지제', NULL, NULL, 1, '2025-11-22T03:28:02.134+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (9, '계지가작약탕', '계지제', NULL, NULL, 1, '2025-11-22T03:28:02.297+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (10, '계지가대황탕', '계지제', NULL, NULL, 1, '2025-11-22T03:28:02.475+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (11, '소건중탕', '계지제', NULL, NULL, 1, '2025-11-22T03:28:02.635+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (12, '황기건중탕', '계지제', NULL, NULL, 1, '2025-11-22T03:28:02.759+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (13, '당귀건중탕', '계지제', NULL, NULL, 1, '2025-11-22T03:28:02.892+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (14, '계지거작약탕', '계지제', NULL, NULL, 1, '2025-11-22T03:28:03.017+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (15, '자감초탕', '계지제', NULL, NULL, 1, '2025-11-22T03:28:03.148+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (16, '계지가부자탕', '계지제', NULL, NULL, 1, '2025-11-22T03:28:03.281+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (17, '계지부자탕', '계지제', NULL, NULL, 1, '2025-11-22T03:28:03.413+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (18, '백출부자탕', '계지제', NULL, NULL, 1, '2025-11-22T03:28:03.541+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (19, '감초부자탕', '계지제', NULL, NULL, 1, '2025-11-22T03:28:03.667+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (20, '당귀사역탕', '계지제', NULL, NULL, 1, '2025-11-22T03:28:03.796+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (21, '당귀사역가오수유생강탕', '계지제', NULL, NULL, 1, '2025-11-22T03:28:03.928+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (22, '황기계지오물탕', '계지제', NULL, NULL, 1, '2025-11-22T03:28:04.062+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (23, '계지거계가복령백출탕', '계지제', NULL, NULL, 1, '2025-11-22T03:28:04.193+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (24, '마황탕', '마황제', NULL, NULL, 1, '2025-11-22T03:28:04.321+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (25, '마황가출탕', '마황제', NULL, NULL, 1, '2025-11-22T03:28:04.444+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (26, '갈근탕', '마황제', NULL, NULL, 1, '2025-11-22T03:28:04.572+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (27, '계마각반탕', '마황제', NULL, NULL, 1, '2025-11-22T03:28:04.713+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (28, '대청룡탕', '마황제', NULL, NULL, 1, '2025-11-22T03:28:05.199+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (29, '소청룡탕', '마황제', NULL, NULL, 1, '2025-11-22T03:28:05.325+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (30, '소청룡가석고탕', '마황제', NULL, NULL, 1, '2025-11-22T03:28:05.452+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (31, '월비탕', '마황제', NULL, NULL, 1, '2025-11-22T03:28:05.581+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (32, '월비가출탕', '마황제', NULL, NULL, 1, '2025-11-22T03:28:05.721+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (33, '마행감석탕', '마황제', NULL, NULL, 1, '2025-11-22T03:28:05.845+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (34, '마행의감탕', '마황제', NULL, NULL, 1, '2025-11-22T03:28:05.977+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (35, '마황부자세신탕', '마황제', NULL, NULL, 1, '2025-11-22T03:28:06.154+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (36, '마황부자감초탕', '마황제', NULL, NULL, 1, '2025-11-22T03:28:06.287+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (37, '마황연교적소두탕', '마황제', NULL, NULL, 1, '2025-11-22T03:28:06.409+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (38, '소시호탕', '시호제', NULL, NULL, 1, '2025-11-22T03:28:06.531+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (39, '대시호탕', '시호제', NULL, NULL, 1, '2025-11-22T03:28:06.663+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (40, '중시호탕', '시호제', NULL, NULL, 1, '2025-11-22T03:28:06.801+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (41, '시호가용골모려탕', '시호제', NULL, NULL, 1, '2025-11-22T03:28:06.923+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (42, '사역산', '시호제', NULL, NULL, 1, '2025-11-22T03:28:07.06+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (43, '시호계지탕', '시호제', NULL, NULL, 1, '2025-11-22T03:28:07.187+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (44, '시호계지건강탕', '시호제', NULL, NULL, 1, '2025-11-22T03:28:07.375+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (45, '소시호가망초탕', '시호제', NULL, NULL, 1, '2025-11-22T03:28:07.512+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (46, '대황황련사심탕', '금련제', NULL, NULL, 1, '2025-11-22T03:28:07.645+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (47, '삼황사심탕', '금련제', NULL, NULL, 1, '2025-11-22T03:28:07.772+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (48, '황련탕', '금련제', NULL, NULL, 1, '2025-11-22T03:28:07.899+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (49, '갈근황금황련탕', '금련제', NULL, NULL, 1, '2025-11-22T03:28:08.023+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (50, '황련아교탕', '금련제', NULL, NULL, 1, '2025-11-22T03:28:08.162+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (54, '감초사심탕', '금련제', NULL, NULL, 1, '2025-11-22T03:28:08.686+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (58, '삼물황금탕', '금련제', NULL, NULL, 1, '2025-11-22T03:28:09.191+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (62, '인진호탕', '치자제', NULL, NULL, 1, '2025-11-22T03:28:09.724+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (66, '지실치자탕', '치자제', NULL, NULL, 1, '2025-11-22T03:28:10.24+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (70, '대함흉환', '함흉제', NULL, NULL, 1, '2025-11-22T03:28:10.759+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (74, '소승기탕', '대황제', NULL, NULL, 1, '2025-11-22T03:28:11.272+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (78, '마자인환', '대황제', NULL, NULL, 1, '2025-11-22T03:28:11.78+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (82, '백호가인삼탕', '석고제', NULL, NULL, 1, '2025-11-22T03:28:12.293+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (86, '인삼탕', '건강제', NULL, NULL, 1, '2025-11-22T03:28:12.81+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (90, '생강감초탕', '건강제', NULL, NULL, 1, '2025-11-22T03:28:13.316+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (94, '길경탕', '감초제', NULL, NULL, 1, '2025-11-22T03:28:13.816+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (98, '감맥대조탕', '감초제', NULL, NULL, 1, '2025-11-22T03:28:14.33+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (102, '통맥사역탕', '부자제', NULL, NULL, 1, '2025-11-22T03:28:14.848+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (106, '의이부자패장산', '부자제', NULL, NULL, 1, '2025-11-22T03:28:15.381+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (110, '귤피죽여탕', '귤피제', NULL, NULL, 1, '2025-11-22T03:28:15.881+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (114, '과루해백반하탕', '해백제', NULL, NULL, 1, '2025-11-22T03:28:16.383+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (118, '방기황기탕', '방기제', NULL, NULL, 1, '2025-11-22T03:28:16.911+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (122, '소반하가복령탕', '반하제', NULL, NULL, 1, '2025-11-22T03:28:17.432+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (126, '오령산', '복령제', NULL, NULL, 1, '2025-11-22T03:28:17.944+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (130, '저령탕', '복령제', NULL, NULL, 1, '2025-11-22T03:28:18.446+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (134, '영감강미신탕', '복령제', NULL, NULL, 1, '2025-11-22T03:28:18.96+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (138, '영강출감탕', '복령제', NULL, NULL, 1, '2025-11-22T03:28:19.47+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (142, '대황목단피탕', '도인제', NULL, NULL, 1, '2025-11-22T03:28:19.996+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (146, '온경탕', '당귀제', NULL, NULL, 1, '2025-11-22T03:28:20.5+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (150, '오자탕', '', NULL, NULL, 1, '2025-11-22T03:28:21.014+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (154, '백자팔', '', NULL, NULL, 1, '2025-11-22T03:28:21.53+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (158, '백대갈', '', NULL, NULL, 1, '2025-11-22T03:28:22.053+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (162, '환탕포방기', '', NULL, NULL, 1, '2025-11-22T03:28:22.565+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (166, '녹용쌍화탕', '', NULL, NULL, 1, '2025-11-22T03:28:23.076+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (170, '계강조초황신부탕', '계지제', NULL, NULL, 1, '2025-11-22T03:28:23.611+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (174, '일반쌍화탕', '', NULL, NULL, 1, '2025-11-22T03:28:24.137+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (178, '작약감초부자탕', '계지제', NULL, NULL, 1, '2025-11-22T03:28:24.649+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (182, '다이어트2', '다이어트', NULL, NULL, 1, '2025-11-22T03:28:25.162+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (186, '대시함박', '', NULL, NULL, 1, '2025-11-22T03:28:25.669+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (190, '사물탕', '', NULL, NULL, 1, '2025-11-22T03:28:26.21+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (194, '불환금정기산', '', NULL, NULL, 1, '2025-11-22T03:28:26.741+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (198, '온담탕', '', NULL, NULL, 1, '2025-11-22T03:28:27.246+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (202, '보중치습탕', '', NULL, NULL, 1, '2025-11-22T03:28:27.739+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (206, '시함석', '', NULL, NULL, 1, '2025-11-22T03:28:28.26+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (210, '시함갈', '', NULL, NULL, 1, '2025-11-22T03:28:28.777+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (214, '요요방지탕1', '다이어트', NULL, NULL, 1, '2025-11-22T03:28:29.278+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (218, '후박마황탕', '마황제', NULL, NULL, 1, '2025-11-22T03:28:29.79+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (222, '갈근가천신반', '', NULL, NULL, 1, '2025-11-22T03:28:30.286+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (226, '황련해독탕', '', NULL, NULL, 1, '2025-11-22T03:28:30.799+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (230, '인숙산', '', NULL, NULL, 1, '2025-11-22T03:28:31.324+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (234, '십전대보탕', '', NULL, NULL, 1, '2025-11-22T03:28:31.838+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (238, '맥문후박탕', '', NULL, NULL, 1, '2025-11-22T03:28:32.364+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (242, '요요방지탕2', '다이어트', NULL, NULL, 1, '2025-11-22T03:28:32.879+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (246, '시갈령', '', NULL, NULL, 1, '2025-11-22T03:28:33.395+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (250, '강삼조이', '', NULL, NULL, 1, '2025-11-22T03:28:33.9+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (254, '육군자탕', '', NULL, NULL, 1, '2025-11-22T03:28:34.4+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (258, '시함중2', '', NULL, NULL, 1, '2025-11-22T03:28:34.915+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (51, '건강황금황련인삼탕', '금련제', NULL, NULL, 1, '2025-11-22T03:28:08.295+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (55, '부자사심탕', '금련제', NULL, NULL, 1, '2025-11-22T03:28:08.816+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (59, '선복대자석탕', '금련제', NULL, NULL, 1, '2025-11-22T03:28:09.322+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (63, '치자감초시탕', '치자제', NULL, NULL, 1, '2025-11-22T03:28:09.849+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (67, '치자후박탕', '치자제', NULL, NULL, 1, '2025-11-22T03:28:10.366+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (71, '소함흉탕', '함흉제', NULL, NULL, 1, '2025-11-22T03:28:10.885+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (75, '조위승기탕', '대황제', NULL, NULL, 1, '2025-11-22T03:28:11.401+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (79, '대황감수탕', '대황제', NULL, NULL, 1, '2025-11-22T03:28:11.906+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (83, '백호탕', '석고제', NULL, NULL, 1, '2025-11-22T03:28:12.426+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (87, '계지인삼탕', '건강제', NULL, NULL, 1, '2025-11-22T03:28:12.938+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (91, '백엽탕', '', NULL, NULL, 1, '2025-11-22T03:28:13.44+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (95, '배농탕', '감초제', NULL, NULL, 1, '2025-11-22T03:28:13.947+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (99, '사역탕', '부자제', NULL, NULL, 1, '2025-11-22T03:28:14.457+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (103, '건강부자탕', '부자제', NULL, NULL, 1, '2025-11-22T03:28:14.981+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (107, '부자갱미탕', '부자제', NULL, NULL, 1, '2025-11-22T03:28:15.502+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (111, '귤피대황박초탕', '귤피제', NULL, NULL, 1, '2025-11-22T03:28:16.007+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (115, '지실해백계지탕', '해백제', NULL, NULL, 1, '2025-11-22T03:28:16.512+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (119, '방기복령탕', '방기제', NULL, NULL, 1, '2025-11-22T03:28:17.04+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (123, '반하후박탕', '반하제', NULL, NULL, 1, '2025-11-22T03:28:17.559+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (127, '인진오령산', '복령제', NULL, NULL, 1, '2025-11-22T03:28:18.067+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (131, '영계출감탕', '복령제', NULL, NULL, 1, '2025-11-22T03:28:18.572+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (135, '영감강미신하탕', '복령제', NULL, NULL, 1, '2025-11-22T03:28:19.089+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (139, '팔미환', '복령제', NULL, NULL, 1, '2025-11-22T03:28:19.599+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (143, '계지복령환', '도인제', NULL, NULL, 1, '2025-11-22T03:28:20.124+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (147, '오수유탕', '당귀제', NULL, NULL, 1, '2025-11-22T03:28:20.629+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (151, '시함박', '', NULL, NULL, 1, '2025-11-22T03:28:21.142+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (155, '시함반', '', NULL, NULL, 1, '2025-11-22T03:28:21.663+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (159, '시귤탕', '', NULL, NULL, 1, '2025-11-22T03:28:22.179+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (163, '포방기탕', '', NULL, NULL, 1, '2025-11-22T03:28:22.691+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (167, '시함탕', '', NULL, NULL, 1, '2025-11-22T03:28:23.197+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (171, '대시호가망초탕', '시호제', NULL, NULL, 1, '2025-11-22T03:28:23.753+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (175, '계지거작약가부자탕', '계지제', NULL, NULL, 1, '2025-11-22T03:28:24.274+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (179, '갈근가반하탕', '마황탕', NULL, NULL, 1, '2025-11-22T03:28:24.777+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (183, '다이어트3', '다이어트', NULL, NULL, 1, '2025-11-22T03:28:25.288+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (187, '다이어트7', '다이어트', NULL, NULL, 1, '2025-11-22T03:28:25.815+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (191, '시호배농탕', '', NULL, NULL, 1, '2025-11-22T03:28:26.346+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (195, '실버보약', '', NULL, NULL, 1, '2025-11-22T03:28:26.865+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (199, '가온체감탕', '다이어트', NULL, NULL, 1, '2025-11-22T03:28:27.367+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (203, '시호거반하가과루탕', '금련제', NULL, NULL, 1, '2025-11-22T03:28:27.87+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (207, '시함마농', '', NULL, NULL, 1, '2025-11-22T03:28:28.39+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (211, '귀비온담탕', '', NULL, NULL, 1, '2025-11-22T03:28:28.905+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (215, '백인2', '', NULL, NULL, 1, '2025-11-22T03:28:29.407+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (219, '소청룡교이', '', NULL, NULL, 1, '2025-11-22T03:28:29.911+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (223, '갈근비염방', '', NULL, NULL, 1, '2025-11-22T03:28:30.415+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (227, '이진탕', '', NULL, NULL, 1, '2025-11-22T03:28:30.937+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (231, '반하백출천마탕', '', NULL, NULL, 1, '2025-11-22T03:28:31.456+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (235, '시함령', '', NULL, NULL, 1, '2025-11-22T03:28:31.973+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (239, '중이염방', '', NULL, NULL, 1, '2025-11-22T03:28:32.494+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (243, '시함사농', '', NULL, NULL, 1, '2025-11-22T03:28:33.006+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (247, '자음강화탕', '', NULL, NULL, 1, '2025-11-22T03:28:33.519+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (251, '은화비염방', '', NULL, NULL, 1, '2025-11-22T03:28:34.027+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (255, '대영전', '', NULL, NULL, 1, '2025-11-22T03:28:34.529+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (259, '교애사물탕', '', NULL, NULL, 1, '2025-11-22T03:28:35.05+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (52, '반하사심탕', '금련제', NULL, NULL, 1, '2025-11-22T03:28:08.421+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (56, '황금탕', '금련제', NULL, NULL, 1, '2025-11-22T03:28:08.944+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (60, '치자시탕', '치자제', NULL, NULL, 1, '2025-11-22T03:28:09.444+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (64, '치자생강시탕', '치자제', NULL, NULL, 1, '2025-11-22T03:28:09.975+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (68, '치자건강탕', '치자제', NULL, NULL, 1, '2025-11-22T03:28:10.496+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (72, '감수반하탕', '함흉제', NULL, NULL, 1, '2025-11-22T03:28:11.016+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (76, '후박칠물탕', '대황제', NULL, NULL, 1, '2025-11-22T03:28:11.529+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (80, '대황망초탕', '대황제', NULL, NULL, 1, '2025-11-22T03:28:12.038+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (84, '백호가계지탕', '석고제', NULL, NULL, 1, '2025-11-22T03:28:12.553+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (88, '대건중탕', '건강제', NULL, NULL, 1, '2025-11-22T03:28:13.068+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (92, '도화탕', '', NULL, NULL, 1, '2025-11-22T03:28:13.565+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (96, '배농산', '감초제', NULL, NULL, 1, '2025-11-22T03:28:14.076+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (100, '사역가인삼탕', '부자제', NULL, NULL, 1, '2025-11-22T03:28:14.586+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (104, '진무탕', '부자제', NULL, NULL, 1, '2025-11-22T03:28:15.103+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (108, '귤피탕', '귤피제', NULL, NULL, 1, '2025-11-22T03:28:15.632+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (112, '복령음', '귤피제', NULL, NULL, 1, '2025-11-22T03:28:16.135+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (116, '목방기탕', '방기제', NULL, NULL, 1, '2025-11-22T03:28:16.64+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (120, '방기지황탕', '방기제', NULL, NULL, 1, '2025-11-22T03:28:17.171+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (124, '후생반감인탕', '반하제', NULL, NULL, 1, '2025-11-22T03:28:17.684+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (128, '복령택사탕', '복령제', NULL, NULL, 1, '2025-11-22T03:28:18.2+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (132, '영계감조탕', '복령제', NULL, NULL, 1, '2025-11-22T03:28:18.693+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (136, '영감강미신하인탕', '복령제', NULL, NULL, 1, '2025-11-22T03:28:19.21+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (140, '육미지황탕', '복령제', NULL, NULL, 1, '2025-11-22T03:28:19.724+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (144, '당귀작약산', '당귀제', NULL, NULL, 1, '2025-11-22T03:28:20.247+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (148, '적소두당귀산', '당귀제', NULL, NULL, 1, '2025-11-22T03:28:20.762+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (152, '시령탕', '', NULL, NULL, 1, '2025-11-22T03:28:21.273+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (156, '대시함', '', NULL, NULL, 1, '2025-11-22T03:28:21.797+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (160, '시함마', '', NULL, NULL, 1, '2025-11-22T03:28:22.3+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (164, '삼방기탕', '', NULL, NULL, 1, '2025-11-22T03:28:22.819+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (168, '작약감초탕', '계지제', NULL, NULL, 1, '2025-11-22T03:28:23.321+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (172, '백호육미', '', NULL, NULL, 1, '2025-11-22T03:28:23.884+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (176, '과루계지탕', '계지제', NULL, NULL, 1, '2025-11-22T03:28:24.398+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (180, '월비가반하탕', '마황제', NULL, NULL, 1, '2025-11-22T03:28:24.896+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (184, '다이어트5', '다이어트', NULL, NULL, 1, '2025-11-22T03:28:25.415+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (188, '대시함마', '', NULL, NULL, 1, '2025-11-22T03:28:25.938+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (192, '평위산', '', NULL, NULL, 1, '2025-11-22T03:28:26.475+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (196, '서근쌍화탕', '', NULL, NULL, 1, '2025-11-22T03:28:26.996+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (200, '당귀수산', '', NULL, NULL, 1, '2025-11-22T03:28:27.493+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (204, '원방쌍화탕', '', NULL, NULL, 1, '2025-11-22T03:28:28+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (208, '시함박농', '', NULL, NULL, 1, '2025-11-22T03:28:28.512+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (212, '백호2', '', NULL, NULL, 1, '2025-11-22T03:28:29.025+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (216, '백인3', '', NULL, NULL, 1, '2025-11-22T03:28:29.529+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (220, '시함박사', '', NULL, NULL, 1, '2025-11-22T03:28:30.032+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (224, '축천환', '', NULL, NULL, 1, '2025-11-22T03:28:30.549+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (228, '생맥산', '', NULL, NULL, 1, '2025-11-22T03:28:31.065+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (232, '중시호가망초탕', '', NULL, NULL, 1, '2025-11-22T03:28:31.585+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (236, '이진탕', '', NULL, NULL, 1, '2025-11-22T03:28:32.108+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (240, '마행의감2', '', NULL, NULL, 1, '2025-11-22T03:28:32.616+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (244, '억간산', '', NULL, NULL, 1, '2025-11-22T03:28:33.14+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (248, '사군자탕', '', NULL, NULL, 1, '2025-11-22T03:28:33.643+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (252, '구미강활탕', '', NULL, NULL, 1, '2025-11-22T03:28:34.146+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (256, '소함흉탕2', '', NULL, NULL, 1, '2025-11-22T03:28:34.656+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (260, '인삼패독산', '', NULL, NULL, 1, '2025-11-22T03:28:35.175+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (264, '조경종옥탕', '', NULL, NULL, 1, '2025-11-22T03:28:35.704+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (268, '치자시탕2', '', NULL, NULL, 1, '2025-11-22T03:28:36.195+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (272, '총명탕', '', NULL, NULL, 1, '2025-11-22T03:28:36.723+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (276, '향사갈금련', '', NULL, NULL, 1, '2025-11-22T03:28:37.223+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (53, '생강사심탕', '금련제', NULL, NULL, 1, '2025-11-22T03:28:08.554+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (57, '오매환', '금련제', NULL, NULL, 1, '2025-11-22T03:28:09.069+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (61, '치자벽피탕', '치자제', NULL, NULL, 1, '2025-11-22T03:28:09.584+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (65, '치자대황탕', '치자제', NULL, NULL, 1, '2025-11-22T03:28:10.107+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (69, '대함흉탕', '함흉제', NULL, NULL, 1, '2025-11-22T03:28:10.62+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (73, '대승기탕', '대황제', NULL, NULL, 1, '2025-11-22T03:28:11.14+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (77, '후박삼물탕', '대황제', NULL, NULL, 1, '2025-11-22T03:28:11.654+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (81, '대황부자탕', '대황제', NULL, NULL, 1, '2025-11-22T03:28:12.166+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (85, '죽엽석고탕', '석고제', NULL, NULL, 1, '2025-11-22T03:28:12.679+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (89, '감초건강탕', '건강제', NULL, NULL, 1, '2025-11-22T03:28:13.189+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (93, '감초탕', '감초제', NULL, NULL, 1, '2025-11-22T03:28:13.695+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (97, '배농산급탕', '감초제', NULL, NULL, 1, '2025-11-22T03:28:14.204+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (101, '복령사역탕', '부자제', NULL, NULL, 1, '2025-11-22T03:28:14.712+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (105, '부자탕', '부자제', NULL, NULL, 1, '2025-11-22T03:28:15.238+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (109, '귤피지실생강탕', '귤피제', NULL, NULL, 1, '2025-11-22T03:28:15.76+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (113, '과루해백백주탕', '해백제', NULL, NULL, 1, '2025-11-22T03:28:16.257+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (117, '목방기탕거석고가복령망초탕', '방기제', NULL, NULL, 1, '2025-11-22T03:28:16.769+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (121, '소반하탕', '반하제', NULL, NULL, 1, '2025-11-22T03:28:17.305+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (125, '맥문동탕', '반하제', NULL, NULL, 1, '2025-11-22T03:28:17.813+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (129, '택사탕', '복령제', NULL, NULL, 1, '2025-11-22T03:28:18.324+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (133, '영계미감탕', '복령제', NULL, NULL, 1, '2025-11-22T03:28:18.824+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (137, '영감강미신하인황탕', '복령제', NULL, NULL, 1, '2025-11-22T03:28:19.341+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (141, '도핵승기탕', '도인제', NULL, NULL, 1, '2025-11-22T03:28:19.846+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (145, '궁귀교애탕', '당귀제', NULL, NULL, 1, '2025-11-22T03:28:20.376+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (149, '산조인탕', '당귀제', NULL, NULL, 1, '2025-11-22T03:28:20.881+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (153, '대함흉환급탕', '', NULL, NULL, 1, '2025-11-22T03:28:21.404+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (157, '시박탕', '', NULL, NULL, 1, '2025-11-22T03:28:21.93+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (161, '대탕포방기', '', NULL, NULL, 1, '2025-11-22T03:28:22.431+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (165, '시계마', '', NULL, NULL, 1, '2025-11-22T03:28:22.942+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (169, '계지가작약생강인삼신가탕', '계지제', NULL, NULL, 1, '2025-11-22T03:28:23.45+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (173, '곽향정기산', '', NULL, NULL, 1, '2025-11-22T03:28:24.014+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (177, '계지생강지실탕', '계지제', NULL, NULL, 1, '2025-11-22T03:28:24.525+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (181, '다이어트4', '다이어트', NULL, NULL, 1, '2025-11-22T03:28:25.033+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (185, '다이어트6', '다이어트', NULL, NULL, 1, '2025-11-22T03:28:25.548+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (189, '불수산', '', NULL, NULL, 1, '2025-11-22T03:28:26.073+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (193, '보중익기탕', '', NULL, NULL, 1, '2025-11-22T03:28:26.605+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (197, '귀비탕', '', NULL, NULL, 1, '2025-11-22T03:28:27.119+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (201, '가온체감탕0', '다이어트', NULL, NULL, 1, '2025-11-22T03:28:27.614+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (205, '쌍금탕', '', NULL, NULL, 1, '2025-11-22T03:28:28.127+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (209, '시갈탕', '', NULL, NULL, 1, '2025-11-22T03:28:28.643+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (213, '백호3', '', NULL, NULL, 1, '2025-11-22T03:28:29.153+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (217, '사간마황탕', '마황제', NULL, NULL, 1, '2025-11-22T03:28:29.658+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (221, '시평탕', '', NULL, NULL, 1, '2025-11-22T03:28:30.159+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (225, '향사평위산', '', NULL, NULL, 1, '2025-11-22T03:28:30.677+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (229, '시함중', '', NULL, NULL, 1, '2025-11-22T03:28:31.194+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (233, '마황비염방', '', NULL, NULL, 1, '2025-11-22T03:28:31.714+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (237, '지출탕', '', NULL, NULL, 1, '2025-11-22T03:28:32.231+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (241, '마행의감3', '', NULL, NULL, 1, '2025-11-22T03:28:32.747+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (245, '청폐탕', '', NULL, NULL, 1, '2025-11-22T03:28:33.269+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (249, '사물탕', '', NULL, NULL, 1, '2025-11-22T03:28:33.775+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (253, '쌍금탕', '', NULL, NULL, 1, '2025-11-22T03:28:34.273+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (257, '시함탕2', '', NULL, NULL, 1, '2025-11-22T03:28:34.792+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (261, '쌍패탕', '', NULL, NULL, 1, '2025-11-22T03:28:35.307+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (265, '현부이경탕', '', NULL, NULL, 1, '2025-11-22T03:28:35.824+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (262, '팔미환2', '', NULL, NULL, 1, '2025-11-22T03:28:35.433+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (266, '소건중탕2', '', NULL, NULL, 1, '2025-11-22T03:28:35.946+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (270, '지백지황환', '', NULL, NULL, 1, '2025-11-22T03:28:36.456+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (274, '소청룡거미자', '', NULL, NULL, 1, '2025-11-22T03:28:36.972+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (278, '삼출건비탕', '', NULL, NULL, 1, '2025-11-22T03:28:37.477+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (282, '황기작약계지고주탕', '계지제', NULL, NULL, 1, '2025-11-22T03:28:37.99+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (286, '형방지황탕', '', NULL, NULL, 1, '2025-11-22T03:28:38.511+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (290, '저령차전자탕', '', NULL, NULL, 1, '2025-11-22T03:28:39.027+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (294, '십미패독산', '', NULL, NULL, 1, '2025-11-22T03:28:39.632+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (298, '온경반백천', '', NULL, NULL, 1, '2025-11-22T03:28:40.138+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (302, '죽석행인탕', '', NULL, NULL, 1, '2025-11-22T03:28:40.65+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (306, '생간건비탕1', '', NULL, NULL, 1, '2025-11-22T03:28:41.166+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (310, '삼단탕', '', NULL, NULL, 1, '2025-11-22T03:28:41.678+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (263, '육미지황탕2', '', NULL, NULL, 1, '2025-11-22T03:28:35.56+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (267, '건조비염방', '', NULL, NULL, 1, '2025-11-22T03:28:36.073+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (271, '연령고본단', '', NULL, NULL, 1, '2025-11-22T03:28:36.59+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (275, '대갈마', '', NULL, NULL, 1, '2025-11-22T03:28:37.1+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (279, '연교청폐탕', '', NULL, NULL, 1, '2025-11-22T03:28:37.605+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (283, '복령행인감초탕', '복령제', NULL, NULL, 1, '2025-11-22T03:28:38.119+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (287, '귀출파징탕', '', NULL, NULL, 1, '2025-11-22T03:28:38.633+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (291, '녹용쌍패탕', '', NULL, NULL, 1, '2025-11-22T03:28:39.189+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (295, '형저방', '', NULL, NULL, 1, '2025-11-22T03:28:39.757+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (299, '기울요통방', '', NULL, NULL, 1, '2025-11-22T03:28:40.274+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (303, '스팀팩', '', NULL, NULL, 1, '2025-11-22T03:28:40.787+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (307, '녹용쌍금탕', '', NULL, NULL, 1, '2025-11-22T03:28:41.292+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (311, '독활지황탕', '', NULL, NULL, 1, '2025-11-22T03:28:41.823+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (269, '쌍갈탕', '', NULL, NULL, 1, '2025-11-22T03:28:36.322+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (273, '천왕보심단', '', NULL, NULL, 1, '2025-11-22T03:28:36.849+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (277, '향사육군자탕', '', NULL, NULL, 1, '2025-11-22T03:28:37.349+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (281, '형방사백산', '', NULL, NULL, 1, '2025-11-22T03:28:37.85+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (285, '귀비탕2', '', NULL, NULL, 1, '2025-11-22T03:28:38.365+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (289, '시함은화탕', '', NULL, NULL, 1, '2025-11-22T03:28:38.899+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (293, '천마구등음', '', NULL, NULL, 1, '2025-11-22T03:28:39.444+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (297, '형방패독산', '', NULL, NULL, 1, '2025-11-22T03:28:40.01+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (301, '보화탕', '', NULL, NULL, 1, '2025-11-22T03:28:40.52+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (305, '갈근탕가천궁신이', '', NULL, NULL, 1, '2025-11-22T03:28:41.038+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (309, '독활기생탕', '', NULL, NULL, 1, '2025-11-22T03:28:41.557+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (280, '황기건중탕2', '', NULL, NULL, 1, '2025-11-22T03:28:37.728+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (284, '두충우슬', '', NULL, NULL, 1, '2025-11-22T03:28:38.243+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (288, '금은화연교', '', NULL, NULL, 1, '2025-11-22T03:28:38.768+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (292, '안정산', '', NULL, NULL, 1, '2025-11-22T03:28:39.319+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (296, '형방지황탕2', '', NULL, NULL, 1, '2025-11-22T03:28:39.888+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (300, '죽엽온경탕', '', NULL, NULL, 1, '2025-11-22T03:28:40.394+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (304, '승마갈근탕', '', NULL, NULL, 1, '2025-11-22T03:28:40.911+00:00', NULL);
INSERT OR REPLACE INTO prescription_definitions (id, name, category, description, ingredients, is_active, created_at, updated_at) VALUES (308, '반하백출천마탕2', '', NULL, NULL, 1, '2025-11-22T03:28:41.43+00:00', NULL);

-- ============================================
-- blog_posts (3개 행)
-- ============================================
INSERT OR REPLACE INTO blog_posts (id, title, slug, excerpt, content, category, status, thumbnail_url, author_id, author_name, published_at, view_count, like_count, comment_count, tags, meta_title, meta_description, created_at, updated_at) VALUES ('60d12050-587d-4dda-9323-377adec553e1', '봄철 알레르기 비염, 한방으로 근본 치료하기', 'spring-allergy-rhinitis-treatment', '봄만 되면 시작되는 알레르기 비염, 단순 증상 완화가 아닌 체질 개선을 통한 근본 치료법을 알아봅니다.', '# 봄철 알레르기 비염이란?

봄철이 되면 많은 분들이 알레르기 비염으로 고생합니다. 꽃가루, 황사, 미세먼지 등이 원인이 되어 콧물, 재채기, 코막힘 등의 증상이 나타납니다.

## 한의학적 관점

한의학에서는 알레르기 비염을 **폐기허약(肺氣虛弱)**과 관련지어 봅니다. 폐의 기운이 약해지면 외부 사기(邪氣)에 대한 저항력이 떨어져 알레르기 반응이 쉽게 나타나게 됩니다.

## 치료 방법

1. **침 치료**: 코 주변 경혈을 자극하여 증상 완화
2. **한약 치료**: 체질에 맞는 한약으로 면역력 강화
3. **생활 관리**: 충분한 수면, 스트레스 관리

## 예방법

- 외출 시 마스크 착용
- 귀가 후 손씻기와 세안
- 실내 습도 유지 (50-60%)', 'health_info', 'published', NULL, NULL, '김한의 원장', '2025-11-24T13:25:30.206771+00:00', 0, 0, 0, '["알레르기","비염","봄철건강","한방치료"]', NULL, NULL, '2025-11-27T13:25:30.206771+00:00', '2025-11-27T13:25:30.206771+00:00');
INSERT OR REPLACE INTO blog_posts (id, title, slug, excerpt, content, category, status, thumbnail_url, author_id, author_name, published_at, view_count, like_count, comment_count, tags, meta_title, meta_description, created_at, updated_at) VALUES ('d712c4bd-3663-4a47-a744-d7adecf28060', '직장인 만성 피로, 한의원에서 해결하세요', 'chronic-fatigue-treatment', '항상 피곤하고 무기력한 직장인을 위한 한방 피로 회복 프로그램을 소개합니다.', '# 만성 피로 증후군

현대 직장인들의 가장 흔한 증상 중 하나가 바로 만성 피로입니다. 충분히 자도 피곤하고, 커피를 마셔도 잠깐 뿐이라면 단순한 피로가 아닐 수 있습니다.

## 원인

- 과도한 업무 스트레스
- 불규칙한 식습관
- 수면의 질 저하
- 운동 부족

## 한방 치료법

### 1. 공진단
왕실에서 사용하던 보약으로, 기력 회복에 탁월합니다.

### 2. 침 치료
족삼리, 합곡 등의 혈자리를 자극하여 기혈 순환을 촉진합니다.

### 3. 약침 치료
피로 회복에 효과적인 한약 성분을 직접 혈위에 주입합니다.', 'treatment_guide', 'published', NULL, NULL, '김한의 원장', '2025-11-20T13:25:30.206771+00:00', 0, 0, 0, '["피로","직장인건강","보약","공진단"]', NULL, NULL, '2025-11-27T13:25:30.206771+00:00', '2025-11-27T13:25:30.206771+00:00');
INSERT OR REPLACE INTO blog_posts (id, title, slug, excerpt, content, category, status, thumbnail_url, author_id, author_name, published_at, view_count, like_count, comment_count, tags, meta_title, meta_description, created_at, updated_at) VALUES ('6c043723-65e7-4d12-8a0c-bb698a40620e', '소화불량과 위장 건강, 한방으로 관리하기', 'digestive-health-korean-medicine', '반복되는 소화불량, 더부룩함을 한의학적으로 해결하는 방법을 알아봅니다.', '# 소화불량의 한의학적 이해

식후 더부룩함, 속쓰림, 복부 팽만감... 현대인의 60% 이상이 경험하는 소화불량은 단순히 "많이 먹어서"가 아닐 수 있습니다.

## 비위(脾胃)의 중요성

한의학에서 비위는 모든 건강의 근본입니다. 음식을 소화시키고 영양분을 전신에 공급하는 역할을 합니다.

## 체질별 소화불량

- **소음인**: 위장이 차가워 소화가 안 됨
- **소양인**: 스트레스로 인한 위산 과다
- **태음인**: 과식으로 인한 위장 부담
- **태양인**: 드물지만 급체가 잦음

## 권장 한약재

1. 산사: 육류 소화 촉진
2. 맥아: 탄수화물 소화 도움
3. 진피: 기 순환 촉진', 'health_info', 'published', NULL, NULL, '연이재한의원', '2025-11-13T13:25:30.206771+00:00', 0, 0, 0, '["소화불량","위장건강","비위","한약"]', NULL, NULL, '2025-11-27T13:25:30.206771+00:00', '2025-11-27T13:25:30.206771+00:00');

-- blog_subscribers: 데이터 없음
-- ============================================
-- treatment_records (16개 행)
-- ============================================
INSERT OR REPLACE INTO treatment_records (id, patient_id, record_date, record_type, content, doctor_id, doctor_name, created_at, updated_at) VALUES (1, 1858, NULL, NULL, NULL, NULL, NULL, '2025-11-27T13:17:18.083386+00:00', '2025-11-27T13:17:18.083386+00:00');
INSERT OR REPLACE INTO treatment_records (id, patient_id, record_date, record_type, content, doctor_id, doctor_name, created_at, updated_at) VALUES (2, 1859, NULL, NULL, NULL, NULL, NULL, '2025-11-28T16:44:46.67683+00:00', '2025-11-28T16:44:46.67683+00:00');
INSERT OR REPLACE INTO treatment_records (id, patient_id, record_date, record_type, content, doctor_id, doctor_name, created_at, updated_at) VALUES (3, 1909, NULL, NULL, NULL, NULL, NULL, '2025-11-29T00:09:16.597553+00:00', '2025-11-29T00:09:16.597553+00:00');
INSERT OR REPLACE INTO treatment_records (id, patient_id, record_date, record_type, content, doctor_id, doctor_name, created_at, updated_at) VALUES (4, 1193, NULL, NULL, NULL, NULL, NULL, '2025-11-29T00:16:37.45486+00:00', '2025-11-29T00:16:37.45486+00:00');
INSERT OR REPLACE INTO treatment_records (id, patient_id, record_date, record_type, content, doctor_id, doctor_name, created_at, updated_at) VALUES (5, 8017, NULL, NULL, NULL, NULL, NULL, '2025-11-29T00:17:55.364298+00:00', '2025-11-29T00:17:55.364298+00:00');
INSERT OR REPLACE INTO treatment_records (id, patient_id, record_date, record_type, content, doctor_id, doctor_name, created_at, updated_at) VALUES (6, 14666, NULL, NULL, NULL, NULL, NULL, '2025-11-29T00:28:14.549261+00:00', '2025-11-29T00:28:14.549261+00:00');
INSERT OR REPLACE INTO treatment_records (id, patient_id, record_date, record_type, content, doctor_id, doctor_name, created_at, updated_at) VALUES (7, 4640, NULL, NULL, NULL, NULL, NULL, '2025-11-29T00:29:47.83934+00:00', '2025-11-29T00:29:47.83934+00:00');
INSERT OR REPLACE INTO treatment_records (id, patient_id, record_date, record_type, content, doctor_id, doctor_name, created_at, updated_at) VALUES (8, 229, NULL, NULL, NULL, NULL, NULL, '2025-11-29T00:31:10.992896+00:00', '2025-11-29T00:31:10.992896+00:00');
INSERT OR REPLACE INTO treatment_records (id, patient_id, record_date, record_type, content, doctor_id, doctor_name, created_at, updated_at) VALUES (9, 7206, NULL, NULL, NULL, NULL, NULL, '2025-11-29T00:33:48.332242+00:00', '2025-11-29T00:33:48.332242+00:00');
INSERT OR REPLACE INTO treatment_records (id, patient_id, record_date, record_type, content, doctor_id, doctor_name, created_at, updated_at) VALUES (10, 16214, NULL, NULL, NULL, NULL, NULL, '2025-11-29T00:36:14.465634+00:00', '2025-11-29T00:36:14.465634+00:00');
INSERT OR REPLACE INTO treatment_records (id, patient_id, record_date, record_type, content, doctor_id, doctor_name, created_at, updated_at) VALUES (11, 1774, NULL, NULL, NULL, NULL, NULL, '2025-11-29T04:04:10.762276+00:00', '2025-11-29T04:04:10.762276+00:00');
INSERT OR REPLACE INTO treatment_records (id, patient_id, record_date, record_type, content, doctor_id, doctor_name, created_at, updated_at) VALUES (12, 543, NULL, NULL, NULL, NULL, NULL, '2025-11-29T14:43:22.749368+00:00', '2025-11-29T14:43:22.749368+00:00');
INSERT OR REPLACE INTO treatment_records (id, patient_id, record_date, record_type, content, doctor_id, doctor_name, created_at, updated_at) VALUES (13, 5891, NULL, NULL, NULL, NULL, NULL, '2025-11-29T14:43:25.372024+00:00', '2025-11-29T14:43:25.372024+00:00');
INSERT OR REPLACE INTO treatment_records (id, patient_id, record_date, record_type, content, doctor_id, doctor_name, created_at, updated_at) VALUES (14, 1860, NULL, NULL, NULL, NULL, NULL, '2025-11-29T15:12:17.118537+00:00', '2025-11-29T15:12:17.118537+00:00');
INSERT OR REPLACE INTO treatment_records (id, patient_id, record_date, record_type, content, doctor_id, doctor_name, created_at, updated_at) VALUES (15, 8174, NULL, NULL, NULL, NULL, NULL, '2025-11-29T15:17:23.870329+00:00', '2025-11-29T15:17:23.870329+00:00');
INSERT OR REPLACE INTO treatment_records (id, patient_id, record_date, record_type, content, doctor_id, doctor_name, created_at, updated_at) VALUES (16, 8109, NULL, NULL, NULL, NULL, NULL, '2025-11-29T15:18:41.078382+00:00', '2025-11-29T15:18:41.078382+00:00');

-- ============================================
-- treatment_timeline_events (61개 행)
-- ============================================
INSERT OR REPLACE INTO treatment_timeline_events (id, patient_id, event_type, event_time, details, created_at) VALUES (1, 0, 'check_in', NULL, NULL, '2025-11-27T13:17:18.616027+00:00');
INSERT OR REPLACE INTO treatment_timeline_events (id, patient_id, event_type, event_time, details, created_at) VALUES (2, 0, 'treatment_start', NULL, NULL, '2025-11-27T13:17:18.910135+00:00');
INSERT OR REPLACE INTO treatment_timeline_events (id, patient_id, event_type, event_time, details, created_at) VALUES (3, 0, 'treatment_end', NULL, NULL, '2025-11-27T13:17:29.349814+00:00');
INSERT OR REPLACE INTO treatment_timeline_events (id, patient_id, event_type, event_time, details, created_at) VALUES (4, 0, 'waiting_payment', NULL, NULL, '2025-11-27T13:17:29.474878+00:00');
INSERT OR REPLACE INTO treatment_timeline_events (id, patient_id, event_type, event_time, details, created_at) VALUES (5, 0, 'check_in', NULL, NULL, '2025-11-28T16:44:46.839584+00:00');
INSERT OR REPLACE INTO treatment_timeline_events (id, patient_id, event_type, event_time, details, created_at) VALUES (6, 0, 'consultation_start', NULL, NULL, '2025-11-28T16:44:47.160036+00:00');
INSERT OR REPLACE INTO treatment_timeline_events (id, patient_id, event_type, event_time, details, created_at) VALUES (7, 0, 'consultation_end', NULL, NULL, '2025-11-28T16:44:55.094861+00:00');
INSERT OR REPLACE INTO treatment_timeline_events (id, patient_id, event_type, event_time, details, created_at) VALUES (8, 0, 'waiting_payment', NULL, NULL, '2025-11-28T16:44:55.219193+00:00');
INSERT OR REPLACE INTO treatment_timeline_events (id, patient_id, event_type, event_time, details, created_at) VALUES (9, 0, 'check_in', NULL, NULL, '2025-11-29T00:09:16.757796+00:00');
INSERT OR REPLACE INTO treatment_timeline_events (id, patient_id, event_type, event_time, details, created_at) VALUES (10, 0, 'consultation_start', NULL, NULL, '2025-11-29T00:09:17.175713+00:00');
INSERT OR REPLACE INTO treatment_timeline_events (id, patient_id, event_type, event_time, details, created_at) VALUES (11, 0, 'consultation_end', NULL, NULL, '2025-11-29T00:09:48.526408+00:00');
INSERT OR REPLACE INTO treatment_timeline_events (id, patient_id, event_type, event_time, details, created_at) VALUES (12, 0, 'waiting_payment', NULL, NULL, '2025-11-29T00:09:48.678766+00:00');
INSERT OR REPLACE INTO treatment_timeline_events (id, patient_id, event_type, event_time, details, created_at) VALUES (13, 0, 'consultation_start', NULL, NULL, '2025-11-29T00:10:03.662702+00:00');
INSERT OR REPLACE INTO treatment_timeline_events (id, patient_id, event_type, event_time, details, created_at) VALUES (14, 0, 'check_in', NULL, NULL, '2025-11-29T00:16:37.587011+00:00');
INSERT OR REPLACE INTO treatment_timeline_events (id, patient_id, event_type, event_time, details, created_at) VALUES (15, 0, 'consultation_start', NULL, NULL, '2025-11-29T00:16:37.860877+00:00');
INSERT OR REPLACE INTO treatment_timeline_events (id, patient_id, event_type, event_time, details, created_at) VALUES (16, 0, 'check_in', NULL, NULL, '2025-11-29T00:17:55.492915+00:00');
INSERT OR REPLACE INTO treatment_timeline_events (id, patient_id, event_type, event_time, details, created_at) VALUES (17, 0, 'consultation_start', NULL, NULL, '2025-11-29T00:17:55.760853+00:00');
INSERT OR REPLACE INTO treatment_timeline_events (id, patient_id, event_type, event_time, details, created_at) VALUES (18, 0, 'consultation_start', NULL, NULL, '2025-11-29T00:25:34.442989+00:00');
INSERT OR REPLACE INTO treatment_timeline_events (id, patient_id, event_type, event_time, details, created_at) VALUES (19, 0, 'consultation_end', NULL, NULL, '2025-11-29T00:26:31.002047+00:00');
INSERT OR REPLACE INTO treatment_timeline_events (id, patient_id, event_type, event_time, details, created_at) VALUES (20, 0, 'waiting_payment', NULL, NULL, '2025-11-29T00:26:31.416508+00:00');
INSERT OR REPLACE INTO treatment_timeline_events (id, patient_id, event_type, event_time, details, created_at) VALUES (21, 0, 'consultation_start', NULL, NULL, '2025-11-29T00:26:44.341712+00:00');
INSERT OR REPLACE INTO treatment_timeline_events (id, patient_id, event_type, event_time, details, created_at) VALUES (22, 0, 'check_in', NULL, NULL, '2025-11-29T00:28:14.681784+00:00');
INSERT OR REPLACE INTO treatment_timeline_events (id, patient_id, event_type, event_time, details, created_at) VALUES (23, 0, 'consultation_start', NULL, NULL, '2025-11-29T00:28:14.970918+00:00');
INSERT OR REPLACE INTO treatment_timeline_events (id, patient_id, event_type, event_time, details, created_at) VALUES (24, 0, 'check_in', NULL, NULL, '2025-11-29T00:29:47.967824+00:00');
INSERT OR REPLACE INTO treatment_timeline_events (id, patient_id, event_type, event_time, details, created_at) VALUES (25, 0, 'consultation_start', NULL, NULL, '2025-11-29T00:29:48.240938+00:00');
INSERT OR REPLACE INTO treatment_timeline_events (id, patient_id, event_type, event_time, details, created_at) VALUES (26, 0, 'check_in', NULL, NULL, '2025-11-29T00:31:11.124551+00:00');
INSERT OR REPLACE INTO treatment_timeline_events (id, patient_id, event_type, event_time, details, created_at) VALUES (27, 0, 'consultation_start', NULL, NULL, '2025-11-29T00:31:11.408359+00:00');
INSERT OR REPLACE INTO treatment_timeline_events (id, patient_id, event_type, event_time, details, created_at) VALUES (28, 0, 'check_in', NULL, NULL, '2025-11-29T00:33:48.456499+00:00');
INSERT OR REPLACE INTO treatment_timeline_events (id, patient_id, event_type, event_time, details, created_at) VALUES (29, 0, 'consultation_start', NULL, NULL, '2025-11-29T00:33:48.736301+00:00');
INSERT OR REPLACE INTO treatment_timeline_events (id, patient_id, event_type, event_time, details, created_at) VALUES (30, 0, 'check_in', NULL, NULL, '2025-11-29T00:36:14.59077+00:00');
INSERT OR REPLACE INTO treatment_timeline_events (id, patient_id, event_type, event_time, details, created_at) VALUES (31, 0, 'consultation_start', NULL, NULL, '2025-11-29T00:36:14.866644+00:00');
INSERT OR REPLACE INTO treatment_timeline_events (id, patient_id, event_type, event_time, details, created_at) VALUES (32, 0, 'consultation_start', NULL, NULL, '2025-11-29T02:06:21.174931+00:00');
INSERT OR REPLACE INTO treatment_timeline_events (id, patient_id, event_type, event_time, details, created_at) VALUES (33, 0, 'consultation_start', NULL, NULL, '2025-11-29T02:06:26.31415+00:00');
INSERT OR REPLACE INTO treatment_timeline_events (id, patient_id, event_type, event_time, details, created_at) VALUES (34, 0, 'consultation_start', NULL, NULL, '2025-11-29T02:06:30.298916+00:00');
INSERT OR REPLACE INTO treatment_timeline_events (id, patient_id, event_type, event_time, details, created_at) VALUES (35, 0, 'consultation_start', NULL, NULL, '2025-11-29T02:06:33.030081+00:00');
INSERT OR REPLACE INTO treatment_timeline_events (id, patient_id, event_type, event_time, details, created_at) VALUES (36, 0, 'consultation_start', NULL, NULL, '2025-11-29T02:28:49.011218+00:00');
INSERT OR REPLACE INTO treatment_timeline_events (id, patient_id, event_type, event_time, details, created_at) VALUES (37, 0, 'consultation_start', NULL, NULL, '2025-11-29T02:28:53.531823+00:00');
INSERT OR REPLACE INTO treatment_timeline_events (id, patient_id, event_type, event_time, details, created_at) VALUES (38, 0, 'check_in', NULL, NULL, '2025-11-29T04:04:10.910762+00:00');
INSERT OR REPLACE INTO treatment_timeline_events (id, patient_id, event_type, event_time, details, created_at) VALUES (39, 0, 'consultation_start', NULL, NULL, '2025-11-29T04:04:11.20394+00:00');
INSERT OR REPLACE INTO treatment_timeline_events (id, patient_id, event_type, event_time, details, created_at) VALUES (40, 0, 'check_in', NULL, NULL, '2025-11-29T14:43:22.930286+00:00');
INSERT OR REPLACE INTO treatment_timeline_events (id, patient_id, event_type, event_time, details, created_at) VALUES (41, 0, 'treatment_start', NULL, NULL, '2025-11-29T14:43:23.232809+00:00');
INSERT OR REPLACE INTO treatment_timeline_events (id, patient_id, event_type, event_time, details, created_at) VALUES (42, 0, 'check_in', NULL, NULL, '2025-11-29T14:43:25.540469+00:00');
INSERT OR REPLACE INTO treatment_timeline_events (id, patient_id, event_type, event_time, details, created_at) VALUES (43, 0, 'treatment_start', NULL, NULL, '2025-11-29T14:43:25.848108+00:00');
INSERT OR REPLACE INTO treatment_timeline_events (id, patient_id, event_type, event_time, details, created_at) VALUES (44, 0, 'treatment_start', NULL, NULL, '2025-11-29T15:03:54.195168+00:00');
INSERT OR REPLACE INTO treatment_timeline_events (id, patient_id, event_type, event_time, details, created_at) VALUES (45, 0, 'check_in', NULL, NULL, '2025-11-29T15:12:17.272685+00:00');
INSERT OR REPLACE INTO treatment_timeline_events (id, patient_id, event_type, event_time, details, created_at) VALUES (46, 0, 'treatment_start', NULL, NULL, '2025-11-29T15:12:17.561512+00:00');
INSERT OR REPLACE INTO treatment_timeline_events (id, patient_id, event_type, event_time, details, created_at) VALUES (47, 0, 'treatment_end', NULL, NULL, '2025-11-29T15:16:57.945699+00:00');
INSERT OR REPLACE INTO treatment_timeline_events (id, patient_id, event_type, event_time, details, created_at) VALUES (48, 0, 'waiting_payment', NULL, NULL, '2025-11-29T15:16:58.086395+00:00');
INSERT OR REPLACE INTO treatment_timeline_events (id, patient_id, event_type, event_time, details, created_at) VALUES (49, 0, 'treatment_end', NULL, NULL, '2025-11-29T15:17:00.791315+00:00');
INSERT OR REPLACE INTO treatment_timeline_events (id, patient_id, event_type, event_time, details, created_at) VALUES (50, 0, 'waiting_payment', NULL, NULL, '2025-11-29T15:17:00.929837+00:00');
INSERT OR REPLACE INTO treatment_timeline_events (id, patient_id, event_type, event_time, details, created_at) VALUES (51, 0, 'check_in', NULL, NULL, '2025-11-29T15:17:24.001341+00:00');
INSERT OR REPLACE INTO treatment_timeline_events (id, patient_id, event_type, event_time, details, created_at) VALUES (52, 0, 'treatment_start', NULL, NULL, '2025-11-29T15:17:24.301281+00:00');
INSERT OR REPLACE INTO treatment_timeline_events (id, patient_id, event_type, event_time, details, created_at) VALUES (53, 0, 'treatment_end', NULL, NULL, '2025-11-29T15:18:13.996849+00:00');
INSERT OR REPLACE INTO treatment_timeline_events (id, patient_id, event_type, event_time, details, created_at) VALUES (54, 0, 'waiting_payment', NULL, NULL, '2025-11-29T15:18:14.12264+00:00');
INSERT OR REPLACE INTO treatment_timeline_events (id, patient_id, event_type, event_time, details, created_at) VALUES (55, 0, 'check_in', NULL, NULL, '2025-11-29T15:18:41.22062+00:00');
INSERT OR REPLACE INTO treatment_timeline_events (id, patient_id, event_type, event_time, details, created_at) VALUES (56, 0, 'treatment_start', NULL, NULL, '2025-11-29T15:18:41.505866+00:00');
INSERT OR REPLACE INTO treatment_timeline_events (id, patient_id, event_type, event_time, details, created_at) VALUES (57, 0, 'treatment_end', NULL, NULL, '2025-11-29T15:26:53.984841+00:00');
INSERT OR REPLACE INTO treatment_timeline_events (id, patient_id, event_type, event_time, details, created_at) VALUES (58, 0, 'waiting_payment', NULL, NULL, '2025-11-29T15:26:54.144738+00:00');
INSERT OR REPLACE INTO treatment_timeline_events (id, patient_id, event_type, event_time, details, created_at) VALUES (59, 0, 'treatment_start', NULL, NULL, '2025-11-29T15:26:59.367871+00:00');
INSERT OR REPLACE INTO treatment_timeline_events (id, patient_id, event_type, event_time, details, created_at) VALUES (60, 0, 'treatment_end', NULL, NULL, '2025-11-29T16:13:14.118091+00:00');
INSERT OR REPLACE INTO treatment_timeline_events (id, patient_id, event_type, event_time, details, created_at) VALUES (61, 0, 'waiting_payment', NULL, NULL, '2025-11-29T16:13:14.337738+00:00');

-- ============================================
-- progress_notes (1개 행)
-- ============================================
INSERT OR REPLACE INTO progress_notes (id, patient_id, note_date, content, doctor_id, doctor_name, created_at, updated_at) VALUES (7, 17507, '2025-11-22T00:00:00', NULL, NULL, NULL, '2025-11-22T16:30:28.493375', '2025-11-22T16:44:55.210081');

-- tasks: 데이터 없음
-- 마이그레이션 SQL 생성 완료
