import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { AuthShell } from '../components/AuthShell'
import { Alert, Button, Field, Input } from '../components/ui'

export function ForgotPassword() {
  const { requestPasswordReset } = useAuth()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      await requestPasswordReset(email.trim())
    } catch {
      // Avslöja inte om adressen finns – visa alltid samma bekräftelse.
    }
    setSent(true)
    setBusy(false)
  }

  return (
    <AuthShell
      title="Glömt lösenord"
      footer={<Link className="text-brand-700 underline" to="/">Tillbaka till inloggningen</Link>}
    >
      {sent ? (
        <Alert variant="success">
          Om adressen finns hos oss har vi skickat en återställningslänk. Kolla din e-post.
        </Alert>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
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
          <Button type="submit" size="lg" className="w-full" loading={busy}>
            Skicka återställningslänk
          </Button>
        </form>
      )}
    </AuthShell>
  )
}
