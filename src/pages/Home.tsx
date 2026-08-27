import { Link } from 'react-router-dom'
import { useActiveGroup } from '../group/ActiveGroupProvider'
import { Button, Card, PageHeader } from '../components/ui'

// Tillfällig inloggad landningssida. Ersätts av kalendern i M2.
export function Home() {
  const { activeGroup, myRole } = useActiveGroup()

  return (
    <div>
      <PageHeader
        title={activeGroup ? activeGroup.name : 'Hem'}
        description={activeGroup ? `Din roll: ${roleLabel(myRole)}` : undefined}
      />
      <Card className="p-6">
        <p className="text-sm text-slate-600">
          Familjegrupper och roller är på plats. Kalender, listor och påminnelser byggs i kommande
          steg.
        </p>
        {(myRole === 'admin' || myRole === 'super') && activeGroup && (
          <div className="mt-4">
            <Link to="/familj">
              <Button variant="secondary">Hantera familjen</Button>
            </Link>
          </div>
        )}
      </Card>
    </div>
  )
}

function roleLabel(role: string | null): string {
  switch (role) {
    case 'admin':
      return 'Admin'
    case 'medlem':
      return 'Medlem'
    case 'begransad':
      return 'Begränsad (endast läsa)'
    case 'super':
      return 'Superadmin'
    default:
      return '–'
  }
}
