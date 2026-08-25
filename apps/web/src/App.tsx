import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components';
import { LandingPage } from './pages/LandingPage';
import {
  ActivityPage,
  CoverageDetailPage,
  CoveragePage,
  DashboardPage,
  NewProgramPage,
  ProgramDetailPage,
  ProgramsPage,
} from './pages/AppPages';
import { ReceiptPage } from './pages/ReceiptPage';

export function App() {
  return (
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
  );
}
