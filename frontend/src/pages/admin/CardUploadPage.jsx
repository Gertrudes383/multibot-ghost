import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Upload, FileText } from 'lucide-react'
import Surface from '@components/ui/Surface'
import ActionButton from '@components/ui/ActionButton'
import SelectField from '@components/ui/SelectField'
import { toast } from '@stores/toastStore'
import { uploadCards, getBots } from '@services/admin.service'

export default function CardUploadPage() {
  const [pasteText, setPasteText] = useState('')
  const [file, setFile] = useState(null)
  const [botId, setBotId] = useState('')
  const [result, setResult] = useState(null)

  const { data: bots = [] } = useQuery({ queryKey: ['bots'], queryFn: getBots })

  const parsedCount = pasteText
    .split('\n')
    .filter(l => l.trim().split('|').length >= 4).length

  const mutation = useMutation({
    mutationFn: (payload) => uploadCards(payload),
    onSuccess: (data) => {
      setResult(data)
      toast.success(`Upload concluído: ${data.uploaded} cartões enviados`)
      setPasteText('')
      setFile(null)
    },
    onError: (err) => toast.error(err.message ?? 'Erro ao fazer upload'),
  })

  const handleSubmit = () => {
    if (!pasteText && !file) return toast.error('Informe os cartões via texto ou arquivo')
    mutation.mutate({ pasteText, file, botId })
  }

  const botOptions = [
    { value: '', label: 'Todos os bots' },
    ...bots.map(b => ({ value: b.id, label: b.name })),
  ]

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold text-[var(--mb-text-primary)]">Upload de Cartões</h1>

      <Surface className="space-y-4 p-6">
        <div>
          <label className="block text-sm font-medium text-[var(--mb-text-secondary)] mb-1">
            Colar cartões (PAN|MM|YYYY|CVV|NAME|CPF)
          </label>
          <textarea
            className="w-full h-40 bg-[var(--mb-surface-2)] border border-[var(--mb-border)] rounded-lg p-3 text-[var(--mb-text-primary)] text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-[var(--mb-accent)]"
            placeholder={"4111111111111111|12|2026|123|JOHN DOE|123.456.789-00\n..."}
            value={pasteText}
            onChange={e => setPasteText(e.target.value)}
          />
          {pasteText && (
            <p className="text-xs text-[var(--mb-text-secondary)] mt-1">
              {parsedCount} cartão(ões) detectado(s)
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--mb-text-secondary)] mb-1">
            Ou enviar arquivo (.txt, .csv)
          </label>
          <label className="flex items-center gap-2 cursor-pointer border border-dashed border-[var(--mb-border)] rounded-lg p-4 hover:border-[var(--mb-accent)] transition-colors">
            <FileText size={18} className="text-[var(--mb-text-secondary)]" />
            <span className="text-sm text-[var(--mb-text-secondary)]">
              {file ? file.name : 'Clique para selecionar arquivo'}
            </span>
            <input
              type="file"
              accept=".txt,.csv"
              className="hidden"
              onChange={e => setFile(e.target.files[0] ?? null)}
            />
          </label>
        </div>

        <SelectField
          label="Bot destino"
          value={botId}
          onChange={e => setBotId(e.target.value)}
          options={botOptions}
        />

        <ActionButton
          onClick={handleSubmit}
          loading={mutation.isPending}
          icon={<Upload size={16} />}
        >
          Fazer Upload
        </ActionButton>
      </Surface>

      {result && (
        <Surface className="p-6">
          <h2 className="text-lg font-semibold text-[var(--mb-text-primary)] mb-4">Resultado</h2>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="bg-green-500/10 rounded-lg p-4">
              <p className="text-2xl font-bold text-green-400">{result.uploaded}</p>
              <p className="text-sm text-[var(--mb-text-secondary)]">Enviados</p>
            </div>
            <div className="bg-yellow-500/10 rounded-lg p-4">
              <p className="text-2xl font-bold text-yellow-400">{result.duplicates}</p>
              <p className="text-sm text-[var(--mb-text-secondary)]">Duplicatas</p>
            </div>
            <div className="bg-red-500/10 rounded-lg p-4">
              <p className="text-2xl font-bold text-red-400">{result.invalid}</p>
              <p className="text-sm text-[var(--mb-text-secondary)]">Inválidos</p>
            </div>
          </div>
        </Surface>
      )}
    </div>
  )
}
