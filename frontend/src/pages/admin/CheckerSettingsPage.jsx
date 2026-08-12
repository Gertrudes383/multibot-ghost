import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import { getCheckerStatus, updateCheckerSettings } from '@services/admin.service';
import { toast } from '@stores/toastStore';
import Surface from '@components/ui/Surface';
import InputField from '@components/ui/InputField';
import ActionButton from '@components/ui/ActionButton';
import Spinner from '@components/ui/Spinner';

export default function CheckerSettingsPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ gateway: '', timeout: '', retries: '', concurrency: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'checker'],
    queryFn: getCheckerStatus,
  });

  useEffect(() => {
    if (data?.settings) {
      const s = data.settings;
      setForm({ gateway: s.gateway || '', timeout: String(s.timeout || ''), retries: String(s.retries || ''), concurrency: String(s.concurrency || '') });
    }
  }, [data]);

  const saveMut = useMutation({
    mutationFn: updateCheckerSettings,
    onSuccess: () => { toast.success('Configuracoes salvas'); queryClient.invalidateQueries({ queryKey: ['admin', 'checker'] }); },
    onError: (e) => toast.error(e?.data?.message || 'Erro ao salvar'),
  });

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  function updateField(field, value) { setForm((f) => ({ ...f, [field]: value })); }

  return (
    <div className="space-y-5 p-6">
      <h1 className="text-xl font-bold text-[var(--mb-text-primary)]">Configuracoes do Checker</h1>

      <Surface className="p-5 max-w-lg space-y-4">
        <InputField label="Gateway" value={form.gateway} onChange={(e) => updateField('gateway', e.target.value)} />
        <InputField label="Timeout (ms)" type="number" value={form.timeout} onChange={(e) => updateField('timeout', e.target.value)} />
        <InputField label="Retentativas" type="number" value={form.retries} onChange={(e) => updateField('retries', e.target.value)} />
        <InputField label="Concorrencia" type="number" value={form.concurrency} onChange={(e) => updateField('concurrency', e.target.value)} />
        <ActionButton
          variant="accent"
          loading={saveMut.isPending}
          onClick={() => saveMut.mutate({ gateway: form.gateway, timeout: Number(form.timeout), retries: Number(form.retries), concurrency: Number(form.concurrency) })}
        >
          <Save className="w-3.5 h-3.5" /> Salvar
        </ActionButton>
      </Surface>
    </div>
  );
}
