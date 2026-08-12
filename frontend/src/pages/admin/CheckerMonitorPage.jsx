import { useQuery } from '@tanstack/react-query';
import { Activity, CheckCircle, XCircle, Layers } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { getCheckerMonitor } from '@services/admin.service';
import StatCard from '@components/ui/StatCard';
import Surface from '@components/ui/Surface';
import Spinner from '@components/ui/Spinner';
import { formatNumber } from '@utils/format';

const chartTooltipStyle = {
  contentStyle: { background: 'var(--mb-surface-900)', border: '1px solid var(--mb-border-soft)', color: 'var(--mb-text-primary)' },
};

export default function CheckerMonitorPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'checker', 'monitor'],
    queryFn: getCheckerMonitor,
    refetchInterval: 10000,
  });

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  const m = data || {};

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-xl font-bold text-[var(--mb-text-primary)]">Monitor do Checker</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Requisicoes/min" value={formatNumber(m.requestsPerMinute)} icon={Activity} />
        <StatCard title="Aprovados/min" value={formatNumber(m.approvedPerMinute)} icon={CheckCircle} accent="var(--mb-success)" />
        <StatCard title="Reprovados/min" value={formatNumber(m.rejectedPerMinute)} icon={XCircle} accent="var(--mb-error)" />
        <StatCard title="Fila" value={formatNumber(m.queueSize)} icon={Layers} accent="var(--mb-warning)" />
      </div>

      <Surface className="p-5">
        <h3 className="text-[13px] font-semibold text-[var(--mb-text-muted)] mb-4">Historico de Checks</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={m.history || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--mb-border-soft)" />
              <XAxis dataKey="time" tick={{ fill: 'var(--mb-text-caption)', fontSize: 11 }} />
              <YAxis tick={{ fill: 'var(--mb-text-caption)', fontSize: 11 }} />
              <Tooltip {...chartTooltipStyle} />
              <Line type="monotone" dataKey="approved" stroke="var(--mb-success)" dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="rejected" stroke="var(--mb-error)" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Surface>
    </div>
  );
}
