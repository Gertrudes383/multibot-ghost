import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, User, RotateCcw, Plus } from 'lucide-react';
import { userLookup, getAssistantPurchases, getAssistantRecharges, refundPurchase, creditUserAssistant } from '@services/assistant.service';
import { formatBRL, formatDateTime } from '@utils/format';
import { toast } from '@stores/toastStore';
import GlassPanel from '@components/ui/GlassPanel';
import InputField from '@components/ui/InputField';
import ActionButton from '@components/ui/ActionButton';
import DataTable from '@components/ui/DataTable';
import StatusBadge from '@components/ui/StatusBadge';

export default function ConsolePage() {
  const qc = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [foundUser, setFoundUser] = useState(null);
  const [creditForm, setCreditForm] = useState({ amount: '', reason: '' });

  const lookupMut = useMutation({
    mutationFn: () => userLookup(searchTerm),
    onSuccess: (data) => { setFoundUser(data?.user || data); toast.success('Usuario encontrado'); },
    onError: (e) => { setFoundUser(null); toast.error(e?.data?.message || 'Usuario nao encontrado'); },
  });

  const { data: purchasesData } = useQuery({
    queryKey: ['assistant', 'purchases', foundUser?._id],
    queryFn: () => getAssistantPurchases(foundUser._id),
    enabled: !!foundUser?._id,
  });

  const { data: rechargesData } = useQuery({
    queryKey: ['assistant', 'recharges', foundUser?._id],
    queryFn: () => getAssistantRecharges(foundUser._id),
    enabled: !!foundUser?._id,
  });

  const refundMut = useMutation({
    mutationFn: refundPurchase,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['assistant', 'purchases'] }); toast.success('Reembolso realizado'); },
    onError: (e) => toast.error(e?.data?.message || 'Erro no reembolso'),
  });

  const creditMut = useMutation({
    mutationFn: () => creditUserAssistant(foundUser._id, { amount: Number(creditForm.amount), reason: creditForm.reason }),
    onSuccess: () => { toast.success('Credito adicionado'); setCreditForm({ amount: '', reason: '' }); },
    onError: (e) => toast.error(e?.data?.message || 'Erro ao creditar'),
  });

  const purchaseColumns = [
    { key: '_id', label: 'ID', render: (v) => <span className="font-mono text-[12px]">{v?.slice(-8)}</span> },
    { key: 'product', label: 'Produto' },
    { key: 'total', label: 'Valor', render: (v) => formatBRL(v) },
    { key: 'status', label: 'Status', render: (v) => <StatusBadge status={v === 'completed' ? 'active' : v === 'refunded' ? 'info' : 'pending'} label={v} /> },
    { key: 'createdAt', label: 'Data', render: (v) => formatDateTime(v) },
    {
      key: '_refund', label: '', render: (_, row) => row.status === 'completed' ? (
        <ActionButton variant="outline" size="sm" onClick={() => { if (confirm('Confirmar reembolso?')) refundMut.mutate(row._id); }}>
          <RotateCcw className="w-3 h-3 mr-1" />Reembolsar
        </ActionButton>
      ) : null,
    },
  ];

  const rechargeColumns = [
    { key: '_id', label: 'ID', render: (v) => <span className="font-mono text-[12px]">{v?.slice(-8)}</span> },
    { key: 'amount', label: 'Valor', render: (v) => formatBRL(v) },
    { key: 'method', label: 'Metodo' },
    { key: 'status', label: 'Status', render: (v) => <StatusBadge status={v === 'confirmed' ? 'active' : 'pending'} label={v} /> },
    { key: 'createdAt', label: 'Data', render: (v) => formatDateTime(v) },
  ];

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-xl font-bold text-[var(--mb-text-primary)]">Console de Suporte</h1>

      <div className="flex gap-3">
        <div className="flex-1">
          <InputField value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Buscar por username, email, ID ou Telegram ID..." onKeyDown={(e) => { if (e.key === 'Enter') lookupMut.mutate(); }} />
        </div>
        <ActionButton variant="accent" loading={lookupMut.isPending} onClick={() => lookupMut.mutate()}>
          <Search className="w-4 h-4 mr-1" />Buscar
        </ActionButton>
      </div>

      {foundUser && (
        <>
          <GlassPanel className="p-5">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-10 h-10 flex items-center justify-center bg-[rgba(53,197,255,0.12)]">
                <User className="w-5 h-5 text-[var(--mb-accent-300)]" />
              </div>
              <div>
                <p className="font-semibold text-[var(--mb-text-primary)]">{foundUser.username}</p>
                <p className="text-[12px] text-[var(--mb-text-muted)]">{foundUser.email || 'Sem email'} · Saldo: {formatBRL(foundUser.balance)}</p>
              </div>
              <StatusBadge status={foundUser.banned ? 'error' : 'active'} label={foundUser.banned ? 'Banido' : 'Ativo'} className="ml-auto" />
            </div>

            <div className="flex gap-3 items-end">
              <div className="flex-1"><InputField label="Valor" type="number" value={creditForm.amount} onChange={(e) => setCreditForm((p) => ({ ...p, amount: e.target.value }))} placeholder="0.00" /></div>
              <div className="flex-1"><InputField label="Motivo" value={creditForm.reason} onChange={(e) => setCreditForm((p) => ({ ...p, reason: e.target.value }))} placeholder="Motivo do credito" /></div>
              <ActionButton variant="accent" loading={creditMut.isPending} disabled={!creditForm.amount || !creditForm.reason} onClick={() => creditMut.mutate()}>
                <Plus className="w-4 h-4 mr-1" />Creditar
              </ActionButton>
            </div>
          </GlassPanel>

          <h2 className="text-[14px] font-semibold text-[var(--mb-text-primary)]">Compras</h2>
          <DataTable columns={purchaseColumns} data={purchasesData?.purchases || []} emptyTitle="Nenhuma compra" />

          <h2 className="text-[14px] font-semibold text-[var(--mb-text-primary)]">Recargas</h2>
          <DataTable columns={rechargeColumns} data={rechargesData?.recharges || []} emptyTitle="Nenhuma recarga" />
        </>
      )}
    </div>
  );
}
