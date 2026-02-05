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
import DoctorApp from '@doctor/DoctorApp';
import InventoryApp from '@inventory/InventoryApp';
import TreatmentApp from '@treatment/TreatmentApp';
import ActingApp from '@acting/ActingApp';
// PatientCareApp은 HerbalApp으로 통합됨 (patient-care → herbal 리다이렉트)
import FunnelApp from './modules/funnel/FunnelApp';
import ContentApp from './modules/content/ContentApp';
import ReservationApp from './modules/reservation/ReservationApp';
import { PadApp } from './modules/pad';
import StatisticsApp from './modules/statistics/StatisticsApp';
import DbAdminApp from './modules/db-admin/DbAdminApp';
import HerbalApp from './modules/herbal/HerbalApp';
import StaffApp from './modules/staff/StaffApp';
import WikiApp from './modules/wiki/WikiApp';
import CSApp from './modules/cs/CSApp';
import ExamApp from './modules/exam/ExamApp';
import ChatApp from './modules/chat/ChatApp';
import MetricsApp from './modules/metrics/MetricsApp';

// Public Blog Pages (공개 - 로그인 불필요)
import BlogListPage from './modules/blog/pages/BlogListPage';
import BlogPostPage from './modules/blog/pages/BlogPostPage';
import SubscribePage from './modules/blog/pages/SubscribePage';

// Public Guide Pages (공개 - 로그인 불필요)
import GuideViewPage from './modules/content/pages/GuideViewPage';

// Public Landing Pages (공개 - 로그인 불필요)
import LandingViewPage from './modules/content/pages/LandingViewPage';

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

      {/* Doctor Module Routes (원장실) */}
      <Route
        path="/doctor/*"
        element={user ? <DoctorApp user={user} /> : <Navigate to="/login" replace />}
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

      {/* Acting Module Routes */}
      <Route
        path="/acting/*"
        element={user ? <ActingApp user={user} /> : <Navigate to="/login" replace />}
      />

      {/* Patient Care Module Routes (레거시 - /herbal로 리다이렉트) */}
      <Route
        path="/patient-care/*"
        element={<Navigate to="/herbal" replace />}
      />

      {/* Funnel Module Routes */}
      <Route
        path="/funnel/*"
        element={user ? <FunnelApp user={user} /> : <Navigate to="/login" replace />}
      />

      {/* Content Module Routes */}
      <Route
        path="/content/*"
        element={user ? <ContentApp user={user} /> : <Navigate to="/login" replace />}
      />

      {/* Reservation Module Routes */}
      <Route
        path="/reservation/*"
        element={user ? <ReservationApp user={user} /> : <Navigate to="/login" replace />}
      />

      {/* Blog Management Routes (레거시 - /content/blog로 리다이렉트) */}
      <Route
        path="/blog/manage"
        element={<Navigate to="/content/blog" replace />}
      />
      <Route
        path="/blog/manage/new"
        element={<Navigate to="/content/blog/new" replace />}
      />
      <Route
        path="/blog/manage/edit/:id"
        element={<Navigate to="/content/blog/edit/:id" replace />}
      />

      {/* Public Blog Routes (로그인 불필요) */}
      <Route path="/blog" element={<BlogListPage />} />
      <Route path="/blog/subscribe" element={<SubscribePage />} />
      <Route path="/blog/:slug" element={<BlogPostPage />} />

      {/* Public Guide Routes (로그인 불필요) */}
      <Route path="/g/:slug" element={<GuideViewPage />} />

      {/* Public Landing Routes (로그인 불필요) */}
      <Route path="/l/:slug" element={<LandingViewPage />} />

      {/* Pad Routes (원장 패드 - 태블릿용) */}
      <Route
        path="/pad/*"
        element={user ? <PadApp user={user} /> : <Navigate to="/login" replace />}
      />

      {/* Statistics Routes (통계 대시보드) */}
      <Route
        path="/statistics/*"
        element={user ? <StatisticsApp user={user} /> : <Navigate to="/login" replace />}
      />

      {/* DB Admin Routes (DB 관리자) */}
      <Route
        path="/db-admin/*"
        element={user ? <DbAdminApp /> : <Navigate to="/login" replace />}
      />

      {/* Herbal Management Routes (복약관리) */}
      <Route
        path="/herbal/*"
        element={user ? <HerbalApp user={user} /> : <Navigate to="/login" replace />}
      />

      {/* Staff Management Routes (직원관리) */}
      <Route
        path="/staff/*"
        element={user ? <StaffApp user={user} /> : <Navigate to="/login" replace />}
      />

      {/* Wiki Routes (운영매뉴얼) */}
      <Route
        path="/wiki/*"
        element={user ? <WikiApp user={user} /> : <Navigate to="/login" replace />}
      />

      {/* CS Management Routes (CS관리) */}
      <Route
        path="/cs/*"
        element={user ? <CSApp user={user} /> : <Navigate to="/login" replace />}
      />

      {/* Exam Management Routes (검사결과 관리) */}
      <Route
        path="/exam/*"
        element={user ? <ExamApp user={user} /> : <Navigate to="/login" replace />}
      />

      {/* Chat Routes (채팅) */}
      <Route
        path="/chat/*"
        element={user ? <ChatApp user={user} /> : <Navigate to="/login" replace />}
      />

      {/* Metrics Routes (지표관리) */}
      <Route
        path="/metrics/*"
        element={user ? <MetricsApp user={user} /> : <Navigate to="/login" replace />}
      />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
