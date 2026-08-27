import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { AuthShell } from '../components/AuthShell'
import { Alert, Button, Field, Input } from '../components/ui'

export function Register() {
  const { session, signUp } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<'confirm' | 'session' | null>(null)

  if (session && !done) return <Navigate to="/hem" replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError('Lösenordet måste vara minst 8 tecken.')
      return
    }
    setBusy(true)
    try {
      const { needsConfirmation } = await signUp(email.trim(), password, name.trim())
      setDone(needsConfirmation ? 'confirm' : 'session')
    } catch (err) {
      setError(
        err instanceof Error && /registered|already/i.test(err.message)
          ? 'E-postadressen är redan registrerad.'
          : 'Något gick fel. Försök igen.',
      )
      setBusy(false)
    }
  }

  if (done) {
    return (
      <AuthShell title="Nästan klart">
        <div className="space-y-4">
          <Alert variant="success">
            {done === 'confirm'
              ? 'Konto skapat. Kolla din e-post och klicka på bekräftelselänken.'
              : 'Konto skapat.'}
          </Alert>
          <p className="text-sm text-slate-600">
            Efter bekräftelsen måste en administratör godkänna ditt konto innan du kommer in. Du får
            veta när det är klart.
          </p>
          <Link to="/">
            <Button variant="secondary" className="w-full">
              Till inloggningen
            </Button>
          </Link>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title="Registrera dig"
      subtitle="Skapa ett konto. En administratör måste godkänna det innan du får åtkomst."
      footer={
        <>
          Har du redan konto? <Link className="text-brand-700 underline" to="/">Logga in</Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        {error && <Alert variant="error">{error}</Alert>}
        <Field label="Namn" htmlFor="name">
          <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
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
        <Field label="Lösenord" htmlFor="password" hint="Minst 8 tecken.">
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={busy}>
          Skapa konto
        </Button>
      </form>
    </AuthShell>
  )
}
