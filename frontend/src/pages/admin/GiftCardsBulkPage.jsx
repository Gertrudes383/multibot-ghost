import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Gift, Upload } from 'lucide-react';
import { bulkGenerateGiftCards } from '@services/admin.service';
import { toast } from '@stores/toastStore';
import Surface from '@components/ui/Surface';
import InputField from '@components/ui/InputField';
import ActionButton from '@components/ui/ActionButton';

export default function GiftCardsBulkPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ quantity: 10, amount: '', prefix: '', expires_days: 30 });
  const set = (key) => (e) => setForm((p) => ({ ...p, [key]: e.target.value }));

  const mut = useMutation({
    mutationFn: () => bulkGenerateGiftCards(form),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['admin', 'telegram', 'giftcards'] });
      toast.success(`${res?.count || form.quantity} gift cards gerados com sucesso`);
      setForm({ quantity: 10, amount: '', prefix: '', expires_days: 30 });
    },
    onError: (e) => toast.error(e?.data?.message || 'Erro ao gerar gift cards'),
  });

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Gift className="w-5 h-5 text-[var(--mb-accent-300)]" />
        <h1 className="text-xl font-bold text-[var(--mb-text-primary)]">Geracao em Massa de Gift Cards</h1>
      </div>

      <Surface className="p-5 max-w-lg space-y-4">
        <InputField label="Quantidade" type="number" value={form.quantity} onChange={set('quantity')} placeholder="10" min={1} max={1000} />
        <InputField label="Valor (R$)" type="number" value={form.amount} onChange={set('amount')} placeholder="50.00" />
        <InputField label="Prefixo (opcional)" value={form.prefix} onChange={set('prefix')} placeholder="PROMO" />
        <InputField label="Validade (dias)" type="number" value={form.expires_days} onChange={set('expires_days')} placeholder="30" />

        <ActionButton
          variant="accent"
          loading={mut.isPending}
          onClick={() => mut.mutate()}
          disabled={!form.amount || !form.quantity}
          className="w-full"
        >
          <Upload className="w-4 h-4 mr-1" />Gerar {form.quantity} Gift Cards
        </ActionButton>
      </Surface>
    </div>
  );
}
