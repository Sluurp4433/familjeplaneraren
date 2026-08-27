import type { Person } from '../types/database.types'
import { personColor } from '../lib/personColor'
import { cn } from './ui'

/** Flerval av personer (t.ex. ansvariga på en händelse). */
export function PersonPicker({
  people,
  selected,
  onChange,
}: {
  people: Person[]
  selected: string[]
  onChange: (ids: string[]) => void
}) {
  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])
  }

  if (people.length === 0) {
    return (
      <p className="text-xs text-slate-400">
        Inga personer i familjen än – lägg till dem under Familj.
      </p>
    )
  }

  return (
    <div className="flex flex-wrap gap-2">
      {people.map((p) => {
        const on = selected.includes(p.id)
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => toggle(p.id)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors',
              on
                ? 'border-transparent text-white'
                : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50',
            )}
            style={on ? { backgroundColor: personColor(p) } : undefined}
          >
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: on ? 'rgba(255,255,255,.8)' : personColor(p) }}
            />
            {p.name}
          </button>
        )
      })}
    </div>
  )
}
