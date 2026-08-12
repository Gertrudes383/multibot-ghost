import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CreditCard } from 'lucide-react';
import { getSuperadminPayments } from '@services/superadmin.service';
import { formatBRL, formatDate } from '@utils/format';
import DataTable from '@components/ui/DataTable';
import StatusBadge from '@components/ui/StatusBadge';
import Pagination from '@components/ui/Pagination';
import SelectField from '@components/ui/SelectField';

const STATUS_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'active', label: 'Ativo' },
  { value: 'expired', label: 'Expirado' },
  { value: 'cancelled', label: 'Cancelado' },
];

const STATUS_MAP = {
  active: { status: 'active', label: 'Ativo' },
  expired: { status: 'inactive', label: 'Expirado' },
  cancelled: { status: 'error', label: 'Cancelado' },
};

export default function PaymentsPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['superadmin', 'payments', { page, status: statusFilter }],
    queryFn: () => getSuperadminPayments({ page, status: statusFilter || undefined }),
  });

  const columns = [
    {
      key: 'tenant',
      label: 'Usuario (Tenant)',
      render: (v) => (
        <span className="font-medium text-[var(--mb-text-primary)]">
          {v?.username || v?.name || '-'}
        </span>
      ),
    },
    {
      key: 'plan',
      label: 'Plano',
      render: (v) => <span className="text-[var(--mb-text-secondary)]">{v?.name || v || '-'}</span>,
    },
    {
      key: 'amount',
      label: 'Valor',
      render: (v) => <span className="font-mono text-[var(--mb-success)]">{formatBRL(v)}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (v) => {
        const preset = STATUS_MAP[v] || { status: 'info', label: v || '-' };
        return <StatusBadge status={preset.status} label={preset.label} />;
      },
    },
    {
      key: 'start_date',
      label: 'Inicio',
      render: (v) => formatDate(v),
    },
    {
      key: 'end_date',
      label: 'Fim',
      render: (v) => formatDate(v),
    },
    {
      key: 'createdAt',
      label: 'Criado em',
      render: (v) => formatDate(v),
    },
  ];

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <CreditCard className="w-5 h-5 text-[var(--mb-accent-300)]" />
        <h1 className="text-xl font-bold text-[var(--mb-text-primary)]">Pagamentos de Assinatura</h1>
      </div>

      <div className="flex gap-3">
        <div className="w-48">
          <SelectField
            label=""
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            options={STATUS_OPTIONS}
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={data?.payments || []}
        isLoading={isLoading}
        emptyTitle="Nenhum pagamento encontrado"
      />
      <Pagination page={page} totalPages={data?.totalPages} onPageChange={setPage} />
    </div>
  );
}
