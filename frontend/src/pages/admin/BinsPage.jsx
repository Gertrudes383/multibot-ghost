import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { getBins, createBin, updateBin, deleteBin } from '@services/admin.service';
import { toast } from '@stores/toastStore';
import ActionButton from '@components/ui/ActionButton';
import DataTable from '@components/ui/DataTable';
import Pagination from '@components/ui/Pagination';
import Modal from '@components/ui/Modal';
import InputField from '@components/ui/InputField';
import SelectField from '@components/ui/SelectField';

const LEVEL_OPTS = [
  { value: 'classic', label: 'Classic' },
  { value: 'gold', label: 'Gold' },
  { value: 'platinum', label: 'Platinum' },
  { value: 'black', label: 'Black' },
];

export default function BinsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ bin: '', bank: '', brand: '', type: '', level: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'bins', page],
    queryFn: () => getBins({ page }),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin', 'bins'] });

  const saveMut = useMutation({
    mutationFn: (d) => editing ? updateBin(editing._id, d) : createBin(d),
    onSuccess: () => { toast.success(editing ? 'BIN atualizado' : 'BIN criado'); closeModal(); invalidate(); },
    onError: (e) => toast.error(e?.data?.message || 'Erro'),
  });

  const delMut = useMutation({
    mutationFn: deleteBin,
    onSuccess: () => { toast.success('BIN removido'); invalidate(); },
    onError: (e) => toast.error(e?.data?.message || 'Erro'),
  });

  function openCreate() { setEditing(null); setForm({ bin: '', bank: '', brand: '', type: '', level: '' }); setModalOpen(true); }
  function openEdit(row) { setEditing(row); setForm({ bin: row.bin, bank: row.bank || '', brand: row.brand || '', type: row.type || '', level: row.level || '' }); setModalOpen(true); }
  function closeModal() { setModalOpen(false); setEditing(null); }
  function updateField(field, value) { setForm((f) => ({ ...f, [field]: value })); }

  const columns = [
    { key: 'bin', label: 'BIN', render: (v) => <span className="font-mono">{v}</span> },
    { key: 'bank', label: 'Banco' },
    { key: 'brand', label: 'Bandeira' },
    { key: 'type', label: 'Tipo' },
    { key: 'level', label: 'Nivel' },
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
        <h1 className="text-xl font-bold text-[var(--mb-text-primary)]">BINs</h1>
        <ActionButton variant="accent" size="sm" onClick={openCreate}><Plus className="w-3.5 h-3.5" /> Novo BIN</ActionButton>
      </div>

      <DataTable columns={columns} data={data?.bins || data?.data || []} isLoading={isLoading} emptyTitle="Nenhum BIN cadastrado" />
      <Pagination page={page} totalPages={data?.totalPages || 1} onPageChange={setPage} />

      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Editar BIN' : 'Novo BIN'}>
        <div className="space-y-4">
          <InputField label="BIN" value={form.bin} onChange={(e) => updateField('bin', e.target.value)} disabled={!!editing} />
          <InputField label="Banco" value={form.bank} onChange={(e) => updateField('bank', e.target.value)} />
          <InputField label="Bandeira" value={form.brand} onChange={(e) => updateField('brand', e.target.value)} />
          <InputField label="Tipo" value={form.type} onChange={(e) => updateField('type', e.target.value)} placeholder="credito / debito" />
          <SelectField label="Nivel" value={form.level} onChange={(e) => updateField('level', e.target.value)} options={LEVEL_OPTS} placeholder="Selecione" />
          <ActionButton variant="accent" className="w-full" loading={saveMut.isPending} onClick={() => saveMut.mutate(form)}>
            {editing ? 'Salvar' : 'Criar'}
          </ActionButton>
        </div>
      </Modal>
    </div>
  );
}
