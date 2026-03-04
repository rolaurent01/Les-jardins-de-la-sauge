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
