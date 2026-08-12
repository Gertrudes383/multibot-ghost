import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { UserPlus } from 'lucide-react';
import { getTelegramAffiliates } from '@services/admin.service';
import { formatBRL } from '@utils/format';
import DataTable from '@components/ui/DataTable';
import StatusBadge from '@components/ui/StatusBadge';
import Pagination from '@components/ui/Pagination';

export default function TelegramAffiliatesPage() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'telegram', 'affiliates', page],
    queryFn: () => getTelegramAffiliates({ page }),
  });

  const columns = [
    { key: 'username', label: 'Usuario', render: (v) => <span className="font-medium text-[var(--mb-text-primary)]">{v}</span> },
    { key: 'referrals', label: 'Indicados' },
    { key: 'earnings', label: 'Ganhos', render: (v) => formatBRL(v) },
    { key: 'status', label: 'Status', render: (v) => <StatusBadge status={v === 'active' ? 'active' : 'inactive'} label={v === 'active' ? 'Ativo' : 'Inativo'} /> },
  ];

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <UserPlus className="w-5 h-5 text-[var(--mb-accent-300)]" />
        <h1 className="text-xl font-bold text-[var(--mb-text-primary)]">Afiliados Telegram</h1>
      </div>
      <DataTable columns={columns} data={data?.affiliates || []} isLoading={isLoading} emptyTitle="Nenhum afiliado" />
      <Pagination page={page} totalPages={data?.totalPages} onPageChange={setPage} />
    </div>
  );
}
