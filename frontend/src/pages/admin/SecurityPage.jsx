import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, Shield } from 'lucide-react';
import { getSecuritySettings, updateSecuritySettings, getLogs } from '@services/admin.service';
import { toast } from '@stores/toastStore';
import Surface from '@components/ui/Surface';
import InputField from '@components/ui/InputField';
import ActionButton from '@components/ui/ActionButton';
import DataTable from '@components/ui/DataTable';
import Pagination from '@components/ui/Pagination';
import Spinner from '@components/ui/Spinner';
import { formatDateTime } from '@utils/format';

export default function SecurityPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [form, setForm] = useState({ maxLoginAttempts: '', lockoutDuration: '', requireStrongPassword: true });

  const { data: settings, isLoading: loadingSettings } = useQuery({
    queryKey: ['admin', 'security', 'settings'],
    queryFn: getSecuritySettings,
  });

  const { data: logs, isLoading: loadingLogs } = useQuery({
    queryKey: ['admin', 'security', 'logs', page],
    queryFn: () => getLogs({ page }),
  });

  useEffect(() => {
    if (settings) setForm({
      maxLoginAttempts: String(settings.maxLoginAttempts || '5'),
      lockoutDuration: String(settings.lockoutDuration || '15'),
      requireStrongPassword: settings.requireStrongPassword !== false,
    });
  }, [settings]);

  const saveMut = useMutation({
    mutationFn: updateSecuritySettings,
    onSuccess: () => { toast.success('Configuracoes de seguranca salvas'); queryClient.invalidateQueries({ queryKey: ['admin', 'security'] }); },
    onError: (e) => toast.error(e?.data?.message || 'Erro'),
  });

  if (loadingSettings) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  const logColumns = [
    { key: 'createdAt', label: 'Data', render: (v) => formatDateTime(v) },
    { key: 'action', label: 'Acao' },
    { key: 'username', label: 'Usuario' },
    { key: 'ip', label: 'IP' },
  ];

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-2">
        <Shield className="w-5 h-5 text-[var(--mb-accent-300)]" />
        <h1 className="text-xl font-bold text-[var(--mb-text-primary)]">Seguranca</h1>
      </div>

      <Surface className="p-5 max-w-lg space-y-4">
        <h3 className="text-[14px] font-semibold text-[var(--mb-accent-300)]">Configuracoes</h3>
        <InputField label="Max Tentativas de Login" type="number" value={form.maxLoginAttempts} onChange={(e) => setForm((f) => ({ ...f, maxLoginAttempts: e.target.value }))} />
        <InputField label="Duracao Bloqueio (min)" type="number" value={form.lockoutDuration} onChange={(e) => setForm((f) => ({ ...f, lockoutDuration: e.target.value }))} />
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={form.requireStrongPassword} onChange={(e) => setForm((f) => ({ ...f, requireStrongPassword: e.target.checked }))} className="w-4 h-4 accent-[var(--mb-accent-300)]" />
          <span className="text-[13px] text-[var(--mb-text-secondary)]">Exigir Senha Forte</span>
        </label>
        <ActionButton variant="accent" loading={saveMut.isPending} onClick={() => saveMut.mutate({ maxLoginAttempts: Number(form.maxLoginAttempts), lockoutDuration: Number(form.lockoutDuration), requireStrongPassword: form.requireStrongPassword })}>
          <Save className="w-3.5 h-3.5" /> Salvar
        </ActionButton>
      </Surface>

      <div>
        <h3 className="text-[13px] font-semibold text-[var(--mb-text-muted)] mb-3">Logs de Auditoria</h3>
        <DataTable columns={logColumns} data={logs?.data || []} isLoading={loadingLogs} emptyTitle="Nenhum log registrado" />
        <Pagination page={page} totalPages={logs?.totalPages || 1} onPageChange={setPage} />
      </div>
    </div>
  );
}
