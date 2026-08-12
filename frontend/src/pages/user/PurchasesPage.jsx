import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { purchaseHistory } from '@services/purchases.service';
import DataTable from '@components/ui/DataTable';
import Pagination from '@components/ui/Pagination';
import StatusBadge from '@components/ui/StatusBadge';
import { formatBRL, formatDateTime } from '@utils/format';

const STATUS_MAP = {
  completed: { status: 'active', label: 'Concluida' },
  pending: { status: 'pending', label: 'Pendente' },
  failed: { status: 'error', label: 'Falha' },
  refunded: { status: 'info', label: 'Reembolsada' },
};

const COLUMNS = [
  { key: '_id', label: 'ID', render: (v) => <span className="font-mono text-[12px]">{v?.slice(-8) || '-'}</span> },
  { key: 'createdAt', label: 'Data', render: (v) => formatDateTime(v) },
  { key: 'quantity', label: 'Quantidade' },
  { key: 'total', label: 'Valor', render: (v) => <span className="font-semibold">{formatBRL(v)}</span> },
  {
    key: 'status',
    label: 'Status',
    render: (v) => {
      const s = STATUS_MAP[v] || { status: 'info', label: v };
      return <StatusBadge status={s.status} label={s.label} />;
    },
  },
];

export default function PurchasesPage() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['purchases', page],
    queryFn: () => purchaseHistory({ page, limit: 20 }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[var(--mb-text-primary)]">Historico de Compras</h1>
        <p className="text-[13px] text-[var(--mb-text-muted)] mt-1">Todas as suas compras realizadas na plataforma.</p>
      </div>

      <DataTable
        columns={COLUMNS}
        data={data?.purchases || data?.data || []}
        isLoading={isLoading}
        emptyTitle="Nenhuma compra encontrada"
        emptyDescription="Suas compras aparecerão aqui."
      />

      <Pagination page={page} totalPages={data?.totalPages || 1} onPageChange={setPage} />
    </div>
  );
}
