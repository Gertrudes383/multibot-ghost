import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Wallet, RefreshCw, ArrowUpRight, Check, ChevronDown, Filter,
} from 'lucide-react';
import { getTelegramRecharges, getBots } from '@services/admin.service';
import { formatBRL, formatDateTime, formatNumber } from '@utils/format';
import { toast } from '@stores/toastStore';
import Surface from '@components/ui/Surface';
import DataTable from '@components/ui/DataTable';
import StatusBadge from '@components/ui/StatusBadge';
import Pagination from '@components/ui/Pagination';
import Spinner from '@components/ui/Spinner';
import ActionButton from '@components/ui/ActionButton';

const STATUS_MAP = { confirmed: 'active', pending: 'pending', expired: 'error', cancelled: 'inactive', approved: 'active' };
const STATUS_LABELS = { confirmed: 'Confirmado', pending: 'Pendente', expired: 'Expirado', cancelled: 'Cancelado', approved: 'Aprovado' };

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

export default function TelegramRechargesPage() {
  const [page, setPage] = useState(1);
  const [botId, setBotId] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [autoUpdate, setAutoUpdate] = useState(false);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin', 'telegram', 'recharges', page, botId],
    queryFn: () => getTelegramRecharges({ page, botId: botId || undefined }),
    refetchInterval: autoUpdate ? 30000 : false,
  });

  const { data: botsData } = useQuery({
    queryKey: ['admin', 'bots'],
    queryFn: getBots,
  });

  const bots = Array.isArray(botsData?.bots) ? botsData.bots : Array.isArray(botsData) ? botsData : [];
  const recharges = data?.recharges || [];

  const totalConfirmed = recharges.filter((r) => r.status === 'confirmed' || r.status === 'approved');
  const totalVolume = totalConfirmed.reduce((s, r) => s + (r.amount || 0), 0);

  const columns = [
    {
      key: '_id', label: 'Recarga', render: (v, row) => (
        <div>
          <span className="font-mono text-[12px] text-[var(--mb-accent-300)]">#{row.recharge_number || v?.slice(-4)}</span>
          {row.method && <span className="ml-1 text-[10px] text-[var(--mb-text-caption)]">{row.method === 'pix' ? '🏦 PIX' : '₿ Cripto'}</span>}
        </div>
      ),
    },
    {
      key: 'username', label: 'Usuário', render: (v, row) => (
        <div>
          <span className="text-[13px] text-[var(--mb-text-primary)]">@{v || 'anônimo'}</span>
          {row.telegram_id && <p className="text-[11px] text-[var(--mb-text-caption)]">ID interno: {row._id?.slice(-5)}</p>}
        </div>
      ),
    },
    { key: 'bot_name', label: 'Bot', render: (v) => v || '—' },
    {
      key: 'amount', label: 'Financeiro', render: (v, row) => (
        <div>
          <span className="text-[14px] font-semibold text-[var(--mb-success)]">{formatBRL(v)}</span>
          {row.bonus && <p className="text-[11px] text-[var(--mb-text-caption)]">Bônus: {formatBRL(row.bonus)}</p>}
        </div>
      ),
    },
    {
      key: 'txn_id', label: 'Referência', render: (v, row) => (
        <div>
          {v && <p className="text-[11px] text-[var(--mb-text-caption)] font-mono">{v.length > 20 ? v.slice(0, 20) + '...' : v}</p>}
        </div>
      ),
    },
    { key: 'status', label: 'Status', render: (v) => <StatusBadge status={STATUS_MAP[v] || 'info'} label={STATUS_LABELS[v] || v} /> },
    {
      key: 'createdAt', label: 'Ciclo', render: (v, row) => (
        <div className="text-[11px] text-[var(--mb-text-caption)] space-y-0.5">
          <div>● Criado: {formatDateTime(v)}</div>
          {row.expiresAt && <div>● Expira: {formatDateTime(row.expiresAt)}</div>}
          {row.confirmedAt && <div>● Verificado: {formatDateTime(row.confirmedAt)}</div>}
        </div>
      ),
    },
    {
      key: '_actions', label: 'Ação', render: (_, row) => row.status === 'pending' ? (
        <ActionButton variant="accent" size="sm">
          <Check className="w-3.5 h-3.5 mr-1" />Aprovar
        </ActionButton>
      ) : null,
    },
  ];

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Wallet className="w-4 h-4 text-[var(--mb-accent-300)]" />
            <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--mb-accent-300)]">Operação Financeira</span>
          </div>
          <h1 className="text-xl font-bold text-[var(--mb-text-primary)]">Recargas Telegram</h1>
          <p className="text-[13px] text-[var(--mb-text-caption)] mt-0.5">Visibilidade completa sobre entradas PIX e Cripto, bônus creditados e aprovações da operação.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--mb-text-caption)]">Escopo do Relatório</span>
            <select
              value={botId}
              onChange={(e) => { setBotId(e.target.value); setPage(1); }}
              className="block mt-1 px-3 py-1.5 text-[12px] text-[var(--mb-text-primary)] bg-[var(--mb-surface-900)] border border-[var(--mb-border-soft)] outline-none min-w-[200px]"
            >
              <option value="">Todos os bots</option>
              {bots.map((b) => (
                <option key={b._id} value={b._id}>{b.name || b.bot_name} (@{b.username || b.bot_username})</option>
              ))}
            </select>
          </div>
          <ActionButton variant="ghost" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`w-4 h-4 mr-1 ${isFetching ? 'animate-spin' : ''}`} />Atualizar dados
          </ActionButton>
        </div>
      </div>

      {/* KPI Groups */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <KpiGroup icon={Wallet} title="Volume Confirmado" accent="var(--mb-success)" items={[
          { label: 'Total', value: formatBRL(data?.totalVolume || totalVolume), subtitle: `${formatNumber(totalConfirmed.length)} transações verificadas`, color: 'var(--mb-success)' },
          { label: 'Hoje', value: formatBRL(data?.todayVolume || 0), subtitle: 'Confirmado desde 00:00', color: 'var(--mb-success)' },
        ]} />
        <KpiGroup icon={Check} title="Recargas Aprovadas" items={[
          { label: 'Total', value: formatNumber(data?.totalApproved || totalConfirmed.length), subtitle: 'Operações concluídas' },
          { label: 'Hoje', value: formatNumber(data?.todayApproved || 0), subtitle: 'Aprovações no dia' },
        ]} />
      </div>

      {/* Filters */}
      <div className="flex items-center justify-between">
        <Surface as="button" onClick={() => setShowFilters(!showFilters)} className="flex items-center gap-2 px-4 py-3 flex-1 mr-4 cursor-pointer hover:bg-[rgba(53,197,255,0.04)]">
          <Filter className="w-4 h-4 text-[var(--mb-accent-300)]" />
          <div className="text-left">
            <span className="text-[13px] font-medium text-[var(--mb-text-primary)]">Filtros de recargas</span>
            <p className="text-[11px] text-[var(--mb-text-caption)]">Usuário, status, período e faixa de valor</p>
          </div>
          <ChevronDown className={`w-4 h-4 text-[var(--mb-text-caption)] ml-auto transition-transform ${showFilters ? 'rotate-180' : ''}`} />
        </Surface>
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-[var(--mb-text-caption)]">Atualização automática</span>
          <button
            onClick={() => setAutoUpdate(!autoUpdate)}
            className={`relative w-11 h-6 transition-colors ${autoUpdate ? 'bg-[var(--mb-success)]' : 'bg-[rgba(143,209,255,0.15)]'}`}
          >
            <span className={`absolute top-0.5 w-5 h-5 bg-white transition-transform ${autoUpdate ? 'left-[22px]' : 'left-0.5'}`} />
          </button>
        </div>
      </div>

      {/* Recharges Table */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--mb-accent-300)]">Histórico Consolidado</span>
            <h3 className="text-[14px] font-semibold text-[var(--mb-text-primary)]">Movimentações de recarga</h3>
            <p className="text-[12px] text-[var(--mb-text-caption)]">PIX e Cripto reunidos em uma visão financeira única.</p>
          </div>
          <span className="text-[12px] text-[var(--mb-text-muted)]">{data?.total || recharges.length} nesta página</span>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20"><Spinner size="lg" /></div>
        ) : (
          <>
            <DataTable columns={columns} data={recharges} emptyTitle="Nenhuma recarga encontrada" />
            <div className="mt-4">
              <Pagination page={page} totalPages={data?.totalPages || 1} onPageChange={setPage} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
