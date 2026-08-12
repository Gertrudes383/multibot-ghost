import { Link } from 'react-router-dom';
import { Menu, PanelLeftClose, PanelLeft, LogOut, User, Wallet } from 'lucide-react';
import { useAuthStore } from '@stores/authStore';

function formatBRL(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
}

export default function Navbar({ isSidebarCollapsed, onToggleSidebar, onOpenMobileSidebar }) {
  const { session, isAuthenticated, logout } = useAuthStore();
  const user = session?.user;

  return (
    <div className="relative flex items-center justify-between">
      <div className="flex items-center gap-2">
        {/* Mobile hamburger */}
        <button
          type="button"
          onClick={onOpenMobileSidebar}
          className="flex items-center justify-center w-9 h-9 text-[var(--mb-text-muted)] hover:text-[var(--mb-text-primary)] hover:bg-[rgba(53,197,255,0.08)] transition-colors lg:hidden"
          aria-label="Abrir menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Desktop sidebar toggle */}
        <button
          type="button"
          onClick={onToggleSidebar}
          className="hidden lg:flex items-center justify-center w-9 h-9 text-[var(--mb-text-muted)] hover:text-[var(--mb-text-primary)] hover:bg-[rgba(53,197,255,0.08)] transition-colors"
          aria-label={isSidebarCollapsed ? 'Expandir sidebar' : 'Recolher sidebar'}
        >
          {isSidebarCollapsed ? <PanelLeft className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
        </button>
      </div>

      <div className="flex items-center gap-3">
        {isAuthenticated && user && (
          <>
            {/* Balance */}
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 border border-[var(--mb-border-soft)] bg-[rgba(92,236,174,0.06)]">
              <Wallet className="w-3.5 h-3.5 text-[var(--mb-success)]" />
              <span className="text-[12px] font-bold text-[var(--mb-success)]">
                {formatBRL(user.balance)}
              </span>
            </div>

            {/* User info */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 flex items-center justify-center border border-[var(--mb-border-soft)] bg-[var(--mb-surface-900)]">
                <User className="w-4 h-4 text-[var(--mb-text-muted)]" />
              </div>
              <div className="hidden md:block">
                <p className="text-[13px] font-medium text-[var(--mb-text-primary)] leading-tight">
                  {user.username}
                </p>
                <p className="text-[11px] text-[var(--mb-text-caption)] capitalize">{user.role}</p>
              </div>
            </div>

            {/* Logout */}
            <button
              type="button"
              onClick={logout}
              className="flex items-center justify-center w-8 h-8 text-[var(--mb-text-muted)] hover:text-[var(--mb-error)] hover:bg-[rgba(255,157,168,0.08)] transition-colors"
              aria-label="Sair"
              title="Sair"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </>
        )}

        {!isAuthenticated && (
          <div className="flex items-center gap-2">
            <Link
              to="/login"
              className="px-4 py-1.5 text-[13px] font-medium text-[var(--mb-text-muted)] hover:text-[var(--mb-text-primary)] transition-colors"
            >
              Login
            </Link>
            <Link
              to="/login?mode=register"
              className="px-4 py-1.5 text-[13px] font-medium text-[var(--mb-bg-950)] bg-[var(--mb-accent-300)] hover:bg-[var(--mb-accent-400)] transition-colors"
            >
              Registrar
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
