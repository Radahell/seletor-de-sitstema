import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LogOut, User, Loader2, RefreshCw, Shield, ChevronRight, Smartphone, Download
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import api, { DownloadFileInfo, SystemInfo, SystemWithTenants } from '../services/api';

const SYSTEM_BACKGROUNDS: Record<string, string> = {
  jogador: '/img/campeonato_bg.png',
  lances: '/img/lances_bg.png',
  quadra: '/img/gestao_bg.png',
};

const SYSTEM_DESCRIPTIONS: Record<string, string> = {
  jogador: 'Organize e participe de campeonatos de futebol amador',
  quadra: 'Gerencie quadras esportivas e reservas',
  lances: 'Cameras e gravacoes dos seus jogos',
};

const HIDDEN_SYSTEMS = new Set(['arbitro']);

const APK_CARD_THEMES = [
  { color: '#ef4444', bgImage: '/img/campeonato_bg.png' },
  { color: '#f59e0b', bgImage: '/img/lances_bg.png' },
  { color: '#3b82f6', bgImage: '/img/gestao_bg.png' },
];

interface MobileAppCard {
  id: string;
  name: string;
  description: string;
  color: string;
  apkUrl: string;
  bgImage: string;
}

const mapDownloadToCard = (file: DownloadFileInfo, index: number): MobileAppCard => {
  const theme = APK_CARD_THEMES[index % APK_CARD_THEMES.length];
  const baseName = file.name.replace(/\.apk$/i, '');
  const prettyName = baseName.replace(/[-_]+/g, ' ').trim();

  return {
    id: file.name,
    name: prettyName || file.name,
    description: `Arquivo ${file.name}`,
    color: theme.color,
    apkUrl: `/seletor-api/downloads/${encodeURIComponent(file.name)}`,
    bgImage: theme.bgImage,
  };
};

interface SystemCard extends SystemInfo {
  tenantCount: number;
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user, logout, isSuperAdmin } = useAuth();

  const [systems, setSystems] = useState<SystemCard[]>([]);
  const [mobileApps, setMobileApps] = useState<MobileAppCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [systemsError, setSystemsError] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setSystemsError(false);
    try {
      const [systemsResult, myTenantsResp, downloadsResp] = await Promise.all([
        api.getSystems().catch((e) => { console.error('getSystems error:', e); return null; }),
        api.getMyTenants().catch(() => ({ systems: [] as SystemWithTenants[], total: 0 })),
        api.getDownloads().catch(() => ({ files: [] as DownloadFileInfo[] })),
      ]);

      if (systemsResult === null) {
        setSystemsError(true);
      } else {
        const countBySystem = new Map<string, number>();
        myTenantsResp.systems.forEach(s => countBySystem.set(s.slug, s.tenants.length));

        setSystems(
          systemsResult
            .filter(sys => !HIDDEN_SYSTEMS.has(sys.slug))
            .map(sys => ({
              ...sys,
              tenantCount: countBySystem.get(sys.slug) || 0,
            }))
        );
      }

      setMobileApps(downloadsResp.files.map(mapDownloadToCard));
    } catch (error) {
      console.error('Error loading data:', error);
      setSystemsError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();

    const intervalId = window.setInterval(() => {
      loadData();
    }, 15000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadData();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [loadData]);

  const handleLogout = async () => {
    await logout();
    navigate('/auth');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-amber-500 animate-spin mx-auto mb-4" />
          <p className="text-zinc-400 font-bold uppercase tracking-wider text-sm">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/img/logo_vp.png" alt="Varzea Prime" className="w-10 h-10 rounded-xl" />
            <div>
              <h1 className="text-lg font-black text-white italic tracking-tight">Varzea Prime</h1>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Plataforma Esportiva</p>
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
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center">
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
                    onClick={() => { setShowMenu(false); navigate('/profile'); }}
                    className="w-full px-4 py-2 text-left text-sm text-zinc-300 hover:text-white hover:bg-zinc-700 flex items-center gap-2"
                  >
                    <User className="w-4 h-4" />
                    Meu Perfil
                  </button>
                  <hr className="my-2 border-zinc-700" />
                  <button
                    onClick={() => { setShowMenu(false); handleLogout(); }}
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
      <main className="max-w-6xl mx-auto px-4 py-10">
        {/* Welcome */}
        <div className="text-center mb-10">
          <img src="/img/logo_vp.png" alt="Varzea Prime" className="w-24 h-24 mx-auto mb-4 drop-shadow-2xl" />

          <h2 className="text-4xl md:text-5xl font-black text-white uppercase italic tracking-tighter mb-2">
            Varzea Prime
          </h2>

          <p className="text-zinc-400 text-sm">
            Ola, <span className="font-bold text-white">{user?.nickname || user?.name?.split(' ')[0]}</span>! Escolha a area que deseja acessar.
          </p>
        </div>

        {/* System Cards - Large with background images */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {systemsError && (
            <div className="col-span-2 text-center py-8">
              <p className="text-red-400 font-semibold text-sm mb-2">Erro ao carregar sistemas.</p>
              <button
                onClick={loadData}
                className="text-xs text-zinc-400 hover:text-white underline"
              >
                Tentar novamente
              </button>
            </div>
          )}
          {systems.map((system) => {
            const bgImage = SYSTEM_BACKGROUNDS[system.slug];
            const description = SYSTEM_DESCRIPTIONS[system.slug] || system.displayName;

            return (
              <button
                key={system.slug}
                onClick={() => navigate(`/system/${system.slug}`)}
                className="group relative overflow-hidden rounded-2xl text-left transition-all duration-500 hover:shadow-2xl hover:scale-[1.02] cursor-pointer aspect-[16/10] min-h-[220px]"
              >
                {/* Background Image */}
                {bgImage && (
                  <img
                    src={bgImage}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                )}

                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/20" />

                {/* Colored accent on hover */}
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-15 transition-opacity duration-500"
                  style={{ backgroundColor: system.color }}
                />

                {/* Content */}
                <div className="relative z-10 h-full flex flex-col justify-end p-6">
                  {/* Badge with count */}
                  {system.tenantCount > 0 && (
                    <div className="absolute top-4 right-4">
                      <span
                        className="px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider text-white"
                        style={{ backgroundColor: `${system.color}cc` }}
                      >
                        {system.tenantCount} {system.tenantCount === 1 ? 'inscrito' : 'inscritos'}
                      </span>
                    </div>
                  )}

                  {/* System name */}
                  <h3 className="text-2xl md:text-3xl font-black text-white uppercase italic tracking-tighter mb-1 drop-shadow-lg">
                    {system.displayName}
                  </h3>

                  {/* Description */}
                  <p className="text-sm text-zinc-300 font-medium mb-3 drop-shadow">
                    {description}
                  </p>

                  {/* CTA */}
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-white transition-all duration-300 group-hover:gap-3"
                      style={{ backgroundColor: `${system.color}dd` }}
                    >
                      Acessar
                      <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                    </span>
                  </div>
                </div>

                {/* Bottom accent line */}
                <div
                  className="absolute bottom-0 left-0 right-0 h-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ backgroundColor: system.color }}
                />
              </button>
            );
          })}
        </div>

        {/* Mobile Apps Section */}
        <div className="mt-14 max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-px flex-1 bg-zinc-800" />
            <div className="flex items-center gap-2 text-zinc-500">
              <Smartphone className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-widest">Nossos Apps</span>
            </div>
            <div className="h-px flex-1 bg-zinc-800" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {mobileApps.map((app) => (
              <a
                key={app.id}
                href={app.apkUrl}
                download
                className="group relative overflow-hidden rounded-2xl transition-all duration-500 hover:shadow-2xl hover:scale-[1.02] min-h-[150px]"
              >
                {/* Background Image */}
                <img
                  src={app.bgImage}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                />

                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-black/40" />

                {/* Colored accent on hover */}
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-15 transition-opacity duration-500"
                  style={{ backgroundColor: app.color }}
                />

                {/* Badge */}
                <div className="absolute top-3 right-3 z-10">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider text-white bg-zinc-700/80 backdrop-blur-sm">
                    Android
                  </span>
                </div>

                {/* Content */}
                <div className="relative z-10 h-full flex flex-col justify-end p-5">
                  <div className="flex items-center gap-2 mb-1">
                    <Smartphone className="w-4 h-4 text-white/70" />
                    <h4 className="text-lg font-black text-white uppercase italic tracking-tight">
                      {app.name}
                    </h4>
                  </div>

                  <p className="text-xs text-zinc-300 font-medium mb-3">
                    {app.description}
                  </p>

                  <span
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider text-white w-fit transition-all duration-300 group-hover:gap-2.5"
                    style={{ backgroundColor: `${app.color}dd` }}
                  >
                    <Download className="w-3.5 h-3.5" />
                    Baixar APK
                  </span>
                </div>

                {/* Bottom accent line */}
                <div
                  className="absolute bottom-0 left-0 right-0 h-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ backgroundColor: app.color }}
                />
              </a>
            ))}
          </div>

          {mobileApps.length === 0 && (
            <p className="text-center text-sm text-zinc-500 font-semibold mt-4">
              Nenhum APK encontrado em /downloads.
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-14">
          <p className="text-zinc-700 text-xs font-bold uppercase tracking-widest">
            Sistema Integrado de Gestao Esportiva
          </p>
        </div>
      </main>

      {showMenu && (
        <div className="fixed inset-0 z-30" onClick={() => setShowMenu(false)} />
      )}
    </div>
  );
}
