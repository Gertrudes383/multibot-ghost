import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UserPlus, Save } from 'lucide-react';
import { getRegistrationSettings, updateRegistrationSettings } from '@services/admin.service';
import { toast } from '@stores/toastStore';
import Surface from '@components/ui/Surface';
import InputField from '@components/ui/InputField';
import ActionButton from '@components/ui/ActionButton';
import Spinner from '@components/ui/Spinner';

export default function RegistrationSettingsPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ require_subscription: false, referral_enabled: false, required_channel: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'registration', 'settings'],
    queryFn: getRegistrationSettings,
  });

  useEffect(() => {
    if (data) setForm((p) => ({ ...p, ...data }));
  }, [data]);

  const saveMut = useMutation({
    mutationFn: () => updateRegistrationSettings(form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'registration', 'settings'] }); toast.success('Configuracoes salvas'); },
    onError: (e) => toast.error(e?.data?.message || 'Erro ao salvar'),
  });

  const toggle = (key) => setForm((p) => ({ ...p, [key]: !p[key] }));
  const set = (key) => (e) => setForm((p) => ({ ...p, [key]: e.target.value }));

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <UserPlus className="w-5 h-5 text-[var(--mb-accent-300)]" />
        <h1 className="text-xl font-bold text-[var(--mb-text-primary)]">Configuracoes de Registro</h1>
      </div>

      <Surface className="p-5 max-w-lg space-y-5">
        <label className="flex items-center justify-between cursor-pointer">
          <div>
            <p className="text-[13px] font-medium text-[var(--mb-text-primary)]">Exigir Inscricao no Canal</p>
            <p className="text-[11px] text-[var(--mb-text-caption)]">Usuarios devem entrar no canal antes de usar o bot</p>
          </div>
          <input type="checkbox" checked={!!form.require_subscription} onChange={() => toggle('require_subscription')} className="w-4 h-4 accent-[var(--mb-accent-300)]" />
        </label>

        <InputField
          label="Canal Obrigatorio"
          value={form.required_channel}
          onChange={set('required_channel')}
          placeholder="@nome_do_canal"
          disabled={!form.require_subscription}
        />

        <label className="flex items-center justify-between cursor-pointer">
          <div>
            <p className="text-[13px] font-medium text-[var(--mb-text-primary)]">Sistema de Referral</p>
            <p className="text-[11px] text-[var(--mb-text-caption)]">Permitir que usuarios indiquem outros</p>
          </div>
          <input type="checkbox" checked={!!form.referral_enabled} onChange={() => toggle('referral_enabled')} className="w-4 h-4 accent-[var(--mb-accent-300)]" />
        </label>

        <ActionButton variant="accent" loading={saveMut.isPending} onClick={() => saveMut.mutate()}>
          <Save className="w-4 h-4 mr-1" />Salvar
        </ActionButton>
      </Surface>
    </div>
  );
}
