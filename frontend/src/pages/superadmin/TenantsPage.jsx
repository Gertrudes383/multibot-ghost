import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Shield, Plus, Edit, Trash2, Users, ArrowUpRight,
  Key, CheckCircle, XCircle, Calendar, Bot, DollarSign,
  Clock, LogOut, UserPlus,
} from 'lucide-react';
import {
  getTenants, createTenant, updateTenant, deleteTenant,
  changeSuperadminPassword, createSupportUser,
} from '@services/superadmin.service';
import { formatDate, formatNumber, formatBRL } from '@utils/format';
import { toast } from '@stores/toastStore';
import { useAuthStore } from '@stores/authStore';
import Surface from '@components/ui/Surface';
import DataTable from '@components/ui/DataTable';
import ActionButton from '@components/ui/ActionButton';
import StatusBadge from '@components/ui/StatusBadge';
import Modal from '@components/ui/Modal';
import InputField from '@components/ui/InputField';
import Pagination from '@components/ui/Pagination';
import Spinner from '@components/ui/Spinner';

const PLAN_OPTS = [
  { value: 'basic', label: 'Basic' },
  { value: 'premium', label: 'Premium' },
  { value: 'enterprise', label: 'Enterprise' },
];

const STATUS_OPTS = [
  { value: 'active', label: 'Ativo' },
  { value: 'cancelled', label: 'Cancelado' },
  { value: 'expired', label: 'Expirado' },
  { value: 'pending', label: 'Pendente' },
];

export default function TenantsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);

  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [manageItem, setManageItem] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current: '', newPassword: '' });
  const [supportForm, setSupportForm] = useState({ username: '', password: '' });

  const [form, setForm] = useState({
    username: '', password: '', email: '',
    plan: 'basic', status: 'active', maxBots: '10',
    balance: '0', expiresAt: '',
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['superadmin', 'tenants', page],
    queryFn: () => getTenants({ page }),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['superadmin', 'tenants'] });

  const createMut = useMutation({
    mutationFn: createTenant,
    onSuccess: () => { toast.success('Tenant criado'); setShowCreate(false); invalidate(); },
    onError: (e) => toast.error(e?.data?.message || 'Erro ao criar'),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data: d }) => updateTenant(id, d),
    onSuccess: () => { toast.success('Tenant atualizado'); setEditItem(null); invalidate(); },
    onError: (e) => toast.error(e?.data?.message || 'Erro ao atualizar'),
  });

  const deleteMut = useMutation({
    mutationFn: deleteTenant,
    onSuccess: () => { toast.success('Tenant removido'); setManageItem(null); invalidate(); },
    onError: (e) => toast.error(e?.data?.message || 'Erro ao remover'),
  });

  const passwordMut = useMutation({
    mutationFn: changeSuperadminPassword,
    onSuccess: () => { toast.success('Senha alterada'); setShowPassword(false); setPasswordForm({ current: '', newPassword: '' }); },
    onError: (e) => toast.error(e?.data?.message || 'Erro ao alterar senha'),
  });

  const supportMut = useMutation({
    mutationFn: (d) => createSupportUser({ ...d, tenantId: manageItem?._id }),
    onSuccess: () => { toast.success('Usuário suporte criado'); setSupportForm({ username: '', password: '' }); },
    onError: (e) => toast.error(e?.data?.message || 'Erro ao criar'),
  });

  function openEdit(row) {
    setEditItem(row);
    setForm({
      username: row.username || row.name || '',
      password: '',
      email: row.email || '',
      plan: row.plan || 'basic',
      status: row.status || 'active',
      maxBots: String(row.maxBots ?? row.max_bots ?? '10'),
      balance: String(row.balance ?? '0'),
      expiresAt: row.expiresAt?.slice(0, 10) || row.expires_at?.slice(0, 10) || '',
    });
  }

  function u(field, value) { setForm((f) => ({ ...f, [field]: value })); }

  const tenants = data?.tenants || data?.data || [];
  const totalTenants = data?.total || tenants.length;
  const activeTenants = tenants.filter((t) => t.status === 'active').length;
  const pendingTenants = tenants.filter((t) => t.status === 'pending').length;
  const expiredTenants = tenants.filter((t) => t.status === 'expired').length;
  const totalBots = tenants.reduce((s, t) => s + (t.botsCount || t.bots_count || 0), 0);
  const totalRevenue = tenants.reduce((s, t) => s + (t.revenue || t.totalRecharges || 0), 0);

  const columns = [
    {
      key: 'name', label: 'Tenant', render: (v, row) => (
        <div>
          <span className="text-[14px] font-bold text-[var(--mb-text-primary)]">{row.username || v}</span>
          <p className="text-[11px] text-[var(--mb-text-caption)]">Tenant #{row.tenantId || row._id?.slice(-6)}</p>
        </div>
      ),
    },
    {
      key: 'plan', label: 'Plano', render: (v, row) => (
        <div>
          <span className="text-[13px] font-semibold text-[var(--mb-text-primary)]">{v || 'basic'}</span>
          <p className="text-[11px] text-[var(--mb-text-caption)]">até {row.maxBots || row.max_bots || '?'} bot(s)</p>
        </div>
      ),
    },
    {
      key: 'botsCount', label: 'Bots', render: (v, row) => (
        <div>
          <span className="text-[13px] font-semibold text-[var(--mb-text-primary)]">{v || row.bots_count || 0} bot(s)</span>
          {row.botNames && <p className="text-[11px] text-[var(--mb-text-caption)]">@{row.botNames[0]}</p>}
        </div>
      ),
    },
    {
      key: 'totalRecharges', label: 'Recargas', render: (v, row) => (
        <span className="text-[13px] font-semibold text-[var(--mb-success)]">{formatBRL(v || row.recharges || 0)}</span>
      ),
    },
    {
      key: 'status', label: 'Status', render: (v) => (
        <StatusBadge
          status={v === 'active' ? 'active' : v === 'cancelled' ? 'error' : v === 'expired' ? 'error' : 'pending'}
          label={v === 'active' ? 'Ativo' : v === 'cancelled' ? 'Cancelado' : v === 'expired' ? 'Expirado' : 'Pendente'}
        />
      ),
    },
    {
      key: 'expiresAt', label: 'Expira em', render: (v, row) => (
        <span className="text-[12px] text-[var(--mb-text-muted)]">{formatDate(v || row.expires_at)}</span>
      ),
    },
    {
      key: 'balance', label: 'Valor', render: (v) => (
        <span className="text-[13px] text-[var(--mb-text-primary)]">{formatBRL(v || 0)}</span>
      ),
    },
    {
      key: '_actions', label: 'Ações', render: (_, row) => (
        <div className="flex items-center gap-1">
          <ActionButton variant="ghost" size="sm" onClick={() => openEdit(row)}>
            <Edit className="w-3.5 h-3.5" />
          </ActionButton>
          <ActionButton variant="ghost" size="sm" onClick={() => setManageItem(row)}>
            <Users className="w-3.5 h-3.5" />
          </ActionButton>
          <ActionButton variant="ghost" size="sm" onClick={() => {
            updateMut.mutate({ id: row._id, data: { extend: true } });
          }}>
            Estender
          </ActionButton>
          <ActionButton variant="danger" size="sm" onClick={() => {
            if (confirm('Cancelar tenant?')) updateMut.mutate({ id: row._id, data: { status: 'cancelled' } });
          }}>
            Cancelar
          </ActionButton>
          <ActionButton variant="danger" size="sm" onClick={() => {
            if (confirm('Deletar tenant permanentemente?')) deleteMut.mutate(row._id);
          }}>
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
            <Shield className="w-4 h-4 text-[var(--mb-accent-300)]" />
            <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--mb-accent-300)]">Controle Global</span>
            <StatusBadge status="active" label="operação segura" />
          </div>
          <h1 className="text-2xl font-bold text-[var(--mb-text-primary)]">
            <span className="text-[var(--mb-accent-300)]">Central</span> SuperAdmin
          </h1>
          <p className="text-[13px] text-[var(--mb-text-caption)] mt-0.5 max-w-xl">
            Gerencie tenants, assinaturas e capacidade dos bots em uma única visão operacional.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right mr-3">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--mb-text-caption)]">Sessão Atual</span>
            <p className="text-[13px] font-bold text-[var(--mb-text-primary)]">{user?.username || 'super'}</p>
          </div>
          <ActionButton variant="ghost" onClick={() => setShowPassword(true)}>
            <Key className="w-4 h-4 mr-1" />Minha senha
          </ActionButton>
          <ActionButton variant="accent" onClick={() => { setShowCreate(true); setForm({ username: '', password: '', email: '', plan: 'basic', status: 'active', maxBots: '10', balance: '0', expiresAt: '' }); }}>
            <UserPlus className="w-4 h-4 mr-1" />Novo usuário
          </ActionButton>
          <ActionButton variant="ghost" onClick={() => { if (logout) logout(); navigate('/superadmin/login'); }}>
            <LogOut className="w-4 h-4 mr-1" />Sair
          </ActionButton>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        <Surface className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-[var(--mb-accent-300)]" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--mb-text-caption)]">Total de Tenants</span>
            <ArrowUpRight className="w-3 h-3 text-[var(--mb-text-caption)] ml-auto" />
          </div>
          <p className="text-2xl font-bold text-[var(--mb-text-primary)]">{formatNumber(totalTenants)}</p>
        </Surface>
        <Surface className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-4 h-4 text-[var(--mb-success)]" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--mb-text-caption)]">Tenants Ativos</span>
            <ArrowUpRight className="w-3 h-3 text-[var(--mb-text-caption)] ml-auto" />
          </div>
          <p className="text-2xl font-bold text-[var(--mb-success)]">{formatNumber(activeTenants)}</p>
        </Surface>
        <Surface className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-[var(--mb-warning)]" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--mb-text-caption)]">Pendentes</span>
            <ArrowUpRight className="w-3 h-3 text-[var(--mb-text-caption)] ml-auto" />
          </div>
          <p className="text-2xl font-bold text-[var(--mb-text-primary)]">{formatNumber(pendingTenants)}</p>
        </Surface>
        <Surface className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="w-4 h-4 text-[var(--mb-error)]" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--mb-text-caption)]">Expirados</span>
            <ArrowUpRight className="w-3 h-3 text-[var(--mb-text-caption)] ml-auto" />
          </div>
          <p className="text-2xl font-bold text-[var(--mb-text-primary)]">{formatNumber(expiredTenants)}</p>
        </Surface>
        <Surface className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Bot className="w-4 h-4 text-[var(--mb-accent-300)]" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--mb-text-caption)]">Total de Bots</span>
            <ArrowUpRight className="w-3 h-3 text-[var(--mb-text-caption)] ml-auto" />
          </div>
          <p className="text-2xl font-bold text-[var(--mb-text-primary)]">{formatNumber(totalBots)}</p>
        </Surface>
        <Surface className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-[var(--mb-success)]" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--mb-text-caption)]">Receita Total</span>
            <ArrowUpRight className="w-3 h-3 text-[var(--mb-text-caption)] ml-auto" />
          </div>
          <p className="text-2xl font-bold text-[var(--mb-success)]">{formatBRL(totalRevenue)}</p>
        </Surface>
      </div>

      {/* Tenants Table */}
      <div>
        <Surface className="p-4 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Shield className="w-4 h-4 text-[var(--mb-accent-300)]" />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--mb-accent-300)]">Diretório Operacional</span>
              </div>
              <h3 className="text-[16px] font-bold text-[var(--mb-text-primary)]">Tenants e assinaturas</h3>
              <p className="text-[12px] text-[var(--mb-text-caption)]">Capacidade, receita e acesso de cada operação cadastrada.</p>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--mb-text-caption)]">Registros</span>
              <p className="text-xl font-bold text-[var(--mb-text-primary)]">{formatNumber(totalTenants)}</p>
            </div>
          </div>
        </Surface>

        {isLoading ? (
          <div className="flex justify-center py-20"><Spinner size="lg" /></div>
        ) : (
          <>
            <DataTable columns={columns} data={tenants} emptyTitle="Nenhum tenant" emptyDescription="Crie o primeiro tenant para começar." />
            <div className="mt-4">
              <Pagination page={page} totalPages={data?.totalPages || 1} onPageChange={setPage} />
            </div>
          </>
        )}
      </div>

      {/* Create Tenant Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="">
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1">
            <UserPlus className="w-4 h-4 text-[var(--mb-accent-300)]" />
            <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--mb-accent-300)]">Novo Tenant</span>
          </div>
          <h2 className="text-lg font-bold text-[var(--mb-text-primary)]">Criar tenant</h2>
          <p className="text-[12px] text-[var(--mb-text-caption)]">Defina credenciais, plano e limites.</p>
        </div>
        <div className="space-y-4">
          <InputField label="Username" value={form.username} onChange={(e) => u('username', e.target.value)} />
          <InputField label="Senha" type="password" value={form.password} onChange={(e) => u('password', e.target.value)} />
          <InputField label="Email" type="email" value={form.email} onChange={(e) => u('email', e.target.value)} placeholder="email@exemplo.com" />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[12px] font-medium text-[var(--mb-text-muted)] mb-1.5">Plano</label>
              <select value={form.plan} onChange={(e) => u('plan', e.target.value)} className="w-full px-3 py-2.5 text-[13px] text-[var(--mb-text-primary)] bg-[var(--mb-surface-900)] border border-[var(--mb-border-soft)] outline-none">
                {PLAN_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[12px] font-medium text-[var(--mb-text-muted)] mb-1.5">Status</label>
              <select value={form.status} onChange={(e) => u('status', e.target.value)} className="w-full px-3 py-2.5 text-[13px] text-[var(--mb-text-primary)] bg-[var(--mb-surface-900)] border border-[var(--mb-border-soft)] outline-none">
                {STATUS_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <InputField label="Max Bots" type="number" value={form.maxBots} onChange={(e) => u('maxBots', e.target.value)} />
            <InputField label="Saldo (R$)" type="number" value={form.balance} onChange={(e) => u('balance', e.target.value)} />
          </div>
          <InputField label="Expira em" type="date" value={form.expiresAt} onChange={(e) => u('expiresAt', e.target.value)} />
          <div className="flex gap-2">
            <ActionButton variant="ghost" className="flex-1" onClick={() => setShowCreate(false)}>Cancelar</ActionButton>
            <ActionButton variant="accent" className="flex-1" loading={createMut.isPending} onClick={() => createMut.mutate({
              ...form, maxBots: Number(form.maxBots), balance: Number(form.balance),
            })}>
              Criar Tenant
            </ActionButton>
          </div>
        </div>
      </Modal>

      {/* Edit Tenant Modal */}
      <Modal open={!!editItem} onClose={() => setEditItem(null)} title="">
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1">
            <Edit className="w-4 h-4 text-[var(--mb-accent-300)]" />
            <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--mb-accent-300)]">Configuração do Tenant</span>
          </div>
          <h2 className="text-lg font-bold text-[var(--mb-text-primary)]">Editar tenant</h2>
          <p className="text-[12px] text-[var(--mb-text-caption)]">ID {editItem?.tenantId || editItem?._id?.slice(-6)} · Ajuste acesso, plano e limites.</p>
        </div>
        <div className="space-y-4">
          <InputField label="Username" value={form.username} onChange={(e) => u('username', e.target.value)} />
          <InputField label="Nova Senha (deixe vazio para manter)" type="password" value={form.password} onChange={(e) => u('password', e.target.value)} />
          <InputField label="Email" type="email" value={form.email} onChange={(e) => u('email', e.target.value)} placeholder="email@exemplo.com" />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[12px] font-medium text-[var(--mb-text-muted)] mb-1.5">Plano</label>
              <select value={form.plan} onChange={(e) => u('plan', e.target.value)} className="w-full px-3 py-2.5 text-[13px] text-[var(--mb-text-primary)] bg-[var(--mb-surface-900)] border border-[var(--mb-border-soft)] outline-none">
                {PLAN_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[12px] font-medium text-[var(--mb-text-muted)] mb-1.5">Status</label>
              <select value={form.status} onChange={(e) => u('status', e.target.value)} className="w-full px-3 py-2.5 text-[13px] text-[var(--mb-text-primary)] bg-[var(--mb-surface-900)] border border-[var(--mb-border-soft)] outline-none">
                {STATUS_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <InputField label="Max Bots" type="number" value={form.maxBots} onChange={(e) => u('maxBots', e.target.value)} />
            <InputField label="Saldo (R$)" type="number" value={form.balance} onChange={(e) => u('balance', e.target.value)} />
          </div>
          <InputField label="Expira em" type="date" value={form.expiresAt} onChange={(e) => u('expiresAt', e.target.value)} />
          <div className="flex gap-2">
            <ActionButton variant="ghost" className="flex-1" onClick={() => setEditItem(null)}>Cancelar</ActionButton>
            <ActionButton variant="accent" className="flex-1" loading={updateMut.isPending} onClick={() => updateMut.mutate({
              id: editItem._id,
              data: { ...form, maxBots: Number(form.maxBots), balance: Number(form.balance) },
            })}>
              <Edit className="w-4 h-4 mr-1" />Salvar
            </ActionButton>
          </div>
        </div>
      </Modal>

      {/* Manage Users Modal */}
      <Modal open={!!manageItem} onClose={() => setManageItem(null)} title="">
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-4 h-4 text-[var(--mb-accent-300)]" />
            <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--mb-accent-300)]">Diretório Operacional</span>
          </div>
          <h2 className="text-lg font-bold text-[var(--mb-text-primary)]">
            Gerenciar Usuários / {manageItem?.username || manageItem?.name}
          </h2>
          <p className="text-[12px] text-[var(--mb-text-caption)]">Administre o owner e os acessos de suporte deste tenant.</p>
        </div>

        {/* Owner Section */}
        <Surface className="p-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--mb-accent-300)]">Conta Principal</span>
          </div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="text-[14px] font-semibold text-[var(--mb-text-primary)]">Usuário Principal (Owner)</span>
            </div>
            <StatusBadge status="active" label="OWNER" />
          </div>
          <div className="flex items-center gap-3 p-3 bg-[var(--mb-surface-900)] border border-[var(--mb-border-soft)]">
            <div className="w-8 h-8 flex items-center justify-center bg-[rgba(53,197,255,0.08)]">
              <Users className="w-4 h-4 text-[var(--mb-accent-300)]" />
            </div>
            <div className="flex-1">
              <span className="text-[13px] font-semibold text-[var(--mb-text-primary)]">{manageItem?.username || manageItem?.name}</span>
              <p className="text-[11px] text-[var(--mb-text-caption)]">Tenant ID {manageItem?.tenantId || manageItem?._id?.slice(-6)}</p>
            </div>
            <ActionButton variant="ghost" size="sm" onClick={() => openEdit(manageItem)}>
              <Key className="w-3.5 h-3.5 mr-1" />Editar Credenciais
            </ActionButton>
            <ActionButton variant="danger" size="sm" onClick={() => {
              if (confirm('Deletar tenant permanentemente?')) deleteMut.mutate(manageItem._id);
            }}>
              <Trash2 className="w-3.5 h-3.5 mr-1" />Deletar Tenant
            </ActionButton>
          </div>
        </Surface>

        {/* Support Users Section */}
        <Surface className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--mb-accent-300)]">Acessos Delegados</span>
              <h4 className="text-[14px] font-semibold text-[var(--mb-text-primary)]">Usuários de suporte</h4>
            </div>
            <ActionButton variant="accent" size="sm" onClick={() => setSupportForm({ username: '', password: '' })}>
              <UserPlus className="w-3.5 h-3.5 mr-1" />Criar Usuário Suporte
            </ActionButton>
          </div>

          {supportForm.username !== undefined && (
            <div className="p-3 bg-[var(--mb-surface-900)] border border-[var(--mb-border-soft)] mb-3 space-y-3">
              <InputField label="Username" value={supportForm.username} onChange={(e) => setSupportForm((p) => ({ ...p, username: e.target.value }))} placeholder="Nome de acesso" />
              <InputField label="Senha" type="password" value={supportForm.password} onChange={(e) => setSupportForm((p) => ({ ...p, password: e.target.value }))} />
              <ActionButton variant="accent" size="sm" loading={supportMut.isPending} disabled={!supportForm.username || !supportForm.password}
                onClick={() => supportMut.mutate(supportForm)}>
                Criar
              </ActionButton>
            </div>
          )}

          <div className="text-center py-8">
            <Users className="w-8 h-8 text-[var(--mb-text-caption)] mx-auto mb-2" />
            <p className="text-[13px] font-semibold text-[var(--mb-text-primary)]">Nenhum usuário de suporte cadastrado</p>
            <p className="text-[11px] text-[var(--mb-text-caption)]">Crie um acesso delegado para começar.</p>
          </div>
        </Surface>
      </Modal>

      {/* Change Password Modal */}
      <Modal open={showPassword} onClose={() => setShowPassword(false)} title="">
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1">
            <Key className="w-4 h-4 text-[var(--mb-accent-300)]" />
            <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--mb-accent-300)]">Segurança</span>
          </div>
          <h2 className="text-lg font-bold text-[var(--mb-text-primary)]">Alterar minha senha</h2>
        </div>
        <div className="space-y-4">
          <InputField label="Senha atual" type="password" value={passwordForm.current} onChange={(e) => setPasswordForm((p) => ({ ...p, current: e.target.value }))} />
          <InputField label="Nova senha" type="password" value={passwordForm.newPassword} onChange={(e) => setPasswordForm((p) => ({ ...p, newPassword: e.target.value }))} />
          <ActionButton variant="accent" className="w-full" loading={passwordMut.isPending} onClick={() => passwordMut.mutate(passwordForm)}>
            <Key className="w-4 h-4 mr-1" />Alterar Senha
          </ActionButton>
        </div>
      </Modal>
    </div>
  );
}
