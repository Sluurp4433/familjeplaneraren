import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'

export type Recurrence = {
  freq: 'weekly' | 'monthly'
  interval: number
  byweekday: number[] // 0=mån .. 6=sön (weekly)
  bymonthday: number | null // (monthly)
  endMode: 'never' | 'until' | 'count'
  until: string | null // yyyy-mm-dd
  count: number | null
}

export type SeriesInput = {
  title: string
  location: string | null
  notes: string | null
  all_day: boolean
  start_time: string | null // 'HH:mm'
  duration_minutes: number
  icon_key: string | null
  is_private: boolean
  pickup_person_id: string | null
  dropoff_person_id: string | null
  assigneeIds: string[]
  dtstart: string // yyyy-mm-dd
  recurrence: Recurrence
}

function seriesRow(input: SeriesInput) {
  const r = input.recurrence
  return {
    title: input.title,
    location: input.location,
    notes: input.notes,
    all_day: input.all_day,
    start_time: input.all_day ? null : input.start_time,
    duration_minutes: input.duration_minutes,
    icon_key: input.icon_key,
    is_private: input.is_private,
    pickup_person_id: input.pickup_person_id,
    dropoff_person_id: input.dropoff_person_id,
    dtstart: input.dtstart,
    freq: r.freq,
    interval: r.interval,
    byweekday: r.freq === 'weekly' ? r.byweekday : null,
    bymonthday: r.freq === 'monthly' ? r.bymonthday : null,
    until: r.endMode === 'until' ? r.until : null,
    count: r.endMode === 'count' ? r.count : null,
  }
}

async function syncSeriesAssignees(seriesId: string, groupId: string, want: string[]) {
  const { data: have } = await supabase
    .from('event_series_assignees')
    .select('person_id')
    .eq('series_id', seriesId)
  const haveSet = new Set((have ?? []).map((r) => r.person_id))
  const toAdd = want.filter((p) => !haveSet.has(p))
  const toRemove = [...haveSet].filter((p) => !want.includes(p))
  if (toAdd.length) {
    await supabase
      .from('event_series_assignees')
      .insert(toAdd.map((person_id) => ({ series_id: seriesId, person_id, group_id: groupId })))
  }
  for (const person_id of toRemove) {
    await supabase
      .from('event_series_assignees')
      .delete()
      .eq('series_id', seriesId)
      .eq('person_id', person_id)
  }
}

export function useCreateSeries(groupId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: SeriesInput) => {
      const { data, error } = await supabase
        .from('event_series')
        .insert({ ...seriesRow(input), group_id: groupId })
        .select('id')
        .single()
      if (error || !data) throw error ?? new Error('Kunde inte skapa serien')
      await syncSeriesAssignees(data.id, groupId, input.assigneeIds)
      return data.id
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['events', groupId] }),
  })
}

export function useUpdateSeries(groupId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: SeriesInput }) => {
      const { error } = await supabase.from('event_series').update(seriesRow(input)).eq('id', id)
      if (error) throw error
      await syncSeriesAssignees(id, groupId, input.assigneeIds)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['events', groupId] }),
  })
}

export function useDeleteSeries(groupId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (seriesId: string) => {
      const { error } = await supabase.from('event_series').delete().eq('id', seriesId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['events', groupId] }),
  })
}

/** "Denna och kommande" – delar serien vid händelsens datum. */
export function useSplitSeries(groupId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ fromEventId, input }: { fromEventId: string; input: SeriesInput }) => {
      const r = input.recurrence
      const patch = {
        title: input.title,
        location: input.location,
        notes: input.notes,
        all_day: input.all_day,
        start_time: input.all_day ? null : input.start_time,
        duration_minutes: input.duration_minutes,
        icon_key: input.icon_key,
        is_private: input.is_private,
        pickup_person_id: input.pickup_person_id,
        dropoff_person_id: input.dropoff_person_id,
        freq: r.freq,
        interval: r.interval,
        byweekday: r.freq === 'weekly' ? r.byweekday : null,
        bymonthday: r.freq === 'monthly' ? r.bymonthday : null,
        until: r.endMode === 'until' ? r.until : null,
        count: r.endMode === 'count' ? r.count : null,
        assignee_ids: input.assigneeIds,
      }
      const { data, error } = await supabase.rpc('series_split', {
        p_from_event: fromEventId,
        patch: patch as never,
      })
      if (error) throw error
      return data as string // nya seriens id
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['events', groupId] }),
  })
}

export async function fetchSeries(id: string) {
  const [{ data: s }, { data: a }] = await Promise.all([
    supabase.from('event_series').select('*').eq('id', id).single(),
    supabase.from('event_series_assignees').select('person_id').eq('series_id', id),
  ])
  return { series: s, assigneeIds: (a ?? []).map((r) => r.person_id) }
}
