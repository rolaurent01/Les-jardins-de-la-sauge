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

/** Codes recettes pour la génération des numéros de lot */
export const RECIPE_CODES: Record<string, string> = {
  'La Balade Digestive': 'BD',
  'Nuit Étoilée': 'NE',
  'Lever de Soleil': 'LS',
  'Feu de Camp': 'FC',
  'La Montagne au Féminin': 'MF',
  "L'Équilibre": 'EQ',
  'Le Chant des Rivières': 'CR',
  'Plein Air': 'PA',
  "L'Hivernal": 'HI',
  'Tisane de Noël': 'NO',
  'Douceur Maternelle': 'DM',
  'Aromate volaille': 'AV',
  'Aromate potage': 'AP',
  'Aromate grillades': 'AG',
  'Pique-nique': 'PN',
  'Les Lacs': 'LL',
  'Sel Ortie Calendula': 'SOC',
  'Sel aux herbes': 'SAH',
  'Sel Ail des ours': 'SAO',
  'Sucre Reine des prés': 'SU',
}

/**
 * Extrait le code recette à partir du nom de la recette.
 * Retourne les 2 premières lettres en majuscule si le nom n'est pas dans la map.
 */
export function getRecipeCode(recipeName: string): string {
  return RECIPE_CODES[recipeName] ?? recipeName.substring(0, 2).toUpperCase()
}
