import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Upload } from 'lucide-react'
import Surface from '@components/ui/Surface'
import DataTable from '@components/ui/DataTable'
import StatCard from '@components/ui/StatCard'
import ActionButton from '@components/ui/ActionButton'
import Spinner from '@components/ui/Spinner'
import EmptyState from '@components/ui/EmptyState'
import { toast } from '@stores/toastStore'
import { formatNumber } from '@utils/format'
import { getAuxiliaryPool, uploadAuxiliaryPool } from '@services/admin.service'

const COLUMNS = [
  { key: 'value', label: 'Valor' },
  { key: 'type', label: 'Tipo' },
  { key: 'status', label: 'Status' },
]

export default function AuxiliaryPoolPage() {
  const queryClient = useQueryClient()
  const [pasteText, setPasteText] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['auxiliary-pool'],
    queryFn: getAuxiliaryPool,
  })

  const mutation = useMutation({
    mutationFn: (text) => uploadAuxiliaryPool({ text }),
    onSuccess: (res) => {
      toast.success(`${res.added} entradas adicionadas ao pool`)
      setPasteText('')
      queryClient.invalidateQueries({ queryKey: ['auxiliary-pool'] })
    },
    onError: (err) => toast.error(err.message ?? 'Erro ao enviar ao pool'),
  })

  const entries = data?.entries ?? []
  const stats = data?.stats ?? { total: 0, available: 0 }

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold text-[var(--mb-text-primary)]">Pool Auxiliar</h1>

      <div className="grid grid-cols-2 gap-4">
        <StatCard label="Total de entradas" value={formatNumber(stats.total)} />
        <StatCard label="Disponíveis" value={formatNumber(stats.available)} />
      </div>

      <Surface className="space-y-4 p-6">
        <h2 className="text-base font-semibold text-[var(--mb-text-primary)]">Adicionar ao Pool</h2>
        <textarea
          className="w-full h-32 bg-[var(--mb-surface-2)] border border-[var(--mb-border)] rounded-lg p-3 text-[var(--mb-text-primary)] text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-[var(--mb-accent)]"
          placeholder="Uma entrada por linha..."
          value={pasteText}
          onChange={e => setPasteText(e.target.value)}
        />
        <ActionButton
          icon={<Upload size={16} />}
          loading={mutation.isPending}
          disabled={!pasteText.trim()}
          onClick={() => mutation.mutate(pasteText)}
        >
          Enviar ao Pool
        </ActionButton>
      </Surface>

      <Surface>
        <div className="p-4 border-b border-[var(--mb-border)]">
          <h2 className="text-base font-semibold text-[var(--mb-text-primary)]">Entradas do Pool</h2>
        </div>
        {isLoading ? (
          <div className="flex justify-center p-12"><Spinner /></div>
        ) : entries.length === 0 ? (
          <EmptyState title="Pool vazio" description="Nenhuma entrada no pool auxiliar" />
        ) : (
          <DataTable columns={COLUMNS} rows={entries} rowKey="id" />
        )}
      </Surface>
    </div>
  )
}
