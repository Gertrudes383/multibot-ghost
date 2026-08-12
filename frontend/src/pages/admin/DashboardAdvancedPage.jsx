import { useQuery } from '@tanstack/react-query';
import { TrendingUp, DollarSign, BarChart2 } from 'lucide-react';
import { getDashboardAdvanced } from '@services/admin.service';
import StatCard from '@components/ui/StatCard';
import Surface from '@components/ui/Surface';
import DataTable from '@components/ui/DataTable';
import Spinner from '@components/ui/Spinner';
import { formatBRL, formatDateTime, formatNumber } from '@utils/format';

const binColumns = [
  { key: 'bin', label: 'BIN', render: (v) => <span className="font-mono text-[12px]">{v}</span> },
  { key: 'total', label: 'Total', render: (v) => formatNumber(v) },
  { key: 'revenue', label: 'Receita', render: (v) => formatBRL(v) },
];

const countryColumns = [
  { key: 'country', label: 'Pais' },
  { key: 'total', label: 'Vendas', render: (v) => formatNumber(v) },
  { key: 'revenue', label: 'Receita', render: (v) => formatBRL(v) },
];

export default function DashboardAdvancedPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'dashboard', 'advanced'],
    queryFn: getDashboardAdvanced,
  });

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  const stats = data?.stats || {};
  const daily = data?.dailyRevenue || [];

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <TrendingUp className="w-5 h-5 text-[var(--mb-accent-300)]" />
        <h1 className="text-xl font-bold text-[var(--mb-text-primary)]">Dashboard Avancado — 30 Dias</h1>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard title="Receita Total" value={formatBRL(stats.totalRevenue)} icon={DollarSign} accent="var(--mb-success)" />
        <StatCard title="Ticket Medio" value={formatBRL(stats.avgOrderValue)} icon={BarChart2} accent="var(--mb-warning)" />
        <StatCard title="Taxa de Conversao" value={stats.conversionRate != null ? `${stats.conversionRate}%` : '—'} icon={TrendingUp} accent="var(--mb-info)" />
      </div>

      <Surface className="p-5">
        <h3 className="text-[13px] font-semibold text-[var(--mb-text-muted)] mb-4">Receita Diaria</h3>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {daily.length === 0 && <p className="text-[13px] text-[var(--mb-text-caption)]">Sem dados</p>}
          {daily.map((d, i) => (
            <div key={i} className="flex items-center justify-between text-[13px] py-1.5 border-b border-[var(--mb-border-soft)] last:border-0">
              <span className="text-[var(--mb-text-muted)]">{d.date || formatDateTime(d.createdAt)}</span>
              <span className="font-medium text-[var(--mb-text-primary)]">{formatBRL(d.revenue)}</span>
              <span className="text-[var(--mb-text-caption)]">{formatNumber(d.orders)} pedidos</span>
            </div>
          ))}
        </div>
      </Surface>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <h3 className="text-[13px] font-semibold text-[var(--mb-text-muted)] mb-3">Top BINs</h3>
          <DataTable columns={binColumns} data={data?.topBins || []} emptyTitle="Sem dados de BIN" />
        </div>
        <div>
          <h3 className="text-[13px] font-semibold text-[var(--mb-text-muted)] mb-3">Top Paises</h3>
          <DataTable columns={countryColumns} data={data?.topCountries || []} emptyTitle="Sem dados de pais" />
        </div>
      </div>
    </div>
  );
}
