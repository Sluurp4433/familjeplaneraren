import { useEffect, useState } from 'react'
import type { Person } from '../types/database.types'
import {
  useCreateEvent,
  useDeleteEvent,
  useUpdateEvent,
  type EventInput,
  type EventWithAssignees,
} from '../lib/events'
import { fromDatetimeLocal, toDatetimeLocal } from '../lib/format'
import { useToast } from './Toast'
import { Modal } from './Modal'
import { Alert, Button, Field, Input, Select, Textarea } from './ui'
import { PersonPicker } from './PersonPicker'
import { IconPicker } from './IconPicker'

type Props = {
  open: boolean
  onClose: () => void
  groupId: string
  people: Person[]
  event?: EventWithAssignees | null
  defaultDate?: Date | null
}

function buildDefaults(event: EventWithAssignees | null | undefined, day: Date | null | undefined) {
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
  const [f, setF] = useState(() => buildDefaults(event, defaultDate))
  const [error, setError] = useState<string | null>(null)

  // Modal döljs bara (unmountas ej) → återställ vid varje öppning.
  useEffect(() => {
    if (open) {
      setF(buildDefaults(event, defaultDate))
      setError(null)
    }
  }, [open, event, defaultDate])

  const busy = createEvent.isPending || updateEvent.isPending || deleteEvent.isPending

  async function remove() {
    if (!event) return
    if (!confirm(`Ta bort "${event.title}"?`)) return
    try {
      await deleteEvent.mutateAsync(event.id)
      toast.success('Borttagen')
      onClose()
    } catch {
      setError('Kunde inte ta bort (behörighet?).')
    }
  }

  function set<K extends keyof typeof f>(key: K, val: (typeof f)[K]) {
    setF((prev) => ({ ...prev, [key]: val }))
  }

  async function submit() {
    setError(null)
    if (!f.title.trim()) {
      setError('Titel krävs.')
      return
    }
    if (new Date(f.end) < new Date(f.start)) {
      setError('Sluttiden är före starttiden.')
      return
    }
    const input: EventInput = {
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
    try {
      if (event) {
        await updateEvent.mutateAsync({ id: event.id, input })
        toast.success('Sparat')
      } else {
        await createEvent.mutateAsync(input)
        toast.success('Händelse skapad')
      }
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Något gick fel.')
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={event ? 'Redigera händelse' : 'Ny händelse'}
      footer={
        <>
          {event && (
            <Button variant="danger" onClick={remove} disabled={busy} className="mr-auto">
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

        <Field label="Vad?" htmlFor="title">
          <Input
            id="title"
            value={f.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="t.ex. Emilias dansträning"
          />
        </Field>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={f.allDay}
            onChange={(e) => set('allDay', e.target.checked)}
          />
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

        <Field label="Vem gör det?">
          <PersonPicker
            people={people}
            selected={f.assignees}
            onChange={(ids) => set('assignees', ids)}
          />
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
  )
}
