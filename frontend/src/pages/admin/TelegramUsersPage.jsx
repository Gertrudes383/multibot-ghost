import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Users, Search, RefreshCw, ArrowUpRight, CreditCard,
  TrendingUp, Filter, Download, Upload, Trash2, ExternalLink,
} from 'lucide-react';
import { getTelegramUsers, getBots } from '@services/admin.service';
import { formatBRL, formatDate, formatNumber } from '@utils/format';
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

export default function TelegramUsersPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [botId, setBotId] = useState('');

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin', 'telegram', 'users', { page, search: query, botId }],
    queryFn: () => getTelegramUsers({ page, search: query, botId: botId || undefined }),
  });

  const { data: botsData } = useQuery({
    queryKey: ['admin', 'bots'],
    queryFn: getBots,
  });

  const bots = Array.isArray(botsData?.bots) ? botsData.bots : Array.isArray(botsData) ? botsData : [];
  const users = data?.users || [];

  const columns = [
    {
      key: 'username', label: 'Usuário', render: (v, row) => (
        <div>
          <span className="text-[13px] font-medium text-[var(--mb-text-primary)]">{v ? `@${v}` : `tg_${row.telegramId}`}</span>
          {row.telegramId && <p className="text-[11px] text-[var(--mb-text-caption)]">TG {row.telegramId}{row._id ? ` · ID #${row._id.slice(-5)}` : ''}</p>}
        </div>
      ),
    },
    { key: 'botName', label: 'Bot', render: (v) => v ? <span className="px-2 py-0.5 text-[11px] bg-[rgba(53,197,255,0.08)] text-[var(--mb-text-muted)]">{v}</span> : '—' },
    {
      key: 'balance', label: 'Saldo', render: (v) => (
        <div>
          <span className="text-[14px] font-semibold text-[var(--mb-success)]">{formatBRL(v || 0)}</span>
          <p className="text-[10px] text-[var(--mb-text-caption)]">crédito disponível</p>
        </div>
      ),
    },
    {
      key: 'totalPurchases', label: 'Atividade Comercial', render: (v, row) => (
        <div>
          <span className="text-[13px] font-semibold text-[var(--mb-text-primary)]">{formatNumber(v || 0)} compras</span>
          <p className="text-[11px] text-[var(--mb-text-caption)]">{formatNumber(row.totalRefunds || 0)} reembolsos · {formatBRL(row.totalRefundValue || 0)}</p>
          <p className="text-[11px] text-[var(--mb-text-caption)]">{v > 0 ? `${formatNumber(v)} compras registradas` : 'Sem compras registradas'}</p>
        </div>
      ),
    },
    {
      key: 'totalSpent', label: 'Movimentação', render: (v, row) => (
        <div>
          <span className="text-[14px] font-semibold text-[var(--mb-text-primary)]">{formatBRL(v || 0)}</span>
          <p className="text-[10px] text-[var(--mb-text-caption)]">{formatNumber(row.totalRecharges || 0)} recargas · {formatBRL(row.totalRecharged || 0)}</p>
        </div>
      ),
    },
    {
      key: '_actions', label: '', render: (_, row) => (
        <ActionButton variant="ghost" size="sm">
          <ExternalLink className="w-3.5 h-3.5 mr-1" />Abrir perfil
        </ActionButton>
      ),
    },
  ];

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-4 h-4 text-[var(--mb-accent-300)]" />
            <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--mb-accent-300)]">Customer Intelligence</span>
            <StatusBadge status="active" label="atividade em tempo real" />
          </div>
          <h1 className="text-xl font-bold text-[var(--mb-text-primary)]">Usuários Telegram</h1>
          <p className="text-[13px] text-[var(--mb-text-caption)] mt-0.5">Identidade, atividade, saldo e histórico financeiro de cada cliente, sempre isolados por bot.</p>
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
        <KpiGroup icon={Users} title="Base Telegram" items={[
          { label: 'Usuários', value: formatNumber(data?.total || users.length), subtitle: 'No recorte atual' },
          { label: 'Novos Hoje', value: formatNumber(data?.newToday || 0), subtitle: `${formatNumber(data?.blocked || 0)} bloqueados` },
        ]} />
        <KpiGroup icon={TrendingUp} title="Engajamento" items={[
          { label: 'Ativos em 24h', value: formatNumber(data?.active24h || 0), subtitle: 'Atividade recente' },
          { label: 'Compradores', value: formatNumber(data?.totalBuyers || 0), subtitle: `${data?.total ? ((data.totalBuyers / data.total) * 100).toFixed(1) : 0}% da base` },
        ]} />
        <KpiGroup icon={CreditCard} title="Movimentação" accent="var(--mb-success)" items={[
          { label: 'Saldo', value: formatBRL(data?.totalBalance || 0), subtitle: 'Crédito disponível', color: 'var(--mb-success)' },
          { label: 'Receita', value: formatBRL(data?.totalRevenue || 0), subtitle: 'em recargas', color: 'var(--mb-success)' },
        ]} />
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <ActionButton variant="ghost" size="sm"><Upload className="w-3.5 h-3.5 mr-1" />Importar base</ActionButton>
        <ActionButton variant="ghost" size="sm"><Download className="w-3.5 h-3.5 mr-1" />Exportar base</ActionButton>
        <ActionButton variant="danger" size="sm"><Trash2 className="w-3.5 h-3.5 mr-1" />Excluir base</ActionButton>
      </div>

      {/* Smart Search */}
      <Surface className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <Search className="w-4 h-4 text-[var(--mb-accent-300)]" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--mb-accent-300)]">Consulta Inteligente</span>
        </div>
        <h3 className="text-[14px] font-semibold text-[var(--mb-text-primary)] mb-3">Encontre qualquer usuário</h3>
        <div className="flex gap-2">
          <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-[var(--mb-surface-900)] border border-[var(--mb-border-soft)]">
            <Users className="w-4 h-4 text-[var(--mb-text-caption)]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { setQuery(search); setPage(1); } }}
              placeholder="@usuario, Telegram ID ou identificador interno"
              className="flex-1 bg-transparent text-[13px] text-[var(--mb-text-primary)] outline-none placeholder:text-[var(--mb-text-caption)]"
            />
          </div>
          <ActionButton variant="accent" onClick={() => { setQuery(search); setPage(1); }}>
            <Search className="w-4 h-4 mr-1" />Pesquisar
          </ActionButton>
          <ActionButton variant="ghost">
            <Filter className="w-4 h-4 mr-1" />Filtros
          </ActionButton>
        </div>
      </Surface>

      {/* Users Table */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--mb-accent-300)]">Diretório de Clientes</span>
            <h3 className="text-[14px] font-semibold text-[var(--mb-text-primary)]">Base de usuários</h3>
            <p className="text-[12px] text-[var(--mb-text-caption)]">Identidade, vínculo, movimentação e acesso ao manejo completo.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 bg-[var(--mb-success)] rounded-full" />
              <span className="text-[11px] text-[var(--mb-text-caption)]">dados sincronizados</span>
            </div>
            <span className="text-[12px] text-[var(--mb-text-muted)]">Página {page} / {data?.totalPages || 1}</span>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20"><Spinner size="lg" /></div>
        ) : (
          <>
            <DataTable columns={columns} data={users} emptyTitle="Nenhum usuário encontrado" />
            <div className="mt-4">
              <Pagination page={page} totalPages={data?.totalPages || 1} onPageChange={setPage} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
