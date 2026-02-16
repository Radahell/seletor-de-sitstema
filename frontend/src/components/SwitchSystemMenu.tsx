import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeftRight, Check, ChevronDown, Settings, LogOut, User, Home,
  Trophy, Video, Building2, Flag
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { TenantInfo } from '../services/api';

const SYSTEM_ICONS: Record<string, typeof Trophy> = {
  jogador: Trophy,
  lances: Video,
  quadra: Building2,
  arbitro: Flag,
};

interface SwitchSystemMenuProps {
  currentTenant?: TenantInfo | null;
  variant?: 'header' | 'sidebar' | 'floating';
}

export default function SwitchSystemMenu({
  currentTenant,
  variant = 'header',
}: SwitchSystemMenuProps) {
  const navigate = useNavigate();
  const { user, tenants, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  const handleSelect = (tenant: TenantInfo) => {
    localStorage.setItem('current_tenant', JSON.stringify(tenant));
    localStorage.setItem('tenant_slug', tenant.slug);
    localStorage.setItem('system_slug', tenant.system?.slug || '');

    if (tenant.primaryColor) {
      localStorage.setItem('tenant_theme', JSON.stringify({
        primaryColor: tenant.primaryColor,
      }));
      document.documentElement.style.setProperty('--tenant-primary', tenant.primaryColor);
    }

    setIsOpen(false);

    // Redirect based on system type
    const baseUrl = tenant.system?.slug === 'lances'
      ? '/lances'
      : `/${tenant.system?.slug}/${tenant.slug}`;

    if (tenant.system?.slug === 'lances') {
      window.location.href = baseUrl;
    } else {
      // Pass hub_token for SSO with external systems
      const hubToken = localStorage.getItem('auth_token') || '';
      const separator = baseUrl.includes('?') ? '&' : '?';
      window.location.href = `${baseUrl}${separator}hub_token=${encodeURIComponent(hubToken)}&tenant=${encodeURIComponent(tenant.slug)}`;
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/auth');
  };

  // Group tenants by system
  const tenantsBySystem = tenants.reduce((acc, tenant) => {
    const systemSlug = tenant.system?.slug || 'other';
    if (!acc[systemSlug]) {
      acc[systemSlug] = {
        ...tenant.system,
        tenants: [],
      };
    }
    acc[systemSlug].tenants.push(tenant);
    return acc;
  }, {} as Record<string, any>);

  if (variant === 'floating') {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-14 h-14 rounded-full bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-lg shadow-red-500/30 flex items-center justify-center hover:scale-105 transition-transform"
        >
          <ArrowLeftRight className="w-6 h-6" />
        </button>

        {isOpen && (
          <>
            <div
              className="fixed inset-0 bg-black/50 z-40"
              onClick={() => setIsOpen(false)}
            />
            <div className="absolute bottom-16 right-0 w-72 rounded-2xl bg-zinc-900 border border-zinc-700 shadow-2xl overflow-hidden z-50">
              <MenuContent
                user={user}
                currentTenant={currentTenant}
                tenantsBySystem={tenantsBySystem}
                onSelect={handleSelect}
                onLogout={handleLogout}
                onNavigate={(path) => { setIsOpen(false); navigate(path); }}
              />
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 transition-colors text-sm"
      >
        <ArrowLeftRight className="w-4 h-4 text-zinc-400" />
        <span className="text-zinc-300 hidden sm:inline">Trocar</span>
        <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-full mt-2 w-72 rounded-2xl bg-zinc-900 border border-zinc-700 shadow-2xl overflow-hidden z-50">
            <MenuContent
              user={user}
              currentTenant={currentTenant}
              tenantsBySystem={tenantsBySystem}
              onSelect={handleSelect}
              onLogout={handleLogout}
              onNavigate={(path) => { setIsOpen(false); navigate(path); }}
            />
          </div>
        </>
      )}
    </div>
  );
}

interface MenuContentProps {
  user: any;
  currentTenant?: TenantInfo | null;
  tenantsBySystem: Record<string, any>;
  onSelect: (tenant: TenantInfo) => void;
  onLogout: () => void;
  onNavigate: (path: string) => void;
}

function MenuContent({
  user,
  currentTenant,
  tenantsBySystem,
  onSelect,
  onLogout,
  onNavigate,
}: MenuContentProps) {
  return (
    <>
      {/* User header */}
      <div className="p-4 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center">
            <span className="text-sm font-bold text-white">
              {user?.name?.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-white truncate">
              {user?.nickname || user?.name}
            </p>
            <p className="text-xs text-zinc-500 truncate">
              {user?.email}
            </p>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="p-2 border-b border-zinc-800">
        <button
          onClick={() => onNavigate('/dashboard')}
          className="w-full px-3 py-2 rounded-lg text-left text-sm text-zinc-300 hover:text-white hover:bg-zinc-800 flex items-center gap-2"
        >
          <Home className="w-4 h-4" />
          Dashboard
        </button>
        <button
          onClick={() => onNavigate('/profile')}
          className="w-full px-3 py-2 rounded-lg text-left text-sm text-zinc-300 hover:text-white hover:bg-zinc-800 flex items-center gap-2"
        >
          <User className="w-4 h-4" />
          Meu Perfil
        </button>
      </div>

      {/* Systems */}
      <div className="max-h-64 overflow-y-auto">
        {Object.entries(tenantsBySystem).map(([systemSlug, system]: [string, any]) => {
          const Icon = SYSTEM_ICONS[systemSlug] || Trophy;

          return (
            <div key={systemSlug} className="p-2">
              <div className="flex items-center gap-2 px-2 py-1">
                <Icon className="w-3 h-3" style={{ color: system.color }} />
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                  {system.displayName}
                </span>
              </div>

              {system.tenants.map((tenant: TenantInfo) => {
                const isActive = currentTenant?.id === tenant.id;

                return (
                  <button
                    key={tenant.id}
                    onClick={() => onSelect(tenant)}
                    className={`w-full px-3 py-2 rounded-lg text-left text-sm flex items-center gap-2 transition-colors ${
                      isActive
                        ? 'bg-red-500/20 text-red-400'
                        : 'text-zinc-300 hover:text-white hover:bg-zinc-800'
                    }`}
                  >
                    <div
                      className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold"
                      style={{
                        backgroundColor: tenant.primaryColor || system.color,
                        color: '#fff',
                      }}
                    >
                      {tenant.displayName.charAt(0)}
                    </div>
                    <span className="flex-1 truncate">{tenant.displayName}</span>
                    {isActive && <Check className="w-4 h-4 text-red-400" />}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Logout */}
      <div className="p-2 border-t border-zinc-800">
        <button
          onClick={onLogout}
          className="w-full px-3 py-2 rounded-lg text-left text-sm text-red-400 hover:text-red-300 hover:bg-zinc-800 flex items-center gap-2"
        >
          <LogOut className="w-4 h-4" />
          Sair
        </button>
      </div>
    </>
  );
}
