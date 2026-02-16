/**
 * Serviço de API para o Seletor de Sistemas
 */

// Em produção o nginx roteia /seletor-api/ → seletor-sistema-api:22012
// Em dev o Vite proxy faz o mesmo
const API_BASE = import.meta.env.VITE_API_URL || '/seletor-api';

interface RequestOptions extends RequestInit {
  skipAuth?: boolean;
}

class ApiService {
  private token: string | null = null;

  constructor() {
    this.token = localStorage.getItem('auth_token');
  }

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('auth_token', token);
    } else {
      localStorage.removeItem('auth_token');
    }
  }

  getToken(): string | null {
    return this.token;
  }

  async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { skipAuth, ...fetchOptions } = options;

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };

    if (!skipAuth && this.token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...fetchOptions,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new ApiError(data.error || 'Erro na requisição', response.status, data);
    }

    return data;
  }

  // Auth endpoints
  async register(data: RegisterData) {
    return this.request<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
      skipAuth: true,
    });
  }

  async login(email: string, password: string) {
    return this.request<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      skipAuth: true,
    });
  }

  async logout() {
    return this.request<{ message: string }>('/api/auth/logout', {
      method: 'POST',
    });
  }

  async getMe() {
    return this.request<MeResponse>('/api/auth/me');
  }

  async updateProfile(data: UpdateProfileData) {
    return this.request<{ message: string; user: User }>('/api/auth/me', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async changePassword(currentPassword: string, newPassword: string) {
    return this.request<{ message: string }>('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  }

  async switchTenant(tenantId?: number, tenantSlug?: string) {
    return this.request<SwitchTenantResponse>('/api/auth/switch-tenant', {
      method: 'POST',
      body: JSON.stringify({ tenantId, tenantSlug }),
    });
  }

  // Membership endpoints
  async getMyTenants() {
    return this.request<MyTenantsResponse>('/api/user/tenants');
  }

  async joinTenant(tenantId?: number, tenantSlug?: string, message?: string) {
    return this.request<JoinTenantResponse>('/api/user/tenants/join', {
      method: 'POST',
      body: JSON.stringify({ tenantId, tenantSlug, message }),
    });
  }

  async leaveTenant(tenantId: number) {
    return this.request<{ message: string }>(`/api/user/tenants/${tenantId}`, {
      method: 'DELETE',
    });
  }

  async getAvailableTenants(systemSlug?: string) {
    const query = systemSlug ? `?system=${systemSlug}` : '';
    return this.request<AvailableTenantsResponse>(`/api/tenants/available${query}`, {
      skipAuth: true,
    });
  }

  async getTenantDetails(slug: string) {
    return this.request<{ tenant: TenantDetails }>(`/api/tenants/${slug}`, {
      skipAuth: true,
    });
  }

  // Interests endpoints
  async getMyInterests() {
    return this.request<UserInterest[]>('/api/auth/me/interests');
  }

  async updateMyInterests(systemIds: number[]) {
    return this.request<{ message: string }>('/api/auth/me/interests', {
      method: 'PUT',
      body: JSON.stringify({ systemIds }),
    });
  }

  // Systems endpoints (public)
  async getSystems() {
    return this.request<SystemInfo[]>('/api/systems', { skipAuth: true });
  }
}

// Error class
export class ApiError extends Error {
  status: number;
  data: any;

  constructor(message: string, status: number, data: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

// Types
export interface User {
  id: number;
  name: string;
  nickname?: string;
  email: string;
  phone?: string;
  cpf?: string;
  cnpj?: string;
  avatarUrl?: string;
  bio?: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  bairro?: string;
  complemento?: string;
  city?: string;
  state?: string;
  timezone?: string;
  isActive: boolean;
  createdAt?: string;
  lastLoginAt?: string;
}

export interface SystemInfo {
  id: number;
  slug: string;
  displayName: string;
  icon: string;
  color: string;
}

export interface TenantInfo {
  id: number;
  slug: string;
  displayName: string;
  logoUrl?: string;
  primaryColor?: string;
  role?: string;
  joinedAt?: string;
  system?: SystemInfo;
}

export interface TenantDetails extends TenantInfo {
  welcomeMessage?: string;
  description?: string;
  allowRegistration: boolean;
  memberCount: number;
  address?: string;
  city?: string;
  state?: string;
  phone?: string;
  email?: string;
  features?: Record<string, { enabled: boolean; config?: any }>;
}

export interface SystemWithTenants extends SystemInfo {
  tenants: TenantInfo[];
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
  nickname?: string;
  phone?: string;
  cpf?: string;
  cnpj?: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  bairro?: string;
  complemento?: string;
  city?: string;
  state?: string;
  timezone?: string;
  interests?: number[];
}

export interface UpdateProfileData {
  name?: string;
  nickname?: string;
  phone?: string;
  cpf?: string;
  cnpj?: string;
  bio?: string;
  avatarUrl?: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  bairro?: string;
  complemento?: string;
  city?: string;
  state?: string;
  timezone?: string;
}

export interface UserInterest {
  systemId: number;
  slug: string;
  displayName: string;
  icon: string;
  color: string;
}

export interface AuthResponse {
  message: string;
  token: string;
  user: User;
  isSuperAdmin?: boolean;
  tenants?: TenantInfo[];
}

export interface MeResponse {
  user: User;
  isSuperAdmin?: boolean;
  currentTenantId?: number;
  tenants: TenantInfo[];
}

export interface MyTenantsResponse {
  systems: SystemWithTenants[];
  total: number;
}

export interface AvailableTenantsResponse {
  systems: SystemWithTenants[];
  total: number;
}

export interface JoinTenantResponse {
  message: string;
  status?: string;
  tenant: TenantInfo;
}

export interface SwitchTenantResponse {
  message: string;
  tenant: {
    id: number;
    slug: string;
    displayName: string;
  };
  role: string;
}

// Singleton instance
export const api = new ApiService();
export default api;
