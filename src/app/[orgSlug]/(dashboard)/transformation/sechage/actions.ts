'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getContext } from '@/lib/context'
import { buildPath } from '@/lib/utils/path'
import { parseDryingForm } from '@/lib/utils/transformation-parsers'
import type { ActionResult, Drying, DryingWithVariety } from '@/lib/types'
import { mapSupabaseError } from '@/lib/utils/error-messages'

// ---- Requetes ----

/** Recupere tous les sechages de la ferme courante avec variete jointe */
export async function fetchDryings(): Promise<DryingWithVariety[]> {
  const supabase = await createClient()
  const { farmId } = await getContext()

  const { data, error } = await supabase
    .from('dryings')
    .select('*, varieties(id, nom_vernaculaire, nom_latin)')
    .eq('farm_id', farmId)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Erreur lors du chargement des sechages : ${error.message}`)

  return (data ?? []) as unknown as DryingWithVariety[]
}

// ---- Actions ----

/** Cree un sechage + mouvement de stock via RPC transactionnelle */
export async function createDrying(formData: FormData): Promise<ActionResult<Drying>> {
  const parsed = parseDryingForm(formData)
  if ('error' in parsed) return parsed

  const supabase = await createClient()
  const { userId, farmId, orgSlug } = await getContext()

  const { data, error } = await supabase.rpc('create_drying_with_stock', {
    p_farm_id: farmId,
    p_variety_id: parsed.data.variety_id,
    p_partie_plante: parsed.data.partie_plante,
    p_type: parsed.data.type,
    p_etat_plante: parsed.data.etat_plante,
    p_date: parsed.data.date,
    p_poids_g: parsed.data.poids_g,
    p_temps_min: parsed.data.temps_min ?? 0,
    p_commentaire: parsed.data.commentaire ?? '',
    p_created_by: userId,
    p_uuid_client: undefined,
  })

  if (error) return { error: mapSupabaseError(error) }

  revalidatePath(buildPath(orgSlug, '/transformation/sechage'))
  return { success: true, data: { id: data ?? '' } as unknown as Drying }
}

/** Met a jour un sechage + son mouvement de stock via RPC transactionnelle */
export async function updateDrying(
  id: string,
  formData: FormData,
): Promise<ActionResult<Drying>> {
  const parsed = parseDryingForm(formData)
  if ('error' in parsed) return parsed

  const supabase = await createClient()
  const { userId, orgSlug } = await getContext()

  const { error } = await supabase.rpc('update_drying_with_stock', {
    p_drying_id: id,
    p_variety_id: parsed.data.variety_id,
    p_partie_plante: parsed.data.partie_plante,
    p_etat_plante: parsed.data.etat_plante,
    p_date: parsed.data.date,
    p_poids_g: parsed.data.poids_g,
    p_temps_min: parsed.data.temps_min ?? 0,
    p_commentaire: parsed.data.commentaire ?? '',
    p_updated_by: userId,
  })

  if (error) return { error: mapSupabaseError(error) }

  revalidatePath(buildPath(orgSlug, '/transformation/sechage'))
  return { success: true, data: { id } as unknown as Drying }
}

/** Stock en cours de séchage : entrées séchage non encore sorties, par variété × partie × état entrée */
export interface DryingInProgress {
  variety_id: string
  nom_vernaculaire: string
  partie_plante: string
  /** État d'entrée (frais ou tronconnee) — la sortie sera déduite */
  etat_plante_entree: string
  /** Poids restant dans le séchoir (entrées - sorties), en grammes */
  en_sechage_g: number
}

/** Mapping sortie → entrée pour normaliser les états */
const SORTIE_TO_ENTREE: Record<string, string> = {
  sechee: 'frais',
  tronconnee_sechee: 'tronconnee',
}

/**
 * Calcule le stock actuellement en séchage (entrées - sorties),
 * groupé par variété × partie × état d'entrée.
 */
export async function fetchDryingInProgress(): Promise<DryingInProgress[]> {
  const supabase = await createClient()
  const { farmId } = await getContext()

  const { data, error } = await supabase
    .from('dryings')
    .select('variety_id, partie_plante, etat_plante, type, poids_g')
    .eq('farm_id', farmId)

  if (error) throw new Error(`Erreur dryings in progress : ${error.message}`)
  if (!data || data.length === 0) return []

  // Agréger par (variety_id, partie_plante, etat_entree)
  const map = new Map<string, number>()
  for (const d of data) {
    let etatEntree: string
    if (d.type === 'entree') {
      etatEntree = d.etat_plante
    } else {
      etatEntree = SORTIE_TO_ENTREE[d.etat_plante] ?? d.etat_plante
    }

    const key = `${d.variety_id}::${d.partie_plante}::${etatEntree}`
    const current = map.get(key) ?? 0
    const delta = d.type === 'entree' ? Number(d.poids_g) : -Number(d.poids_g)
    map.set(key, current + delta)
  }

  // Filtrer les positifs et enrichir avec noms de variété
  const positiveKeys = [...map.entries()].filter(([, v]) => v > 0)
  if (positiveKeys.length === 0) return []

  const varietyIds = [...new Set(positiveKeys.map(([k]) => k.split('::')[0]))]
  const { data: varieties } = await supabase
    .from('varieties')
    .select('id, nom_vernaculaire')
    .in('id', varietyIds)

  const nameMap = new Map((varieties ?? []).map(v => [v.id, v.nom_vernaculaire]))

  const result: DryingInProgress[] = positiveKeys
    .map(([key, enSechageG]) => {
      const [variety_id, partie_plante, etat_plante_entree] = key.split('::')
      return {
        variety_id,
        nom_vernaculaire: nameMap.get(variety_id) ?? 'Inconnue',
        partie_plante,
        etat_plante_entree,
        en_sechage_g: Math.round(enSechageG * 100) / 100,
      }
    })
    .sort((a, b) => a.nom_vernaculaire.localeCompare(b.nom_vernaculaire, 'fr', { sensitivity: 'base' }))

  return result
}

/** Supprime un sechage + son mouvement de stock via RPC transactionnelle */
export async function deleteDrying(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { orgSlug } = await getContext()

  const { error } = await supabase.rpc('delete_drying_with_stock', {
    p_drying_id: id,
  })

  if (error) return { error: mapSupabaseError(error) }

  revalidatePath(buildPath(orgSlug, '/transformation/sechage'))
  return { success: true }
}
