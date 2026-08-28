import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { Person } from '../types/database.types'
import {
  useCancelEvent,
  useCreateEvent,
  useDeleteEvent,
  useUpdateEvent,
  type EventInput,
  type EventWithAssignees,
} from '../lib/events'
import {
  useCreateSeries,
  useDeleteSeries,
  useSplitSeries,
  useUpdateSeries,
  fetchSeries,
  type Recurrence,
  type SeriesInput,
} from '../lib/series'
import {
  fetchEventReminders,
  fetchSeriesReminders,
  syncEventReminders,
  syncSeriesReminders,
  type ReminderDraft,
} from '../lib/reminders'
import { fromDatetimeLocal, toDatetimeLocal } from '../lib/format'
import { useToast } from './Toast'
import { Modal } from './Modal'
import { Alert, Button, Field, Input, Select, Textarea } from './ui'
import { PersonPicker } from './PersonPicker'
import { IconPicker } from './IconPicker'
import { NO_RECURRENCE, RecurrenceEditor } from './RecurrenceEditor'
import { ReminderEditor } from './ReminderEditor'
import { RecurrenceScopeDialog, type Scope } from './RecurrenceScopeDialog'

type Props = {
  open: boolean
  onClose: () => void
  groupId: string
  people: Person[]
  event?: EventWithAssignees | null
  defaultDate?: Date | null
}

function baseDefaults(event: EventWithAssignees | null | undefined, day: Date | null | undefined) {
  if (event) {
    return {
      title: event.title,
      allDay: event.all_day,
      start: toDatetimeLocal(event.starts_at),
      end: toDatetimeLocal(event.ends_at),
      location: event.location ?? '',
      notes: event.notes ?? '',
      iconKey: event.icon_key,
      isPrivate: event.is_private,
      pickup: event.pickup_person_id ?? '',
      dropoff: event.dropoff_person_id ?? '',
      assignees: event.assigneeIds,
    }
  }
  const base = day ? new Date(day) : new Date()
  base.setHours(17, 0, 0, 0)
  const end = new Date(base)
  end.setHours(18, 0, 0, 0)
  return {
    title: '',
    allDay: false,
    start: toDatetimeLocal(base),
    end: toDatetimeLocal(end),
    location: '',
    notes: '',
    iconKey: null as string | null,
    isPrivate: false,
    pickup: '',
    dropoff: '',
    assignees: [] as string[],
  }
}

export function EventForm({ open, onClose, groupId, people, event, defaultDate }: Props) {
  const toast = useToast()
  const createEvent = useCreateEvent(groupId)
  const updateEvent = useUpdateEvent(groupId)
  const deleteEvent = useDeleteEvent(groupId)
  const cancelEvent = useCancelEvent(groupId)
  const createSeries = useCreateSeries(groupId)
  const updateSeries = useUpdateSeries(groupId)
  const splitSeries = useSplitSeries(groupId)
  const deleteSeries = useDeleteSeries(groupId)

  const isOccurrence = !!event?.series_id
  const showRecurrence = !event || isOccurrence

  const [f, setF] = useState(() => baseDefaults(event, defaultDate))
  const [recurEnabled, setRecurEnabled] = useState(false)
  const [recur, setRecur] = useState<Recurrence>(NO_RECURRENCE)
  const [reminders, setReminders] = useState<ReminderDraft[]>([])
  const [error, setError] = useState<string | null>(null)
  const [scope, setScope] = useState<'edit' | 'delete' | null>(null)

  // Ladda seriens regel när man öppnar en förekomst.
  const { data: seriesData } = useQuery({
    queryKey: ['series-for-form', event?.series_id],
    enabled: open && !!event?.series_id,
    queryFn: () => fetchSeries(event!.series_id as string),
  })

  // Ladda påminnelser.
  const { data: reminderData } = useQuery({
    queryKey: ['reminders-for-form', event?.id, event?.series_id],
    enabled: open && !!event,
    queryFn: () =>
      event!.series_id
        ? fetchSeriesReminders(event!.series_id)
        : fetchEventReminders(event!.id),
  })

  useEffect(() => {
    if (!open) return
    setF(baseDefaults(event, defaultDate))
    setError(null)
    setScope(null)
    if (!event) setReminders([])
    if (!event?.series_id) {
      setRecurEnabled(false)
      setRecur(NO_RECURRENCE)
    }
  }, [open, event, defaultDate])

  useEffect(() => {
    if (reminderData) setReminders(reminderData)
  }, [reminderData])

  useEffect(() => {
    if (seriesData?.series) {
      const s = seriesData.series
      setRecurEnabled(true)
      setRecur({
        freq: s.freq as 'weekly' | 'monthly',
        interval: s.interval,
        byweekday: s.byweekday ?? [],
        bymonthday: s.bymonthday,
        endMode: s.until ? 'until' : s.count ? 'count' : 'never',
        until: s.until,
        count: s.count,
      })
    }
  }, [seriesData])

  const busy =
    createEvent.isPending ||
    updateEvent.isPending ||
    deleteEvent.isPending ||
    cancelEvent.isPending ||
    createSeries.isPending ||
    updateSeries.isPending ||
    splitSeries.isPending ||
    deleteSeries.isPending

  function set<K extends keyof typeof f>(key: K, val: (typeof f)[K]) {
    setF((prev) => ({ ...prev, [key]: val }))
  }

  function buildEventInput(): EventInput {
    return {
      title: f.title.trim(),
      all_day: f.allDay,
      starts_at: fromDatetimeLocal(f.start),
      ends_at: fromDatetimeLocal(f.end),
      location: f.location.trim() || null,
      notes: f.notes.trim() || null,
      icon_key: f.iconKey,
      is_private: f.isPrivate,
      pickup_person_id: f.pickup || null,
      dropoff_person_id: f.dropoff || null,
      assigneeIds: f.assignees,
    }
  }

  function buildSeriesInput(): SeriesInput {
    const start = new Date(f.start)
    const end = new Date(f.end)
    const pad = (n: number) => String(n).padStart(2, '0')
    return {
      title: f.title.trim(),
      location: f.location.trim() || null,
      notes: f.notes.trim() || null,
      all_day: f.allDay,
      start_time: `${pad(start.getHours())}:${pad(start.getMinutes())}`,
      duration_minutes: Math.max(15, Math.round((end.getTime() - start.getTime()) / 60000)),
      icon_key: f.iconKey,
      is_private: f.isPrivate,
      pickup_person_id: f.pickup || null,
      dropoff_person_id: f.dropoff || null,
      assigneeIds: f.assignees,
      dtstart: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`,
      recurrence: recur,
    }
  }

  function validate(): boolean {
    setError(null)
    if (!f.title.trim()) {
      setError('Titel krävs.')
      return false
    }
    if (new Date(f.end) < new Date(f.start)) {
      setError('Sluttiden är före starttiden.')
      return false
    }
    if (recurEnabled && recur.endMode === 'until' && !recur.until) {
      setError('Ange ett slutdatum för upprepningen.')
      return false
    }
    return true
  }

  async function runScopedEdit(chosen: Scope) {
    setScope(null)
    try {
      if (chosen === 'single') {
        await updateEvent.mutateAsync({ id: event!.id, input: buildEventInput(), markOverridden: true })
        await syncEventReminders(event!.id, groupId, reminders)
      } else if (chosen === 'future') {
        const newSeriesId = await splitSeries.mutateAsync({
          fromEventId: event!.id,
          input: buildSeriesInput(),
        })
        if (newSeriesId) await syncSeriesReminders(newSeriesId, groupId, reminders)
      } else {
        await updateSeries.mutateAsync({ id: event!.series_id as string, input: buildSeriesInput() })
        await syncSeriesReminders(event!.series_id as string, groupId, reminders)
      }
      toast.success('Sparat')
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Något gick fel.')
    }
  }

  async function runScopedDelete(chosen: Scope) {
    setScope(null)
    try {
      if (chosen === 'all') {
        await deleteSeries.mutateAsync(event!.series_id as string)
      } else {
        await cancelEvent.mutateAsync(event!.id)
      }
      toast.success('Borttagen')
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunde inte ta bort.')
    }
  }

  async function submit() {
    if (!validate()) return
    try {
      if (!event) {
        if (recurEnabled) {
          const seriesId = await createSeries.mutateAsync(buildSeriesInput())
          await syncSeriesReminders(seriesId, groupId, reminders)
        } else {
          const eventId = await createEvent.mutateAsync(buildEventInput())
          await syncEventReminders(eventId, groupId, reminders)
        }
        toast.success('Händelse skapad')
        onClose()
      } else if (isOccurrence) {
        setScope('edit')
      } else {
        await updateEvent.mutateAsync({ id: event.id, input: buildEventInput() })
        await syncEventReminders(event.id, groupId, reminders)
        toast.success('Sparat')
        onClose()
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Något gick fel.')
    }
  }

  async function onDelete() {
    if (!event) return
    if (isOccurrence) {
      setScope('delete')
      return
    }
    if (!confirm(`Ta bort "${event.title}"?`)) return
    try {
      await deleteEvent.mutateAsync(event.id)
      toast.success('Borttagen')
      onClose()
    } catch {
      setError('Kunde inte ta bort (behörighet?).')
    }
  }

  return (
    <>
      <Modal
        open={open && !scope}
        onClose={onClose}
        title={event ? 'Redigera händelse' : 'Ny händelse'}
        footer={
          <>
            {event && (
              <Button variant="danger" onClick={onDelete} disabled={busy} className="mr-auto">
                Ta bort
              </Button>
            )}
            <Button variant="secondary" onClick={onClose} disabled={busy}>
              Avbryt
            </Button>
            <Button onClick={submit} loading={busy}>
              {event ? 'Spara' : 'Skapa'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {error && <Alert variant="error">{error}</Alert>}
          {isOccurrence && (
            <Alert variant="info">Detta är en återkommande händelse.</Alert>
          )}

          <Field label="Vad?" htmlFor="title">
            <Input
              id="title"
              value={f.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="t.ex. Emilias dansträning"
            />
          </Field>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={f.allDay} onChange={(e) => set('allDay', e.target.checked)} />
            Heldag
          </label>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Börjar" htmlFor="start">
              <Input
                id="start"
                type="datetime-local"
                value={f.start}
                onChange={(e) => set('start', e.target.value)}
              />
            </Field>
            <Field label="Slutar" htmlFor="end">
              <Input
                id="end"
                type="datetime-local"
                value={f.end}
                onChange={(e) => set('end', e.target.value)}
              />
            </Field>
          </div>

          {showRecurrence && (
            <RecurrenceEditor
              enabled={recurEnabled}
              onEnabledChange={setRecurEnabled}
              value={recur}
              onChange={setRecur}
              startDate={f.start.slice(0, 10)}
            />
          )}

          <Field label="Vem gör det?">
            <PersonPicker people={people} selected={f.assignees} onChange={(ids) => set('assignees', ids)} />
          </Field>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Lämnar">
              <Select value={f.dropoff} onChange={(e) => set('dropoff', e.target.value)}>
                <option value="">–</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Hämtar">
              <Select value={f.pickup} onChange={(e) => set('pickup', e.target.value)}>
                <option value="">–</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label="Plats">
            <Input value={f.location} onChange={(e) => set('location', e.target.value)} />
          </Field>

          <Field label="Anteckningar">
            <Textarea value={f.notes} onChange={(e) => set('notes', e.target.value)} />
          </Field>

          <Field label="Symbol">
            <IconPicker value={f.iconKey} onChange={(k) => set('iconKey', k)} />
          </Field>

          <ReminderEditor list={reminders} onChange={setReminders} />

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={f.isPrivate}
              onChange={(e) => set('isPrivate', e.target.checked)}
            />
            Privat (visas bara för dig, admin och den som är ansvarig)
          </label>
        </div>
      </Modal>

      <RecurrenceScopeDialog
        open={scope !== null}
        action={scope === 'delete' ? 'delete' : 'edit'}
        onPick={(s) => (scope === 'delete' ? runScopedDelete(s) : runScopedEdit(s))}
        onCancel={() => setScope(null)}
      />
    </>
  )
}
