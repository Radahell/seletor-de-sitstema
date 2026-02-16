import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  fetchSecurityStatus,
  fetchAuditLogs,
  fetchActiveSessions,
  revokeSession,
  fetchMfaStatus,
  setupMfa,
  verifyMfa,
  disableMfa,
  regenerateBackupCodes,
} from '../../services/adminApi';

const INPUT_CLS = 'w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:border-yellow-500 focus:outline-none';

export default function AdminSecurityPage() {
  const [secStatus, setSecStatus] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [logsPagination, setLogsPagination] = useState<any>({});
  const [sessions, setSessions] = useState<any[]>([]);
  const [logsFilter, setLogsFilter] = useState({ category: '', page: 1 });
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [status, sess] = await Promise.all([
        fetchSecurityStatus(),
        fetchActiveSessions(),
      ]);
      setSecStatus(status);
      setSessions(sess as any[]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadLogs = useCallback(async () => {
    try {
      const params: Record<string, string> = { page: String(logsFilter.page), limit: '20' };
      if (logsFilter.category) params.category = logsFilter.category;
      const data: any = await fetchAuditLogs(params);
      setLogs(data.items ?? []);
      setLogsPagination(data.pagination ?? {});
    } catch (err) {
      console.error(err);
    }
  }, [logsFilter]);

  useEffect(() => { loadAll(); }, [loadAll]);
  useEffect(() => { loadLogs(); }, [loadLogs]);

  const handleRevoke = async (jti: string) => {
    try {
      await revokeSession(jti);
      setSessions((prev) => prev.filter((s) => s.jti !== jti));
    } catch (err) {
      console.error(err);
    }
  };

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
        <h1 className="text-2xl font-bold text-white">Seguranca</h1>
        <p className="text-sm text-zinc-400 mt-1">Painel de seguranca, auditoria e autenticacao em dois fatores.</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 text-center">
          <p className="text-xs uppercase tracking-wider text-zinc-500 font-medium">Sessoes ativas</p>
          <p className="text-3xl font-bold text-white mt-2">{secStatus?.sessions?.active ?? '—'}</p>
          <p className="text-xs text-zinc-500 mt-1">sessoes no sistema</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 text-center">
          <p className="text-xs uppercase tracking-wider text-zinc-500 font-medium">Cobertura IP</p>
          <p className="text-3xl font-bold text-white mt-2">
            {secStatus?.network?.coverage != null ? `${Math.round(secStatus.network.coverage * 100)}%` : '—'}
          </p>
          <p className="text-xs text-zinc-500 mt-1">
            {secStatus?.network?.total
              ? `${secStatus.network.total - secStatus.network.missing_ip}/${secStatus.network.total} com IP`
              : 'Nenhum cliente'}
          </p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 text-center">
          <p className="text-xs uppercase tracking-wider text-zinc-500 font-medium">API Keys</p>
          <p className="text-lg font-bold text-white mt-2">
            {secStatus?.api_keys?.last_rotation
              ? `Rotacao: ${new Date(secStatus.api_keys.last_rotation).toLocaleDateString('pt-BR')}`
              : 'Sem rotacao recente'}
          </p>
          <p className="text-xs text-zinc-500 mt-1">{secStatus?.api_keys?.total_keys ?? 0} chaves cadastradas</p>
        </div>
      </div>

      {/* MFA */}
      <MfaSection />

      {/* Active Sessions */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white mb-4">Sessoes ativas</h2>
        {sessions.length === 0 ? (
          <p className="text-sm text-zinc-500">Nenhuma sessao ativa.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-zinc-400 text-xs uppercase">
                <tr>
                  <th className="p-2">Usuario</th>
                  <th className="p-2">Dispositivo</th>
                  <th className="p-2">IP</th>
                  <th className="p-2">Criada em</th>
                  <th className="p-2">Acoes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {sessions.map((s: any) => (
                  <tr key={s.jti}>
                    <td className="p-2 text-zinc-300">{s.user_name || s.user_email || '—'}</td>
                    <td className="p-2 text-zinc-500 text-xs">{s.device || '—'}</td>
                    <td className="p-2 text-zinc-400">{s.ip || '—'}</td>
                    <td className="p-2 text-zinc-400">{s.created_at ? new Date(s.created_at).toLocaleString('pt-BR') : '—'}</td>
                    <td className="p-2">
                      <button onClick={() => handleRevoke(s.jti)} className="text-red-400 hover:text-red-300 text-xs">Revogar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Audit Logs */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white">Logs de auditoria</h2>
          <select
            value={logsFilter.category}
            onChange={(e) => setLogsFilter({ category: e.target.value, page: 1 })}
            className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-1.5 text-white text-xs focus:border-yellow-500 focus:outline-none"
          >
            <option value="">Todas categorias</option>
            <option value="auth">Autenticacao</option>
            <option value="user">Usuarios</option>
            <option value="establishment">Estabelecimentos</option>
            <option value="security">Seguranca</option>
            <option value="billing">Faturacao</option>
          </select>
        </div>

        {logs.length === 0 ? (
          <p className="text-sm text-zinc-500">Nenhum log encontrado.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-zinc-400 text-xs uppercase">
                  <tr>
                    <th className="p-2">Data</th>
                    <th className="p-2">Categoria</th>
                    <th className="p-2">Acao</th>
                    <th className="p-2">Usuario</th>
                    <th className="p-2">IP</th>
                    <th className="p-2">Detalhes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {logs.map((log: any) => (
                    <tr key={log.id}>
                      <td className="p-2 text-zinc-300 whitespace-nowrap">{new Date(log.created_at).toLocaleString('pt-BR')}</td>
                      <td className="p-2"><span className="bg-zinc-700 text-zinc-300 px-2 py-0.5 rounded text-xs">{log.category}</span></td>
                      <td className="p-2 text-white">{log.action}</td>
                      <td className="p-2 text-zinc-400">{log.user_name || log.user_email || '—'}</td>
                      <td className="p-2 text-zinc-500 text-xs">{log.ip_address || '—'}</td>
                      <td className="p-2 text-zinc-500 text-xs max-w-[200px] truncate">{log.details ? JSON.stringify(log.details).slice(0, 60) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {logsPagination.total_pages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <button
                  disabled={logsFilter.page <= 1}
                  onClick={() => setLogsFilter((f) => ({ ...f, page: f.page - 1 }))}
                  className="px-3 py-1.5 bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 text-xs disabled:opacity-50"
                >
                  Anterior
                </button>
                <span className="text-xs text-zinc-500">Pagina {logsFilter.page} de {logsPagination.total_pages}</span>
                <button
                  disabled={logsFilter.page >= logsPagination.total_pages}
                  onClick={() => setLogsFilter((f) => ({ ...f, page: f.page + 1 }))}
                  className="px-3 py-1.5 bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 text-xs disabled:opacity-50"
                >
                  Proxima
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── MFA Section ────────────────────────────────────────────────────
function MfaSection() {
  const [mfaStatus, setMfaStatus] = useState<any>(null);
  const [setupData, setSetupData] = useState<any>(null);
  const [code, setCode] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const data = await fetchMfaStatus();
      setMfaStatus(data);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  const handleSetup = async () => {
    setError(null);
    try {
      const data: any = await setupMfa();
      setSetupData(data);
    } catch (err: any) {
      setError(err.message || 'Erro ao configurar MFA');
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const data: any = await verifyMfa(code);
      setSuccess('MFA ativado com sucesso!');
      setBackupCodes(data.backup_codes || null);
      setSetupData(null);
      setCode('');
      loadStatus();
    } catch (err: any) {
      setError(err.message || 'Codigo invalido');
    }
  };

  const handleDisable = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await disableMfa(disableCode);
      setSuccess('MFA desativado.');
      setDisableCode('');
      setBackupCodes(null);
      loadStatus();
    } catch (err: any) {
      setError(err.message || 'Codigo invalido');
    }
  };

  const handleRegenerate = async () => {
    setError(null);
    try {
      const data: any = await regenerateBackupCodes();
      setBackupCodes(data.backup_codes || []);
      setSuccess('Codigos de backup regenerados.');
    } catch (err: any) {
      setError(err.message || 'Erro ao regenerar codigos');
    }
  };

  if (!mfaStatus) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <p className="text-xs uppercase tracking-wider text-zinc-500 font-medium mb-3">Autenticacao em dois fatores (2FA)</p>
        <div className="flex items-center gap-3 mb-4">
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${mfaStatus.enabled ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
            {mfaStatus.enabled ? 'Ativado' : 'Desativado'}
          </span>
        </div>

        {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
        {success && <p className="text-green-400 text-sm mb-3">{success}</p>}

        {!mfaStatus.enabled && !setupData && (
          <button onClick={handleSetup} className="px-4 py-2 bg-yellow-500 text-zinc-900 font-semibold rounded-lg hover:bg-yellow-400 transition-colors text-sm">
            Ativar 2FA
          </button>
        )}

        {setupData && (
          <div className="space-y-4">
            <p className="text-sm text-zinc-400">Escaneie o QR code no app autenticador ou copie a chave:</p>
            <div className="bg-zinc-950 border border-zinc-700 rounded-lg p-3">
              <p className="text-xs text-zinc-500 mb-1">URI</p>
              <code className="text-xs text-yellow-400 break-all">{setupData.provisioning_uri}</code>
            </div>
            <div className="bg-zinc-950 border border-zinc-700 rounded-lg p-3">
              <p className="text-xs text-zinc-500 mb-1">Chave secreta</p>
              <code className="text-sm text-yellow-400">{setupData.secret}</code>
            </div>
            <form onSubmit={handleVerify} className="space-y-3">
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Codigo de verificacao</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="000000"
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:border-yellow-500 focus:outline-none"
                  required
                />
              </div>
              <button type="submit" className="px-4 py-2 bg-yellow-500 text-zinc-900 font-semibold rounded-lg hover:bg-yellow-400 transition-colors text-sm">
                Verificar e ativar
              </button>
            </form>
          </div>
        )}

        {mfaStatus.enabled && (
          <form onSubmit={handleDisable} className="space-y-3 mt-4">
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Codigo para desativar</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={disableCode}
                onChange={(e) => setDisableCode(e.target.value)}
                placeholder="000000"
                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:border-yellow-500 focus:outline-none"
                required
              />
            </div>
            <div className="flex items-center gap-2">
              <button type="submit" className="px-3 py-1.5 bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 text-xs">Desativar 2FA</button>
              <button type="button" onClick={handleRegenerate} className="px-3 py-1.5 bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 text-xs">Regenerar backup codes</button>
            </div>
          </form>
        )}
      </div>

      {backupCodes && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <p className="text-xs uppercase tracking-wider text-zinc-500 font-medium mb-2">Codigos de backup</p>
          <p className="text-xs text-zinc-500 mb-3">Guarde em local seguro. Cada um pode ser usado uma vez.</p>
          <div className="bg-zinc-950 border border-zinc-700 rounded-lg p-3 space-y-1">
            {backupCodes.map((c, i) => (
              <div key={i}><code className="text-sm text-yellow-400">{c}</code></div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
