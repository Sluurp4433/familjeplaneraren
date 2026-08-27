import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { AuthShell } from '../components/AuthShell'
import { Alert, Button, Field, Input, LoadingState } from '../components/ui'

export function PublicHome() {
  const { session, loading, signIn } = useAuth()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (loading) return <LoadingState label="Laddar…" />
  if (session) {
    const from = (location.state as { from?: string } | null)?.from
    return <Navigate to={from && from !== '/' ? from : '/hem'} replace />
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await signIn(email.trim(), password)
    } catch {
      setError('Fel e-post eller lösenord.')
      setBusy(false)
    }
  }

  return (
    <AuthShell
      title="Logga in"
      footer={
        <>
          Inget konto? <Link className="text-brand-700 underline" to="/registrera">Registrera dig</Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        {error && <Alert variant="error">{error}</Alert>}
        <Field label="E-post" htmlFor="email">
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field label="Lösenord" htmlFor="password">
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={busy}>
          Logga in
        </Button>
        <div className="text-center">
          <Link className="text-sm text-slate-500 underline" to="/glomt-losenord">
            Glömt lösenord?
          </Link>
        </div>
      </form>
    </AuthShell>
  )
}
