import { useQuery } from '@tanstack/react-query';
import { Activity, CheckCircle, XCircle, Clock } from 'lucide-react';
import { getCheckerStatus } from '@services/admin.service';
import StatCard from '@components/ui/StatCard';
import StatusBadge from '@components/ui/StatusBadge';
import Spinner from '@components/ui/Spinner';
import DataTable from '@components/ui/DataTable';
import { formatNumber, formatDateTime } from '@utils/format';

const recentColumns = [
  { key: 'bin', label: 'BIN', render: (v) => <span className="font-mono">{v}</span> },
  { key: 'result', label: 'Resultado', render: (v) => <StatusBadge status={v === 'live' ? 'active' : 'error'} label={v === 'live' ? 'Live' : 'Die'} /> },
  { key: 'gateway', label: 'Gateway' },
  { key: 'time', label: 'Tempo', render: (v) => `${v}ms` },
  { key: 'checkedAt', label: 'Data', render: (v) => formatDateTime(v) },
];

export default function CheckerPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'checker'],
    queryFn: getCheckerStatus,
    refetchInterval: 15000,
  });

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  const s = data || {};
  const rate = s.totalChecks > 0 ? ((s.approved / s.totalChecks) * 100).toFixed(1) : '0';

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold text-[var(--mb-text-primary)]">Checker</h1>
        <StatusBadge status={s.online ? 'active' : 'error'} label={s.online ? 'Online' : 'Offline'} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Checks" value={formatNumber(s.totalChecks)} icon={Activity} />
        <StatCard title="Aprovados" value={formatNumber(s.approved)} icon={CheckCircle} accent="var(--mb-success)" />
        <StatCard title="Reprovados" value={formatNumber(s.rejected)} icon={XCircle} accent="var(--mb-error)" />
        <StatCard title="Taxa de Aprovacao" value={`${rate}%`} icon={Clock} accent="var(--mb-warning)" />
      </div>

      <div>
        <h3 className="text-[13px] font-semibold text-[var(--mb-text-muted)] mb-3">Checagens Recentes</h3>
        <DataTable columns={recentColumns} data={s.recentChecks || []} emptyTitle="Nenhuma checagem recente" />
      </div>
    </div>
  );
}
