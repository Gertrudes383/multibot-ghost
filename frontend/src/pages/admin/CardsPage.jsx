import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, Trash2, Edit, Search } from 'lucide-react';
import { getAdminCards, uploadCards, deleteCard } from '@services/admin.service';
import { toast } from '@stores/toastStore';
import Surface from '@components/ui/Surface';
import InputField from '@components/ui/InputField';
import SelectField from '@components/ui/SelectField';
import ActionButton from '@components/ui/ActionButton';
import StatusBadge from '@components/ui/StatusBadge';
import DataTable from '@components/ui/DataTable';
import Pagination from '@components/ui/Pagination';
import Modal from '@components/ui/Modal';

const STATUS_OPTS = [
  { value: 'active', label: 'Ativo' },
  { value: 'sold', label: 'Vendido' },
  { value: 'inactive', label: 'Inativo' },
];

const statusMap = { active: 'active', sold: 'info', inactive: 'inactive', expired: 'error' };

export default function CardsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [gateway, setGateway] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState([]);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadText, setUploadText] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'cards', { page, status, gateway, search }],
    queryFn: () => getAdminCards({ page, status, gateway, search }),
  });

  const deleteMut = useMutation({
    mutationFn: deleteCard,
    onSuccess: () => { toast.success('Card removido'); queryClient.invalidateQueries({ queryKey: ['admin', 'cards'] }); },
    onError: (e) => toast.error(e?.data?.message || 'Erro ao remover'),
  });

  const uploadMut = useMutation({
    mutationFn: uploadCards,
    onSuccess: (r) => { toast.success(`${r?.imported || 0} cards importados`); setUploadOpen(false); setUploadText(''); queryClient.invalidateQueries({ queryKey: ['admin', 'cards'] }); },
    onError: (e) => toast.error(e?.data?.message || 'Erro no upload'),
  });

  const cards = data?.cards || data?.data || [];
  const totalPages = data?.totalPages || 1;

  const columns = [
    { key: 'bin', label: 'BIN', render: (v) => <span className="font-mono">{v}</span> },
    { key: 'country', label: 'Pais' },
    { key: 'type', label: 'Tipo' },
    { key: 'level', label: 'Nivel' },
    { key: 'status', label: 'Status', render: (v) => <StatusBadge status={statusMap[v] || 'info'} label={v} /> },
    { key: 'gateway', label: 'Gateway' },
    {
      key: '_actions', label: 'Acoes', render: (_, row) => (
        <div className="flex gap-1">
          <button className="p-1 text-[var(--mb-text-caption)] hover:text-[var(--mb-accent-300)]"><Edit className="w-3.5 h-3.5" /></button>
          <button className="p-1 text-[var(--mb-text-caption)] hover:text-[var(--mb-error)]" onClick={() => deleteMut.mutate(row._id)}><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-[var(--mb-text-primary)]">Cards</h1>
        <ActionButton variant="accent" size="sm" onClick={() => setUploadOpen(true)}>
          <Upload className="w-3.5 h-3.5" /> Upload
        </ActionButton>
      </div>

      <Surface className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1"><SelectField label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} options={STATUS_OPTS} placeholder="Todos" /></div>
          <div className="flex-1"><InputField label="Gateway" value={gateway} onChange={(e) => { setGateway(e.target.value); setPage(1); }} placeholder="Ex: stripe" /></div>
          <div className="flex-1"><InputField label="Busca" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="BIN, pais..." /></div>
        </div>
      </Surface>

      <DataTable columns={columns} data={cards} isLoading={isLoading} emptyTitle="Nenhum card encontrado" emptyDescription="Faca upload para adicionar cards." />
      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />

      <Modal open={uploadOpen} onClose={() => setUploadOpen(false)} title="Upload de Cards">
        <div className="space-y-4">
          <textarea
            value={uploadText}
            onChange={(e) => setUploadText(e.target.value)}
            placeholder="Cole os cards aqui (um por linha)"
            rows={8}
            className="w-full px-3 py-2 text-[13px] text-[var(--mb-text-primary)] bg-[var(--mb-surface-900)] border border-[var(--mb-border-soft)] outline-none focus:border-[var(--mb-accent-300)] font-mono"
          />
          <ActionButton
            variant="accent"
            className="w-full"
            loading={uploadMut.isPending}
            onClick={() => uploadMut.mutate({ cards: uploadText.split('\n').filter(Boolean) })}
          >
            Importar
          </ActionButton>
        </div>
      </Modal>
    </div>
  );
}
