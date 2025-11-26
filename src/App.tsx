import { Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { getCurrentUser } from '@shared/lib/auth';
import type { PortalUser } from '@shared/types';

// Portal Pages
import LoginPage from '@portal/pages/LoginPage';
import Dashboard from '@portal/pages/Dashboard';
import AdminPage from '@portal/pages/AdminPage';

// Module placeholders (will be replaced with actual modules)
import ManageApp from '@manage/ManageApp';
import ChartApp from '@chart/ChartApp';
import InventoryApp from '@inventory/InventoryApp';
import TreatmentApp from '@treatment/TreatmentApp';

// Loading component
function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-clinic-background">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-clinic-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600">로딩 중...</p>
      </div>
    </div>
  );
}

function App() {
  const [user, setUser] = useState<PortalUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkUser();
  }, []);

  async function checkUser() {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    } catch (error) {
      console.error('사용자 확인 실패:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <Routes>
      {/* Portal Routes */}
      <Route
        path="/login"
        element={user ? <Navigate to="/" replace /> : <LoginPage onLogin={setUser} />}
      />
      <Route
        path="/"
        element={
          user ? (
            <Dashboard user={user} onLogout={() => setUser(null)} />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
        path="/admin"
        element={
          user?.role === 'super_admin' ? (
            <AdminPage user={user} />
          ) : (
            <Navigate to="/" replace />
          )
        }
      />

      {/* Manage Module Routes */}
      <Route
        path="/manage/*"
        element={user ? <ManageApp user={user} /> : <Navigate to="/login" replace />}
      />

      {/* Chart Module Routes */}
      <Route
        path="/chart/*"
        element={user ? <ChartApp user={user} /> : <Navigate to="/login" replace />}
      />

      {/* Inventory Module Routes */}
      <Route
        path="/inventory/*"
        element={user ? <InventoryApp user={user} /> : <Navigate to="/login" replace />}
      />

      {/* Treatment Module Routes */}
      <Route
        path="/treatment/*"
        element={user ? <TreatmentApp user={user} /> : <Navigate to="/login" replace />}
      />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
