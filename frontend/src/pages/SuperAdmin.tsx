import React, { useState, useEffect } from 'react';
import { Database, Server, User, Key, Palette, Globe, CheckCircle, AlertCircle, Loader2, LogOut, Lock, Trash2, RefreshCw } from 'lucide-react';

// Tipo para os Tenants listados
interface Tenant {
  id: number;
  slug: string;
  displayName: string;
  databaseName: string;
  systemName: string;
  isActive: boolean;
}

export function SuperAdmin() {
  // === AUTH STATE ===
  const [token, setToken] = useState<string | null>(localStorage.getItem('sa_token'));
  const [adminName, setAdminName] = useState(localStorage.getItem('sa_name') || '');
  
  // === LOGIN STATE ===
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  // === APP STATE ===
  const [loading, setLoading] = useState(false);
  const [tenants, setTenants] = useState<Tenant[]>([]); // Lista de clientes
  const [status, setStatus] = useState<{ type: 'success' | 'error' | null, message: string }>({ type: null, message: '' });

  // === FORM STATE ===
  const [form, setForm] = useState({
    displayName: '',
    slug: '',
    systemSlug: 'jogador',
    primaryColor: '#ef4444',
    adminEmail: '',
    adminPassword: ''
  });

  // Carrega a lista de tenants ao iniciar (se estiver logado)
  useEffect(() => {
    if (token) fetchTenants();
  }, [token]);

  // Função para buscar a lista
  const fetchTenants = async () => {
    try {
      const res = await fetch('/seletor-api/api/super-admin/tenants', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setTenants(data);
    } catch (error) {
      console.error("Erro ao listar tenants", error);
    }
  };

  // Função de Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoggingIn(true);
    setLoginError('');

    try {
      const res = await fetch('/seletor-api/api/super-admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro no login');

      localStorage.setItem('sa_token', data.token);
      localStorage.setItem('sa_name', data.name);
      setToken(data.token);
      setAdminName(data.name);
    } catch (err: any) {
      setLoginError(err.message);
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('sa_token');
    localStorage.removeItem('sa_name');
    setToken(null);
  };

  // Função de Criar
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus({ type: null, message: '' });

    try {
      const response = await fetch('/seletor-api/api/super-admin/create-tenant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(form),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) { handleLogout(); throw new Error("Sessão expirada."); }
        throw new Error(data.error || 'Erro ao criar');
      }

      setStatus({ type: 'success', message: `Sucesso! Sistema "${data.message}" criado.` });
      setForm(prev => ({ ...prev, displayName: '', slug: '', adminEmail: '' }));
      fetchTenants(); // Atualiza a lista após criar

    } catch (error: any) {
      setStatus({ type: 'error', message: error.message });
    } finally {
      setLoading(false);
    }
  };

  // Função de DELETAR
  const handleDelete = async (id: number, name: string) => {
    if (!window.confirm(`TEM CERTEZA? Isso apagará o banco de dados do sistema "${name}" permanentemente!`)) return;

    try {
      const res = await fetch(`/seletor-api/api/super-admin/tenants/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.ok) {
        setStatus({ type: 'success', message: `Sistema "${name}" deletado com sucesso.` });
        fetchTenants(); // Atualiza a lista
      } else {
        const data = await res.json();
        alert("Erro ao deletar: " + data.error);
      }
    } catch (error) {
      alert("Erro de conexão ao deletar.");
    }
  };

  // Utilitário para form
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'displayName' && !form.slug) {
      const suggestedSlug = value.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
      setForm(prev => ({ ...prev, displayName: value, slug: suggestedSlug }));
    } else {
      setForm(prev => ({ ...prev, [name]: value }));
    }
  };

  // --- RENDER: LOGIN ---
  if (!token) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
            <div className="text-center mb-8">
                 <div className="inline-flex p-4 bg-yellow-500/10 rounded-full text-yellow-500 mb-4 ring-1 ring-yellow-500/20">
                    <Lock className="w-8 h-8" />
                 </div>
                 <h1 className="text-2xl font-bold text-white">Acesso Restrito</h1>
                 <p className="text-zinc-500">Área administrativa do VarzeaPrime</p>
            </div>
            <form onSubmit={handleLogin} className="bg-zinc-900 border border-zinc-800 p-8 rounded-xl shadow-2xl space-y-6">
                {loginError && <div className="text-red-500 text-sm text-center">{loginError}</div>}
                <div className="space-y-4">
                    <input type="email" className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-3 text-white" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@varzea.com" required />
                    <input type="password" className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-3 text-white" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••" required />
                </div>
                <button disabled={loggingIn} className="w-full bg-yellow-500 hover:bg-yellow-400 text-zinc-900 font-bold py-3 rounded-lg flex justify-center">
                    {loggingIn ? <Loader2 className="animate-spin" /> : "Entrar"}
                </button>
            </form>
        </div>
      </div>
    );
  }

  // --- RENDER: PAINEL ---
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6 flex flex-col items-center">
      
      <button onClick={handleLogout} className="absolute top-6 right-6 flex items-center gap-2 text-zinc-400 hover:text-white bg-zinc-900 px-4 py-2 rounded-full border border-zinc-800 text-sm">
        <LogOut className="w-4 h-4" /> Sair
      </button>

      <div className="w-full max-w-4xl mt-12 space-y-12">
        
        {/* === SESSÃO 1: FORMULÁRIO DE CRIAÇÃO === */}
        <div>
            <div className="text-center mb-8">
                <h1 className="text-3xl font-bold text-yellow-500 mb-2 flex items-center justify-center gap-2">
                    <Server className="w-8 h-8" /> Fábrica de Sistemas
                </h1>
                <p className="text-zinc-400">Crie novas instâncias de banco de dados.</p>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 shadow-2xl">
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* ... (SEUS INPUTS DE CRIAÇÃO MANTIDOS IGUAIS) ... */}
                    <div>
                        <label className="block text-sm font-medium text-zinc-400 mb-2">Tipo de Sistema</label>
                        <div className="grid grid-cols-3 gap-4">
                            {['jogador', 'quadra', 'arbitro'].map(sys => (
                                <label key={sys} className={`cursor-pointer border rounded-lg p-3 flex flex-col items-center gap-2 ${form.systemSlug === sys ? 'border-yellow-500 bg-yellow-500/10 text-yellow-500' : 'border-zinc-700 hover:bg-zinc-800'}`}>
                                    <input type="radio" name="systemSlug" value={sys} checked={form.systemSlug === sys} onChange={handleChange} className="hidden" />
                                    <Database className="w-5 h-5" />
                                    <span className="capitalize font-semibold">{sys}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <input name="displayName" value={form.displayName} onChange={handleChange} placeholder="Nome do Cliente" className="bg-zinc-950 border border-zinc-700 rounded-lg p-3 w-full" required />
                        <input name="slug" value={form.slug} onChange={handleChange} placeholder="slug-url" className="bg-zinc-950 border border-zinc-700 rounded-lg p-3 w-full" required />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <input type="color" name="primaryColor" value={form.primaryColor} onChange={handleChange} className="h-12 w-full bg-transparent cursor-pointer rounded-lg" />
                        <input name="adminEmail" value={form.adminEmail} onChange={handleChange} placeholder="Email Admin" className="bg-zinc-950 border border-zinc-700 rounded-lg p-3 w-full" required />
                        <input name="adminPassword" value={form.adminPassword} onChange={handleChange} placeholder="Senha" className="bg-zinc-950 border border-zinc-700 rounded-lg p-3 w-full" required />
                    </div>

                    {status.message && (
                        <div className={`p-3 rounded-lg flex items-center gap-2 ${status.type === 'success' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                            {status.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                            {status.message}
                        </div>
                    )}

                    <button disabled={loading} className="w-full bg-yellow-500 hover:bg-yellow-400 text-zinc-900 font-bold py-3 rounded-lg flex justify-center">
                        {loading ? <Loader2 className="animate-spin" /> : "Criar Sistema"}
                    </button>
                </form>
            </div>
        </div>

        {/* === SESSÃO 2: LISTA DE SISTEMAS (COM DELETE) === */}
        <div className="pb-12">
            <div className="flex items-center justify-between mb-4 px-2">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Globe className="w-5 h-5 text-blue-500" /> Sistemas Ativos
                </h2>
                <button onClick={fetchTenants} className="text-zinc-400 hover:text-white p-2" title="Atualizar Lista">
                    <RefreshCw className="w-4 h-4" />
                </button>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-lg">
                {tenants.length === 0 ? (
                    <div className="p-8 text-center text-zinc-500">Nenhum sistema criado ainda.</div>
                ) : (
                    <table className="w-full text-left text-sm">
                        <thead className="bg-zinc-950 text-zinc-400 uppercase font-medium">
                            <tr>
                                <th className="p-4">ID</th>
                                <th className="p-4">Cliente</th>
                                <th className="p-4">Sistema</th>
                                <th className="p-4">Banco de Dados</th>
                                <th className="p-4 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800">
                            {tenants.map((t) => (
                                <tr key={t.id} className="hover:bg-zinc-800/50 transition-colors">
                                    <td className="p-4 text-zinc-500 font-mono">#{t.id}</td>
                                    <td className="p-4 font-medium text-white">
                                        {t.displayName}
                                        <div className="text-xs text-zinc-500">{t.slug}</div>
                                    </td>
                                    <td className="p-4">
                                        <span className={`px-2 py-1 rounded text-xs border ${
                                            t.systemName === 'Campeonato' ? 'border-yellow-500/30 text-yellow-500 bg-yellow-500/10' :
                                            t.systemName === 'Gestão de Quadras' ? 'border-blue-500/30 text-blue-500 bg-blue-500/10' :
                                            'border-purple-500/30 text-purple-500 bg-purple-500/10'
                                        }`}>
                                            {t.systemName}
                                        </span>
                                    </td>
                                    <td className="p-4 text-zinc-400 font-mono text-xs">{t.databaseName}</td>
                                    <td className="p-4 text-right">
                                        <button 
                                            onClick={() => handleDelete(t.id, t.displayName)}
                                            className="text-red-500 hover:bg-red-500/10 p-2 rounded transition-colors group"
                                            title="Deletar Banco de Dados"
                                        >
                                            <Trash2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
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
    </div>
  );
}