import { useState, useEffect } from 'react';
import { Loader2, Server, Globe, Trash2, RefreshCw, CheckCircle, AlertCircle, Database } from 'lucide-react';
import api from '../../services/api';

interface Tenant {
  id: number;
  slug: string;
  displayName: string;
  databaseName: string;
  systemName: string;
  isActive: boolean;
}

const INPUT_CLS = 'w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:border-yellow-500 focus:outline-none';

export default function AdminTenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });
  const [creating, setCreating] = useState(false);

  const [form, setForm] = useState({
    displayName: '',
    slug: '',
    systemSlug: 'jogador',
    primaryColor: '#ef4444',
    adminEmail: '',
    adminPassword: '',
  });

  useEffect(() => {
    fetchTenants();
  }, []);

  const fetchTenants = async () => {
    setLoading(true);
    try {
      const data = await api.request<Tenant[]>('/api/super-admin/tenants');
      setTenants(data);
    } catch (err) {
      console.error('Erro ao listar tenants', err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'displayName' && !form.slug) {
      const suggestedSlug = value.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
      setForm((prev) => ({ ...prev, displayName: value, slug: suggestedSlug }));
    } else {
      setForm((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setStatus({ type: null, message: '' });

    try {
      const data = await api.request<{ message: string }>('/api/super-admin/create-tenant', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setStatus({ type: 'success', message: `Sucesso! Sistema "${data.message}" criado.` });
      setForm((prev) => ({ ...prev, displayName: '', slug: '', adminEmail: '', adminPassword: '' }));
      fetchTenants();
    } catch (error: any) {
      setStatus({ type: 'error', message: error.message || 'Erro ao criar' });
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!window.confirm(`TEM CERTEZA? Isso apagara o banco de dados do sistema "${name}" permanentemente!`)) return;

    try {
      await api.request(`/api/super-admin/tenants/${id}`, { method: 'DELETE' });
      setStatus({ type: 'success', message: `Sistema "${name}" deletado com sucesso.` });
      fetchTenants();
    } catch (error: any) {
      setStatus({ type: 'error', message: error.message || 'Erro ao deletar' });
    }
  };

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center gap-2 text-yellow-500 mb-2">
          <Server className="w-6 h-6" />
          <h1 className="text-2xl font-bold">Fabrica de Sistemas</h1>
        </div>
        <p className="text-sm text-zinc-400">Crie novas instancias de banco de dados.</p>
      </div>

      {/* Creation Form */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-3xl mx-auto">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* System type */}
          <div>
            <label className="block text-sm text-zinc-400 mb-2">Tipo de Sistema</label>
            <div className="grid grid-cols-3 gap-3">
              {['jogador', 'quadra', 'arbitro'].map((sys) => (
                <label
                  key={sys}
                  className={`cursor-pointer border rounded-lg p-3 flex flex-col items-center gap-2 transition-colors ${
                    form.systemSlug === sys
                      ? 'border-yellow-500 bg-yellow-500/10 text-yellow-500'
                      : 'border-zinc-700 hover:bg-zinc-800 text-zinc-400'
                  }`}
                >
                  <input
                    type="radio"
                    name="systemSlug"
                    value={sys}
                    checked={form.systemSlug === sys}
                    onChange={handleChange}
                    className="hidden"
                  />
                  <Database className="w-5 h-5" />
                  <span className="capitalize font-semibold text-sm">{sys}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Nome do Cliente</label>
              <input name="displayName" value={form.displayName} onChange={handleChange} placeholder="Arena Sport" className={INPUT_CLS} required />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Slug</label>
              <input name="slug" value={form.slug} onChange={handleChange} placeholder="arena-sport" className={INPUT_CLS} required />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Cor</label>
              <input type="color" name="primaryColor" value={form.primaryColor} onChange={handleChange} className="h-10 w-full bg-transparent cursor-pointer rounded-lg" />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Email Admin</label>
              <input name="adminEmail" value={form.adminEmail} onChange={handleChange} placeholder="admin@arena.com" className={INPUT_CLS} required />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Senha</label>
              <input name="adminPassword" value={form.adminPassword} onChange={handleChange} placeholder="senha123" className={INPUT_CLS} required />
            </div>
          </div>

          {status.message && (
            <div className={`p-3 rounded-lg flex items-center gap-2 text-sm ${
              status.type === 'success' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
            }`}>
              {status.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              {status.message}
            </div>
          )}

          <button
            disabled={creating}
            className="w-full px-4 py-3 bg-yellow-500 text-zinc-900 font-bold rounded-lg hover:bg-yellow-400 transition-colors disabled:opacity-50 flex items-center justify-center"
          >
            {creating ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Criar Sistema'}
          </button>
        </form>
      </div>

      {/* Tenants List */}
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Globe className="w-5 h-5 text-blue-500" />
            Sistemas Ativos
          </h2>
          <button onClick={fetchTenants} className="text-zinc-400 hover:text-white p-2 transition-colors" title="Atualizar">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          {loading ? (
            <div className="p-8 flex justify-center">
              <Loader2 className="w-6 h-6 text-yellow-500 animate-spin" />
            </div>
          ) : tenants.length === 0 ? (
            <div className="p-8 text-center text-zinc-500 text-sm">Nenhum sistema criado ainda.</div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-950 text-zinc-400 uppercase text-xs">
                <tr>
                  <th className="p-4">ID</th>
                  <th className="p-4">Cliente</th>
                  <th className="p-4">Sistema</th>
                  <th className="p-4">Banco de Dados</th>
                  <th className="p-4 text-right">Acoes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {tenants.map((t) => (
                  <tr key={t.id} className="hover:bg-zinc-800/50 transition-colors">
                    <td className="p-4 text-zinc-500 font-mono">#{t.id}</td>
                    <td className="p-4">
                      <p className="font-medium text-white">{t.displayName}</p>
                      <p className="text-xs text-zinc-500">{t.slug}</p>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded text-xs border ${
                        t.systemName === 'Campeonato' ? 'border-yellow-500/30 text-yellow-500 bg-yellow-500/10' :
                        t.systemName === 'Gestao de Quadras' ? 'border-blue-500/30 text-blue-500 bg-blue-500/10' :
                        'border-purple-500/30 text-purple-500 bg-purple-500/10'
                      }`}>
                        {t.systemName}
                      </span>
                    </td>
                    <td className="p-4 text-zinc-400 font-mono text-xs">{t.databaseName}</td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => handleDelete(t.id, t.displayName)}
                        className="text-red-500 hover:bg-red-500/10 p-2 rounded transition-colors"
                        title="Deletar Banco de Dados"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
