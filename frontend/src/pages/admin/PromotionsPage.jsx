import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Zap, Plus, Edit, Trash2, Tag, Eye, ArrowUpRight,
  BarChart3, ShoppingCart, DollarSign, TrendingUp, RefreshCw,
} from 'lucide-react';
import { getPromotions, createPromotion, updatePromotion, deletePromotion } from '@services/admin.service';
import { formatNumber, formatBRL, formatDateTime } from '@utils/format';
import { toast } from '@stores/toastStore';
import Surface from '@components/ui/Surface';
import ActionButton from '@components/ui/ActionButton';
import DataTable from '@components/ui/DataTable';
import Pagination from '@components/ui/Pagination';
import StatusBadge from '@components/ui/StatusBadge';
import Spinner from '@components/ui/Spinner';

function KpiCard({ icon: Icon, title, items, accent = 'var(--mb-accent-300)' }) {
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

const PROMO_TYPES = [
  { key: 'bins', label: 'Por BINs/Bancos' },
  { key: 'validade', label: 'Por Validade' },
  { key: 'niveis', label: 'Por Níveis' },
  { key: 'estoque', label: 'Estoque parado' },
];

const DISCOUNT_TYPES = [
  { value: 'percentual', label: 'Percentual (%)' },
  { value: 'fixo', label: 'Valor fixo (R$)' },
];

export default function PromotionsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState('promos');
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState(null);
  const [promoType, setPromoType] = useState('bins');
  const [form, setForm] = useState({
    name: '', discount_type: 'percentual', discount: '', bins: '',
    banks: '', badge: 'Promoção', bases: 'ambas', startDate: '', endDate: '',
    min_amount: '',
  });

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin', 'promotions', page],
    queryFn: () => getPromotions({ page }),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin', 'promotions'] });

  const saveMut = useMutation({
    mutationFn: (d) => editing ? updatePromotion(editing._id, d) : createPromotion(d),
    onSuccess: () => {
      toast.success(editing ? 'Promoção atualizada' : 'Promoção criada');
      setShowCreate(false); setEditing(null); invalidate();
    },
    onError: (e) => toast.error(e?.data?.message || 'Erro'),
  });

  const delMut = useMutation({
    mutationFn: deletePromotion,
    onSuccess: () => { toast.success('Promoção removida'); invalidate(); },
    onError: (e) => toast.error(e?.data?.message || 'Erro'),
  });

  function openEdit(row) {
    setEditing(row);
    setForm({
      name: row.name || '', discount_type: row.discount_type || 'percentual',
      discount: String(row.discount || ''), bins: row.bins || '',
      banks: row.banks || '', badge: row.badge || 'Promoção',
      bases: row.bases || 'ambas', startDate: row.startDate?.slice(0, 10) || '',
      endDate: row.endDate?.slice(0, 10) || '', min_amount: String(row.min_amount || ''),
    });
    setShowCreate(true);
  }
  function u(field, value) { setForm((f) => ({ ...f, [field]: value })); }

  const promotions = data?.promotions || data?.data || [];
  const totalPromos = data?.total || promotions.length;
  const activePromos = promotions.filter((p) => p.active !== false).length;
  const binPromos = promotions.filter((p) => p.type === 'bins' || p.bins).length;
  const validadePromos = promotions.filter((p) => p.type === 'validade' || p.endDate).length;

  const columns = [
    {
      key: 'name', label: 'Nome', render: (v, row) => (
        <div>
          <span className="text-[13px] font-semibold text-[var(--mb-text-primary)]">{v}</span>
          <p className="text-[11px] text-[var(--mb-text-caption)]">{row.type || row.discount_type || 'BINs/Bancos'}</p>
        </div>
      ),
    },
    {
      key: 'discount', label: 'Desconto', render: (v, row) => (
        <span className="text-[13px] font-semibold text-[var(--mb-success)]">
          {row.discount_type === 'fixo' ? (
            <><DollarSign className="w-3 h-3 inline" /> {formatBRL(v || 0)}</>
          ) : (
            <><TrendingUp className="w-3 h-3 inline" /> {v || 0}%</>
          )}
        </span>
      ),
    },
    {
      key: 'targets', label: 'Alvos', render: (_, row) => (
        <span className="text-[12px] text-[var(--mb-text-muted)]">
          {row.bins ? `${row.bins.split(',').length} BINs` : row.endDate ? `Expira em ${row.endDate?.slice(0, 10)}` : '—'}
        </span>
      ),
    },
    {
      key: 'badge', label: 'Badge', render: (v) => v ? (
        <StatusBadge status="active" label={v} />
      ) : '—',
    },
    {
      key: 'schedule', label: 'Programação', render: (_, row) => (
        <span className="text-[12px] text-[var(--mb-text-muted)]">
          {row.startDate ? `${row.startDate?.slice(0, 10)} → ${row.endDate?.slice(0, 10) || '∞'}` : 'Sempre ativa'}
        </span>
      ),
    },
    {
      key: 'bases', label: 'Bases', render: (v) => (
        <div className="flex gap-1">
          {(!v || v === 'ambas' || v === 'full') && <span className="px-2 py-0.5 text-[10px] font-semibold bg-[var(--mb-surface-900)] border border-[var(--mb-border-soft)] text-[var(--mb-text-muted)]">FULL</span>}
          {(!v || v === 'ambas' || v === 'sem') && <span className="px-2 py-0.5 text-[10px] font-semibold bg-[var(--mb-surface-900)] border border-[var(--mb-border-soft)] text-[var(--mb-text-muted)]">SEM</span>}
        </div>
      ),
    },
    {
      key: 'active', label: 'Status', render: (v) => (
        <StatusBadge status={v !== false ? 'active' : 'inactive'} label={v !== false ? 'Ativa' : 'Inativa'} />
      ),
    },
    {
      key: '_actions', label: 'Ações', render: (_, row) => (
        <div className="flex gap-1">
          <ActionButton variant="ghost" size="sm" onClick={() => openEdit(row)}>
            <Edit className="w-3.5 h-3.5" />
          </ActionButton>
          <ActionButton variant="ghost" size="sm">
            <Eye className="w-3.5 h-3.5" />
          </ActionButton>
          <ActionButton variant="danger" size="sm" onClick={() => { if (confirm('Remover promoção?')) delMut.mutate(row._id); }}>
            <Trash2 className="w-3.5 h-3.5" />
          </ActionButton>
        </div>
      ),
    },
  ];

  const perfColumns = [
    {
      key: 'name', label: 'Promoção', render: (v, row) => (
        <div>
          <span className="text-[13px] font-semibold text-[var(--mb-text-primary)]">{v}</span>
          <p className="text-[11px] text-[var(--mb-text-caption)]">{row.store || 'CCFullStore'}</p>
        </div>
      ),
    },
    { key: 'purchases', label: 'Compras', render: (v) => formatNumber(v || 0) },
    { key: 'clients', label: 'Clientes', render: (v) => formatNumber(v || 0) },
    { key: 'revenue', label: 'Receita', render: (v) => <span className="text-[var(--mb-success)]">{formatBRL(v || 0)}</span> },
    { key: 'discountTotal', label: 'Desconto', render: (v) => formatBRL(v || 0) },
    { key: 'refunds', label: 'Reembolsos', render: (v) => formatNumber(v || 0) },
    { key: 'lastPurchase', label: 'Última Compra', render: (v) => v ? formatDateTime(v) : '—' },
  ];

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Zap className="w-4 h-4 text-[var(--mb-accent-300)]" />
            <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--mb-accent-300)]">Revenue Intelligence</span>
            <StatusBadge status="active" label="regras para todo o tenant" />
          </div>
          <h1 className="text-2xl font-bold text-[var(--mb-text-primary)]">
            <span className="text-[var(--mb-accent-300)]">Promoções</span> com precisão
          </h1>
          <p className="text-[13px] text-[var(--mb-text-caption)] mt-0.5 max-w-xl">
            Crie regras comerciais, acompanhe a elegibilidade e entenda o impacto real de cada promoção nas vendas.
          </p>
        </div>
        <ActionButton variant="accent" onClick={() => { setEditing(null); setForm({ name: '', discount_type: 'percentual', discount: '', bins: '', banks: '', badge: 'Promoção', bases: 'ambas', startDate: '', endDate: '', min_amount: '' }); setShowCreate(true); }}>
          <Plus className="w-4 h-4 mr-1" />Nova Promoção
        </ActionButton>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[var(--mb-border-soft)]">
        <button
          onClick={() => setTab('promos')}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-medium transition-colors ${
            tab === 'promos'
              ? 'text-[var(--mb-text-primary)] border-b-2 border-[var(--mb-accent-300)]'
              : 'text-[var(--mb-text-caption)] hover:text-[var(--mb-text-muted)]'
          }`}
        >
          <Tag className="w-3.5 h-3.5" />Promoções
        </button>
        <button
          onClick={() => setTab('perf')}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-medium transition-colors ${
            tab === 'perf'
              ? 'text-[var(--mb-text-primary)] border-b-2 border-[var(--mb-accent-300)]'
              : 'text-[var(--mb-text-caption)] hover:text-[var(--mb-text-muted)]'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />Compras e desempenho
        </button>
      </div>

      {tab === 'promos' ? (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Surface className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Tag className="w-4 h-4 text-[var(--mb-accent-300)]" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--mb-text-caption)]">Total de Promoções</span>
              </div>
              <p className="text-2xl font-bold text-[var(--mb-text-primary)]">{formatNumber(totalPromos)}</p>
            </Surface>
            <Surface className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Eye className="w-4 h-4 text-[var(--mb-success)]" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--mb-text-caption)]">Promoções Ativas</span>
              </div>
              <p className="text-2xl font-bold text-[var(--mb-text-primary)]">{formatNumber(activePromos)}</p>
            </Surface>
            <Surface className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-4 h-4 text-[var(--mb-accent-300)]" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--mb-text-caption)]">Promoções por BIN</span>
              </div>
              <p className="text-2xl font-bold text-[var(--mb-text-primary)]">{formatNumber(binPromos)}</p>
            </Surface>
            <Surface className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <ShoppingCart className="w-4 h-4 text-[var(--mb-accent-300)]" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--mb-text-caption)]">Por Validade/Nível</span>
              </div>
              <p className="text-2xl font-bold text-[var(--mb-text-primary)]">{formatNumber(validadePromos)}</p>
            </Surface>
          </div>

          {/* Create Form */}
          {showCreate && (
            <Surface className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[16px] font-bold text-[var(--mb-text-primary)]">
                  {editing ? 'Editar Promoção' : 'Criar Nova Promoção'}
                </h3>
                <div className="flex gap-1">
                  {PROMO_TYPES.map((pt) => (
                    <button
                      key={pt.key}
                      onClick={() => setPromoType(pt.key)}
                      className={`px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                        promoType === pt.key
                          ? 'bg-[var(--mb-accent-300)] text-[var(--mb-bg-950)]'
                          : 'text-[var(--mb-text-muted)] border border-[var(--mb-border-soft)]'
                      }`}
                    >
                      {pt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-[12px] font-medium text-[var(--mb-text-muted)] mb-1.5">Nome da Promoção</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => u('name', e.target.value)}
                    placeholder="Promoção por BINs"
                    className="w-full px-3 py-2 text-[13px] text-[var(--mb-text-primary)] bg-[var(--mb-surface-900)] border border-[var(--mb-border-soft)] outline-none placeholder:text-[var(--mb-text-caption)]"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[var(--mb-text-muted)] mb-1.5">Tipo de Desconto</label>
                  <select
                    value={form.discount_type}
                    onChange={(e) => u('discount_type', e.target.value)}
                    className="w-full px-3 py-2 text-[13px] text-[var(--mb-text-primary)] bg-[var(--mb-surface-900)] border border-[var(--mb-border-soft)] outline-none"
                  >
                    {DISCOUNT_TYPES.map((dt) => (
                      <option key={dt.value} value={dt.value}>{dt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {promoType === 'bins' && (
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-[12px] font-medium text-[var(--mb-text-muted)] mb-1.5">BINs (separados por espaço ou vírgula)</label>
                    <input
                      type="text"
                      value={form.bins}
                      onChange={(e) => u('bins', e.target.value)}
                      placeholder="516292 550209"
                      className="w-full px-3 py-2 text-[13px] text-[var(--mb-text-primary)] bg-[var(--mb-surface-900)] border border-[var(--mb-border-soft)] outline-none placeholder:text-[var(--mb-text-caption)]"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-[var(--mb-text-muted)] mb-1.5">
                      {form.discount_type === 'fixo' ? 'Valor do Desconto (R$)' : 'Percentual de Desconto'}
                    </label>
                    <input
                      type="number"
                      value={form.discount}
                      onChange={(e) => u('discount', e.target.value)}
                      placeholder="10"
                      className="w-full px-3 py-2 text-[13px] text-[var(--mb-text-primary)] bg-[var(--mb-surface-900)] border border-[var(--mb-border-soft)] outline-none placeholder:text-[var(--mb-text-caption)]"
                    />
                  </div>
                </div>
              )}

              {promoType === 'bins' && (
                <div className="mb-4">
                  <label className="block text-[12px] font-medium text-[var(--mb-text-muted)] mb-1.5">Bancos (opcional - separados por vírgula)</label>
                  <input
                    type="text"
                    value={form.banks}
                    onChange={(e) => u('banks', e.target.value)}
                    placeholder="Banco do Brasil, Bradesco, Itaú"
                    className="w-full px-3 py-2 text-[13px] text-[var(--mb-text-primary)] bg-[var(--mb-surface-900)] border border-[var(--mb-border-soft)] outline-none placeholder:text-[var(--mb-text-caption)]"
                  />
                  <p className="text-[10px] text-[var(--mb-text-caption)] mt-1">
                    Sugestões: UNKNOWN, AGRICULTURAL BANK OF CHINA, CASTLE BUILDING CENTRES - TDFS...
                  </p>
                </div>
              )}

              {promoType !== 'bins' && (
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-[12px] font-medium text-[var(--mb-text-muted)] mb-1.5">
                      {form.discount_type === 'fixo' ? 'Valor do Desconto (R$)' : 'Percentual de Desconto'}
                    </label>
                    <input
                      type="number"
                      value={form.discount}
                      onChange={(e) => u('discount', e.target.value)}
                      placeholder="10"
                      className="w-full px-3 py-2 text-[13px] text-[var(--mb-text-primary)] bg-[var(--mb-surface-900)] border border-[var(--mb-border-soft)] outline-none placeholder:text-[var(--mb-text-caption)]"
                    />
                  </div>
                  {promoType === 'estoque' && (
                    <div>
                      <label className="block text-[12px] font-medium text-[var(--mb-text-muted)] mb-1.5">Valor mínimo (R$)</label>
                      <input
                        type="number"
                        value={form.min_amount}
                        onChange={(e) => u('min_amount', e.target.value)}
                        placeholder="0"
                        className="w-full px-3 py-2 text-[13px] text-[var(--mb-text-primary)] bg-[var(--mb-surface-900)] border border-[var(--mb-border-soft)] outline-none placeholder:text-[var(--mb-text-caption)]"
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-[12px] font-medium text-[var(--mb-text-muted)] mb-1.5">Rótulo do Badge</label>
                  <input
                    type="text"
                    value={form.badge}
                    onChange={(e) => u('badge', e.target.value)}
                    placeholder="Promoção"
                    className="w-full px-3 py-2 text-[13px] text-[var(--mb-text-primary)] bg-[var(--mb-surface-900)] border border-[var(--mb-border-soft)] outline-none placeholder:text-[var(--mb-text-caption)]"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[var(--mb-text-muted)] mb-1.5">Bases</label>
                  <div className="flex">
                    {['full', 'sem', 'ambas'].map((b) => (
                      <button
                        key={b}
                        onClick={() => u('bases', b)}
                        className={`flex-1 px-3 py-2 text-[12px] font-semibold uppercase transition-colors ${
                          form.bases === b
                            ? 'bg-[var(--mb-accent-300)] text-[var(--mb-bg-950)]'
                            : 'text-[var(--mb-text-muted)] border border-[var(--mb-border-soft)]'
                        }`}
                      >
                        {b}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <ActionButton variant="ghost" onClick={() => { setShowCreate(false); setEditing(null); }}>
                  Cancelar
                </ActionButton>
                <ActionButton
                  variant="accent"
                  loading={saveMut.isPending}
                  onClick={() => saveMut.mutate({
                    ...form,
                    type: promoType,
                    discount: Number(form.discount) || 0,
                    min_amount: Number(form.min_amount) || 0,
                  })}
                >
                  {editing ? 'Salvar' : 'Criar Promoção'}
                </ActionButton>
              </div>
            </Surface>
          )}

          {/* Promotions Table */}
          <Surface className="p-4">
            <h3 className="text-[14px] font-bold text-[var(--mb-text-primary)] mb-3">Promoções Cadastradas</h3>
            {isLoading ? (
              <div className="flex justify-center py-12"><Spinner size="lg" /></div>
            ) : (
              <>
                <DataTable columns={columns} data={promotions} emptyTitle="Nenhuma promoção" emptyDescription="Crie sua primeira promoção para começar." />
                <div className="mt-4">
                  <Pagination page={page} totalPages={data?.totalPages || 1} onPageChange={setPage} />
                </div>
              </>
            )}
          </Surface>
        </>
      ) : (
        <>
          {/* Performance Tab */}
          <Surface className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--mb-accent-300)]">Visão Comercial</span>
                <h3 className="text-[16px] font-bold text-[var(--mb-text-primary)]">Compras e desempenho</h3>
                <p className="text-[12px] text-[var(--mb-text-caption)]">Apenas compras concluídas em que uma promoção foi efetivamente aplicada.</p>
              </div>
              <div className="flex items-center gap-2">
                <select className="px-3 py-2 text-[12px] text-[var(--mb-text-primary)] bg-[var(--mb-surface-900)] border border-[var(--mb-border-soft)] outline-none">
                  <option>Todas as promoções</option>
                </select>
                <select className="px-3 py-2 text-[12px] text-[var(--mb-text-primary)] bg-[var(--mb-surface-900)] border border-[var(--mb-border-soft)] outline-none">
                  <option>Últimos 30 dias</option>
                  <option>Últimos 7 dias</option>
                  <option>Últimos 90 dias</option>
                </select>
                <ActionButton variant="ghost" onClick={() => refetch()} disabled={isFetching}>
                  <RefreshCw className={`w-4 h-4 mr-1 ${isFetching ? 'animate-spin' : ''}`} />Atualizar
                </ActionButton>
              </div>
            </div>
          </Surface>

          {/* Performance KPIs */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <KpiCard icon={ShoppingCart} title="Movimentação" items={[
              { label: 'Compras', value: formatNumber(data?.totalPurchases || 0), subtitle: 'pedidos promocionais' },
              { label: 'Compradores', value: formatNumber(data?.totalBuyers || 0), subtitle: 'clientes únicos' },
            ]} />
            <KpiCard icon={DollarSign} title="Resultado Financeiro" accent="var(--mb-success)" items={[
              { label: 'Receita', value: formatBRL(data?.totalRevenue || 0), subtitle: 'valor efetivamente pago', color: 'var(--mb-success)' },
              { label: 'Ticket Médio', value: formatBRL(data?.avgTicket || 0), subtitle: 'por compra concluída' },
            ]} />
            <KpiCard icon={TrendingUp} title="Impacto Promocional" items={[
              { label: 'Desconto Concedido', value: formatBRL(data?.totalDiscountGiven || 0), subtitle: 'economia à dos clientes' },
              { label: 'Reembolsos', value: formatNumber(data?.totalRefunds || 0), subtitle: 'pedidos estornados', color: 'var(--mb-error)' },
            ]} />
          </div>

          {/* Performance Table */}
          <Surface className="p-4">
            <h3 className="text-[14px] font-bold text-[var(--mb-text-primary)] mb-1">Resultado por promoção</h3>
            <p className="text-[12px] text-[var(--mb-text-caption)] mb-3">Vendas, receita, economia gerada e reembolsos por regra.</p>
            <DataTable columns={perfColumns} data={promotions} emptyTitle="Sem dados" emptyDescription="Nenhuma compra promocional registrada." />
          </Surface>
        </>
      )}
    </div>
  );
}
