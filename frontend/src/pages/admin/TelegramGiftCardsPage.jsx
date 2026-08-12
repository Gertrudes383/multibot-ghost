import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Gift } from 'lucide-react';
import { getTelegramGiftCards } from '@services/admin.service';
import { formatBRL, formatDateTime } from '@utils/format';
import DataTable from '@components/ui/DataTable';
import StatusBadge from '@components/ui/StatusBadge';
import Pagination from '@components/ui/Pagination';

export default function TelegramGiftCardsPage() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'telegram', 'giftcards', page],
    queryFn: () => getTelegramGiftCards({ page }),
  });

  const columns = [
    { key: 'code', label: 'Codigo', render: (v) => <span className="font-mono text-[12px] text-[var(--mb-text-primary)]">{v}</span> },
    { key: 'amount', label: 'Valor', render: (v) => formatBRL(v) },
    { key: 'redeemedBy', label: 'Resgatado por' },
    { key: 'redeemedAt', label: 'Data', render: (v) => formatDateTime(v) },
    { key: 'status', label: 'Status', render: (v) => <StatusBadge status={v === 'redeemed' ? 'active' : v === 'active' ? 'info' : 'inactive'} label={v === 'redeemed' ? 'Resgatado' : v === 'active' ? 'Disponivel' : v} /> },
  ];

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Gift className="w-5 h-5 text-[var(--mb-accent-300)]" />
        <h1 className="text-xl font-bold text-[var(--mb-text-primary)]">Gift Cards Telegram</h1>
      </div>
      <DataTable columns={columns} data={data?.giftcards || []} isLoading={isLoading} emptyTitle="Nenhum gift card" />
      <Pagination page={page} totalPages={data?.totalPages} onPageChange={setPage} />
    </div>
  );
}
