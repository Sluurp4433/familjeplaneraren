import { useState } from 'react'
import { ACTIVITY_ICONS } from '../lib/activityIcons'
import { cn } from './ui'

export function IconPicker({
  value,
  onChange,
}: {
  value: string | null
  onChange: (key: string | null) => void
}) {
  const [q, setQ] = useState('')
  const list = q
    ? ACTIVITY_ICONS.filter((i) => i.label.toLowerCase().includes(q.toLowerCase()))
    : ACTIVITY_ICONS

  return (
    <div>
      <input
        placeholder="Sök symbol…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="mb-2 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
      />
      <div className="grid max-h-40 grid-cols-6 gap-1 overflow-y-auto rounded-lg border border-slate-200 p-2 sm:grid-cols-8">
        <button
          type="button"
          onClick={() => onChange(null)}
          title="Ingen symbol"
          className={cn(
            'flex h-9 items-center justify-center rounded text-xs text-slate-400 hover:bg-slate-100',
            value === null && 'ring-2 ring-brand-500',
          )}
        >
          Ingen
        </button>
        {list.map((i) => (
          <button
            key={i.key}
            type="button"
            onClick={() => onChange(i.key)}
            title={i.label}
            className={cn(
              'flex h-9 items-center justify-center rounded text-xl hover:bg-slate-100',
              value === i.key && 'ring-2 ring-brand-500',
            )}
          >
            <span role="img" aria-label={i.label}>
              {i.emoji}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
