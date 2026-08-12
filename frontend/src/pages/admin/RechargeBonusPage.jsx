import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Gift, Save } from 'lucide-react';
import { getRechargeBonusSettings, updateRechargeBonusSettings } from '@services/admin.service';
import { toast } from '@stores/toastStore';
import Surface from '@components/ui/Surface';
import InputField from '@components/ui/InputField';
import ActionButton from '@components/ui/ActionButton';
import Spinner from '@components/ui/Spinner';

export default function RechargeBonusPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ enabled: false, bonus_pct: 0, min_amount: 0 });

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'recharge-bonus'],
    queryFn: getRechargeBonusSettings,
  });

  useEffect(() => { if (data) setForm((p) => ({ ...p, ...data })); }, [data]);

  const saveMut = useMutation({
    mutationFn: () => updateRechargeBonusSettings(form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'recharge-bonus'] }); toast.success('Bonus de recarga atualizado'); },
    onError: (e) => toast.error(e?.data?.message || 'Erro ao salvar'),
  });

  const toggle = (key) => setForm((p) => ({ ...p, [key]: !p[key] }));
  const set = (key) => (e) => setForm((p) => ({ ...p, [key]: e.target.value }));

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Gift className="w-5 h-5 text-[var(--mb-accent-300)]" />
        <h1 className="text-xl font-bold text-[var(--mb-text-primary)]">Bonus de Recarga</h1>
      </div>

      <Surface className="p-5 max-w-lg space-y-4">
        <label className="flex items-center justify-between cursor-pointer">
          <div>
            <p className="text-[13px] font-medium text-[var(--mb-text-primary)]">Bonus Ativo</p>
            <p className="text-[11px] text-[var(--mb-text-caption)]">Conceder bonus ao recarregar saldo</p>
          </div>
          <input type="checkbox" checked={!!form.enabled} onChange={() => toggle('enabled')} className="w-4 h-4 accent-[var(--mb-accent-300)]" />
        </label>

        <InputField label="Percentual de Bonus (%)" type="number" value={form.bonus_pct} onChange={set('bonus_pct')} placeholder="10" disabled={!form.enabled} />
        <InputField label="Valor Minimo para Bonus (R$)" type="number" value={form.min_amount} onChange={set('min_amount')} placeholder="50.00" disabled={!form.enabled} />

        <ActionButton variant="accent" loading={saveMut.isPending} onClick={() => saveMut.mutate()}>
          <Save className="w-4 h-4 mr-1" />Salvar
        </ActionButton>
      </Surface>
    </div>
  );
}
