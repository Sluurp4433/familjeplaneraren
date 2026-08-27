import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { AuthShell } from '../components/AuthShell'
import { Alert, Button } from '../components/ui'

export function NoGroups() {
  const { isSuperAdmin, signOut } = useAuth()

  return (
    <AuthShell title="Ingen familjegrupp än">
      <div className="space-y-4">
        <Alert variant="info">
          Ditt konto är godkänt, men du är inte med i någon familjegrupp ännu. En administratör
          lägger till dig.
        </Alert>
        {isSuperAdmin && (
          <Link to="/admin">
            <Button className="w-full">Till administrationen</Button>
          </Link>
        )}
        <Button variant="ghost" className="w-full" onClick={() => signOut()}>
          Logga ut
        </Button>
      </div>
    </AuthShell>
  )
}
