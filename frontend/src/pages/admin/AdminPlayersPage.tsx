import { useState, useEffect, useCallback } from 'react';
import {
  fetchPlayers,
  updatePlayer,
  activatePlayer,
  deactivatePlayer,
  deletePlayer,
  type Player,
  type PaginatedResponse,
} from '../../services/adminApi';

interface Filters {
  q: string;
  consent: string;
  status: string;
  created_from: string;
  created_to: string;
  missing_contact: boolean;
  sort_by: string;
  sort_dir: string;
}

interface EditRow {
  name: string;
  phone: string;
  email: string;
}

export default function AdminPlayersPage() {
  // ── List state ──
  const [data, setData] = useState<PaginatedResponse<Player> | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    q: '', consent: '', status: '',
    created_from: '', created_to: '', missing_contact: false,
    sort_by: 'name', sort_dir: 'asc',
  });

  // ── Inline edit ──
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editRow, setEditRow] = useState<EditRow>({ name: '', phone: '', email: '' });
  const [savingEdit, setSavingEdit] = useState(false);

  // ── Action state ──
  const [actionId, setActionId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const inputClass =
    'w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:border-yellow-500 focus:outline-none';

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), per_page: '15' };
      if (filters.q) params.q = filters.q;
      if (filters.consent) params.consent = filters.consent;
      if (filters.status) params.status = filters.status;
      if (filters.created_from) params.created_from = filters.created_from;
      if (filters.created_to) params.created_to = filters.created_to;
      if (filters.missing_contact) params.missing_contact = 'true';
      if (filters.sort_by) params.sort_by = filters.sort_by;
      if (filters.sort_dir) params.sort_dir = filters.sort_dir;
      const res = await fetchPlayers(params);
      setData(res);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const handleFilterChange = (field: keyof Filters, value: string | boolean) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
    setPage(1);
  };

  // ── Inline edit handlers ──
  const startEdit = (p: Player) => {
    setEditingId(p.id);
    setEditRow({ name: p.name || '', phone: p.phone || '', email: p.email || '' });
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    setSavingEdit(true);
    setError('');
    setSuccess('');
    try {
      await updatePlayer(editingId, {
        name: editRow.name,
        phone: editRow.phone,
        email: editRow.email,
      });
      setSuccess('Jogador atualizado!');
      setEditingId(null);
      loadList();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar jogador.');
    } finally {
      setSavingEdit(false);
    }
  };

  // ── Toggle consent (via activate/deactivate as proxy) ──
  const handleConsentToggle = async (p: Player) => {
    setActionId(p.id);
    setError('');
    try {
      const d = p as Record<string, unknown>;
      const hasConsent = d.consent_given || d.data_consent;
      if (hasConsent) {
        await updatePlayer(p.id, { data_consent: false });
      } else {
        await updatePlayer(p.id, { data_consent: true });
      }
      loadList();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao alterar consentimento.');
    } finally {
      setActionId(null);
    }
  };

  // ── Activate / Deactivate ──
  const handleToggleActive = async (p: Player) => {
    setActionId(p.id);
    setError('');
    try {
      if (p.is_active) {
        await deactivatePlayer(p.id);
      } else {
        await activatePlayer(p.id);
      }
      loadList();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao alterar status.');
    } finally {
      setActionId(null);
    }
  };

  // ── Delete ──
  const handleDelete = async (p: Player) => {
    if (!confirm(`Remover jogador "${p.name}"? Esta acao nao pode ser desfeita.`)) return;
    setActionId(p.id);
    setError('');
    try {
      await deletePlayer(p.id);
      setSuccess('Jogador removido.');
      loadList();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao remover jogador.');
    } finally {
      setActionId(null);
    }
  };

  const getPlayerEstablishments = (p: Player): Array<{ id: number; name: string; system?: string; role?: string }> => {
    const d = p as Record<string, unknown>;
    if (Array.isArray(d.tenants)) return d.tenants as Array<{ id: number; name: string; system?: string; role?: string }>;
    if (Array.isArray(d.establishments)) return d.establishments as Array<{ id: number; name: string }>;
    return [];
  };

  const getPlayerConsent = (p: Player): boolean => {
    const d = p as Record<string, unknown>;
    return !!(d.consent_given || d.data_consent);
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Usuarios</h1>
        <p className="text-sm text-zinc-400">Gerencie usuarios cadastrados na plataforma.</p>
      </div>

      {/* Filters */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <p className="text-xs uppercase tracking-wider text-zinc-500 font-medium mb-3">Filtros</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <input
            type="text"
            className={inputClass}
            placeholder="Buscar nome, email, telefone..."
            value={filters.q}
            onChange={(e) => handleFilterChange('q', e.target.value)}
          />
          <select
            className={inputClass}
            value={filters.consent}
            onChange={(e) => handleFilterChange('consent', e.target.value)}
          >
            <option value="">Consentimento</option>
            <option value="true">Com consentimento</option>
            <option value="false">Sem consentimento</option>
          </select>
          <select
            className={inputClass}
            value={filters.status}
            onChange={(e) => handleFilterChange('status', e.target.value)}
          >
            <option value="">Todos os status</option>
            <option value="active">Ativo</option>
            <option value="inactive">Inativo</option>
          </select>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer whitespace-nowrap">
              <input
                type="checkbox"
                checked={filters.missing_contact}
                onChange={(e) => handleFilterChange('missing_contact', e.target.checked)}
                className="rounded border-zinc-600 bg-zinc-950 text-yellow-500 focus:ring-yellow-500"
              />
              Sem contato
            </label>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Criado desde</label>
            <input
              type="date"
              className={inputClass}
              value={filters.created_from}
              onChange={(e) => handleFilterChange('created_from', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Criado ate</label>
            <input
              type="date"
              className={inputClass}
              value={filters.created_to}
              onChange={(e) => handleFilterChange('created_to', e.target.value)}
            />
          </div>
          <select
            className={inputClass}
            value={filters.sort_by}
            onChange={(e) => handleFilterChange('sort_by', e.target.value)}
          >
            <option value="name">Ordenar por nome</option>
            <option value="created_at">Ordenar por data</option>
            <option value="email">Ordenar por email</option>
          </select>
          <select
            className={inputClass}
            value={filters.sort_dir}
            onChange={(e) => handleFilterChange('sort_dir', e.target.value)}
          >
            <option value="asc">Crescente</option>
            <option value="desc">Decrescente</option>
          </select>
        </div>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}
      {success && <p className="text-green-400 text-sm">{success}</p>}

      {/* Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        {loading ? (
          <p className="text-zinc-400 text-sm py-8 text-center">Carregando...</p>
        ) : !data || data.items.length === 0 ? (
          <p className="text-zinc-500 text-sm py-8 text-center">Nenhum jogador encontrado.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-zinc-950 text-zinc-400 uppercase text-xs">
                  <tr>
                    <th className="p-3">Nome</th>
                    <th className="p-3">Contato</th>
                    <th className="p-3">Consentimento</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Sistemas</th>
                    <th className="p-3">Criado em</th>
                    <th className="p-3">Acoes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {data.items.map((player) => {
                    const isEditing = editingId === player.id;
                    const pEsts = getPlayerEstablishments(player);
                    const hasConsent = getPlayerConsent(player);
                    const d = player as Record<string, unknown>;

                    return (
                      <tr key={player.id} className="hover:bg-zinc-800/50 align-top">
                        {/* Name */}
                        <td className="p-3">
                          {isEditing ? (
                            <input
                              type="text"
                              className={inputClass}
                              value={editRow.name}
                              onChange={(e) => setEditRow({ ...editRow, name: e.target.value })}
                            />
                          ) : (
                            <span className="text-white font-medium">{player.name}</span>
                          )}
                        </td>
                        {/* Contact */}
                        <td className="p-3">
                          {isEditing ? (
                            <div className="space-y-1">
                              <input
                                type="text"
                                className={inputClass}
                                value={editRow.phone}
                                onChange={(e) => setEditRow({ ...editRow, phone: e.target.value })}
                                placeholder="Telefone"
                              />
                              <input
                                type="email"
                                className={inputClass}
                                value={editRow.email}
                                onChange={(e) => setEditRow({ ...editRow, email: e.target.value })}
                                placeholder="Email"
                              />
                            </div>
                          ) : (
                            <div className="text-zinc-300 text-xs space-y-0.5">
                              {player.phone && <div>{player.phone}</div>}
                              {player.email && <div>{player.email}</div>}
                              {!player.phone && !player.email && <span className="text-zinc-500">—</span>}
                            </div>
                          )}
                        </td>
                        {/* Consent */}
                        <td className="p-3">
                          {hasConsent ? (
                            <span className="bg-green-500/10 text-green-500 px-2 py-0.5 rounded text-xs font-medium">
                              Sim
                            </span>
                          ) : (
                            <span className="bg-yellow-500/10 text-yellow-500 px-2 py-0.5 rounded text-xs font-medium">
                              Nao
                            </span>
                          )}
                        </td>
                        {/* Status */}
                        <td className="p-3">
                          {player.is_active ? (
                            <span className="bg-green-500/10 text-green-500 px-2 py-0.5 rounded text-xs font-medium">
                              Ativo
                            </span>
                          ) : (
                            <span className="bg-red-500/10 text-red-500 px-2 py-0.5 rounded text-xs font-medium">
                              Inativo
                            </span>
                          )}
                        </td>
                        {/* Tenants / Sistemas */}
                        <td className="p-3">
                          <div className="space-y-1">
                            {pEsts.length === 0 ? (
                              <span className="text-zinc-500 text-xs">Nenhum sistema</span>
                            ) : (
                              pEsts.map((est, idx) => (
                                <div key={idx} className="flex items-center gap-1">
                                  <span className="bg-zinc-700 text-zinc-300 px-2 py-0.5 rounded text-xs font-medium">
                                    {est.name}
                                  </span>
                                  {est.role && (
                                    <span className="bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded text-[10px]">
                                      {String(est.role)}
                                    </span>
                                  )}
                                </div>
                              ))
                            )}
                          </div>
                        </td>
                        {/* Created */}
                        <td className="p-3 text-zinc-400 text-xs whitespace-nowrap">
                          {d.created_at
                            ? new Date(d.created_at as string).toLocaleDateString('pt-BR')
                            : '—'}
                        </td>
                        {/* Actions */}
                        <td className="p-3">
                          <div className="flex flex-col gap-1">
                            {isEditing ? (
                              <div className="flex items-center gap-2">
                                <button
                                  className="px-4 py-2 bg-yellow-500 text-zinc-900 font-semibold rounded-lg hover:bg-yellow-400 transition-colors disabled:opacity-50 text-xs"
                                  disabled={savingEdit}
                                  onClick={handleSaveEdit}
                                >
                                  {savingEdit ? '...' : 'Salvar'}
                                </button>
                                <button
                                  className="px-4 py-2 bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 transition-colors text-xs"
                                  onClick={cancelEdit}
                                >
                                  Cancelar
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 flex-wrap">
                                <button
                                  className="px-4 py-2 bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 transition-colors text-xs"
                                  onClick={() => startEdit(player)}
                                >
                                  Editar
                                </button>
                                <button
                                  className="text-red-400 hover:text-red-300 text-sm"
                                  disabled={actionId === player.id}
                                  onClick={() => handleConsentToggle(player)}
                                >
                                  {hasConsent ? 'Revogar Cons.' : 'Dar Cons.'}
                                </button>
                                <button
                                  className="text-red-400 hover:text-red-300 text-sm"
                                  disabled={actionId === player.id}
                                  onClick={() => handleToggleActive(player)}
                                >
                                  {player.is_active ? 'Desativar' : 'Ativar'}
                                </button>
                                <button
                                  className="text-red-400 hover:text-red-300 text-sm"
                                  disabled={actionId === player.id}
                                  onClick={() => handleDelete(player)}
                                >
                                  Excluir
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {data.pagination && (
              <div className="flex justify-between items-center mt-4">
                <p className="text-sm text-zinc-400">
                  Pagina {data.pagination.page} de {data.pagination.pages} ({data.pagination.total} total)
                </p>
                <div className="flex gap-2">
                  <button
                    className="px-4 py-2 bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 transition-colors disabled:opacity-50"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Anterior
                  </button>
                  <button
                    className="px-4 py-2 bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 transition-colors disabled:opacity-50"
                    disabled={page >= data.pagination.pages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Proximo
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
