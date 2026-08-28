import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import type { ListItem, ListRow } from '../types/database.types'

/* ---------- Listor ---------- */

export function useLists(groupId: string | null) {
  return useQuery({
    queryKey: ['lists', groupId],
    enabled: !!groupId,
    queryFn: async (): Promise<ListRow[]> => {
      const { data, error } = await supabase
        .from('lists')
        .select('*')
        .eq('group_id', groupId as string)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data ?? []
    },
  })
}

export function useCreateList(groupId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ title, kind }: { title: string; kind: 'shopping' | 'todo' }) => {
      const { data, error } = await supabase
        .from('lists')
        .insert({ group_id: groupId, title, kind })
        .select('id')
        .single()
      if (error) throw error
      return data.id
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lists', groupId] }),
  })
}

export function useDeleteList(groupId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('lists').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lists', groupId] }),
  })
}

export function useList(id: string | undefined) {
  return useQuery({
    queryKey: ['list', id],
    enabled: !!id,
    queryFn: async (): Promise<ListRow> => {
      const { data, error } = await supabase.from('lists').select('*').eq('id', id as string).single()
      if (error) throw error
      return data
    },
  })
}

/* ---------- Rader + realtid ---------- */

export function useListItems(listId: string | undefined) {
  const qc = useQueryClient()
  const key = ['list-items', listId]

  const query = useQuery({
    queryKey: key,
    enabled: !!listId,
    // Realtid är primärt; polling som skyddsnät om websocket inte når fram.
    refetchInterval: 20_000,
    queryFn: async (): Promise<ListItem[]> => {
      const { data, error } = await supabase
        .from('list_items')
        .select('*')
        .eq('list_id', listId as string)
        .order('checked', { ascending: true })
        .order('position', { ascending: true })
        .order('created_at', { ascending: true })
      if (error) throw error
      return data ?? []
    },
  })

  useEffect(() => {
    if (!listId) return
    const channel = supabase
      .channel(`list:${listId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'list_items', filter: `list_id=eq.${listId}` },
        () => {
          // Enkelt och robust: hämta om vid varje förändring.
          qc.invalidateQueries({ queryKey: key })
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listId])

  return query
}

export function useAddItem(listId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (text: string) => {
      const { error } = await supabase.from('list_items').insert({ list_id: listId, text })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['list-items', listId] }),
  })
}

export function useToggleItem(listId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, checked }: { id: string; checked: boolean }) => {
      const { error } = await supabase.from('list_items').update({ checked }).eq('id', id)
      if (error) throw error
    },
    // Optimistisk uppdatering.
    onMutate: async ({ id, checked }) => {
      const key = ['list-items', listId]
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData<ListItem[]>(key)
      qc.setQueryData<ListItem[]>(key, (old) =>
        (old ?? []).map((it) => (it.id === id ? { ...it, checked } : it)),
      )
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(['list-items', listId], ctx.prev)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['list-items', listId] }),
  })
}

export function useDeleteItem(listId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('list_items').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['list-items', listId] }),
  })
}

export function useClearChecked(listId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('list_items')
        .delete()
        .eq('list_id', listId)
        .eq('checked', true)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['list-items', listId] }),
  })
}
