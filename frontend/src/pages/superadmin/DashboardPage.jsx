import { useQuery } from '@tanstack/react-query';
import { Building2, Users, DollarSign, Bot } from 'lucide-react';
import { getSuperadminDashboard } from '@services/superadmin.service';
import { formatBRL, formatNumber, formatDateTime } from '@utils/format';
import StatCard from '@components/ui/StatCard';
import DataTable from '@components/ui/DataTable';
import Spinner from '@components/ui/Spinner';

export default function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['superadmin', 'dashboard'],
    queryFn: getSuperadminDashboard,
  });

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  const stats = data?.stats || {};
  const activity = data?.recentActivity || [];

  const activityColumns = [
    { key: 'action', label: 'Acao' },
    { key: 'tenant', label: 'Tenant' },
    { key: 'user', label: 'Usuario' },
    { key: 'createdAt', label: 'Data', render: (v) => formatDateTime(v) },
  ];

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-xl font-bold text-[var(--mb-text-primary)]">SuperAdmin Dashboard</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Tenants" value={formatNumber(stats.totalTenants)} icon={Building2} />
        <StatCard title="Usuarios Globais" value={formatNumber(stats.totalUsers)} icon={Users} />
        <StatCard title="Receita Global" value={formatBRL(stats.totalRevenue)} icon={DollarSign} accent="var(--mb-success)" />
        <StatCard title="Bots Ativos" value={formatNumber(stats.activeBots)} icon={Bot} accent="var(--mb-warning)" />
      </div>

      <h2 className="text-[14px] font-semibold text-[var(--mb-text-primary)]">Atividade Recente</h2>
      <DataTable columns={activityColumns} data={activity} emptyTitle="Sem atividade recente" />
    </div>
  );
}
