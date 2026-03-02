'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { generateSeedLotNumber } from '@/lib/utils/lots'
import { parseSeedLotForm } from '@/lib/utils/semis-parsers'
import type { ActionResult, SeedLot, SeedLotWithVariety } from '@/lib/types'

// ---- Helpers ----

/** Mappe les codes d'erreur Supabase vers des messages lisibles */
function mapSupabaseError(code: string | undefined, fallback: string): string {
  if (code === '23505') return 'Ce numéro de lot interne est déjà utilisé. Réessayez.'
  return fallback
}

// ---- Requêtes ----

/** Récupère toutes les variétés actives pour le sélecteur du formulaire */
export async function fetchVarieties(): Promise<Pick<import('@/lib/types').Variety, 'id' | 'nom_vernaculaire' | 'nom_latin'>[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('varieties')
    .select('id, nom_vernaculaire, nom_latin')
    .is('deleted_at', null)
    .order('nom_vernaculaire')

  if (error) throw new Error(`Erreur lors du chargement des variétés : ${error.message}`)

  return data ?? []
}

/** Récupère tous les sachets actifs avec leur variété jointe */
export async function fetchSeedLots(): Promise<SeedLotWithVariety[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('seed_lots')
    .select('*, varieties(id, nom_vernaculaire, nom_latin)')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Erreur lors du chargement des sachets : ${error.message}`)

  return (data ?? []) as SeedLotWithVariety[]
}

// ---- Actions ----

/** Crée un nouveau sachet de graines avec numéro interne auto-généré */
export async function createSeedLot(formData: FormData): Promise<ActionResult<SeedLot>> {
  const parsed = parseSeedLotForm(formData)
  if ('error' in parsed) return parsed

  const supabase = await createClient()
  const year = new Date().getFullYear()

  // Compter les lots existants pour l'année en cours (y compris archivés pour éviter les doublons)
  const { count, error: countError } = await supabase
    .from('seed_lots')
    .select('id', { count: 'exact', head: true })
    .like('lot_interne', `SL-${year}-%`)

  if (countError) {
    return { error: `Erreur lors de la génération du numéro de lot : ${countError.message}` }
  }

  const lot_interne = generateSeedLotNumber(year, count ?? 0)

  const { data, error } = await supabase
    .from('seed_lots')
    .insert({ ...parsed.data, lot_interne })
    .select()
    .single()

  if (error) return { error: mapSupabaseError(error.code, `Erreur : ${error.message}`) }

  revalidatePath('/semis/sachets')
  return { success: true, data: data as SeedLot }
}

/** Met à jour un sachet existant (lot_interne immutable) */
export async function updateSeedLot(
  id: string,
  formData: FormData,
): Promise<ActionResult<SeedLot>> {
  const parsed = parseSeedLotForm(formData)
  if ('error' in parsed) return parsed

  const supabase = await createClient()

  // lot_interne est intentionnellement exclu : il ne doit jamais être modifié après création
  const { data, error } = await supabase
    .from('seed_lots')
    .update(parsed.data)
    .eq('id', id)
    .select()
    .single()

  if (error) return { error: mapSupabaseError(error.code, `Erreur : ${error.message}`) }

  revalidatePath('/semis/sachets')
  return { success: true, data: data as SeedLot }
}

/** Archive un sachet (soft delete) */
export async function archiveSeedLot(id: string): Promise<ActionResult> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('seed_lots')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { error: `Erreur lors de l'archivage : ${error.message}` }

  revalidatePath('/semis/sachets')
  return { success: true }
}

/** Restaure un sachet archivé */
export async function restoreSeedLot(id: string): Promise<ActionResult> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('seed_lots')
    .update({ deleted_at: null })
    .eq('id', id)

  if (error) return { error: `Erreur lors de la restauration : ${error.message}` }

  revalidatePath('/semis/sachets')
  return { success: true }
}
