import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Gift } from 'lucide-react';
import { redeemGiftCard, giftCardHistory } from '@services/giftcard.service';
import { toast } from '@stores/toastStore';
import GlassPanel from '@components/ui/GlassPanel';
import InputField from '@components/ui/InputField';
import ActionButton from '@components/ui/ActionButton';
import DataTable from '@components/ui/DataTable';
import Pagination from '@components/ui/Pagination';
import { formatBRL, formatDateTime } from '@utils/format';

const COLUMNS = [
  { key: 'code', label: 'Codigo', render: (v) => <span className="font-mono">{v}</span> },
  { key: 'amount', label: 'Valor', render: (v) => <span className="font-semibold">{formatBRL(v)}</span> },
  { key: 'redeemedAt', label: 'Resgatado em', render: (v) => formatDateTime(v) },
];

export default function GiftCardPage() {
  const queryClient = useQueryClient();
  const [code, setCode] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['giftcard-history', page],
    queryFn: () => giftCardHistory({ page, limit: 20 }),
  });

  const redeemMutation = useMutation({
    mutationFn: () => redeemGiftCard(code),
    onSuccess: (res) => {
      toast.success(`Gift card resgatado! ${formatBRL(res?.amount || 0)} creditados.`);
      setCode('');
      queryClient.invalidateQueries({ queryKey: ['giftcard-history'] });
    },
    onError: (err) => toast.error(err?.data?.message || 'Codigo invalido ou ja utilizado'),
  });

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-[var(--mb-text-primary)]">Gift Cards</h1>

      <GlassPanel className="p-6 max-w-md">
        <div className="flex items-center gap-3 mb-4">
          <Gift className="w-6 h-6 text-[var(--mb-accent-300)]" />
          <h2 className="text-[14px] font-semibold text-[var(--mb-text-primary)]">Resgatar Codigo</h2>
        </div>
        <div className="space-y-4">
          <InputField
            label="Codigo do Gift Card"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Ex: GIFT-XXXX-XXXX"
          />
          <ActionButton
            variant="accent"
            className="w-full"
            onClick={() => redeemMutation.mutate()}
            loading={redeemMutation.isPending}
            disabled={!code.trim()}
          >
            Resgatar
          </ActionButton>
        </div>
      </GlassPanel>

      <div>
        <h2 className="text-[14px] font-semibold text-[var(--mb-text-primary)] mb-3">Historico de Resgates</h2>
        <DataTable
          columns={COLUMNS}
          data={data?.giftcards || data?.data || []}
          isLoading={isLoading}
          emptyTitle="Nenhum resgate encontrado"
        />
        <Pagination page={page} totalPages={data?.totalPages || 1} onPageChange={setPage} />
      </div>
    </div>
  );
}
