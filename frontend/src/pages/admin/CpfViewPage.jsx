import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Zap, Save, Shield, Eye, CheckCircle, Users,
  CreditCard, DollarSign, ArrowUpRight,
} from 'lucide-react';
import { getCpfViewSettings, updateCpfViewSettings } from '@services/admin.service';
import { formatBRL } from '@utils/format';
import { toast } from '@stores/toastStore';
import Surface from '@components/ui/Surface';
import ActionButton from '@components/ui/ActionButton';
import StatusBadge from '@components/ui/StatusBadge';
import Spinner from '@components/ui/Spinner';

function ToggleSwitch({ checked, onChange, label, description }) {
  return (
    <label className="flex items-center justify-between cursor-pointer py-3 px-4 bg-[var(--mb-surface-900)] border border-[var(--mb-border-soft)]">
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

const CRITERIA = [
  { key: 'all', icon: Users, label: 'Todos os usuários', description: 'Qualquer cliente do sistema pode visualizar o CPF.' },
  { key: 'balance', icon: DollarSign, label: 'Saldo mínimo', description: 'Exige um saldo atual igual ou superior ao valor definido.' },
  { key: 'recharge', icon: CreditCard, label: 'Recarga mínima', description: 'Exige ao menos uma recarga confirmada no valor configurado.' },
  { key: 'recharge_confirmed', icon: Shield, label: 'Recarga mínima confirmada', description: 'Considera recargas PIX ou cripto concluídas com valor igual ou superior.' },
];

export default function CpfViewPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    enabled: true,
    criteria: 'recharge',
    minValue: '100',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'cpf-view'],
    queryFn: getCpfViewSettings,
  });

  useEffect(() => {
    if (data) {
      setForm({
        enabled: data.enabled ?? true,
        criteria: data.criteria || 'recharge',
        minValue: String(data.minValue ?? data.min_value ?? '100'),
      });
    }
  }, [data]);

  const saveMut = useMutation({
    mutationFn: () => updateCpfViewSettings({
      enabled: form.enabled,
      criteria: form.criteria,
      minValue: Number(form.minValue) || 0,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'cpf-view'] }); toast.success('Política de CPF salva'); },
    onError: (e) => toast.error(e?.data?.message || 'Erro ao salvar'),
  });

  function u(field, value) { setForm((f) => ({ ...f, [field]: value })); }

  const criteriaLabel = CRITERIA.find((c) => c.key === form.criteria)?.label || form.criteria;

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Zap className="w-4 h-4 text-[var(--mb-accent-300)]" />
          <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--mb-accent-300)]">Política de Dados</span>
          <StatusBadge status="active" label="controle de acesso" />
        </div>
        <h1 className="text-2xl font-bold text-[var(--mb-text-primary)]">
          <span className="text-[var(--mb-accent-300)]">Visualização</span> de CPF
        </h1>
        <p className="text-[13px] text-[var(--mb-text-caption)] mt-0.5 max-w-xl">
          Defina com precisão quais clientes podem acessar o CPF vinculado aos cartões disponíveis.
        </p>
      </div>

      {/* Status KPIs */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Surface className="p-5">
          <div className="flex items-center gap-2 mb-2">
            <Eye className="w-4 h-4 text-[var(--mb-success)]" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--mb-text-caption)]">Disponibilidade</span>
          </div>
          <p className="text-2xl font-bold" style={{ color: form.enabled ? 'var(--mb-success)' : 'var(--mb-error)' }}>
            {form.enabled ? 'Ativa' : 'Desativada'}
          </p>
          <p className="text-[11px] text-[var(--mb-text-caption)] mt-1">
            {form.enabled ? 'Exibição de documento nos fluxos elegíveis.' : 'CPF oculto para todos os clientes.'}
          </p>
        </Surface>
        <Surface className="p-5">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-4 h-4 text-[var(--mb-accent-300)]" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--mb-text-caption)]">Critério Aplicado</span>
          </div>
          <p className="text-2xl font-bold text-[var(--mb-text-primary)]">{criteriaLabel}</p>
          <p className="text-[11px] text-[var(--mb-text-caption)] mt-1">
            A regra é validada antes de revelar o CPF.
          </p>
        </Surface>
      </div>

      {/* Access Control */}
      <Surface className="p-5">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--mb-accent-300)]">Controle de Acesso</span>
        </div>
        <h3 className="text-[16px] font-bold text-[var(--mb-text-primary)] mb-1">Política de visualização</h3>
        <p className="text-[12px] text-[var(--mb-text-caption)] mb-4 text-right">
          Configure a disponibilidade e o requisito necessário para consultar o documento.
        </p>

        <ToggleSwitch
          checked={form.enabled}
          onChange={(v) => u('enabled', v)}
          label="Permitir visualização de CPF"
          description="Libera o documento somente para usuários que atendem ao critério selecionado."
        />
      </Surface>

      {/* Criteria Selection */}
      <Surface className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h4 className="text-[14px] font-semibold text-[var(--mb-text-primary)]">Critério de elegibilidade</h4>
            <p className="text-[12px] text-[var(--mb-text-caption)]">Escolha uma única regra para todos os clientes.</p>
          </div>
          <span className="text-[11px] font-mono text-[var(--mb-text-caption)]">01</span>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3 mb-4">
          {CRITERIA.slice(0, 3).map((c) => {
            const isSelected = form.criteria === c.key;
            return (
              <button
                key={c.key}
                onClick={() => u('criteria', c.key)}
                className={`p-4 text-left transition-colors border ${
                  isSelected
                    ? 'border-[var(--mb-accent-300)] bg-[rgba(53,197,255,0.06)]'
                    : 'border-[var(--mb-border-soft)] hover:border-[var(--mb-accent-300)]'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <c.icon className={`w-4 h-4 ${isSelected ? 'text-[var(--mb-accent-300)]' : 'text-[var(--mb-text-caption)]'}`} />
                  {isSelected && <CheckCircle className="w-4 h-4 text-[var(--mb-accent-300)]" />}
                </div>
                <p className="text-[13px] font-semibold text-[var(--mb-text-primary)]">{c.label}</p>
                <p className="text-[11px] text-[var(--mb-text-caption)] mt-1">{c.description}</p>
              </button>
            );
          })}
        </div>

        {/* 4th criteria */}
        {(() => {
          const c = CRITERIA[3];
          if (!c) return null;
          const CIcon = c.icon;
          const isSelected = form.criteria === c.key;
          return (
            <button
              onClick={() => u('criteria', c.key)}
              className={`w-full p-4 text-left transition-colors border mb-4 ${
                isSelected
                  ? 'border-[var(--mb-accent-300)] bg-[rgba(53,197,255,0.06)]'
                  : 'border-[var(--mb-border-soft)] hover:border-[var(--mb-accent-300)]'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <CIcon className={`w-4 h-4 ${isSelected ? 'text-[var(--mb-accent-300)]' : 'text-[var(--mb-text-caption)]'}`} />
                {isSelected && <CheckCircle className="w-4 h-4 text-[var(--mb-accent-300)]" />}
              </div>
              <p className="text-[13px] font-semibold text-[var(--mb-text-primary)]">{c.label}</p>
              <p className="text-[11px] text-[var(--mb-text-caption)] mt-1">{c.description}</p>
            </button>
          );
        })()}

        {/* Value Input (when applicable) */}
        {(form.criteria === 'balance' || form.criteria === 'recharge' || form.criteria === 'recharge_confirmed') && (
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--mb-text-caption)]">Valor em Reais</span>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[var(--mb-success)] text-[13px] font-semibold">R$</span>
                <input
                  type="number"
                  value={form.minValue}
                  onChange={(e) => u('minValue', e.target.value)}
                  className="flex-1 px-3 py-2.5 text-[13px] text-[var(--mb-text-primary)] bg-[var(--mb-surface-900)] border border-[var(--mb-border-soft)] outline-none"
                  placeholder="100,00"
                />
              </div>
            </div>
            <ActionButton variant="accent" loading={saveMut.isPending} onClick={() => saveMut.mutate()} className="mt-5">
              <Save className="w-4 h-4 mr-1" />Salvar
            </ActionButton>
          </div>
        )}

        {form.criteria === 'all' && (
          <div className="flex justify-end">
            <ActionButton variant="accent" loading={saveMut.isPending} onClick={() => saveMut.mutate()}>
              <Save className="w-4 h-4 mr-1" />Salvar
            </ActionButton>
          </div>
        )}
      </Surface>
    </div>
  );
}
