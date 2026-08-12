import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Trophy } from 'lucide-react';
import { getTopUsers } from '@services/admin.service';
import { formatBRL, formatNumber } from '@utils/format';
import DataTable from '@components/ui/DataTable';
import SelectField from '@components/ui/SelectField';

const sortOptions = [
  { value: 'balance', label: 'Maior Saldo' },
  { value: 'purchases', label: 'Mais Compras' },
];

export default function TopUsersPage() {
  const [sortBy, setSortBy] = useState('balance');

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'top-users', sortBy],
    queryFn: () => getTopUsers({ sortBy }),
  });

  const columns = [
    { key: '_rank', label: '#', render: (_, __, idx) => <span className="font-bold text-[var(--mb-accent-300)]">{idx + 1}</span> },
    { key: 'username', label: 'Username', render: (v) => <span className="font-medium text-[var(--mb-text-primary)]">{v || '—'}</span> },
    { key: 'telegram_username', label: 'Telegram', render: (v) => v ? <span className="font-mono text-[12px]">@{v}</span> : '—' },
    { key: 'purchaseCount', label: 'Compras', render: (v) => formatNumber(v ?? 0) },
    { key: 'balance', label: 'Saldo', render: (v) => formatBRL(v ?? 0) },
    { key: 'totalSpent', label: 'Total Gasto', render: (v) => formatBRL(v ?? 0) },
  ];

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Trophy className="w-5 h-5 text-[var(--mb-accent-300)]" />
          <h1 className="text-xl font-bold text-[var(--mb-text-primary)]">Top Compradores</h1>
        </div>
        <div className="w-48">
          <SelectField
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            options={sortOptions}
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={data?.users || data || []}
        isLoading={isLoading}
        emptyTitle="Nenhum usuario encontrado"
      />
    </div>
  );
}
