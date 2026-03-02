/**
 * Utilitaires de génération des numéros de lots.
 * Format défini dans context.md §8.2.
 */

/**
 * Génère le numéro interne d'un sachet de graines.
 * Format : SL-AAAA-NNN (ex: SL-2025-001)
 *
 * @param year - L'année du lot (ex: 2025)
 * @param existingCount - Le nombre de lots déjà existants pour cette année
 * @returns Le numéro formaté du nouveau lot
 */
export function generateSeedLotNumber(year: number, existingCount: number): string {
  const sequence = String(existingCount + 1).padStart(3, '0')
  return `SL-${year}-${sequence}`
}

/**
 * Génère le numéro interne d'un semis.
 * Format : SM-AAAA-NNN (ex: SM-2025-001)
 *
 * @param year - L'année du semis
 * @param existingCount - Le nombre de semis déjà existants pour cette année
 * @returns Le numéro formaté du nouveau semis
 */
export function generateSeedlingNumber(year: number, existingCount: number): string {
  const sequence = String(existingCount + 1).padStart(3, '0')
  return `SM-${year}-${sequence}`
}

/**
 * Génère le numéro d'un lot de production.
 * Format : [CODE]AAAAMMJJ (ex: BD20250604)
 * Les codes recettes sont définis dans context.md §8.2.
 *
 * @param recipeCode - Code de la recette (ex: "BD", "NE", "LS"...)
 * @param date - Date du lot
 * @returns Le numéro formaté du lot de production
 */
export function generateProductionLotNumber(recipeCode: string, date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${recipeCode}${year}${month}${day}`
}
