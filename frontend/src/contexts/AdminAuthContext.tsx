import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
import {
  exchangeHubToken,
  refreshAdminSession,
  logoutAdmin,
  setAdminTokens,
  clearAdminTokens,
  getAdminToken,
  type AdminUser,
} from '../services/adminApi';

interface AdminAuthContextType {
  adminUser: AdminUser | null;
  isAdminAuthenticated: boolean;
  adminLoading: boolean;
  adminError: string | null;
  adminLogout: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthContextType | null>(null);

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error('useAdminAuth must be used within AdminAuthProvider');
  return ctx;
}

const INACTIVITY_MS = 30 * 60 * 1000; // 30 min

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [adminLoading, setAdminLoading] = useState(true);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [lastActive, setLastActive] = useState(Date.now());

  const isAdminAuthenticated = !!adminUser;

  // Exchange hub token on mount
  useEffect(() => {
    if (getAdminToken()) {
      // Already authenticated from a previous render
      setAdminLoading(false);
      return;
    }

    const hubToken = localStorage.getItem('auth_token');
    if (!hubToken) {
      setAdminError('Token do hub não encontrado');
      setAdminLoading(false);
      return;
    }

    exchangeHubToken(hubToken)
      .then((session) => {
        setAdminTokens(session.token, session.csrf_token);
        setAdminUser(session.user);
        setExpiresAt(session.expires_at);
      })
      .catch((err) => {
        console.warn('Admin hub-exchange failed:', err);
        setAdminError(err.message || 'Falha ao autenticar no admin');
      })
      .finally(() => setAdminLoading(false));
  }, []);

  // Listen for 401 from adminApi
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setAdminError(detail || 'Sessão admin expirada');
      setAdminUser(null);
      clearAdminTokens();
    };
    window.addEventListener('admin-session-expired', handler);
    return () => window.removeEventListener('admin-session-expired', handler);
  }, []);

  // Activity tracking
  useEffect(() => {
    const bump = () => setLastActive(Date.now());
    const events = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'];
    events.forEach((e) => window.addEventListener(e, bump));
    return () => events.forEach((e) => window.removeEventListener(e, bump));
  }, []);

  // Inactivity timeout
  useEffect(() => {
    if (!adminUser) return;
    const remaining = INACTIVITY_MS - (Date.now() - lastActive);
    if (remaining <= 0) {
      setAdminUser(null);
      clearAdminTokens();
      setAdminError('Sessão admin encerrada por inatividade.');
      return;
    }
    const timer = setTimeout(() => {
      setAdminUser(null);
      clearAdminTokens();
      setAdminError('Sessão admin encerrada por inatividade.');
    }, remaining);
    return () => clearTimeout(timer);
  }, [lastActive, adminUser]);

  // Auto-refresh before expiry
  useEffect(() => {
    if (!expiresAt) return;
    const exp = new Date(expiresAt).getTime();
    const now = Date.now();
    if (isNaN(exp)) return;
    const remaining = exp - now;
    if (remaining <= 0) {
      refreshAdminSession()
        .then((s) => {
          setAdminTokens(s.token, s.csrf_token);
          setAdminUser(s.user);
          setExpiresAt(s.expires_at);
        })
        .catch(() => {
          setAdminUser(null);
          clearAdminTokens();
          setAdminError('Sessão admin expirou.');
        });
      return;
    }
    const timeout = Math.max(remaining - 60_000, 1000);
    const timer = setTimeout(() => {
      refreshAdminSession()
        .then((s) => {
          setAdminTokens(s.token, s.csrf_token);
          setAdminUser(s.user);
          setExpiresAt(s.expires_at);
        })
        .catch(() => {
          setAdminUser(null);
          clearAdminTokens();
          setAdminError('Sessão admin expirou.');
        });
    }, timeout);
    return () => clearTimeout(timer);
  }, [expiresAt]);

  const adminLogout = useCallback(async () => {
    try {
      await logoutAdmin();
    } catch {
      // ignore
    } finally {
      setAdminUser(null);
      clearAdminTokens();
    }
  }, []);

  const value = useMemo<AdminAuthContextType>(
    () => ({ adminUser, isAdminAuthenticated, adminLoading, adminError, adminLogout }),
    [adminUser, isAdminAuthenticated, adminLoading, adminError, adminLogout],
  );

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}
