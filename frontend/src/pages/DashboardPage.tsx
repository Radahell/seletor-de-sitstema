import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Trophy, Video, Building2, Flag, ChevronRight, Plus, LogOut, User,
  Search, Loader2, RefreshCw, Shield
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import api, { SystemWithTenants, TenantInfo, ApiError } from '../services/api';
import SwitchSystemMenu from '../components/SwitchSystemMenu';

const SYSTEM_ICONS: Record<string, typeof Trophy> = {
  jogador: Trophy,
  lances: Video,
  quadra: Building2,
  arbitro: Flag,
};

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user, tenants, logout, refreshUser, isSuperAdmin } = useAuth();

  const [myTenants, setMyTenants] = useState<SystemWithTenants[]>([]);
  const [availableTenants, setAvailableTenants] = useState<SystemWithTenants[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [myData, availableData] = await Promise.all([
        api.getMyTenants(),
        api.getAvailableTenants(),
      ]);

      setMyTenants(myData.systems);

      // Filter out tenants user already belongs to
      const myTenantIds = new Set(
        myData.systems.flatMap(s => s.tenants.map(t => t.id))
      );

      const filtered = availableData.systems.map(system => ({
        ...system,
        tenants: system.tenants.filter(t => !myTenantIds.has(t.id)),
      })).filter(s => s.tenants.length > 0);

      setAvailableTenants(filtered);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEnterTenant = (tenant: TenantInfo) => {
    // Store tenant info in localStorage (shared across same origin)
    localStorage.setItem('current_tenant', JSON.stringify(tenant));
    localStorage.setItem('tenant_slug', tenant.slug);
    localStorage.setItem('system_slug', tenant.system?.slug || '');

    // Apply theme
    if (tenant.primaryColor) {
      localStorage.setItem('tenant_theme', JSON.stringify({
        primaryColor: tenant.primaryColor,
      }));
    }

    // Get hub token to pass to external systems
    const hubToken = localStorage.getItem('auth_token') || '';

    // Redirect to system URL
    const baseUrl = tenant.system?.slug === 'lances'
      ? '/lances'
      : `/${tenant.system?.slug}/${tenant.slug}`;

    if (tenant.system?.slug === 'lances') {
      // Internal route - use React Router
      navigate(baseUrl);
    } else {
      // External system - full page redirect with hub token
      // The target system reads the token from URL and stores locally
      const separator = baseUrl.includes('?') ? '&' : '?';
      window.location.href = `${baseUrl}${separator}hub_token=${encodeURIComponent(hubToken)}&tenant=${encodeURIComponent(tenant.slug)}&role=${encodeURIComponent(tenant.role || 'player')}`;
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/auth');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-red-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center">
              <span className="text-sm font-black text-white">LO</span>
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Lance de Ouro</h1>
              <p className="text-xs text-zinc-500">Dashboard</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isSuperAdmin && (
              <button
                onClick={() => navigate('/admin')}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20 transition-colors text-sm font-semibold"
              >
                <Shield className="w-4 h-4" />
                <span className="hidden sm:inline">Admin</span>
              </button>
            )}

            <button
              onClick={loadData}
              className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              title="Atualizar"
            >
              <RefreshCw className="w-5 h-5" />
            </button>

            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center">
                  <span className="text-xs font-bold text-white">
                    {user?.name?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <span className="text-sm font-medium text-white hidden sm:block">
                  {user?.nickname || user?.name?.split(' ')[0]}
                </span>
              </button>

              {showMenu && (
                <div className="absolute right-0 top-full mt-2 w-48 rounded-xl bg-zinc-800 border border-zinc-700 shadow-xl py-2 z-50">
                  <button
                    onClick={() => navigate('/profile')}
                    className="w-full px-4 py-2 text-left text-sm text-zinc-300 hover:text-white hover:bg-zinc-700 flex items-center gap-2"
                  >
                    <User className="w-4 h-4" />
                    Meu Perfil
                  </button>
                  <hr className="my-2 border-zinc-700" />
                  <button
                    onClick={handleLogout}
                    className="w-full px-4 py-2 text-left text-sm text-red-400 hover:text-red-300 hover:bg-zinc-700 flex items-center gap-2"
                  >
                    <LogOut className="w-4 h-4" />
                    Sair
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Welcome */}
        <div className="mb-8">
          <h2 className="text-2xl font-black text-white">
            Olá, {user?.nickname || user?.name?.split(' ')[0]}!
          </h2>
          <p className="text-zinc-400 mt-1">
            Selecione um sistema para começar
          </p>
        </div>

        {/* My Systems */}
        {myTenants.length > 0 && (
          <section className="mb-12">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-red-500" />
              Meus Sistemas
            </h3>

            <div className="space-y-6">
              {myTenants.map((system) => {
                const Icon = SYSTEM_ICONS[system.slug] || Trophy;

                return (
                  <div key={system.slug}>
                    <div className="flex items-center gap-2 mb-3">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: system.color + '20' }}
                      >
                        <Icon className="w-4 h-4" style={{ color: system.color }} />
                      </div>
                      <span className="text-sm font-bold text-zinc-400 uppercase tracking-wider">
                        {system.displayName}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {system.tenants.map((tenant) => (
                        <button
                          key={tenant.id}
                          onClick={() => handleEnterTenant({ ...tenant, system })}
                          className="group p-4 rounded-2xl bg-zinc-800/50 border border-zinc-700/50 hover:border-zinc-600 transition-all text-left"
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div
                              className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-black"
                              style={{
                                backgroundColor: tenant.primaryColor || system.color,
                                color: '#fff',
                              }}
                            >
                              {tenant.displayName.charAt(0)}
                            </div>
                            <span className="text-xs font-bold uppercase px-2 py-1 rounded-lg bg-zinc-700 text-zinc-400">
                              {tenant.role || 'player'}
                            </span>
                          </div>

                          <h4 className="font-bold text-white group-hover:text-red-400 transition-colors">
                            {tenant.displayName}
                          </h4>

                          <div className="flex items-center gap-1 mt-2 text-sm text-zinc-500 group-hover:text-zinc-400">
                            Entrar
                            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Available Systems */}
        {availableTenants.length > 0 && (
          <section>
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Search className="w-5 h-5 text-blue-500" />
              Descobrir Sistemas
            </h3>

            <div className="space-y-6">
              {availableTenants.map((system) => {
                const Icon = SYSTEM_ICONS[system.slug] || Trophy;

                return (
                  <div key={system.slug}>
                    <div className="flex items-center gap-2 mb-3">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: system.color + '20' }}
                      >
                        <Icon className="w-4 h-4" style={{ color: system.color }} />
                      </div>
                      <span className="text-sm font-bold text-zinc-400 uppercase tracking-wider">
                        {system.displayName}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {system.tenants.map((tenant) => (
                        <button
                          key={tenant.id}
                          onClick={() => navigate(`/discover/${tenant.slug}`)}
                          className="group p-4 rounded-2xl bg-zinc-800/30 border border-dashed border-zinc-700 hover:border-zinc-500 transition-all text-left"
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div
                              className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-black opacity-60"
                              style={{
                                backgroundColor: tenant.primaryColor || system.color,
                                color: '#fff',
                              }}
                            >
                              {tenant.displayName.charAt(0)}
                            </div>
                          </div>

                          <h4 className="font-bold text-zinc-400 group-hover:text-white transition-colors">
                            {tenant.displayName}
                          </h4>

                          <div className="flex items-center gap-1 mt-2 text-sm text-blue-500">
                            <Plus className="w-4 h-4" />
                            Participar
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Empty State */}
        {myTenants.length === 0 && availableTenants.length === 0 && (
          <div className="text-center py-16">
            <div className="w-20 h-20 rounded-full bg-zinc-800 flex items-center justify-center mx-auto mb-4">
              <Search className="w-10 h-10 text-zinc-600" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">
              Nenhum sistema disponível
            </h3>
            <p className="text-zinc-500">
              Aguarde novos sistemas serem criados
            </p>
          </div>
        )}
      </main>

      {/* Click outside to close menu */}
      {showMenu && (
        <div
          className="fixed inset-0 z-30"
          onClick={() => setShowMenu(false)}
        />
      )}
    </div>
  );
}
