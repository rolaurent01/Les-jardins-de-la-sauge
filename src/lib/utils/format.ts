/**
 * Fonctions de formatage réutilisées dans tous les tableaux A2-A7.
 */

/**
 * Formate une durée en minutes en texte lisible.
 * - null → "—"
 * - < 60 → "45 min"
 * - >= 60 → "1h30" (ou "2h" si pas de minutes restantes)
 */
export function formatDuration(minutes: number | null): string {
  if (minutes == null) return '—'
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${h}h`
}

/**
 * Formate une date ISO (YYYY-MM-DD) en JJ/MM/AAAA.
 * Retourne "—" si la date est absente.
 */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

/**
 * Formate un timestamp ISO en durée relative ("il y a 5 min", "il y a 2h").
 * Au-delà de 24h, affiche la date et l'heure (JJ/MM HH:MM).
 */
export function formatRelativeTime(isoString: string | null | undefined): string {
  if (!isoString) return 'jamais'
  const now = Date.now()
  const then = new Date(isoString).getTime()
  if (isNaN(then)) return 'jamais'

  const diffMs = now - then
  const diffMin = Math.floor(diffMs / 60_000)

  if (diffMin < 1) return 'à l\u2019instant'
  if (diffMin < 60) return `il y a ${diffMin} min`

  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `il y a ${diffH}h${diffMin % 60 > 0 ? (diffMin % 60).toString().padStart(2, '0') : ''}`

  // Au-delà de 24h → date absolue JJ/MM HH:MM
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(isoString))
}
