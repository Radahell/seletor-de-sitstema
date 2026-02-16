import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api, { User, TenantInfo, ApiError } from '../services/api';

interface AuthContextType {
  user: User | null;
  tenants: TenantInfo[];
  currentTenantId: number | null;
  isSuperAdmin: boolean;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  switchTenant: (tenantId: number) => Promise<void>;
  updateTenants: (tenants: TenantInfo[]) => void;
}

interface RegisterData {
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

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [tenants, setTenants] = useState<TenantInfo[]>([]);
  const [currentTenantId, setCurrentTenantId] = useState<number | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = !!user;

  // Load user on mount
  useEffect(() => {
    const token = api.getToken();
    if (token) {
      refreshUser().finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const response = await api.getMe();
      setUser(response.user);
      setTenants(response.tenants);
      setCurrentTenantId(response.currentTenantId || null);
      setIsSuperAdmin(response.isSuperAdmin || false);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        // Token expired or invalid
        api.setToken(null);
        setUser(null);
        setTenants([]);
        setCurrentTenantId(null);
        setIsSuperAdmin(false);
      }
      throw error;
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const response = await api.login(email, password);
    api.setToken(response.token);
    setUser(response.user);
    setTenants(response.tenants || []);
    setCurrentTenantId(null);
    setIsSuperAdmin(response.isSuperAdmin || false);
  }, []);

  const register = useCallback(async (data: RegisterData) => {
    const response = await api.register(data);
    api.setToken(response.token);
    setUser(response.user);
    setTenants([]);
    setCurrentTenantId(null);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // Ignore logout errors
    } finally {
      api.setToken(null);
      setUser(null);
      setTenants([]);
      setCurrentTenantId(null);
      setIsSuperAdmin(false);
    }
  }, []);

  const switchTenant = useCallback(async (tenantId: number) => {
    const response = await api.switchTenant(tenantId);
    setCurrentTenantId(response.tenant.id);

    // Store tenant info for theming
    const tenant = tenants.find(t => t.id === tenantId);
    if (tenant) {
      localStorage.setItem('current_tenant', JSON.stringify(tenant));
    }
  }, [tenants]);

  const updateTenants = useCallback((newTenants: TenantInfo[]) => {
    setTenants(newTenants);
  }, []);

  const value: AuthContextType = {
    user,
    tenants,
    currentTenantId,
    isSuperAdmin,
    isLoading,
    isAuthenticated,
    login,
    register,
    logout,
    refreshUser,
    switchTenant,
    updateTenants,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export default AuthContext;
