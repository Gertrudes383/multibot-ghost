import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Eye, Save } from 'lucide-react';
import { getBonusVisibility, updateBonusVisibility } from '@services/admin.service';
import { toast } from '@stores/toastStore';
import Surface from '@components/ui/Surface';
import ActionButton from '@components/ui/ActionButton';
import Spinner from '@components/ui/Spinner';

const TOGGLES = [
  { key: 'show_referral_bonus', label: 'Bonus de Indicacao', desc: 'Exibir bonus de indicacao para usuarios' },
  { key: 'show_recharge_bonus', label: 'Bonus de Recarga', desc: 'Exibir bonus de recarga na interface' },
  { key: 'show_daily_bonus', label: 'Bonus Diario', desc: 'Exibir bonus diario de login' },
  { key: 'show_promo_banner', label: 'Banner Promocional', desc: 'Exibir banner de promocoes no bot' },
];

export default function BonusVisibilityPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ show_referral_bonus: true, show_recharge_bonus: true, show_daily_bonus: false, show_promo_banner: true });

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'settings', 'bonus-visibility'],
    queryFn: getBonusVisibility,
  });

  useEffect(() => { if (data) setForm((p) => ({ ...p, ...data })); }, [data]);

  const saveMut = useMutation({
    mutationFn: () => updateBonusVisibility(form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'settings', 'bonus-visibility'] }); toast.success('Visibilidade atualizada'); },
    onError: (e) => toast.error(e?.data?.message || 'Erro ao salvar'),
  });

  const toggle = (key) => setForm((p) => ({ ...p, [key]: !p[key] }));

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Eye className="w-5 h-5 text-[var(--mb-accent-300)]" />
        <h1 className="text-xl font-bold text-[var(--mb-text-primary)]">Visibilidade de Bonus</h1>
      </div>

      <Surface className="p-5 max-w-lg space-y-1">
        {TOGGLES.map(({ key, label, desc }) => (
          <label key={key} className="flex items-center justify-between gap-4 py-3 border-b border-[var(--mb-border-soft)] last:border-0 cursor-pointer">
            <div>
              <p className="text-[13px] font-medium text-[var(--mb-text-primary)]">{label}</p>
              <p className="text-[11px] text-[var(--mb-text-caption)]">{desc}</p>
            </div>
            <input type="checkbox" checked={!!form[key]} onChange={() => toggle(key)} className="w-4 h-4 accent-[var(--mb-accent-300)]" />
          </label>
        ))}
      </Surface>

      <ActionButton variant="accent" loading={saveMut.isPending} onClick={() => saveMut.mutate()}>
        <Save className="w-4 h-4 mr-1" />Salvar
      </ActionButton>
    </div>
  );
}
