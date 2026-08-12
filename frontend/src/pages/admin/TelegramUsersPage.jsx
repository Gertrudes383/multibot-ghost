import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Users, Search } from 'lucide-react';
import { getTelegramUsers } from '@services/admin.service';
import { formatBRL, formatDate } from '@utils/format';
import DataTable from '@components/ui/DataTable';
import InputField from '@components/ui/InputField';
import ActionButton from '@components/ui/ActionButton';
import Pagination from '@components/ui/Pagination';

export default function TelegramUsersPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'telegram', 'users', { page, search: query }],
    queryFn: () => getTelegramUsers({ page, search: query }),
  });

  const columns = [
    { key: 'telegramId', label: 'Telegram ID', render: (v) => <span className="font-mono text-[12px] text-[var(--mb-text-primary)]">{v}</span> },
    { key: 'username', label: 'Username' },
    { key: 'firstName', label: 'Nome' },
    { key: 'botName', label: 'Bot' },
    { key: 'balance', label: 'Saldo', render: (v) => formatBRL(v) },
    { key: 'createdAt', label: 'Data Registro', render: (v) => formatDate(v) },
  ];

  const users = data?.users || [];

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Users className="w-5 h-5 text-[var(--mb-accent-300)]" />
        <h1 className="text-xl font-bold text-[var(--mb-text-primary)]">Usuarios do Telegram</h1>
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
          <InputField value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar usuario..." onKeyDown={(e) => { if (e.key === 'Enter') { setQuery(search); setPage(1); } }} />
        </div>
        <ActionButton variant="outline" onClick={() => { setQuery(search); setPage(1); }}><Search className="w-4 h-4" /></ActionButton>
      </div>

      <DataTable columns={columns} data={users} isLoading={isLoading} emptyTitle="Nenhum usuario encontrado" />
      <Pagination page={page} totalPages={data?.totalPages} onPageChange={setPage} />
    </div>
  );
}
