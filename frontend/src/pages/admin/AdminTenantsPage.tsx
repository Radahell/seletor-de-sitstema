import { useState, useEffect } from 'react';
import { Loader2, Server, Globe, Trash2, RefreshCw, CheckCircle, AlertCircle, Database, Pencil, Users, X, Shield, ChevronDown, ChevronUp, Plus, Layers, Eye, EyeOff } from 'lucide-react';
import api from '../../services/api';

interface SystemType {
  id: number;
  slug: string;
  displayName: string;
  description: string;
  iconName: string;
  primaryColor: string;
  baseUrl: string;
  isActive: boolean;
  displayOrder: number;
}

interface Tenant {
  id: number;
  slug: string;
  displayName: string;
  databaseName: string;
  databaseHost?: string;
  systemName: string;
  isActive: boolean;
}

interface TenantMember {
  id: number;
  name: string;
  email: string;
  phone?: string;
  role: string;
  isActive: boolean;
  joinedAt?: string;
}

const INPUT_CLS = 'w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:border-yellow-500 focus:outline-none';
const ROLE_COLORS: Record<string, string> = {
  admin: 'border-red-500/30 text-red-400 bg-red-500/10',
  manager: 'border-yellow-500/30 text-yellow-400 bg-yellow-500/10',
  staff: 'border-blue-500/30 text-blue-400 bg-blue-500/10',
  player: 'border-zinc-500/30 text-zinc-400 bg-zinc-500/10',
};

const ICON_OPTIONS = ['trophy', 'video', 'building', 'whistle', 'camera', 'users', 'star', 'shield'];

export default function AdminTenantsPage() {
  // Systems state
  const [systems, setSystems] = useState<SystemType[]>([]);
  const [loadingSystems, setLoadingSystems] = useState(false);
  const [editingSystem, setEditingSystem] = useState<SystemType | null>(null);
  const [showNewSystem, setShowNewSystem] = useState(false);
  const [systemForm, setSystemForm] = useState({
    slug: '', displayName: '', description: '', icon: 'trophy', color: '#ef4444', baseRoute: '', isActive: true, displayOrder: 0,
  });
  const [savingSystem, setSavingSystem] = useState(false);

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });
  const [creating, setCreating] = useState(false);

  // Edit state
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [editForm, setEditForm] = useState({ displayName: '', primaryColor: '#ef4444', allowRegistration: false });
  const [saving, setSaving] = useState(false);

  // Members state
  const [expandedTenant, setExpandedTenant] = useState<number | null>(null);
  const [members, setMembers] = useState<TenantMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  const [form, setForm] = useState({
    displayName: '',
    slug: '',
    systemSlug: 'jogador',
    primaryColor: '#ef4444',
    adminEmail: '',
    adminPassword: '',
  });

  useEffect(() => {
    fetchSystems();
    fetchTenants();
  }, []);

  const showStatus = (type: 'success' | 'error', message: string) => {
    setStatus({ type, message });
    setTimeout(() => setStatus({ type: null, message: '' }), 4000);
  };

  // ---- Systems CRUD ----
  const fetchSystems = async () => {
    setLoadingSystems(true);
    try {
      const data = await api.request<SystemType[]>('/api/super-admin/systems');
      setSystems(data);
    } catch (err) {
      console.error('Erro ao listar sistemas', err);
    } finally {
      setLoadingSystems(false);
    }
  };

  const handleEditSystem = (sys: SystemType) => {
    setEditingSystem(sys);
    setSystemForm({
      slug: sys.slug,
      displayName: sys.displayName,
      description: sys.description,
      icon: sys.iconName,
      color: sys.primaryColor,
      baseRoute: sys.baseUrl,
      isActive: sys.isActive,
      displayOrder: sys.displayOrder,
    });
  };

  const handleNewSystem = () => {
    setEditingSystem(null);
    setShowNewSystem(true);
    setSystemForm({ slug: '', displayName: '', description: '', icon: 'trophy', color: '#ef4444', baseRoute: '', isActive: true, displayOrder: 0 });
  };

  const handleSaveSystem = async () => {
    setSavingSystem(true);
    try {
      if (editingSystem) {
        await api.request(`/api/super-admin/systems/${editingSystem.id}`, {
          method: 'PATCH',
          body: JSON.stringify(systemForm),
        });
        showStatus('success', `Sistema "${systemForm.displayName}" atualizado!`);
      } else {
        await api.request('/api/super-admin/systems', {
          method: 'POST',
          body: JSON.stringify(systemForm),
        });
        showStatus('success', `Sistema "${systemForm.displayName}" criado!`);
      }
      setEditingSystem(null);
      setShowNewSystem(false);
      fetchSystems();
    } catch (err: any) {
      showStatus('error', err.message || 'Erro ao salvar sistema');
    } finally {
      setSavingSystem(false);
    }
  };

  const handleToggleSystem = async (sys: SystemType) => {
    try {
      if (sys.isActive) {
        await api.request(`/api/super-admin/systems/${sys.id}`, { method: 'DELETE' });
        showStatus('success', `"${sys.displayName}" desativado`);
      } else {
        await api.request(`/api/super-admin/systems/${sys.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ isActive: true }),
        });
        showStatus('success', `"${sys.displayName}" reativado`);
      }
      fetchSystems();
    } catch (err: any) {
      showStatus('error', err.message || 'Erro');
    }
  };

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

  const fetchMembers = async (tenantId: number) => {
    setLoadingMembers(true);
    try {
      const data = await api.request<TenantMember[]>(`/api/super-admin/tenants/${tenantId}/members`);
      setMembers(data);
    } catch (err) {
      console.error('Erro ao listar membros', err);
      setMembers([]);
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleToggleMembers = async (tenantId: number) => {
    if (expandedTenant === tenantId) {
      setExpandedTenant(null);
      setMembers([]);
    } else {
      setExpandedTenant(tenantId);
      await fetchMembers(tenantId);
    }
  };

  const handleChangeRole = async (tenantId: number, userId: number, newRole: string) => {
    try {
      await api.request(`/api/super-admin/tenants/${tenantId}/admins/${userId}/role`, {
        method: 'PUT',
        body: JSON.stringify({ role: newRole }),
      });
      setStatus({ type: 'success', message: 'Role atualizado!' });
      await fetchMembers(tenantId);
      setTimeout(() => setStatus({ type: null, message: '' }), 3000);
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message || 'Erro ao atualizar role' });
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

  const handleEdit = (tenant: Tenant) => {
    setEditingTenant(tenant);
    setEditForm({
      displayName: tenant.displayName,
      primaryColor: '#ef4444',
      allowRegistration: false,
    });
  };

  const handleSaveEdit = async () => {
    if (!editingTenant) return;
    setSaving(true);
    try {
      await api.request(`/api/super-admin/tenants/${editingTenant.id}`, {
        method: 'PATCH',
        body: JSON.stringify(editForm),
      });
      setStatus({ type: 'success', message: `"${editForm.displayName}" atualizado!` });
      setEditingTenant(null);
      fetchTenants();
      setTimeout(() => setStatus({ type: null, message: '' }), 3000);
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message || 'Erro ao salvar' });
    } finally {
      setSaving(false);
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
        <p className="text-sm text-zinc-400">Crie e gerencie instancias de sistemas.</p>
      </div>

      {/* ====== SYSTEMS SECTION ====== */}
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-purple-500" />
            Tipos de Sistema
          </h2>
          <div className="flex items-center gap-2">
            <button onClick={fetchSystems} className="text-zinc-400 hover:text-white p-2 transition-colors" title="Atualizar">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={handleNewSystem}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-500 text-white text-xs font-bold rounded-lg hover:bg-purple-400 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Novo Sistema
            </button>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          {loadingSystems ? (
            <div className="p-6 flex justify-center">
              <Loader2 className="w-5 h-5 text-yellow-500 animate-spin" />
            </div>
          ) : systems.length === 0 ? (
            <div className="p-6 text-center text-zinc-500 text-sm">Nenhum tipo de sistema cadastrado.</div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-950 text-zinc-400 uppercase text-xs">
                <tr>
                  <th className="p-3">Ordem</th>
                  <th className="p-3">Slug</th>
                  <th className="p-3">Nome</th>
                  <th className="p-3">Icone</th>
                  <th className="p-3">Cor</th>
                  <th className="p-3">Rota</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Acoes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {systems.map((sys) => (
                  <tr key={sys.id} className={`hover:bg-zinc-800/50 transition-colors ${!sys.isActive ? 'opacity-50' : ''}`}>
                    <td className="p-3 text-zinc-500 font-mono text-xs">{sys.displayOrder}</td>
                    <td className="p-3 font-mono text-xs text-zinc-400">{sys.slug}</td>
                    <td className="p-3 text-white font-medium">{sys.displayName}</td>
                    <td className="p-3 text-zinc-400 text-xs">{sys.iconName}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full border border-zinc-600" style={{ backgroundColor: sys.primaryColor }} />
                        <span className="text-zinc-500 text-xs font-mono">{sys.primaryColor}</span>
                      </div>
                    </td>
                    <td className="p-3 text-zinc-400 font-mono text-xs">{sys.baseUrl}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        sys.isActive ? 'text-green-400 bg-green-500/10 border border-green-500/30' : 'text-zinc-500 bg-zinc-800 border border-zinc-700'
                      }`}>
                        {sys.isActive ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="p-3 text-right flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleEditSystem(sys)}
                        className="text-yellow-500 hover:bg-yellow-500/10 p-1.5 rounded transition-colors"
                        title="Editar"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleToggleSystem(sys)}
                        className={`p-1.5 rounded transition-colors ${
                          sys.isActive ? 'text-red-400 hover:bg-red-500/10' : 'text-green-400 hover:bg-green-500/10'
                        }`}
                        title={sys.isActive ? 'Desativar' : 'Reativar'}
                      >
                        {sys.isActive ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* System Edit/Create Modal */}
      {(editingSystem || showNewSystem) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => { setEditingSystem(null); setShowNewSystem(false); }}>
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-lg shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-white">
                {editingSystem ? `Editar: ${editingSystem.displayName}` : 'Novo Tipo de Sistema'}
              </h3>
              <button onClick={() => { setEditingSystem(null); setShowNewSystem(false); }} className="text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Slug</label>
                  <input
                    value={systemForm.slug}
                    onChange={(e) => setSystemForm((p) => ({ ...p, slug: e.target.value }))}
                    disabled={!!editingSystem}
                    placeholder="ex: jogador"
                    className={`${INPUT_CLS} ${editingSystem ? 'opacity-50' : ''}`}
                  />
                </div>
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Nome de Exibicao</label>
                  <input
                    value={systemForm.displayName}
                    onChange={(e) => setSystemForm((p) => ({ ...p, displayName: e.target.value }))}
                    placeholder="ex: Campeonatos"
                    className={INPUT_CLS}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-1">Descricao</label>
                <input
                  value={systemForm.description}
                  onChange={(e) => setSystemForm((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Breve descricao do sistema"
                  className={INPUT_CLS}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Icone</label>
                  <select
                    value={systemForm.icon}
                    onChange={(e) => setSystemForm((p) => ({ ...p, icon: e.target.value }))}
                    className={INPUT_CLS}
                  >
                    {ICON_OPTIONS.map((i) => (
                      <option key={i} value={i}>{i}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Cor</label>
                  <input
                    type="color"
                    value={systemForm.color}
                    onChange={(e) => setSystemForm((p) => ({ ...p, color: e.target.value }))}
                    className="h-10 w-full bg-transparent cursor-pointer rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Ordem</label>
                  <input
                    type="number"
                    value={systemForm.displayOrder}
                    onChange={(e) => setSystemForm((p) => ({ ...p, displayOrder: parseInt(e.target.value) || 0 }))}
                    className={INPUT_CLS}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-1">Rota Base</label>
                <input
                  value={systemForm.baseRoute}
                  onChange={(e) => setSystemForm((p) => ({ ...p, baseRoute: e.target.value }))}
                  placeholder="ex: /jogador"
                  className={INPUT_CLS}
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setEditingSystem(null); setShowNewSystem(false); }}
                className="flex-1 px-4 py-2 border border-zinc-700 text-zinc-400 rounded-lg hover:bg-zinc-800 text-sm font-semibold"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveSystem}
                disabled={savingSystem}
                className="flex-1 px-4 py-2 bg-yellow-500 text-zinc-900 font-bold rounded-lg hover:bg-yellow-400 disabled:opacity-50 text-sm flex items-center justify-center"
              >
                {savingSystem ? <Loader2 className="w-4 h-4 animate-spin" /> : (editingSystem ? 'Salvar' : 'Criar')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====== TENANTS SECTION ====== */}
      {/* Creation Form */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-3xl mx-auto">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* System type - dynamic from DB */}
          <div>
            <label className="block text-sm text-zinc-400 mb-2">Tipo de Sistema</label>
            <div className="grid grid-cols-3 gap-3">
              {systems.filter(s => s.isActive).map((sys) => (
                <label
                  key={sys.slug}
                  className={`cursor-pointer border rounded-lg p-3 flex flex-col items-center gap-2 transition-colors ${
                    form.systemSlug === sys.slug
                      ? 'border-yellow-500 bg-yellow-500/10 text-yellow-500'
                      : 'border-zinc-700 hover:bg-zinc-800 text-zinc-400'
                  }`}
                >
                  <input
                    type="radio"
                    name="systemSlug"
                    value={sys.slug}
                    checked={form.systemSlug === sys.slug}
                    onChange={handleChange}
                    className="hidden"
                  />
                  <Database className="w-5 h-5" />
                  <span className="font-semibold text-sm">{sys.displayName}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Nome</label>
              <input name="displayName" value={form.displayName} onChange={handleChange} placeholder="Ex: Copa Brahma, Arena Sport" className={INPUT_CLS} required />
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
                  <>
                    <tr key={t.id} className="hover:bg-zinc-800/50 transition-colors">
                      <td className="p-4 text-zinc-500 font-mono">#{t.id}</td>
                      <td className="p-4">
                        <p className="font-medium text-white">{t.displayName}</p>
                        <p className="text-xs text-zinc-500">{t.slug}</p>
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded text-xs border ${
                          t.systemName.includes('Campeonato') || t.systemName.includes('Jogador') ? 'border-yellow-500/30 text-yellow-500 bg-yellow-500/10' :
                          t.systemName.includes('Quadra') ? 'border-blue-500/30 text-blue-500 bg-blue-500/10' :
                          t.systemName.includes('Lance') ? 'border-green-500/30 text-green-500 bg-green-500/10' :
                          'border-purple-500/30 text-purple-500 bg-purple-500/10'
                        }`}>
                          {t.systemName}
                        </span>
                      </td>
                      <td className="p-4 text-zinc-400 font-mono text-xs">{t.databaseName}</td>
                      <td className="p-4 text-right flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleToggleMembers(t.id)}
                          className="text-blue-400 hover:bg-blue-500/10 p-2 rounded transition-colors"
                          title="Ver Membros"
                        >
                          {expandedTenant === t.id ? <ChevronUp className="w-4 h-4" /> : <Users className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => handleEdit(t)}
                          className="text-yellow-500 hover:bg-yellow-500/10 p-2 rounded transition-colors"
                          title="Editar"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(t.id, t.displayName)}
                          className="text-red-500 hover:bg-red-500/10 p-2 rounded transition-colors"
                          title="Deletar Banco de Dados"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>

                    {/* Members Expansion */}
                    {expandedTenant === t.id && (
                      <tr key={`${t.id}-members`}>
                        <td colSpan={5} className="bg-zinc-950 p-4">
                          {loadingMembers ? (
                            <div className="flex justify-center py-4">
                              <Loader2 className="w-5 h-5 text-yellow-500 animate-spin" />
                            </div>
                          ) : members.length === 0 ? (
                            <p className="text-zinc-500 text-sm text-center py-2">Nenhum membro vinculado ao hub.</p>
                          ) : (
                            <div className="space-y-2">
                              <p className="text-xs text-zinc-400 font-semibold uppercase tracking-wider mb-3">
                                Membros ({members.length})
                              </p>
                              {members.map((m) => (
                                <div key={m.id} className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-lg p-3">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-white text-sm font-medium truncate">{m.name || m.email}</p>
                                    <p className="text-zinc-500 text-xs truncate">{m.email}</p>
                                  </div>
                                  <select
                                    value={m.role}
                                    onChange={(e) => handleChangeRole(t.id, m.id, e.target.value)}
                                    className="bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-white focus:border-yellow-500 focus:outline-none"
                                  >
                                    <option value="admin">Admin</option>
                                    <option value="manager">Manager</option>
                                    <option value="staff">Staff</option>
                                    <option value="player">Player</option>
                                  </select>
                                  <span className={`px-2 py-0.5 rounded text-[10px] border font-semibold uppercase ${ROLE_COLORS[m.role] || ROLE_COLORS.player}`}>
                                    {m.role}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {editingTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setEditingTenant(null)}>
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-white">Editar: {editingTenant.displayName}</h3>
              <button onClick={() => setEditingTenant(null)} className="text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Nome de Exibicao</label>
                <input
                  value={editForm.displayName}
                  onChange={(e) => setEditForm((p) => ({ ...p, displayName: e.target.value }))}
                  className={INPUT_CLS}
                />
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-1">Cor Primaria</label>
                <input
                  type="color"
                  value={editForm.primaryColor}
                  onChange={(e) => setEditForm((p) => ({ ...p, primaryColor: e.target.value }))}
                  className="h-10 w-full bg-transparent cursor-pointer rounded-lg"
                />
              </div>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editForm.allowRegistration}
                  onChange={(e) => setEditForm((p) => ({ ...p, allowRegistration: e.target.checked }))}
                  className="w-4 h-4 rounded border-zinc-600 bg-zinc-950 text-yellow-500 focus:ring-yellow-500"
                />
                <span className="text-sm text-zinc-300">Permitir registro direto (sem aprovacao)</span>
              </label>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setEditingTenant(null)}
                className="flex-1 px-4 py-2 border border-zinc-700 text-zinc-400 rounded-lg hover:bg-zinc-800 text-sm font-semibold"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={saving}
                className="flex-1 px-4 py-2 bg-yellow-500 text-zinc-900 font-bold rounded-lg hover:bg-yellow-400 disabled:opacity-50 text-sm flex items-center justify-center"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
