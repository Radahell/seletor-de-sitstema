import {
  ArrowLeft,
  Building2,
  Camera,
  ChevronRight,
  Clock,
  Loader2,
  MessageCircle,
  Plus,
  Search,
  Trophy, Video,
  X
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import HintTooltip from '../components/HintTooltip';
import api, { SystemWithTenants, TenantInfo } from '../services/api';

const SYSTEM_ICONS: Record<string, typeof Trophy> = {
  jogador: Trophy,
  lances: Video,
  quadra: Building2,
};

const SYSTEM_BACKGROUNDS: Record<string, string> = {
  jogador: '/img/campeonato_bg.png',
  lances: '/img/lances_bg.png',
  quadra: '/img/gestao_bg.png',
};

const SYSTEM_TAGLINES: Record<string, string> = {
  jogador: 'Organize torneios, gerencie times e acompanhe resultados em tempo real',
  quadra: 'Reserve quadras, gerencie horarios e controle seu espaco esportivo',
  lances: 'Grave seus jogos com cameras profissionais e reviva suas melhores jogadas',
};

interface GuidedAction {
  icon: React.ReactNode;
  label: string;
  description: string;
  color: string;
  onClick: () => void;
}

const SYSTEM_LABELS: Record<string, {
  singular: string;
  plural: string;
  searchLabel: string;
  createLabel: string;
  createDescription: string;
}> = {
  jogador: {
    singular: 'campeonato',
    plural: 'campeonatos',
    searchLabel: 'Encontrar campeonato',
    createLabel: 'Criar meu campeonato',
    createDescription: 'Quer criar e gerenciar seu proprio campeonato? Entre em contato com nossa equipe para conhecer os planos e valores.',
  },
  quadra: {
    singular: 'quadra',
    plural: 'quadras',
    searchLabel: 'Reservar uma quadra',
    createLabel: 'Cadastrar meu estabelecimento',
    createDescription: 'Quer gerenciar sua quadra esportiva com o Varzea Prime? Entre em contato para conhecer o sistema de gestao de quadras.',
  },
  lances: {
    singular: 'câmera',
    plural: 'câmeras',
    searchLabel: 'Ver gravacoes',
    createLabel: 'Contratar cameras',
    createDescription: 'Quer ter cameras profissionais gravando seus jogos? Fale com nossa equipe para saber mais.',
  },
};

const WHATSAPP_NUMBER = '5567992247898';

function getGuidedActions(
  systemSlug: string,
  color: string,
  onDiscover: () => void,
  onContact: () => void,
): GuidedAction[] {
  switch (systemSlug) {
    case 'jogador':
      return [
        {
          icon: <Search className="w-4 h-4" style={{ color }} />,
          label: 'Encontrar campeonato',
          description: 'Veja torneios disponiveis e participe como jogador',
          color,
          onClick: onDiscover,
        },
        {
          icon: <Plus className="w-4 h-4 text-amber-400" />,
          label: 'Criar meu campeonato',
          description: 'Organize seu proprio torneio e gerencie times',
          color: '#f59e0b',
          onClick: onContact,
        },
      ];
    case 'quadra':
      return [
        {
          icon: <Search className="w-4 h-4" style={{ color }} />,
          label: 'Reservar uma quadra',
          description: 'Encontre horarios disponiveis e reserve online',
          color,
          onClick: onDiscover,
        },
        {
          icon: <Building2 className="w-4 h-4 text-amber-400" />,
          label: 'Cadastrar meu estabelecimento',
          description: 'Gerencie reservas, vendas e horarios da sua quadra',
          color: '#f59e0b',
          onClick: onContact,
        },
      ];
    case 'lances':
      return [
        {
          icon: <Video className="w-4 h-4" style={{ color }} />,
          label: 'Ver gravacoes',
          description: 'Assista aos videos dos seus jogos e melhores lances',
          color,
          onClick: onDiscover,
        },
        {
          icon: <Camera className="w-4 h-4 text-amber-400" />,
          label: 'Contratar cameras',
          description: 'Configure cameras profissionais nas suas quadras',
          color: '#f59e0b',
          onClick: onContact,
        },
      ];
    default:
      return [
        {
          icon: <Search className="w-4 h-4" style={{ color }} />,
          label: 'Explorar',
          description: 'Veja o que esta disponivel',
          color,
          onClick: onDiscover,
        },
        {
          icon: <Plus className="w-4 h-4 text-amber-400" />,
          label: 'Cadastrar',
          description: 'Fale com nossa equipe',
          color: '#f59e0b',
          onClick: onContact,
        },
      ];
  }
}

export default function SystemAreaPage() {
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();

  const [myTenants, setMyTenants] = useState<TenantInfo[]>([]);
  const [availableTenants, setAvailableTenants] = useState<TenantInfo[]>([]);
  const [systemInfo, setSystemInfo] = useState<{ displayName: string; color: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showDiscover, setShowDiscover] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);

  useEffect(() => {
    if (slug) loadData();
  }, [slug]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [myData, availableData] = await Promise.all([
        api.getMyTenants().catch(() => ({ systems: [] as SystemWithTenants[], total: 0 })),
        api.getAvailableTenants(slug),
      ]);

      const mySystem = myData.systems.find(s => s.slug === slug);
      const availSystem = availableData.systems.find(s => s.slug === slug);

      if (mySystem) {
        setSystemInfo({ displayName: mySystem.displayName, color: mySystem.color });
        setMyTenants(mySystem.tenants);
      }

      if (availSystem) {
        if (!mySystem) setSystemInfo({ displayName: availSystem.displayName, color: availSystem.color });
        const myIds = new Set(mySystem?.tenants.map(t => t.id) || []);
        setAvailableTenants(availSystem.tenants.filter(t => !myIds.has(t.id)));
      }

      if (!mySystem && !availSystem) {
        const systems = await api.getSystems();
        const sys = systems.find(s => s.slug === slug);
        if (sys) setSystemInfo({ displayName: sys.displayName, color: sys.color });
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEnterTenant = (tenant: TenantInfo) => {
    localStorage.setItem('current_tenant', JSON.stringify(tenant));
    localStorage.setItem('tenant_slug', tenant.slug);
    localStorage.setItem('system_slug', slug || '');
    if (tenant.primaryColor) {
      localStorage.setItem('tenant_theme', JSON.stringify({ primaryColor: tenant.primaryColor }));
    }
    const hubToken = localStorage.getItem('auth_token') || '';
    if (slug === 'lances') {
      navigate('/lances');
    } else {
      const baseUrl = `/${slug}/${tenant.slug}`;
      const separator = baseUrl.includes('?') ? '&' : '?';
      window.location.href = `${baseUrl}${separator}hub_token=${encodeURIComponent(hubToken)}&tenant=${encodeURIComponent(tenant.slug)}&role=${encodeURIComponent(tenant.role || 'player')}`;
    }
  };

  const handleContactWhatsApp = () => {
    const systemName = systemInfo?.displayName || slug;
    const userName = user?.name || '';
    const msg = `Olá! Sou ${userName} e tenho interesse em cadastrar um novo ${labels.singular} no Varzea Prime (${systemName}). Gostaria de saber mais sobre planos e valores.`;
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const Icon = SYSTEM_ICONS[slug || ''] || Trophy;
  const labels = SYSTEM_LABELS[slug || ''] || {
    singular: 'item', plural: 'itens', searchLabel: 'Pesquisar',
    createLabel: 'Cadastrar novo', createDescription: 'Entre em contato com a equipe.',
  };
  const color = systemInfo?.color || '#ef4444';
  const bgImage = SYSTEM_BACKGROUNDS[slug || ''];

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#09090f' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center border border-white/5" style={{ background: 'rgba(255,255,255,0.03)' }}>
            <Loader2 className="w-6 h-6 animate-spin" style={{ color }} />
          </div>
          <p className="text-zinc-600 text-sm">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(160deg, #09090f 0%, #0d0d16 100%)' }}>
      {/* Ambient glow from system color */}
      <div
        className="fixed top-0 left-0 right-0 h-[50vh] pointer-events-none"
        style={{ background: `radial-gradient(ellipse at 30% top, ${color}08 0%, transparent 65%)` }}
      />

      {/* ── Hero ── */}
      <div className="relative overflow-hidden">
        {bgImage && (
          <>
            <img src={bgImage} alt="" className="absolute inset-0 w-full h-full object-cover scale-105" style={{ filter: 'blur(1px)' }} />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(9,9,15,0.55) 0%, rgba(9,9,15,0.85) 60%, #09090f 100%)' }} />
          </>
        )}
        {!bgImage && (
          <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${color}12 0%, transparent 60%)` }} />
        )}

        <div className="relative z-10 px-4 pt-5 pb-12 max-w-4xl mx-auto">
          {/* Back */}
          <button
            onClick={() => navigate('/dashboard')}
            className="inline-flex items-center gap-2 text-zinc-500 hover:text-white transition-colors mb-10 text-sm group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            Voltar
          </button>

          {/* Title row */}
          <div className="flex items-end gap-5">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0 border"
              style={{
                background: `linear-gradient(135deg, ${color}25, ${color}10)`,
                borderColor: `${color}30`,
                boxShadow: `0 0 40px ${color}20`,
              }}
            >
              <Icon className="w-8 h-8 text-white" strokeWidth={1.5} />
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.2em] mb-1" style={{ color: `${color}99` }}>
                {myTenants.length > 0
                  ? `${myTenants.length} ${myTenants.length === 1 ? labels.singular : labels.plural}`
                  : `Nenhum ${labels.singular} inscrito`}
              </p>
              <h1 className="text-3xl md:text-4xl font-black text-white uppercase italic tracking-tighter leading-none drop-shadow-2xl">
                {systemInfo?.displayName || slug}
              </h1>
              {SYSTEM_TAGLINES[slug || ''] && (
                <p className="text-sm text-zinc-400 mt-2 leading-relaxed max-w-md">
                  {SYSTEM_TAGLINES[slug || '']}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Content ── */}
      <div className="px-4 pb-16 max-w-4xl mx-auto -mt-4 relative z-10">

        {/* My Tenants */}
        {myTenants.length > 0 && (
          <section className="mb-8">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600 mb-4">
              Meus {labels.plural}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {myTenants.map((tenant) => (
                <button
                  key={tenant.id}
                  onClick={() => handleEnterTenant(tenant)}
                  className="group relative overflow-hidden rounded-2xl border text-left transition-all duration-300 hover:-translate-y-0.5"
                  style={{
                    background: 'rgba(255,255,255,0.025)',
                    borderColor: 'rgba(255,255,255,0.07)',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = `${tenant.primaryColor || color}40`;
                    (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 32px ${tenant.primaryColor || color}12`;
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.07)';
                    (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                  }}
                >
                  {/* Top accent line on hover */}
                  <div
                    className="absolute top-0 left-0 right-0 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                    style={{ background: `linear-gradient(90deg, transparent, ${tenant.primaryColor || color}, transparent)` }}
                  />

                  <div className="p-5 flex items-center gap-4">
                    {/* Logo / Initial */}
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-black text-white flex-shrink-0 overflow-hidden"
                      style={{ background: tenant.primaryColor || color }}
                    >
                      {tenant.logoUrl ? (
                        <img src={tenant.logoUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        tenant.displayName.charAt(0)
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-white text-sm leading-tight truncate">
                        {tenant.displayName}
                      </h4>
                      <span
                        className="text-[10px] font-bold uppercase tracking-widest mt-1 inline-block px-1.5 py-0.5 rounded-md"
                        style={{ color: `${tenant.primaryColor || color}cc`, background: `${tenant.primaryColor || color}15` }}
                      >
                        {tenant.role || 'player'}
                      </span>
                    </div>

                    {/* Arrow */}
                    <ChevronRight className="w-4 h-4 flex-shrink-0 text-zinc-700 group-hover:text-zinc-400 group-hover:translate-x-0.5 transition-all" />
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* ── Guided Actions ── */}
        <section className="mb-8">
          <p className="section-label mb-4">O que voce quer fazer?</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {getGuidedActions(slug || '', color, () => setShowDiscover(!showDiscover), () => setShowContactModal(true)).map((action, i) => (
              <button
                key={i}
                onClick={action.onClick}
                className="group p-5 rounded-2xl border border-dashed text-left transition-all duration-300 hover:-translate-y-0.5"
                style={{
                  background: `rgba(255,255,255,0.02)`,
                  borderColor: 'rgba(255,255,255,0.08)',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = `${action.color}40`;
                  (e.currentTarget as HTMLElement).style.background = `${action.color}06`;
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)';
                  (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)';
                }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110"
                  style={{ background: `${action.color}15`, border: `1px solid ${action.color}20` }}
                >
                  {action.icon}
                </div>
                <p className="text-sm font-bold text-white mb-1">{action.label}</p>
                <p className="text-xs text-zinc-500">{action.description}</p>
              </button>
            ))}
          </div>
          <HintTooltip id={`system-${slug}-actions`} text={`Escolha uma acao para explorar os ${labels.plural} disponiveis ou cadastrar o seu.`} />
        </section>

        {/* ── Discover Section ── */}
        {showDiscover && (
          <section className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600">
                {labels.plural} disponíveis
              </p>
              <button
                onClick={() => setShowDiscover(false)}
                className="text-xs text-zinc-600 hover:text-zinc-300 transition-colors flex items-center gap-1"
              >
                <X className="w-3 h-3" />
                Fechar
              </button>
            </div>

            {availableTenants.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {availableTenants.map((tenant) => (
                  <button
                    key={tenant.id}
                    onClick={() => navigate(`/discover/${tenant.slug}`)}
                    className="group p-4 rounded-2xl border border-dashed border-white/6 hover:border-white/12 text-left transition-all"
                    style={{ background: 'rgba(255,255,255,0.015)' }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-base font-black text-white/70 flex-shrink-0"
                        style={{ background: `${tenant.primaryColor || color}25` }}
                      >
                        {tenant.displayName.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-bold text-zinc-400 group-hover:text-white transition-colors truncate">
                          {tenant.displayName}
                        </h4>
                        <span className="text-xs flex items-center gap-1 mt-0.5" style={{ color }}>
                          <Plus className="w-3 h-3" />
                          Participar
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 rounded-2xl border border-dashed border-white/5" style={{ background: 'rgba(255,255,255,0.01)' }}>
                <Clock className="w-8 h-8 text-zinc-800 mx-auto mb-3" />
                <p className="text-zinc-600 text-sm">Nenhum {labels.singular} disponível no momento</p>
              </div>
            )}
          </section>
        )}

        {/* Empty state */}
        {myTenants.length === 0 && !showDiscover && (
          <div className="text-center py-12 rounded-2xl border border-dashed border-white/5" style={{ background: 'rgba(255,255,255,0.01)' }}>
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: `${color}10`, border: `1px solid ${color}20` }}
            >
              <Icon className="w-8 h-8" style={{ color: `${color}60` }} />
            </div>
            <h3 className="text-lg font-bold text-zinc-300 mb-2">
              Comece sua jornada
            </h3>
            <p className="text-sm text-zinc-600 max-w-sm mx-auto">
              Voce ainda nao esta em nenhum {labels.singular}. Use as opcoes acima para explorar ou cadastrar o seu.
            </p>
          </div>
        )}
      </div>

      {/* ── Contact Modal ── */}
      {showContactModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <div
            className="absolute inset-0 backdrop-blur-sm"
            style={{ background: 'rgba(0,0,0,0.75)' }}
            onClick={() => setShowContactModal(false)}
          />
          <div
            className="relative w-full max-w-sm rounded-3xl border border-white/8 p-6 shadow-2xl"
            style={{ background: 'linear-gradient(160deg, #111118, #0d0d14)' }}
          >
            <button
              onClick={() => setShowContactModal(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-xl flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/5 transition-all"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="text-center mb-6">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-4">
                <MessageCircle className="w-7 h-7 text-amber-400" />
              </div>
              <h3 className="text-lg font-black text-white uppercase italic tracking-tight mb-2">
                {labels.createLabel}
              </h3>
              <p className="text-sm text-zinc-500 leading-relaxed">
                {labels.createDescription}
              </p>
            </div>

            <button
              onClick={handleContactWhatsApp}
              className="w-full py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 text-white transition-all hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)', boxShadow: '0 4px 20px rgba(22,163,74,0.25)' }}
            >
              <MessageCircle className="w-4 h-4" />
              Falar pelo WhatsApp
            </button>

            <p className="text-center text-zinc-700 text-xs mt-4">
              Ou envie um e-mail para{' '}
              <span className="text-zinc-500">contato@varzeaprime.com.br</span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}