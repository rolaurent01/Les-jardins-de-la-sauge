'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { getContext } from '@/lib/context'

/** Retourne la liste des années clôturées pour la ferme courante */
export async function fetchClosedYears(): Promise<number[]> {
  const supabase = createAdminClient()
  const { farmId } = await getContext()

  // Table season_closures pas encore dans les types générés
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('season_closures')
    .select('annee')
    .eq('farm_id', farmId)

  if (error) return []

  return (data ?? []).map((d: { annee: number }) => d.annee)
}
