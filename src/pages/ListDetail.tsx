import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useActiveGroup } from '../group/ActiveGroupProvider'
import {
  useAddItem,
  useClearChecked,
  useDeleteItem,
  useList,
  useListItems,
  useToggleItem,
} from '../lib/lists'
import { Button, Card, Input, LoadingState, cn } from '../components/ui'

export function ListDetail() {
  const { id = '' } = useParams()
  const { isGroupWriter } = useActiveGroup()
  const { data: list } = useList(id)
  const { data: items, isLoading } = useListItems(id)
  const addItem = useAddItem(id)
  const toggle = useToggleItem(id)
  const del = useDeleteItem(id)
  const clearChecked = useClearChecked(id)
  const [text, setText] = useState('')

  function onAdd(e: FormEvent) {
    e.preventDefault()
    const t = text.trim()
    if (!t) return
    setText('')
    addItem.mutate(t)
  }

  const open = (items ?? []).filter((i) => !i.checked)
  const done = (items ?? []).filter((i) => i.checked)

  return (
    <div>
      <div className="mb-4">
        <Link to="/listor" className="text-sm text-slate-500 hover:underline">
          ← Listor
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-brand-800">{list?.title ?? 'Lista'}</h1>
      </div>

      {isGroupWriter && (
        <form className="mb-4 flex gap-2" onSubmit={onAdd}>
          <Input
            placeholder="Lägg till…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="flex-1"
            autoFocus
          />
          <Button type="submit">Lägg till</Button>
        </form>
      )}

      {isLoading ? (
        <LoadingState />
      ) : (
        <Card className="divide-y divide-slate-100">
          {open.length === 0 && done.length === 0 && (
            <p className="p-4 text-sm text-slate-400">Tom lista.</p>
          )}
          {open.map((it) => (
            <Row
              key={it.id}
              text={it.text}
              checked={false}
              disabled={!isGroupWriter}
              onToggle={() => toggle.mutate({ id: it.id, checked: true })}
              onDelete={isGroupWriter ? () => del.mutate(it.id) : undefined}
            />
          ))}
          {done.length > 0 && (
            <div className="flex items-center justify-between bg-slate-50 px-4 py-2 text-xs text-slate-500">
              <span>Avbockat ({done.length})</span>
              {isGroupWriter && (
                <button onClick={() => clearChecked.mutate()} className="text-red-600 hover:underline">
                  Rensa avbockade
                </button>
              )}
            </div>
          )}
          {done.map((it) => (
            <Row
              key={it.id}
              text={it.text}
              checked
              disabled={!isGroupWriter}
              onToggle={() => toggle.mutate({ id: it.id, checked: false })}
              onDelete={isGroupWriter ? () => del.mutate(it.id) : undefined}
            />
          ))}
        </Card>
      )}
    </div>
  )
}

function Row({
  text,
  checked,
  disabled,
  onToggle,
  onDelete,
}: {
  text: string
  checked: boolean
  disabled?: boolean
  onToggle: () => void
  onDelete?: () => void
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={onToggle}
        className="h-5 w-5 shrink-0"
      />
      <span className={cn('flex-1 text-sm', checked && 'text-slate-400 line-through')}>{text}</span>
      {onDelete && (
        <button onClick={onDelete} className="text-slate-300 hover:text-red-600" aria-label="Ta bort">
          ✕
        </button>
      )}
    </div>
  )
}
