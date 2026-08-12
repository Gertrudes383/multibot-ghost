import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Smile, Save } from 'lucide-react';
import { getCustomEmojis, updateCustomEmojis } from '@services/admin.service';
import { toast } from '@stores/toastStore';
import Surface from '@components/ui/Surface';
import InputField from '@components/ui/InputField';
import ActionButton from '@components/ui/ActionButton';
import Spinner from '@components/ui/Spinner';

const EMOJI_FIELDS = [
  { key: 'success', label: 'Sucesso' },
  { key: 'error', label: 'Erro' },
  { key: 'pending', label: 'Pendente' },
  { key: 'wallet', label: 'Carteira' },
  { key: 'card', label: 'Card' },
  { key: 'order', label: 'Pedido' },
  { key: 'gift', label: 'Presente' },
  { key: 'star', label: 'Estrela' },
];

export default function CustomEmojisPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({});

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'telegram', 'custom-emojis'],
    queryFn: getCustomEmojis,
  });

  useEffect(() => { if (data) setForm((p) => ({ ...p, ...data })); }, [data]);

  const saveMut = useMutation({
    mutationFn: () => updateCustomEmojis(form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'telegram', 'custom-emojis'] }); toast.success('Emojis atualizados'); },
    onError: (e) => toast.error(e?.data?.message || 'Erro ao salvar'),
  });

  const set = (key) => (e) => setForm((p) => ({ ...p, [key]: e.target.value }));

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Smile className="w-5 h-5 text-[var(--mb-accent-300)]" />
        <h1 className="text-xl font-bold text-[var(--mb-text-primary)]">Emojis Personalizados</h1>
      </div>

      <Surface className="p-5 max-w-lg">
        <div className="grid grid-cols-2 gap-4">
          {EMOJI_FIELDS.map(({ key, label }) => (
            <InputField key={key} label={label} value={form[key] || ''} onChange={set(key)} placeholder="Emoji ou ID" />
          ))}
        </div>
        <ActionButton variant="accent" loading={saveMut.isPending} onClick={() => saveMut.mutate()} className="mt-4">
          <Save className="w-4 h-4 mr-1" />Salvar
        </ActionButton>
      </Surface>
    </div>
  );
}
