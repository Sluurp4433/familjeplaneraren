import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import type { GroupRole } from '../types/database.types'

export type MyGroup = {
  id: string
  name: string
  timezone: string
  role: GroupRole
}

/** Roll i den aktiva gruppen, eller 'super' för superadmin utan medlemskap där. */
export type EffectiveRole = GroupRole | 'super'

type ActiveGroupContextValue = {
  groups: MyGroup[]
  loading: boolean
  activeGroup: MyGroup | null
  setActiveGroup: (id: string) => void
  myRole: EffectiveRole | null
  isGroupAdmin: boolean
  isGroupWriter: boolean
  refetchGroups: () => void
}

const ActiveGroupContext = createContext<ActiveGroupContextValue | undefined>(undefined)

const STORAGE_KEY = 'fp.activeGroup'

function readStored(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

export function ActiveGroupProvider({ children }: { children: ReactNode }) {
  const { session, isApproved, isSuperAdmin } = useAuth()
  const userId = session?.user?.id ?? null
  const queryClient = useQueryClient()
  const [activeId, setActiveId] = useState<string | null>(readStored())

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['my-groups', userId],
    enabled: !!userId && isApproved,
    queryFn: async (): Promise<MyGroup[]> => {
      const { data, error } = await supabase
        .from('group_members')
        .select('role, groups(id, name, timezone)')
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? [])
        .map((row) => {
          const g = Array.isArray(row.groups) ? row.groups[0] : row.groups
          if (!g) return null
          return { id: g.id, name: g.name, timezone: g.timezone, role: row.role }
        })
        .filter((x): x is MyGroup => x !== null)
    },
  })

  const groups = useMemo(() => data ?? [], [data])

  // Håll activeId giltigt mot listan.
  useEffect(() => {
    if (groups.length === 0) return
    const stillValid = activeId && groups.some((g) => g.id === activeId)
    if (!stillValid) {
      const next = groups[0].id
      setActiveId(next)
      try {
        window.localStorage.setItem(STORAGE_KEY, next)
      } catch {
        /* strunt samma */
      }
    }
  }, [groups, activeId])

  const setActiveGroup = useCallback(
    (id: string) => {
      setActiveId(id)
      try {
        window.localStorage.setItem(STORAGE_KEY, id)
      } catch {
        /* strunt samma */
      }
      // Töm grupp-scopade queries så nästa grupp inte visar gammal cache.
      queryClient.removeQueries({ queryKey: ['events'] })
      queryClient.removeQueries({ queryKey: ['people'] })
      queryClient.removeQueries({ queryKey: ['lists'] })
      queryClient.removeQueries({ queryKey: ['meals'] })
    },
    [queryClient],
  )

  const activeGroup = useMemo(
    () => groups.find((g) => g.id === activeId) ?? null,
    [groups, activeId],
  )

  const myRole: EffectiveRole | null = activeGroup
    ? activeGroup.role
    : isSuperAdmin
      ? 'super'
      : null

  const value: ActiveGroupContextValue = {
    groups,
    loading: isLoading,
    activeGroup,
    setActiveGroup,
    myRole,
    isGroupAdmin: myRole === 'admin' || myRole === 'super',
    isGroupWriter: myRole === 'admin' || myRole === 'medlem' || myRole === 'super',
    refetchGroups: () => void refetch(),
  }

  return <ActiveGroupContext.Provider value={value}>{children}</ActiveGroupContext.Provider>
}

export function useActiveGroup(): ActiveGroupContextValue {
  const ctx = useContext(ActiveGroupContext)
  if (!ctx) throw new Error('useActiveGroup måste användas inom ActiveGroupProvider')
  return ctx
}
