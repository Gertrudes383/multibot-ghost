import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ShoppingCart } from 'lucide-react';
import { getCards, getCountries } from '@services/cards.service';
import { purchase } from '@services/purchases.service';
import { useStockUpdates } from '@hooks/useStockUpdates';
import { toast } from '@stores/toastStore';
import SelectField from '@components/ui/SelectField';
import ActionButton from '@components/ui/ActionButton';
import DataTable from '@components/ui/DataTable';
import Pagination from '@components/ui/Pagination';
import Surface from '@components/ui/Surface';
import { formatBRL } from '@utils/format';

const BANDEIRAS = [
  { value: 'visa', label: 'Visa' },
  { value: 'mastercard', label: 'Mastercard' },
  { value: 'amex', label: 'American Express' },
  { value: 'elo', label: 'Elo' },
];

const TIPOS = [
  { value: 'credit', label: 'Credito' },
  { value: 'debit', label: 'Debito' },
];

const NIVEIS = [
  { value: 'classic', label: 'Classic' },
  { value: 'gold', label: 'Gold' },
  { value: 'platinum', label: 'Platinum' },
  { value: 'black', label: 'Black' },
];

export default function CatalogPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ country: '', bin: '', brand: '', type: '', level: '' });

  useStockUpdates();

  const { data: countries } = useQuery({
    queryKey: ['countries'],
    queryFn: getCountries,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['cards', filters, page],
    queryFn: () => getCards({ ...filters, page, limit: 20 }),
  });

  const buyMutation = useMutation({
    mutationFn: (cardId) => purchase({ cardId, quantity: 1 }),
    onSuccess: () => {
      toast.success('Compra realizada com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['cards'] });
    },
    onError: (err) => toast.error(err?.data?.message || 'Erro ao comprar'),
  });

  const updateFilter = (key, value) => {
    setFilters((p) => ({ ...p, [key]: value }));
    setPage(1);
  };

  const countryOptions = (countries || []).map((c) => ({ value: c.code || c, label: c.name || c }));

  const columns = [
    { key: 'bin', label: 'BIN', render: (v) => <span className="font-mono">{v}</span> },
    { key: 'country', label: 'Pais' },
    { key: 'type', label: 'Tipo' },
    { key: 'level', label: 'Nivel' },
    { key: 'price', label: 'Preco', render: (v) => <span className="font-semibold">{formatBRL(v)}</span> },
    {
      key: '_id',
      label: 'Acao',
      render: (_, row) => (
        <ActionButton
          variant="accent"
          size="sm"
          onClick={() => buyMutation.mutate(row._id)}
          loading={buyMutation.isPending}
          disabled={buyMutation.isPending}
        >
          <ShoppingCart className="w-3.5 h-3.5 mr-1" /> Comprar
        </ActionButton>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[var(--mb-text-primary)]">Catalogo</h1>
        <p className="text-[13px] text-[var(--mb-text-muted)] mt-1">Encontre e compre cards disponiveis.</p>
      </div>

      <Surface className="p-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          <SelectField label="Pais" placeholder="Todos" options={countryOptions} value={filters.country} onChange={(e) => updateFilter('country', e.target.value)} />
          <SelectField label="Bandeira" placeholder="Todas" options={BANDEIRAS} value={filters.brand} onChange={(e) => updateFilter('brand', e.target.value)} />
          <SelectField label="Tipo" placeholder="Todos" options={TIPOS} value={filters.type} onChange={(e) => updateFilter('type', e.target.value)} />
          <SelectField label="Nivel" placeholder="Todos" options={NIVEIS} value={filters.level} onChange={(e) => updateFilter('level', e.target.value)} />
          <div className="flex items-end">
            <ActionButton variant="outline" onClick={() => { setFilters({ country: '', bin: '', brand: '', type: '', level: '' }); setPage(1); }}>
              Limpar Filtros
            </ActionButton>
          </div>
        </div>
      </Surface>

      <DataTable
        columns={columns}
        data={data?.cards || data?.data || []}
        isLoading={isLoading}
        emptyTitle="Nenhum card disponivel"
        emptyDescription="Tente ajustar os filtros."
      />

      <Pagination page={page} totalPages={data?.totalPages || 1} onPageChange={setPage} />
    </div>
  );
}
