import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { getBatches, createBatch, updateBatch, deleteBatch } from '@services/admin.service';
import { toast } from '@stores/toastStore';
import ActionButton from '@components/ui/ActionButton';
import DataTable from '@components/ui/DataTable';
import Pagination from '@components/ui/Pagination';
import Modal from '@components/ui/Modal';
import InputField from '@components/ui/InputField';
import StatusBadge from '@components/ui/StatusBadge';
import { formatBRL, formatDate, formatNumber } from '@utils/format';

export default function BatchesPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', price: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'batches', page],
    queryFn: () => getBatches({ page }),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin', 'batches'] });

  const saveMut = useMutation({
    mutationFn: (d) => editing ? updateBatch(editing._id, d) : createBatch(d),
    onSuccess: () => { toast.success(editing ? 'Lote atualizado' : 'Lote criado'); closeModal(); invalidate(); },
    onError: (e) => toast.error(e?.data?.message || 'Erro'),
  });

  const delMut = useMutation({
    mutationFn: deleteBatch,
    onSuccess: () => { toast.success('Lote removido'); invalidate(); },
    onError: (e) => toast.error(e?.data?.message || 'Erro ao remover'),
  });

  function openCreate() { setEditing(null); setForm({ name: '', price: '' }); setModalOpen(true); }
  function openEdit(row) { setEditing(row); setForm({ name: row.name, price: String(row.price || '') }); setModalOpen(true); }
  function closeModal() { setModalOpen(false); setEditing(null); }

  const columns = [
    { key: 'name', label: 'Nome' },
    { key: 'quantity', label: 'Quantidade', render: (v) => formatNumber(v) },
    { key: 'price', label: 'Preco', render: (v) => formatBRL(v) },
    { key: 'status', label: 'Status', render: (v) => <StatusBadge status={v === 'active' ? 'active' : 'inactive'} label={v === 'active' ? 'Ativo' : 'Inativo'} /> },
    { key: 'createdAt', label: 'Criado em', render: (v) => formatDate(v) },
    {
      key: '_actions', label: 'Acoes', render: (_, row) => (
        <div className="flex gap-1">
          <button className="p-1 text-[var(--mb-text-caption)] hover:text-[var(--mb-accent-300)]" onClick={() => openEdit(row)}><Edit className="w-3.5 h-3.5" /></button>
          <button className="p-1 text-[var(--mb-text-caption)] hover:text-[var(--mb-error)]" onClick={() => delMut.mutate(row._id)}><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      ),
    },
  ];

  const batches = data?.batches || data?.data || [];

  return (
    <div className="space-y-5 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-[var(--mb-text-primary)]">Lotes</h1>
        <ActionButton variant="accent" size="sm" onClick={openCreate}><Plus className="w-3.5 h-3.5" /> Novo Lote</ActionButton>
      </div>

      <DataTable columns={columns} data={batches} isLoading={isLoading} emptyTitle="Nenhum lote encontrado" />
      <Pagination page={page} totalPages={data?.totalPages || 1} onPageChange={setPage} />

      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Editar Lote' : 'Novo Lote'}>
        <div className="space-y-4">
          <InputField label="Nome" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <InputField label="Preco (R$)" type="number" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} />
          <ActionButton variant="accent" className="w-full" loading={saveMut.isPending} onClick={() => saveMut.mutate({ name: form.name, price: Number(form.price) })}>
            {editing ? 'Salvar' : 'Criar'}
          </ActionButton>
        </div>
      </Modal>
    </div>
  );
}
