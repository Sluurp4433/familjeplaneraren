import type { Person } from '../types/database.types'
import { personColor } from '../lib/personColor'
import { cn } from './ui'

/** Bocka i/ur vilka personer som visas i kalendern just nu. */
export function PersonFilter({
  people,
  hidden,
  onToggle,
  onReset,
}: {
  people: Person[]
  hidden: Set<string>
  onToggle: (id: string) => void
  onReset: () => void
}) {
  if (people.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-2">
      {people.map((p) => {
        const on = !hidden.has(p.id)
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onToggle(p.id)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
              on ? 'border-slate-300 bg-white text-slate-700' : 'border-slate-200 bg-slate-100 text-slate-400',
            )}
          >
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: on ? personColor(p) : '#cbd5e1' }}
            />
            {p.name}
          </button>
        )
      })}
      {hidden.size > 0 && (
        <button type="button" onClick={onReset} className="text-xs text-brand-700 underline">
          Visa alla
        </button>
      )}
    </div>
  )
}
