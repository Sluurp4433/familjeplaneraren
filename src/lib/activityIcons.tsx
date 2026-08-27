// Aktivitetssymboler. Emoji i stället för vendored SVG – färgstarkt, noll
// licensfrågor, och barn känner igen dem direkt (fotboll för fotbollsträning,
// ballerina för dans osv). icon_key lagras på händelsen.
export type ActivityIcon = { key: string; label: string; emoji: string }

export const ACTIVITY_ICONS: ActivityIcon[] = [
  { key: 'fotboll', label: 'Fotboll', emoji: '⚽' },
  { key: 'innebandy', label: 'Innebandy', emoji: '🏑' },
  { key: 'ishockey', label: 'Ishockey', emoji: '🏒' },
  { key: 'basket', label: 'Basket', emoji: '🏀' },
  { key: 'tennis', label: 'Tennis/Padel', emoji: '🎾' },
  { key: 'simning', label: 'Simning', emoji: '🏊' },
  { key: 'gymnastik', label: 'Gymnastik', emoji: '🤸' },
  { key: 'dans', label: 'Dans', emoji: '🩰' },
  { key: 'ridning', label: 'Ridning', emoji: '🐴' },
  { key: 'kampsport', label: 'Kampsport', emoji: '🥋' },
  { key: 'skidor', label: 'Skidor', emoji: '⛷️' },
  { key: 'cykel', label: 'Cykel', emoji: '🚴' },
  { key: 'musik', label: 'Musik', emoji: '🎵' },
  { key: 'teater', label: 'Teater', emoji: '🎭' },
  { key: 'pyssel', label: 'Pyssel', emoji: '🎨' },
  { key: 'scouterna', label: 'Scouterna', emoji: '🏕️' },
  { key: 'skola', label: 'Skola', emoji: '🎒' },
  { key: 'utflykt', label: 'Utflykt', emoji: '🚌' },
  { key: 'prov', label: 'Prov/läxa', emoji: '📚' },
  { key: 'kalas', label: 'Kalas', emoji: '🎂' },
  { key: 'lektraff', label: 'Lekträff', emoji: '🧸' },
  { key: 'lakare', label: 'Läkare', emoji: '🩺' },
  { key: 'tandlakare', label: 'Tandläkare', emoji: '🦷' },
  { key: 'traning', label: 'Träning/gym', emoji: '🏋️' },
  { key: 'jobb', label: 'Jobb/möte', emoji: '💼' },
  { key: 'apt', label: 'APT', emoji: '🗓️' },
  { key: 'middag', label: 'Middag/fika', emoji: '🍽️' },
  { key: 'resa', label: 'Resa', emoji: '✈️' },
  { key: 'sopor', label: 'Sophämtning', emoji: '🗑️' },
  { key: 'stad', label: 'Städning', emoji: '🧹' },
  { key: 'handla', label: 'Handla', emoji: '🛒' },
  { key: 'fodelsedag', label: 'Födelsedag', emoji: '🎈' },
]

const BY_KEY = new Map(ACTIVITY_ICONS.map((i) => [i.key, i]))

export function iconFor(key: string | null | undefined): ActivityIcon | null {
  return key ? (BY_KEY.get(key) ?? null) : null
}
