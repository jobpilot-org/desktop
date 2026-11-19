import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Navigate, Route, Routes } from 'react-router';

import { AppProvider, useApp } from './app-context';
import { Layout } from './layout';
import { ApplicationDetailPage } from './pages/application-detail';
import { ApplicationFormPage } from './pages/application-form';
import { ApplicationsPage } from './pages/applications';
import { InsightsPage } from './pages/insights';
import { LoginPage } from './pages/login';
import { OverviewPage } from './pages/overview';
import { SettingsPage } from './pages/settings';
import './styles.css';
import { ToastProvider } from './ui';

// HashRouter, weil die gebaute App per file:// geladen wird – dort gibt es keinen Server,
// der unbekannte Pfade auf index.html umleitet.
function App() {
  const { session } = useApp();
  if (session === undefined) return null;
  if (!session) return <LoginPage />;

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<OverviewPage />} />
        <Route path="bewerbungen" element={<ApplicationsPage />} />
        <Route path="bewerbung/neu" element={<ApplicationFormPage />} />
        <Route path="bewerbung/:id" element={<ApplicationDetailPage />} />
        <Route
          path="bewerbung/:id/bearbeiten"
          element={<ApplicationFormPage />}
        />
        <Route path="auswertung" element={<InsightsPage />} />
        <Route path="einstellungen" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('#root fehlt in index.html');

createRoot(root).render(
  <StrictMode>
    <HashRouter>
      <AppProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </AppProvider>
    </HashRouter>
  </StrictMode>,
);
