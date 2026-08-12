import { useQuery } from '@tanstack/react-query';
import { Users, ShoppingCart, DollarSign, CreditCard } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar,
} from 'recharts';
import { getDashboard } from '@services/admin.service';
import StatCard from '@components/ui/StatCard';
import Surface from '@components/ui/Surface';
import Spinner from '@components/ui/Spinner';
import DataTable from '@components/ui/DataTable';
import { formatBRL, formatDateTime, formatNumber } from '@utils/format';

const activityColumns = [
  { key: 'action', label: 'Acao' },
  { key: 'username', label: 'Usuario' },
  { key: 'createdAt', label: 'Data', render: (v) => formatDateTime(v) },
];

const buyersColumns = [
  { key: 'username', label: 'Usuario' },
  { key: 'totalPurchases', label: 'Compras', render: (v) => formatNumber(v) },
  { key: 'totalSpent', label: 'Valor Total', render: (v) => formatBRL(v) },
];

const chartTooltipStyle = {
  contentStyle: { background: 'var(--mb-surface-900)', border: '1px solid var(--mb-border-soft)', color: 'var(--mb-text-primary)' },
  labelStyle: { color: 'var(--mb-text-muted)' },
};

export default function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'dashboard'],
    queryFn: getDashboard,
  });

  if (isLoading) {
    return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;
  }

  const stats = data?.stats || {};

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-xl font-bold text-[var(--mb-text-primary)]">Dashboard</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Usuarios" value={formatNumber(stats.totalUsers)} icon={Users} />
        <StatCard title="Vendas Hoje" value={formatNumber(stats.salesToday)} icon={ShoppingCart} accent="var(--mb-success)" />
        <StatCard title="Receita Total" value={formatBRL(stats.totalRevenue)} icon={DollarSign} accent="var(--mb-warning)" />
        <StatCard title="Cards Ativos" value={formatNumber(stats.activeCards)} icon={CreditCard} accent="var(--mb-info)" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Surface className="p-5">
          <h3 className="text-[13px] font-semibold text-[var(--mb-text-muted)] mb-4">Vendas - Ultimos 7 Dias</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.salesChart || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--mb-border-soft)" />
                <XAxis dataKey="name" tick={{ fill: 'var(--mb-text-caption)', fontSize: 11 }} />
                <YAxis tick={{ fill: 'var(--mb-text-caption)', fontSize: 11 }} />
                <Tooltip {...chartTooltipStyle} />
                <Area type="monotone" dataKey="vendas" stroke="var(--mb-accent-300)" fill="var(--mb-accent-300)" fillOpacity={0.15} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Surface>

        <Surface className="p-5">
          <h3 className="text-[13px] font-semibold text-[var(--mb-text-muted)] mb-4">Top Paises</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.countriesChart || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--mb-border-soft)" />
                <XAxis dataKey="pais" tick={{ fill: 'var(--mb-text-caption)', fontSize: 11 }} />
                <YAxis tick={{ fill: 'var(--mb-text-caption)', fontSize: 11 }} />
                <Tooltip {...chartTooltipStyle} />
                <Bar dataKey="total" fill="var(--mb-accent-500)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Surface>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <h3 className="text-[13px] font-semibold text-[var(--mb-text-muted)] mb-3">Atividade Recente</h3>
          <DataTable columns={activityColumns} data={data?.recentActivity || []} emptyTitle="Sem atividade recente" />
        </div>
        <div>
          <h3 className="text-[13px] font-semibold text-[var(--mb-text-muted)] mb-3">Top Compradores</h3>
          <DataTable columns={buyersColumns} data={data?.topBuyers || []} emptyTitle="Sem dados" />
        </div>
      </div>
    </div>
  );
}
