/**
 * Admin API Service — talks to the Admin Global backend via /admin-api/ nginx proxy.
 * Same-origin requests (no CORS). Hub token is exchanged for admin tokens on init.
 */

const ADMIN_API_BASE = '/admin-api/api';

let accessToken: string | null = null;
let csrfToken: string | null = null;

// ─── Token management ───────────────────────────────────────────────
export function setAdminTokens(token: string, csrf: string) {
  accessToken = token;
  csrfToken = csrf;
}

export function clearAdminTokens() {
  accessToken = null;
  csrfToken = null;
}

export function getAdminToken() {
  return accessToken;
}

// ─── Core request ───────────────────────────────────────────────────
async function adminRequest<T>(
  endpoint: string,
  options: RequestInit & { skipAuth?: boolean } = {},
): Promise<T> {
  const { skipAuth, ...fetchOpts } = options;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (!skipAuth && accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const method = (fetchOpts.method || 'GET').toUpperCase();
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && csrfToken) {
    headers['X-CSRF-Token'] = csrfToken;
  }

  const res = await fetch(`${ADMIN_API_BASE}${endpoint}`, { ...fetchOpts, headers });
  const data = await res.json();

  if (!res.ok) {
    if (res.status === 401) {
      window.dispatchEvent(new CustomEvent('admin-session-expired', { detail: data.error }));
    }
    throw new AdminApiError(data.error || 'Erro na requisição admin', res.status, data);
  }
  return data as T;
}

export class AdminApiError extends Error {
  status: number;
  data: unknown;
  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.name = 'AdminApiError';
    this.status = status;
    this.data = data;
  }
}

// ─── Auth ───────────────────────────────────────────────────────────
export interface AdminSession {
  token: string;
  csrf_token: string;
  expires_at: string;
  profile: string;
  user: AdminUser;
}

export interface AdminUser {
  id: number;
  name: string;
  email: string;
  is_superuser: boolean;
  is_active: boolean;
  created_at?: string;
}

export async function exchangeHubToken(hubToken: string): Promise<AdminSession> {
  return adminRequest('/auth/hub-exchange', {
    method: 'POST',
    body: JSON.stringify({ hub_token: hubToken }),
    skipAuth: true,
  });
}

export async function refreshAdminSession(): Promise<AdminSession> {
  return adminRequest('/auth/refresh', { method: 'POST' });
}

export async function logoutAdmin(): Promise<void> {
  return adminRequest('/auth/logout', { method: 'POST' });
}

// ─── Dashboard ──────────────────────────────────────────────────────
export interface DashboardMetrics {
  total_establishments: number;
  active_establishments: number;
  total_players: number;
  active_players: number;
  total_sessions?: number;
  total_videos?: number;
  [key: string]: unknown;
}

export async function fetchDashboardMetrics(): Promise<DashboardMetrics> {
  return adminRequest('/dashboard/metrics');
}

// ─── Establishments ─────────────────────────────────────────────────
export interface Establishment {
  id: number;
  name: string;
  slug: string;
  is_active: boolean;
  address?: string;
  city?: string;
  state?: string;
  phone?: string;
  email?: string;
  created_at?: string;
  [key: string]: unknown;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: { page: number; per_page: number; total: number; pages: number };
}

export async function fetchEstablishments(params: Record<string, string> = {}): Promise<PaginatedResponse<Establishment>> {
  const qs = new URLSearchParams(params).toString();
  return adminRequest(`/establishments${qs ? '?' + qs : ''}`);
}

export async function fetchEstablishmentDetail(id: number): Promise<Establishment> {
  return adminRequest(`/establishments/${id}`);
}

export async function createEstablishment(payload: Record<string, unknown>): Promise<Establishment> {
  return adminRequest('/establishments', { method: 'POST', body: JSON.stringify(payload) });
}

export async function updateEstablishment(id: number, payload: Record<string, unknown>): Promise<Establishment> {
  return adminRequest(`/establishments/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
}

export async function updateEstablishmentSecurity(id: number, payload: Record<string, unknown>) {
  return adminRequest(`/establishments/${id}/security`, { method: 'PATCH', body: JSON.stringify(payload) });
}

export async function activateEstablishment(id: number) {
  return adminRequest(`/establishments/${id}/activate`, { method: 'POST' });
}

export async function deactivateEstablishment(id: number) {
  return adminRequest(`/establishments/${id}/deactivate`, { method: 'POST' });
}

export async function deleteEstablishment(id: number) {
  return adminRequest(`/establishments/${id}`, { method: 'DELETE' });
}

// ─── Establishment Managers ─────────────────────────────────────────
export interface Manager {
  id: number;
  name: string;
  email: string;
  is_active: boolean;
  [key: string]: unknown;
}

export async function fetchEstablishmentManagers(estId: number): Promise<Manager[]> {
  return adminRequest(`/establishments/${estId}/managers`);
}

export async function createEstablishmentManager(estId: number, payload: Record<string, unknown>) {
  return adminRequest(`/establishments/${estId}/managers`, { method: 'POST', body: JSON.stringify(payload) });
}

export async function updateEstablishmentManager(estId: number, mgrId: number, payload: Record<string, unknown>) {
  return adminRequest(`/establishments/${estId}/managers/${mgrId}`, { method: 'PATCH', body: JSON.stringify(payload) });
}

export async function deleteEstablishmentManager(estId: number, mgrId: number) {
  return adminRequest(`/establishments/${estId}/managers/${mgrId}`, { method: 'DELETE' });
}

export async function resetManagerPassword(estId: number, mgrId: number, payload: Record<string, unknown> = {}) {
  return adminRequest(`/establishments/${estId}/managers/${mgrId}/password`, { method: 'POST', body: JSON.stringify(payload) });
}

// ─── Players / Hub Users ─────────────────────────────────────────────
// Busca do banco centralizado do hub (seletor) via /seletor-api/api/admin/users
export interface Player {
  id: number;
  name: string;
  email: string;
  phone?: string;
  is_active: boolean;
  tenants?: Array<{ id: number; slug: string; name: string; system: string; role: string }>;
  [key: string]: unknown;
}

const SELETOR_API_BASE = '/seletor-api';

function _hubHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = localStorage.getItem('auth_token');
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

async function hubRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${SELETOR_API_BASE}${endpoint}`, {
    ...options,
    headers: { ..._hubHeaders(), ...(options.headers as Record<string, string> || {}) },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Erro na requisição');
  return data;
}

export async function fetchPlayers(params: Record<string, string> = {}): Promise<PaginatedResponse<Player>> {
  const qs = new URLSearchParams(params).toString();
  return hubRequest(`/api/admin/users${qs ? '?' + qs : ''}`);
}

export async function updatePlayer(id: number, payload: Record<string, unknown>) {
  return hubRequest(`/api/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
}

export async function activatePlayer(id: number) {
  return hubRequest(`/api/admin/users/${id}/activate`, { method: 'POST' });
}

export async function deactivatePlayer(id: number) {
  return hubRequest(`/api/admin/users/${id}/deactivate`, { method: 'POST' });
}

export async function deletePlayer(id: number) {
  return hubRequest(`/api/admin/users/${id}`, { method: 'DELETE' });
}

export async function linkPlayerToEstablishment(playerId: number, estId: number) {
  return adminRequest(`/players/${playerId}/establishments/${estId}`, { method: 'POST' });
}

export async function unlinkPlayerFromEstablishment(playerId: number, estId: number) {
  return adminRequest(`/players/${playerId}/establishments/${estId}`, { method: 'DELETE' });
}

// ─── Admin Users (System Operators) ─────────────────────────────────
export interface SystemUser {
  id: number;
  name: string;
  email: string;
  is_superuser: boolean;
  is_active: boolean;
  created_at?: string;
  [key: string]: unknown;
}

export async function fetchSystemUsers(params: Record<string, string> = {}): Promise<PaginatedResponse<SystemUser>> {
  const qs = new URLSearchParams(params).toString();
  return adminRequest(`/admin-users${qs ? '?' + qs : ''}`);
}

export async function createSystemUser(payload: Record<string, unknown>) {
  return adminRequest('/admin-users', { method: 'POST', body: JSON.stringify(payload) });
}

export async function updateSystemUser(id: number, payload: Record<string, unknown>) {
  return adminRequest(`/admin-users/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
}

export async function resetSystemUserPassword(id: number, payload: Record<string, unknown>) {
  return adminRequest(`/admin-users/${id}/password`, { method: 'POST', body: JSON.stringify(payload) });
}

export async function suspendSystemUser(id: number) {
  return adminRequest(`/admin-users/${id}/suspend`, { method: 'POST' });
}

export async function activateSystemUser(id: number) {
  return adminRequest(`/admin-users/${id}/activate`, { method: 'POST' });
}

export async function deleteSystemUser(id: number) {
  return adminRequest(`/admin-users/${id}`, { method: 'DELETE' });
}

export async function fetchAdminAuditLogs(userId: number, limit = 20) {
  return adminRequest(`/admin-users/${userId}/audit-logs?limit=${limit}`);
}

// ─── Billing: Invoices ──────────────────────────────────────────────
export async function fetchInvoices(params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString();
  return adminRequest(`/invoices${qs ? '?' + qs : ''}`);
}

export async function createInvoice(payload: Record<string, unknown>) {
  return adminRequest('/invoices', { method: 'POST', body: JSON.stringify(payload) });
}

export async function updateInvoice(id: number, payload: Record<string, unknown>) {
  return adminRequest(`/invoices/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
}

export async function fetchPayments(invoiceId: number) {
  return adminRequest(`/invoices/${invoiceId}/payments`);
}

export async function createPayment(invoiceId: number, payload: Record<string, unknown>) {
  return adminRequest(`/invoices/${invoiceId}/payments`, { method: 'POST', body: JSON.stringify(payload) });
}

// ─── Billing: Coupons ───────────────────────────────────────────────
export async function fetchCoupons() {
  return adminRequest('/coupons');
}

export async function createCoupon(payload: Record<string, unknown>) {
  return adminRequest('/coupons', { method: 'POST', body: JSON.stringify(payload) });
}

export async function updateCoupon(id: number, payload: Record<string, unknown>) {
  return adminRequest(`/coupons/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
}

export async function redeemCoupon(payload: Record<string, unknown>) {
  return adminRequest('/coupons/redeem', { method: 'POST', body: JSON.stringify(payload) });
}

// ─── Billing: Loyalty ───────────────────────────────────────────────
export async function fetchLoyaltyBalance(estId: number) {
  return adminRequest(`/loyalty/${estId}/balance`);
}

export async function fetchLoyaltyHistory(estId: number) {
  return adminRequest(`/loyalty/${estId}/history`);
}

export async function creditLoyalty(estId: number, payload: Record<string, unknown>) {
  return adminRequest(`/loyalty/${estId}/credit`, { method: 'POST', body: JSON.stringify(payload) });
}

export async function debitLoyalty(estId: number, payload: Record<string, unknown>) {
  return adminRequest(`/loyalty/${estId}/debit`, { method: 'POST', body: JSON.stringify(payload) });
}

// ─── Audit ──────────────────────────────────────────────────────────
export async function fetchAuditLogs(params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString();
  return adminRequest(`/audit/logs${qs ? '?' + qs : ''}`);
}

// ─── Sessions ───────────────────────────────────────────────────────
export async function fetchActiveSessions() {
  const data: { items?: unknown[] } = await adminRequest('/auth/sessions');
  return data.items ?? [];
}

export async function revokeSession(jti: string) {
  return adminRequest(`/auth/sessions/${jti}/revoke`, { method: 'POST' });
}

// ─── Security ───────────────────────────────────────────────────────
export async function fetchSecurityStatus() {
  return adminRequest('/security/status');
}

// ─── MFA ────────────────────────────────────────────────────────────
export async function fetchMfaStatus() {
  return adminRequest('/auth/mfa/status');
}

export async function setupMfa() {
  return adminRequest('/auth/mfa/setup', { method: 'POST' });
}

export async function verifyMfa(code: string) {
  return adminRequest('/auth/mfa/verify', { method: 'POST', body: JSON.stringify({ code }) });
}

export async function disableMfa(code: string) {
  return adminRequest('/auth/mfa/disable', { method: 'POST', body: JSON.stringify({ code }) });
}

export async function regenerateBackupCodes() {
  return adminRequest('/auth/mfa/backup-codes/regenerate', { method: 'POST' });
}

// ─── Search ─────────────────────────────────────────────────────────
export async function searchEverything(query: string) {
  return adminRequest(`/search?q=${encodeURIComponent(query)}`);
}
