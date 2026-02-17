import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Trophy, Video, Building2, ArrowLeft, Search, ChevronRight,
  Plus, Loader2, Clock, MessageCircle, X
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
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
    searchLabel: 'Buscar campeonato para jogar',
    createLabel: 'Cadastrar novo campeonato',
    createDescription: 'Quer criar e gerenciar seu proprio campeonato? Entre em contato com nossa equipe para conhecer os planos e valores.',
  },
  quadra: {
    singular: 'quadra',
    plural: 'quadras',
    searchLabel: 'Buscar quadra',
    createLabel: 'Cadastrar minha quadra',
    createDescription: 'Quer gerenciar sua quadra esportiva com o Varzea Prime? Entre em contato para conhecer o sistema de gestao de quadras.',
  },
  lances: {
    singular: 'camera',
    plural: 'cameras',
    searchLabel: 'Buscar camera',
    createLabel: 'Contratar sistema de cameras',
    createDescription: 'Quer ter cameras profissionais gravando seus jogos? Fale com nossa equipe para saber mais.',
  },
};

const WHATSAPP_NUMBER = '5567992247898';

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
        if (!mySystem) {
          setSystemInfo({ displayName: availSystem.displayName, color: availSystem.color });
        }
        const myIds = new Set(mySystem?.tenants.map(t => t.id) || []);
        setAvailableTenants(availSystem.tenants.filter(t => !myIds.has(t.id)));
      }

      if (!mySystem && !availSystem) {
        const systems = await api.getSystems();
        const sys = systems.find(s => s.slug === slug);
        if (sys) {
          setSystemInfo({ displayName: sys.displayName, color: sys.color });
        }
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
    const msg = `Ola! Sou ${userName} e tenho interesse em cadastrar um novo ${labels.singular} no Varzea Prime (${systemName}). Gostaria de saber mais sobre planos e valores.`;
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
      <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin" style={{ color }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950">

      {/* Hero Header with background */}
      <div className="relative overflow-hidden">
        {bgImage && (
          <img src={bgImage} alt="" className="absolute inset-0 w-full h-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/80 to-zinc-950" />

        <div className="relative z-10 px-4 pt-6 pb-10 max-w-4xl mx-auto">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 text-zinc-300 hover:text-white transition-colors mb-8 text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </button>

          <div className="flex items-center gap-5">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center backdrop-blur-sm"
              style={{ backgroundColor: `${color}30` }}
            >
              <Icon className="w-8 h-8 text-white" strokeWidth={2} />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-black text-white uppercase italic tracking-tighter drop-shadow-lg">
                {systemInfo?.displayName || slug}
              </h1>
              <p className="text-zinc-300 text-sm">
                {myTenants.length > 0
                  ? `${myTenants.length} ${myTenants.length === 1 ? labels.singular : labels.plural}`
                  : `Nenhum ${labels.singular} inscrito`
                }
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pb-12 max-w-4xl mx-auto -mt-2">

        {/* My Tenants */}
        {myTenants.length > 0 && (
          <section className="mb-8">
            <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-500 mb-4">
              Meus {labels.plural}
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {myTenants.map((tenant) => (
                <button
                  key={tenant.id}
                  onClick={() => handleEnterTenant(tenant)}
                  className="group relative overflow-hidden p-6 rounded-2xl bg-zinc-800/50 border border-zinc-700/50 hover:border-zinc-600 hover:shadow-xl transition-all text-left"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div
                      className="w-14 h-14 rounded-xl flex items-center justify-center text-xl font-black text-white shadow-lg"
                      style={{ backgroundColor: tenant.primaryColor || color }}
                    >
                      {tenant.logoUrl ? (
                        <img src={tenant.logoUrl} alt="" className="w-full h-full object-cover rounded-xl" />
                      ) : (
                        tenant.displayName.charAt(0)
                      )}
                    </div>
                    <span className="text-[10px] font-bold uppercase px-2.5 py-1 rounded-lg bg-zinc-700 text-zinc-400">
                      {tenant.role || 'player'}
                    </span>
                  </div>

                  <h4 className="text-lg font-bold text-white group-hover:text-amber-400 transition-colors mb-1">
                    {tenant.displayName}
                  </h4>

                  <div className="flex items-center gap-1 text-sm text-zinc-500 group-hover:text-zinc-400">
                    Entrar
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </div>

                  <div
                    className="absolute bottom-0 left-0 right-0 h-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ backgroundColor: tenant.primaryColor || color }}
                  />
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          {/* Search existing */}
          <button
            onClick={() => setShowDiscover(!showDiscover)}
            className="group p-5 rounded-2xl border-2 border-dashed border-zinc-700 hover:border-zinc-500 transition-all flex items-center gap-4"
          >
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-all group-hover:scale-110"
              style={{ backgroundColor: `${color}20` }}
            >
              <Search className="w-5 h-5" style={{ color }} />
            </div>
            <div className="text-left">
              <p className="text-sm font-bold text-zinc-300 group-hover:text-white transition-colors">
                {labels.searchLabel}
              </p>
              <p className="text-xs text-zinc-600">
                Encontre e participe como jogador
              </p>
            </div>
          </button>

          {/* Create new (contact admin) */}
          <button
            onClick={() => setShowContactModal(true)}
            className="group p-5 rounded-2xl border-2 border-dashed border-amber-800/50 hover:border-amber-600/50 bg-amber-900/5 hover:bg-amber-900/10 transition-all flex items-center gap-4"
          >
            <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-amber-500/10 transition-all group-hover:scale-110">
              <Plus className="w-5 h-5 text-amber-500" />
            </div>
            <div className="text-left">
              <p className="text-sm font-bold text-amber-400 group-hover:text-amber-300 transition-colors">
                {labels.createLabel}
              </p>
              <p className="text-xs text-zinc-600">
                Fale com nossa equipe
              </p>
            </div>
          </button>
        </div>

        {/* Discover Section */}
        {showDiscover && (
          <section className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-500">
                {labels.plural} disponiveis
              </h3>
              <button
                onClick={() => setShowDiscover(false)}
                className="text-xs text-zinc-500 hover:text-white transition-colors"
              >
                Fechar
              </button>
            </div>

            {availableTenants.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {availableTenants.map((tenant) => (
                  <button
                    key={tenant.id}
                    onClick={() => navigate(`/discover/${tenant.slug}`)}
                    className="group p-6 rounded-2xl bg-zinc-800/30 border border-dashed border-zinc-700 hover:border-zinc-500 transition-all text-left"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div
                        className="w-14 h-14 rounded-xl flex items-center justify-center text-xl font-black text-white opacity-60"
                        style={{ backgroundColor: tenant.primaryColor || color }}
                      >
                        {tenant.displayName.charAt(0)}
                      </div>
                    </div>

                    <h4 className="text-lg font-bold text-zinc-400 group-hover:text-white transition-colors mb-1">
                      {tenant.displayName}
                    </h4>

                    <div className="flex items-center gap-1 text-sm" style={{ color }}>
                      <Plus className="w-4 h-4" />
                      Participar
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 rounded-2xl bg-zinc-800/20 border border-zinc-800">
                <Clock className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
                <p className="text-zinc-500 font-medium">
                  Nenhum {labels.singular} disponivel no momento
                </p>
              </div>
            )}
          </section>
        )}

        {/* Empty state */}
        {myTenants.length === 0 && !showDiscover && (
          <div className="text-center mt-2">
            <p className="text-zinc-600 text-sm">
              Use os botoes acima para encontrar {labels.plural} ou cadastrar o seu
            </p>
          </div>
        )}
      </div>

      {/* Contact Modal */}
      {showContactModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowContactModal(false)} />
          <div className="relative bg-zinc-900 border border-zinc-700 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <button
              onClick={() => setShowContactModal(false)}
              className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
                <MessageCircle className="w-8 h-8 text-amber-500" />
              </div>
              <h3 className="text-xl font-black text-white uppercase italic tracking-tight mb-2">
                {labels.createLabel}
              </h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                {labels.createDescription}
              </p>
            </div>

            <div className="space-y-3">
              <button
                onClick={handleContactWhatsApp}
                className="w-full px-4 py-3 rounded-xl bg-green-600 hover:bg-green-500 text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors"
              >
                <MessageCircle className="w-5 h-5" />
                Falar pelo WhatsApp
              </button>

              <p className="text-center text-zinc-600 text-xs">
                Ou envie um email para <span className="text-zinc-400">contato@varzeaprime.com.br</span>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
