import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Wallet } from 'lucide-react';
import { getTelegramRecharges } from '@services/admin.service';
import { formatBRL, formatDateTime } from '@utils/format';
import DataTable from '@components/ui/DataTable';
import StatusBadge from '@components/ui/StatusBadge';
import Pagination from '@components/ui/Pagination';

const STATUS_MAP = { confirmed: 'active', pending: 'pending', expired: 'error', cancelled: 'inactive' };

export default function TelegramRechargesPage() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'telegram', 'recharges', page],
    queryFn: () => getTelegramRecharges({ page }),
  });

  const columns = [
    { key: '_id', label: 'ID', render: (v) => <span className="font-mono text-[12px]">{v?.slice(-8)}</span> },
    { key: 'username', label: 'Usuario' },
    { key: 'amount', label: 'Valor', render: (v) => <span className="font-medium text-[var(--mb-text-primary)]">{formatBRL(v)}</span> },
    { key: 'method', label: 'Metodo' },
    { key: 'status', label: 'Status', render: (v) => <StatusBadge status={STATUS_MAP[v] || 'info'} label={v} /> },
    { key: 'createdAt', label: 'Data', render: (v) => formatDateTime(v) },
  ];

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Wallet className="w-5 h-5 text-[var(--mb-accent-300)]" />
        <h1 className="text-xl font-bold text-[var(--mb-text-primary)]">Recargas Telegram</h1>
      </div>
      <DataTable columns={columns} data={data?.recharges || []} isLoading={isLoading} emptyTitle="Nenhuma recarga" />
      <Pagination page={page} totalPages={data?.totalPages} onPageChange={setPage} />
    </div>
  );
}
