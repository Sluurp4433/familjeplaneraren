import { createClient } from 'jsr:@supabase/supabase-js@2'

// Anropas av pg_cron via dispatch_weekly_digest(). Skickar "Veckans schema"
// (nästa 7 dagar) till varje familjs vuxna med notify_email.
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (o: unknown, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

function fmtDay(d: string, tz: string) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(d))
}
function fmtTime(d: string, tz: string) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: tz, hour: '2-digit', minute: '2-digit' }).format(new Date(d))
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const secret = Deno.env.get('CRON_SECRET') ?? ''
  if (!secret || req.headers.get('x-cron-secret') !== secret) return json({ error: 'unauthorized' }, 401)

  const url = Deno.env.get('SUPABASE_URL')!
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const resendKey = Deno.env.get('RESEND_API_KEY') ?? ''
  const from = Deno.env.get('REMINDER_FROM') ?? 'Familjeplaneraren <onboarding@resend.dev>'
  const db = createClient(url, service)

  const { data: pending } = await db
    .from('digest_log')
    .select('id, group_id, period_start, groups(name, timezone)')
    .eq('status', 'pending')
    .limit(50)

  let sent = 0
  let failed = 0
  const now = new Date()
  const in7 = new Date(now.getTime() + 7 * 864e5)

  for (const row of pending ?? []) {
    // deno-lint-ignore no-explicit-any
    const grp: any = Array.isArray(row.groups) ? row.groups[0] : row.groups
    const tz = grp?.timezone ?? 'Europe/Stockholm'
    try {
      const { data: adults } = await db
        .from('people').select('linked_user_id')
        .eq('group_id', row.group_id).eq('kind', 'adult').not('linked_user_id', 'is', null)
      const ids = (adults ?? []).map((a) => a.linked_user_id)
      const emails = new Set<string>()
      if (ids.length) {
        const { data: profs } = await db.from('profiles').select('email, notify_email').in('id', ids)
        for (const p of profs ?? []) if (p.notify_email && p.email) emails.add(String(p.email).toLowerCase())
      }
      if (emails.size === 0) {
        await db.from('digest_log').update({ status: 'sent', sent_at: now.toISOString(), error: 'inga mottagare' }).eq('id', row.id)
        continue
      }

      const { data: events } = await db
        .from('events')
        .select('title, starts_at, all_day, location, event_assignees(people(name))')
        .eq('group_id', row.group_id).eq('status', 'active')
        .gte('starts_at', now.toISOString()).lt('starts_at', in7.toISOString())
        .order('starts_at')

      const byDay = new Map<string, string[]>()
      for (const e of events ?? []) {
        const day = fmtDay(e.starts_at, tz)
        // deno-lint-ignore no-explicit-any
        const who = ((e as any).event_assignees ?? [])
          .map((a: any) => (Array.isArray(a.people) ? a.people[0] : a.people)?.name)
          .filter(Boolean).join(', ')
        const line = `${e.all_day ? 'Heldag' : fmtTime(e.starts_at, tz)} – ${esc(e.title)}` +
          (e.location ? ` (${esc(e.location)})` : '') + (who ? ` · ${esc(who)}` : '')
        byDay.set(day, [...(byDay.get(day) ?? []), line])
      }

      const inner = byDay.size === 0
        ? '<p>Inget inplanerat den här veckan.</p>'
        : [...byDay.entries()].map(([day, lines]) =>
            `<p style="margin:12px 0 4px"><strong style="text-transform:capitalize">${esc(day)}</strong></p>` +
            lines.map((l) => `<p style="margin:0 0 2px">${l}</p>`).join('')).join('')
      const html = `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5">
        <h2 style="margin:0 0 8px">Veckans schema – ${esc(grp?.name ?? 'Familjen')}</h2>${inner}</div>`

      if (!resendKey) {
        await db.from('digest_log').update({ status: 'failed', error: 'RESEND_API_KEY saknas' }).eq('id', row.id)
        failed++
        continue
      }
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to: [...emails], subject: `Veckans schema – ${grp?.name ?? 'Familjen'}`, html }),
      })
      if (!res.ok) {
        await db.from('digest_log').update({ status: 'failed', error: `resend ${res.status}` }).eq('id', row.id)
        failed++
      } else {
        await db.from('digest_log').update({ status: 'sent', sent_at: now.toISOString(), error: null }).eq('id', row.id)
        sent++
      }
    } catch (e) {
      await db.from('digest_log').update({ status: 'failed', error: String(e) }).eq('id', row.id)
      failed++
    }
  }
  return json({ processed: (pending ?? []).length, sent, failed })
})
