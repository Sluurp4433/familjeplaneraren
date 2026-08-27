import { format } from 'date-fns'
import { sv } from 'date-fns/locale'

/** ISO-tid → värde för <input type="datetime-local"> (lokal tid, utan sekunder). */
export function toDatetimeLocal(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes(),
  )}`
}

/** <input type="datetime-local">-värde → ISO-sträng. */
export function fromDatetimeLocal(value: string): string {
  return new Date(value).toISOString()
}

export function fmtDate(iso: string): string {
  return format(new Date(iso), 'EEEE d MMMM', { locale: sv })
}

export function fmtTime(iso: string): string {
  return format(new Date(iso), 'HH:mm', { locale: sv })
}

export function fmtDateTime(iso: string): string {
  return format(new Date(iso), 'd MMM HH:mm', { locale: sv })
}

export function fmtRange(startIso: string, endIso: string, allDay: boolean): string {
  if (allDay) return 'Heldag'
  const s = new Date(startIso)
  const e = new Date(endIso)
  const sameDay = s.toDateString() === e.toDateString()
  return sameDay
    ? `${fmtTime(startIso)}–${fmtTime(endIso)}`
    : `${fmtDateTime(startIso)} – ${fmtDateTime(endIso)}`
}

export const dateKey = (d: Date): string => format(d, 'yyyy-MM-dd')
