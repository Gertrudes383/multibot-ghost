import { Copy, Users, DollarSign, Share2 } from 'lucide-react';
import { useAuthStore } from '@stores/authStore';
import { toast } from '@stores/toastStore';
import GlassPanel from '@components/ui/GlassPanel';
import StatCard from '@components/ui/StatCard';
import ActionButton from '@components/ui/ActionButton';
import { formatBRL } from '@utils/format';

export default function ReferralsPage() {
  const user = useAuthStore((s) => s.session?.user);
  const referralCode = user?.referralCode || user?.username || '-';
  const referralLink = `${window.location.origin}/login?mode=register&ref=${referralCode}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(referralLink);
    toast.success('Link copiado!');
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-[var(--mb-text-primary)]">Programa de Indicacoes</h1>

      <GlassPanel className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <Share2 className="w-6 h-6 text-[var(--mb-accent-300)]" />
          <h2 className="text-[14px] font-semibold text-[var(--mb-text-primary)]">Seu Link de Indicacao</h2>
        </div>
        <div className="flex gap-2">
          <input
            readOnly
            value={referralLink}
            className="flex-1 px-3 py-2 text-[12px] font-mono bg-[var(--mb-surface-900)] border border-[var(--mb-border-soft)] text-[var(--mb-text-secondary)] truncate"
          />
          <ActionButton variant="accent" size="sm" onClick={handleCopy}>
            <Copy className="w-3.5 h-3.5 mr-1" /> Copiar
          </ActionButton>
        </div>
        <p className="text-[12px] text-[var(--mb-text-caption)] mt-2">
          Codigo: <span className="font-mono font-semibold text-[var(--mb-accent-300)]">{referralCode}</span>
        </p>
      </GlassPanel>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard title="Total de Indicados" value={user?.referralCount || '0'} icon={Users} accent="var(--mb-info)" />
        <StatCard title="Ganhos com Indicacoes" value={formatBRL(user?.referralEarnings)} icon={DollarSign} accent="var(--mb-success)" />
        <StatCard title="Indicacoes Ativas" value={user?.activeReferrals || '0'} icon={Share2} accent="var(--mb-accent-300)" />
      </div>

      <GlassPanel className="p-6">
        <h2 className="text-[14px] font-semibold text-[var(--mb-text-primary)] mb-3">Como Funciona</h2>
        <div className="space-y-3">
          {[
            'Compartilhe seu link de indicacao com amigos.',
            'Quando alguem se cadastrar usando seu link, voce ganha creditos.',
            'Os creditos sao adicionados automaticamente ao seu saldo.',
          ].map((step, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="shrink-0 w-6 h-6 flex items-center justify-center text-[12px] font-bold bg-[rgba(53,197,255,0.08)] text-[var(--mb-accent-300)]">
                {i + 1}
              </span>
              <p className="text-[13px] text-[var(--mb-text-muted)]">{step}</p>
            </div>
          ))}
        </div>
      </GlassPanel>
    </div>
  );
}
