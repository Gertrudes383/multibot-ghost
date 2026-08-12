import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeftRight } from 'lucide-react';
import { getTelegramExchanges } from '@services/admin.service';
import { formatBRL, formatDateTime } from '@utils/format';
import DataTable from '@components/ui/DataTable';
import StatusBadge from '@components/ui/StatusBadge';
import Pagination from '@components/ui/Pagination';

const STATUS_MAP = { completed: 'active', pending: 'pending', cancelled: 'error' };

export default function TelegramExchangesPage() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'telegram', 'exchanges', page],
    queryFn: () => getTelegramExchanges({ page }),
  });

  const columns = [
    { key: '_id', label: 'ID', render: (v) => <span className="font-mono text-[12px]">{v?.slice(-8)}</span> },
    { key: 'from', label: 'De' },
    { key: 'to', label: 'Para' },
    { key: 'amount', label: 'Valor', render: (v) => formatBRL(v) },
    { key: 'status', label: 'Status', render: (v) => <StatusBadge status={STATUS_MAP[v] || 'info'} label={v} /> },
    { key: 'createdAt', label: 'Data', render: (v) => formatDateTime(v) },
  ];

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <ArrowLeftRight className="w-5 h-5 text-[var(--mb-accent-300)]" />
        <h1 className="text-xl font-bold text-[var(--mb-text-primary)]">Trocas Telegram</h1>
      </div>
      <DataTable columns={columns} data={data?.exchanges || []} isLoading={isLoading} emptyTitle="Nenhuma troca" />
      <Pagination page={page} totalPages={data?.totalPages} onPageChange={setPage} />
    </div>
  );
}
