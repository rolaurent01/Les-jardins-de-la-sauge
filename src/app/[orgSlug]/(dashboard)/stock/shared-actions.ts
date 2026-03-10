'use server'

import { fetchVarietiesWithStock, fetchStockLevels } from '@/app/[orgSlug]/(dashboard)/produits/shared-actions'

/**
 * Requetes partagees entre les 3 sous-modules Affinage du stock (achats, ventes, ajustements).
 * Reutilise les fonctions existantes du module Produits.
 */

export async function fetchVarietiesForAffinage() {
  return fetchVarietiesWithStock()
}

export async function fetchStockLevelsForAffinage() {
  return fetchStockLevels()
}
