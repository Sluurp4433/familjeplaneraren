import { supabase } from './supabase'

export type ReminderKind = 'evening_before' | 'morning_of' | 'minutes_before'
export type RecipientMode = 'assignees' | 'group_adults' | 'custom'

export type ReminderDraft = {
  offset_kind: ReminderKind
  offset_minutes: number | null
  at_time: string | null // 'HH:mm'
  message: string | null
  bring_list: string[]
  recipient_mode: RecipientMode
  custom_emails: string[]
}

export function emptyReminder(): ReminderDraft {
  return {
    offset_kind: 'evening_before',
    offset_minutes: null,
    at_time: '18:00',
    message: null,
    bring_list: [],
    recipient_mode: 'assignees',
    custom_emails: [],
  }
}

function toRow(d: ReminderDraft) {
  return {
    offset_kind: d.offset_kind,
    offset_minutes: d.offset_kind === 'minutes_before' ? (d.offset_minutes ?? 60) : null,
    at_time: d.offset_kind === 'minutes_before' ? null : (d.at_time || '18:00'),
    message: d.message?.trim() || null,
    bring_list: d.bring_list,
    recipient_mode: d.recipient_mode,
    custom_emails: d.recipient_mode === 'custom' ? d.custom_emails : [],
  }
}

export async function fetchEventReminders(eventId: string): Promise<ReminderDraft[]> {
  const { data } = await supabase
    .from('event_reminders')
    .select('offset_kind, offset_minutes, at_time, message, bring_list, recipient_mode, custom_emails')
    .eq('event_id', eventId)
    .order('created_at')
  return (data ?? []).map((r) => ({
    offset_kind: r.offset_kind as ReminderKind,
    offset_minutes: r.offset_minutes,
    at_time: r.at_time ? r.at_time.slice(0, 5) : '18:00',
    message: r.message,
    bring_list: r.bring_list ?? [],
    recipient_mode: r.recipient_mode as RecipientMode,
    custom_emails: r.custom_emails ?? [],
  }))
}

export async function fetchSeriesReminders(seriesId: string): Promise<ReminderDraft[]> {
  const { data } = await supabase
    .from('event_series_reminders')
    .select('offset_kind, offset_minutes, at_time, message, bring_list, recipient_mode, custom_emails')
    .eq('series_id', seriesId)
    .order('created_at')
  return (data ?? []).map((r) => ({
    offset_kind: r.offset_kind as ReminderKind,
    offset_minutes: r.offset_minutes,
    at_time: r.at_time ? r.at_time.slice(0, 5) : '18:00',
    message: r.message,
    bring_list: r.bring_list ?? [],
    recipient_mode: r.recipient_mode as RecipientMode,
    custom_emails: r.custom_emails ?? [],
  }))
}

/** Ersätt alla påminnelser på en händelse. fire_at räknas ut av trigger. */
export async function syncEventReminders(eventId: string, groupId: string, list: ReminderDraft[]) {
  await supabase.from('event_reminders').delete().eq('event_id', eventId)
  if (list.length) {
    const { error } = await supabase
      .from('event_reminders')
      .insert(list.map((d) => ({ ...toRow(d), event_id: eventId, group_id: groupId })))
    if (error) throw error
  }
}

export async function syncSeriesReminders(seriesId: string, groupId: string, list: ReminderDraft[]) {
  await supabase.from('event_series_reminders').delete().eq('series_id', seriesId)
  if (list.length) {
    const { error } = await supabase
      .from('event_series_reminders')
      .insert(list.map((d) => ({ ...toRow(d), series_id: seriesId, group_id: groupId })))
    if (error) throw error
  }
}
