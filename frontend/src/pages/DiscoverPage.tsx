import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Users, MapPin, Phone, Mail, Plus, Loader2, Check, Clock,
  Trophy, Video, Building2, Flag, ChevronRight
} from 'lucide-react';
import api, { TenantDetails, ApiError } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const SYSTEM_ICONS: Record<string, typeof Trophy> = {
  jogador: Trophy,
  lances: Video,
  quadra: Building2,
  arbitro: Flag,
};

const SYSTEM_BACKGROUNDS: Record<string, string> = {
  jogador: '/img/campeonato_bg.png',
  lances: '/img/lances_bg.png',
  quadra: '/img/gestao_bg.png',
};

export default function DiscoverPage() {
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();
  const { isAuthenticated, refreshUser } = useAuth();

  const [tenant, setTenant] = useState<TenantDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [joinStatus, setJoinStatus] = useState<'idle' | 'success' | 'pending' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (slug) {
      loadTenant();
    }
  }, [slug]);

  const loadTenant = async () => {
    setIsLoading(true);
    try {
      const response = await api.getTenantDetails(slug!);
      setTenant(response.tenant);
    } catch (err) {
      console.error('Error loading tenant:', err);
      setError('Sistema nao encontrado');
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!isAuthenticated) {
      localStorage.setItem('join_intent', slug!);
      navigate('/auth');
      return;
    }

    setIsJoining(true);
    setError(null);

    try {
      const response = await api.joinTenant(undefined, slug, message || undefined);

      if (response.status === 'pending') {
        setJoinStatus('pending');
      } else {
        setJoinStatus('success');
        await refreshUser();
      }
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          setJoinStatus('success');
        } else {
          setError(err.message);
          setJoinStatus('error');
        }
      } else {
        setError('Erro ao processar. Tente novamente.');
        setJoinStatus('error');
      }
    } finally {
      setIsJoining(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen vp-gradient flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
          <p className="text-zinc-600 text-sm">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="min-h-screen vp-gradient px-4 py-12">
        <div className="max-w-lg mx-auto text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
            <Flag className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-xl font-black text-white mb-2">Nao encontrado</h1>
          <p className="text-sm text-zinc-500 mb-6">Este sistema nao existe ou foi removido.</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="btn-ghost"
          >
            Voltar ao Dashboard
          </button>
        </div>
      </div>
    );
  }

  const Icon = SYSTEM_ICONS[tenant.system?.slug || ''] || Trophy;
  const systemColor = tenant.system?.color || tenant.primaryColor || '#ef4444';
  const bgImage = SYSTEM_BACKGROUNDS[tenant.system?.slug || ''];

  return (
    <div className="min-h-screen vp-gradient">
      {/* Hero banner */}
      <div className="relative overflow-hidden">
        {bgImage && (
          <>
            <img src={bgImage} alt="" className="absolute inset-0 w-full h-full object-cover" style={{ filter: 'blur(2px)' }} />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(2,6,23,0.6) 0%, rgba(2,6,23,0.9) 70%, #020617 100%)' }} />
          </>
        )}
        {!bgImage && (
          <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${systemColor}12 0%, transparent 60%)` }} />
        )}

        <div className="relative z-10 px-4 pt-5 pb-16 max-w-2xl mx-auto">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 text-zinc-500 hover:text-white transition-colors mb-8 text-sm group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            Voltar
          </button>

          {/* System badge */}
          <div className="flex items-center gap-2 mb-4">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: `${systemColor}20` }}
            >
              <Icon className="w-3.5 h-3.5" style={{ color: systemColor }} />
            </div>
            <span className="text-xs font-bold uppercase tracking-[0.15em]" style={{ color: `${systemColor}99` }}>
              {tenant.system?.displayName}
            </span>
          </div>

          {/* Logo + Title */}
          <div className="flex items-center gap-5">
            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-black text-white flex-shrink-0 overflow-hidden border-2"
              style={{ background: tenant.primaryColor || systemColor, borderColor: `${tenant.primaryColor || systemColor}60` }}
            >
              {tenant.logoUrl ? (
                <img src={tenant.logoUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                tenant.displayName.charAt(0)
              )}
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-white uppercase italic tracking-tight leading-tight">
                {tenant.displayName}
              </h1>
              <div className="flex items-center gap-3 mt-2">
                <div className="flex items-center gap-1.5 text-zinc-400 text-sm">
                  <Users className="w-4 h-4" />
                  <span className="font-semibold">{tenant.memberCount || 0}</span>
                  <span className="text-zinc-600">participantes</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pb-16 max-w-2xl mx-auto -mt-4 relative z-10">
        <div className="glass-card p-6 space-y-6">

          {/* Description */}
          {tenant.welcomeMessage && (
            <div>
              <p className="section-label mb-2">Sobre</p>
              <p className="text-sm text-zinc-300 leading-relaxed">
                {tenant.welcomeMessage}
              </p>
            </div>
          )}

          {/* Contact info */}
          {(tenant.address || tenant.phone || tenant.email) && (
            <div>
              <p className="section-label mb-3">Informacoes</p>
              <div className="space-y-2.5">
                {tenant.address && (
                  <div className="flex items-start gap-3 text-sm">
                    <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0 text-zinc-600" />
                    <span className="text-zinc-400">{tenant.address}{tenant.city && ` - ${tenant.city}/${tenant.state}`}</span>
                  </div>
                )}
                {tenant.phone && (
                  <div className="flex items-center gap-3 text-sm">
                    <Phone className="w-4 h-4 flex-shrink-0 text-zinc-600" />
                    <span className="text-zinc-400">{tenant.phone}</span>
                  </div>
                )}
                {tenant.email && (
                  <div className="flex items-center gap-3 text-sm">
                    <Mail className="w-4 h-4 flex-shrink-0 text-zinc-600" />
                    <span className="text-zinc-400">{tenant.email}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Divider */}
          <div className="h-px bg-white/[0.05]" />

          {/* Join section */}
          {joinStatus === 'idle' && (
            <div>
              {!tenant.allowRegistration && (
                <div className="mb-4">
                  <label className="section-label mb-2 block">
                    Mensagem (opcional)
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Conte um pouco sobre voce..."
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.07] text-white text-sm placeholder-zinc-600 focus:border-amber-500/50 focus:outline-none transition-colors resize-none"
                  />
                  <p className="text-[11px] text-zinc-600 mt-1.5">
                    Este sistema requer aprovacao do administrador
                  </p>
                </div>
              )}

              {error && (
                <div className="mb-4 p-3 rounded-xl bg-red-500/[0.07] border border-red-500/20 text-red-400 text-sm">
                  {error}
                </div>
              )}

              <button
                onClick={handleJoin}
                disabled={isJoining}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                {isJoining ? (
                  <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full" style={{ animation: 'spin 0.8s linear infinite' }} />
                ) : (
                  <>
                    {isAuthenticated ? (
                      <>Participar <ChevronRight className="w-4 h-4" /></>
                    ) : (
                      <>Fazer Login para Participar <ChevronRight className="w-4 h-4" /></>
                    )}
                  </>
                )}
              </button>
            </div>
          )}

          {joinStatus === 'success' && (
            <div className="text-center py-6">
              <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-green-400" />
              </div>
              <h3 className="text-lg font-black text-white mb-2">Voce entrou!</h3>
              <p className="text-sm text-zinc-500 mb-6">
                Agora voce faz parte do {tenant.displayName}
              </p>
              <button onClick={() => navigate('/dashboard')} className="btn-primary">
                Ir para o Dashboard <ChevronRight className="w-4 h-4 inline ml-1" />
              </button>
            </div>
          )}

          {joinStatus === 'pending' && (
            <div className="text-center py-6">
              <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-4">
                <Clock className="w-8 h-8 text-amber-400" />
              </div>
              <h3 className="text-lg font-black text-white mb-2">Solicitacao Enviada!</h3>
              <p className="text-sm text-zinc-500 mb-6">
                Aguarde a aprovacao do administrador
              </p>
              <button onClick={() => navigate('/dashboard')} className="btn-ghost">
                Voltar ao Dashboard
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
