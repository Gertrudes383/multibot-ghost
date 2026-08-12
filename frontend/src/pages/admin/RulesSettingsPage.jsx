import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BookOpen, Save } from 'lucide-react';
import { getRulesSettings, updateRulesSettings } from '@services/admin.service';
import { toast } from '@stores/toastStore';
import Surface from '@components/ui/Surface';
import ActionButton from '@components/ui/ActionButton';
import Spinner from '@components/ui/Spinner';

export default function RulesSettingsPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ rules_text: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'settings', 'rules'],
    queryFn: getRulesSettings,
  });

  useEffect(() => { if (data) setForm((p) => ({ ...p, ...data })); }, [data]);

  const saveMut = useMutation({
    mutationFn: () => updateRulesSettings(form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'settings', 'rules'] }); toast.success('Regras atualizadas'); },
    onError: (e) => toast.error(e?.data?.message || 'Erro ao salvar'),
  });

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <BookOpen className="w-5 h-5 text-[var(--mb-accent-300)]" />
        <h1 className="text-xl font-bold text-[var(--mb-text-primary)]">Regras do Bot</h1>
      </div>

      <Surface className="p-5 max-w-2xl space-y-4">
        <div className="space-y-1.5">
          <label className="block text-[12px] font-medium text-[var(--mb-text-muted)]">Texto das Regras</label>
          <textarea
            value={form.rules_text}
            onChange={(e) => setForm((p) => ({ ...p, rules_text: e.target.value }))}
            rows={10}
            placeholder="Digite as regras que serao exibidas aos usuarios..."
            className="w-full px-3 py-2 text-[13px] text-[var(--mb-text-primary)] bg-[var(--mb-surface-900)] border border-[var(--mb-border-soft)] outline-none focus:border-[var(--mb-accent-300)] resize-y"
          />
        </div>
        <ActionButton variant="accent" loading={saveMut.isPending} onClick={() => saveMut.mutate()}>
          <Save className="w-4 h-4 mr-1" />Salvar
        </ActionButton>
      </Surface>
    </div>
  );
}
