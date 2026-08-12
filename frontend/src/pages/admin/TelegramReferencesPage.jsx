import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, Plus, Trash2 } from 'lucide-react';
import { getTelegramReferences, createTelegramReference, deleteTelegramReference } from '@services/admin.service';
import { formatDateTime } from '@utils/format';
import { toast } from '@stores/toastStore';
import DataTable from '@components/ui/DataTable';
import ActionButton from '@components/ui/ActionButton';
import Pagination from '@components/ui/Pagination';
import Modal from '@components/ui/Modal';
import InputField from '@components/ui/InputField';

export default function TelegramReferencesPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', ref_code: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'telegram', 'references', { page }],
    queryFn: () => getTelegramReferences({ page }),
  });

  const createMut = useMutation({
    mutationFn: () => createTelegramReference(form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'telegram', 'references'] }); toast.success('Referencia criada'); setShowCreate(false); setForm({ name: '', ref_code: '' }); },
    onError: (e) => toast.error(e?.data?.message || 'Erro ao criar'),
  });

  const deleteMut = useMutation({
    mutationFn: deleteTelegramReference,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'telegram', 'references'] }); toast.success('Referencia removida'); },
    onError: (e) => toast.error(e?.data?.message || 'Erro ao remover'),
  });

  const columns = [
    { key: 'name', label: 'Nome', render: (v) => <span className="font-medium text-[var(--mb-text-primary)]">{v}</span> },
    { key: 'ref_code', label: 'Codigo', render: (v) => <span className="font-mono text-[12px]">{v}</span> },
    { key: 'clicks', label: 'Cliques', render: (v) => v ?? 0 },
    { key: 'conversions', label: 'Conversoes', render: (v) => v ?? 0 },
    { key: 'createdAt', label: 'Criado em', render: (v) => formatDateTime(v) },
    {
      key: '_actions', label: '', render: (_, row) => (
        <ActionButton variant="danger" size="sm" onClick={() => { if (confirm('Remover referencia?')) deleteMut.mutate(row._id); }}>
          <Trash2 className="w-3.5 h-3.5" />
        </ActionButton>
      ),
    },
  ];

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link className="w-5 h-5 text-[var(--mb-accent-300)]" />
          <h1 className="text-xl font-bold text-[var(--mb-text-primary)]">Referencias Telegram</h1>
        </div>
        <ActionButton onClick={() => setShowCreate(true)}><Plus className="w-4 h-4 mr-1" />Nova Referencia</ActionButton>
      </div>

      <DataTable columns={columns} data={data?.references || []} isLoading={isLoading} emptyTitle="Nenhuma referencia encontrada" />
      <Pagination page={page} totalPages={data?.totalPages} onPageChange={setPage} />

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Nova Referencia">
        <div className="space-y-4">
          <InputField label="Nome" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Nome da campanha" />
          <InputField label="Codigo de Referencia" value={form.ref_code} onChange={(e) => setForm((p) => ({ ...p, ref_code: e.target.value }))} placeholder="codigo_unico" />
        </div>
        <ActionButton variant="accent" className="w-full mt-4" loading={createMut.isPending} onClick={() => createMut.mutate()}>Criar</ActionButton>
      </Modal>
    </div>
  );
}
