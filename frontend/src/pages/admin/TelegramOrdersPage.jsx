import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ShoppingCart } from 'lucide-react';
import { getTelegramOrders } from '@services/admin.service';
import { formatBRL, formatDateTime } from '@utils/format';
import DataTable from '@components/ui/DataTable';
import StatusBadge from '@components/ui/StatusBadge';
import Pagination from '@components/ui/Pagination';

const STATUS_MAP = { completed: 'active', pending: 'pending', cancelled: 'error', refunded: 'info' };

export default function TelegramOrdersPage() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'telegram', 'orders', page],
    queryFn: () => getTelegramOrders({ page }),
  });

  const columns = [
    { key: '_id', label: 'ID', render: (v) => <span className="font-mono text-[12px]">{v?.slice(-8)}</span> },
    { key: 'username', label: 'Usuario' },
    { key: 'product', label: 'Produto' },
    { key: 'quantity', label: 'Qtd' },
    { key: 'total', label: 'Valor', render: (v) => <span className="font-medium text-[var(--mb-text-primary)]">{formatBRL(v)}</span> },
    { key: 'status', label: 'Status', render: (v) => <StatusBadge status={STATUS_MAP[v] || 'info'} label={v} /> },
    { key: 'createdAt', label: 'Data', render: (v) => formatDateTime(v) },
  ];

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <ShoppingCart className="w-5 h-5 text-[var(--mb-accent-300)]" />
        <h1 className="text-xl font-bold text-[var(--mb-text-primary)]">Pedidos Telegram</h1>
      </div>
      <DataTable columns={columns} data={data?.orders || []} isLoading={isLoading} emptyTitle="Nenhum pedido" />
      <Pagination page={page} totalPages={data?.totalPages} onPageChange={setPage} />
    </div>
  );
}
