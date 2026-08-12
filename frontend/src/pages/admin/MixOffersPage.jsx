import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil } from 'lucide-react'
import Surface from '@components/ui/Surface'
import DataTable from '@components/ui/DataTable'
import ActionButton from '@components/ui/ActionButton'
import Modal from '@components/ui/Modal'
import InputField from '@components/ui/InputField'
import StatusBadge from '@components/ui/StatusBadge'
import EmptyState from '@components/ui/EmptyState'
import { toast } from '@stores/toastStore'
import { formatBRL } from '@utils/format'
import { getMixOffers, createMixOffer, updateMixOffer } from '@services/admin.service'

const EMPTY_FORM = { name: '', items: '', price: '' }

export default function MixOffersPage() {
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)

  const { data } = useQuery({ queryKey: ['mix-offers'], queryFn: getMixOffers })
  const rows = data?.offers ?? []

  const set = (key) => (e) => setForm(prev => ({ ...prev, [key]: e.target.value }))

  const openCreate = () => { setForm(EMPTY_FORM); setEditTarget(null); setModalOpen(true) }
  const openEdit = (row) => {
    setForm({ name: row.name, items: (row.items ?? []).join(', '), price: String(row.price) })
    setEditTarget(row)
    setModalOpen(true)
  }

  const mutation = useMutation({
    mutationFn: (payload) =>
      editTarget ? updateMixOffer(editTarget.id, payload) : createMixOffer(payload),
    onSuccess: () => {
      toast.success(editTarget ? 'Oferta atualizada' : 'Oferta criada')
      setModalOpen(false)
      queryClient.invalidateQueries({ queryKey: ['mix-offers'] })
    },
    onError: (err) => toast.error(err.message ?? 'Erro ao salvar oferta'),
  })

  const handleSave = () => {
    if (!form.name) return toast.error('Nome é obrigatório')
    const items = form.items.split(',').map(s => s.trim()).filter(Boolean)
    mutation.mutate({ name: form.name, items, price: parseFloat(form.price) || 0 })
  }

  const columns = [
    { key: 'name', label: 'Nome' },
    { key: 'items', label: 'Itens', render: (v) => Array.isArray(v) ? v.length : 0 },
    { key: 'price', label: 'Preço', render: (v) => formatBRL(v) },
    { key: 'status', label: 'Status', render: (v) => <StatusBadge status={v} /> },
    {
      key: 'actions',
      label: '',
      render: (_, row) => (
        <ActionButton size="sm" icon={<Pencil size={14} />} onClick={() => openEdit(row)}>
          Editar
        </ActionButton>
      ),
    },
  ]

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[var(--mb-text-primary)]">Ofertas Mistas</h1>
        <ActionButton icon={<Plus size={16} />} onClick={openCreate}>Nova Oferta</ActionButton>
      </div>

      <Surface>
        {rows.length === 0 ? (
          <EmptyState
            title="Sem ofertas mistas"
            description="Esta funcionalidade ainda não possui ofertas cadastradas."
            action={<ActionButton icon={<Plus size={16} />} onClick={openCreate}>Criar primeira oferta</ActionButton>}
          />
        ) : (
          <DataTable columns={columns} rows={rows} rowKey="id" />
        )}
      </Surface>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editTarget ? 'Editar Oferta' : 'Nova Oferta'}>
        <div className="space-y-4">
          <InputField label="Nome" value={form.name} onChange={set('name')} placeholder="Ex: Mix Premium" />
          <InputField label="Itens (separados por vírgula)" value={form.items} onChange={set('items')} placeholder="item1, item2, item3" />
          <InputField label="Preço (R$)" type="number" value={form.price} onChange={set('price')} placeholder="0.00" />
          <div className="flex justify-end gap-2 pt-2">
            <ActionButton variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</ActionButton>
            <ActionButton loading={mutation.isPending} onClick={handleSave}>Salvar</ActionButton>
          </div>
        </div>
      </Modal>
    </div>
  )
}
