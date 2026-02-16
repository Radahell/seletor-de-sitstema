import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, User, Mail, Phone, Edit2, Save, X, Key, LogOut,
  Loader2, Check, AlertCircle, MapPin
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import api, { ApiError, type SystemInfo, type UserInterest } from '../services/api';
import { ESTADOS, fetchCidadesByUF, getTimezoneByUF, type Cidade } from '../lib/ibge';
import { fetchAddressByCep } from '../lib/viacep';

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, refreshUser, logout } = useAuth();

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Edit fields
  const [name, setName] = useState(user?.name || '');
  const [nickname, setNickname] = useState(user?.nickname || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [cpf, setCpf] = useState(user?.cpf || '');
  const [cnpj, setCnpj] = useState(user?.cnpj || '');
  const [cep, setCep] = useState(user?.cep || '');
  const [logradouro, setLogradouro] = useState(user?.logradouro || '');
  const [numero, setNumero] = useState(user?.numero || '');
  const [bairro, setBairro] = useState(user?.bairro || '');
  const [complemento, setComplemento] = useState(user?.complemento || '');
  const [city, setCity] = useState(user?.city || '');
  const [state, setState] = useState(user?.state || '');
  const [cidades, setCidades] = useState<Cidade[]>([]);
  const [loadingCidades, setLoadingCidades] = useState(false);
  const [loadingCep, setLoadingCep] = useState(false);

  // Interests
  const [systems, setSystems] = useState<SystemInfo[]>([]);
  const [selectedInterests, setSelectedInterests] = useState<number[]>([]);
  const [savingInterests, setSavingInterests] = useState(false);

  // Password fields
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Carrega sistemas e interesses
  useEffect(() => {
    api.getSystems().then(setSystems).catch(() => {});
    api.getMyInterests().then((list) => {
      setSelectedInterests(list.map((i) => i.systemId));
    }).catch(() => {});
  }, []);

  // Busca cidades quando o estado muda
  useEffect(() => {
    if (!state) {
      setCidades([]);
      return;
    }
    setLoadingCidades(true);
    fetchCidadesByUF(state)
      .then((list) => {
        setCidades(list);
        if (city && !list.some((c) => c.nome === city)) {
          setCity('');
        }
      })
      .finally(() => setLoadingCidades(false));
  }, [state]);

  // Carrega cidades iniciais se já tem estado definido
  useEffect(() => {
    if (user?.state) {
      fetchCidadesByUF(user.state).then(setCidades);
    }
  }, []);

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

  const handleSaveInterests = async () => {
    setSavingInterests(true);
    try {
      await api.updateMyInterests(selectedInterests);
      setMessage({ type: 'success', text: 'Interesses atualizados!' });
    } catch {
      setMessage({ type: 'error', text: 'Erro ao salvar interesses.' });
    } finally {
      setSavingInterests(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);

    try {
      const timezone = state ? getTimezoneByUF(state) : undefined;
      await api.updateProfile({
        name,
        nickname: nickname || undefined,
        phone: phone || undefined,
        bio: bio || undefined,
        cpf: cpf || undefined,
        cnpj: cnpj || undefined,
        cep: cep || undefined,
        logradouro: logradouro || undefined,
        numero: numero || undefined,
        bairro: bairro || undefined,
        complemento: complemento || undefined,
        city: city || undefined,
        state: state || undefined,
        timezone,
      });

      await refreshUser();
      setIsEditing(false);
      setMessage({ type: 'success', text: 'Perfil atualizado com sucesso!' });
    } catch (err) {
      if (err instanceof ApiError) {
        setMessage({ type: 'error', text: err.message });
      } else {
        setMessage({ type: 'error', text: 'Erro ao salvar. Tente novamente.' });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async () => {
    setIsChangingPassword(true);
    setMessage(null);

    try {
      await api.changePassword(currentPassword, newPassword);
      setShowPasswordModal(false);
      setCurrentPassword('');
      setNewPassword('');
      setMessage({ type: 'success', text: 'Senha alterada com sucesso!' });
    } catch (err) {
      if (err instanceof ApiError) {
        setMessage({ type: 'error', text: err.message });
      } else {
        setMessage({ type: 'error', text: 'Erro ao alterar senha.' });
      }
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/auth');
  };

  const cancelEdit = () => {
    setName(user?.name || '');
    setNickname(user?.nickname || '');
    setPhone(user?.phone || '');
    setBio(user?.bio || '');
    setCpf(user?.cpf || '');
    setCnpj(user?.cnpj || '');
    setCep(user?.cep || '');
    setLogradouro(user?.logradouro || '');
    setNumero(user?.numero || '');
    setBairro(user?.bairro || '');
    setComplemento(user?.complemento || '');
    setCity(user?.city || '');
    setState(user?.state || '');
    setIsEditing(false);
  };

  // Formata endereço para exibição read-only
  const formattedAddress = [
    logradouro || user?.logradouro,
    (numero || user?.numero) && `n${"\u00BA"} ${numero || user?.numero}`,
    bairro || user?.bairro,
  ].filter(Boolean).join(', ');

  const formattedLocation = [
    user?.city,
    user?.state && `${user.state}`,
  ].filter(Boolean).join('/');

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 px-4 py-8">
      <div className="max-w-2xl mx-auto">
        {/* Back button */}
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          Voltar ao Dashboard
        </button>

        {/* Message */}
        {message && (
          <div
            className={`mb-6 p-4 rounded-xl flex items-center gap-2 ${
              message.type === 'success'
                ? 'bg-green-500/10 border border-green-500/20 text-green-400'
                : 'bg-red-500/10 border border-red-500/20 text-red-400'
            }`}
          >
            {message.type === 'success' ? (
              <Check className="w-5 h-5" />
            ) : (
              <AlertCircle className="w-5 h-5" />
            )}
            {message.text}
          </div>
        )}

        {/* Profile Card */}
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
          {/* Header */}
          <div className="h-24 bg-gradient-to-r from-red-500 to-orange-500 relative">
            <div className="absolute -bottom-12 left-6">
              <div className="w-24 h-24 rounded-2xl bg-zinc-800 border-4 border-zinc-900 flex items-center justify-center text-3xl font-black text-white overflow-hidden">
                {user?.avatarUrl ? (
                  <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  user?.name?.charAt(0).toUpperCase()
                )}
              </div>
            </div>

            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="absolute top-4 right-4 px-3 py-1.5 rounded-lg bg-black/30 text-white text-sm font-medium hover:bg-black/50 transition-colors flex items-center gap-1"
              >
                <Edit2 className="w-4 h-4" />
                Editar
              </button>
            )}
          </div>

          {/* Content */}
          <div className="pt-16 p-6">
            {isEditing ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">
                    Nome completo
                  </label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white focus:border-red-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">
                    Apelido
                  </label>
                  <input
                    type="text"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder="Como quer ser chamado"
                    className="w-full px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 focus:border-red-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">
                    Telefone
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="(00) 00000-0000"
                      className="w-full pl-12 pr-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 focus:border-red-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">
                      CPF
                    </label>
                    <input
                      type="text"
                      value={cpf}
                      onChange={(e) => setCpf(e.target.value)}
                      placeholder="000.000.000-00"
                      maxLength={14}
                      className="w-full px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 focus:border-red-500 focus:outline-none"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">
                      CNPJ
                    </label>
                    <input
                      type="text"
                      value={cnpj}
                      onChange={(e) => setCnpj(e.target.value)}
                      placeholder="00.000.000/0000-00"
                      maxLength={18}
                      className="w-full px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 focus:border-red-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">
                    Bio
                  </label>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Conte um pouco sobre você..."
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 focus:border-red-500 focus:outline-none resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">
                    <MapPin className="w-4 h-4 inline mr-1" />
                    Endereço
                  </label>
                  <div className="space-y-3">
                    <div className="relative">
                      <input
                        type="text"
                        value={cep}
                        onChange={(e) => handleCepChange(e.target.value)}
                        placeholder="CEP (auto-preenche)"
                        maxLength={9}
                        className="w-full px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 focus:border-red-500 focus:outline-none"
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
                      className="w-full px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 focus:border-red-500 focus:outline-none"
                    />
                    <div className="flex gap-3">
                      <input
                        type="text"
                        value={numero}
                        onChange={(e) => setNumero(e.target.value)}
                        placeholder="N"
                        className="w-24 px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 focus:border-red-500 focus:outline-none"
                      />
                      <input
                        type="text"
                        value={bairro}
                        onChange={(e) => setBairro(e.target.value)}
                        placeholder="Bairro"
                        className="flex-1 px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 focus:border-red-500 focus:outline-none"
                      />
                    </div>
                    <input
                      type="text"
                      value={complemento}
                      onChange={(e) => setComplemento(e.target.value)}
                      placeholder="Complemento"
                      className="w-full px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 focus:border-red-500 focus:outline-none"
                    />
                    <div className="flex gap-3">
                      <select
                        value={state}
                        onChange={(e) => {
                          setState(e.target.value);
                          setCity('');
                        }}
                        className="w-24 px-3 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white focus:border-red-500 focus:outline-none appearance-none cursor-pointer"
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
                        className="flex-1 px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white focus:border-red-500 focus:outline-none disabled:opacity-40 appearance-none cursor-pointer"
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

                <div className="flex gap-2 pt-4">
                  <button
                    onClick={cancelEdit}
                    className="flex-1 py-3 rounded-xl bg-zinc-800 text-zinc-400 font-bold hover:bg-zinc-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <X className="w-5 h-5" />
                    Cancelar
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex-1 py-3 rounded-xl bg-gradient-to-r from-red-500 to-orange-500 text-white font-bold hover:from-red-600 hover:to-orange-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isSaving ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <Save className="w-5 h-5" />
                        Salvar
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h1 className="text-2xl font-black text-white">
                  {user?.nickname || user?.name}
                </h1>

                {user?.nickname && (
                  <p className="text-zinc-400">{user.name}</p>
                )}

                {user?.bio && (
                  <p className="text-zinc-500 mt-2">{user.bio}</p>
                )}

                <div className="mt-6 space-y-3">
                  <div className="flex items-center gap-3 text-zinc-400">
                    <Mail className="w-5 h-5" />
                    <span>{user?.email}</span>
                  </div>

                  {user?.phone && (
                    <div className="flex items-center gap-3 text-zinc-400">
                      <Phone className="w-5 h-5" />
                      <span>{user.phone}</span>
                    </div>
                  )}

                  {(user?.cpf || user?.cnpj) && (
                    <div className="flex items-center gap-3 text-zinc-400">
                      <User className="w-5 h-5" />
                      <span>
                        {user.cpf && `CPF: ${user.cpf}`}
                        {user.cpf && user.cnpj && ' | '}
                        {user.cnpj && `CNPJ: ${user.cnpj}`}
                      </span>
                    </div>
                  )}

                  {(user?.logradouro || user?.city) && (
                    <div className="flex items-start gap-3 text-zinc-400">
                      <MapPin className="w-5 h-5 mt-0.5" />
                      <div>
                        {user.logradouro && (
                          <span>
                            {user.logradouro}
                            {user.numero && `, n\u00BA ${user.numero}`}
                            {user.bairro && ` - ${user.bairro}`}
                          </span>
                        )}
                        {user.complemento && (
                          <span className="text-zinc-500"> ({user.complemento})</span>
                        )}
                        {(user.city || user.state) && (
                          <div className="text-zinc-500">
                            {user.city}{user.state && `/${user.state}`}
                            {user.cep && ` - CEP ${user.cep}`}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Interests Card */}
        {systems.length > 0 && (
          <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
            <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-500 mb-3">
              Serviços de interesse
            </h3>
            <div className="grid grid-cols-2 gap-2 mb-4">
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
            <button
              onClick={handleSaveInterests}
              disabled={savingInterests}
              className="w-full py-2.5 rounded-xl bg-zinc-800 text-zinc-300 text-sm font-bold hover:bg-zinc-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {savingInterests ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Salvar interesses
                </>
              )}
            </button>
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-2">
          <button
            onClick={() => setShowPasswordModal(true)}
            className="w-full px-4 py-3 rounded-xl text-left text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors flex items-center gap-3"
          >
            <Key className="w-5 h-5" />
            Alterar Senha
          </button>

          <button
            onClick={handleLogout}
            className="w-full px-4 py-3 rounded-xl text-left text-red-400 hover:text-red-300 hover:bg-zinc-800 transition-colors flex items-center gap-3"
          >
            <LogOut className="w-5 h-5" />
            Sair da Conta
          </button>
        </div>

        {/* Password Modal */}
        {showPasswordModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="w-full max-w-md rounded-2xl bg-zinc-900 border border-zinc-700 p-6">
              <h2 className="text-xl font-bold text-white mb-4">
                Alterar Senha
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">
                    Senha Atual
                  </label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white focus:border-red-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">
                    Nova Senha
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 focus:border-red-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-2 mt-6">
                <button
                  onClick={() => {
                    setShowPasswordModal(false);
                    setCurrentPassword('');
                    setNewPassword('');
                  }}
                  className="flex-1 py-3 rounded-xl bg-zinc-800 text-zinc-400 font-bold hover:bg-zinc-700 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleChangePassword}
                  disabled={isChangingPassword || !currentPassword || newPassword.length < 6}
                  className="flex-1 py-3 rounded-xl bg-red-500 text-white font-bold hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center"
                >
                  {isChangingPassword ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    'Alterar'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
