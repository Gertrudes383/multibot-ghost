import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plug, Save } from 'lucide-react';
import { getGateways, updateGateways } from '@services/admin.service';
import { toast } from '@stores/toastStore';
import Surface from '@components/ui/Surface';
import InputField from '@components/ui/InputField';
import ActionButton from '@components/ui/ActionButton';
import Spinner from '@components/ui/Spinner';

export default function GatewaysPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ pix_enabled: false, pix_key: '', crypto_enabled: false, crypto_key: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'gateways'],
    queryFn: getGateways,
  });

  useEffect(() => { if (data) setForm((p) => ({ ...p, ...data })); }, [data]);

  const saveMut = useMutation({
    mutationFn: () => updateGateways(form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'gateways'] }); toast.success('Gateways atualizados'); },
    onError: (e) => toast.error(e?.data?.message || 'Erro ao salvar'),
  });

  const toggle = (key) => setForm((p) => ({ ...p, [key]: !p[key] }));
  const set = (key) => (e) => setForm((p) => ({ ...p, [key]: e.target.value }));

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Plug className="w-5 h-5 text-[var(--mb-accent-300)]" />
        <h1 className="text-xl font-bold text-[var(--mb-text-primary)]">Gateways de Pagamento</h1>
      </div>

      <Surface className="p-5 max-w-lg space-y-5">
        <div className="space-y-3">
          <label className="flex items-center justify-between cursor-pointer">
            <p className="text-[13px] font-medium text-[var(--mb-text-primary)]">Pix Ativo</p>
            <input type="checkbox" checked={!!form.pix_enabled} onChange={() => toggle('pix_enabled')} className="w-4 h-4 accent-[var(--mb-accent-300)]" />
          </label>
          <InputField label="Chave / API Pix" value={form.pix_key} onChange={set('pix_key')} placeholder="Chave de integracao Pix" disabled={!form.pix_enabled} />
        </div>

        <div className="space-y-3 pt-3 border-t border-[var(--mb-border-soft)]">
          <label className="flex items-center justify-between cursor-pointer">
            <p className="text-[13px] font-medium text-[var(--mb-text-primary)]">Crypto Ativo</p>
            <input type="checkbox" checked={!!form.crypto_enabled} onChange={() => toggle('crypto_enabled')} className="w-4 h-4 accent-[var(--mb-accent-300)]" />
          </label>
          <InputField label="Chave / API Crypto" value={form.crypto_key} onChange={set('crypto_key')} placeholder="Chave de integracao Crypto" disabled={!form.crypto_enabled} />
        </div>

        <ActionButton variant="accent" loading={saveMut.isPending} onClick={() => saveMut.mutate()}>
          <Save className="w-4 h-4 mr-1" />Salvar
        </ActionButton>
      </Surface>
    </div>
  );
}
