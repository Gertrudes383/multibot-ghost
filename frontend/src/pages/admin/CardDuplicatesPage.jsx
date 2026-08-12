import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'
import Surface from '@components/ui/Surface'
import DataTable from '@components/ui/DataTable'
import StatCard from '@components/ui/StatCard'
import ActionButton from '@components/ui/ActionButton'
import Spinner from '@components/ui/Spinner'
import EmptyState from '@components/ui/EmptyState'
import { toast } from '@stores/toastStore'
import { formatNumber } from '@utils/format'
import { getCardDuplicates, deleteCardDuplicates } from '@services/admin.service'

const COLUMNS = [
  { key: 'bin', label: 'BIN' },
  { key: 'count', label: 'Duplicatas', render: (v) => formatNumber(v) },
]

export default function CardDuplicatesPage() {
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['card-duplicates'],
    queryFn: getCardDuplicates,
  })

  const deleteMutation = useMutation({
    mutationFn: (bin) => deleteCardDuplicates(bin),
    onSuccess: () => {
      toast.success('Duplicatas removidas')
      queryClient.invalidateQueries({ queryKey: ['card-duplicates'] })
    },
    onError: (err) => toast.error(err.message ?? 'Erro ao remover duplicatas'),
  })

  const rows = data?.duplicates ?? []
  const totalDuplicates = rows.reduce((sum, r) => sum + (r.count - 1), 0)

  const columns = [
    ...COLUMNS,
    {
      key: 'actions',
      label: 'Ações',
      render: (_, row) => (
        <ActionButton
          size="sm"
          variant="danger"
          icon={<Trash2 size={14} />}
          loading={deleteMutation.isPending}
          onClick={() => deleteMutation.mutate(row.bin)}
        >
          Remover
        </ActionButton>
      ),
    },
  ]

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold text-[var(--mb-text-primary)]">Cartões Duplicados</h1>

      <div className="grid grid-cols-2 gap-4">
        <StatCard label="BINs com duplicatas" value={formatNumber(rows.length)} />
        <StatCard label="Total de duplicatas" value={formatNumber(totalDuplicates)} />
      </div>

      <Surface>
        {isLoading ? (
          <div className="flex justify-center p-12"><Spinner /></div>
        ) : rows.length === 0 ? (
          <EmptyState title="Sem duplicatas" description="Nenhum cartão duplicado encontrado" />
        ) : (
          <DataTable columns={columns} rows={rows} rowKey="bin" />
        )}
      </Surface>
    </div>
  )
}
