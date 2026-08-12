import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Ban, DollarSign, Trash2, ShieldCheck } from 'lucide-react';
import { getUsers, banUser, unbanUser, deleteUser, creditUser } from '@services/admin.service';
import { toast } from '@stores/toastStore';
import InputField from '@components/ui/InputField';
import ActionButton from '@components/ui/ActionButton';
import StatusBadge from '@components/ui/StatusBadge';
import DataTable from '@components/ui/DataTable';
import Pagination from '@components/ui/Pagination';
import Modal from '@components/ui/Modal';
import { formatBRL, formatDateTime } from '@utils/format';

const roleMap = { admin: 'info', owner: 'active', support: 'pending', user: 'inactive' };

export default function UsersPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [creditModal, setCreditModal] = useState(null);
  const [creditForm, setCreditForm] = useState({ amount: '', reason: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'users', { page, search }],
    queryFn: () => getUsers({ page, search }),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });

  const banMut = useMutation({
    mutationFn: banUser,
    onSuccess: () => { toast.success('Usuario banido'); invalidate(); },
    onError: (e) => toast.error(e?.data?.message || 'Erro'),
  });

  const unbanMut = useMutation({
    mutationFn: unbanUser,
    onSuccess: () => { toast.success('Ban removido'); invalidate(); },
    onError: (e) => toast.error(e?.data?.message || 'Erro'),
  });

  const delMut = useMutation({
    mutationFn: deleteUser,
    onSuccess: () => { toast.success('Usuario removido'); invalidate(); },
    onError: (e) => toast.error(e?.data?.message || 'Erro'),
  });

  const creditMut = useMutation({
    mutationFn: ({ id, data: d }) => creditUser(id, d),
    onSuccess: () => { toast.success('Credito adicionado'); setCreditModal(null); invalidate(); },
    onError: (e) => toast.error(e?.data?.message || 'Erro'),
  });

  const columns = [
    { key: 'username', label: 'Usuario' },
    { key: 'email', label: 'Email' },
    { key: 'role', label: 'Role', render: (v) => <StatusBadge status={roleMap[v] || 'info'} label={v} /> },
    { key: 'balance', label: 'Saldo', render: (v) => formatBRL(v) },
    { key: 'banned', label: 'Status', render: (v) => <StatusBadge status={v ? 'error' : 'active'} label={v ? 'Banido' : 'Ativo'} /> },
    { key: 'createdAt', label: 'Criado em', render: (v) => formatDateTime(v) },
    {
      key: '_actions', label: 'Acoes', render: (_, row) => (
        <div className="flex gap-1">
          <button className="p-1 text-[var(--mb-text-caption)] hover:text-[var(--mb-accent-300)]" title="Creditar" onClick={() => { setCreditModal(row); setCreditForm({ amount: '', reason: '' }); }}><DollarSign className="w-3.5 h-3.5" /></button>
          {row.banned
            ? <button className="p-1 text-[var(--mb-text-caption)] hover:text-[var(--mb-success)]" title="Desbanir" onClick={() => unbanMut.mutate(row._id)}><ShieldCheck className="w-3.5 h-3.5" /></button>
            : <button className="p-1 text-[var(--mb-text-caption)] hover:text-[var(--mb-warning)]" title="Banir" onClick={() => banMut.mutate(row._id)}><Ban className="w-3.5 h-3.5" /></button>
          }
          <button className="p-1 text-[var(--mb-text-caption)] hover:text-[var(--mb-error)]" title="Excluir" onClick={() => delMut.mutate(row._id)}><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-[var(--mb-text-primary)]">Usuarios</h1>
      </div>

      <div className="max-w-sm">
        <InputField
          placeholder="Buscar por usuario, email..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
      </div>

      <DataTable columns={columns} data={data?.users || data?.data || []} isLoading={isLoading} emptyTitle="Nenhum usuario encontrado" />
      <Pagination page={page} totalPages={data?.totalPages || 1} onPageChange={setPage} />

      <Modal open={!!creditModal} onClose={() => setCreditModal(null)} title={`Creditar - ${creditModal?.username || ''}`}>
        <div className="space-y-4">
          <InputField label="Valor (R$)" type="number" value={creditForm.amount} onChange={(e) => setCreditForm((f) => ({ ...f, amount: e.target.value }))} />
          <InputField label="Motivo" value={creditForm.reason} onChange={(e) => setCreditForm((f) => ({ ...f, reason: e.target.value }))} />
          <ActionButton
            variant="accent"
            className="w-full"
            loading={creditMut.isPending}
            onClick={() => creditMut.mutate({ id: creditModal._id, data: { amount: Number(creditForm.amount), reason: creditForm.reason } })}
          >
            Creditar
          </ActionButton>
        </div>
      </Modal>
    </div>
  );
}
