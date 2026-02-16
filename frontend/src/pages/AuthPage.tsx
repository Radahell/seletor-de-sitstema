import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, UserPlus, Mail, Lock, User, Phone, ArrowRight, AlertCircle, MapPin, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import api, { ApiError, type SystemInfo } from '../services/api';
import { ESTADOS, fetchCidadesByUF, getTimezoneByUF, type Cidade } from '../lib/ibge';
import { fetchAddressByCep } from '../lib/viacep';

type AuthMode = 'login' | 'register';

export default function AuthPage() {
  const navigate = useNavigate();
  const { login, register } = useAuth();

  const [mode, setMode] = useState<AuthMode>('login');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [phone, setPhone] = useState('');
  const [state, setState] = useState('');
  const [city, setCity] = useState('');
  const [cidades, setCidades] = useState<Cidade[]>([]);
  const [loadingCidades, setLoadingCidades] = useState(false);

  // Address fields
  const [cep, setCep] = useState('');
  const [logradouro, setLogradouro] = useState('');
  const [numero, setNumero] = useState('');
  const [bairro, setBairro] = useState('');
  const [complemento, setComplemento] = useState('');
  const [loadingCep, setLoadingCep] = useState(false);

  // Interests
  const [systems, setSystems] = useState<SystemInfo[]>([]);
  const [selectedInterests, setSelectedInterests] = useState<number[]>([]);

  // Carrega sistemas disponíveis
  useEffect(() => {
    api.getSystems().then(setSystems).catch(() => {});
  }, []);

  // Busca cidades quando o estado muda
  useEffect(() => {
    if (!state) {
      setCidades([]);
      setCity('');
      return;
    }
    setLoadingCidades(true);
    setCity('');
    fetchCidadesByUF(state)
      .then(setCidades)
      .finally(() => setLoadingCidades(false));
  }, [state]);

  // Auto-fill endereço via CEP
  const handleCepChange = async (value: string) => {
    setCep(value);
    const clean = value.replace(/\D/g, '');
    if (clean.length === 8) {
      setLoadingCep(true);
      const addr = await fetchAddressByCep(clean);
      if (addr) {
        setLogradouro(addr.logradouro);
        setBairro(addr.bairro);
        setCity(addr.localidade);
        setState(addr.uf);
      }
      setLoadingCep(false);
    }
  };

  const toggleInterest = (systemId: number) => {
    setSelectedInterests((prev) =>
      prev.includes(systemId)
        ? prev.filter((id) => id !== systemId)
        : [...prev, systemId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        const timezone = state ? getTimezoneByUF(state) : undefined;
        await register({
          name, email, password,
          nickname: nickname || undefined,
          phone: phone || undefined,
          cep: cep || undefined,
          logradouro: logradouro || undefined,
          numero: numero || undefined,
          bairro: bairro || undefined,
          complemento: complemento || undefined,
          city: city || undefined,
          state: state || undefined,
          timezone,
          interests: selectedInterests.length > 0 ? selectedInterests : undefined,
        });
      }
      const joinIntent = localStorage.getItem('join_intent');
      if (joinIntent) {
        localStorage.removeItem('join_intent');
        navigate(`/discover/${joinIntent}`);
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Erro ao processar. Tente novamente.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMode = () => {
    setMode(mode === 'login' ? 'register' : 'login');
    setError(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-red-500/20">
            <span className="text-3xl font-black text-white">LO</span>
          </div>
          <h1 className="text-2xl font-black text-white uppercase tracking-tight">
            Lance de Ouro
          </h1>
          <p className="text-zinc-500 text-sm mt-1">
            Sistema Unificado
          </p>
        </div>

        {/* Card */}
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/50 p-8 shadow-2xl backdrop-blur-sm">
          {/* Tabs */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setMode('login')}
              className={`flex-1 py-3 rounded-xl font-bold text-sm uppercase tracking-wider transition-all ${
                mode === 'login'
                  ? 'bg-red-500 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:text-white'
              }`}
            >
              <LogIn className="w-4 h-4 inline mr-2" />
              Entrar
            </button>
            <button
              onClick={() => setMode('register')}
              className={`flex-1 py-3 rounded-xl font-bold text-sm uppercase tracking-wider transition-all ${
                mode === 'register'
                  ? 'bg-red-500 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:text-white'
              }`}
            >
              <UserPlus className="w-4 h-4 inline mr-2" />
              Criar Conta
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-2 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">
                    Nome completo *
                  </label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Seu nome"
                      required
                      className="w-full pl-12 pr-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 focus:border-red-500 focus:outline-none transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">
                    Apelido (opcional)
                  </label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                    <input
                      type="text"
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value)}
                      placeholder="Como quer ser chamado"
                      className="w-full pl-12 pr-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 focus:border-red-500 focus:outline-none transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">
                    Telefone (opcional)
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="(00) 00000-0000"
                      className="w-full pl-12 pr-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 focus:border-red-500 focus:outline-none transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">
                    <MapPin className="w-4 h-4 inline mr-1" />
                    Endereço (opcional)
                  </label>
                  <div className="space-y-3">
                    <div className="relative">
                      <input
                        type="text"
                        value={cep}
                        onChange={(e) => handleCepChange(e.target.value)}
                        placeholder="CEP (auto-preenche)"
                        maxLength={9}
                        className="w-full px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 focus:border-red-500 focus:outline-none transition-colors"
                      />
                      {loadingCep && (
                        <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 animate-spin" />
                      )}
                    </div>
                    <input
                      type="text"
                      value={logradouro}
                      onChange={(e) => setLogradouro(e.target.value)}
                      placeholder="Logradouro"
                      className="w-full px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 focus:border-red-500 focus:outline-none transition-colors"
                    />
                    <div className="flex gap-3">
                      <input
                        type="text"
                        value={numero}
                        onChange={(e) => setNumero(e.target.value)}
                        placeholder="Nº"
                        className="w-24 px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 focus:border-red-500 focus:outline-none transition-colors"
                      />
                      <input
                        type="text"
                        value={bairro}
                        onChange={(e) => setBairro(e.target.value)}
                        placeholder="Bairro"
                        className="flex-1 px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 focus:border-red-500 focus:outline-none transition-colors"
                      />
                    </div>
                    <input
                      type="text"
                      value={complemento}
                      onChange={(e) => setComplemento(e.target.value)}
                      placeholder="Complemento"
                      className="w-full px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 focus:border-red-500 focus:outline-none transition-colors"
                    />
                    <div className="flex gap-3">
                      <select
                        value={state}
                        onChange={(e) => setState(e.target.value)}
                        className="w-24 px-3 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white focus:border-red-500 focus:outline-none transition-colors appearance-none cursor-pointer"
                      >
                        <option value="">UF</option>
                        {ESTADOS.map((e) => (
                          <option key={e.sigla} value={e.sigla}>{e.sigla}</option>
                        ))}
                      </select>

                      <select
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        disabled={!state || loadingCidades}
                        className="flex-1 px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white focus:border-red-500 focus:outline-none transition-colors disabled:opacity-40 appearance-none cursor-pointer"
                      >
                        <option value="">
                          {loadingCidades ? 'Carregando...' : state ? 'Selecione a cidade' : 'Selecione o UF primeiro'}
                        </option>
                        {cidades.map((c) => (
                          <option key={c.id} value={c.nome}>{c.nome}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {systems.length > 0 && (
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">
                      Quais serviços te interessam?
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {systems.map((sys) => (
                        <button
                          key={sys.id}
                          type="button"
                          onClick={() => toggleInterest(sys.id)}
                          className={`px-3 py-2.5 rounded-xl text-sm font-medium text-left transition-all border ${
                            selectedInterests.includes(sys.id)
                              ? 'border-red-500 bg-red-500/10 text-white'
                              : 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-600'
                          }`}
                        >
                          {sys.displayName}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">
                Email *
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  required
                  className="w-full pl-12 pr-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 focus:border-red-500 focus:outline-none transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">
                Senha *
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'register' ? 'Mínimo 6 caracteres' : '••••••••'}
                  required
                  minLength={mode === 'register' ? 6 : undefined}
                  className="w-full pl-12 pr-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 focus:border-red-500 focus:outline-none transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-red-500 to-orange-500 text-white font-bold uppercase tracking-wider flex items-center justify-center gap-2 hover:from-red-600 hover:to-orange-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-red-500/20"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  {mode === 'login' ? 'Entrar' : 'Criar Conta'}
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          {/* Toggle */}
          <p className="text-center text-sm text-zinc-500 mt-6">
            {mode === 'login' ? (
              <>
                Não tem conta?{' '}
                <button onClick={toggleMode} className="text-red-400 hover:text-red-300 font-bold">
                  Criar agora
                </button>
              </>
            ) : (
              <>
                Já tem conta?{' '}
                <button onClick={toggleMode} className="text-red-400 hover:text-red-300 font-bold">
                  Fazer login
                </button>
              </>
            )}
          </p>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-zinc-600 mt-6">
          Ao continuar, você concorda com os Termos de Uso
        </p>
      </div>
    </div>
  );
}
