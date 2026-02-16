import { useState, useEffect, useCallback, FormEvent } from 'react';
import {
  fetchInvoices,
  createInvoice,
  updateInvoice,
  fetchPayments,
  createPayment,
  fetchCoupons,
  createCoupon,
  updateCoupon,
  fetchEstablishments,
  fetchLoyaltyBalance,
  fetchLoyaltyHistory,
  creditLoyalty,
  debitLoyalty,
  type Establishment,
} from '../../services/adminApi';

type Tab = 'invoices' | 'coupons' | 'loyalty';

interface Invoice {
  id: number;
  establishment_id: number;
  establishment_name?: string;
  amount: number;
  status: string;
  due_date?: string;
  reference_period?: string;
  description?: string;
  created_at?: string;
  [key: string]: unknown;
}

interface Payment {
  id: number;
  amount: number;
  method?: string;
  paid_at?: string;
  [key: string]: unknown;
}

interface Coupon {
  id: number;
  code: string;
  discount_type: string;
  discount_value: number;
  max_usages: number;
  current_usages?: number;
  expires_at?: string;
  is_active: boolean;
  description?: string;
  [key: string]: unknown;
}

interface LoyaltyTransaction {
  id: number;
  type: string;
  points: number;
  reason?: string;
  created_at?: string;
  [key: string]: unknown;
}

export default function AdminBillingPage() {
  const [tab, setTab] = useState<Tab>('invoices');
  const [establishments, setEstablishments] = useState<Establishment[]>([]);

  const inputClass =
    'w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:border-yellow-500 focus:outline-none';

  // ── Load establishments once ──
  useEffect(() => {
    (async () => {
      try {
        const res = await fetchEstablishments({ per_page: '200' });
        setEstablishments(res.items || []);
      } catch {
        /* silent */
      }
    })();
  }, []);

  const tabBtnClass = (t: Tab) =>
    `px-4 py-2 font-semibold rounded-lg transition-colors text-sm ${
      tab === t
        ? 'bg-yellow-500 text-zinc-900'
        : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
    }`;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Financeiro</h1>
        <p className="text-sm text-zinc-400">Faturas, cupons e programa de fidelidade.</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-2">
        <button className={tabBtnClass('invoices')} onClick={() => setTab('invoices')}>
          Faturas
        </button>
        <button className={tabBtnClass('coupons')} onClick={() => setTab('coupons')}>
          Cupons
        </button>
        <button className={tabBtnClass('loyalty')} onClick={() => setTab('loyalty')}>
          Fidelidade
        </button>
      </div>

      {tab === 'invoices' && (
        <InvoicesTab establishments={establishments} inputClass={inputClass} />
      )}
      {tab === 'coupons' && <CouponsTab inputClass={inputClass} />}
      {tab === 'loyalty' && (
        <LoyaltyTab establishments={establishments} inputClass={inputClass} />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   INVOICES TAB
   ═══════════════════════════════════════════════════════════════════════════ */

function InvoicesTab({
  establishments,
  inputClass,
}: {
  establishments: Establishment[];
  inputClass: string;
}) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // ── Create form ──
  const [form, setForm] = useState({
    establishment_id: '',
    amount: '',
    due_date: '',
    reference_period: '',
    description: '',
  });
  const [creating, setCreating] = useState(false);

  // ── Payment modal ──
  const [paymentInvoice, setPaymentInvoice] = useState<Invoice | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ amount: '', method: '' });
  const [creatingPayment, setCreatingPayment] = useState(false);

  const loadInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      const res = await fetchInvoices(params);
      const items = Array.isArray(res) ? res : (res as Record<string, unknown>).items as Invoice[] || [];
      setInvoices(items);
    } catch {
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!form.establishment_id || !form.amount || !form.due_date) {
      setError('Estabelecimento, valor e vencimento sao obrigatorios.');
      return;
    }
    setCreating(true);
    try {
      await createInvoice({
        establishment_id: Number(form.establishment_id),
        amount: parseFloat(form.amount),
        due_date: form.due_date,
        reference_period: form.reference_period,
        description: form.description,
      });
      setSuccess('Fatura criada!');
      setForm({ establishment_id: '', amount: '', due_date: '', reference_period: '', description: '' });
      loadInvoices();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao criar fatura.');
    } finally {
      setCreating(false);
    }
  };

  const openPaymentModal = async (inv: Invoice) => {
    setPaymentInvoice(inv);
    setPaymentForm({ amount: String(inv.amount), method: 'pix' });
    setLoadingPayments(true);
    try {
      const res = await fetchPayments(inv.id);
      const items = Array.isArray(res) ? res : (res as Record<string, unknown>).items as Payment[] || [];
      setPayments(items);
    } catch {
      setPayments([]);
    } finally {
      setLoadingPayments(false);
    }
  };

  const handleCreatePayment = async (e: FormEvent) => {
    e.preventDefault();
    if (!paymentInvoice) return;
    setCreatingPayment(true);
    setError('');
    try {
      await createPayment(paymentInvoice.id, {
        amount: parseFloat(paymentForm.amount),
        method: paymentForm.method,
      });
      setSuccess('Pagamento registrado!');
      setPaymentInvoice(null);
      loadInvoices();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao registrar pagamento.');
    } finally {
      setCreatingPayment(false);
    }
  };

  const handleMarkStatus = async (inv: Invoice, newStatus: string) => {
    setError('');
    try {
      await updateInvoice(inv.id, { status: newStatus });
      loadInvoices();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar status.');
    }
  };

  const getEstName = (estId: number) => {
    const est = establishments.find((e) => e.id === estId);
    return est?.name || `#${estId}`;
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return (
          <span className="bg-green-500/10 text-green-500 px-2 py-0.5 rounded text-xs font-medium">
            Pago
          </span>
        );
      case 'overdue':
        return (
          <span className="bg-red-500/10 text-red-500 px-2 py-0.5 rounded text-xs font-medium">
            Vencida
          </span>
        );
      case 'cancelled':
        return (
          <span className="bg-zinc-700 text-zinc-300 px-2 py-0.5 rounded text-xs font-medium">
            Cancelada
          </span>
        );
      default:
        return (
          <span className="bg-yellow-500/10 text-yellow-500 px-2 py-0.5 rounded text-xs font-medium">
            Pendente
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Create form */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <p className="text-xs uppercase tracking-wider text-zinc-500 font-medium mb-4">
          Nova Fatura
        </p>
        <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3 items-end">
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Estabelecimento *</label>
            <select
              className={inputClass}
              value={form.establishment_id}
              onChange={(e) => setForm({ ...form, establishment_id: e.target.value })}
            >
              <option value="">Selecionar...</option>
              {establishments.map((est) => (
                <option key={est.id} value={String(est.id)}>{est.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Valor (R$) *</label>
            <input
              type="number"
              step="0.01"
              className={inputClass}
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Vencimento *</label>
            <input
              type="date"
              className={inputClass}
              value={form.due_date}
              onChange={(e) => setForm({ ...form, due_date: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Referencia</label>
            <input
              type="text"
              className={inputClass}
              value={form.reference_period}
              onChange={(e) => setForm({ ...form, reference_period: e.target.value })}
              placeholder="Ex: 2026-01"
            />
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Descricao</label>
            <input
              type="text"
              className={inputClass}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Opcional"
            />
          </div>
          <button
            type="submit"
            disabled={creating}
            className="px-4 py-2 bg-yellow-500 text-zinc-900 font-semibold rounded-lg hover:bg-yellow-400 transition-colors disabled:opacity-50"
          >
            {creating ? 'Criando...' : 'Criar Fatura'}
          </button>
        </form>
        {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
        {success && <p className="text-green-400 text-sm mt-2">{success}</p>}
      </div>

      {/* Filter + table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <select
            className={inputClass + ' max-w-xs'}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">Todos os status</option>
            <option value="pending">Pendente</option>
            <option value="paid">Pago</option>
            <option value="overdue">Vencida</option>
            <option value="cancelled">Cancelada</option>
          </select>
        </div>

        {loading ? (
          <p className="text-zinc-400 text-sm py-8 text-center">Carregando...</p>
        ) : invoices.length === 0 ? (
          <p className="text-zinc-500 text-sm py-8 text-center">Nenhuma fatura encontrada.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-950 text-zinc-400 uppercase text-xs">
                <tr>
                  <th className="p-3">ID</th>
                  <th className="p-3">Estabelecimento</th>
                  <th className="p-3">Valor</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Vencimento</th>
                  <th className="p-3">Referencia</th>
                  <th className="p-3">Acoes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-zinc-800/50">
                    <td className="p-3 text-zinc-400">#{inv.id}</td>
                    <td className="p-3 text-white">{inv.establishment_name || getEstName(inv.establishment_id)}</td>
                    <td className="p-3 text-white font-medium">
                      R$ {Number(inv.amount).toFixed(2)}
                    </td>
                    <td className="p-3">{statusBadge(inv.status)}</td>
                    <td className="p-3 text-zinc-400 text-xs">
                      {inv.due_date ? new Date(inv.due_date).toLocaleDateString('pt-BR') : '—'}
                    </td>
                    <td className="p-3 text-zinc-400 text-xs">{inv.reference_period || '—'}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        {inv.status !== 'paid' && inv.status !== 'cancelled' && (
                          <button
                            className="px-4 py-2 bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 transition-colors text-xs"
                            onClick={() => openPaymentModal(inv)}
                          >
                            Pagar
                          </button>
                        )}
                        {inv.status === 'pending' && (
                          <button
                            className="text-red-400 hover:text-red-300 text-sm"
                            onClick={() => handleMarkStatus(inv, 'cancelled')}
                          >
                            Cancelar
                          </button>
                        )}
                        {inv.status === 'cancelled' && (
                          <button
                            className="text-red-400 hover:text-red-300 text-sm"
                            onClick={() => handleMarkStatus(inv, 'pending')}
                          >
                            Reabrir
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payment modal */}
      {paymentInvoice && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">
                Registrar Pagamento - Fatura #{paymentInvoice.id}
              </h2>
              <button
                className="text-zinc-400 hover:text-white text-xl"
                onClick={() => setPaymentInvoice(null)}
              >
                &times;
              </button>
            </div>

            {/* Existing payments */}
            {loadingPayments ? (
              <p className="text-zinc-400 text-sm mb-4">Carregando pagamentos...</p>
            ) : payments.length > 0 ? (
              <div className="mb-4">
                <p className="text-xs uppercase tracking-wider text-zinc-500 font-medium mb-2">
                  Pagamentos anteriores
                </p>
                <div className="space-y-1">
                  {payments.map((pay) => (
                    <div key={pay.id} className="flex justify-between text-xs text-zinc-300">
                      <span>R$ {Number(pay.amount).toFixed(2)} ({pay.method || 'N/A'})</span>
                      <span className="text-zinc-500">
                        {pay.paid_at ? new Date(pay.paid_at).toLocaleDateString('pt-BR') : '—'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <form onSubmit={handleCreatePayment} className="space-y-3">
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Valor (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  className={inputClass}
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Metodo</label>
                <select
                  className={inputClass}
                  value={paymentForm.method}
                  onChange={(e) => setPaymentForm({ ...paymentForm, method: e.target.value })}
                >
                  <option value="pix">PIX</option>
                  <option value="boleto">Boleto</option>
                  <option value="credit_card">Cartao de Credito</option>
                  <option value="debit_card">Cartao de Debito</option>
                  <option value="transfer">Transferencia</option>
                  <option value="cash">Dinheiro</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={creatingPayment}
                  className="px-4 py-2 bg-yellow-500 text-zinc-900 font-semibold rounded-lg hover:bg-yellow-400 transition-colors disabled:opacity-50"
                >
                  {creatingPayment ? 'Registrando...' : 'Registrar Pagamento'}
                </button>
                <button
                  type="button"
                  className="px-4 py-2 bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 transition-colors"
                  onClick={() => setPaymentInvoice(null)}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   COUPONS TAB
   ═══════════════════════════════════════════════════════════════════════════ */

function CouponsTab({ inputClass }: { inputClass: string }) {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // ── Create form ──
  const [form, setForm] = useState({
    code: '',
    discount_type: 'percentage',
    discount_value: '',
    max_usages: '',
    expires_at: '',
    description: '',
  });
  const [creating, setCreating] = useState(false);

  const loadCoupons = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchCoupons();
      const items = Array.isArray(res) ? res : (res as Record<string, unknown>).items as Coupon[] || [];
      setCoupons(items);
    } catch {
      setCoupons([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCoupons();
  }, [loadCoupons]);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!form.code || !form.discount_value) {
      setError('Codigo e valor do desconto sao obrigatorios.');
      return;
    }
    setCreating(true);
    try {
      await createCoupon({
        code: form.code,
        discount_type: form.discount_type,
        discount_value: parseFloat(form.discount_value),
        max_usages: form.max_usages ? parseInt(form.max_usages) : 0,
        expires_at: form.expires_at || null,
        description: form.description,
      });
      setSuccess('Cupom criado!');
      setForm({ code: '', discount_type: 'percentage', discount_value: '', max_usages: '', expires_at: '', description: '' });
      loadCoupons();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao criar cupom.');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActive = async (coupon: Coupon) => {
    setError('');
    try {
      await updateCoupon(coupon.id, { is_active: !coupon.is_active });
      loadCoupons();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao alterar status do cupom.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Create form */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <p className="text-xs uppercase tracking-wider text-zinc-500 font-medium mb-4">
          Novo Cupom
        </p>
        <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3 items-end">
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Codigo *</label>
            <input
              type="text"
              className={inputClass}
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              placeholder="EX: DESCONTO20"
            />
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Tipo</label>
            <select
              className={inputClass}
              value={form.discount_type}
              onChange={(e) => setForm({ ...form, discount_type: e.target.value })}
            >
              <option value="percentage">Percentual (%)</option>
              <option value="fixed">Valor fixo (R$)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Valor *</label>
            <input
              type="number"
              step="0.01"
              className={inputClass}
              value={form.discount_value}
              onChange={(e) => setForm({ ...form, discount_value: e.target.value })}
              placeholder={form.discount_type === 'percentage' ? '20' : '50.00'}
            />
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Max usos</label>
            <input
              type="number"
              className={inputClass}
              value={form.max_usages}
              onChange={(e) => setForm({ ...form, max_usages: e.target.value })}
              placeholder="0 = ilimitado"
            />
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Expira em</label>
            <input
              type="date"
              className={inputClass}
              value={form.expires_at}
              onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
            />
          </div>
          <button
            type="submit"
            disabled={creating}
            className="px-4 py-2 bg-yellow-500 text-zinc-900 font-semibold rounded-lg hover:bg-yellow-400 transition-colors disabled:opacity-50"
          >
            {creating ? 'Criando...' : 'Criar Cupom'}
          </button>
        </form>
        <div className="mt-3">
          <label className="block text-sm text-zinc-400 mb-1">Descricao</label>
          <input
            type="text"
            className={inputClass + ' max-w-md'}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Descricao opcional"
          />
        </div>
        {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
        {success && <p className="text-green-400 text-sm mt-2">{success}</p>}
      </div>

      {/* Coupons table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        {loading ? (
          <p className="text-zinc-400 text-sm py-8 text-center">Carregando...</p>
        ) : coupons.length === 0 ? (
          <p className="text-zinc-500 text-sm py-8 text-center">Nenhum cupom cadastrado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-950 text-zinc-400 uppercase text-xs">
                <tr>
                  <th className="p-3">Codigo</th>
                  <th className="p-3">Desconto</th>
                  <th className="p-3">Usos</th>
                  <th className="p-3">Expira</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Acoes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {coupons.map((coupon) => (
                  <tr key={coupon.id} className="hover:bg-zinc-800/50">
                    <td className="p-3 text-white font-mono font-medium">{coupon.code}</td>
                    <td className="p-3 text-zinc-300">
                      {coupon.discount_type === 'percentage'
                        ? `${coupon.discount_value}%`
                        : `R$ ${Number(coupon.discount_value).toFixed(2)}`}
                    </td>
                    <td className="p-3 text-zinc-300">
                      {coupon.current_usages ?? 0} / {coupon.max_usages || '---'}
                    </td>
                    <td className="p-3 text-zinc-400 text-xs">
                      {coupon.expires_at
                        ? new Date(coupon.expires_at).toLocaleDateString('pt-BR')
                        : 'Sem expiracao'}
                    </td>
                    <td className="p-3">
                      {coupon.is_active ? (
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
                      <button
                        className="text-red-400 hover:text-red-300 text-sm"
                        onClick={() => handleToggleActive(coupon)}
                      >
                        {coupon.is_active ? 'Desativar' : 'Ativar'}
                      </button>
                    </td>
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

/* ═══════════════════════════════════════════════════════════════════════════
   LOYALTY TAB
   ═══════════════════════════════════════════════════════════════════════════ */

function LoyaltyTab({
  establishments,
  inputClass,
}: {
  establishments: Establishment[];
  inputClass: string;
}) {
  const [selectedEstId, setSelectedEstId] = useState('');
  const [balance, setBalance] = useState<number | null>(null);
  const [history, setHistory] = useState<LoyaltyTransaction[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // ── Transaction form ──
  const [txForm, setTxForm] = useState({ type: 'credit', points: '', reason: '' });
  const [submitting, setSubmitting] = useState(false);

  const loadLoyaltyData = useCallback(async () => {
    if (!selectedEstId) {
      setBalance(null);
      setHistory([]);
      return;
    }
    setLoadingData(true);
    setError('');
    try {
      const estId = Number(selectedEstId);
      const balRes = await fetchLoyaltyBalance(estId);
      const b = balRes as Record<string, unknown>;
      setBalance((b.balance as number) ?? (b.points as number) ?? 0);

      const histRes = await fetchLoyaltyHistory(estId);
      const items = Array.isArray(histRes)
        ? histRes
        : (histRes as Record<string, unknown>).items as LoyaltyTransaction[] || [];
      setHistory(items);
    } catch {
      setBalance(null);
      setHistory([]);
    } finally {
      setLoadingData(false);
    }
  }, [selectedEstId]);

  useEffect(() => {
    loadLoyaltyData();
  }, [loadLoyaltyData]);

  const handleTransaction = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!selectedEstId || !txForm.points) {
      setError('Selecione um estabelecimento e informe os pontos.');
      return;
    }
    setSubmitting(true);
    try {
      const estId = Number(selectedEstId);
      const payload = { points: parseInt(txForm.points), reason: txForm.reason };
      if (txForm.type === 'credit') {
        await creditLoyalty(estId, payload);
      } else {
        await debitLoyalty(estId, payload);
      }
      setSuccess(`${txForm.type === 'credit' ? 'Credito' : 'Debito'} registrado!`);
      setTxForm({ type: 'credit', points: '', reason: '' });
      loadLoyaltyData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao registrar transacao.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Establishment select */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <p className="text-xs uppercase tracking-wider text-zinc-500 font-medium mb-4">
          Programa de Fidelidade
        </p>
        <div className="max-w-md">
          <label className="block text-sm text-zinc-400 mb-1">Estabelecimento</label>
          <select
            className={inputClass}
            value={selectedEstId}
            onChange={(e) => setSelectedEstId(e.target.value)}
          >
            <option value="">Selecionar estabelecimento...</option>
            {establishments.map((est) => (
              <option key={est.id} value={String(est.id)}>{est.name}</option>
            ))}
          </select>
        </div>

        {/* Balance KPI */}
        {selectedEstId && (
          <div className="mt-4">
            {loadingData ? (
              <p className="text-zinc-400 text-sm">Carregando...</p>
            ) : (
              <div className="inline-flex items-center gap-3 bg-zinc-950 border border-zinc-800 rounded-lg px-6 py-4">
                <div>
                  <p className="text-xs uppercase tracking-wider text-zinc-500 font-medium">Saldo</p>
                  <p className="text-3xl font-bold text-yellow-500">{balance ?? 0}</p>
                  <p className="text-xs text-zinc-400">pontos</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Transaction form */}
      {selectedEstId && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <p className="text-xs uppercase tracking-wider text-zinc-500 font-medium mb-4">
            Nova Transacao
          </p>
          <form onSubmit={handleTransaction} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Tipo</label>
              <select
                className={inputClass}
                value={txForm.type}
                onChange={(e) => setTxForm({ ...txForm, type: e.target.value })}
              >
                <option value="credit">Credito (+)</option>
                <option value="debit">Debito (-)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Pontos *</label>
              <input
                type="number"
                className={inputClass}
                value={txForm.points}
                onChange={(e) => setTxForm({ ...txForm, points: e.target.value })}
                placeholder="100"
                min={1}
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Motivo</label>
              <input
                type="text"
                className={inputClass}
                value={txForm.reason}
                onChange={(e) => setTxForm({ ...txForm, reason: e.target.value })}
                placeholder="Ex: Bonus mensal"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-yellow-500 text-zinc-900 font-semibold rounded-lg hover:bg-yellow-400 transition-colors disabled:opacity-50"
            >
              {submitting ? 'Registrando...' : 'Registrar'}
            </button>
          </form>
          {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
          {success && <p className="text-green-400 text-sm mt-2">{success}</p>}
        </div>
      )}

      {/* History table */}
      {selectedEstId && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <p className="text-xs uppercase tracking-wider text-zinc-500 font-medium mb-4">
            Historico de Transacoes
          </p>
          {loadingData ? (
            <p className="text-zinc-400 text-sm py-4">Carregando...</p>
          ) : history.length === 0 ? (
            <p className="text-zinc-500 text-sm py-4">Nenhuma transacao registrada.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-zinc-950 text-zinc-400 uppercase text-xs">
                  <tr>
                    <th className="p-3">Data</th>
                    <th className="p-3">Tipo</th>
                    <th className="p-3">Pontos</th>
                    <th className="p-3">Motivo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {history.map((tx) => (
                    <tr key={tx.id} className="hover:bg-zinc-800/50">
                      <td className="p-3 text-zinc-400 text-xs whitespace-nowrap">
                        {tx.created_at
                          ? new Date(tx.created_at).toLocaleString('pt-BR')
                          : '—'}
                      </td>
                      <td className="p-3">
                        {tx.type === 'credit' ? (
                          <span className="bg-green-500/10 text-green-500 px-2 py-0.5 rounded text-xs font-medium">
                            Credito
                          </span>
                        ) : (
                          <span className="bg-red-500/10 text-red-500 px-2 py-0.5 rounded text-xs font-medium">
                            Debito
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-white font-medium">
                        {tx.type === 'credit' ? '+' : '-'}{tx.points}
                      </td>
                      <td className="p-3 text-zinc-300">{tx.reason || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
