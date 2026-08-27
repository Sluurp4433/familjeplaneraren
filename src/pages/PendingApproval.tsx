import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { AuthShell } from '../components/AuthShell'
import { Alert, Button } from '../components/ui'

export function PendingApproval() {
  const { session, profile, isApproved, signOut, refreshProfile } = useAuth()

  if (!session) return <Navigate to="/" replace />
  if (isApproved) return <Navigate to="/hem" replace />

  return (
    <AuthShell title="Väntar på godkännande">
      <div className="space-y-4">
        <Alert variant="info">
          Hej {profile?.name ?? 'där'}! Ditt konto är skapat men måste godkännas av en administratör
          innan du kommer in. Du får ett meddelande när det är klart.
        </Alert>
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => refreshProfile()}>
            Uppdatera
          </Button>
          <Button variant="ghost" className="flex-1" onClick={() => signOut()}>
            Logga ut
          </Button>
        </div>
      </div>
    </AuthShell>
  )
}
