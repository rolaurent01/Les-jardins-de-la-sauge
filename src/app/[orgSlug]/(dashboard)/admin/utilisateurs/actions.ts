'use server'

import { createAdminClient, createClient } from '@/lib/supabase/server'
import { isPlatformAdmin } from '@/lib/admin/is-platform-admin'
import { revalidatePath } from 'next/cache'
import type { ActionResult, MembershipRole, FarmAccessPermission } from '@/lib/types'

async function requireAdmin(): Promise<string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non authentifié')
  if (!(await isPlatformAdmin(user.id))) throw new Error('Accès refusé')
  return user.id
}

/** Utilisateur enrichi avec memberships et accès fermes */
export type UserWithRelations = {
  id: string
  email: string
  memberships: {
    id: string
    organization_id: string
    organization_name: string
    role: MembershipRole
  }[]
  farmAccess: {
    id: string
    farm_id: string
    farm_name: string
    permission: FarmAccessPermission
  }[]
}

/** Organisation avec ses fermes (pour les sélecteurs) */
export type OrgWithFarms = {
  id: string
  nom: string
  max_users: number
  farms: { id: string; nom: string }[]
}

/** Récupère tous les utilisateurs avec leurs memberships et fermes */
export async function fetchUsers(): Promise<UserWithRelations[]> {
  await requireAdmin()
  const admin = createAdminClient()

  // Récupérer les users via l'API admin auth
  const { data: authData, error: authError } = await admin.auth.admin.listUsers()
  if (authError) throw new Error(`Erreur auth : ${authError.message}`)

  const users = authData?.users ?? []

  // Récupérer tous les memberships
  const { data: allMemberships } = await admin
    .from('memberships')
    .select('id, organization_id, user_id, role, organizations(nom)')

  // Récupérer tous les farm_access
  const { data: allFarmAccess } = await admin
    .from('farm_access')
    .select('id, farm_id, user_id, permission, farms(nom)')

  return users.map(u => {
    const memberships = (allMemberships ?? [])
      .filter(m => m.user_id === u.id)
      .map(m => ({
        id: m.id,
        organization_id: m.organization_id,
        organization_name: (m.organizations as unknown as { nom: string })?.nom ?? '',
        role: m.role as MembershipRole,
      }))

    const farmAccess = (allFarmAccess ?? [])
      .filter(fa => fa.user_id === u.id)
      .map(fa => ({
        id: fa.id,
        farm_id: fa.farm_id,
        farm_name: (fa.farms as unknown as { nom: string })?.nom ?? '',
        permission: fa.permission as FarmAccessPermission,
      }))

    return {
      id: u.id,
      email: u.email ?? '',
      memberships,
      farmAccess,
    }
  })
}

/** Récupère les organisations avec leurs fermes (pour les sélecteurs) */
export async function fetchOrgsWithFarms(): Promise<OrgWithFarms[]> {
  await requireAdmin()
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('organizations')
    .select('id, nom, max_users, farms(id, nom)')
    .order('nom')

  if (error) throw new Error(`Erreur : ${error.message}`)

  return (data ?? []).map(o => ({
    id: o.id,
    nom: o.nom,
    max_users: o.max_users,
    farms: (o.farms as { id: string; nom: string }[]) ?? [],
  }))
}

/** Crée un nouvel utilisateur avec membership et accès fermes */
export async function createUser(formData: FormData): Promise<ActionResult> {
  await requireAdmin()
  const admin = createAdminClient()

  const email = (formData.get('email') as string)?.trim()
  const password = (formData.get('password') as string)?.trim()
  const organizationId = (formData.get('organization_id') as string)?.trim()
  const role = (formData.get('role') as string)?.trim() as MembershipRole
  const farmIds = (formData.get('farm_ids') as string)?.split(',').filter(Boolean) ?? []

  if (!email) return { error: 'L\u2019email est obligatoire.' }
  if (!password || password.length < 6) return { error: 'Le mot de passe doit faire au moins 6 caractères.' }
  if (!organizationId) return { error: 'L\u2019organisation est obligatoire.' }
  if (!role) return { error: 'Le rôle est obligatoire.' }

  // Vérifier max_users
  const { data: org } = await admin
    .from('organizations')
    .select('max_users')
    .eq('id', organizationId)
    .single()

  if (org) {
    const { count } = await admin
      .from('memberships')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)

    if (count !== null && count >= org.max_users) {
      return { error: `Cette organisation a atteint le nombre maximum d\u2019utilisateurs (${org.max_users}).` }
    }
  }

  // Créer le user dans Supabase Auth
  const { data: authUser, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (authError) return { error: `Erreur création utilisateur : ${authError.message}` }
  if (!authUser.user) return { error: 'Erreur inattendue lors de la création.' }

  const userId = authUser.user.id

  // Créer le membership
  const { error: membershipError } = await admin
    .from('memberships')
    .insert({ organization_id: organizationId, user_id: userId, role })

  if (membershipError) return { error: `Erreur membership : ${membershipError.message}` }

  // Créer les farm_access (pour les members uniquement)
  if (role === 'member' && farmIds.length > 0) {
    const farmAccessRows = farmIds.map(farmId => ({
      farm_id: farmId,
      user_id: userId,
      permission: 'full' as FarmAccessPermission,
    }))

    const { error: farmAccessError } = await admin
      .from('farm_access')
      .insert(farmAccessRows)

    if (farmAccessError) return { error: `Erreur accès ferme : ${farmAccessError.message}` }
  }

  revalidatePath('/', 'layout')
  return { success: true }
}

/** Met à jour le rôle d'un membership */
export async function updateMembership(membershipId: string, role: MembershipRole): Promise<ActionResult> {
  await requireAdmin()
  const admin = createAdminClient()

  const { error } = await admin
    .from('memberships')
    .update({ role })
    .eq('id', membershipId)

  if (error) return { error: `Erreur : ${error.message}` }

  revalidatePath('/', 'layout')
  return { success: true }
}

/** Ajoute un accès ferme à un utilisateur */
export async function addFarmAccess(
  userId: string,
  farmId: string,
  permission: FarmAccessPermission = 'full'
): Promise<ActionResult> {
  await requireAdmin()
  const admin = createAdminClient()

  const { error } = await admin
    .from('farm_access')
    .insert({ farm_id: farmId, user_id: userId, permission })

  if (error) return { error: `Erreur : ${error.message}` }

  revalidatePath('/', 'layout')
  return { success: true }
}

/** Retire un accès ferme */
export async function removeFarmAccess(farmAccessId: string): Promise<ActionResult> {
  await requireAdmin()
  const admin = createAdminClient()

  const { error } = await admin
    .from('farm_access')
    .delete()
    .eq('id', farmAccessId)

  if (error) return { error: `Erreur : ${error.message}` }

  revalidatePath('/', 'layout')
  return { success: true }
}

/** Supprime un utilisateur (auth + memberships + farm_access) */
export async function deleteUser(userId: string): Promise<ActionResult> {
  await requireAdmin()
  const admin = createAdminClient()

  // Vérifier qu'il n'est pas le dernier owner de son organisation
  const { data: memberships } = await admin
    .from('memberships')
    .select('id, organization_id, role')
    .eq('user_id', userId)

  for (const m of memberships ?? []) {
    if (m.role === 'owner') {
      const { count } = await admin
        .from('memberships')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', m.organization_id)
        .eq('role', 'owner')

      if (count !== null && count <= 1) {
        return { error: 'Impossible de supprimer le dernier owner d\u2019une organisation.' }
      }
    }
  }

  // Supprimer les farm_access
  await admin.from('farm_access').delete().eq('user_id', userId)

  // Supprimer les memberships
  await admin.from('memberships').delete().eq('user_id', userId)

  // Supprimer le user auth
  const { error: authError } = await admin.auth.admin.deleteUser(userId)
  if (authError) return { error: `Erreur suppression auth : ${authError.message}` }

  revalidatePath('/', 'layout')
  return { success: true }
}

/** Réinitialise le mot de passe d'un utilisateur */
export async function resetPassword(userId: string, newPassword: string): Promise<ActionResult> {
  await requireAdmin()
  const admin = createAdminClient()

  if (!newPassword || newPassword.length < 6) {
    return { error: 'Le mot de passe doit faire au moins 6 caractères.' }
  }

  const { error } = await admin.auth.admin.updateUserById(userId, { password: newPassword })
  if (error) return { error: `Erreur : ${error.message}` }

  return { success: true }
}
