import { Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { useActiveGroup } from '../group/ActiveGroupProvider'
import { LoadingState } from './ui'

/**
 * Grindar sidor som körs inuti Layout:
 *  - superAdmin: kräver global superadmin
 *  - admin: kräver admin (eller superadmin) i aktiv grupp
 *  - annars: kräver bara att man har minst en grupp
 */
export function GroupGate({
  children,
  superAdmin,
  admin,
}: {
  children: ReactNode
  superAdmin?: boolean
  admin?: boolean
}) {
  const { isSuperAdmin } = useAuth()
  const { loading, groups, isGroupAdmin } = useActiveGroup()

  if (superAdmin) {
    return isSuperAdmin ? <>{children}</> : <Navigate to="/hem" replace />
  }

  if (loading) return <LoadingState label="Laddar…" />

  if (groups.length === 0) {
    return <Navigate to="/valj-familj" replace />
  }

  if (admin && !isGroupAdmin) {
    return <Navigate to="/hem" replace />
  }

  return <>{children}</>
}
