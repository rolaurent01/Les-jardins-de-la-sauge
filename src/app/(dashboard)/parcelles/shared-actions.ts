'use server'

import { createClient } from '@/lib/supabase/server'
import type { RowWithParcel } from '@/lib/types'

/**
 * Récupère tous les rangs actifs avec leur parcelle et site pour les selects de formulaires.
 * Utilisé par tous les modules du suivi parcelle (A2.2 à A2.7).
 * Triés côté JS : site → parcelle → position_ordre (ou numero).
 */
export async function fetchRowsForSelect(): Promise<RowWithParcel[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('rows')
    .select('id, numero, ancien_numero, longueur_m, position_ordre, notes, deleted_at, created_at, parcel_id, parcels(id, nom, code, sites(id, nom))')
    .is('deleted_at', null)

  if (error) throw new Error(`Erreur lors du chargement des rangs : ${error.message}`)

  const rows = (data ?? []) as RowWithParcel[]

  // Tri : site nom → parcelle nom → position_ordre puis numero
  return rows.sort((a, b) => {
    const siteA = (a.parcels as { sites?: { nom?: string } | null } | null)?.sites?.nom ?? ''
    const siteB = (b.parcels as { sites?: { nom?: string } | null } | null)?.sites?.nom ?? ''
    if (siteA !== siteB) return siteA.localeCompare(siteB, 'fr')

    const parcelA = (a.parcels as { nom?: string } | null)?.nom ?? ''
    const parcelB = (b.parcels as { nom?: string } | null)?.nom ?? ''
    if (parcelA !== parcelB) return parcelA.localeCompare(parcelB, 'fr')

    // Même parcelle : trier par position_ordre si dispo, sinon par numéro
    const posA = a.position_ordre ?? Infinity
    const posB = b.position_ordre ?? Infinity
    if (posA !== posB) return posA - posB

    return a.numero.localeCompare(b.numero, 'fr', { numeric: true })
  })
}
