import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { DollarSign } from 'lucide-react';
import { manualRecharge } from '@services/admin.service';
import { toast } from '@stores/toastStore';
import Surface from '@components/ui/Surface';
import InputField from '@components/ui/InputField';
import ActionButton from '@components/ui/ActionButton';

export default function ManualRechargePage() {
  const [form, setForm] = useState({ userId: '', amount: '', note: '' });
  const set = (key) => (e) => setForm((p) => ({ ...p, [key]: e.target.value }));

  const mut = useMutation({
    mutationFn: () => manualRecharge(form),
    onSuccess: () => { toast.success('Recarga manual realizada'); setForm({ userId: '', amount: '', note: '' }); },
    onError: (e) => toast.error(e?.data?.message || 'Erro ao recarregar'),
  });

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <DollarSign className="w-5 h-5 text-[var(--mb-accent-300)]" />
        <h1 className="text-xl font-bold text-[var(--mb-text-primary)]">Recarga Manual</h1>
      </div>

      <Surface className="p-5 max-w-lg space-y-4">
        <InputField label="ID do Usuario" value={form.userId} onChange={set('userId')} placeholder="ID ou username do usuario" />
        <InputField label="Valor (R$)" type="number" value={form.amount} onChange={set('amount')} placeholder="0.00" />
        <InputField label="Observacao" value={form.note} onChange={set('note')} placeholder="Motivo da recarga manual" />
        <ActionButton variant="accent" loading={mut.isPending} onClick={() => mut.mutate()} disabled={!form.userId || !form.amount}>
          Realizar Recarga
        </ActionButton>
      </Surface>
    </div>
  );
}
