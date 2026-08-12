import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Upload, Trash2, Edit, Search, CreditCard, ArrowUpRight,
  Package, Layers, FileUp, Zap, RefreshCw,
} from 'lucide-react';
import { getAdminCards, uploadCards, deleteCard } from '@services/admin.service';
import { formatNumber } from '@utils/format';
import { toast } from '@stores/toastStore';
import Surface from '@components/ui/Surface';
import InputField from '@components/ui/InputField';
import ActionButton from '@components/ui/ActionButton';
import StatusBadge from '@components/ui/StatusBadge';
import DataTable from '@components/ui/DataTable';
import Pagination from '@components/ui/Pagination';
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

const statusMap = { active: 'active', sold: 'info', inactive: 'inactive', expired: 'error', dead: 'error' };
const statusLabels = { active: 'Disponível', sold: 'Vendido', inactive: 'Inativo', expired: 'Expirado', dead: 'Dead' };

export default function CardsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [base, setBase] = useState('full');
  const [uploadForm, setUploadForm] = useState({ batchName: '', supplier: '', text: '' });
  const [analyzeFinancial, setAnalyzeFinancial] = useState(false);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin', 'cards', page, status, query],
    queryFn: () => getAdminCards({ page, status: status || undefined, search: query || undefined }),
  });

  const deleteMut = useMutation({
    mutationFn: deleteCard,
    onSuccess: () => { toast.success('Card removido'); queryClient.invalidateQueries({ queryKey: ['admin', 'cards'] }); },
    onError: (e) => toast.error(e?.data?.message || 'Erro ao remover'),
  });

  const uploadMut = useMutation({
    mutationFn: uploadCards,
    onSuccess: (r) => { toast.success(`${r?.imported || 0} cards importados`); setUploadForm({ batchName: '', supplier: '', text: '' }); queryClient.invalidateQueries({ queryKey: ['admin', 'cards'] }); },
    onError: (e) => toast.error(e?.data?.message || 'Erro no upload'),
  });

  const cards = data?.cards || data?.data || [];
  const totalCards = data?.totalCards || data?.total || cards.length;
  const available = data?.available || cards.filter((c) => c.status === 'active').length;
  const sold = data?.sold || cards.filter((c) => c.status === 'sold').length;
  const dead = data?.dead || cards.filter((c) => c.status === 'dead' || c.status === 'inactive').length;

  const columns = [
    { key: 'bin', label: 'BIN', render: (v) => <span className="font-mono text-[12px] text-[var(--mb-accent-300)]">{v}</span> },
    { key: 'country', label: 'País', render: (v) => v || '—' },
    { key: 'type', label: 'Tipo', render: (v) => v || '—' },
    { key: 'level', label: 'Nível', render: (v) => v || '—' },
    { key: 'bank', label: 'Banco', render: (v) => v || '—' },
    { key: 'status', label: 'Status', render: (v) => <StatusBadge status={statusMap[v] || 'info'} label={statusLabels[v] || v} /> },
    { key: 'base_type', label: 'Base', render: (v) => <span className="text-[11px] text-[var(--mb-text-muted)]">{v || 'Full'}</span> },
    {
      key: '_actions', label: '', render: (_, row) => (
        <div className="flex gap-1">
          <ActionButton variant="ghost" size="sm"><Edit className="w-3.5 h-3.5" /></ActionButton>
          <ActionButton variant="danger" size="sm" onClick={() => deleteMut.mutate(row._id)}><Trash2 className="w-3.5 h-3.5" /></ActionButton>
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
            <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--mb-accent-300)]">Inventory Ledger</span>
            <StatusBadge status="active" label="estoque operacional" />
          </div>
          <h1 className="text-xl font-bold text-[var(--mb-text-primary)]">Cartões e estoque</h1>
          <p className="text-[13px] text-[var(--mb-text-caption)] mt-0.5">Importe unidades, acompanhe o processamento e gerencie cada cartão em uma visão consolidada.</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <KpiGroup icon={Package} title="Estoque" items={[
          { label: 'Total', value: formatNumber(totalCards), subtitle: 'Unidades cadastradas' },
          { label: 'Disponíveis', value: formatNumber(available), subtitle: 'Nesta página' },
        ]} />
        <KpiGroup icon={CreditCard} title="Movimentação" items={[
          { label: 'Vendidos', value: formatNumber(sold), subtitle: 'Entregues nesta página' },
          { label: 'Indisponíveis', value: formatNumber(dead), subtitle: 'Dead ou bloqueados' },
        ]} />
        <KpiGroup icon={Layers} title="Distribuição" items={[
          { label: 'Full Dados', value: formatNumber(data?.fullCount || 0), subtitle: 'Unidades nesta página' },
          { label: 'Sem Dados', value: formatNumber(data?.semCount || 0), subtitle: '' },
        ]} />
      </div>

      {/* Upload Section */}
      <Surface className="p-5">
        <h3 className="text-[16px] font-bold text-[var(--mb-text-primary)] mb-4">Upload de Cartões</h3>

        <div className="grid grid-cols-[1fr_300px] gap-4 mb-4">
          <div>
            <label className="block text-[12px] text-[var(--mb-text-muted)] mb-1.5">Nome do lote <span className="text-[var(--mb-text-caption)]">opcional</span></label>
            <input
              type="text"
              value={uploadForm.batchName}
              onChange={(e) => setUploadForm((f) => ({ ...f, batchName: e.target.value }))}
              placeholder="Ex.: Abril_Promo"
              className="w-full px-3 py-2 text-[13px] text-[var(--mb-text-primary)] bg-[var(--mb-surface-900)] border border-[var(--mb-border-soft)] outline-none placeholder:text-[var(--mb-text-caption)]"
            />
            <p className="text-[11px] text-[var(--mb-text-caption)] mt-1">Uma identificação curta para localizar este abastecimento.</p>
          </div>
          <div>
            <label className="block text-[12px] text-[var(--mb-text-muted)] mb-1.5">Fornecedor *</label>
            <input
              type="text"
              value={uploadForm.supplier}
              onChange={(e) => setUploadForm((f) => ({ ...f, supplier: e.target.value }))}
              placeholder="Informe o nome do fornecedor"
              className="w-full px-3 py-2 text-[13px] text-[var(--mb-text-primary)] bg-[var(--mb-surface-900)] border border-[var(--mb-border-soft)] outline-none placeholder:text-[var(--mb-text-caption)]"
            />
            <p className="text-[11px] text-[var(--mb-text-caption)] mt-1">Mínimo de 3 caracteres.</p>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-[12px] text-[var(--mb-text-muted)] mb-1.5">Base</label>
          <div className="flex">
            <button
              onClick={() => setBase('full')}
              className={`flex-1 px-4 py-3 text-[13px] font-semibold text-left transition-colors ${
                base === 'full' ? 'bg-[rgba(53,197,255,0.08)] text-[var(--mb-text-primary)] border border-[var(--mb-accent-300)]' : 'text-[var(--mb-text-muted)] border border-[var(--mb-border-soft)]'
              }`}
            >
              FULL DADOS {base === 'full' && '●'}
            </button>
            <button
              onClick={() => setBase('sem')}
              className={`flex-1 px-4 py-3 text-[13px] font-semibold text-left transition-colors ${
                base === 'sem' ? 'bg-[rgba(53,197,255,0.08)] text-[var(--mb-text-primary)] border border-[var(--mb-accent-300)]' : 'text-[var(--mb-text-muted)] border border-[var(--mb-border-soft)]'
              }`}
            >
              SEM DADOS
            </button>
          </div>
          <p className="text-[11px] text-[var(--mb-text-caption)] mt-1">A detecção automática por linha continua ativa e separa uploads mistos.</p>
        </div>

        <label className="flex items-start gap-2 mb-4 cursor-pointer">
          <input type="checkbox" checked={analyzeFinancial} onChange={(e) => setAnalyzeFinancial(e.target.checked)} className="mt-0.5" />
          <div>
            <span className="text-[13px] font-medium text-[var(--mb-text-primary)]">Analisar dados financeiros após o upload</span>
            <p className="text-[11px] text-[var(--mb-text-caption)]">Somente unidades FULL com CPF válido. O lote é salvo primeiro e a análise continua em segundo plano.</p>
          </div>
        </label>

        <div className="mb-3">
          <p className="text-[12px] text-[var(--mb-text-muted)] mb-2">Arquivo TXT/CSV ou texto (um cartão por linha)</p>
          <ActionButton variant="ghost">
            <FileUp className="w-4 h-4 mr-1" />Selecionar Arquivo
          </ActionButton>
        </div>

        <div>
          <p className="text-[12px] text-[var(--mb-text-muted)] mb-1.5">Opcional para colar manualmente:</p>
          <textarea
            value={uploadForm.text}
            onChange={(e) => setUploadForm((f) => ({ ...f, text: e.target.value }))}
            placeholder="5345195544965883|10|2031|802|Fleila Coutinho|05196748717"
            rows={4}
            className="w-full px-3 py-2 text-[12px] font-mono text-[var(--mb-text-primary)] bg-[var(--mb-surface-900)] border border-[var(--mb-border-soft)] outline-none resize-none placeholder:text-[var(--mb-text-caption)]"
          />
        </div>

        <div className="flex justify-end mt-4">
          <ActionButton
            variant="accent"
            loading={uploadMut.isPending}
            disabled={!uploadForm.text.trim() && !uploadForm.supplier}
            onClick={() => uploadMut.mutate({
              cards: uploadForm.text.split('\n').filter(Boolean),
              batchName: uploadForm.batchName,
              supplier: uploadForm.supplier,
              base,
              analyzeFinancial,
            })}
          >
            <Upload className="w-4 h-4 mr-1" />Importar Cartões
          </ActionButton>
        </div>
      </Surface>

      {/* Search + Filters */}
      <Surface className="p-4">
        <div className="flex gap-2">
          <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-[var(--mb-surface-900)] border border-[var(--mb-border-soft)]">
            <Search className="w-4 h-4 text-[var(--mb-text-caption)]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { setQuery(search); setPage(1); } }}
              placeholder="BIN, banco, país..."
              className="flex-1 bg-transparent text-[13px] text-[var(--mb-text-primary)] outline-none placeholder:text-[var(--mb-text-caption)]"
            />
          </div>
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="px-3 py-2 text-[12px] text-[var(--mb-text-primary)] bg-[var(--mb-surface-900)] border border-[var(--mb-border-soft)] outline-none"
          >
            <option value="">Todos os status</option>
            <option value="active">Disponível</option>
            <option value="sold">Vendido</option>
            <option value="dead">Dead</option>
          </select>
          <ActionButton variant="accent" onClick={() => { setQuery(search); setPage(1); }}>
            <Search className="w-4 h-4 mr-1" />Buscar
          </ActionButton>
        </div>
      </Surface>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : (
        <>
          <DataTable columns={columns} data={cards} emptyTitle="Nenhum card encontrado" emptyDescription="Faça upload para adicionar cards." />
          <div className="mt-4">
            <Pagination page={page} totalPages={data?.totalPages || 1} onPageChange={setPage} />
          </div>
        </>
      )}
    </div>
  );
}
