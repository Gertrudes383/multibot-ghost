import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import { getSettings, updateSettings } from '@services/admin.service';
import { toast } from '@stores/toastStore';
import Surface from '@components/ui/Surface';
import InputField from '@components/ui/InputField';
import ActionButton from '@components/ui/ActionButton';
import Spinner from '@components/ui/Spinner';

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ siteName: '', maintenance: false, registrationOpen: true });

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: getSettings,
  });

  useEffect(() => {
    if (data) setForm({ siteName: data.siteName || '', maintenance: !!data.maintenance, registrationOpen: data.registrationOpen !== false });
  }, [data]);

  const saveMut = useMutation({
    mutationFn: updateSettings,
    onSuccess: () => { toast.success('Configuracoes salvas'); queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] }); },
    onError: (e) => toast.error(e?.data?.message || 'Erro'),
  });

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div className="space-y-5 p-6">
      <h1 className="text-xl font-bold text-[var(--mb-text-primary)]">Configuracoes Gerais</h1>

      <Surface className="p-5 max-w-lg space-y-4">
        <InputField label="Nome do Site" value={form.siteName} onChange={(e) => setForm((f) => ({ ...f, siteName: e.target.value }))} />

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={form.maintenance}
            onChange={(e) => setForm((f) => ({ ...f, maintenance: e.target.checked }))}
            className="w-4 h-4 accent-[var(--mb-accent-300)]"
          />
          <span className="text-[13px] text-[var(--mb-text-secondary)]">Modo Manutencao</span>
        </label>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={form.registrationOpen}
            onChange={(e) => setForm((f) => ({ ...f, registrationOpen: e.target.checked }))}
            className="w-4 h-4 accent-[var(--mb-accent-300)]"
          />
          <span className="text-[13px] text-[var(--mb-text-secondary)]">Registro Aberto</span>
        </label>

        <ActionButton variant="accent" loading={saveMut.isPending} onClick={() => saveMut.mutate(form)}>
          <Save className="w-3.5 h-3.5" /> Salvar
        </ActionButton>
      </Surface>
    </div>
  );
}
