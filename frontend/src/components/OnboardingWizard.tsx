import { ArrowRight, Building2, Check, ChevronRight, Sparkles, Trophy, User, Video } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api, { type SystemInfo } from '../services/api';

interface ProductOption {
  systemSlug: string;
  icon: React.ReactNode;
  label: string;
  description: string;
  color: string;
  suboptions: { label: string; description: string }[];
}

const PLAYER_OPTIONS: ProductOption[] = [
  {
    systemSlug: 'jogador',
    icon: <Trophy size={22} />,
    label: 'Campeonatos',
    description: 'Participe de torneios de futebol amador',
    color: '#ef4444',
    suboptions: [
      { label: 'Participar de campeonato', description: 'Encontre torneios ativos pra jogar' },
      { label: 'Criar minha competicao', description: 'Organize seu proprio campeonato' },
    ],
  },
  {
    systemSlug: 'quadra',
    icon: <Building2 size={22} />,
    label: 'Quadras',
    description: 'Reserve quadras esportivas online',
    color: '#3b82f6',
    suboptions: [
      { label: 'Reservar uma quadra', description: 'Encontre horarios disponiveis' },
    ],
  },
  {
    systemSlug: 'lances',
    icon: <Video size={22} />,
    label: 'Lances de Ouro',
    description: 'Assista gravacoes dos seus jogos',
    color: '#f59e0b',
    suboptions: [
      { label: 'Ver meus videos', description: 'Reviva suas melhores jogadas' },
    ],
  },
];

const OWNER_OPTIONS: ProductOption[] = [
  {
    systemSlug: 'quadra',
    icon: <Building2 size={22} />,
    label: 'Gestao de Quadras',
    description: 'Gerencie reservas, vendas e horarios',
    color: '#3b82f6',
    suboptions: [
      { label: 'Cadastrar estabelecimento', description: 'Comece a receber reservas online' },
      { label: 'Gerenciar minha quadra', description: 'Acessar painel de controle' },
    ],
  },
  {
    systemSlug: 'lances',
    icon: <Video size={22} />,
    label: 'Cameras e Gravacoes',
    description: 'Configure cameras fixas nas suas quadras',
    color: '#f59e0b',
    suboptions: [
      { label: 'Configurar cameras', description: 'Vincule cameras IP as suas quadras' },
      { label: 'Gravar jogos', description: 'Grave automaticamente durante reservas' },
    ],
  },
];

type Step = 'welcome' | 'profile' | 'products' | 'done';
type ProfileType = 'player' | 'owner' | null;

export default function OnboardingWizard() {
  const { user, completeOnboarding, refreshUser } = useAuth();
  const [step, setStep] = useState<Step>('welcome');
  const [profileType, setProfileType] = useState<ProfileType>(null);
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [selectedInterests, setSelectedInterests] = useState<Set<string>>(new Set());
  const [systems, setSystems] = useState<SystemInfo[]>([]);
  const [saving, setSaving] = useState(false);

  const firstName = user?.name?.split(' ')[0] || 'Atleta';

  useEffect(() => {
    api.getSystems().then(setSystems).catch(() => {});
  }, []);

  const toggleProduct = (slug: string) => {
    setExpandedProduct(prev => prev === slug ? null : slug);
    setSelectedInterests(prev => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  const handleFinish = useCallback(async () => {
    setSaving(true);
    try {
      // Salvar interesses selecionados
      if (selectedInterests.size > 0 && systems.length > 0) {
        const systemIds = systems
          .filter(s => selectedInterests.has(s.slug))
          .map(s => s.id);
        if (systemIds.length > 0) {
          await api.updateMyInterests(systemIds);
        }
      }
      await completeOnboarding();
      await refreshUser();
    } catch {
      // Continua mesmo com erro
      await completeOnboarding().catch(() => {});
    } finally {
      setSaving(false);
    }
  }, [selectedInterests, systems, completeOnboarding, refreshUser]);

  const steps: Step[] = ['welcome', 'profile', 'products', 'done'];
  const currentIndex = steps.indexOf(step);

  const renderOptions = (options: ProductOption[]) => (
    <div className="flex flex-col gap-3">
      {options.map(opt => {
        const isExpanded = expandedProduct === opt.systemSlug;
        const isSelected = selectedInterests.has(opt.systemSlug);
        return (
          <div key={opt.systemSlug}>
            <button
              type="button"
              onClick={() => toggleProduct(opt.systemSlug)}
              className="w-full text-left p-4 rounded-2xl border transition-all duration-200"
              style={{
                background: isSelected ? `${opt.color}10` : 'rgba(255,255,255,0.02)',
                borderColor: isSelected ? `${opt.color}40` : 'rgba(255,255,255,0.07)',
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: `${opt.color}20`, color: opt.color }}
                >
                  {opt.icon}
                </div>
                <div className="flex-1">
                  <div className="font-bold text-sm text-zinc-100">{opt.label}</div>
                  <div className="text-xs text-zinc-500 mt-0.5">{opt.description}</div>
                </div>
                <ChevronRight
                  size={16}
                  className="text-zinc-600 transition-transform duration-200"
                  style={{ transform: isExpanded ? 'rotate(90deg)' : 'none' }}
                />
              </div>
            </button>

            {/* Suboptions */}
            {isExpanded && (
              <div className="ml-12 mt-2 flex flex-col gap-1.5 animate-fade-in">
                {opt.suboptions.map((sub, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.02]">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: opt.color }} />
                    <div>
                      <div className="text-xs font-semibold text-zinc-300">{sub.label}</div>
                      <div className="text-[11px] text-zinc-600">{sub.description}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="min-h-screen vp-gradient flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg relative">

        {/* Step indicators */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {steps.map((s, i) => (
            <div
              key={s}
              className={`wizard-step rounded-full transition-all duration-300 ${
                i === currentIndex ? 'wizard-step-active w-8 h-2.5' :
                i < currentIndex ? 'wizard-step-done' : 'wizard-step-pending'
              }`}
            />
          ))}
        </div>

        {/* Step: Welcome */}
        {step === 'welcome' && (
          <div className="glass-card p-8 text-center animate-fade-in">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl overflow-hidden shadow-lg" style={{ animation: 'pulse-glow 3s ease-in-out infinite' }}>
              <img src="/img/logo_vp.png" alt="VP" className="w-full h-full object-cover" />
            </div>
            <h1 className="text-2xl font-black italic text-zinc-100 mb-2">
              Bem-vindo, {firstName}!
            </h1>
            <p className="text-sm text-zinc-500 mb-8 leading-relaxed">
              O Varzea Prime conecta jogadores, quadras e gravacoes.<br />
              Vamos personalizar sua experiencia.
            </p>
            <button onClick={() => setStep('profile')} className="btn-primary w-full flex items-center justify-center gap-2">
              Comecar <ArrowRight size={16} />
            </button>
          </div>
        )}

        {/* Step: Profile Type */}
        {step === 'profile' && (
          <div className="glass-card p-8 animate-slide-up">
            <h2 className="text-lg font-black text-zinc-100 mb-1 text-center">Como voce vai usar?</h2>
            <p className="text-xs text-zinc-500 mb-6 text-center">Isso personaliza sua experiencia. Voce pode mudar depois.</p>

            <div className="flex flex-col gap-3 mb-6">
              <button
                type="button"
                onClick={() => { setProfileType('player'); setStep('products'); }}
                className="w-full p-5 rounded-2xl border text-left transition-all duration-200 hover:-translate-y-0.5"
                style={{
                  background: profileType === 'player' ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.02)',
                  borderColor: profileType === 'player' ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.07)',
                }}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center text-red-400">
                    <User size={24} />
                  </div>
                  <div>
                    <div className="font-bold text-zinc-100">Sou Jogador</div>
                    <div className="text-xs text-zinc-500 mt-1">Quero jogar, reservar quadras e ver meus lances</div>
                  </div>
                  <ChevronRight size={18} className="text-zinc-600 ml-auto" />
                </div>
              </button>

              <button
                type="button"
                onClick={() => { setProfileType('owner'); setStep('products'); }}
                className="w-full p-5 rounded-2xl border text-left transition-all duration-200 hover:-translate-y-0.5"
                style={{
                  background: profileType === 'owner' ? 'rgba(245,158,11,0.08)' : 'rgba(255,255,255,0.02)',
                  borderColor: profileType === 'owner' ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.07)',
                }}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-400">
                    <Building2 size={24} />
                  </div>
                  <div>
                    <div className="font-bold text-zinc-100">Sou Dono de Estabelecimento</div>
                    <div className="text-xs text-zinc-500 mt-1">Quero gerenciar quadras, vendas e cameras</div>
                  </div>
                  <ChevronRight size={18} className="text-zinc-600 ml-auto" />
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Step: Products */}
        {step === 'products' && (
          <div className="glass-card p-8 animate-slide-up">
            <h2 className="text-lg font-black text-zinc-100 mb-1 text-center">
              {profileType === 'player' ? 'O que te interessa?' : 'O que voce precisa?'}
            </h2>
            <p className="text-xs text-zinc-500 mb-6 text-center">
              Selecione os produtos que quer explorar. Clique para ver detalhes.
            </p>

            {renderOptions(profileType === 'owner' ? OWNER_OPTIONS : PLAYER_OPTIONS)}

            <div className="flex gap-3 mt-6">
              <button onClick={() => setStep('profile')} className="btn-ghost flex-1">
                Voltar
              </button>
              <button onClick={() => setStep('done')} className="btn-primary flex-1 flex items-center justify-center gap-2">
                Continuar <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Step: Done */}
        {step === 'done' && (
          <div className="glass-card p-8 text-center animate-slide-up">
            <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-green-500/20 flex items-center justify-center">
              <Check size={32} className="text-green-400" />
            </div>
            <h2 className="text-xl font-black text-zinc-100 mb-2">Tudo pronto!</h2>
            <p className="text-sm text-zinc-500 mb-6 leading-relaxed">
              Sua conta esta configurada. Explore os produtos e comece a usar o Varzea Prime.
            </p>

            {selectedInterests.size > 0 && (
              <div className="flex flex-wrap justify-center gap-2 mb-6">
                {Array.from(selectedInterests).map(slug => {
                  const opt = [...PLAYER_OPTIONS, ...OWNER_OPTIONS].find(o => o.systemSlug === slug);
                  if (!opt) return null;
                  return (
                    <span key={slug} className="badge text-zinc-300" style={{ background: `${opt.color}15`, border: `1px solid ${opt.color}30` }}>
                      <Sparkles size={10} style={{ color: opt.color }} />
                      {opt.label}
                    </span>
                  );
                })}
              </div>
            )}

            <button
              onClick={handleFinish}
              disabled={saving}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {saving ? (
                <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full" style={{ animation: 'spin 0.8s linear infinite' }} />
              ) : (
                <>Ir para o Dashboard <ArrowRight size={16} /></>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
