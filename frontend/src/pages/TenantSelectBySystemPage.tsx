// frontend/src/pages/TenantSelectBySystemPage.tsx
/**
 * SELEÇÃO DE TENANT (Segunda tela)
 * Depois que o usuário escolheu o sistema,
 * ele escolhe qual instância/campeonato/quadra
 */

import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Trophy, Loader2, AlertCircle } from "lucide-react";

interface Tenant {
  id: number;
  slug: string;
  displayName: string;
  logoUrl: string | null;
  primaryColor: string;
  welcomeMessage: string | null;
  maintenanceMode: boolean;
}

export default function TenantSelectBySystemPage() {
  const navigate = useNavigate();
  const { systemSlug } = useParams<{ systemSlug: string }>();
  
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selecting, setSelecting] = useState<string | null>(null);
  const [systemName, setSystemName] = useState<string>("");

  useEffect(() => {
    loadTenants();
  }, [systemSlug]);

  const loadTenants = async () => {
    try {
      // Buscar tenants daquele sistema específico
      const response = await fetch(`/api/systems/${systemSlug}/tenants`);
      if (!response.ok) throw new Error('Erro ao carregar');
      
      const data = await response.json();
      setTenants(data.tenants);
      setSystemName(data.systemName);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  const selectTenant = async (slug: string) => {
    setSelecting(slug);
    setError(null);

    try {
      const response = await fetch('/api/tenants/select', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-System-Slug': systemSlug || ''
        },
        body: JSON.stringify({ slug }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erro ao selecionar');
      }

      const data = await response.json();
      
      // Salvar no localStorage
      localStorage.setItem('tenant_slug', slug);
      localStorage.setItem('system_slug', systemSlug || '');
      localStorage.setItem('tenant_theme', JSON.stringify(data.tenant.branding));
      
      // Redirecionar para login
      navigate('/login');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setSelecting(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-red-600 animate-spin mx-auto mb-4" />
          <p className="text-zinc-400 font-bold uppercase tracking-wider">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        
        {/* BOTÃO VOLTAR */}
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors mb-8 font-bold uppercase tracking-wider text-sm"
        >
          <ArrowLeft size={16} />
          Voltar aos Sistemas
        </button>

        {/* HEADER */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-red-600 to-red-700 mb-6 shadow-2xl">
            <Trophy className="w-10 h-10 text-white" fill="white" />
          </div>
          
          <h1 className="text-4xl md:text-6xl font-black text-white uppercase italic tracking-tighter mb-4">
            {systemName}
          </h1>
          
          <p className="text-zinc-400 font-bold uppercase tracking-wider text-sm">
            Escolha sua {systemSlug === 'jogador' ? 'competição' : systemSlug === 'quadra' ? 'quadra' : 'opção'}
          </p>
        </div>

        {/* ERROR */}
        {error && (
          <div className="max-w-2xl mx-auto mb-8 bg-red-900/20 border border-red-600/30 rounded-xl p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
            <p className="text-red-400 text-sm font-bold">{error}</p>
          </div>
        )}

        {/* GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tenants.map((tenant) => (
            <button
              key={tenant.id}
              onClick={() => !tenant.maintenanceMode && selectTenant(tenant.slug)}
              disabled={selecting !== null || tenant.maintenanceMode}
              className={`
                group relative overflow-hidden rounded-2xl border-2 p-8 text-left
                transition-all duration-300
                ${tenant.maintenanceMode 
                  ? 'border-zinc-800 bg-zinc-900/50 opacity-50 cursor-not-allowed' 
                  : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-700 hover:shadow-2xl hover:scale-105 cursor-pointer'
                }
                ${selecting === tenant.slug ? 'border-red-600 shadow-red-600/20' : ''}
              `}
              style={{
                borderColor: !tenant.maintenanceMode && selecting !== tenant.slug 
                  ? `${tenant.primaryColor}40` 
                  : undefined
              }}
            >
              {/* Glow */}
              <div 
                className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-500 blur-2xl"
                style={{ backgroundColor: tenant.primaryColor }}
              />

              {/* Content */}
              <div className="relative z-10">
                {/* Logo */}
                {tenant.logoUrl ? (
                  <div className="w-16 h-16 mb-6 rounded-xl overflow-hidden bg-zinc-800/50">
                    <img 
                      src={tenant.logoUrl} 
                      alt={tenant.displayName}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div 
                    className="w-16 h-16 mb-6 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: `${tenant.primaryColor}20` }}
                  >
                    <Trophy 
                      className="w-8 h-8" 
                      style={{ color: tenant.primaryColor }}
                      fill={tenant.primaryColor}
                    />
                  </div>
                )}

                {/* Nome */}
                <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter mb-2">
                  {tenant.displayName}
                </h3>

                {/* Mensagem */}
                {tenant.welcomeMessage && (
                  <p className="text-xs text-zinc-500 font-medium mb-4 line-clamp-2">
                    {tenant.welcomeMessage}
                  </p>
                )}

                {/* Status */}
                {tenant.maintenanceMode ? (
                  <p className="text-xs text-zinc-500 font-bold uppercase tracking-wider">
                    🔧 Em manutenção
                  </p>
                ) : selecting === tenant.slug ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" style={{ color: tenant.primaryColor }} />
                    <p className="text-xs font-bold uppercase tracking-wider" style={{ color: tenant.primaryColor }}>
                      Carregando...
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-zinc-500 font-bold uppercase tracking-wider flex items-center gap-2">
                    Clique para acessar
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                  </p>
                )}
              </div>

              {/* Accent */}
              <div 
                className="absolute bottom-0 left-0 right-0 h-1 opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ backgroundColor: tenant.primaryColor }}
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
