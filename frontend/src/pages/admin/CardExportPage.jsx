import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download } from 'lucide-react'
import Surface from '@components/ui/Surface'
import ActionButton from '@components/ui/ActionButton'
import SelectField from '@components/ui/SelectField'
import InputField from '@components/ui/InputField'
import { toast } from '@stores/toastStore'
import { exportCards, getCardExportPreview } from '@services/admin.service'

const STATUS_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'available', label: 'Disponível' },
  { value: 'sold', label: 'Vendido' },
  { value: 'dead', label: 'Dead' },
]

const BASE_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'full', label: 'Full' },
  { value: 'sem', label: 'Sem' },
]

export default function CardExportPage() {
  const [filters, setFilters] = useState({ status: '', base: '', country: '', bin: '' })
  const [loading, setLoading] = useState(false)

  const set = (key) => (e) => setFilters(prev => ({ ...prev, [key]: e.target.value }))

  const { data: preview } = useQuery({
    queryKey: ['card-export-preview', filters],
    queryFn: () => getCardExportPreview(filters),
    keepPreviousData: true,
  })

  const handleExport = async () => {
    setLoading(true)
    try {
      const blob = await exportCards(filters)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `cards_export_${Date.now()}.txt`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Exportação concluída')
    } catch (err) {
      toast.error(err.message ?? 'Erro ao exportar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold text-[var(--mb-text-primary)]">Exportar Cartões</h1>

      <Surface className="space-y-4 p-6">
        <div className="grid grid-cols-2 gap-4">
          <SelectField label="Status" value={filters.status} onChange={set('status')} options={STATUS_OPTIONS} />
          <SelectField label="Base" value={filters.base} onChange={set('base')} options={BASE_OPTIONS} />
          <InputField label="País" value={filters.country} onChange={set('country')} placeholder="BR, US, ..." />
          <InputField label="BIN" value={filters.bin} onChange={set('bin')} placeholder="411111" />
        </div>

        {preview != null && (
          <div className="bg-[var(--mb-surface-2)] rounded-lg p-4 text-sm text-[var(--mb-text-secondary)]">
            <span className="font-semibold text-[var(--mb-text-primary)]">{preview.count ?? 0}</span> cartão(ões) correspondem aos filtros selecionados
          </div>
        )}

        <ActionButton
          onClick={handleExport}
          loading={loading}
          icon={<Download size={16} />}
          disabled={preview?.count === 0}
        >
          Exportar
        </ActionButton>
      </Surface>
    </div>
  )
}
