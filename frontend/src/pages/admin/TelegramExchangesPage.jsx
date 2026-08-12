import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeftRight, ArrowUpRight, Filter, CheckCircle,
  XCircle, Video, RefreshCw, Clock,
} from 'lucide-react';
import { getTelegramExchanges, getBots } from '@services/admin.service';
import { formatBRL, formatDateTime, formatNumber } from '@utils/format';
import Surface from '@components/ui/Surface';
import DataTable from '@components/ui/DataTable';
import StatusBadge from '@components/ui/StatusBadge';
import Pagination from '@components/ui/Pagination';
import Spinner from '@components/ui/Spinner';
import ActionButton from '@components/ui/ActionButton';

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

const STATUS_MAP = { completed: 'active', pending: 'pending', cancelled: 'error', rejected: 'error', approved: 'active' };
const STATUS_LABELS = { completed: 'Concluída', pending: 'Pendente', cancelled: 'Cancelada', rejected: 'Rejeitada', approved: 'Aprovada' };

export default function TelegramExchangesPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [botId, setBotId] = useState('');

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin', 'telegram', 'exchanges', page, statusFilter, botId],
    queryFn: () => getTelegramExchanges({ page, status: statusFilter || undefined, botId: botId || undefined }),
  });

  const { data: botsData } = useQuery({ queryKey: ['admin', 'bots'], queryFn: getBots });
  const bots = Array.isArray(botsData?.bots) ? botsData.bots : Array.isArray(botsData) ? botsData : [];

  const exchanges = data?.exchanges || [];
  const pending = exchanges.filter((e) => e.status === 'pending');
  const approved = exchanges.filter((e) => e.status === 'completed' || e.status === 'approved');
  const rejected = exchanges.filter((e) => e.status === 'rejected' || e.status === 'cancelled');
  const totalValue = approved.reduce((s, e) => s + (e.amount || 0), 0);

  const columns = [
    {
      key: '_id', label: '#', render: (v, row) => (
        <span className="text-[12px] font-mono text-[var(--mb-accent-300)]">#{row.exchange_number || v?.slice(-5)}</span>
      ),
    },
    {
      key: 'username', label: 'Solicitante', render: (v, row) => (
        <div>
          <span className="text-[13px] font-medium text-[var(--mb-text-primary)]">{v ? `@${v}` : `tg_${row.telegramId || row._id?.slice(-8)}`}</span>
          {row.telegramId && <p className="text-[11px] text-[var(--mb-text-caption)]">TG {row.telegramId}</p>}
        </div>
      ),
    },
    { key: 'bot_name', label: 'Bot', render: (v) => v || '—' },
    {
      key: 'amount', label: 'Valor', render: (v) => (
        <span className="text-[14px] font-semibold text-[var(--mb-success)]">{formatBRL(v || 0)}</span>
      ),
    },
    {
      key: 'video_url', label: 'Evidência', render: (v) => v ? (
        <div className="w-10 h-10 bg-[var(--mb-surface-900)] border border-[var(--mb-border-soft)] flex items-center justify-center">
          <Video className="w-4 h-4 text-[var(--mb-accent-300)]" />
        </div>
      ) : <span className="text-[11px] text-[var(--mb-text-caption)]">Sem vídeo</span>,
    },
    {
      key: 'status', label: 'Status', render: (v) => (
        <StatusBadge status={STATUS_MAP[v] || 'info'} label={STATUS_LABELS[v] || v} />
      ),
    },
    {
      key: 'createdAt', label: 'Data', render: (v) => (
        <span className="text-[12px] text-[var(--mb-text-muted)]">{formatDateTime(v)}</span>
      ),
    },
    {
      key: '_actions', label: '', render: (_, row) => row.status === 'pending' ? (
        <div className="flex gap-1">
          <ActionButton variant="accent" size="sm"><CheckCircle className="w-3.5 h-3.5" /></ActionButton>
          <ActionButton variant="danger" size="sm"><XCircle className="w-3.5 h-3.5" /></ActionButton>
        </div>
      ) : null,
    },
  ];

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ArrowLeftRight className="w-4 h-4 text-[var(--mb-accent-300)]" />
            <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--mb-accent-300)]">Exchange Review</span>
            <StatusBadge status="active" label="evidências em vídeo" />
          </div>
          <h1 className="text-xl font-bold text-[var(--mb-text-primary)]">Trocas Telegram</h1>
          <p className="text-[13px] text-[var(--mb-text-caption)] mt-0.5">Revise vídeos, confira a compra vinculada e conclua cada solicitação com segurança.</p>
        </div>
        <ActionButton variant="ghost" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`w-4 h-4 mr-1 ${isFetching ? 'animate-spin' : ''}`} />Atualizar
        </ActionButton>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <KpiGroup icon={Clock} title="Solicitações" items={[
          { label: 'Nesta Página', value: formatNumber(exchanges.length), subtitle: 'Itens no recorte atual' },
          { label: 'Pendentes', value: formatNumber(data?.totalPending || pending.length), subtitle: 'Aguardando revisão' },
        ]} />
        <KpiGroup icon={CheckCircle} title="Aprovações" accent="var(--mb-success)" items={[
          { label: 'Concluídas', value: formatNumber(data?.totalApproved || approved.length), subtitle: formatBRL(totalValue) + ' estornados', color: 'var(--mb-success)' },
          { label: 'Valor Analisado', value: formatBRL(data?.totalValue || totalValue), subtitle: 'Compras vinculadas', color: 'var(--mb-success)' },
        ]} />
        <KpiGroup icon={XCircle} title="Recusas" accent="var(--mb-error)" items={[
          { label: 'Rejeitadas', value: formatNumber(data?.totalRejected || rejected.length), subtitle: 'Fora dos critérios', color: 'var(--mb-error)' },
          { label: '', value: '', subtitle: '' },
        ]} />
      </div>

      {/* Filter */}
      <Surface className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <Filter className="w-4 h-4 text-[var(--mb-accent-300)]" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--mb-accent-300)]">Consulta Operacional</span>
        </div>
        <h3 className="text-[14px] font-semibold text-[var(--mb-text-primary)] mb-3">Refine a fila de trocas</h3>
        <div className="flex items-center gap-3">
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--mb-text-caption)]">Status Atual</span>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="block mt-1 px-3 py-2 text-[13px] font-medium text-[var(--mb-text-primary)] bg-[var(--mb-surface-900)] border border-[var(--mb-border-soft)] outline-none min-w-[180px]"
            >
              <option value="pending">Pendentes</option>
              <option value="completed">Concluídas</option>
              <option value="rejected">Rejeitadas</option>
              <option value="">Todas</option>
            </select>
          </div>
        </div>
      </Surface>

      {/* Table */}
      <div>
        <div className="mb-3">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--mb-accent-300)]">Ledger de Revisão</span>
          <h3 className="text-[14px] font-semibold text-[var(--mb-text-primary)]">Solicitações de troca</h3>
          <p className="text-[12px] text-[var(--mb-text-caption)]">Analise o vídeo e registre a decisão sem sair do contexto.</p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20"><Spinner size="lg" /></div>
        ) : (
          <>
            <DataTable columns={columns} data={exchanges} emptyTitle="Fila Concluída" emptyDescription="Nenhuma troca encontrada" />
            <div className="mt-4">
              <Pagination page={page} totalPages={data?.totalPages || 1} onPageChange={setPage} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
