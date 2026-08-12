import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { searchGlobal } from '@services/superadmin.service';
import { formatDate } from '@utils/format';
import DataTable from '@components/ui/DataTable';
import InputField from '@components/ui/InputField';
import ActionButton from '@components/ui/ActionButton';
import Surface from '@components/ui/Surface';

const userColumns = [
  { key: 'username', label: 'Usuario', render: (v) => <span className="font-medium text-[var(--mb-text-primary)]">{v}</span> },
  { key: 'email', label: 'Email' },
  { key: 'tenant', label: 'Tenant', render: (v) => v?.name || v || '-' },
  { key: 'createdAt', label: 'Criado em', render: (v) => formatDate(v) },
];

const botColumns = [
  { key: 'name', label: 'Nome', render: (v) => <span className="font-medium text-[var(--mb-text-primary)]">{v}</span> },
  { key: 'username', label: 'Username', render: (v) => v ? `@${v}` : '-' },
  { key: 'tenant', label: 'Tenant', render: (v) => v?.name || v || '-' },
  { key: 'status', label: 'Status' },
];

const orderColumns = [
  { key: '_id', label: 'ID', render: (v) => <span className="font-mono text-[11px]">{v}</span> },
  { key: 'user', label: 'Usuario', render: (v) => v?.username || v || '-' },
  { key: 'tenant', label: 'Tenant', render: (v) => v?.name || v || '-' },
  { key: 'amount', label: 'Valor' },
  { key: 'createdAt', label: 'Data', render: (v) => formatDate(v) },
];

export default function SearchPage() {
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['superadmin', 'search', query],
    queryFn: () => searchGlobal({ query }),
    enabled: query.length >= 2,
  });

  const handleSearch = () => {
    if (input.trim().length >= 2) setQuery(input.trim());
  };

  const users = data?.users || [];
  const bots = data?.bots || [];
  const orders = data?.orders || [];

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Search className="w-5 h-5 text-[var(--mb-accent-300)]" />
        <h1 className="text-xl font-bold text-[var(--mb-text-primary)]">Busca Global</h1>
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
          <InputField
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Buscar usuarios, bots, pedidos..."
            onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
          />
        </div>
        <ActionButton onClick={handleSearch} disabled={input.trim().length < 2}>
          <Search className="w-4 h-4 mr-1" />Buscar
        </ActionButton>
      </div>

      {query && (
        <div className="space-y-6">
          <Surface className="p-4 space-y-3">
            <h2 className="text-[14px] font-semibold text-[var(--mb-text-primary)]">
              Usuarios <span className="text-[var(--mb-text-muted)] font-normal">({users.length})</span>
            </h2>
            <DataTable columns={userColumns} data={users} isLoading={isLoading} emptyTitle="Nenhum usuario encontrado" />
          </Surface>

          <Surface className="p-4 space-y-3">
            <h2 className="text-[14px] font-semibold text-[var(--mb-text-primary)]">
              Bots <span className="text-[var(--mb-text-muted)] font-normal">({bots.length})</span>
            </h2>
            <DataTable columns={botColumns} data={bots} isLoading={isLoading} emptyTitle="Nenhum bot encontrado" />
          </Surface>

          <Surface className="p-4 space-y-3">
            <h2 className="text-[14px] font-semibold text-[var(--mb-text-primary)]">
              Pedidos <span className="text-[var(--mb-text-muted)] font-normal">({orders.length})</span>
            </h2>
            <DataTable columns={orderColumns} data={orders} isLoading={isLoading} emptyTitle="Nenhum pedido encontrado" />
          </Surface>
        </div>
      )}
    </div>
  );
}
