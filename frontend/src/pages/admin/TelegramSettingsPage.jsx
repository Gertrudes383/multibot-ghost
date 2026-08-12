import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Settings, Save } from 'lucide-react';
import { getTelegramSettings, updateTelegramSettings } from '@services/admin.service';
import { toast } from '@stores/toastStore';
import GlassPanel from '@components/ui/GlassPanel';
import InputField from '@components/ui/InputField';
import ActionButton from '@components/ui/ActionButton';
import Spinner from '@components/ui/Spinner';

export default function TelegramSettingsPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ welcomeMessage: '', menuLayout: 'default', autoReply: '', notificationsEnabled: true });

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'telegram', 'settings'],
    queryFn: getTelegramSettings,
  });

  useEffect(() => {
    if (data) setForm((prev) => ({ ...prev, ...data }));
  }, [data]);

  const saveMut = useMutation({
    mutationFn: () => updateTelegramSettings(form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'telegram', 'settings'] }); toast.success('Configuracoes salvas'); },
    onError: (e) => toast.error(e?.data?.message || 'Erro ao salvar'),
  });

  const set = (key) => (e) => setForm((p) => ({ ...p, [key]: e.target.value }));

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Settings className="w-5 h-5 text-[var(--mb-accent-300)]" />
        <h1 className="text-xl font-bold text-[var(--mb-text-primary)]">Configuracoes do Telegram</h1>
      </div>

      <GlassPanel className="p-6 space-y-5">
        <InputField label="Mensagem de Boas-vindas" value={form.welcomeMessage} onChange={set('welcomeMessage')} placeholder="Ola! Bem-vindo ao bot..." />

        <div className="space-y-1.5">
          <label className="block text-[12px] font-medium text-[var(--mb-text-muted)]">Layout do Menu</label>
          <select value={form.menuLayout} onChange={set('menuLayout')} className="w-full px-3 py-2 text-[13px] text-[var(--mb-text-primary)] bg-[var(--mb-surface-900)] border border-[var(--mb-border-soft)] outline-none focus:border-[var(--mb-accent-300)]">
            <option value="default">Padrao</option>
            <option value="compact">Compacto</option>
            <option value="expanded">Expandido</option>
          </select>
        </div>

        <InputField label="Resposta Automatica" value={form.autoReply} onChange={set('autoReply')} placeholder="Mensagem automatica quando offline..." />

        <div className="flex items-center gap-3">
          <input type="checkbox" id="notif" checked={form.notificationsEnabled} onChange={(e) => setForm((p) => ({ ...p, notificationsEnabled: e.target.checked }))} className="accent-[var(--mb-accent-300)]" />
          <label htmlFor="notif" className="text-[13px] text-[var(--mb-text-secondary)]">Notificacoes ativas</label>
        </div>

        <ActionButton variant="accent" loading={saveMut.isPending} onClick={() => saveMut.mutate()}>
          <Save className="w-4 h-4 mr-1" />Salvar Configuracoes
        </ActionButton>
      </GlassPanel>
    </div>
  );
}
