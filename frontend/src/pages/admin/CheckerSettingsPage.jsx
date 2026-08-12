import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Save, Shield, Settings, Zap, Clock, AlertTriangle,
  CheckCircle, XCircle, RefreshCw, Globe, Lock, ToggleLeft,
} from 'lucide-react';
import { getCheckerStatus, updateCheckerSettings } from '@services/admin.service';
import { toast } from '@stores/toastStore';
import Surface from '@components/ui/Surface';
import InputField from '@components/ui/InputField';
import ActionButton from '@components/ui/ActionButton';
import StatusBadge from '@components/ui/StatusBadge';
import Spinner from '@components/ui/Spinner';

const TABS = [
  { key: 'fullsem', label: 'Full / Sem', icon: '📋' },
  { key: 'consultaveis', label: 'Consultáveis', icon: '🔍' },
  { key: 'tracks', label: 'Tracks', icon: '🎵' },
  { key: 'trocas', label: 'Trocas', icon: '🔄', disabled: true },
];

function ToggleSwitch({ checked, onChange, label, desc }) {
  return (
    <div className="flex items-start justify-between py-3 border-b border-[var(--mb-border-soft)] last:border-0">
      <div className="flex-1 mr-4">
        <p className="text-[13px] font-medium text-[var(--mb-text-primary)]">{label}</p>
        {desc && <p className="text-[11px] text-[var(--mb-text-caption)] mt-0.5">{desc}</p>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 shrink-0 transition-colors ${checked ? 'bg-[var(--mb-success)]' : 'bg-[rgba(143,209,255,0.15)]'}`}
      >
        <span className={`absolute top-0.5 w-5 h-5 bg-white transition-transform ${checked ? 'left-[22px]' : 'left-0.5'}`} />
      </button>
    </div>
  );
}

export default function CheckerSettingsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('fullsem');
  const [form, setForm] = useState({
    gateway: '', method: 'GET', apiUrl: '', paramName: 'CARD',
    approvedKeyword: '#Aprovada', rejectedKeyword: '#REPROVADA', errorKeyword: 'ERRO',
    timeout: '3', deads: '10', techErrors: '5',
    moduleEnabled: true, checkerEnabled: true,
    concurrency: '', retries: '',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'checker'],
    queryFn: getCheckerStatus,
  });

  useEffect(() => {
    if (data?.settings) {
      const s = data.settings;
      setForm((f) => ({
        ...f,
        gateway: s.gateway || f.gateway,
        apiUrl: s.apiUrl || s.gateway || f.apiUrl,
        method: s.method || f.method,
        paramName: s.paramName || f.paramName,
        approvedKeyword: s.approvedKeyword || f.approvedKeyword,
        rejectedKeyword: s.rejectedKeyword || f.rejectedKeyword,
        errorKeyword: s.errorKeyword || f.errorKeyword,
        timeout: String(s.timeout || f.timeout),
        deads: String(s.deads || s.maxDeads || f.deads),
        techErrors: String(s.techErrors || s.maxTechErrors || f.techErrors),
        moduleEnabled: s.moduleEnabled ?? f.moduleEnabled,
        checkerEnabled: s.checkerEnabled ?? s.enabled ?? f.checkerEnabled,
        concurrency: String(s.concurrency || ''),
        retries: String(s.retries || ''),
      }));
    }
  }, [data]);

  const saveMut = useMutation({
    mutationFn: updateCheckerSettings,
    onSuccess: () => { toast.success('Configuração salva'); queryClient.invalidateQueries({ queryKey: ['admin', 'checker'] }); },
    onError: (e) => toast.error(e?.data?.message || 'Erro ao salvar'),
  });

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  const tabLabel = activeTab === 'fullsem' ? 'Full / Sem Dados' : activeTab === 'consultaveis' ? 'Consultáveis' : 'Tracks';

  return (
    <div className="space-y-6 p-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Surface className="p-4">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--mb-success)]">Status de Validação</span>
          <p className="text-[14px] font-semibold text-[var(--mb-text-primary)] mt-1">Validação ativa nas compras</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[11px] text-[var(--mb-text-caption)]">Aba atual:</span>
            <span className="text-[12px] font-medium text-[var(--mb-accent-300)]">{tabLabel}</span>
          </div>
          <StatusBadge status={form.moduleEnabled ? 'active' : 'inactive'} label={form.moduleEnabled ? 'módulo ligado' : 'módulo desligado'} />
        </Surface>
        <Surface className="p-4">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--mb-text-caption)]">Timeout desta Aba</span>
          <div className="flex items-baseline gap-1 mt-1">
            <Clock className="w-4 h-4 text-[var(--mb-accent-300)]" />
            <span className="text-2xl font-bold text-[var(--mb-accent-300)]">{form.timeout} min</span>
          </div>
          <p className="text-[11px] text-[var(--mb-text-caption)] mt-1">Limite do módulo selecionado</p>
        </Surface>
        <Surface className="p-4">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--mb-text-caption)]">Proteção Automática</span>
          <div className="flex items-baseline gap-1 mt-1">
            <AlertTriangle className="w-4 h-4 text-[var(--mb-warning)]" />
            <span className="text-2xl font-bold text-[var(--mb-warning)]">{form.deads} DEADs</span>
          </div>
          <p className="text-[11px] text-[var(--mb-text-caption)] mt-1">{form.techErrors} erros técnicos consecutivos</p>
        </Surface>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--mb-border-soft)]">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => !t.disabled && setActiveTab(t.key)}
            disabled={t.disabled}
            className={`px-4 py-2.5 text-[12px] font-medium border-b-2 transition-colors ${
              activeTab === t.key
                ? 'border-[var(--mb-accent-300)] text-[var(--mb-accent-300)]'
                : t.disabled
                  ? 'border-transparent text-[var(--mb-text-caption)] opacity-50 cursor-not-allowed'
                  : 'border-transparent text-[var(--mb-text-muted)] hover:text-[var(--mb-text-primary)]'
            }`}
          >
            {t.icon} {t.label}{t.disabled ? ' · indisponível' : ''}
          </button>
        ))}
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        {/* Left: Connection + Interpretation */}
        <div className="space-y-6">
          <Surface className="p-5">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-[var(--mb-success)]" />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--mb-success)]">Conexão</span>
              </div>
              <p className="text-[12px] text-[var(--mb-text-caption)]">Gateway usado nas compras {tabLabel}.</p>
            </div>
            <h3 className="text-[15px] font-semibold text-[var(--mb-text-primary)] mb-4">API {tabLabel}</h3>

            <div className="flex gap-3 mb-4">
              <div className="w-32">
                <label className="block text-[12px] text-[var(--mb-text-muted)] mb-1.5">Método HTTP</label>
                <select
                  value={form.method}
                  onChange={(e) => setForm((f) => ({ ...f, method: e.target.value }))}
                  className="w-full px-3 py-2 text-[13px] text-[var(--mb-text-primary)] bg-[var(--mb-surface-900)] border border-[var(--mb-border-soft)] outline-none"
                >
                  <option>GET</option>
                  <option>POST</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-[12px] text-[var(--mb-text-muted)] mb-1.5">URL da API</label>
                <div className="flex items-center gap-2 px-3 py-2 bg-[var(--mb-surface-900)] border border-[var(--mb-border-soft)]">
                  <Globe className="w-4 h-4 text-[var(--mb-text-caption)]" />
                  <input
                    type="text"
                    value={form.apiUrl}
                    onChange={(e) => setForm((f) => ({ ...f, apiUrl: e.target.value }))}
                    placeholder="http://gateway.example.com/check?lista={CARD}"
                    className="flex-1 bg-transparent text-[13px] text-[var(--mb-text-primary)] outline-none placeholder:text-[var(--mb-text-caption)]"
                  />
                </div>
                <p className="text-[11px] text-[var(--mb-text-caption)] mt-1">Use {'{CARD}'} no endereço quando o cartão completo precisa ser inserido diretamente na URL.</p>
              </div>
            </div>

            <div>
              <label className="block text-[12px] text-[var(--mb-text-muted)] mb-1.5">Nome do parâmetro</label>
              <div className="flex items-center gap-2 px-3 py-2 bg-[var(--mb-surface-900)] border border-[var(--mb-border-soft)]">
                <span className="text-[var(--mb-text-caption)]">{'{}'}</span>
                <input
                  type="text"
                  value={form.paramName}
                  onChange={(e) => setForm((f) => ({ ...f, paramName: e.target.value }))}
                  className="flex-1 bg-transparent text-[13px] text-[var(--mb-text-primary)] outline-none"
                />
              </div>
              <p className="text-[11px] text-[var(--mb-text-caption)] mt-1">Usado quando a API recebe o cartão como parâmetro de consulta ou no corpo da requisição.</p>
            </div>
          </Surface>

          <Surface className="p-5">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-[var(--mb-accent-300)]" />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--mb-accent-300)]">Interpretação</span>
              </div>
              <p className="text-[12px] text-[var(--mb-text-caption)]">O sistema procura estes termos na resposta do gateway deste módulo.</p>
            </div>
            <h3 className="text-[15px] font-semibold text-[var(--mb-text-primary)] mb-4">Palavras-chave da resposta</h3>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-[12px] text-[var(--mb-text-muted)] mb-1.5">Cartão aprovado</label>
                <div className="flex items-center gap-2 px-3 py-2 bg-[var(--mb-surface-900)] border border-[var(--mb-border-soft)]">
                  <CheckCircle className="w-4 h-4 text-[var(--mb-success)]" />
                  <input
                    type="text"
                    value={form.approvedKeyword}
                    onChange={(e) => setForm((f) => ({ ...f, approvedKeyword: e.target.value }))}
                    className="flex-1 bg-transparent text-[13px] text-[var(--mb-text-primary)] outline-none"
                  />
                </div>
                <p className="text-[11px] text-[var(--mb-text-caption)] mt-1">Resultado LIVE e entrega permitida.</p>
              </div>
              <div>
                <label className="block text-[12px] text-[var(--mb-text-muted)] mb-1.5">Cartão recusado</label>
                <div className="flex items-center gap-2 px-3 py-2 bg-[rgba(255,157,168,0.06)] border border-[var(--mb-border-soft)]">
                  <XCircle className="w-4 h-4 text-[var(--mb-error)]" />
                  <input
                    type="text"
                    value={form.rejectedKeyword}
                    onChange={(e) => setForm((f) => ({ ...f, rejectedKeyword: e.target.value }))}
                    className="flex-1 bg-transparent text-[13px] text-[var(--mb-text-primary)] outline-none"
                  />
                </div>
                <p className="text-[11px] text-[var(--mb-text-caption)] mt-1">Resultado DEAD e cartão retirado do fluxo.</p>
              </div>
              <div>
                <label className="block text-[12px] text-[var(--mb-text-muted)] mb-1.5">Falha do checker</label>
                <div className="flex items-center gap-2 px-3 py-2 bg-[var(--mb-surface-900)] border border-[var(--mb-border-soft)]">
                  <AlertTriangle className="w-4 h-4 text-[var(--mb-warning)]" />
                  <input
                    type="text"
                    value={form.errorKeyword}
                    onChange={(e) => setForm((f) => ({ ...f, errorKeyword: e.target.value }))}
                    className="flex-1 bg-transparent text-[13px] text-[var(--mb-text-primary)] outline-none"
                  />
                </div>
                <p className="text-[11px] text-[var(--mb-text-caption)] mt-1">Erro técnico, sem classificar o cartão como DEAD.</p>
              </div>
            </div>
          </Surface>

          {/* Flow Info */}
          <Surface className="p-4 bg-[rgba(92,236,174,0.04)] border-[rgba(92,236,174,0.2)]">
            <div className="flex items-center gap-2 mb-1">
              <Shield className="w-4 h-4 text-[var(--mb-success)]" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--mb-success)]">Fluxo Seguro</span>
            </div>
            <h4 className="text-[14px] font-semibold text-[var(--mb-text-primary)] mb-1">Como o checker interpreta a compra</h4>
            <p className="text-[12px] text-[var(--mb-text-caption)]">
              Cada base usa o gateway da sua aba. O cartão é reservado, enviado à API do módulo e só é entregue após LIVE. Consultáveis/Tracks sem URL própria caem no Full/Sem até você configurar.
            </p>
            <div className="flex gap-4 mt-3 pt-3 border-t border-[rgba(92,236,174,0.15)]">
              <div className="flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-[var(--mb-text-caption)]" />
                <span className="text-[11px] text-[var(--mb-text-caption)]">Escopo isolado por owner e bot</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-[var(--mb-success)]" />
                <span className="text-[11px] text-[var(--mb-text-caption)]">LIVE permite a entrega</span>
              </div>
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-[var(--mb-warning)]" />
                <span className="text-[11px] text-[var(--mb-text-caption)]">Erro técnico <strong>não</strong> marca como DEAD</span>
              </div>
            </div>
          </Surface>
        </div>

        {/* Right: Module Activation + Timeout */}
        <div className="space-y-6">
          <Surface className="p-5">
            <div className="flex items-center gap-2 mb-1">
              <ToggleLeft className="w-4 h-4 text-[var(--mb-error)]" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--mb-error)]">Módulo</span>
            </div>
            <h3 className="text-[15px] font-semibold text-[var(--mb-text-primary)] mb-3">Ativação desta base</h3>

            <ToggleSwitch
              checked={form.moduleEnabled}
              onChange={(v) => setForm((f) => ({ ...f, moduleEnabled: v }))}
              label="Ativar módulo Full / Sem"
              desc="Quando desligado, Full e Sem são entregues sem validação."
            />
            <ToggleSwitch
              checked={form.checkerEnabled}
              onChange={(v) => setForm((f) => ({ ...f, checkerEnabled: v }))}
              label="Ativar checker nas compras"
              desc="Interruptor global: módulos ativos passam a validar."
            />
            <p className="text-[11px] text-[var(--mb-text-caption)] mt-3">Em bots com fornecedor externo, ligar/desligar a base também fica em Bots Telegram → Estoque.</p>
          </Surface>

          <Surface className="p-5">
            <div className="flex items-center gap-2 mb-1">
              <Shield className="w-4 h-4 text-[var(--mb-accent-300)]" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--mb-accent-300)]">Proteção</span>
            </div>
            <h3 className="text-[15px] font-semibold text-[var(--mb-text-primary)] mb-1">Timeout e limites</h3>
            <p className="text-[11px] text-[var(--mb-text-caption)] mb-4">Timeout deste e limites Auto Live são compartilhados entre os módulos.</p>

            <div className="space-y-4">
              <div>
                <label className="block text-[12px] text-[var(--mb-text-muted)] mb-1.5">Timeout deste módulo</label>
                <div className="flex items-center gap-2 px-3 py-2 bg-[var(--mb-surface-900)] border border-[var(--mb-border-soft)]">
                  <Clock className="w-4 h-4 text-[var(--mb-text-caption)]" />
                  <input
                    type="number"
                    value={form.timeout}
                    onChange={(e) => setForm((f) => ({ ...f, timeout: e.target.value }))}
                    className="flex-1 bg-transparent text-[13px] text-[var(--mb-text-primary)] outline-none"
                  />
                  <span className="text-[12px] text-[var(--mb-text-caption)]">MIN</span>
                </div>
                <p className="text-[11px] text-[var(--mb-text-caption)] mt-1">Tempo máximo de cada consulta neste gateway, entre 1 e 5 minutos.</p>
              </div>

              <div>
                <label className="block text-[12px] text-[var(--mb-text-muted)] mb-1.5">DEADs consecutivos</label>
                <div className="flex items-center gap-2 px-3 py-2 bg-[var(--mb-surface-900)] border border-[var(--mb-border-soft)]">
                  <AlertTriangle className="w-4 h-4 text-[var(--mb-warning)]" />
                  <input
                    type="number"
                    value={form.deads}
                    onChange={(e) => setForm((f) => ({ ...f, deads: e.target.value }))}
                    className="flex-1 bg-transparent text-[13px] text-[var(--mb-text-primary)] outline-none"
                  />
                </div>
                <p className="text-[11px] text-[var(--mb-text-caption)] mt-1">Limite compartilhado do Auto Live.</p>
              </div>

              <div>
                <label className="block text-[12px] text-[var(--mb-text-muted)] mb-1.5">Erros técnicos consecutivos</label>
                <div className="flex items-center gap-2 px-3 py-2 bg-[var(--mb-surface-900)] border border-[var(--mb-border-soft)]">
                  <XCircle className="w-4 h-4 text-[var(--mb-error)]" />
                  <input
                    type="number"
                    value={form.techErrors}
                    onChange={(e) => setForm((f) => ({ ...f, techErrors: e.target.value }))}
                    className="flex-1 bg-transparent text-[13px] text-[var(--mb-text-primary)] outline-none"
                  />
                </div>
                <p className="text-[11px] text-[var(--mb-text-caption)] mt-1">Limite compartilhado do Auto Live.</p>
              </div>
            </div>
          </Surface>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <ActionButton variant="ghost" onClick={() => queryClient.invalidateQueries({ queryKey: ['admin', 'checker'] })}>
          <RefreshCw className="w-4 h-4 mr-1" />Recarregar
        </ActionButton>
        <ActionButton
          variant="accent"
          loading={saveMut.isPending}
          onClick={() => saveMut.mutate({
            gateway: form.apiUrl || form.gateway,
            method: form.method,
            paramName: form.paramName,
            approvedKeyword: form.approvedKeyword,
            rejectedKeyword: form.rejectedKeyword,
            errorKeyword: form.errorKeyword,
            timeout: Number(form.timeout),
            deads: Number(form.deads),
            techErrors: Number(form.techErrors),
            moduleEnabled: form.moduleEnabled,
            checkerEnabled: form.checkerEnabled,
            tab: activeTab,
          })}
        >
          <Save className="w-4 h-4 mr-1" />Salvar configuração
        </ActionButton>
      </div>
    </div>
  );
}
