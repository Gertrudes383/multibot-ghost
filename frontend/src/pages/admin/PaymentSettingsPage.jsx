import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Save, Landmark, Bitcoin, Key, DollarSign,
  Shield, Clock, Zap, Bell, CheckCircle,
} from 'lucide-react';
import { getPaymentSettings, updatePaymentSettings } from '@services/admin.service';
import { toast } from '@stores/toastStore';
import Surface from '@components/ui/Surface';
import InputField from '@components/ui/InputField';
import ActionButton from '@components/ui/ActionButton';
import Spinner from '@components/ui/Spinner';
import StatusBadge from '@components/ui/StatusBadge';

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

function SectionHeader({ number, icon: Icon, title, description, badge }) {
  return (
    <div className="flex items-start gap-3 mb-4">
      <div className="w-7 h-7 flex items-center justify-center bg-[rgba(53,197,255,0.12)] text-[var(--mb-accent-300)] text-[11px] font-bold flex-shrink-0">
        {number}
      </div>
      <div className="flex-1">
        <h3 className="text-[15px] font-bold text-[var(--mb-text-primary)]">{title}</h3>
        <p className="text-[12px] text-[var(--mb-text-caption)]">{description}</p>
      </div>
      {badge && <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--mb-text-caption)]">{badge}</span>}
    </div>
  );
}

export default function PaymentSettingsPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('pix');
  const [form, setForm] = useState({
    primepixKey: '',
    feeType: 'fixed',
    feeValue: '1',
    minValue: '5',
    maxValue: '1000',
    dailyLimit: '10',
    hourlyLimit: '5',
    intervalMinutes: '1',
    expirationMinutes: '30',
    verificationSeconds: '5',
    confirmationMethod: 'webhook',
    webhookUrl: '',
    pixEnabled: true,
    adminNotifications: true,
    nowpaymentsKey: '',
    nowpaymentsIpnSecret: '',
    cryptoEnabled: false,
    cryptoMinValue: '10',
    cryptoMaxValue: '5000',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'payments'],
    queryFn: getPaymentSettings,
  });

  useEffect(() => {
    if (data) {
      setForm((prev) => ({
        ...prev,
        primepixKey: data.primepixKey || data.primePix?.apiKey || '',
        feeType: data.feeType || data.primePix?.feeType || 'fixed',
        feeValue: String(data.feeValue ?? data.primePix?.feeValue ?? '1'),
        minValue: String(data.minValue ?? data.primePix?.minValue ?? '5'),
        maxValue: String(data.maxValue ?? data.primePix?.maxValue ?? '1000'),
        dailyLimit: String(data.dailyLimit ?? data.primePix?.dailyLimit ?? '10'),
        hourlyLimit: String(data.hourlyLimit ?? data.primePix?.hourlyLimit ?? '5'),
        intervalMinutes: String(data.intervalMinutes ?? data.primePix?.intervalMinutes ?? '1'),
        expirationMinutes: String(data.expirationMinutes ?? data.primePix?.expirationMinutes ?? '30'),
        verificationSeconds: String(data.verificationSeconds ?? data.primePix?.verificationSeconds ?? '5'),
        confirmationMethod: data.confirmationMethod || data.primePix?.confirmationMethod || 'webhook',
        webhookUrl: data.webhookUrl || data.primePix?.webhookUrl || '',
        pixEnabled: data.pixEnabled ?? data.primePix?.enabled ?? true,
        adminNotifications: data.adminNotifications ?? true,
        nowpaymentsKey: data.nowpaymentsKey || data.crypto?.apiKey || '',
        nowpaymentsIpnSecret: data.nowpaymentsIpnSecret || data.crypto?.ipnSecret || '',
        cryptoEnabled: data.cryptoEnabled ?? data.crypto?.enabled ?? false,
        cryptoMinValue: String(data.cryptoMinValue ?? data.crypto?.minValue ?? '10'),
        cryptoMaxValue: String(data.cryptoMaxValue ?? data.crypto?.maxValue ?? '5000'),
      }));
    }
  }, [data]);

  const saveMut = useMutation({
    mutationFn: () => updatePaymentSettings({
      ...form,
      feeValue: Number(form.feeValue),
      minValue: Number(form.minValue),
      maxValue: Number(form.maxValue),
      dailyLimit: Number(form.dailyLimit),
      hourlyLimit: Number(form.hourlyLimit),
      intervalMinutes: Number(form.intervalMinutes),
      expirationMinutes: Number(form.expirationMinutes),
      verificationSeconds: Number(form.verificationSeconds),
      cryptoMinValue: Number(form.cryptoMinValue),
      cryptoMaxValue: Number(form.cryptoMaxValue),
    }),
    onSuccess: () => { toast.success('Configurações salvas'); queryClient.invalidateQueries({ queryKey: ['admin', 'payments'] }); },
    onError: (e) => toast.error(e?.data?.message || 'Erro ao salvar'),
  });

  function u(field, value) { setForm((f) => ({ ...f, [field]: value })); }

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div className="space-y-6 p-6">
      {/* Tabs */}
      <div className="flex border-b border-[var(--mb-border-soft)]">
        <button
          onClick={() => setTab('pix')}
          className={`flex items-center gap-2 px-5 py-3 text-[13px] font-medium transition-colors ${
            tab === 'pix'
              ? 'text-[var(--mb-text-primary)] bg-[var(--mb-surface-900)] border-b-2 border-[var(--mb-accent-300)]'
              : 'text-[var(--mb-text-caption)] hover:text-[var(--mb-text-muted)]'
          }`}
        >
          <Landmark className="w-4 h-4" />PIX automático
          <span className="text-[10px] text-[var(--mb-text-caption)] ml-1">Gateways e limites</span>
        </button>
        <button
          onClick={() => setTab('crypto')}
          className={`flex items-center gap-2 px-5 py-3 text-[13px] font-medium transition-colors ${
            tab === 'crypto'
              ? 'text-[var(--mb-text-primary)] bg-[var(--mb-surface-900)] border-b-2 border-[var(--mb-accent-300)]'
              : 'text-[var(--mb-text-caption)] hover:text-[var(--mb-text-muted)]'
          }`}
        >
          <Bitcoin className="w-4 h-4" />Cripto
          <span className="text-[10px] text-[var(--mb-text-caption)] ml-1">Fluxo e moedas</span>
        </button>
      </div>

      {tab === 'pix' ? (
        <div className="space-y-6">
          {/* PIX Title */}
          <Surface className="p-5">
            <div className="flex items-center gap-2 mb-1">
              <Landmark className="w-4 h-4 text-[var(--mb-accent-300)]" />
              <span className="text-[15px] font-bold text-[var(--mb-text-primary)]">PIX automático</span>
              <span className="text-[12px] text-[var(--mb-text-caption)] ml-2">Provedor, cobrança e controles operacionais.</span>
            </div>
          </Surface>

          {/* Section 01 - Provider */}
          <Surface className="p-5">
            <SectionHeader number="01" icon={Key} title="Conexão do provedor" description="Defina o gateway responsável e sua credencial de autenticação." />
            <div>
              <label className="block text-[12px] font-medium text-[var(--mb-text-muted)] mb-1.5">API Key PrimePix v2</label>
              <input
                type="text"
                value={form.primepixKey}
                onChange={(e) => u('primepixKey', e.target.value)}
                className="w-full px-3 py-2.5 text-[13px] font-mono text-[var(--mb-text-primary)] bg-[var(--mb-surface-900)] border border-[var(--mb-border-soft)] outline-none"
              />
              <p className="text-[11px] text-[var(--mb-text-caption)] mt-1">PrimePix v2 é o provedor exclusivo das recargas automáticas.</p>
            </div>
          </Surface>

          {/* Section 02 - Fees */}
          <Surface className="p-5">
            <SectionHeader number="02" icon={DollarSign} title="Cobrança e taxa" description="Configure o acréscimo aplicado na geração de cada PIX." />
            <p className="text-[12px] font-medium text-[var(--mb-text-muted)] mb-2">Taxa por PIX</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] text-[var(--mb-text-caption)] mb-1">Tipo de taxa</label>
                <select
                  value={form.feeType}
                  onChange={(e) => u('feeType', e.target.value)}
                  className="w-full px-3 py-2.5 text-[13px] text-[var(--mb-text-primary)] bg-[var(--mb-surface-900)] border border-[var(--mb-border-soft)] outline-none"
                >
                  <option value="fixed">Valor fixo (R$)</option>
                  <option value="percentage">Percentual (%)</option>
                </select>
                <p className="text-[10px] text-[var(--mb-text-caption)] mt-1">Taxa adicional cobrada no PIX (não creditada ao usuário)</p>
              </div>
              <div>
                <label className="block text-[11px] text-[var(--mb-text-caption)] mb-1">Valor da taxa (R$)</label>
                <input
                  type="number"
                  value={form.feeValue}
                  onChange={(e) => u('feeValue', e.target.value)}
                  className="w-full px-3 py-2.5 text-[13px] text-[var(--mb-text-primary)] bg-[var(--mb-surface-900)] border border-[var(--mb-border-soft)] outline-none"
                />
                <p className="text-[10px] text-[var(--mb-text-caption)] mt-1">Usuário paga R$ {form.feeValue || '0'} a mais no PIX</p>
              </div>
            </div>
          </Surface>

          {/* Section 03 - Value Range */}
          <Surface className="p-5">
            <SectionHeader number="03" icon={Shield} title="Faixa de valores" description="Controle o menor e o maior valor aceito por solicitação." badge="Valores" />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] text-[var(--mb-text-caption)] mb-1">Valor Mínimo (R$)</label>
                <input
                  type="number"
                  value={form.minValue}
                  onChange={(e) => u('minValue', e.target.value)}
                  className="w-full px-3 py-2.5 text-[13px] text-[var(--mb-text-primary)] bg-[var(--mb-surface-900)] border border-[var(--mb-border-soft)] outline-none"
                />
                <p className="text-[10px] text-[var(--mb-text-caption)] mt-1">A PrimePix v2 requer mínimo de R$ 1,00.</p>
              </div>
              <div>
                <label className="block text-[11px] text-[var(--mb-text-caption)] mb-1">Valor máximo (R$)</label>
                <input
                  type="number"
                  value={form.maxValue}
                  onChange={(e) => u('maxValue', e.target.value)}
                  className="w-full px-3 py-2.5 text-[13px] text-[var(--mb-text-primary)] bg-[var(--mb-surface-900)] border border-[var(--mb-border-soft)] outline-none"
                />
              </div>
            </div>
          </Surface>

          {/* Section 04 - Limits & Processing */}
          <Surface className="p-5">
            <SectionHeader number="04" icon={Clock} title="Limites e processamento" description="Defina frequência, duração e ritmo de verificação." badge="Automação" />
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-[11px] text-[var(--mb-text-caption)] mb-1">Limite diário</label>
                <input
                  type="number"
                  value={form.dailyLimit}
                  onChange={(e) => u('dailyLimit', e.target.value)}
                  className="w-full px-3 py-2.5 text-[13px] text-[var(--mb-text-primary)] bg-[var(--mb-surface-900)] border border-[var(--mb-border-soft)] outline-none"
                />
                <p className="text-[10px] text-[var(--mb-text-caption)] mt-1">PIX por dia por usuário</p>
              </div>
              <div>
                <label className="block text-[11px] text-[var(--mb-text-caption)] mb-1">Limite por hora</label>
                <input
                  type="number"
                  value={form.hourlyLimit}
                  onChange={(e) => u('hourlyLimit', e.target.value)}
                  className="w-full px-3 py-2.5 text-[13px] text-[var(--mb-text-primary)] bg-[var(--mb-surface-900)] border border-[var(--mb-border-soft)] outline-none"
                />
                <p className="text-[10px] text-[var(--mb-text-caption)] mt-1">PIX por hora por usuário</p>
              </div>
              <div>
                <label className="block text-[11px] text-[var(--mb-text-caption)] mb-1">Intervalo entre PIX (minutos)</label>
                <input
                  type="number"
                  value={form.intervalMinutes}
                  onChange={(e) => u('intervalMinutes', e.target.value)}
                  className="w-full px-3 py-2.5 text-[13px] text-[var(--mb-text-primary)] bg-[var(--mb-surface-900)] border border-[var(--mb-border-soft)] outline-none"
                />
                <p className="text-[10px] text-[var(--mb-text-caption)] mt-1">Tempo de espera entre PIX</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-[11px] text-[var(--mb-text-caption)] mb-1">Expiração (minutos)</label>
                <input
                  type="number"
                  value={form.expirationMinutes}
                  onChange={(e) => u('expirationMinutes', e.target.value)}
                  className="w-full px-3 py-2.5 text-[13px] text-[var(--mb-text-primary)] bg-[var(--mb-surface-900)] border border-[var(--mb-border-soft)] outline-none"
                />
                <p className="text-[10px] text-[var(--mb-text-caption)] mt-1">Usado apenas pela contingência perto da expiração</p>
              </div>
              <div>
                <label className="block text-[11px] text-[var(--mb-text-caption)] mb-1">Verificação (segundos)</label>
                <input
                  type="number"
                  value={form.verificationSeconds}
                  onChange={(e) => u('verificationSeconds', e.target.value)}
                  className="w-full px-3 py-2.5 text-[13px] text-[var(--mb-text-primary)] bg-[var(--mb-surface-900)] border border-[var(--mb-border-soft)] outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] text-[var(--mb-text-caption)] mb-1">Confirmação do pagamento</label>
                <select
                  value={form.confirmationMethod}
                  onChange={(e) => u('confirmationMethod', e.target.value)}
                  className="w-full px-3 py-2.5 text-[13px] text-[var(--mb-text-primary)] bg-[var(--mb-surface-900)] border border-[var(--mb-border-soft)] outline-none"
                >
                  <option value="webhook">Webhook PrimePix v2 (recomendado)</option>
                  <option value="polling">Polling</option>
                </select>
                <p className="text-[10px] text-[var(--mb-text-caption)] mt-1">Webhook confirma na hora; polling fica como contingência próximo da expiração.</p>
              </div>
            </div>
            <div>
              <label className="block text-[11px] text-[var(--mb-text-caption)] mb-1">URL de webhook PrimePix v2</label>
              <input
                type="text"
                value={form.webhookUrl}
                onChange={(e) => u('webhookUrl', e.target.value)}
                placeholder="https://api.multibots.cc/api/recharge/primepix/webhook/..."
                className="w-full px-3 py-2.5 text-[12px] font-mono text-[var(--mb-text-primary)] bg-[var(--mb-surface-900)] border border-[var(--mb-border-soft)] outline-none placeholder:text-[var(--mb-text-caption)]"
              />
              <p className="text-[10px] text-[var(--mb-text-caption)] mt-1">Cadastre esta URL em Gestão → Webhooks no painel PrimePix para receber pix.paid e pix.expired.</p>
            </div>
          </Surface>

          {/* Section 05 - Availability */}
          <Surface className="p-5">
            <SectionHeader number="05" icon={Zap} title="Disponibilidade" description="Controle o serviço e os avisos administrativos." badge="Status" />
            <div className="space-y-2">
              <ToggleSwitch
                checked={form.pixEnabled}
                onChange={(v) => u('pixEnabled', v)}
                label="PIX Automático Ativo"
                description="Aplica esta regra nas próximas recargas concluídas."
              />
              <ToggleSwitch
                checked={form.adminNotifications}
                onChange={(v) => u('adminNotifications', v)}
                label="Notificações Admin Ativas"
                description="Receba alertas sobre pagamentos pendentes e expirados."
              />
            </div>
          </Surface>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Crypto Settings */}
          <Surface className="p-5">
            <div className="flex items-center gap-2 mb-1">
              <Bitcoin className="w-4 h-4 text-[var(--mb-accent-300)]" />
              <span className="text-[15px] font-bold text-[var(--mb-text-primary)]">Cripto</span>
              <span className="text-[12px] text-[var(--mb-text-caption)] ml-2">Fluxo e moedas configuráveis.</span>
            </div>
          </Surface>

          <Surface className="p-5">
            <SectionHeader number="01" icon={Key} title="Conexão NOWPayments" description="Credenciais para processar pagamentos em criptomoedas." />
            <div className="space-y-4">
              <div>
                <label className="block text-[12px] font-medium text-[var(--mb-text-muted)] mb-1.5">API Key</label>
                <input
                  type="password"
                  value={form.nowpaymentsKey}
                  onChange={(e) => u('nowpaymentsKey', e.target.value)}
                  className="w-full px-3 py-2.5 text-[13px] text-[var(--mb-text-primary)] bg-[var(--mb-surface-900)] border border-[var(--mb-border-soft)] outline-none"
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[var(--mb-text-muted)] mb-1.5">IPN Secret</label>
                <input
                  type="password"
                  value={form.nowpaymentsIpnSecret}
                  onChange={(e) => u('nowpaymentsIpnSecret', e.target.value)}
                  className="w-full px-3 py-2.5 text-[13px] text-[var(--mb-text-primary)] bg-[var(--mb-surface-900)] border border-[var(--mb-border-soft)] outline-none"
                />
              </div>
            </div>
          </Surface>

          <Surface className="p-5">
            <SectionHeader number="02" icon={Shield} title="Faixa de valores cripto" description="Limites de valor em reais para pagamentos cripto." />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] text-[var(--mb-text-caption)] mb-1">Valor Mínimo (R$)</label>
                <input
                  type="number"
                  value={form.cryptoMinValue}
                  onChange={(e) => u('cryptoMinValue', e.target.value)}
                  className="w-full px-3 py-2.5 text-[13px] text-[var(--mb-text-primary)] bg-[var(--mb-surface-900)] border border-[var(--mb-border-soft)] outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] text-[var(--mb-text-caption)] mb-1">Valor Máximo (R$)</label>
                <input
                  type="number"
                  value={form.cryptoMaxValue}
                  onChange={(e) => u('cryptoMaxValue', e.target.value)}
                  className="w-full px-3 py-2.5 text-[13px] text-[var(--mb-text-primary)] bg-[var(--mb-surface-900)] border border-[var(--mb-border-soft)] outline-none"
                />
              </div>
            </div>
          </Surface>

          <Surface className="p-5">
            <SectionHeader number="03" icon={Zap} title="Disponibilidade" description="Ative ou desative pagamentos em cripto." />
            <ToggleSwitch
              checked={form.cryptoEnabled}
              onChange={(v) => u('cryptoEnabled', v)}
              label="Pagamentos Cripto Ativos"
              description="Habilita BTC, USDT e outras moedas como meio de recarga."
            />
          </Surface>
        </div>
      )}

      {/* Save */}
      <div className="flex justify-end">
        <ActionButton variant="accent" loading={saveMut.isPending} onClick={() => saveMut.mutate()}>
          <Save className="w-4 h-4 mr-1" />Salvar Configurações
        </ActionButton>
      </div>
    </div>
  );
}
