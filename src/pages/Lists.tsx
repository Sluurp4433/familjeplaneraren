import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useActiveGroup } from '../group/ActiveGroupProvider'
import { useCreateList, useDeleteList, useLists } from '../lib/lists'
import { useToast } from '../components/Toast'
import { Badge, Button, Card, Input, LoadingState, PageHeader, Select } from '../components/ui'

export function Lists() {
  const { activeGroup, isGroupWriter } = useActiveGroup()
  const groupId = activeGroup?.id ?? ''
  const { data: lists, isLoading } = useLists(groupId || null)
  const createList = useCreateList(groupId)
  const deleteList = useDeleteList(groupId)
  const toast = useToast()
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState<'shopping' | 'todo'>('shopping')

  function onCreate(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    createList.mutate(
      { title: title.trim(), kind },
      {
        onSuccess: () => {
          setTitle('')
          toast.success('Lista skapad')
        },
        onError: () => toast.error('Kunde inte skapa'),
      },
    )
  }

  if (!activeGroup) return <LoadingState />

  return (
    <div>
      <PageHeader title="Listor" description="Inköp och att-göra – delas i realtid med familjen." />

      {isGroupWriter && (
        <Card className="mb-6 p-4">
          <form className="flex flex-wrap gap-2" onSubmit={onCreate}>
            <Input
              placeholder="t.ex. Veckohandling"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="flex-1"
            />
            <Select value={kind} onChange={(e) => setKind(e.target.value as 'shopping' | 'todo')} className="w-36">
              <option value="shopping">Inköp</option>
              <option value="todo">Att göra</option>
            </Select>
            <Button type="submit" loading={createList.isPending}>
              Skapa
            </Button>
          </form>
        </Card>
      )}

      {isLoading ? (
        <LoadingState />
      ) : (lists ?? []).length === 0 ? (
        <p className="text-sm text-slate-400">Inga listor än.</p>
      ) : (
        <div className="space-y-2">
          {(lists ?? []).map((l) => (
            <Card key={l.id} className="flex items-center gap-3 p-4">
              <Link to={`/listor/${l.id}`} className="flex-1 font-medium text-brand-800 hover:underline">
                {l.title}
              </Link>
              <Badge color={l.kind === 'todo' ? 'amber' : 'blue'}>
                {l.kind === 'todo' ? 'Att göra' : 'Inköp'}
              </Badge>
              {isGroupWriter && (
                <button
                  onClick={() => {
                    if (confirm(`Radera listan "${l.title}"?`)) {
                      deleteList.mutate(l.id, { onSuccess: () => toast.success('Raderad') })
                    }
                  }}
                  className="text-xs text-red-600 hover:underline"
                >
                  Radera
                </button>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
