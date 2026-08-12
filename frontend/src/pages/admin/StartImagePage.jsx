import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ImageIcon, Upload } from 'lucide-react';
import { getStartImage, updateStartImage } from '@services/admin.service';
import { toast } from '@stores/toastStore';
import Surface from '@components/ui/Surface';
import ActionButton from '@components/ui/ActionButton';
import Spinner from '@components/ui/Spinner';

export default function StartImagePage() {
  const qc = useQueryClient();
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'telegram', 'start-image'],
    queryFn: getStartImage,
  });

  const saveMut = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      fd.append('image', file);
      return updateStartImage(fd);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'telegram', 'start-image'] }); toast.success('Imagem de inicio atualizada'); setFile(null); setPreview(null); },
    onError: (e) => toast.error(e?.data?.message || 'Erro ao salvar'),
  });

  const handleFile = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <ImageIcon className="w-5 h-5 text-[var(--mb-accent-300)]" />
        <h1 className="text-xl font-bold text-[var(--mb-text-primary)]">Imagem de Inicio (/start)</h1>
      </div>

      <Surface className="p-5 max-w-md space-y-4">
        {(preview || data?.url) && (
          <img src={preview || data.url} alt="Start" className="w-full max-h-64 object-contain border border-[var(--mb-border-soft)]" />
        )}
        <label className="flex flex-col items-center gap-2 p-6 border-2 border-dashed border-[var(--mb-border-soft)] cursor-pointer hover:border-[var(--mb-accent-300)] transition-colors">
          <Upload className="w-6 h-6 text-[var(--mb-text-muted)]" />
          <span className="text-[12px] text-[var(--mb-text-muted)]">Clique para selecionar imagem (JPG, PNG, GIF)</span>
          <input type="file" accept="image/*" onChange={handleFile} className="hidden" />
        </label>
        {file && (
          <ActionButton variant="accent" loading={saveMut.isPending} onClick={() => saveMut.mutate()} className="w-full">
            <Upload className="w-4 h-4 mr-1" />Enviar Imagem
          </ActionButton>
        )}
      </Surface>
    </div>
  );
}
