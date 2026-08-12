import { Outlet } from 'react-router-dom';
import Header from './Header';

export default function PublicLayout() {
  return (
    <div className="min-h-screen bg-[var(--mb-bg-950)] text-[var(--mb-text-secondary)] flex flex-col">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_-10%,rgba(53,197,255,0.14),transparent_50%),radial-gradient(circle_at_80%_120%,rgba(0,125,237,0.12),transparent_50%)]" />
      <Header />
      <main className="relative flex-1">
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
