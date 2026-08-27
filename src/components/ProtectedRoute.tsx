import { Navigate, useLocation } from 'react-router-dom'
import { useEffect, type ReactNode } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { LoadingState } from './ui'

/**
 * Grindar för inloggade sidor:
 *  1. laddar        → spinner
 *  2. ingen session → till startsidan (login)
 *  3. ej godkänd    → "väntar på godkännande"-skärm
 *  4. superadmin-krav ej uppfyllt → hem
 * Detta är bara UX – den riktiga spärren är RLS i Postgres.
 */
export function ProtectedRoute({
  children,
  superAdminOnly,
}: {
  children: ReactNode
  superAdminOnly?: boolean
}) {
  const { loading, session, profile, isApproved, isSuperAdmin, refreshProfile } = useAuth()
  const location = useLocation()

  // Medan man väntar på godkännande: polla profilen så skärmen släpper igenom
  // automatiskt när superadmin godkänt.
  useEffect(() => {
    if (session && profile && !isApproved) {
      const t = window.setInterval(refreshProfile, 30_000)
      return () => window.clearInterval(t)
    }
  }, [session, profile, isApproved, refreshProfile])

  if (loading) return <LoadingState label="Kontrollerar behörighet…" />

  if (!session) {
    return <Navigate to="/" replace state={{ from: location.pathname }} />
  }

  if (!isApproved) {
    return <Navigate to="/vantar" replace />
  }

  if (superAdminOnly && !isSuperAdmin) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
