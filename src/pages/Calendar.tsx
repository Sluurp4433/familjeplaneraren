import { useMemo, useState } from 'react'
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { sv } from 'date-fns/locale'
import { useActiveGroup } from '../group/ActiveGroupProvider'
import { useGroupPeople } from '../lib/groups'
import { useEventsInRange, type EventWithAssignees } from '../lib/events'
import { dateKey } from '../lib/format'
import { personColor } from '../lib/personColor'
import { Button, LoadingState, PageHeader, cn } from '../components/ui'
import { PersonFilter } from '../components/PersonFilter'
import { EventChip } from '../components/EventChip'
import { EventForm } from '../components/EventForm'
import type { Person } from '../types/database.types'

const WEEKDAYS = ['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön']

export function Calendar() {
  const { activeGroup, isGroupWriter } = useActiveGroup()
  const groupId = activeGroup?.id ?? null

  const [cursor, setCursor] = useState(() => startOfMonth(new Date()))
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [selectedDay, setSelectedDay] = useState<string>(dateKey(new Date()))
  const [formOpen, setFormOpen] = useState(false)
  const [editEvent, setEditEvent] = useState<EventWithAssignees | null>(null)
  const [formDay, setFormDay] = useState<Date | null>(null)

  const gridStart = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 })
  const gridEnd = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 })
  const days = useMemo(
    () => eachDayOfInterval({ start: gridStart, end: gridEnd }),
    [gridStart, gridEnd],
  )

  const { data: people = [] } = useGroupPeople(groupId)
  const { data: events, isLoading } = useEventsInRange(
    groupId,
    gridStart.toISOString(),
    gridEnd.toISOString(),
  )

  const peopleById = useMemo(
    () => new Map<string, Person>(people.map((p) => [p.id, p])),
    [people],
  )

  const visibleEvents = useMemo(
    () =>
      (events ?? []).filter(
        (e) => e.assigneeIds.length === 0 || e.assigneeIds.some((id) => !hidden.has(id)),
      ),
    [events, hidden],
  )

  const byDay = useMemo(() => {
    const m = new Map<string, EventWithAssignees[]>()
    for (const e of visibleEvents) {
      const k = dateKey(new Date(e.starts_at))
      const arr = m.get(k) ?? []
      arr.push(e)
      m.set(k, arr)
    }
    return m
  }, [visibleEvents])

  function openNew(day: Date) {
    setEditEvent(null)
    setFormDay(day)
    setFormOpen(true)
  }
  function openEdit(e: EventWithAssignees) {
    setEditEvent(e)
    setFormDay(null)
    setFormOpen(true)
  }

  if (!activeGroup) return <LoadingState />

  const selectedEvents = byDay.get(selectedDay) ?? []

  return (
    <div>
      <PageHeader
        title="Kalender"
        action={
          isGroupWriter && (
            <Button onClick={() => openNew(new Date())}>Ny händelse</Button>
          )
        }
      />

      <div className="mb-4 flex items-center justify-between">
        <Button variant="ghost" onClick={() => setCursor(addMonths(cursor, -1))}>
          ← Föregående
        </Button>
        <span className="font-semibold capitalize text-brand-800">
          {format(cursor, 'MMMM yyyy', { locale: sv })}
        </span>
        <Button variant="ghost" onClick={() => setCursor(addMonths(cursor, 1))}>
          Nästa →
        </Button>
      </div>

      {people.length > 0 && (
        <div className="mb-4">
          <PersonFilter
            people={people}
            hidden={hidden}
            onToggle={(id) =>
              setHidden((prev) => {
                const next = new Set(prev)
                next.has(id) ? next.delete(id) : next.add(id)
                return next
              })
            }
            onReset={() => setHidden(new Set())}
          />
        </div>
      )}

      {isLoading ? (
        <LoadingState />
      ) : (
        <>
          {/* Desktop: full månadsgrid */}
          <div className="hidden md:block">
            <div className="grid grid-cols-7 gap-px rounded-lg bg-slate-200 text-center text-xs font-medium text-slate-500">
              {WEEKDAYS.map((d) => (
                <div key={d} className="bg-slate-50 py-1">
                  {d}
                </div>
              ))}
              {days.map((day) => {
                const k = dateKey(day)
                const list = byDay.get(k) ?? []
                return (
                  <div
                    key={k}
                    className={cn(
                      'min-h-[92px] bg-white p-1 text-left',
                      !isSameMonth(day, cursor) && 'bg-slate-50 text-slate-400',
                    )}
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <span
                        className={cn(
                          'text-xs',
                          isToday(day) &&
                            'flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-white',
                        )}
                      >
                        {format(day, 'd')}
                      </span>
                      {isGroupWriter && (
                        <button
                          onClick={() => openNew(day)}
                          className="text-slate-300 hover:text-brand-600"
                          title="Lägg till"
                        >
                          +
                        </button>
                      )}
                    </div>
                    <div className="space-y-0.5">
                      {list.slice(0, 4).map((e) => (
                        <EventChip
                          key={e.id}
                          event={e}
                          peopleById={peopleById}
                          onClick={() => openEdit(e)}
                          compact
                        />
                      ))}
                      {list.length > 4 && (
                        <div className="text-[10px] text-slate-400">+{list.length - 4} till</div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Mobil: prick-grid + vald dags lista */}
          <div className="md:hidden">
            <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-slate-400">
              {WEEKDAYS.map((d) => (
                <div key={d}>{d[0]}</div>
              ))}
              {days.map((day) => {
                const k = dateKey(day)
                const list = byDay.get(k) ?? []
                const dots = [...new Set(list.flatMap((e) => e.assigneeIds))].slice(0, 4)
                return (
                  <button
                    key={k}
                    onClick={() => setSelectedDay(k)}
                    className={cn(
                      'flex flex-col items-center rounded py-1',
                      k === selectedDay && 'bg-brand-100',
                      !isSameMonth(day, cursor) && 'text-slate-300',
                    )}
                  >
                    <span
                      className={cn(
                        'text-xs',
                        isToday(day) &&
                          'flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-white',
                      )}
                    >
                      {format(day, 'd')}
                    </span>
                    <span className="mt-0.5 flex h-1.5 gap-0.5">
                      {list.length === 0
                        ? null
                        : dots.length
                          ? dots.map((id) => (
                              <span
                                key={id}
                                className="h-1.5 w-1.5 rounded-full"
                                style={{
                                  backgroundColor: peopleById.get(id)
                                    ? personColor(peopleById.get(id)!)
                                    : '#94a3b8',
                                }}
                              />
                            ))
                          : [
                              <span
                                key="x"
                                className="h-1.5 w-1.5 rounded-full bg-slate-400"
                              />,
                            ]}
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold capitalize text-brand-800">
                  {format(new Date(selectedDay), 'EEEE d MMMM', { locale: sv })}
                </h3>
                {isGroupWriter && (
                  <Button size="md" variant="ghost" onClick={() => openNew(new Date(selectedDay))}>
                    + Lägg till
                  </Button>
                )}
              </div>
              {selectedEvents.length === 0 ? (
                <p className="text-sm text-slate-400">Inget inplanerat.</p>
              ) : (
                <div className="space-y-1.5">
                  {selectedEvents.map((e) => (
                    <EventChip
                      key={e.id}
                      event={e}
                      peopleById={peopleById}
                      onClick={() => openEdit(e)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {groupId && (
        <EventForm
          open={formOpen}
          onClose={() => setFormOpen(false)}
          groupId={groupId}
          people={people}
          event={editEvent}
          defaultDate={formDay}
        />
      )}

    </div>
  )
}
