import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Zap, Plus, Upload, RefreshCw, Search, SlidersHorizontal,
  Edit, Trash2, DollarSign, ArrowUpRight, CreditCard, ChevronDown,
} from 'lucide-react';
import { getBins, createBin, updateBin, deleteBin } from '@services/admin.service';
import { formatNumber, formatBRL } from '@utils/format';
import { toast } from '@stores/toastStore';
import Surface from '@components/ui/Surface';
import ActionButton from '@components/ui/ActionButton';
import DataTable from '@components/ui/DataTable';
import Pagination from '@components/ui/Pagination';
import Modal from '@components/ui/Modal';
import InputField from '@components/ui/InputField';
import SelectField from '@components/ui/SelectField';
import StatusBadge from '@components/ui/StatusBadge';
import Spinner from '@components/ui/Spinner';

const LEVEL_OPTS = [
  { value: '', label: 'Selecione' },
  { value: 'classic', label: 'Classic' },
  { value: 'gold', label: 'Gold' },
  { value: 'platinum', label: 'Platinum' },
  { value: 'black', label: 'Black' },
  { value: 'infinite', label: 'Infinite' },
];

const TYPE_OPTS = [
  { value: '', label: 'Selecione' },
  { value: 'credito', label: 'Crédito' },
  { value: 'debito', label: 'Débito' },
  { value: 'prepago', label: 'Pré-pago' },
];

export default function BinsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showBulk, setShowBulk] = useState(false);
  const [bulkBase, setBulkBase] = useState('ambas');
  const [bulkText, setBulkText] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [form, setForm] = useState({ bin: '', bank: '', brand: '', type: '', level: '', country: '', price_full: '', price_sem: '' });

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin', 'bins', page, query],
    queryFn: () => getBins({ page, search: query || undefined }),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin', 'bins'] });

  const saveMut = useMutation({
    mutationFn: (d) => editing ? updateBin(editing._id, d) : createBin(d),
    onSuccess: () => { toast.success(editing ? 'BIN atualizado' : 'BIN criado'); closeModal(); invalidate(); },
    onError: (e) => toast.error(e?.data?.message || 'Erro'),
  });

  const delMut = useMutation({
    mutationFn: deleteBin,
    onSuccess: () => { toast.success('BIN removido'); invalidate(); },
    onError: (e) => toast.error(e?.data?.message || 'Erro'),
  });

  function openCreate() {
    setEditing(null);
    setForm({ bin: '', bank: '', brand: '', type: '', level: '', country: '', price_full: '', price_sem: '' });
    setModalOpen(true);
  }
  function openEdit(row) {
    setEditing(row);
    setForm({
      bin: row.bin || '', bank: row.bank || '', brand: row.brand || '',
      type: row.type || '', level: row.level || '', country: row.country || '',
      price_full: String(row.price_full ?? row.priceFull ?? ''),
      price_sem: String(row.price_sem ?? row.priceSem ?? ''),
    });
    setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); setEditing(null); }
  function u(field, value) { setForm((f) => ({ ...f, [field]: value })); }

  const bins = data?.bins || data?.data || [];
  const totalBins = data?.total || data?.totalBins || bins.length;
  const totalPages = data?.totalPages || 1;

  const columns = [
    {
      key: 'bin', label: 'Identificação', render: (v, row) => (
        <div>
          <span className="text-[14px] font-mono font-bold text-[var(--mb-text-primary)]">{v}</span>
          <p className="text-[13px] font-semibold text-[var(--mb-text-muted)]">{row.brand || 'Sem bandeira'}</p>
          <p className="text-[11px] text-[var(--mb-text-caption)]">
            TIPO: {row.type || 'Tipo não informado'} · NÍVEL: {row.level || 'Nível não informado'}
          </p>
        </div>
      ),
    },
    {
      key: 'bank', label: 'Banco e País', render: (v, row) => (
        <div>
          <span className="text-[13px] font-medium text-[var(--mb-text-primary)]">{v || 'Banco não informado'}</span>
          {row.country && <p className="text-[11px] text-[var(--mb-text-caption)]">{row.country}</p>}
        </div>
      ),
    },
    {
      key: 'price_full', label: 'Preço Full', render: (v, row) => (
        <span className="text-[14px] font-semibold text-[var(--mb-success)]">
          {formatBRL(v ?? row.priceFull ?? 0)}
        </span>
      ),
    },
    {
      key: 'price_sem', label: 'Preço Sem', render: (v, row) => (
        <span className="text-[14px] font-semibold text-[var(--mb-success)]">
          {formatBRL(v ?? row.priceSem ?? 0)}
        </span>
      ),
    },
    {
      key: '_actions', label: 'Ações', render: (_, row) => (
        <div className="flex items-center gap-1">
          <ActionButton variant="accent" size="sm" onClick={() => openEdit(row)}>
            <DollarSign className="w-3.5 h-3.5 mr-0.5" />Preços
          </ActionButton>
          <ActionButton variant="ghost" size="sm" onClick={() => openEdit(row)}>
            <Edit className="w-3.5 h-3.5" />
          </ActionButton>
          <ActionButton variant="danger" size="sm" onClick={() => { if (confirm('Remover BIN?')) delMut.mutate(row._id); }}>
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
            <Zap className="w-4 h-4 text-[var(--mb-accent-300)]" />
            <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--mb-accent-300)]">Pricing Intelligence</span>
            <StatusBadge status="active" label="edição em tempo real" />
          </div>
          <h1 className="text-2xl font-bold text-[var(--mb-text-primary)]">
            <span className="text-[var(--mb-accent-300)]">Preços</span> por BIN
          </h1>
          <p className="text-[13px] text-[var(--mb-text-caption)] mt-0.5 max-w-xl">
            Gerencie identificação, emissor e valores das bases FULL e SEM em uma única visão operacional.
          </p>
        </div>
        <ActionButton variant="ghost" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`w-4 h-4 mr-1 ${isFetching ? 'animate-spin' : ''}`} />Sincronizar
        </ActionButton>
      </div>

      {/* Base Operacional */}
      <Surface className="p-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 flex items-center justify-center bg-[rgba(53,197,255,0.08)] border border-[var(--mb-border-soft)]">
            <CreditCard className="w-5 h-5 text-[var(--mb-accent-300)]" />
          </div>
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--mb-text-caption)]">Base Operacional</span>
            <p className="text-[14px] font-bold text-[var(--mb-text-primary)]">{formatNumber(totalBins)} BINs cadastradas</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ActionButton variant="ghost" onClick={() => setShowBulk(!showBulk)}>
            <SlidersHorizontal className="w-4 h-4 mr-1" />Precificação em massa
          </ActionButton>
          <ActionButton variant="accent" onClick={openCreate}>
            <Plus className="w-4 h-4 mr-1" />Criar BIN
          </ActionButton>
          <ActionButton variant="ghost">
            <Upload className="w-4 h-4 mr-1" />Importar CSV
          </ActionButton>
        </div>
      </Surface>

      {/* Bulk Pricing */}
      {showBulk && (
        <Surface className="p-5">
          <div className="flex items-center justify-between mb-1">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--mb-warning)]">Operação em Lote</span>
              <h3 className="text-[16px] font-bold text-[var(--mb-text-primary)]">Precificação em massa</h3>
              <p className="text-[12px] text-[var(--mb-text-caption)]">Atualize BINs, bancos ou grupos completos com processamento seguro em lotes.</p>
            </div>
            <div className="flex">
              {['full', 'sem', 'ambas'].map((opt) => (
                <button
                  key={opt}
                  onClick={() => setBulkBase(opt)}
                  className={`px-4 py-2 text-[12px] font-semibold uppercase transition-colors ${
                    bulkBase === opt
                      ? 'bg-[var(--mb-accent-300)] text-[var(--mb-bg-950)]'
                      : 'text-[var(--mb-text-muted)] border border-[var(--mb-border-soft)]'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          <p className="text-[12px] text-[var(--mb-text-caption)] mt-3 mb-2">
            Cole linhas no formato: BIN|Banco|Marca ... ou expressões abreviadas. Formatos aceitos:
          </p>
          <ul className="text-[11px] text-[var(--mb-text-caption)] list-disc ml-4 mb-3 space-y-0.5">
            <li>123456 - 10.50</li>
            <li>123456 : R$ 9.99</li>
            <li>VISA GOLD - 8</li>
            <li>ITAU - 7.25</li>
          </ul>

          <textarea
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            placeholder="Ex:\n123456 - 10\nVISA GOLD - 9,5\nITAU : 8"
            rows={6}
            className="w-full px-3 py-2 text-[12px] font-mono text-[var(--mb-text-primary)] bg-[var(--mb-surface-900)] border border-[var(--mb-border-soft)] outline-none resize-none placeholder:text-[var(--mb-text-caption)]"
          />

          <div className="flex gap-2 mt-3">
            <ActionButton variant="accent" onClick={() => toast.info('Precificação em massa aplicada')}>
              Aplicar
            </ActionButton>
            <ActionButton variant="ghost" onClick={() => setBulkText('')}>
              Limpar
            </ActionButton>
          </div>
        </Surface>
      )}

      {/* Search */}
      <Surface className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <Search className="w-4 h-4 text-[var(--mb-accent-300)]" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--mb-accent-300)]">Consulta Inteligente</span>
        </div>
        <h3 className="text-[14px] font-semibold text-[var(--mb-text-primary)] mb-3">Encontre qualquer BIN</h3>
        <div className="flex gap-2">
          <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-[var(--mb-surface-900)] border border-[var(--mb-border-soft)]">
            <CreditCard className="w-4 h-4 text-[var(--mb-text-caption)]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { setQuery(search); setPage(1); } }}
              placeholder="BIN, banco ou bandeira"
              className="flex-1 bg-transparent text-[13px] text-[var(--mb-text-primary)] outline-none placeholder:text-[var(--mb-text-caption)]"
            />
            <ActionButton variant="ghost" size="sm" onClick={() => { setSearch(''); setQuery(''); setPage(1); }}>
              Buscar
            </ActionButton>
          </div>
          <ActionButton variant="accent" onClick={() => { setQuery(search); setPage(1); }}>
            <Search className="w-4 h-4 mr-1" />Pesquisar
          </ActionButton>
          <ActionButton variant="ghost" onClick={() => setShowFilters(!showFilters)}>
            <SlidersHorizontal className="w-4 h-4 mr-1" />Filtros
          </ActionButton>
        </div>
        <p className="text-[11px] text-[var(--mb-text-caption)] mt-2 text-right">
          Pesquise por BIN, banco, bandeira ou refine pelo contexto comercial.
        </p>
      </Surface>

      {/* Table */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--mb-accent-300)]">Catálogo Operacional</span>
            <h3 className="text-[14px] font-semibold text-[var(--mb-text-primary)]">Base de dados BIN</h3>
            <p className="text-[12px] text-[var(--mb-text-caption)]">{formatNumber(totalBins)} registros · edição rápida na própria linha</p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status="active" label="dados sincronizados" />
            <span className="text-[12px] text-[var(--mb-text-muted)]">Página {page} / {totalPages}</span>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20"><Spinner size="lg" /></div>
        ) : (
          <>
            <DataTable columns={columns} data={bins} emptyTitle="Nenhum BIN cadastrado" emptyDescription="Crie ou importe BINs para começar." />
            <div className="mt-4">
              <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
            </div>
          </>
        )}
      </div>

      {/* Create/Edit Modal */}
      <Modal open={modalOpen} onClose={closeModal} title="">
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1">
            <CreditCard className="w-4 h-4 text-[var(--mb-accent-300)]" />
            <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--mb-accent-300)]">
              {editing ? 'Editar BIN' : 'Novo BIN'}
            </span>
          </div>
          <h2 className="text-lg font-bold text-[var(--mb-text-primary)]">
            {editing ? `Editar ${editing.bin}` : 'Cadastrar novo BIN'}
          </h2>
        </div>

        <div className="space-y-4">
          <InputField label="BIN" value={form.bin} onChange={(e) => u('bin', e.target.value)} placeholder="6 dígitos" disabled={!!editing} />

          <div className="grid grid-cols-2 gap-4">
            <InputField label="Banco" value={form.bank} onChange={(e) => u('bank', e.target.value)} placeholder="Nome do banco emissor" />
            <InputField label="Bandeira" value={form.brand} onChange={(e) => u('brand', e.target.value)} placeholder="Visa, Mastercard..." />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <SelectField label="Tipo" value={form.type} onChange={(e) => u('type', e.target.value)} options={TYPE_OPTS} />
            <SelectField label="Nível" value={form.level} onChange={(e) => u('level', e.target.value)} options={LEVEL_OPTS} />
          </div>

          <InputField label="País" value={form.country} onChange={(e) => u('country', e.target.value)} placeholder="BR, US, CN..." />

          <div className="grid grid-cols-2 gap-4">
            <InputField label="Preço FULL (R$)" type="number" value={form.price_full} onChange={(e) => u('price_full', e.target.value)} placeholder="0.00" />
            <InputField label="Preço SEM (R$)" type="number" value={form.price_sem} onChange={(e) => u('price_sem', e.target.value)} placeholder="0.00" />
          </div>

          <ActionButton
            variant="accent"
            className="w-full"
            loading={saveMut.isPending}
            onClick={() => saveMut.mutate({
              ...form,
              price_full: Number(form.price_full) || 0,
              price_sem: Number(form.price_sem) || 0,
            })}
          >
            {editing ? 'Salvar Alterações' : 'Criar BIN'}
          </ActionButton>
        </div>
      </Modal>
    </div>
  );
}
