import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Zap, ArrowUpRight, CheckCircle, XCircle, RefreshCw,
  ChevronDown, Filter, Bitcoin,
} from 'lucide-react';
import { getCryptoPayments, getBots } from '@services/admin.service';
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
            {item.subtitle && <p className="text-[10px] text-[var(--mb-text-caption)]">{item.subtitle}</p>}
          </div>
        ))}
      </div>
    </Surface>
  );
}

const STATUS_MAP = { pending: 'pending', waiting: 'pending', completed: 'active', confirmed: 'active', expired: 'error', cancelled: 'error' };
const STATUS_LABELS = { pending: 'Aguardando', waiting: 'Aguardando', completed: 'Verificado', confirmed: 'Verificado', expired: 'Expirado', cancelled: 'Cancelado' };

export default function CryptoPaymentsPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [botId, setBotId] = useState('');
  const [perPage, setPerPage] = useState(10);
  const [showFilters, setShowFilters] = useState(false);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin', 'crypto-payments', page, status, botId, perPage],
    queryFn: () => getCryptoPayments({ page, status: status || undefined, botId: botId || undefined, limit: perPage }),
  });

  const { data: botsData } = useQuery({ queryKey: ['admin', 'bots'], queryFn: getBots });
  const bots = Array.isArray(botsData?.bots) ? botsData.bots : Array.isArray(botsData) ? botsData : [];

  const payments = data?.payments || data?.data || [];
  const totalPayments = data?.total || data?.totalPayments || payments.length;
  const pending = data?.pending || payments.filter((p) => p.status === 'pending' || p.status === 'waiting').length;
  const verified = data?.verified || payments.filter((p) => p.status === 'completed' || p.status === 'confirmed').length;
  const verifiedValue = data?.verifiedValue || payments.filter((p) => p.status === 'completed' || p.status === 'confirmed').reduce((s, p) => s + (p.amount || 0), 0);
  const expiredValue = data?.expiredValue || payments.filter((p) => p.status === 'expired').reduce((s, p) => s + (p.amount || 0), 0);

  const columns = [
    {
      key: '_id', label: 'ID', render: (v, row) => (
        <span className="text-[12px] font-mono text-[var(--mb-accent-300)]">#{row.payment_number || row.number || v?.slice(-4)}</span>
      ),
    },
    {
      key: 'userId', label: 'Usuário', render: (v, row) => (
        <div>
          <span className="text-[13px] font-medium text-[var(--mb-text-primary)]">{row.telegramId || v || '—'}</span>
          {row.username && <p className="text-[11px] text-[var(--mb-text-caption)]">@{row.username}</p>}
        </div>
      ),
    },
    {
      key: 'bot_name', label: 'Bot', render: (v) => (
        <span className="text-[12px] text-[var(--mb-text-muted)]">● {v || 'CCFullStore'}</span>
      ),
    },
    {
      key: 'txn_id', label: 'TXN ID', render: (v) => (
        <span className="text-[11px] font-mono text-[var(--mb-text-caption)] max-w-[180px] truncate block">
          {v || '—'}
        </span>
      ),
    },
    {
      key: 'amount', label: 'Valor', render: (v) => (
        <span className="text-[14px] font-semibold text-[var(--mb-success)]">{formatBRL(v || 0)}</span>
      ),
    },
    {
      key: 'currency', label: 'Moeda', render: (v) => (
        <span className="text-[12px] font-semibold text-[var(--mb-text-primary)]">{v || 'BTC'}</span>
      ),
    },
    {
      key: 'status', label: 'Status', render: (v) => (
        <StatusBadge status={STATUS_MAP[v] || 'info'} label={STATUS_LABELS[v] || v} />
      ),
    },
    {
      key: 'lifecycle', label: 'Ciclo', render: (_, row) => (
        <div className="text-[11px] space-y-0.5">
          {row.createdAt && (
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--mb-accent-300)]" />
              <span className="text-[var(--mb-text-caption)]">Criado</span>
              <span className="text-[var(--mb-text-muted)] ml-auto">{formatDateTime(row.createdAt)}</span>
            </div>
          )}
          {row.expiresAt && (
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--mb-error)]" />
              <span className="text-[var(--mb-text-caption)]">Expira</span>
              <span className="text-[var(--mb-text-muted)] ml-auto">{formatDateTime(row.expiresAt)}</span>
            </div>
          )}
          {row.verifiedAt ? (
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--mb-success)]" />
              <span className="text-[var(--mb-text-caption)]">Verificado</span>
              <span className="text-[var(--mb-text-muted)] ml-auto">{formatDateTime(row.verifiedAt)}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--mb-text-caption)]" />
              <span className="text-[var(--mb-text-caption)]">Verificado</span>
              <span className="text-[var(--mb-text-muted)] ml-auto">Ainda não</span>
            </div>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Zap className="w-4 h-4 text-[var(--mb-accent-300)]" />
            <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--mb-accent-300)]">Ledger Financeiro</span>
            <StatusBadge status="active" label="monitoramento em tempo real" />
          </div>
          <h1 className="text-2xl font-bold text-[var(--mb-text-primary)]">
            <span className="text-[var(--mb-accent-300)]">Pagamentos</span> cripto
          </h1>
          <p className="text-[13px] text-[var(--mb-text-caption)] mt-0.5 max-w-xl">
            Acompanhe a geração, confirmação e expiração das recargas em criptomoedas vinculadas aos seus bots.
          </p>
        </div>
        <ActionButton variant="ghost" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`w-4 h-4 mr-1 ${isFetching ? 'animate-spin' : ''}`} />Atualizar
        </ActionButton>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <KpiGroup icon={Bitcoin} title="Movimentação Cripto" items={[
          { label: 'Pagamentos', value: formatNumber(totalPayments), subtitle: 'registros monitorados' },
          { label: 'Aguardando', value: formatNumber(pending), subtitle: 'pendentes de confirmação' },
        ]} />
        <KpiGroup icon={CheckCircle} title="Confirmados" accent="var(--mb-success)" items={[
          { label: 'Verificados', value: formatNumber(verified), color: 'var(--mb-success)' },
          { label: 'Valor', value: formatBRL(verifiedValue), color: 'var(--mb-success)' },
        ]} />
        <KpiGroup icon={XCircle} title="Não Concluídos" accent="var(--mb-error)" items={[
          { label: 'Valor Expirado ou Devolvido', value: formatBRL(expiredValue), subtitle: 'transações fora do fluxo ativo', color: 'var(--mb-error)' },
          { label: '', value: '' },
        ]} />
      </div>

      {/* Filters */}
      <Surface className="p-4 cursor-pointer" onClick={() => setShowFilters(!showFilters)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-[var(--mb-accent-300)]" />
            <div>
              <h3 className="text-[14px] font-semibold text-[var(--mb-text-primary)]">Filtros de pagamentos cripto</h3>
              <p className="text-[12px] text-[var(--mb-text-caption)]">Status, usuário, transação, valor e período.</p>
            </div>
          </div>
          <ChevronDown className={`w-5 h-5 text-[var(--mb-text-caption)] transition-transform ${showFilters ? 'rotate-180' : ''}`} />
        </div>
        {showFilters && (
          <div className="mt-3 flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--mb-text-caption)]">Status</span>
              <select
                value={status}
                onChange={(e) => { setStatus(e.target.value); setPage(1); }}
                className="block mt-1 px-3 py-2 text-[13px] text-[var(--mb-text-primary)] bg-[var(--mb-surface-900)] border border-[var(--mb-border-soft)] outline-none min-w-[160px]"
              >
                <option value="">Todos</option>
                <option value="pending">Aguardando</option>
                <option value="completed">Verificado</option>
                <option value="expired">Expirado</option>
              </select>
            </div>
          </div>
        )}
      </Surface>

      {/* Table */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--mb-accent-300)]">Ledger Cripto</span>
            <h3 className="text-[14px] font-semibold text-[var(--mb-text-primary)]">Histórico de pagamentos cripto</h3>
            <p className="text-[12px] text-[var(--mb-text-caption)]">Consulte o cliente, a transação e o ciclo completo de cada cobrança.</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[var(--mb-text-caption)]">Itens por página</span>
            <select
              value={perPage}
              onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}
              className="px-2 py-1 text-[12px] text-[var(--mb-text-primary)] bg-[var(--mb-surface-900)] border border-[var(--mb-border-soft)] outline-none"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
            <StatusBadge status="active" label="dados sincronizados" />
            <span className="text-[12px] text-[var(--mb-text-muted)]">
              {page * perPage - perPage + 1}–{Math.min(page * perPage, totalPayments)} de {formatNumber(totalPayments)}
            </span>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20"><Spinner size="lg" /></div>
        ) : (
          <>
            <DataTable columns={columns} data={payments} emptyTitle="Nenhum pagamento" emptyDescription="Nenhum pagamento cripto encontrado." />
            <div className="mt-4">
              <Pagination page={page} totalPages={data?.totalPages || Math.ceil(totalPayments / perPage) || 1} onPageChange={setPage} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
