import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { createUser, deleteUser, changePassword, getAllUsers } from '@shared/lib/auth';
import { execute, escapeString, getCurrentTimestamp } from '@shared/lib/postgres';
import { APPS } from '@shared/constants/apps';
import type { PortalUser, AppType, UserRole } from '@shared/types';
import '../styles/portal.css';

interface AdminPageProps {
  user: PortalUser;
}

interface EditingUser {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  permissions: AppType[];
  newPassword?: string;
}

interface NewUser {
  username: string;
  password: string;
  name: string;
  role: UserRole;
  permissions: AppType[];
}

function AdminPage({ user: _currentUser }: AdminPageProps) {
  const [users, setUsers] = useState<PortalUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<EditingUser | null>(null);
  const [newUser, setNewUser] = useState<NewUser | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  const closeEditModal = useCallback(() => {
    if (!saving) {
      setEditingUser(null);
    }
  }, [saving]);

  const closeNewModal = useCallback(() => {
    if (!saving) {
      setNewUser(null);
    }
  }, [saving]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (editingUser) closeEditModal();
        if (newUser) closeNewModal();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [editingUser, newUser, closeEditModal, closeNewModal]);

  const roleOrder: Record<UserRole, number> = {
    super_admin: 1,
    medical_staff: 2,
    desk: 3,
    counseling: 4,
    treatment: 5,
    decoction: 6,
  };

  async function loadUsers() {
    try {
      const data = await getAllUsers();
      const sorted = (data || []).sort((a, b) => {
        const roleCompare = (roleOrder[a.role] || 99) - (roleOrder[b.role] || 99);
        if (roleCompare !== 0) return roleCompare;
        return a.username.localeCompare(b.username);
      });
      setUsers(sorted);
    } catch (error) {
      console.error('사용자 목록 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  }

  async function saveUser() {
    if (!editingUser) return;

    setSaving(true);
    try {
      const now = getCurrentTimestamp();
      const permissionsJson = JSON.stringify(editingUser.permissions);

      await execute(`
        UPDATE portal_users
        SET name = ${escapeString(editingUser.name)},
            role = ${escapeString(editingUser.role)},
            permissions = ${escapeString(permissionsJson)},
            updated_at = ${escapeString(now)}
        WHERE id = ${editingUser.id}
      `);

      if (editingUser.newPassword) {
        await changePassword(Number(editingUser.id), editingUser.newPassword);
      }

      await loadUsers();
      setEditingUser(null);
    } catch (error) {
      console.error('사용자 수정 실패:', error);
      alert('사용자 정보 수정에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateUser() {
    if (!newUser) return;

    if (!newUser.username || !newUser.password || !newUser.name) {
      alert('모든 필드를 입력해주세요.');
      return;
    }

    setSaving(true);
    try {
      await createUser(
        newUser.username,
        newUser.password,
        newUser.name,
        newUser.role,
        newUser.permissions
      );
      await loadUsers();
      setNewUser(null);
    } catch (error) {
      alert(error instanceof Error ? error.message : '사용자 생성에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteUser(userId: string, username: string) {
    if (!confirm(`정말 "${username}" 계정을 삭제하시겠습니까?`)) {
      return;
    }

    try {
      await deleteUser(Number(userId));
      await loadUsers();
    } catch (error) {
      alert(error instanceof Error ? error.message : '사용자 삭제에 실패했습니다.');
    }
  }

  function togglePermission(permission: AppType, isNew = false) {
    if (isNew && newUser) {
      const newPermissions = newUser.permissions.includes(permission)
        ? newUser.permissions.filter((p) => p !== permission)
        : [...newUser.permissions, permission];
      setNewUser({ ...newUser, permissions: newPermissions });
    } else if (!isNew && editingUser) {
      const newPermissions = editingUser.permissions.includes(permission)
        ? editingUser.permissions.filter((p) => p !== permission)
        : [...editingUser.permissions, permission];
      setEditingUser({ ...editingUser, permissions: newPermissions });
    }
  }

  function getRoleName(role: string): string {
    switch (role) {
      case 'super_admin':
        return '최고관리자';
      case 'medical_staff':
        return '의료진';
      case 'desk':
        return '데스크';
      case 'counseling':
        return '상담실';
      case 'treatment':
        return '치료실';
      case 'decoction':
        return '탕전실';
      default:
        return role;
    }
  }

  function getAppName(app: AppType): string {
    const appInfo = APPS.find((a) => a.id === app);
    return appInfo ? appInfo.name : app;
  }

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <div className="admin-container">
      <header className="admin-header">
        <div className="header-left">
          <span className="header-logo">⚙️</span>
          <div>
            <h1 className="header-title">사용자 권한 관리</h1>
            <p className="header-subtitle">사용자의 역할과 앱 접근 권한을 관리합니다</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            className="edit-button"
            onClick={() =>
              setNewUser({
                username: '',
                password: '',
                name: '',
                role: 'desk',
                permissions: [],
              })
            }
          >
            + 새 계정 추가
          </button>
          <Link to="/" className="back-button">
            ← 대시보드
          </Link>
        </div>
      </header>

      <div className="users-table-container">
        <table className="users-table">
          <thead>
            <tr>
              <th>아이디</th>
              <th>이름</th>
              <th>역할</th>
              <th>권한</th>
              <th>가입일</th>
              <th>관리</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.username}</td>
                <td>{u.name}</td>
                <td>
                  <span className={`role-badge ${u.role}`}>{getRoleName(u.role)}</span>
                </td>
                <td>
                  {u.role === 'super_admin' ? (
                    <span className="permission-tag active">모든 권한</span>
                  ) : (
                    <div className="permission-checkbox-group">
                      {u.permissions.length > 0 ? (
                        u.permissions.map((p) => (
                          <span key={p} className="permission-tag active">
                            {getAppName(p)}
                          </span>
                        ))
                      ) : (
                        <span className="permission-tag">권한 없음</span>
                      )}
                    </div>
                  )}
                </td>
                <td>{new Date(u.created_at).toLocaleDateString('ko-KR')}</td>
                <td style={{ display: 'flex', gap: '8px' }}>
                  <button
                    className="edit-button"
                    onClick={() =>
                      setEditingUser({
                        id: u.id,
                        username: u.username,
                        name: u.name,
                        role: u.role,
                        permissions: u.permissions || [],
                      })
                    }
                  >
                    수정
                  </button>
                  <button
                    className="edit-button"
                    style={{ background: '#dc2626' }}
                    onClick={() => handleDeleteUser(u.id, u.username)}
                  >
                    삭제
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 새 계정 추가 모달 */}
      {newUser && (
        <div className="modal-overlay">
          <div className="modal-content modal-fixed-footer admin-modal">
            <div className="modal-header-row">
              <h2 className="modal-title">새 계정 추가</h2>
              <button
                className="modal-close-btn"
                onClick={closeNewModal}
                disabled={saving}
                title="닫기 (ESC)"
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div className="form-row form-row-4">
                <div className="portal-form-group">
                  <label className="portal-form-label">아이디</label>
                  <input
                    type="text"
                    className="portal-form-input"
                    placeholder="로그인에 사용할 아이디"
                    value={newUser.username}
                    onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                  />
                </div>
                <div className="portal-form-group">
                  <label className="portal-form-label">비밀번호</label>
                  <input
                    type="text"
                    className="portal-form-input"
                    placeholder="비밀번호"
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  />
                </div>
                <div className="portal-form-group">
                  <label className="portal-form-label">이름</label>
                  <input
                    type="text"
                    className="portal-form-input"
                    placeholder="표시될 이름"
                    value={newUser.name}
                    onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  />
                </div>
                <div className="portal-form-group">
                  <label className="portal-form-label">역할</label>
                  <select
                    className="portal-form-input"
                    value={newUser.role}
                    onChange={(e) =>
                      setNewUser({
                        ...newUser,
                        role: e.target.value as UserRole,
                      })
                    }
                  >
                    <option value="desk">데스크</option>
                    <option value="counseling">상담실</option>
                    <option value="treatment">치료실</option>
                    <option value="decoction">탕전실</option>
                    <option value="medical_staff">의료진</option>
                    <option value="super_admin">최고관리자</option>
                  </select>
                </div>
              </div>

              {newUser.role !== 'super_admin' && (
                <div className="portal-form-group">
                  <label className="portal-form-label">앱 접근 권한</label>
                  <div className="checkbox-group">
                    {APPS.map((app) => (
                      <label key={app.id} className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={newUser.permissions.includes(app.id)}
                          onChange={() => togglePermission(app.id, true)}
                        />
                        <span>{app.icon} {app.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="modal-actions">
              <button
                className="modal-button secondary"
                onClick={closeNewModal}
                disabled={saving}
              >
                취소
              </button>
              <button className="modal-button primary" onClick={handleCreateUser} disabled={saving}>
                {saving ? '생성 중...' : '계정 생성'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 수정 모달 */}
      {editingUser && (
        <div className="modal-overlay">
          <div className="modal-content modal-fixed-footer admin-modal">
            <div className="modal-header-row">
              <h2 className="modal-title">계정 수정</h2>
              <button
                className="modal-close-btn"
                onClick={closeEditModal}
                disabled={saving}
                title="닫기 (ESC)"
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div className="form-row form-row-4">
                <div className="portal-form-group">
                  <label className="portal-form-label">아이디</label>
                  <input type="text" className="portal-form-input" value={editingUser.username} disabled />
                </div>
                <div className="portal-form-group">
                  <label className="portal-form-label">새 비밀번호</label>
                  <input
                    type="text"
                    className="portal-form-input"
                    placeholder="변경시에만 입력"
                    value={editingUser.newPassword || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, newPassword: e.target.value })}
                  />
                </div>
                <div className="portal-form-group">
                  <label className="portal-form-label">이름</label>
                  <input
                    type="text"
                    className="portal-form-input"
                    value={editingUser.name}
                    onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                  />
                </div>
                <div className="portal-form-group">
                  <label className="portal-form-label">역할</label>
                  <select
                    className="portal-form-input"
                    value={editingUser.role}
                    onChange={(e) =>
                      setEditingUser({
                        ...editingUser,
                        role: e.target.value as UserRole,
                      })
                    }
                  >
                    <option value="desk">데스크</option>
                    <option value="counseling">상담실</option>
                    <option value="treatment">치료실</option>
                    <option value="decoction">탕전실</option>
                    <option value="medical_staff">의료진</option>
                    <option value="super_admin">최고관리자</option>
                  </select>
                </div>
              </div>

              {editingUser.role !== 'super_admin' && (
                <div className="portal-form-group">
                  <label className="portal-form-label">앱 접근 권한</label>
                  <div className="checkbox-group">
                    {APPS.map((app) => (
                      <label key={app.id} className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={editingUser.permissions.includes(app.id)}
                          onChange={() => togglePermission(app.id)}
                        />
                        <span>{app.icon} {app.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="modal-actions">
              <button
                className="modal-button secondary"
                onClick={closeEditModal}
                disabled={saving}
              >
                취소
              </button>
              <button className="modal-button primary" onClick={saveUser} disabled={saving}>
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminPage;
