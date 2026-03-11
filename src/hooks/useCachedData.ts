'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import {
  offlineDb,
  type CachedVariety,
  type CachedSite,
  type CachedParcel,
  type CachedRow,
  type CachedRecipe,
  type CachedSeedLot,
  type CachedSeedling,
  type CachedExternalMaterial,
} from '@/lib/offline/db'

/**
 * Hooks de lecture réactive depuis le cache IndexedDB (Dexie).
 * Utilisés par les formulaires mobiles pour alimenter les dropdowns.
 * useLiveQuery se met à jour automatiquement si IndexedDB change.
 */

/** Cache des variétés pour les selects */
export function useCachedVarieties() {
  const varieties = useLiveQuery(() => offlineDb.varieties.toArray())
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

/** Cache des recettes */
export function useCachedRecipes() {
  const recipes = useLiveQuery(() => offlineDb.recipes.toArray())
  return {
    recipes: (recipes ?? []) as CachedRecipe[],
    isLoading: recipes === undefined,
  }
}

/** Cache des sachets de graines (pour select "sachet source") */
export function useCachedSeedLots() {
  const seedLots = useLiveQuery(() => offlineDb.seedLots.toArray())
  return {
    seedLots: (seedLots ?? []) as CachedSeedLot[],
    isLoading: seedLots === undefined,
  }
}

/** Cache des semis enrichis pour le sélecteur plantation */
export function useCachedSeedlings() {
  const seedlings = useLiveQuery(() => offlineDb.seedlings.toArray())
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
