import { useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/Toast'
import { Alert, Button, Card, Field, Input, LoadingState, PageHeader } from '../components/ui'

export function Profile() {
  const { profile, updatePassword, refreshProfile } = useAuth()
  const toast = useToast()
  const [name, setName] = useState(profile?.name ?? '')
  const [notify, setNotify] = useState(profile?.notify_email ?? true)
  const [savingProfile, setSavingProfile] = useState(false)

  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [pwErr, setPwErr] = useState<string | null>(null)
  const [savingPw, setSavingPw] = useState(false)

  if (!profile) return <LoadingState />

  async function saveProfile(e: FormEvent) {
    e.preventDefault()
    setSavingProfile(true)
    const { error } = await supabase
      .from('profiles')
      .update({ name: name.trim() || null, notify_email: notify })
      .eq('id', profile!.id)
    setSavingProfile(false)
    if (error) {
      toast.error('Kunde inte spara')
      return
    }
    await refreshProfile()
    toast.success('Sparat')
  }

  async function savePw(e: FormEvent) {
    e.preventDefault()
    setPwErr(null)
    if (pw.length < 8) {
      setPwErr('Minst 8 tecken.')
      return
    }
    if (pw !== pw2) {
      setPwErr('Lösenorden matchar inte.')
      return
    }
    setSavingPw(true)
    try {
      await updatePassword(pw)
      setPw('')
      setPw2('')
      toast.success('Lösenord uppdaterat')
    } catch {
      setPwErr('Kunde inte uppdatera lösenordet.')
    } finally {
      setSavingPw(false)
    }
  }

  return (
    <div>
      <PageHeader title="Min profil" />

      <Card className="mb-6 p-6">
        <form className="space-y-4" onSubmit={saveProfile}>
          <Field label="Namn">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="E-post">
            <Input value={profile.email ?? ''} disabled />
          </Field>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
            Skicka påminnelser och veckans schema till min e-post
          </label>
          <Button type="submit" loading={savingProfile}>
            Spara
          </Button>
        </form>
      </Card>

      <Card className="p-6">
        <h2 className="mb-3 font-semibold text-brand-800">Byt lösenord</h2>
        <form className="space-y-4" onSubmit={savePw}>
          {pwErr && <Alert variant="error">{pwErr}</Alert>}
          <Field label="Nytt lösenord" hint="Minst 8 tecken.">
            <Input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
          </Field>
          <Field label="Upprepa">
            <Input type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
          </Field>
          <Button type="submit" loading={savingPw} variant="secondary">
            Uppdatera lösenord
          </Button>
        </form>
      </Card>
    </div>
  )
}
