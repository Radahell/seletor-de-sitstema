// frontend/src/pages/SystemSelectPage.tsx
/**
 * SELEÇÃO DE SISTEMA (Primeira tela)
 * Usuário escolhe qual sistema quer acessar:
 * - Jogador (Campeonatos)
 * - Quadra (Gestão de Quadras)
 * - Árbitro (Sistema de Árbitros)
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Trophy, Building , Loader2, AlertCircle } from "lucide-react";




interface System {
  id: number;
  slug: string;
  displayName: string;
  description: string;
  iconName: string;
  primaryColor: string;
  baseUrl: string;
  isActive: boolean;
}

const iconMap: Record<string, any> = {
  trophy: Trophy,
  building: Building,

};

export default function SystemSelectPage() {
  const navigate = useNavigate();
  const [systems, setSystems] = useState<System[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSystems();
  }, []);

  const loadSystems = async () => {
    try {
      const response = await fetch('/api/systems');
      if (!response.ok) throw new Error('Erro ao carregar sistemas');
      
      const data = await response.json();
      setSystems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  const selectSystem = (system: System) => {
    // Salvar sistema selecionado
    localStorage.setItem('selected_system', system.slug);
    
    // Redirecionar para seleção de tenant daquele sistema
    navigate(`/select-tenant/${system.slug}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-red-600 animate-spin mx-auto mb-4" />
          <p className="text-zinc-400 font-bold uppercase tracking-wider">Carregando sistemas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        
        {/* HEADER */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-red-600 to-red-700 mb-6 shadow-2xl">
            <div className="text-5xl">⚡</div>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-black text-white uppercase italic tracking-tighter mb-4">
            Várzea Prime
          </h1>
          
          <p className="text-zinc-400 font-bold uppercase tracking-wider text-sm">
            Escolha o sistema que deseja acessar
          </p>
        </div>

        {/* ERROR */}
        {error && (
          <div className="max-w-2xl mx-auto mb-8 bg-red-900/20 border border-red-600/30 rounded-xl p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
            <p className="text-red-400 text-sm font-bold">{error}</p>
          </div>
        )}

        {/* GRID DE SISTEMAS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {systems.map((system) => {
            const Icon = iconMap[system.iconName] || Trophy;
            
            return (
              <button
                key={system.id}
                onClick={() => selectSystem(system)}
                disabled={!system.isActive}
                className={`
                  group relative overflow-hidden rounded-3xl p-10 text-left
                  transition-all duration-500 border-2
                  ${system.isActive 
                    ? 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-700 hover:shadow-2xl hover:scale-105 cursor-pointer' 
                    : 'border-zinc-800 bg-zinc-900/30 opacity-50 cursor-not-allowed'
                  }
                `}
              >
                {/* Glow Effect */}
                <div 
                  className="absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity duration-700 blur-3xl"
                  style={{ backgroundColor: system.primaryColor }}
                />

                {/* Content */}
                <div className="relative z-10">
                  {/* Icon */}
                  <div 
                    className="w-20 h-20 mb-6 rounded-2xl flex items-center justify-center
                               transition-all duration-300 group-hover:scale-110"
                    style={{ backgroundColor: `${system.primaryColor}20` }}
                  >
                    <Icon 
                      className="w-10 h-10 transition-transform duration-300 group-hover:rotate-12" 
                      style={{ color: system.primaryColor }}
                      strokeWidth={2}
                    />
                  </div>

                  {/* Nome */}
                  <h3 className="text-3xl font-black text-white uppercase italic tracking-tighter mb-3">
                    {system.displayName}
                  </h3>

                  {/* Descrição */}
                  <p className="text-sm text-zinc-400 font-medium leading-relaxed mb-6">
                    {system.description}
                  </p>

                  {/* CTA */}
                  {system.isActive ? (
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider" 
                         style={{ color: system.primaryColor }}>
                      <span>Acessar</span>
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                    </div>
                  ) : (
                    <div className="text-xs text-zinc-600 font-bold uppercase tracking-wider">
                      🔒 Em breve
                    </div>
                  )}
                </div>

                {/* Accent Border */}
                <div 
                  className="absolute bottom-0 left-0 right-0 h-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ backgroundColor: system.primaryColor }}
                />
              </button>
            );
          })}
        </div>

        {/* FOOTER */}
        <div className="text-center mt-16">
          <p className="text-zinc-600 text-xs font-bold uppercase tracking-wider">
            Sistema Integrado de Gestão Esportiva
          </p>
        </div>
      </div>
    </div>
  );
}
