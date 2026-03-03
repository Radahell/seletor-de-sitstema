import { useState, useEffect, useCallback } from 'react';
import {
  fetchPlayers,
  updatePlayer,
  activatePlayer,
  deactivatePlayer,
  deletePlayer,
  addUserToTenant,
  removeUserFromTenant,
  fetchAllTenants,
  type Player,
  type PaginatedResponse,
  type TenantOption,
} from '../../services/adminApi';

interface Filters {
  q: string;
  status: string;
  tenant: string;
  missing_contact: boolean;
  sort_by: string;
  sort_dir: string;
}

interface EditRow {
  name: string;
  phone: string;
  email: string;
  nickname: string;
  cpf: string;
}

interface UserTenant {
  id: number;
  slug: string;
  name: string;
  system: string;
  systemSlug?: string;
  role: string;
}

export default function AdminPlayersPage() {
  const [data, setData] = useState<PaginatedResponse<Player> | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    q: '', status: '', tenant: '',
    missing_contact: false, sort_by: 'name', sort_dir: 'asc',
  });

  // Inline edit
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editRow, setEditRow] = useState<EditRow>({ name: '', phone: '', email: '', nickname: '', cpf: '' });
  const [savingEdit, setSavingEdit] = useState(false);

  // Tenant management modal
  const [managingTenants, setManagingTenants] = useState<number | null>(null);
  const [managingUserName, setManagingUserName] = useState('');
  const [userTenants, setUserTenants] = useState<UserTenant[]>([]);
  const [allTenants, setAllTenants] = useState<TenantOption[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<string>('player');
  const [tenantAction, setTenantAction] = useState(false);

  // Action state
  const [actionId, setActionId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Confirm modal
  const [confirmDelete, setConfirmDelete] = useState<Player | null>(null);

  const inputClass =
    'w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:border-yellow-500 focus:outline-none';

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), per_page: '15' };
      if (filters.q) params.q = filters.q;
      if (filters.status) params.status = filters.status;
      if (filters.tenant) params.tenant = filters.tenant;
      if (filters.missing_contact) params.missing_contact = 'true';
      if (filters.sort_by) params.sort_by = filters.sort_by;
      if (filters.sort_dir) params.sort_dir = filters.sort_dir;
      const res = await fetchPlayers(params);
      setData(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar usuarios.');
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  // Load tenants list on mount (for filter + tenant management)
  useEffect(() => {
    fetchAllTenants()
      .then((res) => setAllTenants(res.tenants))
      .catch(() => {});
  }, []);

  const handleFilterChange = (field: keyof Filters, value: string | boolean) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
    setPage(1);
  };

  // ── Inline edit ──
  const startEdit = (p: Player) => {
    setEditingId(p.id);
    const d = p as Record<string, unknown>;
    setEditRow({
      name: (d.name as string) || '',
      phone: (d.phone as string) || '',
      email: (d.email as string) || '',
      nickname: (d.nickname as string) || '',
      cpf: (d.cpf as string) || '',
    });
  };

  const cancelEdit = () => setEditingId(null);

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
        nickname: editRow.nickname,
        cpf: editRow.cpf,
      });
      setSuccess('Usuario atualizado!');
      setEditingId(null);
      loadList();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar.');
    } finally {
      setSavingEdit(false);
    }
  };

  // ── Toggle active ──
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
    setConfirmDelete(p);
  };

  const executeDelete = async () => {
    if (!confirmDelete) return;
    const p = confirmDelete;
    setConfirmDelete(null);
    setActionId(p.id);
    setError('');
    try {
      await deletePlayer(p.id);
      setSuccess('Usuario removido.');
      loadList();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao remover.');
    } finally {
      setActionId(null);
    }
  };

  // ── Tenant management ──
  const openTenantManager = (p: Player) => {
    const d = p as Record<string, unknown>;
    setManagingTenants(p.id);
    setManagingUserName(p.name || '');
    setUserTenants((d.tenants as UserTenant[]) || []);
    setSelectedTenantId('');
    setSelectedRole('player');
  };

  const closeTenantManager = () => {
    setManagingTenants(null);
    setUserTenants([]);
  };

  const handleAddTenant = async () => {
    if (!managingTenants || !selectedTenantId) return;
    setTenantAction(true);
    setError('');
    try {
      await addUserToTenant(managingTenants, Number(selectedTenantId), selectedRole);
      setSuccess('Tenant adicionado!');
      setSelectedTenantId('');
      // Refresh
      loadList();
      const t = allTenants.find((t) => t.id === Number(selectedTenantId));
      if (t) {
        setUserTenants((prev) => [
          ...prev,
          { id: t.id, slug: t.slug, name: t.displayName, system: t.systemName, systemSlug: t.systemSlug, role: selectedRole },
        ]);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao adicionar tenant.');
    } finally {
      setTenantAction(false);
    }
  };

  const handleRemoveTenant = async (tenantId: number) => {
    if (!managingTenants) return;
    setTenantAction(true);
    setError('');
    try {
      await removeUserFromTenant(managingTenants, tenantId);
      setUserTenants((prev) => prev.filter((t) => t.id !== tenantId));
      setSuccess('Tenant removido!');
      loadList();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao remover tenant.');
    } finally {
      setTenantAction(false);
    }
  };

  const getPlayerTenants = (p: Player): UserTenant[] => {
    const d = p as Record<string, unknown>;
    if (Array.isArray(d.tenants)) return d.tenants as UserTenant[];
    return [];
  };

  // Tenants not yet assigned to user
  const availableTenants = allTenants.filter(
    (t) => !userTenants.some((ut) => ut.id === t.id || ut.slug === t.slug)
  );

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Usuarios da Plataforma</h1>
        <p className="text-sm text-zinc-400">
          Todos os usuarios cadastrados no hub central. Gerencie acesso aos sistemas.
        </p>
      </div>

      {/* Filters */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <p className="text-xs uppercase tracking-wider text-zinc-500 font-medium mb-3">Filtros</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <input
            type="text"
            className={inputClass}
            placeholder="Buscar nome, email, telefone, cpf..."
            value={filters.q}
            onChange={(e) => handleFilterChange('q', e.target.value)}
          />
          <select
            className={inputClass}
            value={filters.status}
            onChange={(e) => handleFilterChange('status', e.target.value)}
          >
            <option value="">Todos os status</option>
            <option value="active">Ativo</option>
            <option value="inactive">Inativo</option>
          </select>
          <select
            className={inputClass}
            value={filters.tenant}
            onChange={(e) => handleFilterChange('tenant', e.target.value)}
          >
            <option value="">Todos os sistemas</option>
            {allTenants.map((t) => (
              <option key={t.id} value={t.slug}>
                {t.systemName} - {t.displayName}
              </option>
            ))}
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
          <p className="text-zinc-500 text-sm py-8 text-center">Nenhum usuario encontrado.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-zinc-950 text-zinc-400 uppercase text-xs">
                  <tr>
                    <th className="p-3">Nome</th>
                    <th className="p-3">Contato</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Sistemas</th>
                    <th className="p-3">Criado em</th>
                    <th className="p-3">Acoes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {data.items.map((player) => {
                    const isEditing = editingId === player.id;
                    const pTenants = getPlayerTenants(player);
                    const d = player as Record<string, unknown>;

                    return (
                      <tr key={player.id} className="hover:bg-zinc-800/50 align-top">
                        {/* Name */}
                        <td className="p-3">
                          {isEditing ? (
                            <div className="space-y-1">
                              <input
                                type="text"
                                className={inputClass}
                                value={editRow.name}
                                onChange={(e) => setEditRow({ ...editRow, name: e.target.value })}
                                placeholder="Nome"
                              />
                              <input
                                type="text"
                                className={inputClass}
                                value={editRow.nickname}
                                onChange={(e) => setEditRow({ ...editRow, nickname: e.target.value })}
                                placeholder="Apelido"
                              />
                            </div>
                          ) : (
                            <div>
                              <span className="text-white font-medium">{player.name}</span>
                              {d.nickname ? (
                                <span className="text-zinc-500 text-xs ml-1">({String(d.nickname)})</span>
                              ) : null}
                            </div>
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
                              <input
                                type="text"
                                className={inputClass}
                                value={editRow.cpf}
                                onChange={(e) => setEditRow({ ...editRow, cpf: e.target.value })}
                                placeholder="CPF"
                              />
                            </div>
                          ) : (
                            <div className="text-zinc-300 text-xs space-y-0.5">
                              {player.phone && <div>{player.phone}</div>}
                              {player.email && <div>{player.email}</div>}
                              {d.cpf ? <div className="text-zinc-500">{String(d.cpf)}</div> : null}
                              {!player.phone && !player.email && <span className="text-zinc-500">--</span>}
                            </div>
                          )}
                        </td>
                        {/* Status */}
                        <td className="p-3">
                          {player.is_active && !(d.is_blocked as boolean) ? (
                            <span className="bg-green-500/10 text-green-500 px-2 py-0.5 rounded text-xs font-medium">
                              Ativo
                            </span>
                          ) : d.is_blocked ? (
                            <span className="bg-red-500/10 text-red-500 px-2 py-0.5 rounded text-xs font-medium">
                              Bloqueado
                            </span>
                          ) : (
                            <span className="bg-yellow-500/10 text-yellow-500 px-2 py-0.5 rounded text-xs font-medium">
                              Inativo
                            </span>
                          )}
                        </td>
                        {/* Tenants */}
                        <td className="p-3">
                          <div className="space-y-1">
                            {pTenants.length === 0 ? (
                              <span className="text-zinc-500 text-xs">Nenhum sistema</span>
                            ) : (
                              pTenants.map((t, idx) => (
                                <div key={idx} className="flex items-center gap-1">
                                  <span className="bg-zinc-700 text-zinc-300 px-2 py-0.5 rounded text-xs font-medium truncate max-w-[120px]">
                                    {t.name}
                                  </span>
                                  <span className="bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded text-[10px]">
                                    {t.role}
                                  </span>
                                </div>
                              ))
                            )}
                            <button
                              className="text-yellow-500 hover:text-yellow-400 text-xs mt-1"
                              onClick={() => openTenantManager(player)}
                            >
                              + Gerenciar
                            </button>
                          </div>
                        </td>
                        {/* Created */}
                        <td className="p-3 text-zinc-400 text-xs whitespace-nowrap">
                          {d.created_at
                            ? new Date(d.created_at as string).toLocaleDateString('pt-BR')
                            : '--'}
                        </td>
                        {/* Actions */}
                        <td className="p-3">
                          <div className="flex flex-col gap-1">
                            {isEditing ? (
                              <div className="flex items-center gap-2">
                                <button
                                  className="px-3 py-1.5 bg-yellow-500 text-zinc-900 font-semibold rounded-lg hover:bg-yellow-400 transition-colors disabled:opacity-50 text-xs"
                                  disabled={savingEdit}
                                  onClick={handleSaveEdit}
                                >
                                  {savingEdit ? '...' : 'Salvar'}
                                </button>
                                <button
                                  className="px-3 py-1.5 bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 transition-colors text-xs"
                                  onClick={cancelEdit}
                                >
                                  Cancelar
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 flex-wrap">
                                <button
                                  className="px-3 py-1.5 bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 transition-colors text-xs"
                                  onClick={() => startEdit(player)}
                                >
                                  Editar
                                </button>
                                <button
                                  className="text-zinc-400 hover:text-zinc-200 text-xs"
                                  disabled={actionId === player.id}
                                  onClick={() => handleToggleActive(player)}
                                >
                                  {player.is_active ? 'Desativar' : 'Ativar'}
                                </button>
                                <button
                                  className="text-red-400 hover:text-red-300 text-xs"
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

      {/* Modal: Gerenciar Tenants */}
      {managingTenants && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-white">Sistemas de {managingUserName}</h2>
              <button
                className="text-zinc-400 hover:text-white text-xl"
                onClick={closeTenantManager}
              >
                X
              </button>
            </div>

            {/* Current tenants */}
            <div className="space-y-2 mb-6">
              <p className="text-xs uppercase tracking-wider text-zinc-500 font-medium">Sistemas atuais</p>
              {userTenants.length === 0 ? (
                <p className="text-zinc-500 text-sm">Nenhum sistema vinculado.</p>
              ) : (
                userTenants.map((t) => (
                  <div
                    key={t.id || t.slug}
                    className="flex items-center justify-between bg-zinc-800 rounded-lg px-3 py-2"
                  >
                    <div>
                      <span className="text-white text-sm font-medium">{t.name}</span>
                      <span className="text-zinc-400 text-xs ml-2">({t.system})</span>
                      <span className="bg-zinc-700 text-zinc-300 px-1.5 py-0.5 rounded text-[10px] ml-2">
                        {t.role}
                      </span>
                    </div>
                    <button
                      className="text-red-400 hover:text-red-300 text-xs"
                      disabled={tenantAction}
                      onClick={() => handleRemoveTenant(t.id)}
                    >
                      Remover
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Add tenant */}
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-wider text-zinc-500 font-medium">Adicionar sistema</p>
              <div className="grid grid-cols-3 gap-2">
                <select
                  className={inputClass + ' col-span-1'}
                  value={selectedTenantId}
                  onChange={(e) => setSelectedTenantId(e.target.value)}
                >
                  <option value="">Selecionar...</option>
                  {availableTenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.systemName} - {t.displayName}
                    </option>
                  ))}
                </select>
                <select
                  className={inputClass}
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                >
                  <option value="player">Player</option>
                  <option value="client">Client</option>
                  <option value="viewer">Viewer</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
                <button
                  className="px-4 py-2 bg-yellow-500 text-zinc-900 font-semibold rounded-lg hover:bg-yellow-400 transition-colors disabled:opacity-50 text-sm"
                  disabled={!selectedTenantId || tenantAction}
                  onClick={handleAddTenant}
                >
                  Adicionar
                </button>
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                className="px-4 py-2 bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 transition-colors"
                onClick={closeTenantManager}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setConfirmDelete(null)}>
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center mx-auto mb-4">
              <span className="text-red-400 text-xl font-bold">!</span>
            </div>
            <h3 className="text-lg font-bold text-white text-center mb-2">Excluir usuario</h3>
            <p className="text-sm text-zinc-400 text-center mb-6">
              Tem certeza que deseja remover "{confirmDelete.name}"? Esta acao nao pode ser desfeita.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 px-4 py-2 border border-zinc-700 text-zinc-400 rounded-lg hover:bg-zinc-800 text-sm font-semibold"
              >
                Cancelar
              </button>
              <button
                onClick={executeDelete}
                className="flex-1 px-4 py-2 bg-red-500 text-white font-bold rounded-lg hover:bg-red-400 text-sm"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
