import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import { getReferralSettings, updateReferralSettings, getReferrals } from '@services/admin.service';
import { toast } from '@stores/toastStore';
import Surface from '@components/ui/Surface';
import InputField from '@components/ui/InputField';
import ActionButton from '@components/ui/ActionButton';
import DataTable from '@components/ui/DataTable';
import Pagination from '@components/ui/Pagination';
import Spinner from '@components/ui/Spinner';
import { formatBRL, formatNumber } from '@utils/format';

export default function ReferralPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [form, setForm] = useState({ commission: '', minWithdrawal: '' });

  const { data: settings, isLoading: loadingSettings } = useQuery({
    queryKey: ['admin', 'referrals', 'settings'],
    queryFn: getReferralSettings,
  });

  const { data: referrals, isLoading: loadingReferrals } = useQuery({
    queryKey: ['admin', 'referrals', page],
    queryFn: () => getReferrals({ page }),
  });

  useEffect(() => {
    if (settings) setForm({ commission: String(settings.commission || ''), minWithdrawal: String(settings.minWithdrawal || '') });
  }, [settings]);

  const saveMut = useMutation({
    mutationFn: updateReferralSettings,
    onSuccess: () => { toast.success('Configuracoes salvas'); queryClient.invalidateQueries({ queryKey: ['admin', 'referrals'] }); },
    onError: (e) => toast.error(e?.data?.message || 'Erro'),
  });

  if (loadingSettings) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  const columns = [
    { key: 'username', label: 'Usuario' },
    { key: 'referrals', label: 'Indicados', render: (v) => formatNumber(v) },
    { key: 'earnings', label: 'Ganhos', render: (v) => formatBRL(v) },
  ];

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-xl font-bold text-[var(--mb-text-primary)]">Programa de Indicacao</h1>

      <Surface className="p-5 max-w-lg space-y-4">
        <h3 className="text-[14px] font-semibold text-[var(--mb-accent-300)]">Configuracoes</h3>
        <InputField label="Comissao (%)" type="number" value={form.commission} onChange={(e) => setForm((f) => ({ ...f, commission: e.target.value }))} />
        <InputField label="Saque Minimo (R$)" type="number" value={form.minWithdrawal} onChange={(e) => setForm((f) => ({ ...f, minWithdrawal: e.target.value }))} />
        <ActionButton variant="accent" loading={saveMut.isPending} onClick={() => saveMut.mutate({ commission: Number(form.commission), minWithdrawal: Number(form.minWithdrawal) })}>
          <Save className="w-3.5 h-3.5" /> Salvar
        </ActionButton>
      </Surface>

      <div>
        <h3 className="text-[13px] font-semibold text-[var(--mb-text-muted)] mb-3">Indicacoes</h3>
        <DataTable columns={columns} data={referrals?.data || []} isLoading={loadingReferrals} emptyTitle="Nenhuma indicacao" />
        <Pagination page={page} totalPages={referrals?.totalPages || 1} onPageChange={setPage} />
      </div>
    </div>
  );
}
