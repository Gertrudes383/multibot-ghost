import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { HeadphonesIcon, Save } from 'lucide-react';
import { getSupportContacts, updateSupportContacts } from '@services/admin.service';
import { toast } from '@stores/toastStore';
import Surface from '@components/ui/Surface';
import InputField from '@components/ui/InputField';
import ActionButton from '@components/ui/ActionButton';
import Spinner from '@components/ui/Spinner';

export default function SupportContactsPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ telegram_support: '', whatsapp: '', email: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'settings', 'support'],
    queryFn: getSupportContacts,
  });

  useEffect(() => { if (data) setForm((p) => ({ ...p, ...data })); }, [data]);

  const saveMut = useMutation({
    mutationFn: () => updateSupportContacts(form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'settings', 'support'] }); toast.success('Contatos de suporte atualizados'); },
    onError: (e) => toast.error(e?.data?.message || 'Erro ao salvar'),
  });

  const set = (key) => (e) => setForm((p) => ({ ...p, [key]: e.target.value }));

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <HeadphonesIcon className="w-5 h-5 text-[var(--mb-accent-300)]" />
        <h1 className="text-xl font-bold text-[var(--mb-text-primary)]">Contatos de Suporte</h1>
      </div>

      <Surface className="p-5 max-w-lg space-y-4">
        <InputField label="Suporte Telegram" value={form.telegram_support} onChange={set('telegram_support')} placeholder="@suporte" />
        <InputField label="WhatsApp" value={form.whatsapp} onChange={set('whatsapp')} placeholder="+55 11 99999-9999" />
        <InputField label="Email" type="email" value={form.email} onChange={set('email')} placeholder="suporte@exemplo.com" />
        <ActionButton variant="accent" loading={saveMut.isPending} onClick={() => saveMut.mutate()}>
          <Save className="w-4 h-4 mr-1" />Salvar
        </ActionButton>
      </Surface>
    </div>
  );
}
