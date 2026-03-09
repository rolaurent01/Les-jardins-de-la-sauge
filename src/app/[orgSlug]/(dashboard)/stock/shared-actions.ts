'use server'

/**
 * Requetes partagees entre les 3 sous-modules Affinage du stock (achats, ventes, ajustements).
 * Reutilise les fonctions existantes du module Produits.
 */

export { fetchVarietiesWithStock as fetchVarietiesForAffinage } from '@/app/[orgSlug]/(dashboard)/produits/shared-actions'
export { fetchStockLevels as fetchStockLevelsForAffinage } from '@/app/[orgSlug]/(dashboard)/produits/shared-actions'
