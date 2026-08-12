import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ShoppingCart, DollarSign, TrendingUp, Users, Package, CreditCard,
  ChevronRight, ChevronDown, Search, BarChart2, Clock, AlertTriangle,
  RefreshCw, Zap, Tag, TrendingDown, Archive, Eye,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { getDashboardAdvanced } from '@services/admin.service';
import { getBots } from '@services/admin.service';
import StatCard from '@components/ui/StatCard';
import Surface from '@components/ui/Surface';
import DataTable from '@components/ui/DataTable';
import Spinner from '@components/ui/Spinner';
import { formatBRL, formatDate, formatNumber } from '@utils/format';

const PERIODS = [
  { key: 'today', label: 'Hoje', days: 0 },
  { key: '24h', label: '24 horas', days: 1 },
  { key: '48h', label: '48 horas', days: 2 },
  { key: '7d', label: '7 dias', days: 7 },
  { key: '15d', label: '15 dias', days: 15 },
  { key: '30d', label: '30 dias', days: 30 },
  { key: 'custom', label: 'Personalizado', days: null },
];

const chartTooltipStyle = {
  contentStyle: {
    background: 'var(--mb-surface-900)',
    border: '1px solid var(--mb-border-soft)',
    color: 'var(--mb-text-primary)',
    fontSize: '12px',
  },
  labelStyle: { color: 'var(--mb-text-muted)' },
};

const binSearchColumns = [
  { key: 'bin', label: 'BIN', render: (v) => <span className="font-mono text-[12px] text-[var(--mb-accent-300)]">{v}</span> },
  { key: 'count', label: 'Indicador', render: (v, row) => <span className="text-[var(--mb-success)]">{formatNumber(v)}<br /><span className="text-[11px] text-[var(--mb-text-caption)]">pesquisas</span></span> },
];

const binStockColumns = [
  { key: 'bin', label: 'BIN', render: (v) => <span className="font-mono text-[12px] text-[var(--mb-accent-300)]">{v}</span> },
  { key: 'count', label: 'Indicador', render: (v) => <span className="text-[var(--mb-success)]">{formatNumber(v)}<br /><span className="text-[11px] text-[var(--mb-text-caption)]">disponíveis</span></span> },
];

const binSalesColumns = [
  { key: 'bin', label: 'BIN', render: (v) => <span className="font-mono text-[12px] text-[var(--mb-accent-300)]">{v}</span> },
  { key: 'total', label: 'Compras', render: (v) => formatNumber(v) },
  { key: 'revenue', label: 'Receita', render: (v) => <span className="text-[var(--mb-success)]">{formatBRL(v)}</span> },
];

const countryColumns = [
  { key: 'country', label: 'País' },
  { key: 'count', label: 'Estoque', render: (v) => formatNumber(v) },
];

const dailyEvolutionColumns = [
  { key: '_id', label: 'Data' },
  { key: 'count', label: 'Compras', render: (v) => formatNumber(v) },
  { key: 'revenue', label: 'Receita', render: (v) => <span className="text-[var(--mb-success)]">{formatBRL(v)}</span> },
];

function PeriodSelector({ value, onChange }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-1.5 text-[13px] text-[var(--mb-text-muted)]">
        <Clock className="w-4 h-4" />
        <span className="font-medium">Período da análise</span>
      </div>
      <div className="flex gap-0.5">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            onClick={() => onChange(p.key)}
            className={`px-3 py-1.5 text-[12px] font-medium transition-colors ${
              value === p.key
                ? 'bg-[var(--mb-accent-300)] text-[var(--mb-bg-950)]'
                : 'text-[var(--mb-text-muted)] hover:text-[var(--mb-text-primary)] hover:bg-[rgba(53,197,255,0.08)]'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function BotSelector({ bots, value, onChange }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="px-3 py-2 text-[13px] text-[var(--mb-text-primary)] bg-[var(--mb-surface-900)] border border-[var(--mb-border-soft)] outline-none min-w-[220px]"
    >
      <option value="">Todos os bots</option>
      {bots.map((b) => (
        <option key={b._id} value={b._id}>
          {b.name} {b.username ? `(@${b.username})` : ''}
        </option>
      ))}
    </select>
  );
}

function CollapsibleSection({ icon: Icon, title, subtitle, expanded, onToggle, children }) {
  return (
    <div>
      <Surface
        as="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 cursor-pointer hover:bg-[rgba(53,197,255,0.04)] transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <Icon className="w-5 h-5 text-[var(--mb-accent-300)]" />
          <div>
            <h3 className="text-[14px] font-semibold text-[var(--mb-text-primary)]">{title}</h3>
            <p className="text-[12px] text-[var(--mb-text-caption)]">{subtitle}</p>
          </div>
        </div>
        {expanded
          ? <ChevronDown className="w-5 h-5 text-[var(--mb-text-muted)]" />
          : <ChevronRight className="w-5 h-5 text-[var(--mb-text-muted)]" />
        }
      </Surface>
      {expanded && <div className="mt-4 space-y-6">{children}</div>}
    </div>
  );
}

function KpiCard({ icon: Icon, title, value, subtitle, accent = 'var(--mb-accent-300)' }) {
  return (
    <Surface className="p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4" style={{ color: accent }} />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--mb-text-caption)]">{title}</span>
      </div>
      <p className="text-2xl font-bold" style={{ color: accent }}>{value}</p>
      {subtitle && <p className="text-[11px] text-[var(--mb-text-caption)] mt-1">{subtitle}</p>}
    </Surface>
  );
}

export default function DashboardAdvancedPage() {
  const [period, setPeriod] = useState('24h');
  const [botId, setBotId] = useState('');
  const [sections, setSections] = useState({ overview: true, bins: false, operation: false });

  const periodConfig = PERIODS.find((p) => p.key === period);
  const dateRange = useMemo(() => {
    if (!periodConfig || periodConfig.days === null) return '';
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - (periodConfig.days || 0));
    return `${start.toISOString().slice(0, 10)} até ${end.toISOString().slice(0, 10)}`;
  }, [period]);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin', 'dashboard', 'advanced', period, botId],
    queryFn: () => getDashboardAdvanced({ period, botId: botId || undefined }),
  });

  const { data: botsData } = useQuery({
    queryKey: ['admin', 'bots'],
    queryFn: getBots,
  });

  const bots = botsData?.bots || botsData || [];

  const toggleSection = (key) => setSections((s) => ({ ...s, [key]: !s[key] }));

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  const stats = data || {};
  const daily = stats.dailyRevenue || [];
  const topBins = (stats.topBINs || stats.topBins || []).map((b) => ({
    bin: b.bin,
    total: b.count,
    revenue: b.revenue,
    count: b.count,
  }));
  const topCountries = stats.topCountries || [];

  const totalRevenue = stats.totalRevenue || 0;
  const totalOrders = stats.totalOrders || 0;
  const avgOrderValue = stats.avgOrderValue || 0;
  const conversionRate = stats.conversionRate || 0;

  const chartData = daily.map((d) => ({
    date: d._id || d.date,
    revenue: d.revenue || 0,
    orders: d.count || d.orders || 0,
  }));

  const peakDay = chartData.reduce((max, d) => (d.revenue > (max?.revenue || 0) ? d : max), chartData[0]);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Zap className="w-4 h-4 text-[var(--mb-accent-300)]" />
            <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--mb-accent-300)]">Intelligence Center</span>
          </div>
          <h1 className="text-xl font-bold text-[var(--mb-text-primary)]">Dashboard avançado</h1>
          <p className="text-[13px] text-[var(--mb-text-caption)] mt-0.5">
            Relatórios operacionais baseados exclusivamente no período selecionado.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium bg-[var(--mb-success)] text-[var(--mb-bg-950)] hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          Atualizar relatório
        </button>
      </div>

      {/* Period + Bot Selector */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <PeriodSelector value={period} onChange={setPeriod} />
          {dateRange && (
            <p className="text-[11px] text-[var(--mb-text-caption)] mt-2 flex items-center gap-1.5">
              <Clock className="w-3 h-3" />
              {dateRange} {botId ? '• Bot selecionado' : '• Todos os bots'}
            </p>
          )}
        </div>
        <BotSelector bots={Array.isArray(bots) ? bots : []} value={botId} onChange={setBotId} />
      </div>

      {/* 6 KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard icon={ShoppingCart} title="Compras" value={formatNumber(totalOrders)} subtitle={`Local ${formatNumber(totalOrders)} · Remoto 0`} accent="var(--mb-accent-300)" />
        <KpiCard icon={DollarSign} title="Receita Líquida" value={formatBRL(totalRevenue)} subtitle="Após refunds" accent="var(--mb-success)" />
        <KpiCard icon={TrendingUp} title="Recargas" value={formatBRL(stats.rechargeVolume || 0)} subtitle="No período" accent="var(--mb-success)" />
        <KpiCard icon={Users} title="Clientes Novos" value={formatNumber(stats.newCustomers || 0)} subtitle={`${formatNumber(stats.uniqueBuyers || 0)} compradores únicos`} accent="var(--mb-accent-300)" />
        <KpiCard icon={Package} title="Estoque Disponível" value={formatNumber(stats.availableStock || 0)} subtitle={`Local ${formatNumber(stats.availableStock || 0)} · Remoto 0`} accent="var(--mb-success)" />
        <KpiCard icon={CreditCard} title="Cartões Locais Adicionados" value={formatNumber(stats.cardsAdded || 0)} subtitle={`${formatNumber(stats.exchanges || 0)} trocas`} accent="var(--mb-accent-300)" />
      </div>

      {/* 3 Collapsible Sections */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <CollapsibleSection
          icon={BarChart2}
          title="Visão geral"
          subtitle="Receita, operação e evolução diária"
          expanded={sections.overview}
          onToggle={() => toggleSection('overview')}
        />
        <CollapsibleSection
          icon={Search}
          title="Inteligência de BINs"
          subtitle="Demanda, estoque, inatividade e reposição"
          expanded={sections.bins}
          onToggle={() => toggleSection('bins')}
        />
        <CollapsibleSection
          icon={TrendingUp}
          title="Operação"
          subtitle="Lotes, horários e distribuição das vendas"
          expanded={sections.operation}
          onToggle={() => toggleSection('operation')}
        />
      </div>

      {/* Visão Geral Section */}
      {sections.overview && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
            {/* Revenue Chart */}
            <Surface className="p-5">
              <h3 className="text-[14px] font-semibold text-[var(--mb-text-primary)] mb-1">Receita diária</h3>
              <p className="text-[12px] text-[var(--mb-text-caption)] mb-4">Compras e receita líquida no período</p>

              <div className="flex items-center justify-between mb-4">
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--mb-text-caption)]">Receita no período</span>
                  <p className="text-lg font-bold text-[var(--mb-accent-300)]">{formatBRL(totalRevenue)}</p>
                </div>
                <div className="text-right">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--mb-text-caption)]">Pico diário</span>
                  <p className="text-lg font-bold text-[var(--mb-accent-300)]">{formatBRL(peakDay?.revenue || 0)}</p>
                </div>
              </div>

              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--mb-border-soft)" />
                    <XAxis dataKey="date" tick={{ fill: 'var(--mb-text-caption)', fontSize: 11 }} />
                    <YAxis tick={{ fill: 'var(--mb-text-caption)', fontSize: 11 }} />
                    <Tooltip
                      {...chartTooltipStyle}
                      formatter={(value) => formatBRL(value)}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="var(--mb-accent-300)"
                      fill="var(--mb-accent-300)"
                      fillOpacity={0.12}
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Surface>

            {/* Financial Summary */}
            <Surface className="p-5">
              <h3 className="text-[14px] font-semibold text-[var(--mb-text-primary)] mb-1">Resumo financeiro</h3>
              <p className="text-[12px] text-[var(--mb-text-caption)] mb-6">Valores calculados no período selecionado.</p>

              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-[var(--mb-text-muted)]">Receita bruta</span>
                  <span className="text-[14px] font-semibold text-[var(--mb-success)]">{formatBRL(totalRevenue)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-[var(--mb-text-muted)]">Refunds</span>
                  <span className="text-[14px] font-semibold text-[var(--mb-error)]">{formatBRL(stats.refundTotal || 0)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-[var(--mb-text-muted)]">Ticket médio</span>
                  <span className="text-[14px] font-semibold text-[var(--mb-warning)]">{formatBRL(avgOrderValue)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-[var(--mb-text-muted)]">Taxa de refund</span>
                  <span className="text-[14px] font-semibold text-[var(--mb-text-primary)]">
                    {totalRevenue > 0 ? `${(((stats.refundTotal || 0) / totalRevenue) * 100).toFixed(0)}%` : '0%'}
                  </span>
                </div>
              </div>
            </Surface>
          </div>

          {/* Daily Evolution Table */}
          <Surface className="p-5">
            <h3 className="text-[14px] font-semibold text-[var(--mb-text-primary)] mb-1">Evolução diária</h3>
            <p className="text-[12px] text-[var(--mb-text-caption)] mb-4">Linhas sem movimentação são mantidas para não distorcer a leitura.</p>
            <DataTable columns={dailyEvolutionColumns} data={daily} emptyTitle="Sem dados no período" />
          </Surface>
        </div>
      )}

      {/* Inteligência de BINs Section */}
      {sections.bins && (
        <div className="space-y-6">
          {/* BIN KPIs */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <KpiCard icon={Search} title="Pesquisas de BIN" value={formatNumber(stats.binSearches || 0)} subtitle={`${formatNumber(stats.binSearchResults || 0)} resultados encontrados`} />
            <KpiCard icon={Tag} title="Buscas Promocionais" value={formatNumber(stats.promoSearches || 0)} subtitle={`${formatNumber(stats.promoResults || 0)} resultados em promoções`} accent="var(--mb-warning)" />
            <KpiCard icon={ShoppingCart} title="Compras Promocionais" value={formatNumber(stats.promoOrders || 0)} subtitle={`${formatNumber(stats.promoUniqueBuyers || 0)} compradores únicos`} accent="var(--mb-success)" />
            <KpiCard icon={DollarSign} title="Desconto Concedido" value={formatBRL(stats.discountTotal || 0)} subtitle={`${formatBRL(stats.promoRevenue || 0)} em receita promocional`} accent="var(--mb-success)" />
            <KpiCard icon={AlertTriangle} title="BINs Esgotadas" value={formatNumber(stats.exhaustedBins || 0)} subtitle="Sem nenhuma unitária disponível agora" accent="var(--mb-error)" />
          </div>

          {/* BIN Tables - Row 1 */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Search className="w-4 h-4 text-[var(--mb-accent-300)]" />
                <div>
                  <h3 className="text-[14px] font-semibold text-[var(--mb-text-primary)]">BINs mais pesquisadas</h3>
                  <p className="text-[12px] text-[var(--mb-text-caption)]">Catálogo, busca direta e fluxo promocionais</p>
                </div>
              </div>
              <DataTable columns={binSearchColumns} data={topBins.slice(0, 10)} emptyTitle="Sem dados de BIN para este período." />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Tag className="w-4 h-4 text-[var(--mb-warning)]" />
                <div>
                  <h3 className="text-[14px] font-semibold text-[var(--mb-text-primary)]">BINs mais buscadas em promoções</h3>
                  <p className="text-[12px] text-[var(--mb-text-caption)]">Consultas que retornaram pelo fluxo promocional</p>
                </div>
              </div>
              <DataTable columns={binSearchColumns} data={stats.promoBins || []} emptyTitle="Sem dados de BIN para este período." />
            </div>
          </div>

          {/* BIN Tables - Row 2 */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <ShoppingCart className="w-4 h-4 text-[var(--mb-success)]" />
                <div>
                  <h3 className="text-[14px] font-semibold text-[var(--mb-text-primary)]">BINs com mais vendas promocionais</h3>
                  <p className="text-[12px] text-[var(--mb-text-caption)]">Compras concluídas, com receita e desconto efetivamente aplicados.</p>
                </div>
              </div>
              <DataTable columns={binSalesColumns} data={stats.promoSalesBins || []} emptyTitle="Sem dados de BIN para este período." />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-[var(--mb-success)]" />
                <div>
                  <h3 className="text-[14px] font-semibold text-[var(--mb-text-primary)]">Promoções com melhor resultado</h3>
                  <p className="text-[12px] text-[var(--mb-text-caption)]">Comparativo de conversão e receita por promoção.</p>
                </div>
              </div>
              <DataTable
                columns={[
                  { key: 'name', label: 'Promoção', render: (v) => <span className="font-medium">{v}</span> },
                  { key: 'purchases', label: 'Compras', render: (v) => formatNumber(v) },
                  { key: 'revenue', label: 'Receita', render: (v) => <span className="text-[var(--mb-success)]">{formatBRL(v)}</span> },
                  { key: 'discount', label: 'Desconto', render: (v) => <span className="text-[var(--mb-success)]">{formatBRL(v)}</span> },
                ]}
                data={stats.promoPerformance || []}
                emptyTitle="Sem dados de promoção para este período."
              />
            </div>
          </div>

          {/* BIN Tables - Row 3 */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <TrendingDown className="w-4 h-4 text-[var(--mb-text-caption)]" />
                <div>
                  <h3 className="text-[14px] font-semibold text-[var(--mb-text-primary)]">BINs menos pesquisadas</h3>
                  <p className="text-[12px] text-[var(--mb-text-caption)]">Entre as BINs que receberam pesquisa</p>
                </div>
              </div>
              <DataTable columns={binSearchColumns} data={stats.leastSearchedBins || []} emptyTitle="Sem dados de BIN para este período." />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Package className="w-4 h-4 text-[var(--mb-success)]" />
                <div>
                  <h3 className="text-[14px] font-semibold text-[var(--mb-text-primary)]">Maior estoque disponível</h3>
                  <p className="text-[12px] text-[var(--mb-text-caption)]">Estoque unitário disponível no momento.</p>
                </div>
              </div>
              <DataTable columns={binStockColumns} data={topCountries.length > 0 ? topBins : []} emptyTitle="Sem dados de estoque." />
            </div>
          </div>

          {/* BIN Tables - Row 4 */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-[var(--mb-error)]" />
                <div>
                  <h3 className="text-[14px] font-semibold text-[var(--mb-text-primary)]">BINs esgotadas</h3>
                  <p className="text-[12px] text-[var(--mb-text-caption)]">BINs que já tiveram cartões no estoque, mas não possuem nenhuma unitária disponível no momento.</p>
                </div>
              </div>
              <DataTable
                columns={[
                  { key: 'bin', label: 'BIN', render: (v) => <span className="font-mono text-[12px] text-[var(--mb-accent-300)]">{v}</span> },
                  { key: 'count', label: 'Indicador', render: (v) => <span className="text-[var(--mb-success)]">{formatNumber(v)}<br /><span className="text-[11px] text-[var(--mb-text-caption)]">cartões históricos</span></span> },
                ]}
                data={stats.exhaustedBinsList || []}
                emptyTitle="Nenhuma BIN esgotada."
              />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4 text-[var(--mb-warning)]" />
                <div>
                  <h3 className="text-[14px] font-semibold text-[var(--mb-text-primary)]">BINs paradas há mais tempo</h3>
                  <p className="text-[12px] text-[var(--mb-text-caption)]">Sem adição de cartões há pelo menos 7 dias</p>
                </div>
              </div>
              <DataTable columns={binStockColumns} data={stats.staleBins || []} emptyTitle="Nenhuma BIN parada." />
            </div>
          </div>

          {/* Top Countries */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Eye className="w-4 h-4 text-[var(--mb-accent-300)]" />
              <div>
                <h3 className="text-[14px] font-semibold text-[var(--mb-text-primary)]">Top Países por Estoque</h3>
                <p className="text-[12px] text-[var(--mb-text-caption)]">Distribuição de cartões disponíveis por país</p>
              </div>
            </div>
            <DataTable columns={countryColumns} data={topCountries} emptyTitle="Sem dados de país" />
          </div>
        </div>
      )}

      {/* Operação Section */}
      {sections.operation && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Surface className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <Archive className="w-4 h-4 text-[var(--mb-accent-300)]" />
                <div>
                  <h3 className="text-[14px] font-semibold text-[var(--mb-text-primary)]">Distribuição por Lotes</h3>
                  <p className="text-[12px] text-[var(--mb-text-caption)]">Vendas distribuídas por lote de importação</p>
                </div>
              </div>
              <DataTable
                columns={[
                  { key: 'name', label: 'Lote' },
                  { key: 'sold', label: 'Vendidos', render: (v) => formatNumber(v) },
                  { key: 'available', label: 'Disponíveis', render: (v) => formatNumber(v) },
                  { key: 'revenue', label: 'Receita', render: (v) => <span className="text-[var(--mb-success)]">{formatBRL(v)}</span> },
                ]}
                data={stats.batchDistribution || []}
                emptyTitle="Sem dados de lotes."
              />
            </Surface>

            <Surface className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-4 h-4 text-[var(--mb-warning)]" />
                <div>
                  <h3 className="text-[14px] font-semibold text-[var(--mb-text-primary)]">Horários de pico</h3>
                  <p className="text-[12px] text-[var(--mb-text-caption)]">Distribuição de compras por hora do dia</p>
                </div>
              </div>
              <DataTable
                columns={[
                  { key: 'hour', label: 'Horário', render: (v) => `${String(v).padStart(2, '0')}:00` },
                  { key: 'count', label: 'Compras', render: (v) => formatNumber(v) },
                  { key: 'revenue', label: 'Receita', render: (v) => <span className="text-[var(--mb-success)]">{formatBRL(v)}</span> },
                ]}
                data={stats.peakHours || []}
                emptyTitle="Sem dados de horários."
              />
            </Surface>
          </div>
        </div>
      )}
    </div>
  );
}
