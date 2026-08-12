import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Megaphone, Send, Users, Radio, Clock, ArrowUpRight, RefreshCw,
  ChevronDown, Bold, Italic, Underline, Strikethrough, Code, Type,
  Link2, Smile, Eye, Image, Upload, ArrowLeft, Check, Settings,
} from 'lucide-react';
import { getTelegramBroadcast, sendTelegramBroadcast, getBots } from '@services/admin.service';
import { formatDateTime, formatNumber } from '@utils/format';
import { toast } from '@stores/toastStore';
import Surface from '@components/ui/Surface';
import DataTable from '@components/ui/DataTable';
import StatusBadge from '@components/ui/StatusBadge';
import Pagination from '@components/ui/Pagination';
import Spinner from '@components/ui/Spinner';
import ActionButton from '@components/ui/ActionButton';
import InputField from '@components/ui/InputField';

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
            <p className="text-[10px] text-[var(--mb-text-caption)]">{item.subtitle}</p>
          </div>
        ))}
      </div>
    </Surface>
  );
}

const STEPS = [
  { num: '01', title: 'Criar campanha', desc: 'Conteúdo e envio' },
  { num: '02', title: 'Selecionar público', desc: 'Filtros e usuários' },
  { num: '03', title: 'Configurar envio', desc: 'Agendamento e entrega' },
  { num: '04', title: 'Central de atividade', desc: 'Progresso e histórico' },
];

const AUDIENCE_FILTERS = [
  { key: 'all', icon: Users, label: 'Todos', desc: 'Com Telegram' },
  { key: 'active', icon: Users, label: 'Ativos', desc: 'Iniciaram o bot' },
  { key: '24h', icon: Clock, label: 'Últimas 24h', desc: 'Start recentes' },
  { key: '7d', icon: Clock, label: 'Últimos 7 dias', desc: 'Assíduos semanais' },
];

const STATUS_MAP = { completed: 'active', running: 'info', pending: 'pending', failed: 'error', cancelled: 'inactive' };
const STATUS_LABELS = { completed: 'Concluída', running: 'Em Andamento', pending: 'Pendente', failed: 'Falhou', cancelled: 'Cancelada' };

export default function TelegramBroadcastPage() {
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [page, setPage] = useState(1);
  const [botId, setBotId] = useState('');
  const [msgMode, setMsgMode] = useState('text');
  const [form, setForm] = useState({
    message: '', target: 'active', media: null,
    campaignName: '', profile: 'all', scheduleAt: '',
    inactiveMin: '', repeatEvery: '', repeatUntil: '',
    ignoreErrors: false, maxSend: '',
  });

  const { data: botsData } = useQuery({ queryKey: ['admin', 'bots'], queryFn: getBots });
  const bots = Array.isArray(botsData?.bots) ? botsData.bots : Array.isArray(botsData) ? botsData : [];
  const selectedBot = bots.find((b) => b._id === botId);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin', 'telegram', 'broadcast', page],
    queryFn: () => getTelegramBroadcast({ page }),
  });

  const broadcasts = data?.broadcasts || [];
  const audienceCount = data?.audienceTotal || (selectedBot?.total_users || 0);
  const activeCount = data?.activeUsers || 0;

  const sendMut = useMutation({
    mutationFn: () => sendTelegramBroadcast({ ...form, botId: botId || undefined }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['admin', 'telegram', 'broadcast'] });
      toast.success(`Campanha enviada para ${res?.sent || 0} usuários`);
      setStep(3);
    },
    onError: (e) => toast.error(e?.data?.message || 'Erro ao enviar broadcast'),
  });

  const estimatedReach = form.target === 'all' ? audienceCount : form.target === 'active' ? activeCount : Math.round(audienceCount * 0.3);

  const historyColumns = [
    {
      key: 'status', label: 'Status', render: (v) => (
        <StatusBadge status={STATUS_MAP[v] || 'info'} label={STATUS_LABELS[v] || v} />
      ),
    },
    {
      key: 'name', label: 'Campanha', render: (v, row) => (
        <div>
          <span className="text-[13px] font-medium text-[var(--mb-text-primary)]">{v || row.message?.slice(0, 40) || 'Sem nome'}</span>
          <p className="text-[11px] text-[var(--mb-text-caption)]">{row.target === 'all' ? 'Todos' : row.target} · Job {row._id?.slice(-8)}</p>
        </div>
      ),
    },
    {
      key: 'sent', label: 'Entregas', render: (v, row) => (
        <div className="w-24">
          <span className="text-[14px] font-semibold text-[var(--mb-text-primary)]">{formatNumber(v || 0)}</span>
          {row.total && <p className="text-[11px] text-[var(--mb-text-caption)]">/ {formatNumber(row.total)}</p>}
          {row.total > 0 && (
            <div className="mt-1 h-1 bg-[rgba(143,209,255,0.1)] overflow-hidden">
              <div className="h-full bg-[var(--mb-accent-300)]" style={{ width: `${Math.min(100, ((v || 0) / row.total) * 100)}%` }} />
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'createdAt', label: 'Iniciada em', render: (v) => (
        <span className="text-[12px] text-[var(--mb-text-muted)]">{formatDateTime(v)}</span>
      ),
    },
    {
      key: '_expand', label: '', render: () => (
        <ChevronDown className="w-4 h-4 text-[var(--mb-text-caption)]" />
      ),
    },
  ];

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Megaphone className="w-4 h-4 text-[var(--mb-accent-300)]" />
            <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--mb-accent-300)]">Comunicação em Massa</span>
          </div>
          <h1 className="text-xl font-bold text-[var(--mb-text-primary)]">Broadcast Telegram</h1>
          <p className="text-[13px] text-[var(--mb-text-caption)] mt-0.5">Crie campanhas, segmente sua audiência e acompanhe cada entrega com precisão operacional.</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={botId}
            onChange={(e) => setBotId(e.target.value)}
            className="px-3 py-1.5 text-[12px] text-[var(--mb-text-primary)] bg-[var(--mb-surface-900)] border border-[var(--mb-border-soft)] outline-none min-w-[220px]"
          >
            <option value="">Selecionar bot</option>
            {bots.map((b) => (
              <option key={b._id} value={b._id}>{b.name || b.bot_name} (@{b.username || b.bot_username})</option>
            ))}
          </select>
          <ActionButton variant="ghost" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`w-4 h-4 mr-1 ${isFetching ? 'animate-spin' : ''}`} />Sincronizar
          </ActionButton>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <KpiGroup icon={Users} title="Audiência" items={[
          { label: 'Usuários', value: formatNumber(audienceCount), subtitle: 'Base deste bot' },
          { label: 'Ativos', value: formatNumber(activeCount || data?.activeUsers || 0), subtitle: 'Já iniciaram o bot' },
        ]} />
        <KpiGroup icon={Radio} title="Recência" items={[
          { label: 'Últimas 24h', value: formatNumber(data?.last24h || 0), subtitle: 'Atividade recente' },
          { label: 'Últimos 7 dias', value: formatNumber(data?.last7d || 0), subtitle: 'Alcance semanal' },
        ]} />
        <KpiGroup icon={Megaphone} title="Campanhas" items={[
          { label: 'Recentes', value: formatNumber(data?.recentCampaigns || broadcasts.length), subtitle: 'Últimos sete dias' },
          { label: 'Processados', value: data?.totalProcessed ? formatNumber(data.totalProcessed) : '—', subtitle: 'Nenhum envio ativo' },
        ]} />
      </div>

      {/* Step Indicator */}
      <div className="grid grid-cols-4 gap-0">
        {STEPS.map((s, i) => (
          <button
            key={i}
            onClick={() => setStep(i)}
            className={`p-3 text-left border-t-2 transition-colors ${
              step === i
                ? 'border-[var(--mb-accent-300)] bg-[rgba(53,197,255,0.06)]'
                : 'border-transparent hover:bg-[rgba(53,197,255,0.03)]'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className={`text-[12px] font-mono ${step === i ? 'text-[var(--mb-accent-300)]' : 'text-[var(--mb-text-caption)]'}`}>{s.num}</span>
              <span className={`text-[13px] font-semibold ${step === i ? 'text-[var(--mb-text-primary)]' : 'text-[var(--mb-text-muted)]'}`}>{s.title}</span>
            </div>
            <p className="text-[11px] text-[var(--mb-text-caption)] mt-0.5 ml-6">{s.desc}</p>
          </button>
        ))}
      </div>

      {/* Step Content */}
      {step === 0 && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
          <Surface className="p-5">
            <div className="mb-1">
              <span className="text-[12px] font-mono text-[var(--mb-text-caption)]">01</span>
              <h3 className="text-[16px] font-bold text-[var(--mb-text-primary)]">Conteúdo e entrega</h3>
              <p className="text-[12px] text-[var(--mb-text-caption)]">Configure a mensagem, o público e o momento do envio.</p>
            </div>

            <div className="space-y-5 mt-4">
              <div>
                <label className="block text-[12px] font-medium text-[var(--mb-text-muted)] mb-1.5">Bot remetente</label>
                <select
                  value={botId}
                  onChange={(e) => setBotId(e.target.value)}
                  className="w-full px-3 py-2 text-[13px] text-[var(--mb-text-primary)] bg-[var(--mb-surface-900)] border border-[var(--mb-border-soft)] outline-none"
                >
                  {bots.map((b) => (
                    <option key={b._id} value={b._id}>{b.name || b.bot_name} · @{b.username || b.bot_username} · {formatNumber(b.total_users || 0)} usuários</option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[12px] font-medium text-[var(--mb-text-muted)]">Mensagem</label>
                  <p className="text-[11px] text-[var(--mb-text-caption)]">Formate o texto e insira emojis personalizados na posição do cursor.</p>
                </div>
                <div className="flex items-center gap-1 mb-2">
                  {['Texto', 'HTML', 'Markdown'].map((m) => (
                    <button
                      key={m}
                      onClick={() => setMsgMode(m.toLowerCase())}
                      className={`px-3 py-1 text-[11px] font-medium transition-colors ${
                        msgMode === m.toLowerCase()
                          ? 'bg-[var(--mb-accent-300)] text-[var(--mb-bg-950)]'
                          : 'text-[var(--mb-text-muted)] hover:text-[var(--mb-text-primary)]'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                  <span className="ml-auto text-[11px] text-[var(--mb-text-caption)]">Visual → Telegram</span>
                </div>
                <div className="flex items-center gap-1 p-2 border border-[var(--mb-border-soft)] border-b-0 bg-[rgba(143,209,255,0.03)]">
                  {[Bold, Italic, Underline, Strikethrough, Code, Type, Link2, Smile, Eye].map((Ic, i) => (
                    <button key={i} className="p-1.5 text-[var(--mb-text-caption)] hover:text-[var(--mb-text-primary)]">
                      <Ic className="w-3.5 h-3.5" />
                    </button>
                  ))}
                </div>
                <textarea
                  value={form.message}
                  onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))}
                  rows={6}
                  placeholder="Escreva uma mensagem clara e objetiva... Você pode usar $name para personalizar com o nome do cliente."
                  className="w-full px-3 py-3 text-[13px] text-[var(--mb-text-primary)] placeholder-[var(--mb-text-caption)] bg-[var(--mb-surface-900)] border border-[var(--mb-border-soft)] outline-none resize-none"
                />
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[11px] text-[var(--mb-accent-300)]">Use <strong>$name</strong> para personalizar</span>
                  <span className="text-[11px] text-[var(--mb-text-caption)]">{form.message.length} / 4.000</span>
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-medium text-[var(--mb-text-muted)] mb-1.5">Mídia <span className="text-[var(--mb-text-caption)]">opcional</span></label>
                <div className="border-2 border-dashed border-[var(--mb-border-soft)] p-8 text-center">
                  <Upload className="w-6 h-6 text-[var(--mb-text-caption)] mx-auto mb-2" />
                  <p className="text-[13px] font-medium text-[var(--mb-text-primary)]">Solte imagens ou vídeo aqui</p>
                  <p className="text-[11px] text-[var(--mb-text-caption)] mt-1">PNG, JPG ou GIF até 10 MB · MP4 até 200 MB</p>
                  <ActionButton variant="ghost" className="mt-3">
                    <Image className="w-4 h-4 mr-1" />Escolher arquivos
                  </ActionButton>
                </div>
              </div>
            </div>
          </Surface>

          <Surface className="p-5 self-start">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--mb-text-caption)]">Prévia da mensagem</span>
              <span className="text-[11px] text-[var(--mb-text-caption)]">Simulação no Telegram</span>
            </div>
            <div className="bg-[#0e1621] p-4">
              <div className="flex items-center gap-2 mb-4">
                <ArrowLeft className="w-4 h-4 text-[var(--mb-text-muted)]" />
                <div className="w-8 h-8 bg-[var(--mb-accent-300)] flex items-center justify-center text-[var(--mb-bg-950)] text-[12px] font-bold">
                  {(selectedBot?.name || 'B')[0].toUpperCase()}
                </div>
                <div>
                  <p className="text-[13px] font-medium text-[var(--mb-text-primary)]">{selectedBot?.name || selectedBot?.bot_name || 'Selecione um bot'}</p>
                  <p className="text-[11px] text-[var(--mb-text-caption)]">bot</p>
                </div>
              </div>
              <div className="flex justify-end">
                <div className="bg-[rgba(53,197,255,0.12)] px-3 py-2 max-w-[80%]">
                  <p className="text-[12px] text-[var(--mb-text-primary)] whitespace-pre-wrap">
                    {form.message || 'Sua mensagem aparecerá aqui conforme você digita.'}
                  </p>
                  <p className="text-[10px] text-[var(--mb-text-caption)] text-right mt-1">agora ✓✓</p>
                </div>
              </div>
            </div>
          </Surface>
        </div>
      )}

      {step === 1 && (
        <Surface className="p-5">
          <div className="mb-1">
            <span className="text-[12px] font-mono text-[var(--mb-text-caption)]">02</span>
            <h3 className="text-[16px] font-bold text-[var(--mb-text-primary)]">Quem deve receber?</h3>
            <p className="text-[12px] text-[var(--mb-text-caption)]">Use filtros rápidos ou escolha pessoas manualmente.</p>
          </div>

          <div className="flex gap-2 mt-4 mb-5">
            <button className="px-4 py-1.5 text-[12px] font-medium bg-[var(--mb-accent-300)] text-[var(--mb-bg-950)]">Segmentação automática</button>
            <button className="px-4 py-1.5 text-[12px] font-medium text-[var(--mb-text-muted)] hover:text-[var(--mb-text-primary)]">Seleção manual</button>
          </div>

          <div className="mb-5">
            <div className="flex items-center gap-2 mb-2">
              <Settings className="w-4 h-4 text-[var(--mb-accent-300)]" />
              <span className="text-[13px] font-semibold text-[var(--mb-text-primary)]">Filtrar por atividade</span>
            </div>
            <p className="text-[11px] text-[var(--mb-text-caption)] mb-3">Escolhe quando o usuário interagiu com o bot.</p>

            <div className="grid grid-cols-4 gap-3">
              {AUDIENCE_FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setForm((p) => ({ ...p, target: f.key }))}
                  className={`p-4 text-left border transition-colors ${
                    form.target === f.key
                      ? 'border-[var(--mb-accent-300)] bg-[rgba(53,197,255,0.06)]'
                      : 'border-[var(--mb-border-soft)] hover:border-[rgba(53,197,255,0.3)]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <f.icon className="w-4 h-4 text-[var(--mb-text-caption)]" />
                      <span className={`text-[13px] font-medium ${form.target === f.key ? 'text-[var(--mb-accent-300)]' : 'text-[var(--mb-text-primary)]'}`}>{f.label}</span>
                    </div>
                    {form.target === f.key && <Check className="w-4 h-4 text-[var(--mb-accent-300)]" />}
                  </div>
                  <p className="text-[11px] text-[var(--mb-text-caption)]">{f.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-5">
            <div>
              <label className="block text-[12px] text-[var(--mb-text-caption)] mb-1.5">Outro período</label>
              <select className="w-full px-3 py-2 text-[13px] text-[var(--mb-text-primary)] bg-[var(--mb-surface-900)] border border-[var(--mb-border-soft)] outline-none">
                <option>Selecionar período</option>
                <option value="30d">Últimos 30 dias</option>
                <option value="90d">Últimos 90 dias</option>
              </select>
            </div>
            <div>
              <label className="block text-[12px] text-[var(--mb-text-caption)] mb-1.5">Limite máximo de envios</label>
              <input
                type="text"
                value={form.maxSend}
                onChange={(e) => setForm((p) => ({ ...p, maxSend: e.target.value }))}
                placeholder="Ilimitado"
                className="w-full px-3 py-2 text-[13px] text-[var(--mb-text-primary)] bg-[var(--mb-surface-900)] border border-[var(--mb-border-soft)] outline-none placeholder:text-[var(--mb-text-caption)]"
              />
              <p className="text-[11px] text-[var(--mb-text-caption)] mt-1">Deixe vazio para enviar a todos do filtro.</p>
            </div>
          </div>

          <Surface className="p-4 bg-[rgba(92,236,174,0.04)]">
            <div className="flex items-center gap-2 mb-1">
              <Send className="w-4 h-4 text-[var(--mb-success)]" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--mb-success)]">Alcance Estimado</span>
            </div>
            <p className="text-lg font-bold text-[var(--mb-success)]">{formatNumber(estimatedReach)} destinatários</p>
            <p className="text-[11px] text-[var(--mb-text-caption)]">{formatNumber(estimatedReach)} usuários encontrados antes do limite.</p>
            <div className="mt-2 h-1.5 bg-[rgba(143,209,255,0.1)] overflow-hidden">
              <div className="h-full bg-[var(--mb-success)]" style={{ width: `${audienceCount > 0 ? (estimatedReach / audienceCount) * 100 : 0}%` }} />
            </div>
          </Surface>

          <button onClick={() => setStep(0)} className="flex items-center gap-1 mt-4 text-[12px] text-[var(--mb-text-caption)] hover:text-[var(--mb-text-primary)]">
            <ArrowLeft className="w-3.5 h-3.5" />Voltar ao conteúdo
          </button>
        </Surface>
      )}

      {step === 2 && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]">
          <Surface className="p-5">
            <div className="mb-1">
              <span className="text-[12px] font-mono text-[var(--mb-text-caption)]">03</span>
              <h3 className="text-[16px] font-bold text-[var(--mb-text-primary)]">Configurações de envio</h3>
              <p className="text-[12px] text-[var(--mb-text-caption)]">Revise o público, defina o agendamento e inicie a campanha.</p>
            </div>

            <Surface className="p-3 mt-4 flex items-center justify-between">
              <div>
                <span className="text-[11px] text-[var(--mb-text-caption)]">Público selecionado</span>
                <p className="text-[14px] font-bold text-[var(--mb-text-primary)]">{formatNumber(estimatedReach)} destinatários estimados</p>
              </div>
              <button onClick={() => setStep(1)} className="text-[12px] text-[var(--mb-accent-300)] hover:underline">Editar público →</button>
            </Surface>

            <div className="mt-4 flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.ignoreErrors}
                  onChange={(e) => setForm((p) => ({ ...p, ignoreErrors: e.target.checked }))}
                  className="w-4 h-4"
                />
                <div>
                  <span className="text-[13px] font-medium text-[var(--mb-text-primary)]">Ignorar erros permanentes anteriores</span>
                  <p className="text-[11px] text-[var(--mb-text-caption)]">Não tentar novamente usuários indisponíveis neste bot.</p>
                </div>
              </label>
              <ActionButton variant="ghost" size="sm" className="ml-auto">
                Gerenciar ignorados
              </ActionButton>
            </div>

            <div className="grid grid-cols-3 gap-4 mt-5">
              <InputField label="Nome da campanha" value={form.campaignName} onChange={(e) => setForm((p) => ({ ...p, campaignName: e.target.value }))} placeholder="Nome da campanha" />
              <div>
                <label className="block text-[12px] font-medium text-[var(--mb-text-muted)] mb-1.5">Perfil de envio</label>
                <select
                  value={form.profile}
                  onChange={(e) => setForm((p) => ({ ...p, profile: e.target.value }))}
                  className="w-full px-3 py-2 text-[13px] text-[var(--mb-text-primary)] bg-[var(--mb-surface-900)] border border-[var(--mb-border-soft)] outline-none"
                >
                  <option value="all">Todos os perfis</option>
                </select>
              </div>
              <InputField label="Agendar para" type="datetime-local" value={form.scheduleAt} onChange={(e) => setForm((p) => ({ ...p, scheduleAt: e.target.value }))} />
            </div>

            <div className="grid grid-cols-3 gap-4 mt-4">
              <InputField label="Inativos há (min)" type="number" value={form.inactiveMin} onChange={(e) => setForm((p) => ({ ...p, inactiveMin: e.target.value }))} />
              <InputField label="Repetir a cada (min)" type="number" value={form.repeatEvery} onChange={(e) => setForm((p) => ({ ...p, repeatEvery: e.target.value }))} />
              <InputField label="Repetir até" type="datetime-local" value={form.repeatUntil} onChange={(e) => setForm((p) => ({ ...p, repeatUntil: e.target.value }))} />
            </div>

            <details className="mt-4">
              <summary className="text-[12px] text-[var(--mb-text-muted)] cursor-pointer hover:text-[var(--mb-text-primary)]">
                ▸ Velocidade e configurações avançadas
              </summary>
              <div className="mt-3 p-3 border border-[var(--mb-border-soft)]">
                <p className="text-[12px] text-[var(--mb-text-caption)]">Configurações de throttle e retry serão adicionadas em breve.</p>
              </div>
            </details>

            <div className="flex items-center justify-between mt-6 pt-4 border-t border-[var(--mb-border-soft)]">
              <button onClick={() => setStep(1)} className="flex items-center gap-1 text-[12px] text-[var(--mb-text-caption)] hover:text-[var(--mb-text-primary)]">
                <ArrowLeft className="w-3.5 h-3.5" />Voltar ao público
              </button>
              <ActionButton variant="accent" loading={sendMut.isPending} disabled={!form.message.trim()} onClick={() => sendMut.mutate()}>
                <Send className="w-4 h-4 mr-1" />Iniciar campanha
              </ActionButton>
            </div>
          </Surface>

          <Surface className="p-4 self-start">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--mb-text-caption)]">Resumo da campanha</span>
            <div className="mt-3 space-y-2">
              {[
                { label: 'Bot', value: selectedBot?.name || '—' },
                { label: 'Conteúdo', value: form.message ? `${form.message.length} chars` : '—' },
                { label: 'Mídia', value: form.media ? '1 arquivo' : '—' },
                { label: 'Público', value: `${formatNumber(estimatedReach)} dest.` },
                { label: 'Envio', value: form.scheduleAt ? 'Agendado' : 'Imediato' },
              ].map((r) => (
                <div key={r.label} className="flex items-center justify-between py-1.5 border-b border-[rgba(143,209,255,0.08)]">
                  <span className="text-[12px] text-[var(--mb-text-caption)]">{r.label}</span>
                  <span className="text-[12px] text-[var(--mb-text-muted)]">{r.value}</span>
                </div>
              ))}
            </div>
          </Surface>
        </div>
      )}

      {step === 3 && (
        <Surface className="p-5">
          <div className="flex items-center justify-between mb-1">
            <div>
              <span className="text-[12px] font-mono text-[var(--mb-text-caption)]">04</span>
              <h3 className="text-[16px] font-bold text-[var(--mb-text-primary)]">Central de atividade</h3>
              <p className="text-[12px] text-[var(--mb-text-caption)]">Acompanhe campanhas em execução e consulte o histórico recente.</p>
            </div>
            <ActionButton variant="ghost" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`w-4 h-4 mr-1 ${isFetching ? 'animate-spin' : ''}`} />Atualizar dados
            </ActionButton>
          </div>

          <div className="mt-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--mb-text-caption)]">Histórico de envios</span>
                <h4 className="text-[14px] font-semibold text-[var(--mb-text-primary)]">Campanhas recentes</h4>
                <p className="text-[11px] text-[var(--mb-text-caption)]">Atividade registrada nos últimos sete dias.</p>
              </div>
              <span className="text-[14px] font-semibold text-[var(--mb-text-primary)]">{formatNumber(broadcasts.length)} <span className="text-[11px] text-[var(--mb-text-caption)]">registros</span></span>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-12"><Spinner size="lg" /></div>
            ) : (
              <>
                <DataTable columns={historyColumns} data={broadcasts} emptyTitle="Nenhuma campanha registrada" emptyDescription="Crie sua primeira campanha na aba Criar campanha" />
                <div className="mt-4">
                  <Pagination page={page} totalPages={data?.totalPages || 1} onPageChange={setPage} />
                </div>
              </>
            )}
          </div>
        </Surface>
      )}
    </div>
  );
}
