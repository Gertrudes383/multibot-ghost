import { useQuery } from '@tanstack/react-query';
import { Bot, Users, ShoppingCart, CreditCard, DollarSign, Activity } from 'lucide-react';
import { getSuperadminStats } from '@services/superadmin.service';
import { formatBRL, formatNumber } from '@utils/format';
import StatCard from '@components/ui/StatCard';
import Spinner from '@components/ui/Spinner';

export default function StatsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['superadmin', 'stats'],
    queryFn: getSuperadminStats,
  });

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  const stats = data?.stats || data || {};

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Activity className="w-5 h-5 text-[var(--mb-accent-300)]" />
        <h1 className="text-xl font-bold text-[var(--mb-text-primary)]">Estatísticas Globais</h1>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard title="Total de Bots" value={formatNumber(stats.totalBots)} icon={Bot} />
        <StatCard title="Total de Usuarios" value={formatNumber(stats.totalUsers)} icon={Users} />
        <StatCard title="Total de Pedidos" value={formatNumber(stats.totalOrders)} icon={ShoppingCart} />
        <StatCard title="Total de Cards" value={formatNumber(stats.totalCards)} icon={CreditCard} />
        <StatCard title="Receita Total" value={formatBRL(stats.totalRevenue)} icon={DollarSign} accent="var(--mb-success)" />
        <StatCard title="Bots Rodando" value={formatNumber(stats.runningBots)} icon={Activity} accent="var(--mb-warning)" />
      </div>
    </div>
  );
}
