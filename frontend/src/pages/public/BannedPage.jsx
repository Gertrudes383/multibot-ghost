import { Link } from 'react-router-dom';
import { ShieldOff } from 'lucide-react';
import GlassPanel from '@components/ui/GlassPanel';
import ActionButton from '@components/ui/ActionButton';

export default function BannedPage() {
  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] px-4">
      <GlassPanel className="w-full max-w-md p-8 text-center">
        <ShieldOff className="w-12 h-12 text-[var(--mb-error)] mx-auto mb-4" />
        <h1 className="text-xl font-bold text-[var(--mb-text-primary)] mb-2">
          Conta Suspensa
        </h1>
        <p className="text-[13px] text-[var(--mb-text-muted)] mb-6">
          Sua conta foi suspensa por violar os termos de uso da plataforma.
          Se voce acredita que houve um engano, entre em contato com o suporte.
        </p>
        <Link to="/login">
          <ActionButton variant="outline" className="w-full">
            Voltar ao Login
          </ActionButton>
        </Link>
      </GlassPanel>
    </div>
  );
}
