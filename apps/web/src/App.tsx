import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components';

const LandingPage = lazy(() =>
  import('./pages/LandingPage').then((module) => ({ default: module.LandingPage }))
);
const ReceiptPage = lazy(() =>
  import('./pages/ReceiptPage').then((module) => ({ default: module.ReceiptPage }))
);
const DashboardPage = lazy(() =>
  import('./pages/AppPages').then((module) => ({ default: module.DashboardPage }))
);
const ProgramsPage = lazy(() =>
  import('./pages/AppPages').then((module) => ({ default: module.ProgramsPage }))
);
const ProgramDetailPage = lazy(() =>
  import('./pages/AppPages').then((module) => ({ default: module.ProgramDetailPage }))
);
const CoveragePage = lazy(() =>
  import('./pages/AppPages').then((module) => ({ default: module.CoveragePage }))
);
const CoverageDetailPage = lazy(() =>
  import('./pages/AppPages').then((module) => ({ default: module.CoverageDetailPage }))
);
const ActivityPage = lazy(() =>
  import('./pages/AppPages').then((module) => ({ default: module.ActivityPage }))
);
const NewProgramPage = lazy(() =>
  import('./pages/NewProgramPage').then((module) => ({ default: module.NewProgramPage }))
);

function RouteFallback() {
  return (
    <div className="route-fallback" role="status">
      Loading…
    </div>
  );
}

export function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/app" element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="programs" element={<ProgramsPage />} />
          <Route path="programs/new" element={<NewProgramPage />} />
          <Route path="programs/:programId" element={<ProgramDetailPage />} />
          <Route path="coverage" element={<CoveragePage />} />
          <Route path="coverage/:coverageId" element={<CoverageDetailPage />} />
          <Route path="activity" element={<ActivityPage />} />
        </Route>
        <Route path="/receipt/:coverageId" element={<ReceiptPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
