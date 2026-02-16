import { useState, useEffect, useCallback, FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  fetchEstablishmentDetail,
  updateEstablishment,
  updateEstablishmentSecurity,
  activateEstablishment,
  deactivateEstablishment,
  fetchEstablishmentManagers,
  createEstablishmentManager,
  updateEstablishmentManager,
  deleteEstablishmentManager,
  resetManagerPassword,
  type Establishment,
  type Manager,
} from '../../services/adminApi';

interface PlanForm {
  name: string;
  owner_name: string;
  contact_email: string;
  contact_phone: string;
  plan_name: string;
  camera_count: string;
  court_count: string;
  state: string;
  city: string;
}

interface SecurityForm {
  allowed_ip: string;
  is_active: boolean;
  rotate_key: boolean;
}

interface ManagerForm {
  name: string;
  email: string;
  password: string;
}

export default function AdminEstablishmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const estId = Number(id);

  // ── Detail state ──
  const [est, setEst] = useState<Establishment | null>(null);
  const [loadingEst, setLoadingEst] = useState(true);

  // ── Plan form ──
  const [planForm, setPlanForm] = useState<PlanForm>({
    name: '', owner_name: '', contact_email: '', contact_phone: '',
    plan_name: '', camera_count: '0', court_count: '0', state: '', city: '',
  });
  const [savingPlan, setSavingPlan] = useState(false);
  const [planMsg, setPlanMsg] = useState('');
  const [planErr, setPlanErr] = useState('');

  // ── Security form ──
  const [secForm, setSecForm] = useState<SecurityForm>({ allowed_ip: '', is_active: true, rotate_key: false });
  const [savingSec, setSavingSec] = useState(false);
  const [secMsg, setSecMsg] = useState('');
  const [secErr, setSecErr] = useState('');

  // ── Managers ──
  const [managers, setManagers] = useState<Manager[]>([]);
  const [loadingMgrs, setLoadingMgrs] = useState(false);
  const [mgrForm, setMgrForm] = useState<ManagerForm>({ name: '', email: '', password: '' });
  const [editingMgrId, setEditingMgrId] = useState<number | null>(null);
  const [editMgrForm, setEditMgrForm] = useState<ManagerForm>({ name: '', email: '', password: '' });
  const [savingMgr, setSavingMgr] = useState(false);
  const [mgrMsg, setMgrMsg] = useState('');
  const [mgrErr, setMgrErr] = useState('');
  const [resetPwdId, setResetPwdId] = useState<number | null>(null);
  const [resetPwd, setResetPwd] = useState('');
  const [resetPwdMsg, setResetPwdMsg] = useState('');

  const inputClass =
    'w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:border-yellow-500 focus:outline-none';

  const loadDetail = useCallback(async () => {
    setLoadingEst(true);
    try {
      const detail = await fetchEstablishmentDetail(estId);
      setEst(detail);
      const d = detail as Record<string, unknown>;
      setPlanForm({
        name: (d.name as string) || '',
        owner_name: (d.owner_name as string) || '',
        contact_email: (d.contact_email as string) || (d.email as string) || '',
        contact_phone: (d.contact_phone as string) || (d.phone as string) || '',
        plan_name: (d.plan_name as string) || '',
        camera_count: String(d.camera_count ?? 0),
        court_count: String(d.court_count ?? 0),
        state: (d.state as string) || '',
        city: (d.city as string) || '',
      });
      setSecForm({
        allowed_ip: (d.allowed_ip as string) || '',
        is_active: !!d.is_active,
        rotate_key: false,
      });
    } catch {
      /* silent */
    } finally {
      setLoadingEst(false);
    }
  }, [estId]);

  const loadManagers = useCallback(async () => {
    setLoadingMgrs(true);
    try {
      const mgrs = await fetchEstablishmentManagers(estId);
      setManagers(Array.isArray(mgrs) ? mgrs : []);
    } catch {
      setManagers([]);
    } finally {
      setLoadingMgrs(false);
    }
  }, [estId]);

  useEffect(() => {
    loadDetail();
    loadManagers();
  }, [loadDetail, loadManagers]);

  // ── Plan save ──
  const handleSavePlan = async (e: FormEvent) => {
    e.preventDefault();
    setPlanMsg('');
    setPlanErr('');
    setSavingPlan(true);
    try {
      await updateEstablishment(estId, {
        name: planForm.name,
        owner_name: planForm.owner_name,
        contact_email: planForm.contact_email,
        contact_phone: planForm.contact_phone,
        plan_name: planForm.plan_name,
        camera_count: Number(planForm.camera_count),
        court_count: Number(planForm.court_count),
        state: planForm.state,
        city: planForm.city,
      });
      setPlanMsg('Dados atualizados com sucesso!');
      loadDetail();
    } catch (err: unknown) {
      setPlanErr(err instanceof Error ? err.message : 'Erro ao salvar.');
    } finally {
      setSavingPlan(false);
    }
  };

  // ── Security save ──
  const handleSaveSecurity = async (e: FormEvent) => {
    e.preventDefault();
    setSecMsg('');
    setSecErr('');
    setSavingSec(true);
    try {
      await updateEstablishmentSecurity(estId, {
        allowed_ip: secForm.allowed_ip,
        rotate_key: secForm.rotate_key,
      });
      if (secForm.is_active !== est?.is_active) {
        if (secForm.is_active) {
          await activateEstablishment(estId);
        } else {
          await deactivateEstablishment(estId);
        }
      }
      setSecMsg('Seguranca atualizada com sucesso!');
      setSecForm((prev) => ({ ...prev, rotate_key: false }));
      loadDetail();
    } catch (err: unknown) {
      setSecErr(err instanceof Error ? err.message : 'Erro ao salvar seguranca.');
    } finally {
      setSavingSec(false);
    }
  };

  // ── Manager CRUD ──
  const handleCreateManager = async (e: FormEvent) => {
    e.preventDefault();
    setMgrMsg('');
    setMgrErr('');
    if (!mgrForm.name || !mgrForm.email || !mgrForm.password) {
      setMgrErr('Preencha todos os campos.');
      return;
    }
    setSavingMgr(true);
    try {
      await createEstablishmentManager(estId, {
        name: mgrForm.name,
        email: mgrForm.email,
        password: mgrForm.password,
      });
      setMgrMsg('Gestor criado com sucesso!');
      setMgrForm({ name: '', email: '', password: '' });
      loadManagers();
    } catch (err: unknown) {
      setMgrErr(err instanceof Error ? err.message : 'Erro ao criar gestor.');
    } finally {
      setSavingMgr(false);
    }
  };

  const startEditManager = (mgr: Manager) => {
    setEditingMgrId(mgr.id);
    setEditMgrForm({ name: mgr.name, email: mgr.email, password: '' });
  };

  const handleUpdateManager = async () => {
    if (!editingMgrId) return;
    setMgrMsg('');
    setMgrErr('');
    setSavingMgr(true);
    try {
      const payload: Record<string, unknown> = { name: editMgrForm.name, email: editMgrForm.email };
      if (editMgrForm.password) payload.password = editMgrForm.password;
      await updateEstablishmentManager(estId, editingMgrId, payload);
      setMgrMsg('Gestor atualizado!');
      setEditingMgrId(null);
      loadManagers();
    } catch (err: unknown) {
      setMgrErr(err instanceof Error ? err.message : 'Erro ao atualizar gestor.');
    } finally {
      setSavingMgr(false);
    }
  };

  const handleDeleteManager = async (mgrId: number) => {
    if (!confirm('Tem certeza que deseja remover este gestor?')) return;
    try {
      await deleteEstablishmentManager(estId, mgrId);
      setMgrMsg('Gestor removido.');
      loadManagers();
    } catch (err: unknown) {
      setMgrErr(err instanceof Error ? err.message : 'Erro ao remover gestor.');
    }
  };

  const handleResetPassword = async (mgrId: number) => {
    if (!resetPwd) return;
    setResetPwdMsg('');
    try {
      await resetManagerPassword(estId, mgrId, { new_password: resetPwd });
      setResetPwdMsg('Senha redefinida com sucesso!');
      setResetPwd('');
      setResetPwdId(null);
    } catch (err: unknown) {
      setResetPwdMsg(err instanceof Error ? err.message : 'Erro ao redefinir senha.');
    }
  };

  if (loadingEst) {
    return (
      <div className="p-6">
        <p className="text-zinc-400 text-sm">Carregando detalhes...</p>
      </div>
    );
  }

  if (!est) {
    return (
      <div className="p-6">
        <p className="text-red-400 text-sm">Estabelecimento nao encontrado.</p>
        <button
          className="mt-4 px-4 py-2 bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 transition-colors"
          onClick={() => navigate('/admin/establishments')}
        >
          Voltar
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          className="px-4 py-2 bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 transition-colors"
          onClick={() => navigate('/admin/establishments')}
        >
          &larr; Voltar
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white">{est.name}</h1>
          <p className="text-sm text-zinc-400">ID: {est.id} &middot; Slug: {est.slug}</p>
        </div>
        {est.is_active ? (
          <span className="bg-green-500/10 text-green-500 px-2 py-0.5 rounded text-xs font-medium ml-auto">
            Ativo
          </span>
        ) : (
          <span className="bg-red-500/10 text-red-500 px-2 py-0.5 rounded text-xs font-medium ml-auto">
            Inativo
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Section 1: Plan Form ── */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <p className="text-xs uppercase tracking-wider text-zinc-500 font-medium mb-4">
            Dados e Plano
          </p>
          <form onSubmit={handleSavePlan} className="space-y-3">
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Nome</label>
              <input
                type="text"
                className={inputClass}
                value={planForm.name}
                onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Responsavel</label>
              <input
                type="text"
                className={inputClass}
                value={planForm.owner_name}
                onChange={(e) => setPlanForm({ ...planForm, owner_name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Email</label>
                <input
                  type="email"
                  className={inputClass}
                  value={planForm.contact_email}
                  onChange={(e) => setPlanForm({ ...planForm, contact_email: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Telefone</label>
                <input
                  type="text"
                  className={inputClass}
                  value={planForm.contact_phone}
                  onChange={(e) => setPlanForm({ ...planForm, contact_phone: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Plano</label>
              <input
                type="text"
                className={inputClass}
                value={planForm.plan_name}
                onChange={(e) => setPlanForm({ ...planForm, plan_name: e.target.value })}
                placeholder="Ex: Basico, Pro, Enterprise"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Cameras</label>
                <input
                  type="number"
                  className={inputClass}
                  value={planForm.camera_count}
                  onChange={(e) => setPlanForm({ ...planForm, camera_count: e.target.value })}
                  min={0}
                />
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Quadras</label>
                <input
                  type="number"
                  className={inputClass}
                  value={planForm.court_count}
                  onChange={(e) => setPlanForm({ ...planForm, court_count: e.target.value })}
                  min={0}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Estado</label>
                <input
                  type="text"
                  className={inputClass}
                  value={planForm.state}
                  onChange={(e) => setPlanForm({ ...planForm, state: e.target.value })}
                  maxLength={2}
                />
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Cidade</label>
                <input
                  type="text"
                  className={inputClass}
                  value={planForm.city}
                  onChange={(e) => setPlanForm({ ...planForm, city: e.target.value })}
                />
              </div>
            </div>

            {planErr && <p className="text-red-400 text-sm mt-2">{planErr}</p>}
            {planMsg && <p className="text-green-400 text-sm mt-2">{planMsg}</p>}

            <button
              type="submit"
              disabled={savingPlan}
              className="px-4 py-2 bg-yellow-500 text-zinc-900 font-semibold rounded-lg hover:bg-yellow-400 transition-colors disabled:opacity-50"
            >
              {savingPlan ? 'Salvando...' : 'Salvar Dados'}
            </button>
          </form>
        </div>

        {/* ── Section 2: Security Form ── */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <p className="text-xs uppercase tracking-wider text-zinc-500 font-medium mb-4">
            Seguranca
          </p>
          <form onSubmit={handleSaveSecurity} className="space-y-3">
            <div>
              <label className="block text-sm text-zinc-400 mb-1">IP Permitido</label>
              <input
                type="text"
                className={inputClass}
                value={secForm.allowed_ip}
                onChange={(e) => setSecForm({ ...secForm, allowed_ip: e.target.value })}
                placeholder="Ex: 192.168.0.1"
              />
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={secForm.is_active}
                  onChange={(e) => setSecForm({ ...secForm, is_active: e.target.checked })}
                  className="rounded border-zinc-600 bg-zinc-950 text-yellow-500 focus:ring-yellow-500"
                />
                Estabelecimento ativo
              </label>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={secForm.rotate_key}
                  onChange={(e) => setSecForm({ ...secForm, rotate_key: e.target.checked })}
                  className="rounded border-zinc-600 bg-zinc-950 text-yellow-500 focus:ring-yellow-500"
                />
                Rotacionar chave de API
              </label>
            </div>

            {secErr && <p className="text-red-400 text-sm mt-2">{secErr}</p>}
            {secMsg && <p className="text-green-400 text-sm mt-2">{secMsg}</p>}

            <button
              type="submit"
              disabled={savingSec}
              className="px-4 py-2 bg-yellow-500 text-zinc-900 font-semibold rounded-lg hover:bg-yellow-400 transition-colors disabled:opacity-50"
            >
              {savingSec ? 'Salvando...' : 'Salvar Seguranca'}
            </button>
          </form>
        </div>
      </div>

      {/* ── Section 3: Managers ── */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <p className="text-xs uppercase tracking-wider text-zinc-500 font-medium mb-4">
          Gestores
        </p>

        {/* Create manager form */}
        <form onSubmit={handleCreateManager} className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
          <input
            type="text"
            className={inputClass}
            placeholder="Nome"
            value={mgrForm.name}
            onChange={(e) => setMgrForm({ ...mgrForm, name: e.target.value })}
          />
          <input
            type="email"
            className={inputClass}
            placeholder="Email"
            value={mgrForm.email}
            onChange={(e) => setMgrForm({ ...mgrForm, email: e.target.value })}
          />
          <input
            type="password"
            className={inputClass}
            placeholder="Senha"
            value={mgrForm.password}
            onChange={(e) => setMgrForm({ ...mgrForm, password: e.target.value })}
          />
          <button
            type="submit"
            disabled={savingMgr}
            className="px-4 py-2 bg-yellow-500 text-zinc-900 font-semibold rounded-lg hover:bg-yellow-400 transition-colors disabled:opacity-50"
          >
            {savingMgr ? 'Criando...' : 'Adicionar Gestor'}
          </button>
        </form>

        {mgrErr && <p className="text-red-400 text-sm mb-2">{mgrErr}</p>}
        {mgrMsg && <p className="text-green-400 text-sm mb-2">{mgrMsg}</p>}

        {loadingMgrs ? (
          <p className="text-zinc-400 text-sm py-4">Carregando gestores...</p>
        ) : managers.length === 0 ? (
          <p className="text-zinc-500 text-sm py-4">Nenhum gestor cadastrado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-950 text-zinc-400 uppercase text-xs">
                <tr>
                  <th className="p-3">Nome</th>
                  <th className="p-3">Email</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Acoes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {managers.map((mgr) => (
                  <tr key={mgr.id} className="hover:bg-zinc-800/50">
                    {editingMgrId === mgr.id ? (
                      <>
                        <td className="p-3">
                          <input
                            type="text"
                            className={inputClass}
                            value={editMgrForm.name}
                            onChange={(e) => setEditMgrForm({ ...editMgrForm, name: e.target.value })}
                          />
                        </td>
                        <td className="p-3">
                          <input
                            type="email"
                            className={inputClass}
                            value={editMgrForm.email}
                            onChange={(e) => setEditMgrForm({ ...editMgrForm, email: e.target.value })}
                          />
                        </td>
                        <td className="p-3">
                          {mgr.is_active ? (
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
                              className="px-4 py-2 bg-yellow-500 text-zinc-900 font-semibold rounded-lg hover:bg-yellow-400 transition-colors disabled:opacity-50 text-xs"
                              disabled={savingMgr}
                              onClick={handleUpdateManager}
                            >
                              Salvar
                            </button>
                            <button
                              className="px-4 py-2 bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 transition-colors text-xs"
                              onClick={() => setEditingMgrId(null)}
                            >
                              Cancelar
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="p-3 text-white">{mgr.name}</td>
                        <td className="p-3 text-zinc-300">{mgr.email}</td>
                        <td className="p-3">
                          {mgr.is_active ? (
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
                          <div className="flex items-center gap-2 flex-wrap">
                            <button
                              className="px-4 py-2 bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 transition-colors text-xs"
                              onClick={() => startEditManager(mgr)}
                            >
                              Editar
                            </button>
                            <button
                              className="text-red-400 hover:text-red-300 text-sm"
                              onClick={() => {
                                if (resetPwdId === mgr.id) {
                                  setResetPwdId(null);
                                } else {
                                  setResetPwdId(mgr.id);
                                  setResetPwd('');
                                  setResetPwdMsg('');
                                }
                              }}
                            >
                              {resetPwdId === mgr.id ? 'Fechar' : 'Reset Senha'}
                            </button>
                            <button
                              className="text-red-400 hover:text-red-300 text-sm"
                              onClick={() => handleDeleteManager(mgr.id)}
                            >
                              Remover
                            </button>
                          </div>
                          {resetPwdId === mgr.id && (
                            <div className="mt-2 flex items-center gap-2">
                              <input
                                type="password"
                                className={inputClass}
                                placeholder="Nova senha"
                                value={resetPwd}
                                onChange={(e) => setResetPwd(e.target.value)}
                              />
                              <button
                                className="px-4 py-2 bg-yellow-500 text-zinc-900 font-semibold rounded-lg hover:bg-yellow-400 transition-colors disabled:opacity-50 text-xs whitespace-nowrap"
                                onClick={() => handleResetPassword(mgr.id)}
                                disabled={!resetPwd}
                              >
                                Redefinir
                              </button>
                              {resetPwdMsg && (
                                <span className="text-green-400 text-xs">{resetPwdMsg}</span>
                              )}
                            </div>
                          )}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
