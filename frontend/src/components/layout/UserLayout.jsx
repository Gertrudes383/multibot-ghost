import { Link, Outlet, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, ShoppingBag, ShoppingCart, CreditCard, Wallet, Gift, Users,
} from 'lucide-react';
import Header from './Header';

const USER_NAV = [
  { label: 'Dashboard', path: '/user', icon: LayoutDashboard },
  { label: 'Catalogo', path: '/user/catalog', icon: ShoppingBag },
  { label: 'Compras', path: '/user/purchases', icon: ShoppingCart },
  { label: 'Recarga', path: '/user/recharge', icon: CreditCard },
  { label: 'Carteira', path: '/user/wallet', icon: Wallet },
  { label: 'Gift Cards', path: '/user/giftcard', icon: Gift },
  { label: 'Indicacoes', path: '/user/referrals', icon: Users },
];

export default function UserLayout() {
  const location = useLocation();

  function isActive(path) {
    if (path === '/user') return location.pathname === '/user';
    return location.pathname.startsWith(path);
  }

  return (
    <div className="min-h-screen bg-[var(--mb-bg-950)] text-[var(--mb-text-secondary)] flex flex-col">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_18%_-5%,rgba(67,128,237,0.18),transparent_40%),radial-gradient(circle_at_84%_112%,rgba(32,79,182,0.14),transparent_42%)]" />
      <Header />

      {/* User nav tabs */}
      <nav className="relative border-b border-[var(--mb-border-soft)] bg-[rgba(4,11,30,0.7)] backdrop-blur-sm overflow-x-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center gap-0.5 min-w-max">
            {USER_NAV.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-2 px-4 py-3 text-[13px] font-medium border-b-2 transition-all duration-200 whitespace-nowrap ${
                    active
                      ? 'border-[var(--mb-accent-300)] text-[var(--mb-accent-300)]'
                      : 'border-transparent text-[var(--mb-text-muted)] hover:text-[var(--mb-text-secondary)] hover:border-[var(--mb-border-mid)]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      <main className="relative flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 lg:py-8">
        <Outlet />
      </main>

      <footer className="relative border-t border-[var(--mb-border-soft)] px-4 py-4 text-center">
        <p className="text-[12px] text-[var(--mb-text-caption)]">
          MultiBots &mdash; Plataforma Multi-Tenant para Telegram Bots
        </p>
      </footer>
    </div>
  );
}
