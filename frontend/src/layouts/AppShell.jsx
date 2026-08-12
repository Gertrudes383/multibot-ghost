import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Navbar from '../components/layout/Navbar';
import Sidebar from '../components/layout/Sidebar';
import { useTelegramNotifications } from '@hooks/useTelegramNotifications';
import { useStockUpdates } from '@hooks/useStockUpdates';

export default function AppShell({ children = null }) {
  const location = useLocation();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [scrollShade, setScrollShade] = useState(0);

  useTelegramNotifications();
  useStockUpdates();

  const sidebarWidthClass = isSidebarCollapsed ? 'lg:w-[5rem]' : 'lg:w-[18rem]';
  const contentOffsetClass = isSidebarCollapsed ? 'lg:ml-[5rem]' : 'lg:ml-[18rem]';

  useEffect(() => {
    setIsMobileSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const updateScrollShade = () => {
      setScrollShade(Math.min(window.scrollY / 900, 0.34));
    };
    updateScrollShade();
    window.addEventListener('scroll', updateScrollShade, { passive: true });
    return () => window.removeEventListener('scroll', updateScrollShade);
  }, [location.pathname]);

  useEffect(() => {
    if (!isMobileSidebarOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') setIsMobileSidebarOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [isMobileSidebarOpen]);

  return (
    <div className="relative min-h-screen bg-[var(--mb-bg-950)] text-[var(--mb-text-secondary)]">
      {/* Radial gradients de fundo */}
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_18%_-5%,rgba(67,128,237,0.22),transparent_40%),radial-gradient(circle_at_84%_112%,rgba(32,79,182,0.18),transparent_42%),linear-gradient(180deg,#07122b_0%,#030918_62%,#020816_100%)]" />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(46%_30%_at_15%_15%,rgba(53,197,255,0.12),transparent_74%),radial-gradient(40%_32%_at_82%_85%,rgba(0,125,237,0.16),transparent_76%)]" />
      <div
        className="pointer-events-none fixed inset-0 bg-[linear-gradient(180deg,rgba(1,5,14,0)_0%,rgba(1,5,14,0.42)_56%,rgba(1,4,10,0.84)_100%)] transition-opacity duration-300"
        style={{ opacity: scrollShade }}
      />

      <div className="relative min-h-screen w-full px-2 py-2 sm:px-3 sm:py-3 lg:px-4 lg:py-4">
        {/* Mobile sidebar overlay */}
        <div
          className={`fixed inset-0 z-40 lg:hidden ${isMobileSidebarOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}
          aria-hidden={!isMobileSidebarOpen}
        >
          <button
            type="button"
            aria-label="Fechar menu"
            onClick={() => setIsMobileSidebarOpen(false)}
            className={`absolute inset-0 bg-[rgba(2,8,22,0.82)] backdrop-blur-sm transition-opacity duration-300 ${
              isMobileSidebarOpen ? 'opacity-100' : 'opacity-0'
            }`}
          />
          <div
            className={`absolute inset-y-2 left-2 w-[min(17.5rem,calc(100vw-1rem))] transition-transform duration-300 ease-out ${
              isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-[calc(100%+1rem)]'
            }`}
          >
            <div className="relative h-full overflow-hidden border border-[var(--mb-border-mid)] bg-[linear-gradient(180deg,rgba(5,14,36,0.96),rgba(4,11,28,0.98))] shadow-[0_28px_80px_-42px_rgba(0,0,0,0.95)]">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(90%_90%_at_0%_0%,rgba(63,155,255,0.16),transparent_62%),radial-gradient(75%_75%_at_100%_100%,rgba(39,98,191,0.14),transparent_68%)]" />
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(194,230,255,0.28),transparent)]" />
              <div className="relative h-full">
                <Sidebar
                  onNavigate={() => setIsMobileSidebarOpen(false)}
                  onClose={() => setIsMobileSidebarOpen(false)}
                  showMobileCloseButton
                />
              </div>
            </div>
          </div>
        </div>

        {/* Desktop sidebar */}
        <aside
          className={`relative z-20 hidden transition-[width] duration-300 ease-out lg:fixed lg:inset-y-0 lg:left-0 lg:block lg:p-4 ${sidebarWidthClass}`}
        >
          <div className="lg:h-[calc(100vh-2rem)]">
            <Sidebar collapsed={isSidebarCollapsed} />
          </div>
        </aside>

        {/* Content area */}
        <div className={`relative transition-[margin] duration-300 ease-out ${contentOffsetClass}`}>
          <div className="relative sticky top-0 z-30 mb-3 -mx-2 px-2 pt-3.5 pb-5 sm:mb-4 sm:-mx-3 sm:px-3 sm:pt-3.5 sm:pb-6 md:static md:top-auto md:mx-0 md:px-0 md:pt-2 md:pb-3 lg:pt-0 lg:pb-3">
            <div
              className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(2,8,22,0.92)_0%,rgba(3,12,34,0.68)_52%,transparent_100%)] backdrop-blur-md transition-opacity duration-500 md:hidden"
              style={{ opacity: scrollShade > 0 ? 1 : 0 }}
            />
            <Navbar
              isSidebarCollapsed={isSidebarCollapsed}
              onToggleSidebar={() => setIsSidebarCollapsed((c) => !c)}
              onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
            />
          </div>

          <main className="relative mt-0 p-0 lg:min-h-[calc(100vh-6.75rem)]">
            <div className="relative flex min-h-full flex-col">
              {children ?? <Outlet />}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
