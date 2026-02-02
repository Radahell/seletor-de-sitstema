import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, ShieldCheck, ArrowLeft } from 'lucide-react';

export default function LoginPage() {
  const navigate = useNavigate();

  const system = useMemo(() => localStorage.getItem('system_slug') || '—', []);
  const tenant = useMemo(() => localStorage.getItem('tenant_slug') || '—', []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 px-4 py-12">
      <div className="max-w-lg mx-auto">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors mb-8 font-bold uppercase tracking-wider text-sm"
        >
          <ArrowLeft size={16} />
          Voltar
        </button>

        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/50 p-8 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-zinc-950/60 border border-zinc-800 flex items-center justify-center mb-6">
            <ShieldCheck className="w-8 h-8" style={{ color: 'var(--tenant-primary, #ef4444)' }} />
          </div>

          <h1 className="text-3xl md:text-4xl font-black text-white uppercase italic tracking-tighter mb-2">
            Login
          </h1>

          <p className="text-zinc-400 text-sm font-medium mb-8">
            Tela placeholder. Aqui você conecta o login real do seu sistema.
          </p>

          <div className="space-y-2 mb-8">
            <div className="text-xs font-bold uppercase tracking-wider text-zinc-500">Sistema</div>
            <div className="text-zinc-200 font-bold">{system}</div>
            <div className="text-xs font-bold uppercase tracking-wider text-zinc-500 mt-4">Tenant</div>
            <div className="text-zinc-200 font-bold">{tenant}</div>
          </div>

          <button
            onClick={() => alert('Implementar login real aqui')}
            className="w-full rounded-2xl px-5 py-4 font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all hover:scale-[1.02]"
            style={{ backgroundColor: 'var(--tenant-primary, #ef4444)', color: '#0b0b0f' }}
          >
            <LogIn size={18} />
            Entrar
          </button>

          <p className="text-[11px] text-zinc-500 mt-6">
            Dica: o backend devolve o branding no /api/tenants/select e você pode aplicar isso em CSS variables.
          </p>
        </div>
      </div>
    </div>
  );
}
