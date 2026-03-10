import { createClient, createAdminClient } from '@/lib/supabase/server'
import { isPlatformAdmin } from '@/lib/admin/is-platform-admin'
import { cookies } from 'next/headers'

/**
 * Contexte applicatif résolu côté serveur.
 * Utilisé par toutes les Server Actions pour identifier la ferme active et l'utilisateur.
 */
export type AppContext = {
  userId: string
  farmId: string
  organizationId: string
  orgSlug: string
  /** Vrai si le contexte est résolu via impersonation admin */
  isImpersonating?: boolean
}

/**
 * Résout le contexte applicatif courant depuis la session et le cookie active_farm_id.
 * Si le cookie impersonate_farm_id est présent ET l'utilisateur est platform_admin,
 * ce cookie est prioritaire (mode impersonation).
 *
 * getUser() utilise le client SSR (cookies). Les requêtes DB utilisent le client admin
 * car auth.uid() peut être NULL dans le contexte PostgREST (limitation @supabase/ssr).
 * Le filtrage par user_id est fait explicitement dans les requêtes.
 *
 * @throws Error si l'utilisateur n'est pas authentifié ou n'a pas d'organisation
 */
export async function getContext(): Promise<AppContext> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const admin = createAdminClient()
  const cookieStore = await cookies()

  // Impersonation : prioritaire si l'utilisateur est platform_admin
  const impersonateFarmId = cookieStore.get('impersonate_farm_id')?.value
  if (impersonateFarmId) {
    const isAdmin = await isPlatformAdmin(user.id)
    if (isAdmin) {
      const ctx = await resolveImpersonatedFarmContext(admin, user.id, impersonateFarmId)
      if (ctx) return ctx
    }
    // Si pas admin → on ignore le cookie d'impersonation silencieusement
  }

  const activeFarmId = cookieStore.get('active_farm_id')?.value

  // Tentative avec le cookie active_farm_id
  if (activeFarmId) {
    const ctx = await resolveFarmContext(admin, user.id, activeFarmId)
    if (ctx) return ctx
  }

  // Fallback : première ferme via membership
  return resolveFirstFarmContext(admin, user.id)
}

/** Résout le contexte d'impersonation (pas de vérification membership, admin bypass) */
async function resolveImpersonatedFarmContext(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  farmId: string,
): Promise<AppContext | null> {
  const { data: farm } = await supabase
    .from('farms')
    .select('id, organization_id, organizations(slug)')
    .eq('id', farmId)
    .single()

  if (!farm) return null

  const orgSlug = (farm.organizations as { slug: string } | null)?.slug ?? ''

  return {
    userId,
    farmId: farm.id,
    organizationId: farm.organization_id,
    orgSlug,
    isImpersonating: true,
  }
}

/** Résout le contexte depuis un farm_id donné (vérifié par RLS) */
async function resolveFarmContext(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  farmId: string
): Promise<AppContext | null> {
  const { data: farm } = await supabase
    .from('farms')
    .select('id, organization_id, organizations(slug)')
    .eq('id', farmId)
    .single()

  if (!farm) return null

  // Vérifier que l'utilisateur est membre de cette organisation
  const { data: membership } = await supabase
    .from('memberships')
    .select('organization_id')
    .eq('organization_id', farm.organization_id)
    .eq('user_id', userId)
    .single()

  if (!membership) return null

  const orgSlug = (farm.organizations as { slug: string } | null)?.slug ?? ''

  return {
    userId,
    farmId: farm.id,
    organizationId: farm.organization_id,
    orgSlug,
  }
}

/** Résout le contexte depuis la première ferme accessible à l'utilisateur */
async function resolveFirstFarmContext(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
): Promise<AppContext> {
  const { data: membership } = await supabase
    .from('memberships')
    .select('organization_id, organizations(slug, farms(id))')
    .eq('user_id', userId)
    .limit(1)
    .single()

  if (!membership) throw new Error('No organization access')

  const org = membership.organizations as { slug: string; farms: { id: string }[] } | null
  if (!org || !org.farms || org.farms.length === 0) throw new Error('No farm access')

  const farmId = org.farms[0].id
  const orgSlug = org.slug

  return {
    userId,
    farmId,
    organizationId: membership.organization_id,
    orgSlug,
  }
}
