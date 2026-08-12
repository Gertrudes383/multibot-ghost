import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Building2, Plus, Edit, Trash2, Search } from 'lucide-react';
import { getTenants, createTenant, updateTenant, deleteTenant } from '@services/superadmin.service';
import { formatDate, formatNumber } from '@utils/format';
import { toast } from '@stores/toastStore';
import DataTable from '@components/ui/DataTable';
import ActionButton from '@components/ui/ActionButton';
import StatusBadge from '@components/ui/StatusBadge';
import Modal from '@components/ui/Modal';
import InputField from '@components/ui/InputField';
import Pagination from '@components/ui/Pagination';

export default function TenantsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ name: '', domain: '', plan: 'basic' });

  const { data, isLoading } = useQuery({
    queryKey: ['superadmin', 'tenants', { page, search: query }],
    queryFn: () => getTenants({ page, search: query }),
  });

  const createMut = useMutation({
    mutationFn: createTenant,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['superadmin', 'tenants'] }); toast.success('Tenant criado'); setShowCreate(false); },
    onError: (e) => toast.error(e?.data?.message || 'Erro ao criar'),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data: d }) => updateTenant(id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['superadmin', 'tenants'] }); toast.success('Tenant atualizado'); setEditItem(null); },
    onError: (e) => toast.error(e?.data?.message || 'Erro ao atualizar'),
  });

  const deleteMut = useMutation({
    mutationFn: deleteTenant,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['superadmin', 'tenants'] }); toast.success('Tenant removido'); },
    onError: (e) => toast.error(e?.data?.message || 'Erro ao remover'),
  });

  const columns = [
    { key: 'name', label: 'Nome', render: (v) => <span className="font-medium text-[var(--mb-text-primary)]">{v}</span> },
    { key: 'domain', label: 'Dominio', render: (v) => <span className="font-mono text-[12px]">{v}</span> },
    { key: 'plan', label: 'Plano' },
    { key: 'usersCount', label: 'Usuarios', render: (v) => formatNumber(v) },
    { key: 'status', label: 'Status', render: (v) => <StatusBadge status={v === 'active' ? 'active' : 'inactive'} label={v === 'active' ? 'Ativo' : 'Inativo'} /> },
    { key: 'createdAt', label: 'Criado em', render: (v) => formatDate(v) },
    {
      key: '_actions', label: 'Acoes', render: (_, row) => (
        <div className="flex gap-1">
          <ActionButton variant="ghost" size="sm" onClick={() => { setEditItem(row); setForm({ name: row.name, domain: row.domain, plan: row.plan }); }}><Edit className="w-3.5 h-3.5" /></ActionButton>
          <ActionButton variant="danger" size="sm" onClick={() => { if (confirm('Remover tenant?')) deleteMut.mutate(row._id); }}><Trash2 className="w-3.5 h-3.5" /></ActionButton>
        </div>
      ),
    },
  ];

  const formFields = (
    <div className="space-y-4">
      <InputField label="Nome" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Nome do tenant" />
      <InputField label="Dominio" value={form.domain} onChange={(e) => setForm((p) => ({ ...p, domain: e.target.value }))} placeholder="exemplo.com" />
      <div className="space-y-1.5">
        <label className="block text-[12px] font-medium text-[var(--mb-text-muted)]">Plano</label>
        <select value={form.plan} onChange={(e) => setForm((p) => ({ ...p, plan: e.target.value }))} className="w-full px-3 py-2 text-[13px] text-[var(--mb-text-primary)] bg-[var(--mb-surface-900)] border border-[var(--mb-border-soft)] outline-none focus:border-[var(--mb-accent-300)]">
          <option value="basic">Basic</option>
          <option value="pro">Pro</option>
          <option value="enterprise">Enterprise</option>
        </select>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Building2 className="w-5 h-5 text-[var(--mb-accent-300)]" />
          <h1 className="text-xl font-bold text-[var(--mb-text-primary)]">Tenants</h1>
        </div>
        <ActionButton onClick={() => { setShowCreate(true); setForm({ name: '', domain: '', plan: 'basic' }); }}><Plus className="w-4 h-4 mr-1" />Novo Tenant</ActionButton>
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
          <InputField value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar tenant..." onKeyDown={(e) => { if (e.key === 'Enter') { setQuery(search); setPage(1); } }} />
        </div>
        <ActionButton variant="outline" onClick={() => { setQuery(search); setPage(1); }}><Search className="w-4 h-4" /></ActionButton>
      </div>

      <DataTable columns={columns} data={data?.tenants || []} isLoading={isLoading} emptyTitle="Nenhum tenant encontrado" />
      <Pagination page={page} totalPages={data?.totalPages} onPageChange={setPage} />

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Novo Tenant">
        {formFields}
        <ActionButton variant="accent" className="w-full mt-4" loading={createMut.isPending} onClick={() => createMut.mutate(form)}>Criar Tenant</ActionButton>
      </Modal>

      <Modal open={!!editItem} onClose={() => setEditItem(null)} title="Editar Tenant">
        {formFields}
        <ActionButton variant="accent" className="w-full mt-4" loading={updateMut.isPending} onClick={() => updateMut.mutate({ id: editItem._id, data: form })}>Salvar</ActionButton>
      </Modal>
    </div>
  );
}
