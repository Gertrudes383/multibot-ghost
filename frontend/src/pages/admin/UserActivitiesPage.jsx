import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity } from 'lucide-react';
import { getUserActivities } from '@services/admin.service';
import { formatDateTime } from '@utils/format';
import DataTable from '@components/ui/DataTable';
import SelectField from '@components/ui/SelectField';
import Pagination from '@components/ui/Pagination';
import StatusBadge from '@components/ui/StatusBadge';

const typeOptions = [
  { value: '', label: 'Todos os tipos' },
  { value: 'purchase', label: 'Compra' },
  { value: 'recharge', label: 'Recarga' },
  { value: 'login', label: 'Login' },
  { value: 'withdrawal', label: 'Saque' },
  { value: 'referral', label: 'Referral' },
];

const typeStatusMap = { purchase: 'active', recharge: 'info', login: 'inactive', withdrawal: 'warning', referral: 'info' };

export default function UserActivitiesPage() {
  const [page, setPage] = useState(1);
  const [type, setType] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'user-activities', { page, type }],
    queryFn: () => getUserActivities({ page, type: type || undefined }),
  });

  const columns = [
    { key: 'type', label: 'Tipo', render: (v) => <StatusBadge status={typeStatusMap[v] || 'inactive'} label={v} /> },
    { key: 'userId', label: 'User ID', render: (v) => <span className="font-mono text-[12px] text-[var(--mb-text-primary)]">{v}</span> },
    { key: 'details', label: 'Detalhes', render: (v) => <span className="text-[12px] text-[var(--mb-text-secondary)] truncate max-w-[200px] block">{typeof v === 'object' ? JSON.stringify(v) : (v || '—')}</span> },
    { key: 'ip_address', label: 'IP', render: (v) => <span className="font-mono text-[11px] text-[var(--mb-text-caption)]">{v || '—'}</span> },
    { key: 'createdAt', label: 'Data', render: (v) => formatDateTime(v) },
  ];

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity className="w-5 h-5 text-[var(--mb-accent-300)]" />
          <h1 className="text-xl font-bold text-[var(--mb-text-primary)]">Atividades dos Usuarios</h1>
        </div>
        <div className="w-52">
          <SelectField
            value={type}
            onChange={(e) => { setType(e.target.value); setPage(1); }}
            options={typeOptions}
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={data?.activities || data?.data || []}
        isLoading={isLoading}
        emptyTitle="Nenhuma atividade encontrada"
      />
      <Pagination page={page} totalPages={data?.totalPages || 1} onPageChange={setPage} />
    </div>
  );
}
