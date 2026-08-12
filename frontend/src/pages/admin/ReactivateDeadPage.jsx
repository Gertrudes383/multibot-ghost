import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'
import Surface from '@components/ui/Surface'
import DataTable from '@components/ui/DataTable'
import ActionButton from '@components/ui/ActionButton'
import Spinner from '@components/ui/Spinner'
import EmptyState from '@components/ui/EmptyState'
import { toast } from '@stores/toastStore'
import { getDeadCards, reactivateDeadCards } from '@services/admin.service'

const COLUMNS = [
  { key: 'bin', label: 'BIN' },
  { key: 'brand', label: 'Bandeira' },
  { key: 'country', label: 'País' },
  { key: 'level', label: 'Nível' },
]

export default function ReactivateDeadPage() {
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState([])

  const { data, isLoading } = useQuery({
    queryKey: ['dead-cards'],
    queryFn: getDeadCards,
  })

  const rows = data?.cards ?? []

  const mutation = useMutation({
    mutationFn: (ids) => reactivateDeadCards(ids),
    onSuccess: (res) => {
      toast.success(`${res.reactivated} cartão(ões) reativado(s)`)
      setSelected([])
      queryClient.invalidateQueries({ queryKey: ['dead-cards'] })
    },
    onError: (err) => toast.error(err.message ?? 'Erro ao reativar'),
  })

  const allSelected = rows.length > 0 && selected.length === rows.length
  const toggleAll = () => setSelected(allSelected ? [] : rows.map(r => r.id))
  const toggleOne = (id) =>
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const columns = [
    {
      key: 'select',
      label: (
        <input type="checkbox" checked={allSelected} onChange={toggleAll} />
      ),
      render: (_, row) => (
        <input
          type="checkbox"
          checked={selected.includes(row.id)}
          onChange={() => toggleOne(row.id)}
        />
      ),
    },
    ...COLUMNS,
  ]

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[var(--mb-text-primary)]">Reativar Cards Dead</h1>
        <ActionButton
          icon={<RefreshCw size={16} />}
          disabled={selected.length === 0}
          loading={mutation.isPending}
          onClick={() => mutation.mutate(selected)}
        >
          Reativar Selecionados ({selected.length})
        </ActionButton>
      </div>

      <Surface>
        {isLoading ? (
          <div className="flex justify-center p-12"><Spinner /></div>
        ) : rows.length === 0 ? (
          <EmptyState title="Sem cards dead" description="Não há cartões dead para reativar" />
        ) : (
          <DataTable columns={columns} rows={rows} rowKey="id" />
        )}
      </Surface>
    </div>
  )
}
