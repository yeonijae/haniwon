import { useState } from 'react';
import { signIn } from '@shared/lib/auth';
import type { PortalUser } from '@shared/types';
import '../styles/portal.css';

interface LoginPageProps {
  onLogin: (user: PortalUser) => void;
}

function LoginPage({ onLogin }: LoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const user = await signIn(username, password);
      onLogin(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : '로그인에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">🏥</div>
          <h1 className="login-title">연이재한의원</h1>
          <p className="login-subtitle">통합 관리 시스템에 로그인하세요</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          {error && <div className="error-message">{error}</div>}

          <div className="portal-form-group">
            <label className="portal-form-label" htmlFor="username">
              아이디
            </label>
            <input
              id="username"
              type="text"
              className="portal-form-input"
              placeholder="아이디를 입력하세요"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>

          <div className="portal-form-group">
            <label className="portal-form-label" htmlFor="password">
              비밀번호
            </label>
            <input
              id="password"
              type="password"
              className="portal-form-input"
              placeholder="비밀번호를 입력하세요"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="login-button" disabled={loading}>
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default LoginPage;
