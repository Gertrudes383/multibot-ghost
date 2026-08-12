import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Link, Plus, Trash2, ArrowUpRight, Filter, Image,
  CheckCircle, XCircle, RefreshCw, Eye, FileText,
} from 'lucide-react';
import { getTelegramReferences, createTelegramReference, deleteTelegramReference, getBots } from '@services/admin.service';
import { formatDateTime, formatNumber, formatBRL } from '@utils/format';
import { toast } from '@stores/toastStore';
import Surface from '@components/ui/Surface';
import DataTable from '@components/ui/DataTable';
import StatusBadge from '@components/ui/StatusBadge';
import ActionButton from '@components/ui/ActionButton';
import Pagination from '@components/ui/Pagination';
import Modal from '@components/ui/Modal';
import InputField from '@components/ui/InputField';
import Spinner from '@components/ui/Spinner';

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

const STATUS_MAP = { pending: 'pending', approved: 'active', rejected: 'error' };
const STATUS_LABELS = { pending: 'Pendente', approved: 'Aprovado', rejected: 'Rejeitado' };

export default function TelegramReferencesPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [form, setForm] = useState({ name: '', ref_code: '' });

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin', 'telegram', 'references', page, statusFilter],
    queryFn: () => getTelegramReferences({ page, status: statusFilter || undefined }),
  });

  const references = data?.references || [];
  const pending = references.filter((r) => r.status === 'pending');
  const approved = references.filter((r) => r.status === 'approved');
  const rejected = references.filter((r) => r.status === 'rejected');

  const createMut = useMutation({
    mutationFn: () => createTelegramReference(form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'telegram', 'references'] }); toast.success('Referência criada'); setShowCreate(false); setForm({ name: '', ref_code: '' }); },
    onError: (e) => toast.error(e?.data?.message || 'Erro ao criar'),
  });

  const deleteMut = useMutation({
    mutationFn: deleteTelegramReference,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'telegram', 'references'] }); toast.success('Referência removida'); },
    onError: (e) => toast.error(e?.data?.message || 'Erro ao remover'),
  });

  const columns = [
    {
      key: '_id', label: '#', render: (v, row) => (
        <div>
          <span className="text-[12px] font-mono text-[var(--mb-accent-300)]">#{row.ref_number || v?.slice(-4)}</span>
        </div>
      ),
    },
    {
      key: 'name', label: 'Solicitante', render: (v, row) => (
        <div>
          <span className="text-[13px] font-semibold text-[var(--mb-text-primary)]">{v || `tg_${row.telegramId || row._id?.slice(-10)}`}</span>
          <StatusBadge status={STATUS_MAP[row.status] || 'info'} label={STATUS_LABELS[row.status] || row.status} />
          {row.telegramId && <p className="text-[11px] text-[var(--mb-text-caption)] mt-0.5">TG {row.telegramId} · {row.bot_name || 'Bot'} · {formatDateTime(row.createdAt)}</p>}
        </div>
      ),
    },
    {
      key: 'ref_code', label: 'Código', render: (v) => (
        <span className="font-mono text-[12px] text-[var(--mb-text-muted)]">{v}</span>
      ),
    },
    {
      key: 'clicks', label: 'Cliques', render: (v) => formatNumber(v || 0),
    },
    {
      key: 'conversions', label: 'Conversões', render: (v) => formatNumber(v || 0),
    },
    {
      key: 'media_url', label: 'Mídia', render: (v) => v ? (
        <div className="w-12 h-12 bg-[var(--mb-surface-900)] border border-[var(--mb-border-soft)] flex items-center justify-center">
          <Image className="w-5 h-5 text-[var(--mb-text-caption)]" />
        </div>
      ) : '—',
    },
    {
      key: '_actions', label: '', render: (_, row) => (
        <div className="flex gap-1">
          <ActionButton variant="ghost" size="sm"><Eye className="w-3.5 h-3.5" /></ActionButton>
          {row.status === 'pending' && (
            <>
              <ActionButton variant="accent" size="sm"><CheckCircle className="w-3.5 h-3.5" /></ActionButton>
              <ActionButton variant="danger" size="sm"><XCircle className="w-3.5 h-3.5" /></ActionButton>
            </>
          )}
          <ActionButton variant="danger" size="sm" onClick={() => { if (confirm('Remover referência?')) deleteMut.mutate(row._id); }}>
            <Trash2 className="w-3.5 h-3.5" />
          </ActionButton>
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
            <Link className="w-4 h-4 text-[var(--mb-accent-300)]" />
            <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--mb-accent-300)]">Gestão de Referências</span>
          </div>
          <h1 className="text-xl font-bold text-[var(--mb-text-primary)]">Referências Telegram</h1>
          <p className="text-[13px] text-[var(--mb-text-caption)] mt-0.5">Revise evidências, credite clientes e publique conteúdos sem perder o contexto de cada bot.</p>
        </div>
        <ActionButton variant="accent" onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4 mr-1" />Nova Referência
        </ActionButton>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <KpiGroup icon={FileText} title="Solicitações" items={[
          { label: 'Nesta Página', value: formatNumber(references.length), subtitle: 'Itens no recorte atual' },
          { label: 'Pendentes', value: formatNumber(data?.totalPending || pending.length), subtitle: 'Aguardando decisão' },
        ]} />
        <KpiGroup icon={CheckCircle} title="Revisão" items={[
          { label: 'Aprovadas', value: formatNumber(data?.totalApproved || approved.length), subtitle: 'Validadas pela equipe', color: 'var(--mb-success)' },
          { label: 'Rejeitadas', value: formatNumber(data?.totalRejected || rejected.length), subtitle: 'Fora dos critérios', color: 'var(--mb-error)' },
        ]} />
        <KpiGroup icon={Image} title="Distribuição" items={[
          { label: 'Mídias', value: formatNumber(data?.totalMedia || references.filter((r) => r.media_url).length), subtitle: '' },
          { label: 'Creditado', value: formatBRL(data?.totalCredited || 0), subtitle: 'creditados' },
        ]} />
      </div>

      {/* Filter */}
      <Surface className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <Filter className="w-4 h-4 text-[var(--mb-accent-300)]" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--mb-accent-300)]">Consulta Operacional</span>
        </div>
        <h3 className="text-[14px] font-semibold text-[var(--mb-text-primary)] mb-3">Refine a fila de referências</h3>
        <div className="flex items-center gap-3">
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--mb-text-caption)]">Status Atual</span>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="block mt-1 px-3 py-2 text-[13px] font-medium text-[var(--mb-text-primary)] bg-[var(--mb-surface-900)] border border-[var(--mb-border-soft)] outline-none min-w-[180px]"
            >
              <option value="pending">Pendentes</option>
              <option value="approved">Aprovadas</option>
              <option value="rejected">Rejeitadas</option>
              <option value="">Todas</option>
            </select>
          </div>
          <ActionButton variant="ghost" onClick={() => refetch()} disabled={isFetching} className="mt-5">
            <RefreshCw className={`w-4 h-4 mr-1 ${isFetching ? 'animate-spin' : ''}`} />Atualizar
          </ActionButton>
        </div>
      </Surface>

      {/* Table */}
      <div>
        <div className="mb-3">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--mb-accent-300)]">Ledger de Conteúdo</span>
          <h3 className="text-[14px] font-semibold text-[var(--mb-text-primary)]">Fila de referências</h3>
          <p className="text-[12px] text-[var(--mb-text-caption)]">Inspecione arquivos, aplique créditos e conclua a distribuição.</p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20"><Spinner size="lg" /></div>
        ) : (
          <>
            <DataTable columns={columns} data={references} emptyTitle="Fila concluída" emptyDescription="Nenhuma referência encontrada" />
            <div className="mt-4">
              <Pagination page={page} totalPages={data?.totalPages || 1} onPageChange={setPage} />
            </div>
          </>
        )}
      </div>

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="">
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1">
            <Link className="w-4 h-4 text-[var(--mb-accent-300)]" />
            <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--mb-accent-300)]">Nova Referência</span>
          </div>
          <h2 className="text-lg font-bold text-[var(--mb-text-primary)]">Criar referência de tracking</h2>
        </div>
        <div className="space-y-4">
          <InputField label="Nome" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Nome da campanha" />
          <InputField label="Código de Referência" value={form.ref_code} onChange={(e) => setForm((p) => ({ ...p, ref_code: e.target.value }))} placeholder="codigo_unico" />
        </div>
        <ActionButton variant="accent" className="w-full mt-4" loading={createMut.isPending} onClick={() => createMut.mutate()}>
          <Plus className="w-4 h-4 mr-1" />Criar Referência
        </ActionButton>
      </Modal>
    </div>
  );
}
