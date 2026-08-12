import { useQuery } from '@tanstack/react-query';
import { Server, Cpu, HardDrive, Clock } from 'lucide-react';
import { getSystemUptime, getSystemStatus } from '@services/admin.service';
import StatCard from '@components/ui/StatCard';
import DataTable from '@components/ui/DataTable';
import StatusBadge from '@components/ui/StatusBadge';
import Spinner from '@components/ui/Spinner';
import { formatNumber } from '@utils/format';

function fmtUptime(seconds) {
  if (!seconds) return '—';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${d}d ${h}h ${m}m`;
}

const botColumns = [
  { key: 'bot_name', label: 'Bot', render: (v, row) => <span className="font-medium text-[var(--mb-text-primary)]">{v || row.store_name || '—'}</span> },
  { key: 'bot_username', label: 'Username', render: (v) => v ? <span className="font-mono text-[12px]">@{v}</span> : '—' },
  { key: 'runtime_status', label: 'Status', render: (v) => <StatusBadge status={v === 'running' ? 'active' : v === 'stopped' ? 'inactive' : 'warning'} label={v || 'unknown'} /> },
  { key: 'uptime', label: 'Uptime', render: (v) => fmtUptime(v) },
];

export default function SystemUptimePage() {
  const { data: uptime, isLoading: loadingUptime } = useQuery({
    queryKey: ['admin', 'system', 'uptime'],
    queryFn: getSystemUptime,
    refetchInterval: 30000,
  });

  const { data: status, isLoading: loadingStatus } = useQuery({
    queryKey: ['admin', 'system', 'status'],
    queryFn: getSystemStatus,
    refetchInterval: 30000,
  });

  if (loadingUptime || loadingStatus) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  const mem = uptime?.memory;
  const memPct = mem ? `${Math.round((mem.heapUsed / mem.heapTotal) * 100)}%` : '—';

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Server className="w-5 h-5 text-[var(--mb-accent-300)]" />
        <h1 className="text-xl font-bold text-[var(--mb-text-primary)]">Status do Sistema</h1>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Processo Uptime" value={fmtUptime(uptime?.processUptime)} icon={Clock} />
        <StatCard title="Sistema Uptime" value={fmtUptime(uptime?.systemUptime)} icon={Server} accent="var(--mb-info)" />
        <StatCard title="Memoria (Heap)" value={memPct} icon={HardDrive} accent="var(--mb-warning)" />
        <StatCard title="CPU Load" value={uptime?.cpuLoad != null ? `${uptime.cpuLoad}%` : '—'} icon={Cpu} accent="var(--mb-success)" />
      </div>

      <div>
        <h3 className="text-[13px] font-semibold text-[var(--mb-text-muted)] mb-3">Status dos Bots</h3>
        <DataTable
          columns={botColumns}
          data={status?.bots || []}
          emptyTitle="Nenhum bot registrado"
        />
      </div>
    </div>
  );
}
