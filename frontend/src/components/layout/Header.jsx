import { Link } from 'react-router-dom';
import { LogOut, User, Wallet, Zap } from 'lucide-react';
import { useAuthStore } from '@stores/authStore';

function formatBRL(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
}

export default function Header() {
  const { session, isAuthenticated, logout } = useAuthStore();
  const user = session?.user;

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--mb-border-soft)] bg-[rgba(3,9,25,0.88)] backdrop-blur-md px-4 sm:px-6 py-3">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        <Link to="/" className="flex items-center gap-2.5">
          <Zap className="w-6 h-6 text-[var(--mb-accent-300)]" />
          <span className="text-[15px] font-bold tracking-wide text-[var(--mb-text-primary)]">
            MultiBots
          </span>
        </Link>

        <div className="flex items-center gap-3">
          {isAuthenticated && user && (
            <>
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 border border-[var(--mb-border-soft)] bg-[rgba(92,236,174,0.06)]">
                <Wallet className="w-3.5 h-3.5 text-[var(--mb-success)]" />
                <span className="text-[12px] font-bold text-[var(--mb-success)]">
                  {formatBRL(user.balance)}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div className="w-8 h-8 flex items-center justify-center border border-[var(--mb-border-soft)] bg-[var(--mb-surface-900)]">
                  <User className="w-4 h-4 text-[var(--mb-text-muted)]" />
                </div>
                <div className="hidden md:block">
                  <p className="text-[13px] font-medium text-[var(--mb-text-primary)] leading-tight">{user.username}</p>
                  <p className="text-[11px] text-[var(--mb-text-caption)] capitalize">{user.role}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={logout}
                className="flex items-center justify-center w-8 h-8 text-[var(--mb-text-muted)] hover:text-[var(--mb-error)] hover:bg-[rgba(255,157,168,0.08)] transition-colors"
                aria-label="Sair"
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
    </header>
  );
}
