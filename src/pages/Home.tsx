import { useAuth } from '../auth/AuthProvider'
import { Badge, Button, Card } from '../components/ui'

// Tillfällig inloggad landningssida. Ersätts av kalendern (M2) och riktig
// Layout + gruppväxlare (M1).
export function Home() {
  const { profile, isSuperAdmin, signOut } = useAuth()

  return (
    <main className="min-h-dvh bg-brand-50">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <span className="font-semibold text-brand-800">Familjeplaneraren</span>
        <div className="flex items-center gap-3">
          {isSuperAdmin && <Badge color="amber">Superadmin</Badge>}
          <Button variant="ghost" size="md" onClick={() => signOut()}>
            Logga ut
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-xl px-4 py-10">
        <Card className="p-6">
          <h1 className="text-lg font-semibold text-brand-800">
            Välkommen, {profile?.name ?? profile?.email}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Ditt konto är godkänt. Familjegrupper, kalender, listor och påminnelser byggs i kommande
            steg.
          </p>
        </Card>
      </div>
    </main>
  )
}
