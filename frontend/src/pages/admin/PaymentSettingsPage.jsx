import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import { getPaymentSettings, updatePaymentSettings } from '@services/admin.service';
import { toast } from '@stores/toastStore';
import Surface from '@components/ui/Surface';
import InputField from '@components/ui/InputField';
import ActionButton from '@components/ui/ActionButton';
import Spinner from '@components/ui/Spinner';

export default function PaymentSettingsPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    primepixKey: '', primepixSecret: '',
    easypixToken: '', easypixWebhookUrl: '',
    nowpaymentsKey: '', nowpaymentsIpnSecret: '', nowpaymentsCallbackUrl: '',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'payments'],
    queryFn: getPaymentSettings,
  });

  useEffect(() => {
    if (data) {
      setForm({
        primepixKey: data.primepixKey || '',
        primepixSecret: data.primepixSecret || '',
        easypixToken: data.easypixToken || '',
        easypixWebhookUrl: data.easypixWebhookUrl || '',
        nowpaymentsKey: data.nowpaymentsKey || '',
        nowpaymentsIpnSecret: data.nowpaymentsIpnSecret || '',
        nowpaymentsCallbackUrl: data.nowpaymentsCallbackUrl || '',
      });
    }
  }, [data]);

  const saveMut = useMutation({
    mutationFn: updatePaymentSettings,
    onSuccess: () => { toast.success('Configuracoes de pagamento salvas'); queryClient.invalidateQueries({ queryKey: ['admin', 'payments'] }); },
    onError: (e) => toast.error(e?.data?.message || 'Erro ao salvar'),
  });

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  function u(field, value) { setForm((f) => ({ ...f, [field]: value })); }

  return (
    <div className="space-y-5 p-6">
      <h1 className="text-xl font-bold text-[var(--mb-text-primary)]">Configuracoes de Pagamento</h1>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Surface className="p-5 space-y-4">
          <h3 className="text-[14px] font-semibold text-[var(--mb-accent-300)]">PrimePIX</h3>
          <InputField label="API Key" value={form.primepixKey} onChange={(e) => u('primepixKey', e.target.value)} />
          <InputField label="Secret" type="password" value={form.primepixSecret} onChange={(e) => u('primepixSecret', e.target.value)} />
        </Surface>

        <Surface className="p-5 space-y-4">
          <h3 className="text-[14px] font-semibold text-[var(--mb-accent-300)]">EasyPIX</h3>
          <InputField label="Bearer Token" type="password" value={form.easypixToken} onChange={(e) => u('easypixToken', e.target.value)} />
          <InputField label="Webhook URL" value={form.easypixWebhookUrl} onChange={(e) => u('easypixWebhookUrl', e.target.value)} />
        </Surface>

        <Surface className="p-5 space-y-4 lg:col-span-2">
          <h3 className="text-[14px] font-semibold text-[var(--mb-accent-300)]">NOWPayments (Crypto)</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <InputField label="API Key" type="password" value={form.nowpaymentsKey} onChange={(e) => u('nowpaymentsKey', e.target.value)} />
            <InputField label="IPN Secret" type="password" value={form.nowpaymentsIpnSecret} onChange={(e) => u('nowpaymentsIpnSecret', e.target.value)} />
          </div>
          <InputField label="Callback URL" value={form.nowpaymentsCallbackUrl} onChange={(e) => u('nowpaymentsCallbackUrl', e.target.value)} />
        </Surface>
      </div>

      <ActionButton variant="accent" loading={saveMut.isPending} onClick={() => saveMut.mutate(form)}>
        <Save className="w-3.5 h-3.5" /> Salvar Configuracoes
      </ActionButton>
    </div>
  );
}
