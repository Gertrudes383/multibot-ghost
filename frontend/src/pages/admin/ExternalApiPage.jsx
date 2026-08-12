import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Key } from 'lucide-react';
import { getApiKeys, createApiKey, deleteApiKey } from '@services/admin.service';
import { toast } from '@stores/toastStore';
import ActionButton from '@components/ui/ActionButton';
import DataTable from '@components/ui/DataTable';
import Modal from '@components/ui/Modal';
import InputField from '@components/ui/InputField';
import { formatDate, maskToken } from '@utils/format';

export default function ExternalApiPage() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: '', permissions: '' });
  const [newKey, setNewKey] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'api-keys'],
    queryFn: getApiKeys,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin', 'api-keys'] });

  const createMut = useMutation({
    mutationFn: createApiKey,
    onSuccess: (result) => { toast.success('Chave criada'); setNewKey(result?.key || result?.apiKey); invalidate(); },
    onError: (e) => toast.error(e?.data?.message || 'Erro'),
  });

  const delMut = useMutation({
    mutationFn: deleteApiKey,
    onSuccess: () => { toast.success('Chave removida'); invalidate(); },
    onError: (e) => toast.error(e?.data?.message || 'Erro'),
  });

  const columns = [
    { key: 'name', label: 'Nome' },
    { key: 'key', label: 'Chave', render: (v) => <span className="font-mono text-[12px]">{maskToken(v)}</span> },
    { key: 'permissions', label: 'Permissoes', render: (v) => Array.isArray(v) ? v.join(', ') : v },
    { key: 'createdAt', label: 'Criado em', render: (v) => formatDate(v) },
    {
      key: '_actions', label: 'Acoes', render: (_, row) => (
        <button className="p-1 text-[var(--mb-text-caption)] hover:text-[var(--mb-error)]" onClick={() => delMut.mutate(row._id)}>
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-5 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Key className="w-5 h-5 text-[var(--mb-accent-300)]" />
          <h1 className="text-xl font-bold text-[var(--mb-text-primary)]">API Externa</h1>
        </div>
        <ActionButton variant="accent" size="sm" onClick={() => { setCreateOpen(true); setNewKey(null); setForm({ name: '', permissions: '' }); }}>
          <Plus className="w-3.5 h-3.5" /> Nova Chave
        </ActionButton>
      </div>

      <DataTable columns={columns} data={data?.keys || data?.data || data || []} isLoading={isLoading} emptyTitle="Nenhuma chave de API" emptyDescription="Crie uma chave para integrar com sistemas externos." />

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Nova Chave de API">
        <div className="space-y-4">
          {newKey ? (
            <div className="space-y-3">
              <p className="text-[13px] text-[var(--mb-warning)]">Copie a chave agora. Ela nao sera exibida novamente.</p>
              <div className="p-3 font-mono text-[12px] text-[var(--mb-text-primary)] bg-[var(--mb-bg-950)] border border-[var(--mb-border-soft)] break-all select-all">
                {newKey}
              </div>
              <ActionButton variant="outline" className="w-full" onClick={() => setCreateOpen(false)}>Fechar</ActionButton>
            </div>
          ) : (
            <>
              <InputField label="Nome" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ex: integracao-crm" />
              <InputField label="Permissoes (separadas por virgula)" value={form.permissions} onChange={(e) => setForm((f) => ({ ...f, permissions: e.target.value }))} placeholder="read,write" />
              <ActionButton variant="accent" className="w-full" loading={createMut.isPending} onClick={() => createMut.mutate({ name: form.name, permissions: form.permissions.split(',').map((p) => p.trim()).filter(Boolean) })}>
                Criar Chave
              </ActionButton>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
