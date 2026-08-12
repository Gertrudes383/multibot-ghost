import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity, CheckCircle, XCircle, AlertTriangle, Zap,
  RefreshCw, Filter, ChevronDown, Search, Monitor, RotateCcw,
} from 'lucide-react';
import { getCheckerMonitor, getBots } from '@services/admin.service';
import { formatNumber, formatDateTime } from '@utils/format';
import Surface from '@components/ui/Surface';
import DataTable from '@components/ui/DataTable';
import StatusBadge from '@components/ui/StatusBadge';
import Pagination from '@components/ui/Pagination';
import Spinner from '@components/ui/Spinner';
import ActionButton from '@components/ui/ActionButton';

function KpiCard({ icon: Icon, title, value, subtitle, accent = 'var(--mb-accent-300)' }) {
  return (
    <Surface className="p-4 flex-1 min-w-[150px]">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4" style={{ color: accent }} />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--mb-text-caption)]">{title}</span>
      </div>
      <p className="text-2xl font-bold" style={{ color: accent }}>{value}</p>
      {subtitle && <p className="text-[10px] text-[var(--mb-text-caption)] mt-0.5">{subtitle}</p>}
    </Surface>
  );
}

const STATUS_MAP = { approved: 'active', rejected: 'error', error: 'error', pending: 'pending' };
const STATUS_LABELS = { approved: 'Aprovado', rejected: 'Reprovado', error: 'Erro', pending: 'Pendente' };

export default function CheckerMonitorPage() {
  const [page, setPage] = useState(1);
  const [botId, setBotId] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [realtime, setRealtime] = useState(false);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin', 'checker', 'monitor', page, botId],
    queryFn: () => getCheckerMonitor({ page, botId: botId || undefined }),
    refetchInterval: realtime ? 5000 : false,
  });

  const { data: botsData } = useQuery({ queryKey: ['admin', 'bots'], queryFn: getBots });
  const bots = Array.isArray(botsData?.bots) ? botsData.bots : Array.isArray(botsData) ? botsData : [];

  const m = data || {};
  const events = m.events || m.history || [];
  const totalProcessed = m.totalProcessed || m.total || 0;
  const approved = m.approved || 0;
  const rejected = m.rejected || 0;
  const errors = m.errors || 0;
  const approvalRate = totalProcessed > 0 ? ((approved / totalProcessed) * 100).toFixed(1) : '0.0';
  const rejectionRate = totalProcessed > 0 ? ((rejected / totalProcessed) * 100).toFixed(1) : '0.0';
  const telegramCount = m.telegramEvents || totalProcessed;
  const webCount = m.webEvents || 0;

  const columns = [
    {
      key: 'createdAt', label: 'Data/Hora', render: (v) => (
        <span className="text-[12px] font-mono text-[var(--mb-text-muted)]">{formatDateTime(v)}</span>
      ),
    },
    {
      key: 'username', label: 'Usuário', render: (v, row) => (
        <span className="text-[13px] text-[var(--mb-accent-300)]">@{v || row.telegram_username || 'anônimo'}</span>
      ),
    },
    {
      key: 'card_number', label: 'Cartão', render: (v) => v ? (
        <span className="font-mono text-[12px] text-[var(--mb-success)]">{v.length > 12 ? v.slice(0, 4) + '****' + v.slice(-4) : v}</span>
      ) : '—',
    },
    {
      key: 'bin', label: 'BIN', render: (v) => v ? (
        <span className="font-mono text-[12px] text-[var(--mb-text-muted)]">{v}</span>
      ) : '—',
    },
    {
      key: 'status', label: 'Status', render: (v) => (
        <StatusBadge
          status={STATUS_MAP[v] || 'info'}
          label={STATUS_LABELS[v] || v}
        />
      ),
    },
    {
      key: 'origin', label: 'Origem', render: (v, row) => (
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-[var(--mb-text-caption)]">{row.origin_icon || '📦'} {v || row.purchase_type || 'Estoque local'}</span>
        </div>
      ),
    },
    {
      key: 'bot_name', label: 'Bot', render: (v) => v ? (
        <span className="text-[12px] text-[var(--mb-text-muted)]">{v}</span>
      ) : '—',
    },
    {
      key: '_actions', label: 'Ações', render: () => (
        <div className="w-8 h-[2px] bg-[var(--mb-border-soft)]" />
      ),
    },
  ];

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Activity className="w-4 h-4 text-[var(--mb-accent-300)]" />
            <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--mb-accent-300)]">Operação de Checker</span>
            <StatusBadge status="active" label="monitoramento disponível" />
          </div>
          <h1 className="text-2xl font-bold text-[var(--mb-text-primary)]">Monitor Checker</h1>
          <p className="text-[13px] text-[var(--mb-text-caption)] mt-0.5">Saúde operacional, decisões do gateway e eventos de cartões em uma única linha do tempo.</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--mb-text-caption)]">Escopo do Monitor</span>
            <select
              value={botId}
              onChange={(e) => { setBotId(e.target.value); setPage(1); }}
              className="block mt-1 px-3 py-1.5 text-[12px] text-[var(--mb-text-primary)] bg-[var(--mb-surface-900)] border border-[var(--mb-border-soft)] outline-none min-w-[250px]"
            >
              <option value="">Todos os bots</option>
              {bots.map((b) => (
                <option key={b._id} value={b._id}>{b.name || b.bot_name} (@{b.username || b.bot_username})</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <ActionButton variant="ghost" size="sm" onClick={() => setRealtime(!realtime)}>
              <Zap className={`w-3.5 h-3.5 mr-1 ${realtime ? 'text-[var(--mb-success)]' : ''}`} />
              {realtime ? 'Tempo real ativo' : 'Ativar tempo real'}
            </ActionButton>
            <ActionButton variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`w-3.5 h-3.5 mr-1 ${isFetching ? 'animate-spin' : ''}`} />Atualizar
            </ActionButton>
            <ActionButton variant="accent" size="sm">
              <RotateCcw className="w-3.5 h-3.5 mr-1" />Reativar cartões
            </ActionButton>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <KpiCard icon={Activity} title="Volume Processado" value={formatNumber(totalProcessed)} subtitle="validações no período" />
        <KpiCard icon={CheckCircle} title="Aprovados" value={formatNumber(approved)} subtitle={`${approvalRate}% de aprovação`} accent="var(--mb-success)" />
        <KpiCard icon={XCircle} title="Reprovados" value={formatNumber(rejected)} subtitle={`${rejectionRate}% do volume`} accent="var(--mb-error)" />
        <KpiCard icon={AlertTriangle} title="Falhas Operacionais" value={formatNumber(errors)} subtitle={`${totalProcessed > 0 ? ((errors / totalProcessed) * 100).toFixed(1) : '0.0'}% com erro ou configuração`} accent="var(--mb-warning)" />
        <Surface className="p-4 flex-1 min-w-[150px]">
          <div className="flex items-center gap-2 mb-2">
            <Monitor className="w-4 h-4 text-[var(--mb-accent-300)]" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--mb-text-caption)]">Origem dos Eventos</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-[10px] text-[var(--mb-text-caption)]">Telegram</span>
              <p className="text-lg font-bold text-[var(--mb-accent-300)]">{formatNumber(telegramCount)}</p>
            </div>
            <div>
              <span className="text-[10px] text-[var(--mb-text-caption)]">Web</span>
              <p className="text-lg font-bold text-[var(--mb-text-muted)]">{formatNumber(webCount)}</p>
            </div>
          </div>
        </Surface>
      </div>

      {/* Advanced Query */}
      <div>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--mb-accent-300)]">Consulta Avançada</span>
        <h3 className="text-[15px] font-semibold text-[var(--mb-text-primary)] mb-3">Encontre um evento específico</h3>
        <Surface
          as="button"
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 px-4 py-3 w-full cursor-pointer hover:bg-[rgba(53,197,255,0.04)]"
        >
          <Filter className="w-4 h-4 text-[var(--mb-accent-300)]" />
          <div className="text-left">
            <span className="text-[13px] font-medium text-[var(--mb-text-primary)]">Filtros do checker</span>
            <p className="text-[11px] text-[var(--mb-text-caption)]">Período, decisão, origem, usuário e BIN</p>
          </div>
          <ChevronDown className={`w-4 h-4 text-[var(--mb-text-caption)] ml-auto transition-transform ${showFilters ? 'rotate-180' : ''}`} />
        </Surface>
        {showFilters && (
          <Surface className="p-4 mt-2">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <div>
                <label className="block text-[11px] text-[var(--mb-text-caption)] mb-1">Período</label>
                <select className="w-full px-3 py-2 text-[12px] text-[var(--mb-text-primary)] bg-[var(--mb-surface-900)] border border-[var(--mb-border-soft)] outline-none">
                  <option>Últimas 24h</option>
                  <option>Últimas 48h</option>
                  <option>Últimos 7 dias</option>
                  <option>Últimos 30 dias</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-[var(--mb-text-caption)] mb-1">Decisão</label>
                <select className="w-full px-3 py-2 text-[12px] text-[var(--mb-text-primary)] bg-[var(--mb-surface-900)] border border-[var(--mb-border-soft)] outline-none">
                  <option>Todas</option>
                  <option>Aprovado</option>
                  <option>Reprovado</option>
                  <option>Erro</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-[var(--mb-text-caption)] mb-1">Usuário</label>
                <input placeholder="@username ou TG ID" className="w-full px-3 py-2 text-[12px] text-[var(--mb-text-primary)] bg-[var(--mb-surface-900)] border border-[var(--mb-border-soft)] outline-none placeholder:text-[var(--mb-text-caption)]" />
              </div>
              <div>
                <label className="block text-[11px] text-[var(--mb-text-caption)] mb-1">BIN</label>
                <input placeholder="Primeiros 6 dígitos" className="w-full px-3 py-2 text-[12px] text-[var(--mb-text-primary)] bg-[var(--mb-surface-900)] border border-[var(--mb-border-soft)] outline-none placeholder:text-[var(--mb-text-caption)]" />
              </div>
            </div>
          </Surface>
        )}
      </div>

      {/* Event Stream */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--mb-accent-300)]">Event Stream</span>
            <h3 className="text-[14px] font-semibold text-[var(--mb-text-primary)]">Histórico de validações</h3>
            <p className="text-[12px] text-[var(--mb-text-caption)]">Decisões do checker ordenadas do evento mais recente ao mais antigo.</p>
          </div>
          <div className="text-right">
            <span className="text-2xl font-bold text-[var(--mb-text-primary)]">{formatNumber(m.totalEvents || events.length)}</span>
            <p className="text-[11px] text-[var(--mb-text-caption)]">registros encontrados</p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20"><Spinner size="lg" /></div>
        ) : (
          <>
            <DataTable columns={columns} data={events} emptyTitle="Nenhum evento registrado" emptyDescription="Os eventos do checker aparecerão aqui" />
            <div className="mt-4">
              <Pagination page={page} totalPages={m.totalPages || 1} onPageChange={setPage} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
