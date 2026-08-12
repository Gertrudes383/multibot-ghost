import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Zap, Save, ArrowUpRight, Percent, CheckCircle,
  Eye, MessageSquare, DollarSign, Users, TrendingUp,
} from 'lucide-react';
import { getRechargeBonusSettings, updateRechargeBonusSettings, getBots } from '@services/admin.service';
import { formatBRL, formatNumber } from '@utils/format';
import { toast } from '@stores/toastStore';
import Surface from '@components/ui/Surface';
import ActionButton from '@components/ui/ActionButton';
import StatusBadge from '@components/ui/StatusBadge';
import Spinner from '@components/ui/Spinner';

function KpiGroup({ icon: Icon, title, items, accent = 'var(--mb-accent-300)' }) {
  return (
    <Surface className="p-4 flex-1 min-w-[200px]">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4" style={{ color: accent }} />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--mb-text-caption)]">{title}</span>
        <ArrowUpRight className="w-3 h-3 text-[var(--mb-text-caption)] ml-auto" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        {items.map((item, i) => (
          <div key={i}>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--mb-text-caption)]">{item.label}</span>
            <p className="text-lg font-bold" style={{ color: item.color || accent }}>{item.value}</p>
            {item.subtitle && <p className="text-[10px] text-[var(--mb-text-caption)]">{item.subtitle}</p>}
          </div>
        ))}
      </div>
    </Surface>
  );
}

function ToggleSwitch({ checked, onChange, label, description }) {
  return (
    <label className="flex items-center justify-between cursor-pointer py-3">
      <div className="flex items-center gap-3">
        <CheckCircle className={`w-4 h-4 ${checked ? 'text-[var(--mb-success)]' : 'text-[var(--mb-text-caption)]'}`} />
        <div>
          <p className="text-[13px] font-medium text-[var(--mb-text-primary)]">{label}</p>
          {description && <p className="text-[11px] text-[var(--mb-text-caption)]">{description}</p>}
        </div>
      </div>
      <div
        onClick={(e) => { e.preventDefault(); onChange(!checked); }}
        className={`w-10 h-5 flex items-center px-0.5 cursor-pointer transition-colors ${
          checked ? 'bg-[var(--mb-success)]' : 'bg-[var(--mb-surface-900)] border border-[var(--mb-border-soft)]'
        }`}
      >
        <div className={`w-4 h-4 bg-white transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
      </div>
    </label>
  );
}

export default function RechargeBonusPage() {
  const qc = useQueryClient();
  const [botId, setBotId] = useState('');
  const [form, setForm] = useState({
    enabled: false,
    bonus_type: 'percentual',
    bonus_pct: '10',
    min_amount: '',
    show_to_clients: false,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'recharge-bonus', botId],
    queryFn: () => getRechargeBonusSettings(botId ? { botId } : undefined),
  });

  const { data: botsData } = useQuery({ queryKey: ['admin', 'bots'], queryFn: getBots });
  const bots = Array.isArray(botsData?.bots) ? botsData.bots : Array.isArray(botsData) ? botsData : [];

  useEffect(() => {
    if (data) {
      setForm((prev) => ({
        ...prev,
        enabled: data.enabled ?? false,
        bonus_type: data.bonus_type || data.type || 'percentual',
        bonus_pct: String(data.bonus_pct ?? data.percentage ?? '10'),
        min_amount: String(data.min_amount ?? data.minAmount ?? ''),
        show_to_clients: data.show_to_clients ?? data.showToClients ?? false,
      }));
    }
  }, [data]);

  const saveMut = useMutation({
    mutationFn: () => updateRechargeBonusSettings({
      ...form,
      bonus_pct: Number(form.bonus_pct) || 0,
      min_amount: Number(form.min_amount) || 0,
      botId: botId || undefined,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'recharge-bonus'] }); toast.success('Bônus de recarga atualizado'); },
    onError: (e) => toast.error(e?.data?.message || 'Erro ao salvar'),
  });

  function u(field, value) { setForm((f) => ({ ...f, [field]: value })); }

  const selectedBot = bots.find((b) => b._id === botId);
  const botName = selectedBot ? (selectedBot.name || selectedBot.bot_name) : 'Todos';
  const bonusValue = form.bonus_type === 'percentual'
    ? `${form.bonus_pct || 0}%`
    : formatBRL(Number(form.bonus_pct) || 0);
  const estimatedBonus = form.bonus_type === 'percentual'
    ? formatBRL((100 * (Number(form.bonus_pct) || 0)) / 100)
    : formatBRL(Number(form.bonus_pct) || 0);

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Zap className="w-4 h-4 text-[var(--mb-accent-300)]" />
            <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--mb-accent-300)]">Incentivos de Recarga</span>
            <StatusBadge status="active" label="configuração por bot" />
          </div>
          <h1 className="text-2xl font-bold text-[var(--mb-text-primary)]">
            <span className="text-[var(--mb-accent-300)]">Bônus</span> de recarga
          </h1>
          <p className="text-[13px] text-[var(--mb-text-caption)] mt-0.5 max-w-xl">
            Configure a regra de incentivo, o valor mínimo e a comunicação exibida aos clientes de cada bot.
          </p>
        </div>
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--mb-text-caption)]">Contexto do Bot</span>
          <select
            value={botId}
            onChange={(e) => setBotId(e.target.value)}
            className="block mt-1 px-3 py-2 text-[13px] text-[var(--mb-text-primary)] bg-[var(--mb-surface-900)] border border-[var(--mb-border-soft)] outline-none min-w-[220px]"
          >
            <option value="">Todos os bots</option>
            {bots.map((b) => (
              <option key={b._id} value={b._id}>
                {b.name || b.bot_name} (@{b.username || b.bot_username})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <KpiGroup icon={Percent} title="Incentivo" items={[
          { label: 'Benefício', value: bonusValue, subtitle: 'Crédito adicional' },
          { label: 'Formato', value: form.bonus_type === 'percentual' ? 'Percentual' : 'Fixo', subtitle: 'Regra aplicada' },
        ]} />
        <KpiGroup icon={CheckCircle} title="Elegibilidade" items={[
          { label: 'Recarga Mínima', value: form.min_amount ? formatBRL(Number(form.min_amount)) : 'Livre', subtitle: 'Valor de entrada' },
          { label: 'Estado', value: form.enabled ? 'Ativo' : 'Inativo', subtitle: 'Próximas recargas', color: form.enabled ? 'var(--mb-success)' : 'var(--mb-error)' },
        ]} />
        <KpiGroup icon={MessageSquare} title="Experiência" items={[
          { label: 'Comunicação', value: form.show_to_clients ? 'Visível' : 'Oculta', subtitle: 'Antes do pagamento' },
          { label: `Em R$ 100`, value: `+ ${estimatedBonus}`, subtitle: 'Simulação atual' },
        ]} />
      </div>

      {/* Config Form + Preview */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_350px]">
        {/* Config */}
        <Surface className="p-5">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--mb-accent-300)]">Regra Operacional</span>
          </div>
          <h3 className="text-[16px] font-bold text-[var(--mb-text-primary)] mb-4">Configure o bônus</h3>
          <p className="text-[11px] text-[var(--mb-text-caption)] mb-4 text-right">
            Valor, elegibilidade e visibilidade aplicados exclusivamente ao bot selecionado.
          </p>

          <div className="mb-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--mb-text-caption)]">Parâmetros Financeiros</span>
              <StatusBadge status={form.enabled ? 'active' : 'inactive'} label={form.enabled ? 'Ativa' : 'Inativa'} />
            </div>
            <h4 className="text-[14px] font-semibold text-[var(--mb-text-primary)] mb-3">Condição da campanha</h4>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-[11px] text-[var(--mb-text-caption)] mb-1">Tipo de bônus</label>
                <select
                  value={form.bonus_type}
                  onChange={(e) => u('bonus_type', e.target.value)}
                  className="w-full px-3 py-2.5 text-[13px] text-[var(--mb-text-primary)] bg-[var(--mb-surface-900)] border border-[var(--mb-border-soft)] outline-none"
                >
                  <option value="percentual">Percentual</option>
                  <option value="fixo">Valor fixo (R$)</option>
                </select>
                <p className="text-[10px] text-[var(--mb-text-caption)] mt-1">Define como o crédito adicional será calculado.</p>
              </div>
              <div>
                <label className="block text-[11px] text-[var(--mb-text-caption)] mb-1">
                  {form.bonus_type === 'percentual' ? 'Percentual (%)' : 'Valor (R$)'}
                </label>
                <div className="flex items-center gap-1">
                  {form.bonus_type === 'percentual' && <span className="text-[var(--mb-text-caption)] text-[12px]">%</span>}
                  <input
                    type="number"
                    value={form.bonus_pct}
                    onChange={(e) => u('bonus_pct', e.target.value)}
                    className="w-full px-3 py-2.5 text-[13px] text-[var(--mb-text-primary)] bg-[var(--mb-surface-900)] border border-[var(--mb-border-soft)] outline-none"
                  />
                </div>
                <p className="text-[10px] text-[var(--mb-text-caption)] mt-1">Benefício creditado após a confirmação da recarga.</p>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-[11px] text-[var(--mb-text-caption)] mb-1">Recarga mínima elegível (R$)</label>
              <input
                type="number"
                value={form.min_amount}
                onChange={(e) => u('min_amount', e.target.value)}
                placeholder="Sem valor mínimo"
                className="w-full px-3 py-2.5 text-[13px] text-[var(--mb-text-primary)] bg-[var(--mb-surface-900)] border border-[var(--mb-border-soft)] outline-none placeholder:text-[var(--mb-text-caption)]"
              />
              <p className="text-[10px] text-[var(--mb-text-caption)] mt-1">Deixe vazio para ativar em qualquer recarga aprovada.</p>
            </div>

            <div className="space-y-2">
              <ToggleSwitch
                checked={form.enabled}
                onChange={(v) => u('enabled', v)}
                label="Bônus ativo"
                description="Aplica esta regra nas próximas recargas concluídas."
              />
              <ToggleSwitch
                checked={form.show_to_clients}
                onChange={(v) => u('show_to_clients', v)}
                label="Mostrar aos clientes"
                description="Exibe a vantagem antes da geração do pagamento."
              />
            </div>
          </div>

          <p className="text-[10px] text-[var(--mb-text-caption)] mt-2">
            O valor incentivado aparecerá no parâmetros do formulário em tempo real.
          </p>
        </Surface>

        {/* Preview */}
        <Surface className="p-5">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--mb-text-caption)]">Prévia da Regra</span>
            <DollarSign className="w-4 h-4 text-[var(--mb-text-caption)]" />
          </div>
          <h3 className="text-[16px] font-bold text-[var(--mb-text-primary)] mb-4">{botName}</h3>

          <div className="mb-4">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--mb-text-caption)]">Crédito Adicional Estimado</span>
            <p className="text-3xl font-bold text-[var(--mb-success)] mt-1">+ {estimatedBonus}</p>
            <p className="text-[11px] text-[var(--mb-text-caption)] mt-1">para uma recarga aprovada de R$ 100,00</p>
          </div>

          <div className="space-y-3 border-t border-[var(--mb-border-soft)] pt-4">
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-[var(--mb-text-caption)]">Benefício</span>
              <span className="text-[12px] font-semibold text-[var(--mb-text-primary)]">{bonusValue}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-[var(--mb-text-caption)]">Recarga mínima</span>
              <span className="text-[12px] font-semibold text-[var(--mb-text-primary)]">
                {form.min_amount ? formatBRL(Number(form.min_amount)) : 'Sem mínimo'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-[var(--mb-text-caption)]">Comunicação</span>
              <span className="text-[12px] font-semibold text-[var(--mb-text-primary)]">
                {form.show_to_clients ? 'Visível' : 'Somente Interna'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-[var(--mb-text-caption)]">Aplicação</span>
              <span className="text-[12px] font-semibold text-[var(--mb-text-primary)]">
                {form.enabled ? 'Banca recargada' : 'Desativado'}
              </span>
            </div>
          </div>
        </Surface>
      </div>

      {/* Save */}
      <div className="flex justify-end">
        <ActionButton variant="accent" loading={saveMut.isPending} onClick={() => saveMut.mutate()}>
          <Save className="w-4 h-4 mr-1" />Salvar
        </ActionButton>
      </div>
    </div>
  );
}
