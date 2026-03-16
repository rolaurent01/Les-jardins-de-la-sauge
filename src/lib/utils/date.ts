/** Retourne la date du jour au format ISO (YYYY-MM-DD) */
export function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}
