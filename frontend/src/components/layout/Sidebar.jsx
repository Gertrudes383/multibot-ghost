import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, CreditCard, Users, Settings, Package, Bot, Shield,
  Gift, BarChart3, Megaphone, Link2, Lock, Database, MonitorSmartphone,
  FileText, Wallet, ChevronDown, X, Zap,
} from 'lucide-react';

const NAV_SECTIONS = [
  {
    title: null,
    items: [
      { label: 'Dashboard', icon: LayoutDashboard, path: '/admin' },
    ],
  },
  {
    title: 'Estoque',
    items: [
      { label: 'Cards', icon: CreditCard, path: '/admin/cards' },
      { label: 'Lotes', icon: Package, path: '/admin/batches' },
      { label: 'BINs', icon: Database, path: '/admin/bins' },
    ],
  },
  {
    title: 'Usuarios',
    items: [
      { label: 'Gerenciar', icon: Users, path: '/admin/users' },
    ],
  },
  {
    title: 'Checker',
    items: [
      { label: 'Status', icon: BarChart3, path: '/admin/checker' },
      { label: 'Configurar', icon: Settings, path: '/admin/checker/settings' },
      { label: 'Monitor', icon: MonitorSmartphone, path: '/admin/checker/monitor' },
    ],
  },
  {
    title: 'Telegram',
    items: [
      { label: 'Bots', icon: Bot, path: '/admin/telegram/bots' },
      { label: 'Configurar', icon: Settings, path: '/admin/telegram/settings' },
      { label: 'Usuarios', icon: Users, path: '/admin/telegram/users' },
      { label: 'Pedidos', icon: FileText, path: '/admin/telegram/orders' },
      { label: 'Recargas', icon: Wallet, path: '/admin/telegram/recharges' },
      { label: 'Broadcast', icon: Megaphone, path: '/admin/telegram/broadcast' },
      { label: 'Gift Cards', icon: Gift, path: '/admin/telegram/giftcards' },
      { label: 'Afiliados', icon: Link2, path: '/admin/telegram/affiliates' },
      { label: 'Trocas', icon: BarChart3, path: '/admin/telegram/exchanges' },
    ],
  },
  {
    title: 'Financeiro',
    items: [
      { label: 'Pagamentos', icon: Wallet, path: '/admin/payments' },
      { label: 'Promocoes', icon: Gift, path: '/admin/promotions' },
      { label: 'Indicacoes', icon: Link2, path: '/admin/referrals' },
    ],
  },
  {
    title: 'Sistema',
    items: [
      { label: 'Configuracoes', icon: Settings, path: '/admin/settings' },
      { label: 'Seguranca', icon: Lock, path: '/admin/security' },
      { label: 'API Externa', icon: Link2, path: '/admin/external-api' },
    ],
  },
];

function SidebarSection({ section, collapsed, isActive, expandedTitle, onToggle, onNavigate }) {
  const hasTitle = Boolean(section.title);
  const isExpanded = expandedTitle === section.title;
  const hasActiveChild = section.items.some((i) => isActive(i.path));

  if (collapsed) {
    return (
      <div className="space-y-0.5">
        {section.items.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={onNavigate}
              title={item.label}
              className={`flex items-center justify-center w-10 h-10 mx-auto transition-colors duration-200 ${
                active
                  ? 'bg-[rgba(53,197,255,0.16)] text-[var(--mb-accent-300)]'
                  : 'text-[var(--mb-text-muted)] hover:bg-[rgba(53,197,255,0.08)] hover:text-[var(--mb-text-secondary)]'
              }`}
            >
              <Icon className="w-[18px] h-[18px]" />
            </Link>
          );
        })}
      </div>
    );
  }

  if (!hasTitle) {
    return (
      <div className="space-y-0.5">
        {section.items.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={onNavigate}
              className={`mb-sidebar-enter flex items-center gap-3 px-3 py-2 text-[13px] font-medium transition-colors duration-200 ${
                active
                  ? 'bg-[rgba(53,197,255,0.16)] text-[var(--mb-accent-300)]'
                  : 'text-[var(--mb-text-muted)] hover:bg-[rgba(53,197,255,0.08)] hover:text-[var(--mb-text-secondary)]'
              }`}
            >
              <Icon className="w-[18px] h-[18px] shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => onToggle(section.title)}
        className={`flex w-full items-center justify-between px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] transition-colors duration-200 ${
          hasActiveChild
            ? 'text-[var(--mb-accent-300)]'
            : 'text-[var(--mb-text-caption)] hover:text-[var(--mb-text-muted)]'
        }`}
      >
        <span>{section.title}</span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? '' : '-rotate-90'}`} />
      </button>

      {isExpanded && (
        <div className="mt-0.5 space-y-0.5 border-l border-[var(--mb-border-soft)] ml-3 pl-2">
          {section.items.map((item, idx) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={onNavigate}
                className="mb-sidebar-enter flex items-center gap-3 px-3 py-1.5 text-[13px] transition-colors duration-200"
                style={{ '--mb-sidebar-delay': `${idx * 30}ms`, color: active ? 'var(--mb-accent-300)' : undefined }}
              >
                <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-[var(--mb-accent-300)]' : 'text-[var(--mb-text-caption)]'}`} />
                <span className={active ? 'text-[var(--mb-accent-300)]' : 'text-[var(--mb-text-muted)] hover:text-[var(--mb-text-secondary)]'}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function Sidebar({ collapsed = false, onNavigate, onClose, showMobileCloseButton = false }) {
  const location = useLocation();
  const [expandedTitle, setExpandedTitle] = useState(null);

  useEffect(() => {
    for (const section of NAV_SECTIONS) {
      if (section.title && section.items.some((i) => isActive(i.path))) {
        setExpandedTitle(section.title);
        return;
      }
    }
  }, [location.pathname]);

  function isActive(path) {
    if (path === '/admin') return location.pathname === '/admin';
    return location.pathname.startsWith(path);
  }

  function toggleSection(title) {
    setExpandedTitle((prev) => (prev === title ? null : title));
  }

  return (
    <div className={`relative flex h-full flex-col overflow-hidden border border-[var(--mb-border-mid)] bg-[linear-gradient(180deg,rgba(5,14,36,0.96),rgba(4,11,28,0.98))] shadow-[var(--mb-shadow-panel)] ${collapsed ? '' : ''}`}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(90%_90%_at_0%_0%,rgba(63,155,255,0.16),transparent_62%),radial-gradient(75%_75%_at_100%_100%,rgba(39,98,191,0.14),transparent_68%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(194,230,255,0.28),transparent)]" />

      {/* Logo */}
      <div className="relative z-10 flex items-center justify-between border-b border-[var(--mb-border-soft)] px-4 py-4">
        <Link to="/admin" className="flex items-center gap-2.5" onClick={onNavigate}>
          <Zap className="w-6 h-6 text-[var(--mb-accent-300)]" />
          {!collapsed && (
            <span className="text-[15px] font-bold tracking-wide text-[var(--mb-text-primary)]">
              MultiBots
            </span>
          )}
        </Link>
        {showMobileCloseButton && (
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--mb-text-muted)] hover:text-[var(--mb-text-primary)] transition-colors"
            aria-label="Fechar menu"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="relative z-10 flex-1 overflow-y-auto mb-square-scrollbar px-2 py-3 space-y-3">
        {NAV_SECTIONS.map((section, idx) => (
          <SidebarSection
            key={section.title || idx}
            section={section}
            collapsed={collapsed}
            isActive={isActive}
            expandedTitle={expandedTitle}
            onToggle={toggleSection}
            onNavigate={onNavigate}
          />
        ))}
      </nav>

      {/* Bottom */}
      {!collapsed && (
        <div className="relative z-10 border-t border-[var(--mb-border-soft)] px-4 py-3">
          <p className="text-[11px] text-[var(--mb-text-caption)]">MultiBots v1.0</p>
        </div>
      )}
    </div>
  );
}
