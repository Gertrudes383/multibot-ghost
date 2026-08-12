import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  UserPlus, DollarSign, Users, Clock, ArrowUpRight,
  Search, RefreshCw, Trophy, Save,
} from 'lucide-react';
import { getTelegramAffiliates, updateAffiliateCommission, getBots } from '@services/admin.service';
import { formatBRL, formatNumber, formatDateTime } from '@utils/format';
import { toast } from '@stores/toastStore';
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

function TopAffiliate({ rank, username, telegramId, referrals, earnings, maxEarnings }) {
  const pct = maxEarnings > 0 ? (earnings / maxEarnings) * 100 : 0;
  return (
    <div className="flex items-center gap-3 py-3 border-b border-[var(--mb-border-soft)] last:border-0">
      <span className="text-[12px] font-mono text-[var(--mb-text-caption)] w-6">{String(rank).padStart(2, '0')}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <div>
            <span className="text-[13px] font-medium text-[var(--mb-text-primary)]">{username ? `@${username}` : 'Sem @username'}</span>
            {telegramId && <span className="ml-2 text-[11px] text-[var(--mb-text-caption)]">ID {telegramId} · {referrals} indicações</span>}
          </div>
          <div className="text-right">
            <span className="text-[14px] font-bold text-[var(--mb-success)]">{formatBRL(earnings)}</span>
            <p className="text-[10px] text-[var(--mb-text-caption)]">em comissões</p>
          </div>
        </div>
        <div className="h-1 bg-[rgba(143,209,255,0.1)] overflow-hidden">
          <div className="h-full bg-[var(--mb-success)] transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}

export default function TelegramAffiliatesPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [botId, setBotId] = useState('');
  const [commissionPct, setCommissionPct] = useState(20);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin', 'telegram', 'affiliates', page, query, botId],
    queryFn: () => getTelegramAffiliates({ page, search: query || undefined, botId: botId || undefined }),
  });

  const { data: botsData } = useQuery({
    queryKey: ['admin', 'bots'],
    queryFn: getBots,
  });

  const bots = Array.isArray(botsData?.bots) ? botsData.bots : Array.isArray(botsData) ? botsData : [];
  const affiliates = data?.affiliates || [];

  const totalEarnings = affiliates.reduce((s, a) => s + (a.earnings || 0), 0);
  const totalReferrals = affiliates.reduce((s, a) => s + (a.referrals || 0), 0);
  const topAffiliates = [...affiliates].sort((a, b) => (b.earnings || 0) - (a.earnings || 0)).slice(0, 5);
  const maxEarnings = topAffiliates[0]?.earnings || 1;

  const commissionMut = useMutation({
    mutationFn: (pct) => updateAffiliateCommission({ percentage: pct, botId: botId || undefined }),
    onSuccess: () => toast.success('Regra de comissão atualizada'),
    onError: (e) => toast.error(e?.data?.message || 'Erro ao salvar regra'),
  });

  const columns = [
    {
      key: 'username', label: 'Afiliado', render: (v, row) => (
        <div>
          <span className="text-[13px] font-medium text-[var(--mb-text-primary)]">{v ? `@${v}` : `tg_${row.telegramId}`}</span>
          {row.telegramId && <p className="text-[11px] text-[var(--mb-text-caption)]">TG {row.telegramId}</p>}
        </div>
      ),
    },
    { key: 'botName', label: 'Bot', render: (v) => v ? <span className="px-2 py-0.5 text-[11px] bg-[rgba(53,197,255,0.08)] text-[var(--mb-text-muted)]">{v}</span> : '—' },
    {
      key: 'referrals', label: 'Indicados', render: (v) => (
        <div>
          <span className="text-[14px] font-semibold text-[var(--mb-text-primary)]">{formatNumber(v || 0)}</span>
          <p className="text-[10px] text-[var(--mb-text-caption)]">cadastros atribuídos</p>
        </div>
      ),
    },
    {
      key: 'earnings', label: 'Comissões', render: (v) => (
        <span className="text-[14px] font-semibold text-[var(--mb-success)]">{formatBRL(v || 0)}</span>
      ),
    },
    {
      key: 'conversionRate', label: 'Conversão', render: (v, row) => {
        const rate = v || (row.referrals > 0 ? ((row.activeReferrals || 0) / row.referrals * 100) : 0);
        return <span className="text-[13px] text-[var(--mb-text-muted)]">{rate.toFixed(1)}%</span>;
      },
    },
    {
      key: 'status', label: 'Status', render: (v) => (
        <StatusBadge
          status={v === 'active' ? 'active' : 'inactive'}
          label={v === 'active' ? 'Ativo' : 'Inativo'}
        />
      ),
    },
    {
      key: 'lastActivity', label: 'Última atividade', render: (v) => (
        <span className="text-[12px] text-[var(--mb-text-muted)]">{v ? formatDateTime(v) : '—'}</span>
      ),
    },
  ];

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <UserPlus className="w-4 h-4 text-[var(--mb-accent-300)]" />
            <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--mb-accent-300)]">Programa de Afiliados</span>
            <StatusBadge status="active" label="rede ativa" />
          </div>
          <h1 className="text-xl font-bold text-[var(--mb-text-primary)]">Afiliados Telegram</h1>
          <p className="text-[13px] text-[var(--mb-text-caption)] mt-0.5">Comissões, desempenho da rede e indicadores por afiliado.</p>
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
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <KpiGroup icon={DollarSign} title="Comissões" accent="var(--mb-success)" items={[
          { label: 'Distribuídas', value: formatBRL(data?.totalEarnings || totalEarnings), subtitle: 'Total acumulado', color: 'var(--mb-success)' },
          { label: 'Hoje', value: formatBRL(data?.todayEarnings || 0), subtitle: 'Movimentação diária', color: 'var(--mb-success)' },
        ]} />
        <KpiGroup icon={Users} title="Rede" items={[
          { label: 'Afiliados', value: formatNumber(data?.totalAffiliates || affiliates.length), subtitle: 'Pessoas na rede' },
          { label: 'Indicados', value: formatNumber(data?.totalReferrals || totalReferrals), subtitle: 'Cadastros atribuídos' },
        ]} />
        <KpiGroup icon={Clock} title="Período" items={[
          { label: '7 Dias', value: formatBRL(data?.last7dEarnings || 0), subtitle: 'Comissões recentes', color: 'var(--mb-success)' },
          { label: '30 Dias', value: formatBRL(data?.last30dEarnings || totalEarnings), subtitle: 'Comissões mensais', color: 'var(--mb-success)' },
        ]} />
      </div>

      {/* Commission Rule + Top Performance */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Commission Rule */}
        <Surface className="p-5">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-4 h-4 text-[var(--mb-success)]" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--mb-success)]">Regra de Comissão</span>
          </div>
          <h3 className="text-[15px] font-semibold text-[var(--mb-text-primary)] mb-1">Comissão padrão</h3>
          <p className="text-[12px] text-[var(--mb-text-caption)] mb-4">Usuários sem percentual próprio herdam esta regra.</p>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 flex-1">
              <span className="text-[12px] text-[var(--mb-text-muted)]">Percentual</span>
              <div className="flex items-center border border-[var(--mb-border-soft)] bg-[var(--mb-surface-900)]">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={commissionPct}
                  onChange={(e) => setCommissionPct(parseInt(e.target.value) || 0)}
                  className="w-16 px-3 py-2 text-[14px] font-semibold text-[var(--mb-text-primary)] bg-transparent outline-none text-center"
                />
                <span className="pr-3 text-[14px] text-[var(--mb-text-caption)]">%</span>
              </div>
            </div>
            <ActionButton variant="accent" loading={commissionMut.isPending} onClick={() => commissionMut.mutate(commissionPct)}>
              <Save className="w-4 h-4 mr-1" />Salvar regra
            </ActionButton>
          </div>
        </Surface>

        {/* Performance */}
        <Surface className="p-5">
          <div className="flex items-center gap-2 mb-1">
            <Trophy className="w-4 h-4 text-[var(--mb-accent-300)]" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--mb-accent-300)]">Performance</span>
          </div>
          <h3 className="text-[15px] font-semibold text-[var(--mb-text-primary)] mb-1">Principais indicadores</h3>
          <p className="text-[12px] text-[var(--mb-text-caption)] mb-3">Quem mais movimenta a rede neste bot.</p>
          <div>
            {topAffiliates.length > 0 ? topAffiliates.map((a, i) => (
              <TopAffiliate
                key={a._id || i}
                rank={i + 1}
                username={a.username}
                telegramId={a.telegramId}
                referrals={a.referrals || 0}
                earnings={a.earnings || 0}
                maxEarnings={maxEarnings}
              />
            )) : (
              <p className="text-[12px] text-[var(--mb-text-caption)] py-4 text-center">Nenhum afiliado registrado</p>
            )}
          </div>
        </Surface>
      </div>

      {/* Directory */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--mb-accent-300)]">Diretório da Rede</span>
        </div>
        <h3 className="text-[15px] font-semibold text-[var(--mb-text-primary)] mb-1">Usuários com indicações</h3>
        <p className="text-[12px] text-[var(--mb-text-caption)] mb-4">Percentuais individuais, atividade e retorno financeiro por afiliado.</p>

        <div className="flex gap-2 mb-4">
          <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-[var(--mb-surface-900)] border border-[var(--mb-border-soft)]">
            <Search className="w-4 h-4 text-[var(--mb-text-caption)]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { setQuery(search); setPage(1); } }}
              placeholder="@usuário, Telegram ID ou tg"
              className="flex-1 bg-transparent text-[13px] text-[var(--mb-text-primary)] outline-none placeholder:text-[var(--mb-text-caption)]"
            />
          </div>
          <ActionButton variant="ghost" onClick={() => { setQuery(search); setPage(1); }}>
            <Search className="w-4 h-4 mr-1" />Pesquisar
          </ActionButton>
          <ActionButton variant="ghost" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`w-4 h-4 mr-1 ${isFetching ? 'animate-spin' : ''}`} />Atualizar
          </ActionButton>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20"><Spinner size="lg" /></div>
        ) : (
          <>
            <DataTable columns={columns} data={affiliates} emptyTitle="Nenhum afiliado encontrado" emptyDescription="O programa de afiliados ainda não possui membros" />
            <div className="mt-4">
              <Pagination page={page} totalPages={data?.totalPages || 1} onPageChange={setPage} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
