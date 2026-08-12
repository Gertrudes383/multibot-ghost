import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, Save } from 'lucide-react';
import { getNotifications, updateNotifications } from '@services/admin.service';
import { toast } from '@stores/toastStore';
import Surface from '@components/ui/Surface';
import ActionButton from '@components/ui/ActionButton';
import Spinner from '@components/ui/Spinner';

const TOGGLES = [
  { key: 'sales', label: 'Notificacoes de Vendas', desc: 'Receba alertas a cada nova venda' },
  { key: 'recharges', label: 'Recargas', desc: 'Alertas de recargas de saldo' },
  { key: 'new_users', label: 'Novos Usuarios', desc: 'Notificar quando um novo usuario se registrar' },
  { key: 'stock_low', label: 'Estoque Baixo', desc: 'Avisar quando o estoque de cards estiver baixo' },
];

export default function NotificationsPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ sales: false, recharges: false, new_users: false, stock_low: false });

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'notifications'],
    queryFn: getNotifications,
  });

  useEffect(() => {
    if (data) setForm((p) => ({ ...p, ...data }));
  }, [data]);

  const saveMut = useMutation({
    mutationFn: () => updateNotifications(form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'notifications'] }); toast.success('Notificacoes atualizadas'); },
    onError: (e) => toast.error(e?.data?.message || 'Erro ao salvar'),
  });

  const toggle = (key) => setForm((p) => ({ ...p, [key]: !p[key] }));

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Bell className="w-5 h-5 text-[var(--mb-accent-300)]" />
        <h1 className="text-xl font-bold text-[var(--mb-text-primary)]">Notificacoes</h1>
      </div>

      <Surface className="p-5 max-w-lg space-y-1">
        {TOGGLES.map(({ key, label, desc }) => (
          <label key={key} className="flex items-center justify-between gap-4 py-3 border-b border-[var(--mb-border-soft)] last:border-0 cursor-pointer">
            <div>
              <p className="text-[13px] font-medium text-[var(--mb-text-primary)]">{label}</p>
              <p className="text-[11px] text-[var(--mb-text-caption)]">{desc}</p>
            </div>
            <input
              type="checkbox"
              checked={!!form[key]}
              onChange={() => toggle(key)}
              className="w-4 h-4 accent-[var(--mb-accent-300)]"
            />
          </label>
        ))}
      </Surface>

      <ActionButton variant="accent" loading={saveMut.isPending} onClick={() => saveMut.mutate()}>
        <Save className="w-4 h-4 mr-1" />Salvar
      </ActionButton>
    </div>
  );
}
