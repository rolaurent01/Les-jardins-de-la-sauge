/**
 * Logique pure de déduction des mouvements de stock.
 * Encode la même logique que les RPCs SQL (017_transformation_rpcs.sql)
 * en TypeScript pour les tests et l'affichage UI.
 */

export function deduceStockMovement(
  module: 'tronconnage' | 'sechage' | 'triage',
  type: 'entree' | 'sortie',
  etatPlante?: string,
): { typeMouvement: 'entree' | 'sortie'; etatPlante: string; sourceType: string } {
  const typeMouvement = type === 'entree' ? 'sortie' : 'entree'
  const sourceType = `${module}_${type}`

  if (module === 'tronconnage') {
    return {
      typeMouvement,
      etatPlante: type === 'entree' ? 'frais' : 'tronconnee',
      sourceType,
    }
  }

  // Séchage et triage : l'état plante est transmis tel quel
  if (!etatPlante) {
    throw new Error(`etatPlante requis pour le module ${module}`)
  }

  return { typeMouvement, etatPlante, sourceType }
}
