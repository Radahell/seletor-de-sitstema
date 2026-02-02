import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import SystemSelectPage from './pages/SystemSelectPage';
import TenantSelectBySystemPage from './pages/TenantSelectBySystemPage';
import LoginPage from './pages/LoginPage';

type TenantTheme = {
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  backgroundColor?: string;
};

function applyTheme(theme: TenantTheme | null) {
  if (!theme) return;
  const root = document.documentElement;
  if (theme.primaryColor) root.style.setProperty('--tenant-primary', theme.primaryColor);
  if (theme.secondaryColor) root.style.setProperty('--tenant-secondary', theme.secondaryColor);
  if (theme.accentColor) root.style.setProperty('--tenant-accent', theme.accentColor);
  if (theme.backgroundColor) root.style.setProperty('--tenant-bg', theme.backgroundColor);
}

export default function App() {
  useEffect(() => {
    const raw = localStorage.getItem('tenant_theme');
    if (!raw) return;
    try {
      applyTheme(JSON.parse(raw));
    } catch {
      // ignorar
    }
  }, []);

  return (
    <Routes>
      <Route path="/" element={<SystemSelectPage />} />
      <Route path="/select-tenant/:systemSlug" element={<TenantSelectBySystemPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
