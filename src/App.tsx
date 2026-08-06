import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { ToastProvider } from '@/contexts/ToastContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { RouteLoading } from '@/components/RouteLoading';

// Every page is its own chunk now instead of one monolithic bundle. A
// visitor landing on /docs/:projectSlug (by far the most common entry
// point -- shared links, search results, AI crawlers) only downloads the
// doc-viewer chunk, not the dashboard/editor/account/auth code too. That's
// the biggest lever we have on payload size short of a framework change.
const LandingPage = lazy(() => import('@/pages/LandingPage'));
const BlogListPage = lazy(() => import('@/pages/BlogListPage'));
const BlogPostPage = lazy(() => import('@/pages/BlogPostPage'));
const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const LoginPage = lazy(() => import('@/pages/LoginPage'));
const SignupPage = lazy(() => import('@/pages/SignupPage'));
const ResetPasswordPage = lazy(() => import('@/pages/ResetPasswordPage'));
const DocProjectPage = lazy(() => import('@/pages/DocProjectPage'));
const AccountPage = lazy(() => import('@/pages/AccountPage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));
const SearchResultsPage = lazy(() => import('@/pages/SearchResultsPage'));

export default function App() {
  return (
    <ToastProvider>
      <Suspense fallback={<RouteLoading />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/blog" element={<BlogListPage />} />
          <Route path="/blog/:postSlug" element={<BlogPostPage />} />
          <Route path="/search" element={<SearchResultsPage />} />
          <Route
            path="/dashboard"
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
      </Suspense>
    </ToastProvider>
  );
}
