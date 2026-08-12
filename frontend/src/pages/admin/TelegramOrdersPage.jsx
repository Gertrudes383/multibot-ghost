import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ShoppingCart, DollarSign, RefreshCw, Search, Filter, ArrowUpRight,
  CreditCard, Undo2,
} from 'lucide-react';
import { getTelegramOrders, getBots } from '@services/admin.service';
import { formatBRL, formatDateTime, formatNumber } from '@utils/format';
import Surface from '@components/ui/Surface';
import DataTable from '@components/ui/DataTable';
import StatusBadge from '@components/ui/StatusBadge';
import Pagination from '@components/ui/Pagination';
import Spinner from '@components/ui/Spinner';
import ActionButton from '@components/ui/ActionButton';

const STATUS_MAP = { completed: 'active', pending: 'pending', cancelled: 'error', refunded: 'info', failed: 'error' };
const STATUS_LABELS = { completed: 'Concluído', pending: 'Pendente', cancelled: 'Cancelado', refunded: 'Reembolsado', failed: 'Falhou' };

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

export default function TelegramOrdersPage() {
  const [page, setPage] = useState(1);
  const [botId, setBotId] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin', 'telegram', 'orders', page, botId, statusFilter],
    queryFn: () => getTelegramOrders({ page, botId: botId || undefined, status: statusFilter || undefined }),
  });

  const { data: botsData } = useQuery({
    queryKey: ['admin', 'bots'],
    queryFn: getBots,
  });

  const bots = Array.isArray(botsData?.bots) ? botsData.bots : Array.isArray(botsData) ? botsData : [];
  const orders = data?.orders || [];

  const totalRevenue = orders.reduce((s, o) => s + (o.status === 'completed' ? (o.total || o.price || 0) : 0), 0);
  const totalRefunds = orders.filter((o) => o.status === 'refunded').length;
  const refundValue = orders.reduce((s, o) => s + (o.status === 'refunded' ? (o.total || o.price || 0) : 0), 0);
  const todayOrders = orders.filter((o) => {
    const d = new Date(o.createdAt);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  });

  const columns = [
    {
      key: 'order_number', label: 'Pedido', render: (v, row) => (
        <div>
          <span className="font-mono text-[12px] text-[var(--mb-accent-300)]">#{v || row._id?.slice(-6)}</span>
          {row.status === 'refunded' && <StatusBadge status="info" label="REEMBOLSADO" />}
        </div>
      ),
    },
    {
      key: 'username', label: 'Cliente', render: (v, row) => (
        <div>
          <span className="text-[13px] text-[var(--mb-text-primary)]">@{v || 'anônimo'}</span>
          {row.telegram_id && <p className="text-[11px] text-[var(--mb-text-caption)]">tg_{row.telegram_id}</p>}
        </div>
      ),
    },
    { key: 'bot_name', label: 'Bot', render: (v) => <span className="text-[12px]">{v || '—'}</span> },
    {
      key: 'total', label: 'Valor', render: (v, row) => (
        <span className="font-medium text-[var(--mb-success)]">{formatBRL(v || row.price || 0)}</span>
      ),
    },
    {
      key: 'product', label: 'Produto', render: (v, row) => (
        <div>
          <span className="text-[12px]">{row.purchase_type || v || 'Unitária'}</span>
          {row.card_type && <p className="text-[11px] text-[var(--mb-text-caption)]">{row.card_type}</p>}
        </div>
      ),
    },
    {
      key: 'bin', label: 'Cartão', render: (v, row) => {
        const card = row.card || {};
        return v || card.bin ? (
          <span className="font-mono text-[11px] text-[var(--mb-text-muted)]">{v || card.bin}...</span>
        ) : '—';
      },
    },
    {
      key: 'bank', label: 'Banco / BIN', render: (v, row) => {
        const card = row.card || {};
        return (
          <div>
            <span className="text-[12px]">{card.bank || v || '—'}</span>
            {(card.bin || row.bin) && <p className="text-[11px] text-[var(--mb-accent-300)] font-mono">{card.bin || row.bin}</p>}
          </div>
        );
      },
    },
    { key: 'status', label: 'Status', render: (v) => <StatusBadge status={STATUS_MAP[v] || 'info'} label={STATUS_LABELS[v] || v} /> },
    { key: 'createdAt', label: 'Realizado em', render: (v) => <span className="text-[12px] text-[var(--mb-text-muted)]">{formatDateTime(v)}</span> },
  ];

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShoppingCart className="w-4 h-4 text-[var(--mb-accent-300)]" />
            <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--mb-accent-300)]">Commerce Intelligence</span>
            <StatusBadge status="active" label="em tempo real" />
          </div>
          <h1 className="text-xl font-bold text-[var(--mb-text-primary)]">Pedidos Telegram</h1>
          <p className="text-[13px] text-[var(--mb-text-caption)] mt-0.5">Uma visão precisa de cada venda, entrega e reembolso realizado pelos seus bots.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--mb-text-caption)]">Contexto do Bot</span>
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
            <RefreshCw className={`w-4 h-4 mr-1 ${isFetching ? 'animate-spin' : ''}`} />Sincronizar
          </ActionButton>
        </div>
      </div>

      {/* KPI Groups */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <KpiGroup
          icon={DollarSign}
          title="Receita"
          accent="var(--mb-success)"
          items={[
            { label: 'Líquida', value: formatBRL(totalRevenue - refundValue), subtitle: 'Após reembolsos', color: 'var(--mb-success)' },
            { label: 'Hoje', value: formatBRL(todayOrders.reduce((s, o) => s + (o.total || o.price || 0), 0)), subtitle: 'Movimentação diária', color: 'var(--mb-success)' },
          ]}
        />
        <KpiGroup
          icon={ShoppingCart}
          title="Pedidos"
          items={[
            { label: 'Total', value: formatNumber(data?.total || orders.length), subtitle: 'No recorte atual' },
            { label: 'Hoje', value: formatNumber(todayOrders.length), subtitle: 'Novas compras' },
          ]}
        />
        <KpiGroup
          icon={Undo2}
          title="Reembolsos"
          accent="var(--mb-error)"
          items={[
            { label: 'Pedidos', value: formatNumber(totalRefunds), subtitle: 'Pedidos estornados', color: 'var(--mb-error)' },
            { label: 'Valor Devolvido', value: formatBRL(refundValue), subtitle: 'Total reembolsado', color: 'var(--mb-error)' },
          ]}
        />
      </div>

      {/* Smart Search */}
      <Surface className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <Search className="w-4 h-4 text-[var(--mb-accent-300)]" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--mb-accent-300)]">Consulta Inteligente</span>
        </div>
        <h3 className="text-[14px] font-semibold text-[var(--mb-text-primary)] mb-3">Encontre qualquer pedido</h3>
        <div className="flex gap-2">
          <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-[var(--mb-surface-900)] border border-[var(--mb-border-soft)]">
            <CreditCard className="w-4 h-4 text-[var(--mb-text-caption)]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Número, BIN ou linha completa — inclusive dentro de Lotes Mix"
              className="flex-1 bg-transparent text-[13px] text-[var(--mb-text-primary)] outline-none placeholder:text-[var(--mb-text-caption)]"
            />
          </div>
          <ActionButton variant="accent" onClick={() => refetch()}>
            <Search className="w-4 h-4 mr-1" />Pesquisar
          </ActionButton>
          <ActionButton variant="ghost" onClick={() => setShowFilters(!showFilters)}>
            <Filter className="w-4 h-4 mr-1" />Filtros
          </ActionButton>
        </div>

        {showFilters && (
          <div className="grid grid-cols-2 gap-4 mt-4 lg:grid-cols-4">
            <div>
              <label className="block text-[11px] font-medium text-[var(--mb-text-caption)] mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                className="w-full px-3 py-2 text-[12px] text-[var(--mb-text-primary)] bg-[var(--mb-surface-900)] border border-[var(--mb-border-soft)] outline-none"
              >
                <option value="">Todos</option>
                <option value="completed">Concluído</option>
                <option value="pending">Pendente</option>
                <option value="refunded">Reembolsado</option>
                <option value="cancelled">Cancelado</option>
              </select>
            </div>
          </div>
        )}
      </Surface>

      {/* Orders Table */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--mb-accent-300)]">Ledger de Vendas</span>
            </div>
            <h3 className="text-[14px] font-semibold text-[var(--mb-text-primary)]">Histórico de pedidos</h3>
            <p className="text-[12px] text-[var(--mb-text-caption)]">Selecione uma linha para inspecionar a entrega e as ações do pedido.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 bg-[var(--mb-success)] rounded-full" />
              <span className="text-[11px] text-[var(--mb-text-caption)]">dados sincronizados</span>
            </div>
            <span className="text-[12px] text-[var(--mb-text-muted)]">
              Página {page} / {data?.totalPages || 1}
            </span>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20"><Spinner size="lg" /></div>
        ) : (
          <>
            <DataTable columns={columns} data={orders} emptyTitle="Nenhum pedido encontrado" emptyDescription="Ajuste os filtros ou aguarde novas compras" />
            <div className="mt-4">
              <Pagination page={page} totalPages={data?.totalPages || 1} onPageChange={setPage} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
