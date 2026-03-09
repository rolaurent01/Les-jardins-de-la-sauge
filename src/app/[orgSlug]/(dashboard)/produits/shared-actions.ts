'use server'

import { createClient } from '@/lib/supabase/server'
import { getContext } from '@/lib/context'
import type { ProductCategory, Variety, ExternalMaterial, StockLevel } from '@/lib/types'

/**
 * Recupere toutes les categories de produits (catalogue partage, pas de filtre farm_id).
 */
export async function fetchProductCategories(): Promise<ProductCategory[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('product_categories')
    .select('id, nom')
    .order('nom', { ascending: true })

  if (error) throw new Error(`Erreur lors du chargement des categories : ${error.message}`)

  return (data ?? []) as ProductCategory[]
}

/**
 * Recupere les varietes actives du catalogue pour les formulaires du module Produits.
 * Inclut parties_utilisees (necessaire pour le formulaire ingredients).
 * Filtre les varietes masquees par la ferme courante.
 */
export async function fetchVarietiesWithStock(): Promise<Pick<Variety, 'id' | 'nom_vernaculaire' | 'parties_utilisees'>[]> {
  const supabase = await createClient()
  const { farmId } = await getContext()

  const { data: varieties, error } = await supabase
    .from('varieties')
    .select('id, nom_vernaculaire, parties_utilisees')
    .is('deleted_at', null)
    .is('merged_into_id', null)
    .order('nom_vernaculaire', { ascending: true })

  if (error) throw new Error(`Erreur lors du chargement des varietes : ${error.message}`)

  // Varietes masquees par cette ferme
  const { data: hidden } = await supabase
    .from('farm_variety_settings')
    .select('variety_id')
    .eq('farm_id', farmId)
    .eq('hidden', true)

  const hiddenIds = new Set((hidden ?? []).map((h) => h.variety_id))
  return (varieties ?? []).filter((v) => !hiddenIds.has(v.id)) as Pick<Variety, 'id' | 'nom_vernaculaire' | 'parties_utilisees'>[]
}

/**
 * Recupere les matieres premieres externes non supprimees.
 * Filtre les masquees via farm_material_settings.hidden.
 */
export async function fetchExternalMaterials(): Promise<Pick<ExternalMaterial, 'id' | 'nom'>[]> {
  const supabase = await createClient()
  const { farmId } = await getContext()

  const { data: materials, error } = await supabase
    .from('external_materials')
    .select('id, nom')
    .is('deleted_at', null)
    .order('nom', { ascending: true })

  if (error) throw new Error(`Erreur lors du chargement des matieres : ${error.message}`)

  // Matieres masquees par cette ferme
  const { data: hidden } = await supabase
    .from('farm_material_settings')
    .select('external_material_id')
    .eq('farm_id', farmId)
    .eq('hidden', true)

  const hiddenIds = new Set((hidden ?? []).map((h) => h.external_material_id))
  return (materials ?? []).filter((m) => !hiddenIds.has(m.id)) as Pick<ExternalMaterial, 'id' | 'nom'>[]
}

/**
 * Recupere les niveaux de stock depuis v_stock pour la ferme courante.
 */
export async function fetchStockLevels(): Promise<StockLevel[]> {
  const supabase = await createClient()
  const { farmId } = await getContext()

  const { data, error } = await supabase
    .from('v_stock')
    .select('variety_id, partie_plante, etat_plante, stock_g')
    .eq('farm_id', farmId)

  if (error) throw new Error(`Erreur lors du chargement du stock : ${error.message}`)

  return (data ?? []) as StockLevel[]
}
