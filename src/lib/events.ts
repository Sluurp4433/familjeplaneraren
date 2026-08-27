import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import type { EventRow } from '../types/database.types'

export type EventWithAssignees = EventRow & { assigneeIds: string[] }

export type EventInput = {
  title: string
  starts_at: string
  ends_at: string
  all_day: boolean
  location: string | null
  notes: string | null
  icon_key: string | null
  is_private: boolean
  pickup_person_id: string | null
  dropoff_person_id: string | null
  assigneeIds: string[]
}

function flatten(rows: (EventRow & { event_assignees?: { person_id: string }[] })[]): EventWithAssignees[] {
  return rows.map((r) => {
    const { event_assignees, ...rest } = r
    return { ...(rest as EventRow), assigneeIds: (event_assignees ?? []).map((a) => a.person_id) }
  })
}

/** Händelser i gruppen som startar i [fromISO, toISO). */
export function useEventsInRange(groupId: string | null, fromISO: string, toISO: string) {
  return useQuery({
    queryKey: ['events', groupId, fromISO, toISO],
    enabled: !!groupId,
    queryFn: async (): Promise<EventWithAssignees[]> => {
      const { data, error } = await supabase
        .from('events')
        .select('*, event_assignees(person_id)')
        .eq('group_id', groupId as string)
        .eq('status', 'active')
        .gte('starts_at', fromISO)
        .lt('starts_at', toISO)
        .order('starts_at', { ascending: true })
      if (error) throw error
      return flatten(data ?? [])
    },
  })
}

export function useEvent(id: string | undefined) {
  return useQuery({
    queryKey: ['event', id],
    enabled: !!id,
    queryFn: async (): Promise<EventWithAssignees> => {
      const { data, error } = await supabase
        .from('events')
        .select('*, event_assignees(person_id)')
        .eq('id', id as string)
        .single()
      if (error) throw error
      return flatten([data])[0]
    },
  })
}

async function syncAssignees(eventId: string, groupId: string, want: string[]) {
  const { data: existing } = await supabase
    .from('event_assignees')
    .select('person_id')
    .eq('event_id', eventId)
  const have = new Set((existing ?? []).map((r) => r.person_id))
  const toAdd = want.filter((p) => !have.has(p))
  const toRemove = [...have].filter((p) => !want.includes(p))
  if (toAdd.length) {
    // group_id verifieras/skrivs även av trigger, men skicka rätt värde direkt.
    const { error } = await supabase
      .from('event_assignees')
      .insert(toAdd.map((person_id) => ({ event_id: eventId, person_id, group_id: groupId })))
    if (error) throw error
  }
  for (const person_id of toRemove) {
    await supabase.from('event_assignees').delete().eq('event_id', eventId).eq('person_id', person_id)
  }
}

export function useCreateEvent(groupId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: EventInput) => {
      const { assigneeIds, ...ev } = input
      const { data, error } = await supabase
        .from('events')
        .insert({ ...ev, group_id: groupId })
        .select('id')
        .single()
      if (error || !data) throw error ?? new Error('Kunde inte skapa')
      if (assigneeIds.length) await syncAssignees(data.id, groupId, assigneeIds)
      return data.id
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['events', groupId] }),
  })
}

export function useUpdateEvent(groupId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: EventInput }) => {
      const { assigneeIds, ...ev } = input
      const { error } = await supabase.from('events').update(ev).eq('id', id)
      if (error) throw error
      await syncAssignees(id, groupId, assigneeIds)
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['events', groupId] })
      qc.invalidateQueries({ queryKey: ['event', v.id] })
    },
  })
}

export function useDeleteEvent(groupId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('events').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['events', groupId] }),
  })
}
