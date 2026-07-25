import { Routes, Route } from 'react-router-dom';
import { ToastProvider } from '@/contexts/ToastContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import DashboardPage from '@/pages/DashboardPage';
import LoginPage from '@/pages/LoginPage';
import SignupPage from '@/pages/SignupPage';
import ResetPasswordPage from '@/pages/ResetPasswordPage';
import DocProjectPage from '@/pages/DocProjectPage';
import AccountPage from '@/pages/AccountPage';
import NotFoundPage from '@/pages/NotFoundPage';

export default function App() {
  return (
    <ToastProvider>
      <Routes>
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route
          path="/account"
          element={
            <ProtectedRoute>
              <AccountPage />
            </ProtectedRoute>
          }
        />

        {/* Public read-only viewing; edit controls gate themselves on ownership */}
        <Route path="/docs/:projectSlug" element={<DocProjectPage />} />
        <Route path="/docs/:projectSlug/:sectionSlug" element={<DocProjectPage />} />

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </ToastProvider>
  );
}
