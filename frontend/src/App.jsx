import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import Layout from './components/Layout.jsx';
import { FullPageLoader } from './components/ui.jsx';
import Login from './pages/Login.jsx';

// Pages load on demand; the login page stays in the main bundle for a fast first paint.
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const Institutions = lazy(() => import('./pages/Institutions.jsx'));
const Institution360 = lazy(() => import('./pages/Institution360.jsx'));
const Cases = lazy(() => import('./pages/Cases.jsx'));
const CaseNew = lazy(() => import('./pages/CaseNew.jsx'));
const CaseDetail = lazy(() => import('./pages/CaseDetail.jsx'));
const Overlaps = lazy(() => import('./pages/Overlaps.jsx'));
const AuditTrail = lazy(() => import('./pages/AuditTrail.jsx'));
const Policy = lazy(() => import('./pages/Policy.jsx'));
const NotFound = lazy(() => import('./pages/NotFound.jsx'));
const Watchlist = lazy(() => import('./pages/Watchlist.jsx'));
const Import = lazy(() => import('./pages/Import.jsx'));
const Promises = lazy(() => import('./pages/Promises.jsx'));
const CheckIn = lazy(() => import('./pages/CheckIn.jsx'));
const PortalLayout = lazy(() => import('./pages/Portal.jsx').then((m) => ({ default: m.PortalLayout })));
const PortalHome = lazy(() => import('./pages/Portal.jsx').then((m) => ({ default: m.PortalHome })));
const PortalCase = lazy(() => import('./pages/Portal.jsx').then((m) => ({ default: m.PortalCase })));

const STAFF = ['officer', 'bureau_head', 'senior_reviewer', 'admin'];
const homeFor = (user) => (user.role === 'institution' ? '/portal' : '/');

function RequireAuth({ children, roles }) {
  const { user, ready } = useAuth();
  const location = useLocation();
  if (!ready) return <FullPageLoader />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (roles && !roles.includes(user.role)) return <Navigate to={homeFor(user)} replace />;
  return children;
}

export default function App() {
  const { user, ready } = useAuth();

  // No exit animation around <Routes>: an exiting protected tree would keep
  // rendering <Navigate> against a stale location and loop.
  return (
    <Suspense fallback={<FullPageLoader />}>
    <Routes>
      <Route path="/login" element={ready && user ? <Navigate to={homeFor(user)} replace /> : <Login />} />
      {/* Public: complainant's one-tap promise check-in (token link, no login). */}
      <Route path="/check/:token" element={<CheckIn />} />

      <Route
        path="/portal"
        element={
          <RequireAuth roles={['institution']}>
            <PortalLayout />
          </RequireAuth>
        }
      >
        <Route index element={<PortalHome />} />
        <Route path="cases/:id" element={<PortalCase />} />
      </Route>

      <Route
        element={
          <RequireAuth roles={STAFF}>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="institutions" element={<Institutions />} />
        <Route path="institutions/:permanentId" element={<Institution360 />} />
        <Route path="cases" element={<Cases />} />
        <Route
          path="cases/new"
          element={
            <RequireAuth roles={['officer', 'bureau_head', 'admin']}>
              <CaseNew />
            </RequireAuth>
          }
        />
        <Route path="cases/:id" element={<CaseDetail />} />
        <Route path="overlaps" element={<Overlaps />} />
        <Route path="promises" element={<Promises />} />
        <Route
          path="watchlist"
          element={
            <RequireAuth roles={['senior_reviewer', 'admin', 'bureau_head']}>
              <Watchlist />
            </RequireAuth>
          }
        />
        <Route
          path="audit"
          element={
            <RequireAuth roles={['senior_reviewer', 'admin', 'bureau_head']}>
              <AuditTrail />
            </RequireAuth>
          }
        />
        <Route
          path="import"
          element={
            <RequireAuth roles={['admin', 'bureau_head']}>
              <Import />
            </RequireAuth>
          }
        />
        <Route path="policy" element={<Policy />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
    </Suspense>
  );
}
