import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { getPromotions, createPromotion, updatePromotion, deletePromotion } from '@services/admin.service';
import { toast } from '@stores/toastStore';
import ActionButton from '@components/ui/ActionButton';
import DataTable from '@components/ui/DataTable';
import Pagination from '@components/ui/Pagination';
import Modal from '@components/ui/Modal';
import InputField from '@components/ui/InputField';
import StatusBadge from '@components/ui/StatusBadge';
import { formatDate } from '@utils/format';

export default function PromotionsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', discount: '', startDate: '', endDate: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'promotions', page],
    queryFn: () => getPromotions({ page }),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin', 'promotions'] });

  const saveMut = useMutation({
    mutationFn: (d) => editing ? updatePromotion(editing._id, d) : createPromotion(d),
    onSuccess: () => { toast.success(editing ? 'Promocao atualizada' : 'Promocao criada'); closeModal(); invalidate(); },
    onError: (e) => toast.error(e?.data?.message || 'Erro'),
  });

  const delMut = useMutation({
    mutationFn: deletePromotion,
    onSuccess: () => { toast.success('Promocao removida'); invalidate(); },
    onError: (e) => toast.error(e?.data?.message || 'Erro'),
  });

  function openCreate() { setEditing(null); setForm({ name: '', discount: '', startDate: '', endDate: '' }); setModalOpen(true); }
  function openEdit(row) { setEditing(row); setForm({ name: row.name, discount: String(row.discount || ''), startDate: row.startDate?.slice(0, 10) || '', endDate: row.endDate?.slice(0, 10) || '' }); setModalOpen(true); }
  function closeModal() { setModalOpen(false); setEditing(null); }
  function u(field, value) { setForm((f) => ({ ...f, [field]: value })); }

  const columns = [
    { key: 'name', label: 'Nome' },
    { key: 'discount', label: 'Desconto', render: (v) => `${v}%` },
    { key: 'startDate', label: 'Inicio', render: (v) => formatDate(v) },
    { key: 'endDate', label: 'Fim', render: (v) => formatDate(v) },
    { key: 'active', label: 'Status', render: (v) => <StatusBadge status={v ? 'active' : 'inactive'} label={v ? 'Ativa' : 'Inativa'} /> },
    {
      key: '_actions', label: 'Acoes', render: (_, row) => (
        <div className="flex gap-1">
          <button className="p-1 text-[var(--mb-text-caption)] hover:text-[var(--mb-accent-300)]" onClick={() => openEdit(row)}><Edit className="w-3.5 h-3.5" /></button>
          <button className="p-1 text-[var(--mb-text-caption)] hover:text-[var(--mb-error)]" onClick={() => delMut.mutate(row._id)}><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-[var(--mb-text-primary)]">Promocoes</h1>
        <ActionButton variant="accent" size="sm" onClick={openCreate}><Plus className="w-3.5 h-3.5" /> Nova Promocao</ActionButton>
      </div>

      <DataTable columns={columns} data={data?.promotions || data?.data || []} isLoading={isLoading} emptyTitle="Nenhuma promocao" />
      <Pagination page={page} totalPages={data?.totalPages || 1} onPageChange={setPage} />

      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Editar Promocao' : 'Nova Promocao'}>
        <div className="space-y-4">
          <InputField label="Nome" value={form.name} onChange={(e) => u('name', e.target.value)} />
          <InputField label="Desconto (%)" type="number" value={form.discount} onChange={(e) => u('discount', e.target.value)} />
          <InputField label="Data Inicio" type="date" value={form.startDate} onChange={(e) => u('startDate', e.target.value)} />
          <InputField label="Data Fim" type="date" value={form.endDate} onChange={(e) => u('endDate', e.target.value)} />
          <ActionButton variant="accent" className="w-full" loading={saveMut.isPending} onClick={() => saveMut.mutate({ name: form.name, discount: Number(form.discount), startDate: form.startDate, endDate: form.endDate })}>
            {editing ? 'Salvar' : 'Criar'}
          </ActionButton>
        </div>
      </Modal>
    </div>
  );
}
