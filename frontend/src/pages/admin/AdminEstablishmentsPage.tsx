import { useState, useEffect, useCallback, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  fetchEstablishments,
  createEstablishment,
  activateEstablishment,
  deactivateEstablishment,
  type Establishment,
  type PaginatedResponse,
} from '../../services/adminApi';

interface Filters {
  q: string;
  status: string;
  sort_by: string;
  sort_dir: string;
}

interface CreateForm {
  name: string;
  owner_name: string;
  contact_phone: string;
  contact_email: string;
  allowed_ip: string;
  state: string;
  city: string;
}

const emptyForm: CreateForm = {
  name: '',
  owner_name: '',
  contact_phone: '',
  contact_email: '',
  allowed_ip: '',
  state: '',
  city: '',
};

export default function AdminEstablishmentsPage() {
  const navigate = useNavigate();

  // ── List state ──
  const [data, setData] = useState<PaginatedResponse<Establishment> | null>(null);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Filters>({ q: '', status: '', sort_by: 'name', sort_dir: 'asc' });
  const [loading, setLoading] = useState(false);

  // ── Create form ──
  const [form, setForm] = useState<CreateForm>(emptyForm);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  // ── Toggling state ──
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), per_page: '15' };
      if (filters.q) params.q = filters.q;
      if (filters.status) params.status = filters.status;
      if (filters.sort_by) params.sort_by = filters.sort_by;
      if (filters.sort_dir) params.sort_dir = filters.sort_dir;
      const res = await fetchEstablishments(params);
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

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');
    if (!form.name.trim()) {
      setFormError('Nome da quadra e obrigatorio.');
      return;
    }
    setCreating(true);
    try {
      await createEstablishment({
        name: form.name,
        owner_name: form.owner_name,
        contact_phone: form.contact_phone,
        contact_email: form.contact_email,
        allowed_ip: form.allowed_ip,
        state: form.state,
        city: form.city,
      });
      setFormSuccess('Estabelecimento criado com sucesso!');
      setForm(emptyForm);
      loadList();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Erro ao criar estabelecimento.');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActive = async (est: Establishment) => {
    setTogglingId(est.id);
    try {
      if (est.is_active) {
        await deactivateEstablishment(est.id);
      } else {
        await activateEstablishment(est.id);
      }
      loadList();
    } catch {
      /* silent */
    } finally {
      setTogglingId(null);
    }
  };

  const inputClass =
    'w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:border-yellow-500 focus:outline-none';

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Estabelecimentos</h1>
        <p className="text-sm text-zinc-400">Gerencie quadras e estabelecimentos cadastrados.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left: Creation Form ── */}
        <div className="lg:col-span-1">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <p className="text-xs uppercase tracking-wider text-zinc-500 font-medium mb-4">
              Novo Estabelecimento
            </p>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Nome da Quadra *</label>
                <input
                  type="text"
                  className={inputClass}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ex: Arena Pelada FC"
                />
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Responsavel</label>
                <input
                  type="text"
                  className={inputClass}
                  value={form.owner_name}
                  onChange={(e) => setForm({ ...form, owner_name: e.target.value })}
                  placeholder="Nome do responsavel"
                />
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Telefone</label>
                <input
                  type="text"
                  className={inputClass}
                  value={form.contact_phone}
                  onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
                  placeholder="(00) 00000-0000"
                />
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Email</label>
                <input
                  type="email"
                  className={inputClass}
                  value={form.contact_email}
                  onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
                  placeholder="contato@quadra.com"
                />
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-1">IP Permitido</label>
                <input
                  type="text"
                  className={inputClass}
                  value={form.allowed_ip}
                  onChange={(e) => setForm({ ...form, allowed_ip: e.target.value })}
                  placeholder="Ex: 192.168.0.1"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Estado</label>
                  <input
                    type="text"
                    className={inputClass}
                    value={form.state}
                    onChange={(e) => setForm({ ...form, state: e.target.value })}
                    placeholder="UF"
                    maxLength={2}
                  />
                </div>
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Cidade</label>
                  <input
                    type="text"
                    className={inputClass}
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    placeholder="Cidade"
                  />
                </div>
              </div>

              {formError && <p className="text-red-400 text-sm mt-2">{formError}</p>}
              {formSuccess && <p className="text-green-400 text-sm mt-2">{formSuccess}</p>}

              <button
                type="submit"
                disabled={creating}
                className="w-full px-4 py-2 bg-yellow-500 text-zinc-900 font-semibold rounded-lg hover:bg-yellow-400 transition-colors disabled:opacity-50"
              >
                {creating ? 'Criando...' : 'Criar Estabelecimento'}
              </button>
            </form>
          </div>
        </div>

        {/* ── Right: Table with filters ── */}
        <div className="lg:col-span-2">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            {/* Filters */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
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
                <option value="inactive">Inativo</option>
              </select>
              <select
                className={inputClass}
                value={filters.sort_by}
                onChange={(e) => handleFilterChange('sort_by', e.target.value)}
              >
                <option value="name">Nome</option>
                <option value="created_at">Data criacao</option>
                <option value="owner_name">Responsavel</option>
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

            {/* Table */}
            {loading ? (
              <p className="text-zinc-400 text-sm py-8 text-center">Carregando...</p>
            ) : !data || data.items.length === 0 ? (
              <p className="text-zinc-500 text-sm py-8 text-center">Nenhum estabelecimento encontrado.</p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-zinc-950 text-zinc-400 uppercase text-xs">
                      <tr>
                        <th className="p-3">Quadra</th>
                        <th className="p-3">Responsavel</th>
                        <th className="p-3">Email</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Acoes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                      {data.items.map((est) => (
                        <tr key={est.id} className="hover:bg-zinc-800/50">
                          <td className="p-3 text-white font-medium">{est.name}</td>
                          <td className="p-3 text-zinc-300">{(est as Record<string, unknown>).owner_name as string || '—'}</td>
                          <td className="p-3 text-zinc-300">{est.email || '—'}</td>
                          <td className="p-3">
                            {est.is_active ? (
                              <span className="bg-green-500/10 text-green-500 px-2 py-0.5 rounded text-xs font-medium">
                                Ativo
                              </span>
                            ) : (
                              <span className="bg-red-500/10 text-red-500 px-2 py-0.5 rounded text-xs font-medium">
                                Inativo
                              </span>
                            )}
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <button
                                className="px-4 py-2 bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 transition-colors text-xs"
                                onClick={() => navigate(`/admin/establishments/${est.id}`)}
                              >
                                Detalhes
                              </button>
                              <button
                                className="text-red-400 hover:text-red-300 text-sm"
                                disabled={togglingId === est.id}
                                onClick={() => handleToggleActive(est)}
                              >
                                {togglingId === est.id
                                  ? '...'
                                  : est.is_active
                                    ? 'Desativar'
                                    : 'Ativar'}
                              </button>
                            </div>
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
      </div>
    </div>
  );
}
