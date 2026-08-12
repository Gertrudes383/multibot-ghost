import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText } from 'lucide-react';
import { getPurchaseValidationLogs } from '@services/admin.service';
import { formatDateTime } from '@utils/format';
import DataTable from '@components/ui/DataTable';
import StatusBadge from '@components/ui/StatusBadge';
import Pagination from '@components/ui/Pagination';

const columns = [
  { key: 'orderId', label: 'Pedido', render: (v) => <span className="font-mono text-[11px]">{v}</span> },
  { key: 'user', label: 'Usuario', render: (v) => v?.username || v || '-' },
  { key: 'action', label: 'Acao' },
  {
    key: 'result', label: 'Resultado', render: (v) => (
      <StatusBadge status={v === 'approved' ? 'active' : v === 'rejected' ? 'error' : 'pending'} label={v || '-'} />
    ),
  },
  { key: 'reason', label: 'Motivo', render: (v) => <span className="text-[var(--mb-text-muted)]">{v || '-'}</span> },
  { key: 'createdAt', label: 'Data', render: (v) => formatDateTime(v) },
];

export default function PurchaseValidationLogsPage() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'validation-logs', { page }],
    queryFn: () => getPurchaseValidationLogs({ page }),
  });

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <FileText className="w-5 h-5 text-[var(--mb-accent-300)]" />
        <h1 className="text-xl font-bold text-[var(--mb-text-primary)]">Logs de Validacao de Compras</h1>
      </div>

      <DataTable columns={columns} data={data?.logs || []} isLoading={isLoading} emptyTitle="Nenhum log encontrado" />
      <Pagination page={page} totalPages={data?.totalPages} onPageChange={setPage} />
    </div>
  );
}
