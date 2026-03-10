import { createAdminClient } from '@/lib/supabase/server'

/**
 * Vérifie que l'utilisateur a accès à la ferme spécifiée.
 *
 * Utilise createAdminClient() (service_role, bypass RLS) pour éviter
 * le problème auth.uid() NULL en contexte SSR PostgREST.
 *
 * Logique : membership sur l'organisation propriétaire de la ferme
 * (même approche que user_farm_ids() en SQL).
 */
export async function userHasFarmAccess(userId: string, farmId: string): Promise<boolean> {
  const admin = createAdminClient()

  // Récupérer la ferme et son organisation
  const { data: farm } = await admin
    .from('farms')
    .select('id, organization_id')
    .eq('id', farmId)
    .single()

  if (!farm) return false

  // Vérifier le membership de l'utilisateur sur l'organisation
  const { data: membership } = await admin
    .from('memberships')
    .select('id')
    .eq('organization_id', farm.organization_id)
    .eq('user_id', userId)
    .single()

  return !!membership
}
