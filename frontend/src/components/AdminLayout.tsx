import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Building2, Users, UserCog, Receipt,
  Shield, ScrollText, Server, ArrowLeft, Loader2, AlertCircle,
  PanelLeftClose, PanelLeftOpen, Menu,
} from 'lucide-react';
import { useAdminAuth } from '../contexts/AdminAuthContext';

const NAV_ITEMS = [
  { to: '/admin', label: 'Painel Geral', icon: LayoutDashboard, end: true },
  { to: '/admin/establishments', label: 'Estabelecimentos', icon: Building2 },
  { to: '/admin/players', label: 'Usuarios', icon: Users },
  { to: '/admin/users', label: 'Operadores', icon: UserCog },
  { to: '/admin/billing', label: 'Faturamento', icon: Receipt },
  { to: '/admin/security', label: 'Seguranca', icon: Shield },
  { to: '/admin/audit', label: 'Auditoria', icon: ScrollText },
  { to: '/admin/tenants', label: 'Fab. Sistemas', icon: Server },
];

export default function AdminLayout() {
  const navigate = useNavigate();
  const { adminUser, adminLoading, adminError, isAdminAuthenticated } = useAdminAuth();
  const [open, setOpen] = useState(true);

  if (adminLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-yellow-500 animate-spin mx-auto mb-3" />
          <p className="text-zinc-400 text-sm">Autenticando no painel admin...</p>
        </div>
      </div>
    );
  }

  if (adminError || !isAdminAuthenticated) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-white mb-2">Erro de Autenticacao</h2>
          <p className="text-zinc-400 text-sm mb-4">{adminError || 'Nao foi possivel autenticar.'}</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-4 py-2 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 transition-colors"
          >
            Voltar ao Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex">
      {/* Sidebar */}
      <aside
        style={{ width: open ? 224 : 0 }}
        className={`bg-zinc-900 flex flex-col shrink-0 transition-all duration-300 overflow-hidden ${
          open ? 'border-r border-zinc-800' : ''
        }`}
      >
        {/* Header */}
        <div className="p-3 border-b border-zinc-800 min-w-[14rem]">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-yellow-500 to-amber-600 flex items-center justify-center shrink-0">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-white">Admin Global</h1>
              <p className="text-xs text-zinc-500 truncate">{adminUser?.name}</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 text-xs text-zinc-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3 h-3" />
            Voltar ao Dashboard
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto min-w-[14rem]">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-yellow-500/10 text-yellow-500 font-semibold'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                }`
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Close button */}
        <div className="p-2 border-t border-zinc-800 min-w-[14rem]">
          <button
            onClick={() => setOpen(false)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors text-xs"
          >
            <PanelLeftClose className="w-4 h-4" />
            <span>Fechar menu</span>
          </button>
        </div>
      </aside>

      {/* Open button (when sidebar is closed) */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed top-3 left-3 z-50 p-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors shadow-lg"
          title="Abrir menu"
        >
          <Menu className="w-5 h-5" />
        </button>
      )}

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
