import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { AuthShell } from '../components/AuthShell'
import { Alert, Button, Field, Input } from '../components/ui'

export function ResetPassword() {
  const { session, updatePassword } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError('Lösenordet måste vara minst 8 tecken.')
      return
    }
    if (password !== password2) {
      setError('Lösenorden matchar inte.')
      return
    }
    setBusy(true)
    try {
      await updatePassword(password)
      navigate('/hem', { replace: true })
    } catch {
      setError('Länken kan ha gått ut. Begär en ny återställningslänk.')
      setBusy(false)
    }
  }

  return (
    <AuthShell title="Välj nytt lösenord">
      {!session ? (
        <Alert variant="warning">
          Öppna den här sidan via länken i återställningsmejlet.
        </Alert>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          {error && <Alert variant="error">{error}</Alert>}
          <Field label="Nytt lösenord" htmlFor="password" hint="Minst 8 tecken.">
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <Field label="Upprepa lösenord" htmlFor="password2">
            <Input
              id="password2"
              type="password"
              autoComplete="new-password"
              required
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
            />
          </Field>
          <Button type="submit" size="lg" className="w-full" loading={busy}>
            Spara lösenord
          </Button>
        </form>
      )}
    </AuthShell>
  )
}
