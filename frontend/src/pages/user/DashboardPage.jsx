import { DollarSign, ShoppingCart, TrendingUp, CreditCard } from 'lucide-react';
import { useAuthStore } from '@stores/authStore';
import StatCard from '@components/ui/StatCard';
import DataTable from '@components/ui/DataTable';
import { formatBRL } from '@utils/format';

const COLUMNS = [
  { key: '_id', label: 'ID', render: (v) => <span className="font-mono text-[12px]">{v?.slice(-8) || '-'}</span> },
  { key: 'createdAt', label: 'Data' },
  { key: 'quantity', label: 'Qtd' },
  { key: 'total', label: 'Valor', render: (v) => formatBRL(v) },
  { key: 'status', label: 'Status' },
];

export default function DashboardPage() {
  const user = useAuthStore((s) => s.session?.user);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[var(--mb-text-primary)]">
          Bem-vindo, {user?.username || 'Usuario'}
        </h1>
        <p className="text-[13px] text-[var(--mb-text-muted)] mt-1">
          Acompanhe suas estatisticas e compras recentes.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Saldo" value={formatBRL(user?.balance)} icon={DollarSign} accent="var(--mb-success)" />
        <StatCard title="Compras Hoje" value={user?.purchasesToday || '0'} icon={ShoppingCart} accent="var(--mb-info)" />
        <StatCard title="Total Gasto" value={formatBRL(user?.totalSpent)} icon={TrendingUp} accent="var(--mb-warning)" />
        <StatCard title="Cards Disponiveis" value={user?.availableCards || '0'} icon={CreditCard} accent="var(--mb-accent-300)" />
      </div>

      <div>
        <h2 className="text-[14px] font-semibold text-[var(--mb-text-primary)] mb-3">Compras Recentes</h2>
        <DataTable
          columns={COLUMNS}
          data={user?.recentPurchases || []}
          emptyTitle="Nenhuma compra recente"
          emptyDescription="Suas compras aparecerão aqui."
        />
      </div>
    </div>
  );
}
