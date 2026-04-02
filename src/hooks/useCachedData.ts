'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import {
  offlineDb,
  type CachedVariety,
  type CachedSite,
  type CachedParcel,
  type CachedRow,
  type CachedPlanting,
  type CachedRecipe,
  type CachedSeedLot,
  type CachedSeedling,
  type CachedExternalMaterial,
  type CachedStock,
  type CachedDryingInProgress,
} from '@/lib/offline/db'

/**
 * Hooks de lecture réactive depuis le cache IndexedDB (Dexie).
 * Utilisés par les formulaires mobiles pour alimenter les dropdowns.
 * useLiveQuery se met à jour automatiquement si IndexedDB change.
 */

/** Cache des variétés pour les selects — triées par nom vernaculaire (insensible casse/accents) */
export function useCachedVarieties() {
  const varieties = useLiveQuery(() =>
    offlineDb.varieties.toArray().then(arr =>
      arr.sort((a, b) =>
        a.nom_vernaculaire.localeCompare(b.nom_vernaculaire, 'fr', { sensitivity: 'base' })
      )
    )
  )
  return {
    varieties: (varieties ?? []) as CachedVariety[],
    isLoading: varieties === undefined,
  }
}

/** Cache des rangs avec parcelles et sites (pour localisation) */
export function useCachedRows() {
  const rows = useLiveQuery(() => offlineDb.rows.toArray())
  const parcels = useLiveQuery(() => offlineDb.parcels.toArray())
  const sites = useLiveQuery(() => offlineDb.sites.toArray())
  return {
    rows: (rows ?? []) as CachedRow[],
    parcels: (parcels ?? []) as CachedParcel[],
    sites: (sites ?? []) as CachedSite[],
    isLoading: rows === undefined || parcels === undefined || sites === undefined,
  }
}

/** Cache des plantations actives — pour enrichir les sélecteurs de rang */
export function useCachedPlantings() {
  const plantings = useLiveQuery(() => offlineDb.plantings.toArray())
  return {
    plantings: (plantings ?? []) as CachedPlanting[],
    isLoading: plantings === undefined,
  }
}

/** Cache des recettes — triées par nom (insensible casse/accents) */
export function useCachedRecipes() {
  const recipes = useLiveQuery(() =>
    offlineDb.recipes.toArray().then(arr =>
      arr.sort((a, b) => a.nom.localeCompare(b.nom, 'fr', { sensitivity: 'base' }))
    )
  )
  return {
    recipes: (recipes ?? []) as CachedRecipe[],
    isLoading: recipes === undefined,
  }
}

/** Cache des sachets de graines — triés par lot_interne (insensible casse/accents) */
export function useCachedSeedLots() {
  const seedLots = useLiveQuery(() =>
    offlineDb.seedLots.toArray().then(arr =>
      arr.sort((a, b) => a.lot_interne.localeCompare(b.lot_interne, 'fr', { sensitivity: 'base' }))
    )
  )
  return {
    seedLots: (seedLots ?? []) as CachedSeedLot[],
    isLoading: seedLots === undefined,
  }
}

/** Cache des semis enrichis pour le sélecteur plantation — triés par date_semis DESC */
export function useCachedSeedlings() {
  const seedlings = useLiveQuery(() =>
    offlineDb.seedlings.toArray().then(arr =>
      arr.sort((a, b) => (b.date_semis ?? '').localeCompare(a.date_semis ?? ''))
    )
  )
  return {
    seedlings: (seedlings ?? []) as CachedSeedling[],
    isLoading: seedlings === undefined,
  }
}

/** Cache des matériaux externes */
export function useCachedExternalMaterials() {
  const materials = useLiveQuery(() => offlineDb.externalMaterials.toArray())
  return {
    materials: (materials ?? []) as CachedExternalMaterial[],
    isLoading: materials === undefined,
  }
}

/** Cache du stock agrégé (snapshot v_stock) — pour afficher le stock dispo dans les transformations */
export function useCachedStock() {
  const stock = useLiveQuery(() => offlineDb.stock.toArray())
  return {
    stock: (stock ?? []) as CachedStock[],
    isLoading: stock === undefined,
  }
}

/** Cache du séchage en cours — pour la sortie séchage mobile */
export function useCachedDryingInProgress() {
  const data = useLiveQuery(() => offlineDb.dryingInProgress.toArray())
  return {
    dryingInProgress: (data ?? []) as CachedDryingInProgress[],
    isLoading: data === undefined,
  }
}
