import { useState, useEffect, useCallback, FormEvent } from 'react';
import {
  fetchSystemUsers,
  createSystemUser,
  updateSystemUser,
  resetSystemUserPassword,
  suspendSystemUser,
  activateSystemUser,
  deleteSystemUser,
  fetchAdminAuditLogs,
  type SystemUser,
  type PaginatedResponse,
} from '../../services/adminApi';

interface UserForm {
  name: string;
  email: string;
  password: string;
  is_superuser: boolean;
}

interface Filters {
  q: string;
  status: string;
  role: string;
  sort_by: string;
  sort_dir: string;
}

interface AuditLog {
  id: number;
  action: string;
  detail?: string;
  ip_address?: string;
  created_at?: string;
  [key: string]: unknown;
}

const emptyForm: UserForm = { name: '', email: '', password: '', is_superuser: false };

export default function AdminUsersPage() {
  // ── List ──
  const [data, setData] = useState<PaginatedResponse<SystemUser> | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    q: '', status: '', role: '', sort_by: 'name', sort_dir: 'asc',
  });

  // ── Form (create / edit) ──
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  // ── Reset password ──
  const [resetPwdId, setResetPwdId] = useState<number | null>(null);
  const [resetPwdValue, setResetPwdValue] = useState('');
  const [resetPwdMsg, setResetPwdMsg] = useState('');

  // ── Audit trail ──
  const [auditUserId, setAuditUserId] = useState<number | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  // ── Action state ──
  const [actionId, setActionId] = useState<number | null>(null);
  const [listError, setListError] = useState('');

  const inputClass =
    'w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:border-yellow-500 focus:outline-none';

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), per_page: '15' };
      if (filters.q) params.q = filters.q;
      if (filters.status) params.status = filters.status;
      if (filters.role) params.role = filters.role;
      if (filters.sort_by) params.sort_by = filters.sort_by;
      if (filters.sort_dir) params.sort_dir = filters.sort_dir;
      const res = await fetchSystemUsers(params);
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

  const handleFilterChange = (field: keyof Filters, value: string) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
    setPage(1);
  };

  // ── Create / Update ──
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');
    if (!form.name || !form.email) {
      setFormError('Nome e email sao obrigatorios.');
      return;
    }
    if (!editingId && !form.password) {
      setFormError('Senha e obrigatoria para novo usuario.');
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        const payload: Record<string, unknown> = {
          name: form.name,
          email: form.email,
          is_superuser: form.is_superuser,
        };
        if (form.password) payload.password = form.password;
        await updateSystemUser(editingId, payload);
        setFormSuccess('Usuario atualizado!');
      } else {
        await createSystemUser({
          name: form.name,
          email: form.email,
          password: form.password,
          is_superuser: form.is_superuser,
        });
        setFormSuccess('Usuario criado com sucesso!');
      }
      setForm(emptyForm);
      setEditingId(null);
      loadList();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Erro ao salvar usuario.');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (user: SystemUser) => {
    setEditingId(user.id);
    setForm({
      name: user.name,
      email: user.email,
      password: '',
      is_superuser: user.is_superuser,
    });
    setFormError('');
    setFormSuccess('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormError('');
    setFormSuccess('');
  };

  // ── Reset password ──
  const handleResetPassword = async (userId: number) => {
    if (!resetPwdValue) return;
    setResetPwdMsg('');
    try {
      await resetSystemUserPassword(userId, { new_password: resetPwdValue });
      setResetPwdMsg('Senha redefinida!');
      setResetPwdValue('');
      setResetPwdId(null);
    } catch (err: unknown) {
      setResetPwdMsg(err instanceof Error ? err.message : 'Erro ao redefinir senha.');
    }
  };

  // ── Toggle status ──
  const handleToggleStatus = async (user: SystemUser) => {
    setActionId(user.id);
    setListError('');
    try {
      if (user.is_active) {
        await suspendSystemUser(user.id);
      } else {
        await activateSystemUser(user.id);
      }
      loadList();
    } catch (err: unknown) {
      setListError(err instanceof Error ? err.message : 'Erro ao alterar status.');
    } finally {
      setActionId(null);
    }
  };

  // ── Delete ──
  const handleDelete = async (user: SystemUser) => {
    if (!confirm(`Excluir usuario "${user.name}"? Esta acao nao pode ser desfeita.`)) return;
    setActionId(user.id);
    setListError('');
    try {
      await deleteSystemUser(user.id);
      loadList();
    } catch (err: unknown) {
      setListError(err instanceof Error ? err.message : 'Erro ao excluir usuario.');
    } finally {
      setActionId(null);
    }
  };

  // ── Audit logs ──
  const handleShowAudit = async (userId: number) => {
    if (auditUserId === userId) {
      setAuditUserId(null);
      setAuditLogs([]);
      return;
    }
    setAuditUserId(userId);
    setLoadingAudit(true);
    try {
      const res = await fetchAdminAuditLogs(userId, 20);
      const items = Array.isArray(res) ? res : (res as Record<string, unknown>).items as AuditLog[] || [];
      setAuditLogs(items);
    } catch {
      setAuditLogs([]);
    } finally {
      setLoadingAudit(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Usuarios do Sistema</h1>
        <p className="text-sm text-zinc-400">Gerencie administradores e operadores do painel.</p>
      </div>

      {/* ── Create / Edit form ── */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <p className="text-xs uppercase tracking-wider text-zinc-500 font-medium mb-4">
          {editingId ? 'Editar Usuario' : 'Novo Usuario'}
        </p>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Nome *</label>
            <input
              type="text"
              className={inputClass}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Nome completo"
            />
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Email *</label>
            <input
              type="email"
              className={inputClass}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="email@exemplo.com"
            />
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-1">
              Senha {editingId ? '(deixe vazio para manter)' : '*'}
            </label>
            <input
              type="password"
              className={inputClass}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="********"
            />
          </div>
          <div className="flex items-center gap-2 pt-5">
            <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_superuser}
                onChange={(e) => setForm({ ...form, is_superuser: e.target.checked })}
                className="rounded border-zinc-600 bg-zinc-950 text-yellow-500 focus:ring-yellow-500"
              />
              Super Admin
            </label>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-yellow-500 text-zinc-900 font-semibold rounded-lg hover:bg-yellow-400 transition-colors disabled:opacity-50"
            >
              {saving ? 'Salvando...' : editingId ? 'Atualizar' : 'Criar'}
            </button>
            {editingId && (
              <button
                type="button"
                className="px-4 py-2 bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 transition-colors"
                onClick={cancelEdit}
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
        {formError && <p className="text-red-400 text-sm mt-2">{formError}</p>}
        {formSuccess && <p className="text-green-400 text-sm mt-2">{formSuccess}</p>}
      </div>

      {/* ── Filters ── */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <input
            type="text"
            className={inputClass}
            placeholder="Buscar..."
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
            <option value="suspended">Suspenso</option>
          </select>
          <select
            className={inputClass}
            value={filters.role}
            onChange={(e) => handleFilterChange('role', e.target.value)}
          >
            <option value="">Todos os perfis</option>
            <option value="superuser">Super Admin</option>
            <option value="admin">Admin</option>
          </select>
          <select
            className={inputClass}
            value={filters.sort_by}
            onChange={(e) => handleFilterChange('sort_by', e.target.value)}
          >
            <option value="name">Nome</option>
            <option value="email">Email</option>
            <option value="created_at">Data criacao</option>
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

      {listError && <p className="text-red-400 text-sm">{listError}</p>}

      {/* ── Table ── */}
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
                    <th className="p-3">Email</th>
                    <th className="p-3">Perfil</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Criado em</th>
                    <th className="p-3">Acoes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {data.items.map((user) => (
                    <tr key={user.id} className="hover:bg-zinc-800/50 align-top">
                      <td className="p-3 text-white font-medium">{user.name}</td>
                      <td className="p-3 text-zinc-300">{user.email}</td>
                      <td className="p-3">
                        {user.is_superuser ? (
                          <span className="bg-yellow-500/10 text-yellow-500 px-2 py-0.5 rounded text-xs font-medium">
                            Super Admin
                          </span>
                        ) : (
                          <span className="bg-zinc-700 text-zinc-300 px-2 py-0.5 rounded text-xs font-medium">
                            Admin
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        {user.is_active ? (
                          <span className="bg-green-500/10 text-green-500 px-2 py-0.5 rounded text-xs font-medium">
                            Ativo
                          </span>
                        ) : (
                          <span className="bg-red-500/10 text-red-500 px-2 py-0.5 rounded text-xs font-medium">
                            Suspenso
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-zinc-400 text-xs whitespace-nowrap">
                        {user.created_at
                          ? new Date(user.created_at).toLocaleDateString('pt-BR')
                          : '—'}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            className="px-4 py-2 bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 transition-colors text-xs"
                            onClick={() => startEdit(user)}
                          >
                            Editar
                          </button>
                          <button
                            className="text-red-400 hover:text-red-300 text-sm"
                            onClick={() => {
                              if (resetPwdId === user.id) {
                                setResetPwdId(null);
                              } else {
                                setResetPwdId(user.id);
                                setResetPwdValue('');
                                setResetPwdMsg('');
                              }
                            }}
                          >
                            {resetPwdId === user.id ? 'Fechar' : 'Reset Senha'}
                          </button>
                          <button
                            className="text-red-400 hover:text-red-300 text-sm"
                            disabled={actionId === user.id}
                            onClick={() => handleToggleStatus(user)}
                          >
                            {user.is_active ? 'Suspender' : 'Ativar'}
                          </button>
                          <button
                            className="text-red-400 hover:text-red-300 text-sm"
                            disabled={actionId === user.id}
                            onClick={() => handleDelete(user)}
                          >
                            Excluir
                          </button>
                          <button
                            className="px-4 py-2 bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 transition-colors text-xs"
                            onClick={() => handleShowAudit(user.id)}
                          >
                            {auditUserId === user.id ? 'Fechar Acoes' : 'Ver Acoes'}
                          </button>
                        </div>

                        {/* Reset password inline */}
                        {resetPwdId === user.id && (
                          <div className="mt-2 flex items-center gap-2">
                            <input
                              type="password"
                              className={inputClass}
                              placeholder="Nova senha"
                              value={resetPwdValue}
                              onChange={(e) => setResetPwdValue(e.target.value)}
                            />
                            <button
                              className="px-4 py-2 bg-yellow-500 text-zinc-900 font-semibold rounded-lg hover:bg-yellow-400 transition-colors disabled:opacity-50 text-xs whitespace-nowrap"
                              onClick={() => handleResetPassword(user.id)}
                              disabled={!resetPwdValue}
                            >
                              Redefinir
                            </button>
                            {resetPwdMsg && (
                              <span className="text-green-400 text-xs">{resetPwdMsg}</span>
                            )}
                          </div>
                        )}

                        {/* Audit trail panel */}
                        {auditUserId === user.id && (
                          <div className="mt-3 bg-zinc-950 border border-zinc-800 rounded-lg p-3">
                            <p className="text-xs uppercase tracking-wider text-zinc-500 font-medium mb-2">
                              Historico de Acoes
                            </p>
                            {loadingAudit ? (
                              <p className="text-zinc-400 text-xs">Carregando...</p>
                            ) : auditLogs.length === 0 ? (
                              <p className="text-zinc-500 text-xs">Nenhuma acao registrada.</p>
                            ) : (
                              <div className="space-y-2 max-h-48 overflow-y-auto">
                                {auditLogs.map((log) => (
                                  <div key={log.id} className="flex items-start gap-2 text-xs">
                                    <span className="text-zinc-500 whitespace-nowrap">
                                      {log.created_at
                                        ? new Date(log.created_at).toLocaleString('pt-BR')
                                        : '—'}
                                    </span>
                                    <span className="bg-zinc-700 text-zinc-300 px-2 py-0.5 rounded text-xs font-medium">
                                      {log.action}
                                    </span>
                                    {log.detail && (
                                      <span className="text-zinc-400">{log.detail}</span>
                                    )}
                                    {log.ip_address && (
                                      <span className="text-zinc-600 ml-auto">{log.ip_address}</span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
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
