import type { Person } from '../types/database.types'
import type { EventWithAssignees } from '../lib/events'
import { personColor } from '../lib/personColor'
import { fmtTime } from '../lib/format'
import { ActivityIcon } from './ActivityIcon'
import { cn } from './ui'

export function EventChip({
  event,
  peopleById,
  onClick,
  compact,
}: {
  event: EventWithAssignees
  peopleById: Map<string, Person>
  onClick?: () => void
  compact?: boolean
}) {
  const assignees = event.assigneeIds.map((id) => peopleById.get(id)).filter((p): p is Person => !!p)

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-1.5 rounded-md border border-slate-200 bg-white px-1.5 py-1 text-left text-xs hover:bg-slate-50',
        compact && 'px-1 py-0.5',
      )}
    >
      {event.icon_key && <ActivityIcon iconKey={event.icon_key} className="text-sm" />}
      <span className="min-w-0 flex-1 truncate font-medium text-slate-700">
        {event.is_private && <span title="Privat">🔒 </span>}
        {event.title}
      </span>
      {!compact && !event.all_day && (
        <span className="shrink-0 text-slate-400">{fmtTime(event.starts_at)}</span>
      )}
      <span className="flex shrink-0 -space-x-1">
        {assignees.slice(0, 3).map((p) => (
          <span
            key={p.id}
            title={p.name}
            className="h-3 w-3 rounded-full border border-white"
            style={{ backgroundColor: personColor(p) }}
          />
        ))}
      </span>
    </button>
  )
}
