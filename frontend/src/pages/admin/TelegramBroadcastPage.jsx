import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Megaphone, Send } from 'lucide-react';
import { getTelegramBroadcast, sendTelegramBroadcast } from '@services/admin.service';
import { formatDateTime } from '@utils/format';
import { toast } from '@stores/toastStore';
import GlassPanel from '@components/ui/GlassPanel';
import ActionButton from '@components/ui/ActionButton';
import DataTable from '@components/ui/DataTable';
import Pagination from '@components/ui/Pagination';

export default function TelegramBroadcastPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [message, setMessage] = useState('');
  const [target, setTarget] = useState('all');

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'telegram', 'broadcast', page],
    queryFn: () => getTelegramBroadcast({ page }),
  });

  const sendMut = useMutation({
    mutationFn: () => sendTelegramBroadcast({ message, target }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['admin', 'telegram', 'broadcast'] });
      toast.success(`Broadcast enviado para ${res?.sent || 0} usuarios`);
      setMessage('');
    },
    onError: (e) => toast.error(e?.data?.message || 'Erro ao enviar broadcast'),
  });

  const columns = [
    { key: 'message', label: 'Mensagem', render: (v) => <span className="max-w-[200px] truncate block">{v}</span> },
    { key: 'target', label: 'Alvo' },
    { key: 'sent', label: 'Enviados' },
    { key: 'createdAt', label: 'Data', render: (v) => formatDateTime(v) },
  ];

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Megaphone className="w-5 h-5 text-[var(--mb-accent-300)]" />
        <h1 className="text-xl font-bold text-[var(--mb-text-primary)]">Broadcast Telegram</h1>
      </div>

      <GlassPanel className="p-6 space-y-4">
        <div className="space-y-1.5">
          <label className="block text-[12px] font-medium text-[var(--mb-text-muted)]">Mensagem</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            placeholder="Digite a mensagem do broadcast..."
            className="w-full px-3 py-2 text-[13px] text-[var(--mb-text-primary)] placeholder-[var(--mb-text-caption)] bg-[var(--mb-surface-900)] border border-[var(--mb-border-soft)] outline-none resize-none focus:border-[var(--mb-accent-300)]"
          />
        </div>

        <div className="flex items-end gap-3">
          <div className="flex-1 space-y-1.5">
            <label className="block text-[12px] font-medium text-[var(--mb-text-muted)]">Publico Alvo</label>
            <select value={target} onChange={(e) => setTarget(e.target.value)} className="w-full px-3 py-2 text-[13px] text-[var(--mb-text-primary)] bg-[var(--mb-surface-900)] border border-[var(--mb-border-soft)] outline-none focus:border-[var(--mb-accent-300)]">
              <option value="all">Todos</option>
              <option value="active">Ativos</option>
              <option value="premium">Premium</option>
            </select>
          </div>
          <ActionButton variant="accent" loading={sendMut.isPending} disabled={!message.trim()} onClick={() => sendMut.mutate()}>
            <Send className="w-4 h-4 mr-1" />Enviar
          </ActionButton>
        </div>
      </GlassPanel>

      <h2 className="text-[14px] font-semibold text-[var(--mb-text-primary)]">Historico</h2>
      <DataTable columns={columns} data={data?.broadcasts || []} isLoading={isLoading} emptyTitle="Nenhum broadcast enviado" />
      <Pagination page={page} totalPages={data?.totalPages} onPageChange={setPage} />
    </div>
  );
}
