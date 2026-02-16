import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { fetchAuditLogs, fetchActiveSessions, revokeSession } from '../../services/adminApi';
import { useAdminAuth } from '../../contexts/AdminAuthContext';

const CATEGORIES = [
  { value: 'access', label: 'Acessos e logout' },
  { value: 'keys', label: 'Rotacoes de chave' },
  { value: 'permissions', label: 'Alteracoes de permissao' },
  { value: 'login', label: 'Tentativas de login' },
];

const INPUT_CLS = 'w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:border-yellow-500 focus:outline-none';

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  try { return new Date(value).toLocaleString('pt-BR'); } catch { return value; }
}

export default function AdminAuditPage() {
  const { adminLogout } = useAdminAuth();
  const [logs, setLogs] = useState<any[]>([]);
  const [category, setCategory] = useState('access');
  const [search, setSearch] = useState('');
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sessions, setSessions] = useState<any[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsError, setSessionsError] = useState<string | null>(null);

  useEffect(() => {
    loadLogs(category, pagination.page, search);
    loadSessions();
  }, [category, pagination.page]);

  async function loadLogs(cat: string, page: number, q: string) {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = { category: cat, page: String(page) };
      if (q) params.q = q;
      const data: any = await fetchAuditLogs(params);
      setLogs(data.items ?? []);
      setPagination((prev) => ({ ...prev, ...(data.pagination || {}), page: data.pagination?.page || page }));
    } catch {
      setError('Nao foi possivel carregar os logs.');
    } finally {
      setLoading(false);
    }
  }

  async function loadSessions() {
    setSessionsLoading(true);
    setSessionsError(null);
    try {
      const data = await fetchActiveSessions();
      setSessions(data as any[]);
    } catch {
      setSessionsError('Nao foi possivel carregar as sessoes.');
    } finally {
      setSessionsLoading(false);
    }
  }

  async function handleRevoke(jti: string, isCurrent: boolean) {
    setSessionsError(null);
    try {
      await revokeSession(jti);
      if (isCurrent) {
        await adminLogout();
      } else {
        await loadSessions();
      }
    } catch {
      setSessionsError('Falha ao encerrar sessao.');
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPagination((prev) => ({ ...prev, page: 1 }));
    loadLogs(category, 1, search);
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Auditoria</h1>
        <p className="text-sm text-zinc-400 mt-1">Acompanhe acessos, rotacao de chaves, mudancas de permissao e tentativas de login.</p>
      </div>

      {/* Sessions */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-zinc-500 font-medium">Sessoes ativas</p>
            <h3 className="text-sm font-semibold text-white mt-1">Controle individual</h3>
          </div>
          <button onClick={loadSessions} disabled={sessionsLoading} className="px-3 py-1.5 bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 text-xs transition-colors">
            Atualizar
          </button>
        </div>

        {sessionsError && <p className="text-red-400 text-sm mb-3">{sessionsError}</p>}

        {sessionsLoading ? (
          <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 text-yellow-500 animate-spin" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-zinc-400 text-xs uppercase">
                <tr>
                  <th className="p-2">Iniciada em</th>
                  <th className="p-2">Ultimo uso</th>
                  <th className="p-2">Expira em</th>
                  <th className="p-2">Acao</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {sessions.map((s: any) => (
                  <tr key={s.jti}>
                    <td className="p-2 text-zinc-300">{formatDate(s.created_at)}</td>
                    <td className="p-2 text-zinc-300">{s.last_used_at ? formatDate(s.last_used_at) : '—'}</td>
                    <td className="p-2 text-zinc-300">{formatDate(s.expires_at)}</td>
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        {s.is_current && <span className="bg-yellow-500/10 text-yellow-500 px-2 py-0.5 rounded text-xs font-medium">Atual</span>}
                        <button onClick={() => handleRevoke(s.jti, s.is_current)} className="text-red-400 hover:text-red-300 text-xs">
                          Encerrar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {sessions.length === 0 && (
                  <tr><td colSpan={4} className="p-4 text-center text-zinc-500 text-sm">Nenhuma sessao ativa.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Filters */}
      <form onSubmit={handleSearch} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Categoria</label>
            <select
              value={category}
              onChange={(e) => { setCategory(e.target.value); setPagination((p) => ({ ...p, page: 1 })); }}
              className={INPUT_CLS}
            >
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Buscar</label>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Email, acao ou IP" className={INPUT_CLS} />
          </div>
          <div className="flex items-end">
            <button type="submit" className="px-4 py-2 bg-yellow-500 text-zinc-900 font-semibold rounded-lg hover:bg-yellow-400 transition-colors w-full">
              Aplicar filtros
            </button>
          </div>
        </div>
      </form>

      {/* Logs */}
      {loading && <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 text-yellow-500 animate-spin" /></div>}
      {error && <p className="text-red-400 text-sm">{error}</p>}

      {!loading && !error && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-950 text-zinc-400 uppercase text-xs">
                <tr>
                  <th className="p-3">Data</th>
                  <th className="p-3">Acao</th>
                  <th className="p-3">Ator</th>
                  <th className="p-3">Alvo</th>
                  <th className="p-3">Detalhes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {logs.map((log: any) => (
                  <tr key={log.id}>
                    <td className="p-3 text-zinc-300 whitespace-nowrap">{formatDate(log.created_at)}</td>
                    <td className="p-3 text-white">{log.action}</td>
                    <td className="p-3 text-zinc-400">{log.actor_name || log.actor_id || '—'}</td>
                    <td className="p-3 text-zinc-400">{log.target_name || log.target_admin_id || '—'}</td>
                    <td className="p-3 text-zinc-500 text-xs font-mono max-w-xs truncate">{JSON.stringify(log.metadata || {})}</td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr><td colSpan={5} className="p-4 text-center text-zinc-500">Nenhum evento encontrado.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between p-4 border-t border-zinc-800">
            <button
              disabled={pagination.page <= 1}
              onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
              className="px-3 py-1.5 bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 text-xs transition-colors disabled:opacity-50"
            >
              Anterior
            </button>
            <span className="text-xs text-zinc-500">
              Pagina {pagination.page} de {pagination.pages || 1} - {pagination.total || 0} eventos
            </span>
            <button
              disabled={pagination.page >= (pagination.pages || 1)}
              onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
              className="px-3 py-1.5 bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 text-xs transition-colors disabled:opacity-50"
            >
              Proxima
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
