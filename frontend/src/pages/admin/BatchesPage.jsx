import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Edit, Trash2, Zap, Package, TrendingUp, DollarSign,
  ArrowUpRight, RefreshCw, Undo2, Database, BarChart2,
} from 'lucide-react';
import { getBatches, createBatch, updateBatch, deleteBatch } from '@services/admin.service';
import { toast } from '@stores/toastStore';
import { formatBRL, formatDate, formatNumber } from '@utils/format';
import Surface from '@components/ui/Surface';
import ActionButton from '@components/ui/ActionButton';
import DataTable from '@components/ui/DataTable';
import Pagination from '@components/ui/Pagination';
import Modal from '@components/ui/Modal';
import InputField from '@components/ui/InputField';
import StatusBadge from '@components/ui/StatusBadge';
import Spinner from '@components/ui/Spinner';

function KpiGroup({ icon: Icon, title, items, accent = 'var(--mb-accent-300)' }) {
  return (
    <Surface className="p-4 flex-1 min-w-[180px]">
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

function MetricCard({ title, value, detail, detail2, progress }) {
  return (
    <Surface className="p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--mb-text-caption)]">{title}</span>
        <span className="text-xl font-bold text-[var(--mb-text-primary)]">{value}</span>
      </div>
      {detail && <p className="text-[11px] text-[var(--mb-text-caption)]">{detail}</p>}
      {progress !== undefined && (
        <div className="mt-2 h-1.5 bg-[rgba(143,209,255,0.1)] overflow-hidden">
          <div className="h-full bg-[var(--mb-accent-300)]" style={{ width: `${Math.min(100, progress)}%` }} />
        </div>
      )}
      {detail2 && <p className="text-[10px] text-[var(--mb-text-caption)] mt-1">{detail2}</p>}
    </Surface>
  );
}

export default function BatchesPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', price: '' });

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin', 'batches', page, statusFilter],
    queryFn: () => getBatches({ page, status: statusFilter || undefined }),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin', 'batches'] });

  const saveMut = useMutation({
    mutationFn: (d) => editing ? updateBatch(editing._id, d) : createBatch(d),
    onSuccess: () => { toast.success(editing ? 'Lote atualizado' : 'Lote criado'); closeModal(); invalidate(); },
    onError: (e) => toast.error(e?.data?.message || 'Erro'),
  });

  const delMut = useMutation({
    mutationFn: deleteBatch,
    onSuccess: () => { toast.success('Lote removido'); invalidate(); },
    onError: (e) => toast.error(e?.data?.message || 'Erro ao remover'),
  });

  function openCreate() { setEditing(null); setForm({ name: '', price: '' }); setModalOpen(true); }
  function openEdit(row) { setEditing(row); setForm({ name: row.name, price: String(row.price || '') }); setModalOpen(true); }
  function closeModal() { setModalOpen(false); setEditing(null); }

  const batches = data?.batches || data?.data || [];
  const totalBatches = data?.totalBatches || batches.length;
  const totalCards = data?.totalCards || batches.reduce((s, b) => s + (b.quantity || 0), 0);
  const totalSold = data?.totalSold || 0;
  const totalDeads = data?.totalDeads || 0;
  const totalRevenue = data?.totalRevenue || 0;
  const estimatedRevenue = data?.estimatedRevenue || 0;
  const totalRefunds = data?.totalRefunds || 0;
  const refundValue = data?.refundValue || 0;
  const sellThrough = totalCards > 0 ? ((totalSold / totalCards) * 100).toFixed(1) : '0.0';
  const checkerSuccess = (totalSold + totalDeads) > 0 ? ((totalSold / (totalSold + totalDeads)) * 100).toFixed(1) : '0.0';
  const fullCount = data?.fullCount || 0;
  const semCount = data?.semCount || 0;
  const fullPct = totalCards > 0 ? ((fullCount / totalCards) * 100).toFixed(1) : '0';

  const columns = [
    { key: 'name', label: 'Lote', render: (v, row) => (
      <div>
        <span className="text-[13px] font-medium text-[var(--mb-text-primary)]">{v}</span>
        {row.supplier && <p className="text-[11px] text-[var(--mb-text-caption)]">{row.supplier}</p>}
      </div>
    )},
    { key: 'quantity', label: 'Cartões', render: (v) => formatNumber(v || 0) },
    { key: 'sold', label: 'Vendidos', render: (v) => formatNumber(v || 0) },
    { key: 'price', label: 'Preço Unit.', render: (v) => formatBRL(v || 0) },
    { key: 'status', label: 'Status', render: (v) => <StatusBadge status={v === 'active' ? 'active' : 'inactive'} label={v === 'active' ? 'Ativo' : 'Inativo'} /> },
    { key: 'base_type', label: 'Base', render: (v) => v || 'Full' },
    { key: 'createdAt', label: 'Criado em', render: (v) => formatDate(v) },
    {
      key: '_actions', label: '', render: (_, row) => (
        <div className="flex gap-1">
          <ActionButton variant="ghost" size="sm" onClick={() => openEdit(row)}><Edit className="w-3.5 h-3.5" /></ActionButton>
          <ActionButton variant="danger" size="sm" onClick={() => { if (confirm('Remover lote?')) delMut.mutate(row._id); }}><Trash2 className="w-3.5 h-3.5" /></ActionButton>
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
            <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--mb-accent-300)]">Inventory Intelligence</span>
            <StatusBadge status="active" label="estoque em tempo real" />
          </div>
          <h1 className="text-xl font-bold text-[var(--mb-text-primary)]">Lotes e inventário</h1>
          <p className="text-[13px] text-[var(--mb-text-caption)] mt-0.5">Estoque, qualidade, fornecedores e receita em uma visão operacional unificada.</p>
        </div>
        <div className="flex gap-2">
          <ActionButton variant="accent" onClick={openCreate}>
            <Plus className="w-4 h-4 mr-1" />Novo Lote
          </ActionButton>
          <ActionButton variant="ghost" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`w-4 h-4 mr-1 ${isFetching ? 'animate-spin' : ''}`} />Sincronizar
          </ActionButton>
        </div>
      </div>

      {/* Filter */}
      <Surface className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--mb-accent-300)]">Controle de Inventário</span>
        </div>
        <h3 className="text-[14px] font-semibold text-[var(--mb-text-primary)] mb-3">Refine a operação dos lotes</h3>
        <div className="flex items-center justify-between">
          <div>
            <label className="block text-[12px] text-[var(--mb-text-caption)] mb-1">Status dos lotes</label>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="px-3 py-2 text-[13px] text-[var(--mb-text-primary)] bg-[var(--mb-surface-900)] border border-[var(--mb-border-soft)] outline-none min-w-[200px]"
            >
              <option value="">Todos os status</option>
              <option value="active">Ativo</option>
              <option value="inactive">Inativo</option>
            </select>
          </div>
          <ActionButton variant="ghost" size="sm">
            <Database className="w-3.5 h-3.5 mr-1" />Dados auxiliares
          </ActionButton>
        </div>
      </Surface>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiGroup icon={Package} title="Inventário" items={[
          { label: 'Lotes', value: formatNumber(totalBatches), subtitle: 'No recorte atual' },
          { label: 'Cartões', value: formatNumber(totalCards), subtitle: 'Volume consolidado' },
        ]} />
        <KpiGroup icon={TrendingUp} title="Movimentação" items={[
          { label: 'Vendidos', value: formatNumber(totalSold), subtitle: 'Entregues aos clientes', color: 'var(--mb-success)' },
          { label: 'Deads', value: formatNumber(totalDeads), subtitle: 'Removidos do estoque', color: 'var(--mb-error)' },
        ]} />
        <KpiGroup icon={DollarSign} title="Receita" accent="var(--mb-success)" items={[
          { label: 'Realizada', value: formatBRL(totalRevenue), subtitle: 'Receita confirmada', color: 'var(--mb-success)' },
          { label: 'Estimada', value: formatBRL(estimatedRevenue), subtitle: 'Potencial do estoque', color: 'var(--mb-success)' },
        ]} />
        <KpiGroup icon={Undo2} title="Reembolsos Telegram" accent="var(--mb-error)" items={[
          { label: 'Pedidos', value: formatNumber(totalRefunds), subtitle: 'Pedidos estornados' },
          { label: 'Valor Devolvido', value: formatBRL(refundValue), subtitle: 'Total reembolsado', color: 'var(--mb-error)' },
        ]} />
      </div>

      {/* Health Metrics */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--mb-accent-300)]">Análise Operacional</span>
            <h3 className="text-[14px] font-semibold text-[var(--mb-text-primary)]">Saúde do inventário</h3>
          </div>
          <p className="text-[12px] text-[var(--mb-text-caption)]">Conversão, qualidade, composição e retorno do estoque atual.</p>
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <MetricCard title="Sell-through Médio" value={`${sellThrough}%`} detail={`${formatNumber(totalSold)} vendidos de ${formatNumber(totalCards)}`} detail2="Conversão do estoque disponível" progress={Number(sellThrough)} />
          <MetricCard title="Checker Sucesso Médio" value={`${checkerSuccess}%`} detail={`Lives: ${formatNumber(totalSold)} · Deaths: ${formatNumber(totalDeads)}`} detail2={`${formatNumber(totalSold + totalDeads)} validações consideradas`} progress={Number(checkerSuccess)} />
          <Surface className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--mb-text-caption)]">Distribuição de Bases</span>
              <span className="text-xl font-bold text-[var(--mb-text-primary)]">{formatNumber(totalCards)}</span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-[var(--mb-text-caption)]">
              <span>📋 FULL</span><span className="font-semibold text-[var(--mb-text-primary)]">{formatNumber(fullCount)}</span>
              <span>📄 SEM</span><span className="font-semibold text-[var(--mb-text-primary)]">{formatNumber(semCount)}</span>
            </div>
            <div className="mt-2 h-1.5 bg-[rgba(143,209,255,0.1)] overflow-hidden">
              <div className="h-full bg-[var(--mb-accent-300)]" style={{ width: `${fullPct}%` }} />
            </div>
            <div className="flex justify-between mt-1 text-[10px] text-[var(--mb-text-caption)]">
              <span>FULL {fullPct}%</span>
              <span>SEM {(100 - Number(fullPct)).toFixed(1)}%</span>
            </div>
          </Surface>
          <Surface className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--mb-text-caption)]">Snapshot Receita</span>
              <span className="text-xl font-bold text-[var(--mb-success)]">{formatBRL(totalRevenue)}</span>
            </div>
            <div className="space-y-1 text-[11px]">
              <div className="flex justify-between"><span className="text-[var(--mb-text-caption)]">Estimado</span><span className="text-[var(--mb-text-muted)]">{formatBRL(estimatedRevenue)}</span></div>
              <div className="flex justify-between"><span className="text-[var(--mb-text-caption)]">Telegram</span><span className="text-[var(--mb-text-muted)]">{formatBRL(totalRevenue)}</span></div>
            </div>
            <div className="mt-2 h-1 bg-[rgba(143,209,255,0.1)] overflow-hidden">
              <div className="h-full bg-[var(--mb-success)]" style={{ width: `${estimatedRevenue > 0 ? (totalRevenue / estimatedRevenue * 100) : 0}%` }} />
            </div>
            <p className="text-[10px] text-[var(--mb-text-caption)] mt-1">Real vs Estimado: {estimatedRevenue > 0 ? (totalRevenue / estimatedRevenue * 100).toFixed(1) : '0'}%</p>
          </Surface>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : (
        <>
          <DataTable columns={columns} data={batches} emptyTitle="Nenhum lote encontrado" emptyDescription="Crie um lote para organizar o estoque" />
          <div className="mt-4">
            <Pagination page={page} totalPages={data?.totalPages || 1} onPageChange={setPage} />
          </div>
        </>
      )}

      {/* Modal */}
      <Modal open={modalOpen} onClose={closeModal} title="">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-[var(--mb-text-primary)]">{editing ? 'Editar Lote' : 'Novo Lote'}</h2>
        </div>
        <div className="space-y-4">
          <InputField label="Nome" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <InputField label="Preço (R$)" type="number" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} />
          <ActionButton variant="accent" className="w-full" loading={saveMut.isPending} onClick={() => saveMut.mutate({ name: form.name, price: Number(form.price) })}>
            {editing ? 'Salvar Alterações' : 'Criar Lote'}
          </ActionButton>
        </div>
      </Modal>
    </div>
  );
}
