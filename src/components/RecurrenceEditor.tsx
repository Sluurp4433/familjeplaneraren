import type { Recurrence } from '../lib/series'
import { Field, Input, Select, cn } from './ui'

export const NO_RECURRENCE: Recurrence = {
  freq: 'weekly',
  interval: 1,
  byweekday: [],
  bymonthday: null,
  endMode: 'never',
  until: null,
  count: null,
}

const WD = ['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön']

export function RecurrenceEditor({
  enabled,
  onEnabledChange,
  value,
  onChange,
  startDate,
}: {
  enabled: boolean
  onEnabledChange: (v: boolean) => void
  value: Recurrence
  onChange: (r: Recurrence) => void
  startDate: string // yyyy-mm-dd
}) {
  function set<K extends keyof Recurrence>(k: K, v: Recurrence[K]) {
    onChange({ ...value, [k]: v })
  }
  function toggleDay(d: number) {
    const has = value.byweekday.includes(d)
    set('byweekday', has ? value.byweekday.filter((x) => x !== d) : [...value.byweekday, d].sort())
  }

  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onEnabledChange(e.target.checked)}
        />
        Upprepas
      </label>

      {enabled && (
        <div className="mt-3 space-y-3">
          <div className="flex items-end gap-2">
            <Field label="Var">
              <Input
                type="number"
                min={1}
                max={12}
                value={value.interval}
                onChange={(e) => set('interval', Math.max(1, Number(e.target.value) || 1))}
                className="w-16"
              />
            </Field>
            <Field label="&nbsp;">
              <Select value={value.freq} onChange={(e) => set('freq', e.target.value as 'weekly' | 'monthly')}>
                <option value="weekly">vecka</option>
                <option value="monthly">månad</option>
              </Select>
            </Field>
          </div>

          {value.freq === 'weekly' && (
            <Field label="På dagar (tomt = samma veckodag som startdatum)">
              <div className="flex flex-wrap gap-1">
                {WD.map((d, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggleDay(i)}
                    className={cn(
                      'rounded-md border px-2 py-1 text-xs',
                      value.byweekday.includes(i)
                        ? 'border-transparent bg-brand-600 text-white'
                        : 'border-slate-300 bg-white text-slate-600',
                    )}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </Field>
          )}

          {value.freq === 'monthly' && (
            <Field label="Dag i månaden (tomt = som startdatum)">
              <Input
                type="number"
                min={1}
                max={31}
                value={value.bymonthday ?? ''}
                onChange={(e) =>
                  set('bymonthday', e.target.value ? Number(e.target.value) : null)
                }
                className="w-20"
              />
            </Field>
          )}

          <Field label="Slutar">
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={value.endMode}
                onChange={(e) => set('endMode', e.target.value as Recurrence['endMode'])}
                className="w-36"
              >
                <option value="never">Aldrig</option>
                <option value="until">Ett datum</option>
                <option value="count">Efter antal</option>
              </Select>
              {value.endMode === 'until' && (
                <Input
                  type="date"
                  min={startDate}
                  value={value.until ?? ''}
                  onChange={(e) => set('until', e.target.value || null)}
                  className="w-44"
                />
              )}
              {value.endMode === 'count' && (
                <Input
                  type="number"
                  min={1}
                  value={value.count ?? ''}
                  onChange={(e) => set('count', e.target.value ? Number(e.target.value) : null)}
                  className="w-24"
                  placeholder="ggr"
                />
              )}
            </div>
          </Field>
        </div>
      )}
    </div>
  )
}
