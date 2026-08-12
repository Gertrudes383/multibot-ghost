import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Wallet, Plus } from 'lucide-react';
import { useAuthStore } from '@stores/authStore';
import { rechargeHistory } from '@services/recharge.service';
import { purchaseHistory } from '@services/purchases.service';
import GlassPanel from '@components/ui/GlassPanel';
import ActionButton from '@components/ui/ActionButton';
import DataTable from '@components/ui/DataTable';
import Pagination from '@components/ui/Pagination';
import { formatBRL, formatDateTime } from '@utils/format';

const COLUMNS = [
  { key: 'type', label: 'Tipo', render: (v) => (
    <span className={v === 'recharge' ? 'text-[var(--mb-success)]' : 'text-[var(--mb-error)]'}>
      {v === 'recharge' ? '+ Recarga' : '- Compra'}
    </span>
  )},
  { key: 'createdAt', label: 'Data', render: (v) => formatDateTime(v) },
  { key: 'amount', label: 'Valor', render: (v, row) => (
    <span className={`font-semibold ${row.type === 'recharge' ? 'text-[var(--mb-success)]' : 'text-[var(--mb-text-primary)]'}`}>
      {formatBRL(v)}
    </span>
  )},
  { key: 'status', label: 'Status' },
];

export default function WalletPage() {
  const user = useAuthStore((s) => s.session?.user);
  const [page, setPage] = useState(1);

  const { data: recharges } = useQuery({
    queryKey: ['wallet-recharges', page],
    queryFn: () => rechargeHistory({ page, limit: 10 }),
  });

  const { data: purchases } = useQuery({
    queryKey: ['wallet-purchases', page],
    queryFn: () => purchaseHistory({ page, limit: 10 }),
  });

  const transactions = [
    ...((recharges?.recharges || recharges?.data || []).map((r) => ({ ...r, type: 'recharge', amount: r.amount }))),
    ...((purchases?.purchases || purchases?.data || []).map((p) => ({ ...p, type: 'purchase', amount: p.total }))),
  ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-[var(--mb-text-primary)]">Carteira</h1>

      <GlassPanel className="p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-[rgba(53,197,255,0.08)]">
            <Wallet className="w-8 h-8 text-[var(--mb-accent-300)]" />
          </div>
          <div>
            <p className="text-[12px] text-[var(--mb-text-muted)]">Saldo Disponivel</p>
            <p className="text-2xl font-bold text-[var(--mb-text-primary)]">{formatBRL(user?.balance)}</p>
          </div>
        </div>
        <Link to="/user/recharge">
          <ActionButton variant="accent">
            <Plus className="w-4 h-4 mr-2" /> Adicionar Fundos
          </ActionButton>
        </Link>
      </GlassPanel>

      <div>
        <h2 className="text-[14px] font-semibold text-[var(--mb-text-primary)] mb-3">Transacoes</h2>
        <DataTable
          columns={COLUMNS}
          data={transactions}
          emptyTitle="Nenhuma transacao"
          emptyDescription="Suas transacoes aparecerão aqui."
        />
        <Pagination page={page} totalPages={Math.max(recharges?.totalPages || 1, purchases?.totalPages || 1)} onPageChange={setPage} />
      </div>
    </div>
  );
}
