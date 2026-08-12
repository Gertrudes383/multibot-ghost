import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bot, Plus, Power, Edit, Trash2 } from 'lucide-react';
import { getBots, createBot, updateBot, deleteBot, toggleBot } from '@services/admin.service';
import { formatNumber, formatDate, maskToken } from '@utils/format';
import { toast } from '@stores/toastStore';
import DataTable from '@components/ui/DataTable';
import ActionButton from '@components/ui/ActionButton';
import StatusBadge from '@components/ui/StatusBadge';
import Modal from '@components/ui/Modal';
import InputField from '@components/ui/InputField';

export default function TelegramBotsPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editBot, setEditBot] = useState(null);
  const [form, setForm] = useState({ bot_name: '', bot_token: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'telegram', 'bots'],
    queryFn: getBots,
  });

  const createMut = useMutation({
    mutationFn: createBot,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'telegram', 'bots'] }); toast.success('Bot criado com sucesso'); setShowCreate(false); setForm({ bot_name: '', bot_token: '' }); },
    onError: (e) => toast.error(e?.data?.message || 'Erro ao criar bot'),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data: d }) => updateBot(id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'telegram', 'bots'] }); toast.success('Bot atualizado'); setEditBot(null); },
    onError: (e) => toast.error(e?.data?.message || 'Erro ao atualizar'),
  });

  const deleteMut = useMutation({
    mutationFn: deleteBot,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'telegram', 'bots'] }); toast.success('Bot removido'); },
    onError: (e) => toast.error(e?.data?.message || 'Erro ao remover'),
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, data: d }) => toggleBot(id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'telegram', 'bots'] }); toast.success('Status alterado'); },
    onError: (e) => toast.error(e?.data?.message || 'Erro ao alterar status'),
  });

  const columns = [
    { key: 'bot_name', label: 'Nome', render: (v, row) => <span className="flex items-center gap-2 font-medium text-[var(--mb-text-primary)]"><Bot className="w-4 h-4" />{v || row.store_name}</span> },
    { key: 'bot_username', label: 'Username', render: (v) => <span className="font-mono text-[12px]">@{v}</span> },
    { key: 'status', label: 'Status', render: (v) => <StatusBadge status={v === 'active' ? 'active' : 'inactive'} label={v === 'active' ? 'Ativo' : 'Inativo'} /> },
    { key: 'total_users', label: 'Usuarios', render: (v) => formatNumber(v || 0) },
    { key: 'createdAt', label: 'Criado em', render: (v) => formatDate(v) },
    {
      key: '_actions', label: 'Acoes', render: (_, row) => (
        <div className="flex gap-1">
          <ActionButton variant="ghost" size="sm" onClick={() => toggleMut.mutate({ id: row._id, data: { status: row.status !== 'active' ? 'active' : 'inactive' } })}><Power className="w-3.5 h-3.5" /></ActionButton>
          <ActionButton variant="ghost" size="sm" onClick={() => { setEditBot(row); setForm({ bot_name: row.bot_name || row.store_name || '', bot_token: '' }); }}><Edit className="w-3.5 h-3.5" /></ActionButton>
          <ActionButton variant="danger" size="sm" onClick={() => { if (confirm('Remover bot?')) deleteMut.mutate(row._id); }}><Trash2 className="w-3.5 h-3.5" /></ActionButton>
        </div>
      ),
    },
  ];

  const bots = Array.isArray(data?.bots) ? data.bots : Array.isArray(data) ? data : [];

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-[var(--mb-text-primary)]">Bots do Telegram</h1>
        <ActionButton onClick={() => { setShowCreate(true); setForm({ bot_name: '', bot_token: '' }); }}><Plus className="w-4 h-4 mr-1" />Novo Bot</ActionButton>
      </div>

      <DataTable columns={columns} data={bots} isLoading={isLoading} emptyTitle="Nenhum bot cadastrado" emptyDescription="Crie um bot para comecar" />

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Novo Bot">
        <div className="space-y-4">
          <InputField label="Nome da Loja" value={form.bot_name} onChange={(e) => setForm((p) => ({ ...p, bot_name: e.target.value }))} placeholder="Nome do bot" />
          <InputField label="Token do BotFather" value={form.bot_token} onChange={(e) => setForm((p) => ({ ...p, bot_token: e.target.value }))} placeholder="123456:ABC-DEF..." />
          <ActionButton variant="accent" className="w-full" loading={createMut.isPending} onClick={() => createMut.mutate(form)}>Criar Bot</ActionButton>
        </div>
      </Modal>

      <Modal open={!!editBot} onClose={() => setEditBot(null)} title="Editar Bot">
        <div className="space-y-4">
          <InputField label="Nome da Loja" value={form.bot_name} onChange={(e) => setForm((p) => ({ ...p, bot_name: e.target.value }))} />
          <InputField label="Token (deixe vazio para manter)" value={form.bot_token} onChange={(e) => setForm((p) => ({ ...p, bot_token: e.target.value }))} placeholder="Somente se quiser trocar" />
          <ActionButton variant="accent" className="w-full" loading={updateMut.isPending} onClick={() => updateMut.mutate({ id: editBot._id, data: { bot_name: form.bot_name, store_name: form.bot_name } })}>Salvar</ActionButton>
        </div>
      </Modal>
    </div>
  );
}
