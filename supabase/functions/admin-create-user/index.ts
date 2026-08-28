import { createClient } from 'jsr:@supabase/supabase-js@2'

// Provisionerar en familjemedlem med ett tillfälligt lösenord. Anroparen måste
// vara superadmin, eller admin i gruppen som anges. Returnerar temp-lösenordet
// EN gång – admin får relä det.
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

function generatePassword(len = 14): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  const a = new Uint32Array(len)
  crypto.getRandomValues(a)
  return [...a].map((n) => chars[n % chars.length]).join('')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const authHeader = req.headers.get('Authorization') ?? ''

    const body = await req.json().catch(() => ({}))
    const email = String(body.email ?? '').trim().toLowerCase()
    const name = String(body.name ?? '').trim()
    const groupId: string | null = body.groupId ?? null
    const role: string = ['admin', 'medlem', 'begransad'].includes(body.role) ? body.role : 'medlem'
    const autoApprove = body.autoApprove !== false
    if (!email) return json({ error: 'E-postadress krävs.' }, 400)

    // 1. verifiera anroparen
    const caller = createClient(url, anon, { global: { headers: { Authorization: authHeader } } })
    const { data: me } = await caller.auth.getUser()
    if (!me.user) return json({ error: 'Ej inloggad.' }, 401)
    const { data: myProfile } = await caller
      .from('profiles').select('is_super_admin').eq('id', me.user.id).single()
    let allowed = !!myProfile?.is_super_admin
    if (!allowed && groupId) {
      const { data: gm } = await caller
        .from('group_members').select('role').eq('group_id', groupId).eq('user_id', me.user.id).maybeSingle()
      allowed = gm?.role === 'admin'
    }
    if (!allowed) return json({ error: 'Behörighet saknas.' }, 403)

    // 2. skapa användaren med service role
    const admin = createClient(url, service)
    const password = typeof body.password === 'string' && body.password.length >= 8
      ? body.password : generatePassword()
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: { name },
    })
    if (createErr || !created.user) {
      return json({ error: createErr?.message ?? 'Kunde inte skapa kontot.' }, 400)
    }
    const uid = created.user.id

    const patch: Record<string, unknown> = { name: name || null }
    if (autoApprove) patch.approved = true
    await admin.from('profiles').update(patch).eq('id', uid)

    if (groupId) {
      await admin.from('group_members').insert({ group_id: groupId, user_id: uid, role })
      await admin.from('people').insert({
        group_id: groupId, name: name || email, kind: 'adult', linked_user_id: uid,
      })
    }

    return json({ userId: uid, email, tempPassword: password })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
