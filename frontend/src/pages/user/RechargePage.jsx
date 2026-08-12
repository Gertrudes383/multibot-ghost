import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { QrCode, Copy } from 'lucide-react';
import { pixCreate, rechargeHistory } from '@services/recharge.service';
import { usePixStatus } from '@hooks/usePixStatus';
import { toast } from '@stores/toastStore';
import GlassPanel from '@components/ui/GlassPanel';
import InputField from '@components/ui/InputField';
import ActionButton from '@components/ui/ActionButton';
import DataTable from '@components/ui/DataTable';
import Pagination from '@components/ui/Pagination';
import StatusBadge from '@components/ui/StatusBadge';
import { formatBRL, formatDateTime } from '@utils/format';

const STATUS_MAP = {
  approved: { status: 'active', label: 'Aprovada' },
  pending: { status: 'pending', label: 'Pendente' },
  expired: { status: 'inactive', label: 'Expirada' },
  rejected: { status: 'error', label: 'Rejeitada' },
};

const COLUMNS = [
  { key: '_id', label: 'ID', render: (v) => <span className="font-mono text-[12px]">{v?.slice(-8) || '-'}</span> },
  { key: 'createdAt', label: 'Data', render: (v) => formatDateTime(v) },
  { key: 'amount', label: 'Valor', render: (v) => <span className="font-semibold">{formatBRL(v)}</span> },
  { key: 'method', label: 'Metodo' },
  {
    key: 'status',
    label: 'Status',
    render: (v) => {
      const s = STATUS_MAP[v] || { status: 'info', label: v };
      return <StatusBadge status={s.status} label={s.label} />;
    },
  },
];

export default function RechargePage() {
  const [amount, setAmount] = useState('');
  const [page, setPage] = useState(1);
  const [pixData, setPixData] = useState(null);

  usePixStatus(pixData?.rechargeId);

  const { data: history, isLoading } = useQuery({
    queryKey: ['recharge-history', page],
    queryFn: () => rechargeHistory({ page, limit: 20 }),
  });

  const pixMutation = useMutation({
    mutationFn: () => pixCreate({ amount: parseFloat(amount) }),
    onSuccess: (data) => {
      setPixData(data);
      toast.success('PIX gerado com sucesso!');
    },
    onError: (err) => toast.error(err?.data?.message || 'Erro ao gerar PIX'),
  });

  const handleCopy = async () => {
    if (pixData?.copyPaste) {
      await navigator.clipboard.writeText(pixData.copyPaste);
      toast.success('Codigo copiado!');
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-[var(--mb-text-primary)]">Recarga via PIX</h1>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <GlassPanel className="p-6">
          <h2 className="text-[14px] font-semibold text-[var(--mb-text-primary)] mb-4">Gerar PIX</h2>
          <div className="space-y-4">
            <InputField
              label="Valor (R$)"
              type="number"
              min="1"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Ex: 50.00"
            />
            <ActionButton
              variant="accent"
              className="w-full"
              onClick={() => pixMutation.mutate()}
              loading={pixMutation.isPending}
              disabled={!amount || parseFloat(amount) <= 0}
            >
              <QrCode className="w-4 h-4 mr-2" /> Gerar PIX
            </ActionButton>
          </div>
        </GlassPanel>

        {pixData && (
          <GlassPanel className="p-6">
            <h2 className="text-[14px] font-semibold text-[var(--mb-text-primary)] mb-4">QR Code PIX</h2>
            <div className="flex flex-col items-center gap-4">
              {pixData.qrCodeBase64 && (
                <img
                  src={`data:image/png;base64,${pixData.qrCodeBase64}`}
                  alt="QR Code PIX"
                  className="w-48 h-48 border border-[var(--mb-border-soft)]"
                />
              )}
              {pixData.copyPaste && (
                <div className="w-full">
                  <p className="text-[11px] text-[var(--mb-text-caption)] mb-1">Copia e Cola:</p>
                  <div className="flex gap-2">
                    <input
                      readOnly
                      value={pixData.copyPaste}
                      className="flex-1 px-3 py-2 text-[12px] font-mono bg-[var(--mb-surface-900)] border border-[var(--mb-border-soft)] text-[var(--mb-text-secondary)] truncate"
                    />
                    <ActionButton variant="outline" size="sm" onClick={handleCopy}>
                      <Copy className="w-3.5 h-3.5" />
                    </ActionButton>
                  </div>
                </div>
              )}
              <p className="text-[12px] text-[var(--mb-text-caption)]">
                Valor: <span className="font-semibold text-[var(--mb-accent-300)]">{formatBRL(pixData.amount || amount)}</span>
              </p>
            </div>
          </GlassPanel>
        )}
      </div>

      <div>
        <h2 className="text-[14px] font-semibold text-[var(--mb-text-primary)] mb-3">Historico de Recargas</h2>
        <DataTable
          columns={COLUMNS}
          data={history?.recharges || history?.data || []}
          isLoading={isLoading}
          emptyTitle="Nenhuma recarga encontrada"
        />
        <Pagination page={page} totalPages={history?.totalPages || 1} onPageChange={setPage} />
      </div>
    </div>
  );
}
