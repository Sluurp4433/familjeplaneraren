import { createClient } from 'jsr:@supabase/supabase-js@2'
import { cors, json, generatePassword } from '../_shared/cors.ts'

// Skapar den FÖRSTA superadministratören. Fungerar bara så länge ingen superadmin
// finns – därefter inaktiveras funktionen automatiskt (self-disabling bootstrap).
//
// Anropa manuellt med anon-nyckeln, t.ex.:
//   curl -X POST "$SUPABASE_URL/functions/v1/bootstrap-super-admin" \
//     -H "Authorization: Bearer $ANON_KEY" -H "Content-Type: application/json" \
//     -d '{"email":"du@exempel.se","name":"Ditt namn"}'
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const admin = createClient(url, service)

    const { count, error: countErr } = await admin
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('is_super_admin', true)
    if (countErr) return json({ error: countErr.message }, 500)
    if ((count ?? 0) > 0) {
      return json({ error: 'En superadmin finns redan. Bootstrap är inaktiverad.' }, 403)
    }

    const body = await req.json().catch(() => ({}))
    const email = String(body.email ?? '').trim().toLowerCase()
    const name = String(body.name ?? '').trim()
    if (!email) return json({ error: 'E-postadress krävs.' }, 400)

    const password =
      typeof body.password === 'string' && body.password.length >= 8
        ? body.password
        : generatePassword()

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
    })
    if (createErr || !created.user) {
      return json({ error: createErr?.message ?? 'Kunde inte skapa kontot.' }, 400)
    }

    // Profilen har skapats av handle_new_user-triggern. Sätt privilegierna –
    // tillåtet eftersom service_role kringgår protect_profile_privileges.
    const { error: updErr } = await admin
      .from('profiles')
      .update({ is_super_admin: true, approved: true, name: name || null })
      .eq('id', created.user.id)
    if (updErr) return json({ error: updErr.message }, 500)

    return json({ userId: created.user.id, email, tempPassword: password })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
