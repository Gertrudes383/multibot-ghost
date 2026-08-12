import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Surface from '@components/ui/Surface'
import DataTable from '@components/ui/DataTable'
import SelectField from '@components/ui/SelectField'
import StatusBadge from '@components/ui/StatusBadge'
import Pagination from '@components/ui/Pagination'
import Spinner from '@components/ui/Spinner'
import EmptyState from '@components/ui/EmptyState'
import { formatBRL, formatDateTime } from '@utils/format'
import { getCryptoPayments } from '@services/admin.service'

const STATUS_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'pending', label: 'Pendente' },
  { value: 'completed', label: 'Concluído' },
  { value: 'expired', label: 'Expirado' },
]

const COLUMNS = [
  { key: 'userId', label: 'Usuário' },
  { key: 'amount', label: 'Valor', render: (v) => formatBRL(v) },
  { key: 'currency', label: 'Moeda' },
  { key: 'status', label: 'Status', render: (v) => <StatusBadge status={v} /> },
  { key: 'txn_id', label: 'Transação' },
  { key: 'createdAt', label: 'Data', render: (v) => formatDateTime(v) },
]

export default function CryptoPaymentsPage() {
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['crypto-payments', status, page],
    queryFn: () => getCryptoPayments({ status, page, limit: 20 }),
    keepPreviousData: true,
  })

  const rows = data?.payments ?? []
  const total = data?.total ?? 0

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold text-[var(--mb-text-primary)]">Pagamentos Crypto</h1>

      <Surface className="p-4">
        <SelectField
          label="Filtrar por status"
          value={status}
          onChange={e => { setStatus(e.target.value); setPage(1) }}
          options={STATUS_OPTIONS}
          className="max-w-xs"
        />
      </Surface>

      <Surface>
        {isLoading ? (
          <div className="flex justify-center p-12"><Spinner /></div>
        ) : rows.length === 0 ? (
          <EmptyState title="Sem pagamentos" description="Nenhum pagamento crypto encontrado" />
        ) : (
          <>
            <DataTable columns={COLUMNS} rows={rows} rowKey="id" />
            <div className="p-4 border-t border-[var(--mb-border)]">
              <Pagination
                page={page}
                total={total}
                perPage={20}
                onChange={setPage}
              />
            </div>
          </>
        )}
      </Surface>
    </div>
  )
}
