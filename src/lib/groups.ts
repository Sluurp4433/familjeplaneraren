import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import type { Group, GroupRole, Person, Profile } from '../types/database.types'

/* ---------- Profiler (superadmin) ---------- */

export function useAllProfiles() {
  return useQuery({
    queryKey: ['admin', 'profiles'],
    queryFn: async (): Promise<Profile[]> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: true })
      if (error) throw error
      return data ?? []
    },
  })
}

export function useSetApproved() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, approved }: { id: string; approved: boolean }) => {
      const { error } = await supabase.from('profiles').update({ approved }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'profiles'] }),
  })
}

/* ---------- Grupper ---------- */

export function useGroups() {
  return useQuery({
    queryKey: ['admin', 'groups'],
    queryFn: async (): Promise<Group[]> => {
      const { data, error } = await supabase
        .from('groups')
        .select('*')
        .order('name', { ascending: true })
      if (error) throw error
      return data ?? []
    },
  })
}

export function useCreateGroup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ name, timezone }: { name: string; timezone?: string }) => {
      const { data, error } = await supabase
        .from('groups')
        .insert({ name, timezone: timezone || 'Europe/Stockholm' })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'groups'] })
      qc.invalidateQueries({ queryKey: ['my-groups'] })
    },
  })
}

export function useUpdateGroup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      name,
      timezone,
    }: {
      id: string
      name?: string
      timezone?: string
    }) => {
      const patch: { name?: string; timezone?: string } = {}
      if (name !== undefined) patch.name = name
      if (timezone !== undefined) patch.timezone = timezone
      const { error } = await supabase.from('groups').update(patch).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'groups'] })
      qc.invalidateQueries({ queryKey: ['my-groups'] })
    },
  })
}

export function useDeleteGroup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('groups').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'groups'] })
      qc.invalidateQueries({ queryKey: ['my-groups'] })
    },
  })
}

/* ---------- Medlemskap ---------- */

export type MemberRow = {
  id: string
  user_id: string
  role: GroupRole
  name: string | null
  email: string | null
}

export function useGroupMembers(groupId: string | null) {
  return useQuery({
    queryKey: ['admin', 'members', groupId],
    enabled: !!groupId,
    queryFn: async (): Promise<MemberRow[]> => {
      const { data: members, error } = await supabase
        .from('group_members')
        .select('id, user_id, role')
        .eq('group_id', groupId as string)
      if (error) throw error
      const ids = (members ?? []).map((m) => m.user_id)
      let profiles: Pick<Profile, 'id' | 'name' | 'email'>[] = []
      if (ids.length) {
        const { data: p, error: pe } = await supabase
          .from('profiles')
          .select('id, name, email')
          .in('id', ids)
        if (pe) throw pe
        profiles = p ?? []
      }
      const byId = new Map(profiles.map((p) => [p.id, p]))
      return (members ?? []).map((m) => ({
        id: m.id,
        user_id: m.user_id,
        role: m.role,
        name: byId.get(m.user_id)?.name ?? null,
        email: byId.get(m.user_id)?.email ?? null,
      }))
    },
  })
}

export function useAddMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      groupId,
      userId,
      role,
    }: {
      groupId: string
      userId: string
      role: GroupRole
    }) => {
      const { error } = await supabase
        .from('group_members')
        .insert({ group_id: groupId, user_id: userId, role })
      if (error) throw error
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['admin', 'members', v.groupId] })
      qc.invalidateQueries({ queryKey: ['my-groups'] })
    },
  })
}

export function useSetMemberRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, role }: { id: string; role: GroupRole; groupId: string }) => {
      const { error } = await supabase.from('group_members').update({ role }).eq('id', id)
      if (error) throw error
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['admin', 'members', v.groupId] })
      qc.invalidateQueries({ queryKey: ['my-groups'] })
    },
  })
}

export function useRemoveMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id }: { id: string; groupId: string }) => {
      const { error } = await supabase.from('group_members').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['admin', 'members', v.groupId] })
      qc.invalidateQueries({ queryKey: ['my-groups'] })
    },
  })
}

/* ---------- Personer ---------- */

export function useGroupPeople(groupId: string | null) {
  return useQuery({
    queryKey: ['people', groupId],
    enabled: !!groupId,
    queryFn: async (): Promise<Person[]> => {
      const { data, error } = await supabase
        .from('people')
        .select('*')
        .eq('group_id', groupId as string)
        .order('name', { ascending: true })
      if (error) throw error
      return data ?? []
    },
  })
}

export function useAddPerson() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      group_id: string
      name: string
      kind: 'adult' | 'child'
      color?: string | null
      linked_user_id?: string | null
    }) => {
      const { error } = await supabase.from('people').insert(input)
      if (error) throw error
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['people', v.group_id] }),
  })
}

export function useUpdatePerson() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string
      groupId: string
      patch: Partial<Pick<Person, 'name' | 'kind' | 'color' | 'linked_user_id' | 'contact_email'>>
    }) => {
      const { error } = await supabase.from('people').update(patch).eq('id', id)
      if (error) throw error
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['people', v.groupId] }),
  })
}

export function useDeletePerson() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id }: { id: string; groupId: string }) => {
      const { error } = await supabase.from('people').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['people', v.groupId] }),
  })
}
