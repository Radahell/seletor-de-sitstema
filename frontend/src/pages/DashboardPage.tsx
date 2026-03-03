import {
  ChevronRight,
  Download,
  Loader2,
  LogOut,
  Mail,
  RefreshCw, Shield,
  Smartphone,
  User
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import OnboardingWizard from '../components/OnboardingWizard';
import HintTooltip from '../components/HintTooltip';
import api, { DownloadFileInfo, SystemInfo, SystemWithTenants } from '../services/api';

const SYSTEM_BACKGROUNDS: Record<string, string> = {
  jogador: '/img/campeonato_bg.png',
  lances: '/img/lances_bg.png',
  quadra: '/img/gestao_bg.png',
};

const SYSTEM_DESCRIPTIONS: Record<string, string> = {
  jogador: 'Organize torneios, gerencie times e acompanhe resultados em tempo real',
  quadra: 'Reserve quadras, gerencie horarios e controle seu espaco esportivo',
  lances: 'Grave seus jogos com cameras profissionais e reviva suas melhores jogadas',
};

const HIDDEN_SYSTEMS = new Set(['arbitro']);

const APK_CARD_THEMES = [
  { color: '#ef4444', bgImage: '/img/campeonato_bg.png' },
  { color: '#f59e0b', bgImage: '/img/lances_bg.png' },
  { color: '#3b82f6', bgImage: '/img/gestao_bg.png' },
];

interface MobileAppCard {
  id: string; name: string; description: string;
  color: string; apkUrl: string; bgImage: string;
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
    apkUrl: `/seletor-api/downloads/${encodeURIComponent(file.name)}?v=${encodeURIComponent(file.updatedAt)}`,
    bgImage: theme.bgImage,
  };
};

interface SystemCard extends SystemInfo { tenantCount: number }

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user, logout, isSuperAdmin, isOnboardingComplete } = useAuth();

  const [systems, setSystems] = useState<SystemCard[]>([]);
  const [mobileApps, setMobileApps] = useState<MobileAppCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [systemsError, setSystemsError] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [resendingEmail, setResendingEmail] = useState(false);
  const [resendMsg, setResendMsg] = useState<string | null>(null);

  const loadSystems = useCallback(async () => {
    setIsLoading(true); setSystemsError(false);
    try {
      const [systemsResult, myTenantsResp] = await Promise.all([
        api.getSystems().catch((e) => { console.error('getSystems error:', e); return null; }),
        api.getMyTenants().catch(() => ({ systems: [] as SystemWithTenants[], total: 0 })),
      ]);
      if (systemsResult === null) { setSystemsError(true); }
      else {
        const countBySystem = new Map<string, number>();
        myTenantsResp.systems.forEach(s => countBySystem.set(s.slug, s.tenants.length));
        setSystems(systemsResult.filter(sys => !HIDDEN_SYSTEMS.has(sys.slug)).map(sys => ({ ...sys, tenantCount: countBySystem.get(sys.slug) || 0 })));
      }
    } catch { setSystemsError(true); }
    finally { setIsLoading(false); }
  }, []);

  const loadDownloads = useCallback(async () => {
    try {
      const resp = await api.getDownloads().catch(() => ({ files: [] as DownloadFileInfo[] }));
      setMobileApps(resp.files.map(mapDownloadToCard));
    } catch {}
  }, []);

  const loadAll = useCallback(() => { loadSystems(); loadDownloads(); }, [loadSystems, loadDownloads]);

  useEffect(() => { loadSystems(); loadDownloads(); }, [loadSystems, loadDownloads]);

  useEffect(() => {
    const id = window.setInterval(loadDownloads, 15000);
    const handleVis = () => { if (document.visibilityState === 'visible') loadDownloads(); };
    document.addEventListener('visibilitychange', handleVis);
    return () => { window.clearInterval(id); document.removeEventListener('visibilitychange', handleVis); };
  }, [loadDownloads]);

  const handleLogout = async () => { await logout(); navigate('/auth'); };

  // Mostrar wizard de onboarding para novos usuários
  if (!isOnboardingComplete) {
    return <OnboardingWizard />;
  }

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', background: '#020617', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <Loader2 style={{ width: 40, height: 40, color: '#f59e0b', margin: '0 auto 16px', animation: 'spin 1s linear infinite' }} />
          <p style={{ color: '#334155', fontWeight: 800, letterSpacing: '0.2em', fontSize: 11, textTransform: 'uppercase' }}>Carregando...</p>
        </div>
      </div>
    );
  }

  const initials = user?.name?.charAt(0).toUpperCase() ?? '?';
  const firstName = user?.nickname || user?.name?.split(' ')[0];

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #020617 0%, #0a0f1e 50%, #020617 100%)', position: 'relative' }}>

      {/* Ambient top glow */}
      <div style={{ position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)', width: 800, height: 400, background: 'radial-gradient(ellipse at center top, rgba(245,158,11,0.04) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />

      {/* ── Header ── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 40,
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        background: 'rgba(2,6,23,0.85)',
        backdropFilter: 'blur(20px)',
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <img src="/img/logo_vp.png" alt="Varzea Prime" style={{ width: 38, height: 38, borderRadius: 12 }} />
            <div>
              <h1 style={{ color: '#f8fafc', fontWeight: 900, fontSize: 17, fontStyle: 'italic', letterSpacing: -0.5, margin: 0 }}>Varzea Prime</h1>
              <p style={{ color: '#475569', fontWeight: 800, fontSize: 9, letterSpacing: '0.25em', textTransform: 'uppercase', margin: 0 }}>Plataforma Esportiva</p>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {isSuperAdmin && (
              <button onClick={() => navigate('/admin')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 10, background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.2)', color: '#eab308', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                <Shield style={{ width: 14, height: 14 }} />
                <span>Admin</span>
              </button>
            )}

            <button onClick={loadAll} style={{ padding: 8, borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Atualizar">
              <RefreshCw style={{ width: 15, height: 15 }} />
            </button>

            {/* User menu */}
            <div style={{ position: 'relative' }}>
              <button onClick={() => setShowMenu(!showMenu)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', cursor: 'pointer' }}>
                <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg, #f59e0b, #b45309)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: '#000', fontWeight: 900, fontSize: 12 }}>{initials}</span>
                </div>
                <span style={{ color: '#cbd5e1', fontWeight: 600, fontSize: 13 }} className="hidden-mobile">{firstName}</span>
              </button>

              {showMenu && (
                <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', width: 180, borderRadius: 16, background: '#0f172a', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 24px 60px rgba(0,0,0,0.5)', padding: '6px', zIndex: 50 }}>
                  <button onClick={() => { setShowMenu(false); navigate('/profile'); }} style={{ width: '100%', padding: '10px 12px', borderRadius: 10, background: 'none', border: 'none', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', textAlign: 'left' }}>
                    <User style={{ width: 14, height: 14 }} />
                    Meu Perfil
                  </button>
                  <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', margin: '4px 0' }} />
                  <button onClick={() => { setShowMenu(false); handleLogout(); }} style={{ width: '100%', padding: '10px 12px', borderRadius: 10, background: 'none', border: 'none', color: '#f87171', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', textAlign: 'left' }}>
                    <LogOut style={{ width: 14, height: 14 }} />
                    Sair
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Email verification banner */}
      {user && !user.emailVerifiedAt && (
        <div style={{ background: 'rgba(245,158,11,0.08)', borderBottom: '1px solid rgba(245,158,11,0.2)', padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Mail style={{ width: 16, height: 16, color: '#f59e0b', flexShrink: 0 }} />
          <span style={{ color: '#fbbf24', fontSize: 13, fontWeight: 600 }}>
            Verifique seu email para garantir acesso completo.
          </span>
          {resendMsg ? (
            <span style={{ color: '#4ade80', fontSize: 12, fontWeight: 600 }}>{resendMsg}</span>
          ) : (
            <button
              onClick={async () => {
                setResendingEmail(true); setResendMsg(null);
                try {
                  const resp = await api.resendVerification();
                  setResendMsg(resp.message);
                } catch {
                  setResendMsg('Falha ao reenviar. Tente novamente mais tarde.');
                } finally { setResendingEmail(false); }
              }}
              disabled={resendingEmail}
              style={{ padding: '4px 12px', borderRadius: 8, background: '#f59e0b', border: 'none', color: '#000', fontWeight: 700, fontSize: 12, cursor: 'pointer', opacity: resendingEmail ? 0.5 : 1 }}
            >
              {resendingEmail ? 'Enviando...' : 'Reenviar email'}
            </button>
          )}
        </div>
      )}

      {/* ── Main ── */}
      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '48px 20px 80px', position: 'relative', zIndex: 1 }}>

        {/* Welcome */}
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 16px', borderRadius: 999, background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.15)', marginBottom: 20 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b' }} />
            <span style={{ color: '#d97706', fontSize: 11, fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase' }}>Bem-vindo de volta</span>
          </div>

          <h2 style={{ color: '#f8fafc', fontWeight: 900, fontSize: 'clamp(36px, 6vw, 56px)', fontStyle: 'italic', letterSpacing: -2, textTransform: 'uppercase', lineHeight: 1, margin: '0 0 12px' }}>
            Olá, <span style={{ color: '#f59e0b' }}>{firstName}</span>
          </h2>
          <p style={{ color: '#64748b', fontSize: 14, fontWeight: 500, margin: 0 }}>
            Escolha o produto que deseja acessar
          </p>

          <div style={{ marginTop: 16 }}>
            <HintTooltip id="dashboard-products" text="Clique em um produto para explorar campeonatos, quadras ou gravacoes de jogos." />
          </div>
        </div>

        {/* ── System Cards ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20, maxWidth: 900, margin: '0 auto 64px' }}>
          {systemsError && (
            <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '32px 0' }}>
              <p style={{ color: '#ef4444', fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Erro ao carregar sistemas.</p>
              <button onClick={loadAll} style={{ color: '#475569', fontSize: 12, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Tentar novamente</button>
            </div>
          )}

          {systems.map((system) => {
            const bgImage = SYSTEM_BACKGROUNDS[system.slug];
            const description = SYSTEM_DESCRIPTIONS[system.slug] || system.displayName;
            return (
              <button
                key={system.slug}
                onClick={() => navigate(`/system/${system.slug}`)}
                style={{
                  position: 'relative', overflow: 'hidden', borderRadius: 24,
                  border: '1px solid rgba(255,255,255,0.07)',
                  aspectRatio: '16/10', minHeight: 220,
                  cursor: 'pointer', textAlign: 'left',
                  transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                  background: '#0a0f1e',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.transform = 'translateY(-4px) scale(1.01)';
                  (e.currentTarget as HTMLElement).style.boxShadow = `0 24px 60px ${system.color}20`;
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.transform = 'none';
                  (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                }}
              >
                {bgImage && <img src={bgImage} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.5s ease' }} />}
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.5) 50%, rgba(0,0,0,0.15) 100%)' }} />

                {/* Top accent */}
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${system.color}80, transparent)` }} />

                {/* Count badge */}
                {system.tenantCount > 0 && (
                  <div style={{ position: 'absolute', top: 14, right: 14, padding: '3px 10px', borderRadius: 999, background: `${system.color}cc`, backdropFilter: 'blur(8px)' }}>
                    <span style={{ color: '#fff', fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                      {system.tenantCount} inscrito{system.tenantCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                )}

                {/* Content */}
                <div style={{ position: 'relative', zIndex: 10, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: 24 }}>
                  <h3 style={{ color: '#fff', fontWeight: 900, fontSize: 28, fontStyle: 'italic', letterSpacing: -0.5, textTransform: 'uppercase', margin: '0 0 4px', textShadow: '0 2px 12px rgba(0,0,0,0.5)' }}>
                    {system.displayName}
                  </h3>
                  <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, fontWeight: 500, margin: '0 0 16px' }}>{description}</p>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 12, background: `${system.color}cc`, width: 'fit-content', color: '#fff', fontWeight: 800, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    Acessar
                    <ChevronRight style={{ width: 14, height: 14 }} />
                  </div>
                </div>

                {/* Bottom line */}
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${system.color}, transparent)`, opacity: 0, transition: 'opacity 0.3s' }} className="card-bottom-line" />
              </button>
            );
          })}
        </div>

        {/* ── Mobile Apps ── */}
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.05)' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Smartphone style={{ width: 14, height: 14, color: '#334155' }} />
              <span style={{ color: '#1e293b', fontSize: 10, fontWeight: 800, letterSpacing: '0.25em', textTransform: 'uppercase' }}>Nossos Apps</span>
            </div>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.05)' }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
            {mobileApps.map((app) => (
              <a
                key={app.id}
                href={app.apkUrl}
                download
                style={{
                  position: 'relative', overflow: 'hidden', borderRadius: 20,
                  border: '1px solid rgba(255,255,255,0.07)',
                  minHeight: 160, display: 'block', textDecoration: 'none',
                  transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                  background: '#0a0f1e',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)';
                  (e.currentTarget as HTMLElement).style.boxShadow = `0 20px 50px ${app.color}18`;
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.transform = 'none';
                  (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                }}
              >
                <img src={app.bgImage} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.92), rgba(0,0,0,0.5) 60%, rgba(0,0,0,0.2))' }} />
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${app.color}80, transparent)` }} />

                {/* Android badge */}
                <div style={{ position: 'absolute', top: 12, right: 12, padding: '2px 8px', borderRadius: 999, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Android</span>
                </div>

                <div style={{ position: 'relative', zIndex: 10, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: 18 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <Smartphone style={{ width: 13, height: 13, color: 'rgba(255,255,255,0.4)' }} />
                    <h4 style={{ color: '#fff', fontWeight: 900, fontSize: 17, fontStyle: 'italic', letterSpacing: -0.3, textTransform: 'uppercase', margin: 0 }}>{app.name}</h4>
                  </div>
                  <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, margin: '0 0 14px' }}>{app.description}</p>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 10, background: `${app.color}cc`, width: 'fit-content', color: '#fff', fontWeight: 800, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    <Download style={{ width: 12, height: 12 }} />
                    Baixar APK
                  </div>
                </div>
              </a>
            ))}
          </div>

          {mobileApps.length === 0 && (
            <p style={{ textAlign: 'center', color: '#1e293b', fontSize: 12, fontWeight: 600, marginTop: 16 }}>Nenhum APK disponível.</p>
          )}
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: 64 }}>
          <p style={{ color: '#334155', fontSize: 10, fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase' }}>
            Varzea Prime — Plataforma Esportiva
          </p>
        </div>
      </main>

      {showMenu && <div style={{ position: 'fixed', inset: 0, zIndex: 30 }} onClick={() => setShowMenu(false)} />}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        button:focus { outline: none; }
        a:focus { outline: none; }
        @media (max-width: 640px) { .hidden-mobile { display: none; } }
      `}</style>
    </div>
  );
}