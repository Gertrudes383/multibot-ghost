import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Gift, RefreshCw, Plus, DollarSign, Award, BarChart2,
  Settings, Power, Eye, ChevronDown,
} from 'lucide-react';
import { getTelegramGiftCards, createTelegramGiftCards, getBots } from '@services/admin.service';
import { formatBRL, formatDateTime, formatNumber } from '@utils/format';
import { toast } from '@stores/toastStore';
import Surface from '@components/ui/Surface';
import DataTable from '@components/ui/DataTable';
import StatusBadge from '@components/ui/StatusBadge';
import Pagination from '@components/ui/Pagination';
import Spinner from '@components/ui/Spinner';
import ActionButton from '@components/ui/ActionButton';
import InputField from '@components/ui/InputField';
import Modal from '@components/ui/Modal';

function KpiCard({ icon: Icon, title, value, subtitle, accent = 'var(--mb-accent-300)', progress }) {
  return (
    <Surface className="p-4 flex-1">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4" style={{ color: accent }} />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--mb-text-caption)]">{title}</span>
      </div>
      <p className="text-2xl font-bold" style={{ color: accent }}>{value}</p>
      {subtitle && <p className="text-[11px] text-[var(--mb-text-caption)] mt-1">{subtitle}</p>}
      {progress !== undefined && (
        <div className="mt-2 h-1.5 bg-[rgba(143,209,255,0.1)] overflow-hidden">
          <div className="h-full bg-[var(--mb-accent-300)] transition-all" style={{ width: `${Math.min(100, progress)}%` }} />
        </div>
      )}
    </Surface>
  );
}

export default function TelegramGiftCardsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [botId, setBotId] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [autoUpdate, setAutoUpdate] = useState(false);
  const [createForm, setCreateForm] = useState({
    quantity: 5, amount: 10, max_uses: 1, prefix: '', expiresAt: '',
  });

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin', 'telegram', 'giftcards', page, botId],
    queryFn: () => getTelegramGiftCards({ page, botId: botId || undefined }),
    refetchInterval: autoUpdate ? 30000 : false,
  });

  const { data: botsData } = useQuery({
    queryKey: ['admin', 'bots'],
    queryFn: getBots,
  });

  const bots = Array.isArray(botsData?.bots) ? botsData.bots : Array.isArray(botsData) ? botsData : [];
  const giftcards = data?.giftcards || data?.giftCards || [];

  const totalValue = giftcards.reduce((s, g) => s + (g.amount || 0), 0);
  const redeemed = giftcards.filter((g) => g.status === 'redeemed' || g.used_count > 0);
  const capacityPct = giftcards.length > 0 ? (redeemed.length / giftcards.length) * 100 : 0;

  const createMut = useMutation({
    mutationFn: (d) => createTelegramGiftCards({ ...d, botId: botId || undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'telegram', 'giftcards'] }); toast.success('Gift Cards gerados'); setShowCreate(false); },
    onError: (e) => toast.error(e?.data?.message || 'Erro ao criar gift cards'),
  });

  const columns = [
    { key: 'code', label: 'Código', render: (v) => <span className="font-mono text-[12px] text-[var(--mb-text-primary)]">{v}</span> },
    { key: 'bot_name', label: 'Bot', render: (v) => v ? <span className="px-2 py-0.5 text-[11px] bg-[rgba(53,197,255,0.08)] text-[var(--mb-text-muted)]">{v}</span> : '—' },
    { key: 'amount', label: 'Valor', render: (v) => <span className="text-[14px] font-semibold text-[var(--mb-success)]">{formatBRL(v)}</span> },
    {
      key: 'used_count', label: 'Utilização', render: (v, row) => {
        const used = v || (row.status === 'redeemed' ? 1 : 0);
        const max = row.max_uses || 1;
        const pct = (used / max) * 100;
        return (
          <div className="w-32">
            <span className="text-[12px] text-[var(--mb-text-muted)]">{used} / {max}</span>
            <div className="mt-1 h-1.5 bg-[rgba(143,209,255,0.1)] overflow-hidden">
              <div className="h-full bg-[var(--mb-accent-300)]" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      },
    },
    {
      key: 'expiresAt', label: 'Validade', render: (v) => (
        <div className="flex items-center gap-1.5">
          <span className="text-[12px] text-[var(--mb-text-muted)]">⏰ {v ? formatDateTime(v) : 'Sem prazo'}</span>
        </div>
      ),
    },
    {
      key: 'status', label: 'Status', render: (v) => (
        <StatusBadge
          status={v === 'redeemed' ? 'active' : v === 'active' ? 'info' : 'inactive'}
          label={v === 'redeemed' ? 'Resgatado' : v === 'active' ? 'ATIVO' : 'INATIVO'}
        />
      ),
    },
    {
      key: '_actions', label: '', render: (_, row) => (
        <div className="flex gap-1">
          <ActionButton variant="ghost" size="sm"><Eye className="w-3.5 h-3.5" /> Detalhes</ActionButton>
          <ActionButton variant="ghost" size="sm"><Power className="w-3.5 h-3.5" /></ActionButton>
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
            <Gift className="w-4 h-4 text-[var(--mb-accent-300)]" />
            <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--mb-accent-300)]">Gift Operations</span>
            <StatusBadge status="active" label="em tempo real" />
          </div>
          <h1 className="text-xl font-bold text-[var(--mb-text-primary)]">Gift Cards</h1>
          <p className="text-[13px] text-[var(--mb-text-caption)] mt-0.5">Emita créditos, governe a disponibilidade e acompanhe cada resgate em uma única visão.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--mb-text-caption)]">Bot Selecionado</span>
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
            <RefreshCw className={`w-4 h-4 mr-1 ${isFetching ? 'animate-spin' : ''}`} />Atualizar
          </ActionButton>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[var(--mb-text-caption)]">Atualização automática</span>
            <button onClick={() => setAutoUpdate(!autoUpdate)} className={`relative w-9 h-5 transition-colors ${autoUpdate ? 'bg-[var(--mb-success)]' : 'bg-[rgba(143,209,255,0.15)]'}`}>
              <span className={`absolute top-0.5 w-4 h-4 bg-white transition-transform ${autoUpdate ? 'left-[18px]' : 'left-0.5'}`} />
            </button>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <KpiCard icon={DollarSign} title="Valor Configurado" value={formatBRL(data?.totalValue || totalValue)} subtitle={`Volume nominal dos códigos emitidos`} accent="var(--mb-success)" />
        <KpiCard icon={Award} title="Resgates Realizados" value={formatNumber(data?.totalRedeemed || redeemed.length)} subtitle="utilizações confirmadas" />
        <KpiCard icon={BarChart2} title="Capacidade Utilizada" value={`${capacityPct.toFixed(0)}%`} subtitle={`${redeemed.length} de ${giftcards.length} resgates`} progress={capacityPct} />
      </div>

      {/* Create Section */}
      <Surface className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--mb-accent-300)]">Inventário</span>
            <h3 className="text-[14px] font-semibold text-[var(--mb-text-primary)]">Códigos emitidos</h3>
            <p className="text-[12px] text-[var(--mb-text-caption)]">Consulte uso, validade e disponibilidade por código.</p>
          </div>
          <ActionButton variant="accent" onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4 mr-1" />Emitir Gift Cards
          </ActionButton>
        </div>
      </Surface>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : (
        <>
          <DataTable columns={columns} data={giftcards} emptyTitle="Nenhum gift card emitido" emptyDescription="Emita gift cards para seus clientes" />
          <div className="mt-4">
            <Pagination page={page} totalPages={data?.totalPages || 1} onPageChange={setPage} />
          </div>
        </>
      )}

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="">
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1">
            <Gift className="w-4 h-4 text-[var(--mb-accent-300)]" />
            <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--mb-accent-300)]">Nova Emissão</span>
          </div>
          <h2 className="text-lg font-bold text-[var(--mb-text-primary)]">Crie um lote de códigos em poucos segundos.</h2>
          <p className="text-[12px] text-[var(--mb-text-caption)]">Defina valor, validade e limite de uso. Cada código ficará vinculado exclusivamente ao bot selecionado.</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-[12px] font-medium text-[var(--mb-text-muted)] mb-1.5">Bot destinatário *</label>
            <select
              value={createForm.botId || botId}
              onChange={(e) => setCreateForm((p) => ({ ...p, botId: e.target.value }))}
              className="w-full px-3 py-2 text-[13px] text-[var(--mb-text-primary)] bg-[var(--mb-surface-900)] border border-[var(--mb-border-soft)] outline-none"
            >
              {bots.map((b) => (
                <option key={b._id} value={b._id}>{b.name || b.bot_name}</option>
              ))}
            </select>
            <p className="text-[11px] text-[var(--mb-text-caption)] mt-1">Define onde os códigos poderão ser resgatados.</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <InputField label="Quantidade" type="number" value={createForm.quantity} onChange={(e) => setCreateForm((p) => ({ ...p, quantity: parseInt(e.target.value) || 1 }))} />
            <InputField label="Valor Individual" type="number" value={createForm.amount} onChange={(e) => setCreateForm((p) => ({ ...p, amount: parseFloat(e.target.value) || 0 }))} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <InputField label="Usos por código" type="number" value={createForm.max_uses} onChange={(e) => setCreateForm((p) => ({ ...p, max_uses: parseInt(e.target.value) || 1 }))} />
            <InputField label="Expiração" type="date" value={createForm.expiresAt} onChange={(e) => setCreateForm((p) => ({ ...p, expiresAt: e.target.value }))} />
          </div>

          <InputField label="Prefixo dos códigos" value={createForm.prefix} onChange={(e) => setCreateForm((p) => ({ ...p, prefix: e.target.value }))} placeholder="Ex: TG" />

          <div className="flex items-center justify-between pt-3 border-t border-[var(--mb-border-soft)]">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--mb-text-caption)]">Volume da Emissão</span>
              <p className="text-lg font-bold text-[var(--mb-success)]">{formatBRL(createForm.quantity * createForm.amount)}</p>
            </div>
            <ActionButton variant="accent" loading={createMut.isPending} onClick={() => createMut.mutate(createForm)}>
              <Gift className="w-4 h-4 mr-1" />Gerar códigos
            </ActionButton>
          </div>
        </div>
      </Modal>
    </div>
  );
}
