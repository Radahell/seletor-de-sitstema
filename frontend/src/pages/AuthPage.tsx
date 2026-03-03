import { AlertCircle, ArrowRight, CheckCircle, Lock, LogIn, Mail, User, UserPlus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api, { ApiError } from '../services/api';

type AuthMode = 'login' | 'register';

const S: Record<string, React.CSSProperties> = {
  root: { minHeight: '100vh', background: 'linear-gradient(160deg, #020617 0%, #0a0f1e 50%, #020617 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 16px', position: 'relative' },
  glow: { position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)', width: 700, height: 350, background: 'radial-gradient(ellipse at center top, rgba(245,158,11,0.08) 0%, transparent 70%)', pointerEvents: 'none' },
  wrap: { width: '100%', maxWidth: 440, position: 'relative', zIndex: 1 },
  logoArea: { textAlign: 'center', marginBottom: 32 },
  logo: { width: 72, height: 72, borderRadius: 20, margin: '0 auto 16px', boxShadow: '0 0 40px rgba(245,158,11,0.2)' },
  logoTitle: { color: '#f8fafc', fontWeight: 900, fontSize: 26, fontStyle: 'italic', letterSpacing: -1, textTransform: 'uppercase', margin: 0 },
  logoSub: { color: '#64748b', fontWeight: 700, fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', marginTop: 6 },
  card: { borderRadius: 28, border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(10,15,30,0.8)', padding: 28, backdropFilter: 'blur(20px)', boxShadow: '0 32px 80px rgba(0,0,0,0.5)' },
  tabs: { display: 'flex', gap: 8, marginBottom: 24 },
  tabActive: { flex: 1, padding: '11px 0', borderRadius: 14, fontWeight: 800, fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase' as const, border: 'none', cursor: 'pointer', background: '#f59e0b', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 },
  tabInactive: { flex: 1, padding: '11px 0', borderRadius: 14, fontWeight: 800, fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase' as const, border: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer', background: 'rgba(255,255,255,0.03)', color: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 },
  error: { marginBottom: 16, padding: '12px 14px', borderRadius: 14, background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', gap: 8, color: '#f87171', fontSize: 13 },
  label: { display: 'block', fontSize: 9, fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase' as const, color: '#475569', marginBottom: 6 },
  fieldWrap: { position: 'relative' as const, marginBottom: 0 },
  iconWrap: { position: 'absolute' as const, left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' as const, display: 'flex' },
  input: { width: '100%', paddingLeft: 44, paddingRight: 16, paddingTop: 12, paddingBottom: 12, borderRadius: 14, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', color: '#e2e8f0', fontSize: 14, outline: 'none', boxSizing: 'border-box' as const, transition: 'border-color 0.2s' },
  submitBtn: { width: '100%', padding: '14px 0', borderRadius: 16, background: 'linear-gradient(135deg, #f59e0b, #d97706)', border: 'none', color: '#000', fontWeight: 900, fontSize: 14, letterSpacing: '0.1em', textTransform: 'uppercase' as const, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 8px 32px rgba(245,158,11,0.25)', marginTop: 8 },
  submitBtnDisabled: { opacity: 0.5, cursor: 'not-allowed' },
  toggleText: { textAlign: 'center' as const, fontSize: 13, color: '#475569', marginTop: 20 },
  toggleBtn: { color: '#f59e0b', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13 },
  footer: { textAlign: 'center' as const, fontSize: 11, color: '#334155', marginTop: 20, fontWeight: 600 },
  fieldGroup: { display: 'flex', flexDirection: 'column' as const, gap: 10, marginBottom: 16 },
  registerHint: { textAlign: 'center' as const, fontSize: 12, color: '#64748b', marginBottom: 16, lineHeight: 1.5 },
};

function Field({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label style={S.label}>{icon}{label}</label>
      {children}
    </div>
  );
}

export default function AuthPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { login, register } = useAuth();

  const [mode, setMode] = useState<AuthMode>('login');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verifyMsg, setVerifyMsg] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  useEffect(() => {
    const token = searchParams.get('verify');
    if (!token) return;
    setSearchParams({}, { replace: true });
    api.verifyEmail(token)
      .then(() => setVerifyMsg('Email verificado com sucesso! Faça login para continuar.'))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Não foi possível verificar o email. O link pode ter expirado.'));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null); setIsLoading(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register({ name, email, password });
      }
      const joinIntent = localStorage.getItem('join_intent');
      if (joinIntent) { localStorage.removeItem('join_intent'); navigate(`/discover/${joinIntent}`); }
      else navigate('/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao processar. Tente novamente.');
    } finally { setIsLoading(false); }
  };

  return (
    <div style={S.root}>
      <div style={S.glow} />

      <div style={S.wrap}>
        {/* Logo */}
        <div style={S.logoArea}>
          <img src="/img/logo_vp.png" alt="Varzea Prime" style={S.logo} />
          <h1 style={S.logoTitle}>Varzea Prime</h1>
          <p style={S.logoSub}>Plataforma Esportiva</p>
        </div>

        {/* Card */}
        <div style={S.card}>

          {/* Tabs */}
          <div style={S.tabs}>
            <button style={mode === 'login' ? S.tabActive : S.tabInactive} onClick={() => { setMode('login'); setError(null); }}>
              <LogIn size={13} />
              Entrar
            </button>
            <button style={mode === 'register' ? S.tabActive : S.tabInactive} onClick={() => { setMode('register'); setError(null); }}>
              <UserPlus size={13} />
              Criar Conta
            </button>
          </div>

          {/* Register hint */}
          {mode === 'register' && (
            <p style={S.registerHint}>
              Crie sua conta em segundos. Depois vamos te guiar pelos nossos produtos.
            </p>
          )}

          {/* Verify success */}
          {verifyMsg && (
            <div style={{ marginBottom: 16, padding: '12px 14px', borderRadius: 14, background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.2)', display: 'flex', alignItems: 'center', gap: 8, color: '#4ade80', fontSize: 13 }}>
              <CheckCircle size={15} style={{ flexShrink: 0 }} />
              {verifyMsg}
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={S.error}>
              <AlertCircle size={15} style={{ flexShrink: 0 }} />
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit}>

            {mode === 'register' && (
              <div style={S.fieldGroup}>
                <Field label="Nome completo *">
                  <div style={S.fieldWrap}>
                    <span style={S.iconWrap}><User size={15} color="#475569" /></span>
                    <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Seu nome" required
                      style={S.input} onFocus={e => (e.target.style.borderColor = '#f59e0b')} onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.07)')} />
                  </div>
                </Field>
              </div>
            )}

            {/* Email */}
            <div style={{ marginBottom: 12 }}>
              <label style={S.label}>Email *</label>
              <div style={S.fieldWrap}>
                <span style={S.iconWrap}><Mail size={15} color="#475569" /></span>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" required
                  style={S.input} onFocus={e => (e.target.style.borderColor = '#f59e0b')} onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.07)')} />
              </div>
            </div>

            {/* Password */}
            <div style={{ marginBottom: 4 }}>
              <label style={S.label}>Senha *</label>
              <div style={S.fieldWrap}>
                <span style={S.iconWrap}><Lock size={15} color="#475569" /></span>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder={mode === 'register' ? 'Mínimo 6 caracteres' : '••••••••'} required
                  minLength={mode === 'register' ? 6 : undefined}
                  style={S.input} onFocus={e => (e.target.style.borderColor = '#f59e0b')} onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.07)')} />
              </div>
            </div>

            {/* Submit */}
            <button type="submit" disabled={isLoading} style={{ ...S.submitBtn, ...(isLoading ? S.submitBtnDisabled : {}) }}>
              {isLoading
                ? <div style={{ width: 18, height: 18, border: '2px solid rgba(0,0,0,0.3)', borderTopColor: '#000', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                : <>{mode === 'login' ? 'Entrar' : 'Criar Conta'}<ArrowRight size={16} /></>
              }
            </button>
          </form>

          {/* Toggle */}
          <p style={S.toggleText}>
            {mode === 'login' ? <>Não tem conta? <button style={S.toggleBtn} onClick={() => { setMode('register'); setError(null); }}>Criar agora</button></>
              : <>Já tem conta? <button style={S.toggleBtn} onClick={() => { setMode('login'); setError(null); }}>Fazer login</button></>}
          </p>
        </div>

        {/* Footer */}
        <p style={S.footer}>Ao continuar, você concorda com os Termos de Uso</p>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input::placeholder { color: #475569; }
        select option { background: #0a0f1e; color: #e2e8f0; }
        input:focus, select:focus { outline: none; }
        button:focus { outline: none; }
      `}</style>
    </div>
  );
}
