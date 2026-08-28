import { createClient } from 'jsr:@supabase/supabase-js@2'

// Anropas av pg_cron via dispatch_due_reminders(). Verifierar en delad hemlighet
// (x-cron-secret), plockar pending-rader ur reminder_log och skickar mejl via
// Resend. Ingen JWT – därför verify_jwt=false vid deploy.

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

function fmtWhen(startsAt: string, allDay: boolean, tz: string): string {
  const d = new Date(startsAt)
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: tz, weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
  }).formatToParts(d)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  const date = `${get('weekday')} ${get('day')} ${get('month')}`
  return allDay ? date : `${date} kl ${get('hour')}:${get('minute')}`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const secret = Deno.env.get('CRON_SECRET') ?? ''
  if (!secret || req.headers.get('x-cron-secret') !== secret) {
    return json({ error: 'unauthorized' }, 401)
  }

  const url = Deno.env.get('SUPABASE_URL')!
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const resendKey = Deno.env.get('RESEND_API_KEY') ?? ''
  const from = Deno.env.get('REMINDER_FROM') ?? 'Familjeplaneraren <onboarding@resend.dev>'
  const db = createClient(url, service)

  const { data: pending, error } = await db
    .from('reminder_log')
    .select('id, reminder_id, fire_at, attempts, event_reminders(*, events(*, groups(name, timezone), event_assignees(person_id)))')
    .eq('status', 'pending')
    .limit(50)
  if (error) return json({ error: error.message }, 500)

  let sent = 0
  let failed = 0

  for (const row of pending ?? []) {
    // deno-lint-ignore no-explicit-any
    const r: any = Array.isArray(row.event_reminders) ? row.event_reminders[0] : row.event_reminders
    const ev = Array.isArray(r?.events) ? r.events[0] : r?.events
    const grp = Array.isArray(ev?.groups) ? ev.groups[0] : ev?.groups
    if (!r || !ev || ev.status !== 'active') {
      await db.from('reminder_log').update({ status: 'sent', sent_at: new Date().toISOString(), error: 'skippad' }).eq('id', row.id)
      continue
    }
    const tz = grp?.timezone ?? 'Europe/Stockholm'

    // ---- mottagare ----
    const emails = new Set<string>()
    try {
      if (r.recipient_mode === 'custom') {
        for (const e of r.custom_emails ?? []) if (e) emails.add(e.toLowerCase())
      } else if (r.recipient_mode === 'group_adults') {
        const { data: adults } = await db
          .from('people')
          .select('linked_user_id')
          .eq('group_id', ev.group_id)
          .eq('kind', 'adult')
          .not('linked_user_id', 'is', null)
        const ids = (adults ?? []).map((a) => a.linked_user_id)
        if (ids.length) {
          const { data: profs } = await db.from('profiles').select('email, notify_email').in('id', ids)
          for (const p of profs ?? []) if (p.notify_email && p.email) emails.add(p.email.toLowerCase())
        }
      } else {
        // assignees
        const personIds = (ev.event_assignees ?? []).map((a: { person_id: string }) => a.person_id)
        if (personIds.length) {
          const { data: ppl } = await db
            .from('people')
            .select('id, kind, contact_email, linked_user_id')
            .in('id', personIds)
          const directUserIds: string[] = []
          const childIds: string[] = []
          for (const p of ppl ?? []) {
            if (p.contact_email) emails.add(p.contact_email.toLowerCase())
            if (p.linked_user_id) directUserIds.push(p.linked_user_id)
            else childIds.push(p.id)
          }
          // barns föräldrar
          if (childIds.length) {
            const { data: parents } = await db
              .from('people_parents')
              .select('parent_person_id')
              .in('person_id', childIds)
            const parentPersonIds = [...new Set((parents ?? []).map((x) => x.parent_person_id))]
            if (parentPersonIds.length) {
              const { data: pp } = await db
                .from('people')
                .select('linked_user_id, contact_email')
                .in('id', parentPersonIds)
              for (const x of pp ?? []) {
                if (x.contact_email) emails.add(x.contact_email.toLowerCase())
                if (x.linked_user_id) directUserIds.push(x.linked_user_id)
              }
            }
          }
          const ids = [...new Set(directUserIds)]
          if (ids.length) {
            const { data: profs } = await db.from('profiles').select('email, notify_email').in('id', ids)
            for (const p of profs ?? []) if (p.notify_email && p.email) emails.add(p.email.toLowerCase())
          }
        }
      }
    } catch (e) {
      await db.from('reminder_log').update({ status: 'failed', error: `mottagare: ${e}` }).eq('id', row.id)
      failed++
      continue
    }

    if (emails.size === 0) {
      await db.from('reminder_log').update({ status: 'sent', sent_at: new Date().toISOString(), error: 'inga mottagare' }).eq('id', row.id)
      continue
    }

    // ---- mejlet ----
    const when = fmtWhen(ev.starts_at, ev.all_day, tz)
    const lines: string[] = []
    if (r.message) lines.push(escapeHtml(r.message))
    lines.push(`<strong>${escapeHtml(ev.title)}</strong> – ${when}`)
    if (ev.location) lines.push(`Plats: ${escapeHtml(ev.location)}`)
    if ((r.bring_list ?? []).length) lines.push(`Ta med: ${(r.bring_list as string[]).map(escapeHtml).join(', ')}`)
    const html = `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5">
      ${lines.map((l) => `<p style="margin:0 0 8px">${l}</p>`).join('')}
      <p style="margin-top:16px;color:#888;font-size:12px">Påminnelse från ${escapeHtml(grp?.name ?? 'Familjeplaneraren')}</p>
    </div>`
    const subject = r.message ? String(r.message).slice(0, 120) : `Påminnelse: ${ev.title}`

    if (!resendKey) {
      await db.from('reminder_log').update({ status: 'failed', error: 'RESEND_API_KEY saknas' }).eq('id', row.id)
      failed++
      continue
    }

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to: [...emails], subject, html }),
      })
      if (!res.ok) {
        const txt = await res.text()
        await db.from('reminder_log').update({ status: 'failed', error: `resend ${res.status}: ${txt.slice(0, 300)}` }).eq('id', row.id)
        failed++
      } else {
        await db.from('reminder_log').update({ status: 'sent', sent_at: new Date().toISOString(), error: null }).eq('id', row.id)
        sent++
      }
    } catch (e) {
      await db.from('reminder_log').update({ status: 'failed', error: String(e) }).eq('id', row.id)
      failed++
    }
  }

  return json({ processed: (pending ?? []).length, sent, failed })
})

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)
}
