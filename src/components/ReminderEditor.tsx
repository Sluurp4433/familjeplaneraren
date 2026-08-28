import { emptyReminder, type ReminderDraft, type ReminderKind } from '../lib/reminders'
import { Button, Input, Select, cn } from './ui'

const KINDS: { value: ReminderKind; label: string }[] = [
  { value: 'evening_before', label: 'Kvällen innan' },
  { value: 'morning_of', label: 'På morgonen' },
  { value: 'minutes_before', label: 'Minuter innan' },
]

const RECIPIENTS = [
  { value: 'assignees', label: 'De ansvariga' },
  { value: 'group_adults', label: 'Alla vuxna' },
  { value: 'custom', label: 'Egna adresser' },
] as const

export function ReminderEditor({
  list,
  onChange,
}: {
  list: ReminderDraft[]
  onChange: (l: ReminderDraft[]) => void
}) {
  function update(i: number, patch: Partial<ReminderDraft>) {
    onChange(list.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  }
  function remove(i: number) {
    onChange(list.filter((_, idx) => idx !== i))
  }

  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-slate-700">Påminnelser (e-post)</span>
        <Button type="button" variant="ghost" onClick={() => onChange([...list, emptyReminder()])}>
          + Lägg till
        </Button>
      </div>

      {list.length === 0 && (
        <p className="text-xs text-slate-400">Inga påminnelser. Lägg till en för att få ett mejl.</p>
      )}

      <div className="space-y-3">
        {list.map((r, i) => (
          <div key={i} className="rounded-md bg-slate-50 p-2">
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={r.offset_kind}
                onChange={(e) => update(i, { offset_kind: e.target.value as ReminderKind })}
                className="w-40"
              >
                {KINDS.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </Select>
              {r.offset_kind === 'minutes_before' ? (
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    min={5}
                    step={5}
                    value={r.offset_minutes ?? 60}
                    onChange={(e) => update(i, { offset_minutes: Number(e.target.value) || 60 })}
                    className="w-20"
                  />
                  <span className="text-xs text-slate-500">min</span>
                </div>
              ) : (
                <Input
                  type="time"
                  value={r.at_time ?? '18:00'}
                  onChange={(e) => update(i, { at_time: e.target.value })}
                  className="w-28"
                />
              )}
              <Select
                value={r.recipient_mode}
                onChange={(e) => update(i, { recipient_mode: e.target.value as ReminderDraft['recipient_mode'] })}
                className="w-36"
              >
                {RECIPIENTS.map((x) => (
                  <option key={x.value} value={x.value}>
                    {x.label}
                  </option>
                ))}
              </Select>
              <button
                type="button"
                onClick={() => remove(i)}
                className="ml-auto text-xs text-red-600 hover:underline"
              >
                Ta bort
              </button>
            </div>

            {r.recipient_mode === 'custom' && (
              <Input
                placeholder="mejl, separerade med komma"
                value={r.custom_emails.join(', ')}
                onChange={(e) =>
                  update(i, {
                    custom_emails: e.target.value
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
                className="mt-2"
              />
            )}

            <Input
              placeholder="Meddelande (valfritt), t.ex. Glöm inte att ställa fram plasttunnan"
              value={r.message ?? ''}
              onChange={(e) => update(i, { message: e.target.value || null })}
              className={cn('mt-2')}
            />
            <Input
              placeholder="Ta med (valfritt), separera med komma: fika, tallrik, bestick"
              value={r.bring_list.join(', ')}
              onChange={(e) =>
                update(i, {
                  bring_list: e.target.value
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
              className="mt-2"
            />
          </div>
        ))}
      </div>
    </div>
  )
}
