import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { fetchDashboardMetrics, type DashboardMetrics } from '../../services/adminApi';

export default function AdminDashboardPage() {
  const [metrics, setMetrics] = useState<Record<string, any> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardMetrics()
      .then((data) => setMetrics(data as any))
      .catch((err) => setError(err.message || 'Nao foi possivel carregar as metricas.'))
      .finally(() => setLoading(false));
  }, []);

  const managersChart = useMemo(() => {
    if (!metrics?.managers_by_client) return [];
    const max = Math.max(...metrics.managers_by_client.map((i: any) => i.managers || 0), 1);
    return metrics.managers_by_client.map((i: any) => ({
      ...i,
      pct: Math.round(((i.managers || 0) / max) * 100),
    }));
  }, [metrics]);

  const loginTrend = useMemo(() => {
    if (!metrics?.engagement?.login_trend) return [];
    const max = Math.max(...metrics.engagement.login_trend.map((i: any) => i.logins || 0), 1);
    return metrics.engagement.login_trend.map((i: any) => ({
      ...i,
      label: new Date(`${i.month}-01T00:00:00Z`).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }),
      pct: Math.round(((i.logins || 0) / max) * 100),
    }));
  }, [metrics]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 text-yellow-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Painel Geral</h1>
        <p className="text-sm text-zinc-400 mt-1">Metricas de seguranca, engajamento e sincronizacao.</p>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {/* Estabelecimentos */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <p className="text-xs uppercase tracking-wider text-zinc-500 font-medium mb-3">Estabelecimentos</p>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-white">{metrics?.establishments?.active ?? '—'}</p>
              <p className="text-xs text-zinc-500">Ativos</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{metrics?.establishments?.inactive ?? '—'}</p>
              <p className="text-xs text-zinc-500">Inativos</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{metrics?.establishments?.total ?? '—'}</p>
              <p className="text-xs text-zinc-500">Total</p>
            </div>
          </div>
        </div>

        {/* Jogadores */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <p className="text-xs uppercase tracking-wider text-zinc-500 font-medium mb-3">Jogadores</p>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-white">{metrics?.players?.active ?? '—'}</p>
              <p className="text-xs text-zinc-500">Ativos</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{metrics?.players?.inactive ?? '—'}</p>
              <p className="text-xs text-zinc-500">Inativos</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{metrics?.players?.total ?? '—'}</p>
              <p className="text-xs text-zinc-500">Total</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 text-center mt-3 pt-3 border-t border-zinc-800">
            <div>
              <p className="text-lg font-bold text-white">{metrics?.players?.with_consent ?? '—'}</p>
              <p className="text-xs text-zinc-500">Com consentimento</p>
            </div>
            <div>
              <p className="text-lg font-bold text-white">{metrics?.players?.without_consent ?? '—'}</p>
              <p className="text-xs text-zinc-500">Sem consentimento</p>
            </div>
          </div>
        </div>

        {/* Atividade */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <p className="text-xs uppercase tracking-wider text-zinc-500 font-medium mb-3">Atividade &amp; Sessoes</p>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-white">{metrics?.engagement?.logins_last_24h ?? '—'}</p>
              <p className="text-xs text-zinc-500">Logins (24h)</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{metrics?.engagement?.logins_last_7d ?? '—'}</p>
              <p className="text-xs text-zinc-500">Logins (7d)</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{metrics?.engagement?.active_sessions ?? '—'}</p>
              <p className="text-xs text-zinc-500">Sessoes ativas</p>
            </div>
          </div>
        </div>

        {/* Videos */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <p className="text-xs uppercase tracking-wider text-zinc-500 font-medium mb-3">Videos sincronizados</p>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-white">{metrics?.videos?.last_24h ?? '—'}</p>
              <p className="text-xs text-zinc-500">24h</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{metrics?.videos?.last_7d ?? '—'}</p>
              <p className="text-xs text-zinc-500">7 dias</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{metrics?.videos?.total ?? '—'}</p>
              <p className="text-xs text-zinc-500">Total</p>
            </div>
          </div>
        </div>

        {/* Alugueis */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <p className="text-xs uppercase tracking-wider text-zinc-500 font-medium mb-3">Alugueis (SGQ)</p>
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-white">{metrics?.player_rentals?.total_rentals ?? '—'}</p>
              <p className="text-xs text-zinc-500">Total de alugueis</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{metrics?.player_rentals?.unique_players ?? '—'}</p>
              <p className="text-xs text-zinc-500">Jogadores atendidos</p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Gestores por cliente */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Gestores por cliente</h2>
          <div className="space-y-3">
            {managersChart.map((item: any) => (
              <div key={item.id} className="flex items-center gap-3">
                <span className="text-xs text-zinc-400 w-32 truncate">{item.name}</span>
                <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full bg-yellow-500 rounded-full" style={{ width: `${item.pct}%` }} />
                </div>
                <span className="text-xs text-zinc-500 w-16 text-right">{item.managers}</span>
              </div>
            ))}
            {managersChart.length === 0 && <p className="text-sm text-zinc-500">Sem dados.</p>}
          </div>
        </div>

        {/* Login trend */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Frequencia de logins (mensal)</h2>
          <div className="space-y-3">
            {loginTrend.map((item: any) => (
              <div key={item.month} className="flex items-center gap-3">
                <span className="text-xs text-zinc-400 w-24 truncate">{item.label}</span>
                <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: `${item.pct}%` }} />
                </div>
                <span className="text-xs text-zinc-500 w-16 text-right">{item.logins}</span>
              </div>
            ))}
            {loginTrend.length === 0 && <p className="text-sm text-zinc-500">Sem logins no periodo.</p>}
          </div>
        </div>
      </div>

      {/* Recent videos */}
      {(metrics?.recent_videos?.length ?? 0) > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Ultimos videos sincronizados</h2>
          <div className="space-y-2">
            {metrics!.recent_videos.map((video: any) => (
              <div key={video.id} className="flex items-center justify-between py-2 border-b border-zinc-800 last:border-0">
                <div>
                  <p className="text-sm text-white font-medium">{video.storage_key}</p>
                  <p className="text-xs text-zinc-500">{video.establishment || '—'}</p>
                </div>
                <span className="text-xs text-zinc-500">
                  {new Date(video.captured_at).toLocaleString('pt-BR')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
