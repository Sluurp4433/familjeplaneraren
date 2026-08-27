import type { Person } from '../types/database.types'

// Palett för personprickar i kalendern (matchar tailwind `person`-skalan).
const PALETTE = ['#e2557b', '#e0973a', '#2fa0a0', '#5b6ee1', '#9c5bd4', '#7aa93c', '#d4833f', '#4a9fd4']

export function personColor(person: Pick<Person, 'id' | 'color'>): string {
  if (person.color) return person.color
  let h = 0
  for (let i = 0; i < person.id.length; i++) h = (h * 31 + person.id.charCodeAt(i)) >>> 0
  return PALETTE[h % PALETTE.length]
}
