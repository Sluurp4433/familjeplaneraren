import { useMemo, useState } from 'react'
import { addDays, addWeeks, format, startOfWeek } from 'date-fns'
import { sv } from 'date-fns/locale'
import { useActiveGroup } from '../group/ActiveGroupProvider'
import { useLists } from '../lib/lists'
import {
  useAddMealToList,
  useDeleteMeal,
  useMealPlan,
  useMeals,
  useSaveMeal,
  useSetMealPlan,
  type MealWithIngredients,
} from '../lib/meals'
import { dateKey } from '../lib/format'
import { useToast } from '../components/Toast'
import { Modal } from '../components/Modal'
import { Button, Card, Field, Input, LoadingState, PageHeader, Select, Textarea } from '../components/ui'

export function Meals() {
  const { activeGroup, isGroupWriter } = useActiveGroup()
  const groupId = activeGroup?.id ?? ''
  const toast = useToast()

  const [weekCursor, setWeekCursor] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekCursor, i)), [weekCursor])

  const { data: meals = [], isLoading: mLoading } = useMeals(groupId || null)
  const { data: plan = [] } = useMealPlan(
    groupId || null,
    dateKey(days[0]),
    dateKey(days[6]),
  )
  const { data: lists = [] } = useLists(groupId || null)
  const setPlan = useSetMealPlan(groupId)
  const deleteMeal = useDeleteMeal(groupId)
  const addToList = useAddMealToList()

  const [editMeal, setEditMeal] = useState<MealWithIngredients | 'new' | null>(null)
  const [listPick, setListPick] = useState<MealWithIngredients | null>(null)

  const planByDay = useMemo(() => {
    const m = new Map<string, (typeof plan)[number]>()
    for (const p of plan) if (p.slot === 'dinner') m.set(p.date, p)
    return m
  }, [plan])

  const mealById = useMemo(() => new Map(meals.map((m) => [m.id, m])), [meals])

  if (!activeGroup) return <LoadingState />

  return (
    <div>
      <PageHeader title="Matsedel" description="Planera veckans middagar och fyll på inköpslistan." />

      <div className="mb-4 flex items-center justify-between">
        <Button variant="ghost" onClick={() => setWeekCursor(addWeeks(weekCursor, -1))}>
          ← Föregående vecka
        </Button>
        <span className="text-sm font-medium text-brand-800">
          v.{format(weekCursor, 'w', { locale: sv })}
        </span>
        <Button variant="ghost" onClick={() => setWeekCursor(addWeeks(weekCursor, 1))}>
          Nästa vecka →
        </Button>
      </div>

      <Card className="mb-8 divide-y divide-slate-100">
        {days.map((day) => {
          const k = dateKey(day)
          const p = planByDay.get(k)
          const label = p?.meal_id
            ? (mealById.get(p.meal_id)?.name ?? 'Rätt borttagen')
            : (p?.freetext ?? null)
          return (
            <div key={k} className="flex items-center gap-3 px-4 py-3">
              <span className="w-24 shrink-0 text-sm font-medium capitalize text-slate-600">
                {format(day, 'EEE d/M', { locale: sv })}
              </span>
              <span className="flex-1 text-sm text-slate-800">
                {label ?? <span className="text-slate-300">–</span>}
              </span>
              {isGroupWriter && (
                <DaySlot
                  meals={meals}
                  current={p ? { mealId: p.meal_id, freetext: p.freetext } : null}
                  onSet={(mealId, freetext) =>
                    setPlan.mutate({ date: k, slot: 'dinner', mealId, freetext })
                  }
                />
              )}
            </div>
          )
        })}
      </Card>

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-brand-800">Rätter</h2>
        {isGroupWriter && <Button onClick={() => setEditMeal('new')}>Ny rätt</Button>}
      </div>

      {mLoading ? (
        <LoadingState />
      ) : meals.length === 0 ? (
        <p className="text-sm text-slate-400">Inga sparade rätter än.</p>
      ) : (
        <div className="space-y-2">
          {meals.map((m) => (
            <Card key={m.id} className="p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-brand-800">{m.name}</span>
                <span className="text-xs text-slate-400">
                  {m.ingredients.length} ingrediens{m.ingredients.length === 1 ? '' : 'er'}
                </span>
                {isGroupWriter && (
                  <div className="ml-auto flex gap-2">
                    <Button variant="ghost" onClick={() => setEditMeal(m)}>
                      Redigera
                    </Button>
                    {lists.length > 0 && m.ingredients.length > 0 && (
                      <Button variant="secondary" onClick={() => setListPick(m)}>
                        Lägg i lista
                      </Button>
                    )}
                    <button
                      onClick={() => {
                        if (confirm(`Ta bort rätten "${m.name}"?`)) {
                          deleteMeal.mutate(m.id, { onSuccess: () => toast.success('Borttagen') })
                        }
                      }}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Ta bort
                    </button>
                  </div>
                )}
              </div>
              {m.ingredients.length > 0 && (
                <p className="mt-1 text-xs text-slate-500">
                  {m.ingredients.map((i) => (i.quantity ? `${i.quantity} ${i.text}` : i.text)).join(', ')}
                </p>
              )}
            </Card>
          ))}
        </div>
      )}

      {editMeal && (
        <MealEditor
          groupId={groupId}
          meal={editMeal === 'new' ? null : editMeal}
          onClose={() => setEditMeal(null)}
        />
      )}

      {listPick && (
        <Modal
          open
          onClose={() => setListPick(null)}
          title={`Lägg "${listPick.name}" i lista`}
          footer={<Button variant="secondary" onClick={() => setListPick(null)}>Stäng</Button>}
        >
          <div className="space-y-2">
            {lists.map((l) => (
              <Button
                key={l.id}
                variant="secondary"
                className="w-full justify-start"
                onClick={() =>
                  addToList.mutate(
                    { mealId: listPick.id, listId: l.id },
                    {
                      onSuccess: (n) => {
                        toast.success(n > 0 ? `${n} rader tillagda i ${l.title}` : 'Allt fanns redan')
                        setListPick(null)
                      },
                      onError: () => toast.error('Kunde inte lägga till'),
                    },
                  )
                }
              >
                {l.title}
              </Button>
            ))}
          </div>
        </Modal>
      )}
    </div>
  )
}

function DaySlot({
  meals,
  current,
  onSet,
}: {
  meals: MealWithIngredients[]
  current: { mealId: string | null; freetext: string | null } | null
  onSet: (mealId: string | null, freetext: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const [free, setFree] = useState(current?.freetext ?? '')

  return (
    <>
      <button
        onClick={() => {
          setFree(current?.freetext ?? '')
          setOpen(true)
        }}
        className="text-xs text-brand-700 hover:underline"
      >
        Ändra
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Middag"
        footer={
          <>
            <Button variant="ghost" onClick={() => { onSet(null, null); setOpen(false) }}>
              Töm
            </Button>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Avbryt
            </Button>
            <Button onClick={() => { onSet(null, free.trim() || null); setOpen(false) }}>
              Spara text
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Välj sparad rätt">
            <Select
              value={current?.mealId ?? ''}
              onChange={(e) => {
                onSet(e.target.value || null, null)
                setOpen(false)
              }}
            >
              <option value="">–</option>
              {meals.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="…eller skriv fritt">
            <Input value={free} onChange={(e) => setFree(e.target.value)} placeholder="t.ex. Rester" />
          </Field>
        </div>
      </Modal>
    </>
  )
}

function MealEditor({
  groupId,
  meal,
  onClose,
}: {
  groupId: string
  meal: MealWithIngredients | null
  onClose: () => void
}) {
  const save = useSaveMeal(groupId)
  const toast = useToast()
  const [name, setName] = useState(meal?.name ?? '')
  const [notes, setNotes] = useState(meal?.notes ?? '')
  const [rows, setRows] = useState<{ text: string; quantity: string }[]>(
    meal?.ingredients.length
      ? meal.ingredients.map((i) => ({ text: i.text, quantity: i.quantity ?? '' }))
      : [{ text: '', quantity: '' }],
  )

  function submit() {
    if (!name.trim()) {
      toast.error('Namn krävs')
      return
    }
    save.mutate(
      {
        id: meal?.id,
        name: name.trim(),
        notes: notes.trim() || null,
        ingredients: rows
          .filter((r) => r.text.trim())
          .map((r) => ({ text: r.text.trim(), quantity: r.quantity.trim() || null })),
      },
      {
        onSuccess: () => {
          toast.success('Sparat')
          onClose()
        },
        onError: () => toast.error('Kunde inte spara'),
      },
    )
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={meal ? 'Redigera rätt' : 'Ny rätt'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Avbryt
          </Button>
          <Button onClick={submit} loading={save.isPending}>
            Spara
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Namn">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="t.ex. Tacos" />
        </Field>
        <Field label="Anteckningar">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <Field label="Ingredienser">
          <div className="space-y-2">
            {rows.map((r, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  placeholder="mängd"
                  value={r.quantity}
                  onChange={(e) =>
                    setRows(rows.map((x, idx) => (idx === i ? { ...x, quantity: e.target.value } : x)))
                  }
                  className="w-24"
                />
                <Input
                  placeholder="ingrediens"
                  value={r.text}
                  onChange={(e) =>
                    setRows(rows.map((x, idx) => (idx === i ? { ...x, text: e.target.value } : x)))
                  }
                  className="flex-1"
                />
                <button
                  type="button"
                  onClick={() => setRows(rows.filter((_, idx) => idx !== i))}
                  className="text-slate-300 hover:text-red-600"
                >
                  ✕
                </button>
              </div>
            ))}
            <Button
              type="button"
              variant="ghost"
              onClick={() => setRows([...rows, { text: '', quantity: '' }])}
            >
              + Ingrediens
            </Button>
          </div>
        </Field>
      </div>
    </Modal>
  )
}
