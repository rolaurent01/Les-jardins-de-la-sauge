'use server'

import { createAdminClient, createClient } from '@/lib/supabase/server'
import { isPlatformAdmin } from '@/lib/admin/is-platform-admin'
import { revalidatePath } from 'next/cache'
import type { ActionResult, Farm, Organization } from '@/lib/types'

async function requireAdmin(): Promise<string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non authentifié')
  if (!(await isPlatformAdmin(user.id))) throw new Error('Accès refusé')
  return user.id
}

/** Type des modules disponibles */
export type FarmModule = 'pam' | 'apiculture' | 'maraichage'

/** Ferme enrichie avec organisation et modules */
export type FarmWithRelations = Farm & {
  organization: Pick<Organization, 'id' | 'nom' | 'slug'>
  modules: FarmModule[]
}

/** Récupère toutes les fermes avec organisation et modules actifs */
export async function fetchFarms(): Promise<FarmWithRelations[]> {
  await requireAdmin()
  const admin = createAdminClient()

  const { data: farms, error } = await admin
    .from('farms')
    .select('*, organizations(id, nom, slug)')
    .order('nom')

  if (error) throw new Error(`Erreur : ${error.message}`)
  if (!farms) return []

  // Récupérer les modules pour chaque ferme
  const { data: allModules } = await admin
    .from('farm_modules')
    .select('farm_id, module')

  const modulesByFarm = new Map<string, FarmModule[]>()
  allModules?.forEach(m => {
    const list = modulesByFarm.get(m.farm_id) ?? []
    list.push(m.module as FarmModule)
    modulesByFarm.set(m.farm_id, list)
  })

  return farms.map(f => ({
    ...f,
    organization: f.organizations as unknown as Pick<Organization, 'id' | 'nom' | 'slug'>,
    modules: modulesByFarm.get(f.id) ?? [],
  }))
}

/** Récupère toutes les organisations (pour le sélecteur) */
export async function fetchOrganizationsForSelect(): Promise<Pick<Organization, 'id' | 'nom' | 'max_farms'>[]> {
  await requireAdmin()
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('organizations')
    .select('id, nom, max_farms')
    .order('nom')

  if (error) throw new Error(`Erreur : ${error.message}`)
  return data ?? []
}

/** Crée une nouvelle ferme */
export async function createFarm(formData: FormData): Promise<ActionResult<Farm>> {
  await requireAdmin()
  const admin = createAdminClient()

  const organization_id = (formData.get('organization_id') as string)?.trim()
  const nom = (formData.get('nom') as string)?.trim()
  const slug = (formData.get('slug') as string)?.trim()
  const certif_bio = formData.get('certif_bio') === 'true'
  const organisme_certificateur = (formData.get('organisme_certificateur') as string)?.trim() || null
  const numero_certificat = (formData.get('numero_certificat') as string)?.trim() || null

  if (!organization_id) return { error: 'L\u2019organisation est obligatoire.' }
  if (!nom) return { error: 'Le nom est obligatoire.' }
  if (!slug) return { error: 'Le slug est obligatoire.' }

  // Vérifier max_farms
  const { data: org } = await admin
    .from('organizations')
    .select('max_farms')
    .eq('id', organization_id)
    .single()

  if (org) {
    const { count } = await admin
      .from('farms')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organization_id)

    if (count !== null && count >= org.max_farms) {
      return { error: `Cette organisation a atteint le nombre maximum de fermes (${org.max_farms}).` }
    }
  }

  // Vérifier unicité du slug dans l'organisation
  const { data: existing } = await admin
    .from('farms')
    .select('id')
    .eq('organization_id', organization_id)
    .eq('slug', slug)
    .single()

  if (existing) return { error: `Le slug "${slug}" existe déjà dans cette organisation.` }

  const { data, error } = await admin
    .from('farms')
    .insert({ organization_id, nom, slug, certif_bio, organisme_certificateur, numero_certificat })
    .select()
    .single()

  if (error) return { error: `Erreur : ${error.message}` }

  revalidatePath('/', 'layout')
  return { success: true, data: data as Farm }
}

/** Met à jour une ferme */
export async function updateFarm(id: string, formData: FormData): Promise<ActionResult> {
  await requireAdmin()
  const admin = createAdminClient()

  const nom = (formData.get('nom') as string)?.trim()
  const slug = (formData.get('slug') as string)?.trim()
  const certif_bio = formData.get('certif_bio') === 'true'
  const organisme_certificateur = (formData.get('organisme_certificateur') as string)?.trim() || null
  const numero_certificat = (formData.get('numero_certificat') as string)?.trim() || null

  if (!nom) return { error: 'Le nom est obligatoire.' }
  if (!slug) return { error: 'Le slug est obligatoire.' }

  // Récupérer l'organisation de la ferme pour vérifier le slug
  const { data: farm } = await admin
    .from('farms')
    .select('organization_id')
    .eq('id', id)
    .single()

  if (farm) {
    const { data: existing } = await admin
      .from('farms')
      .select('id')
      .eq('organization_id', farm.organization_id)
      .eq('slug', slug)
      .neq('id', id)
      .single()

    if (existing) return { error: `Le slug "${slug}" existe déjà dans cette organisation.` }
  }

  const { error } = await admin
    .from('farms')
    .update({ nom, slug, certif_bio, organisme_certificateur, numero_certificat })
    .eq('id', id)

  if (error) return { error: `Erreur : ${error.message}` }

  revalidatePath('/', 'layout')
  return { success: true }
}

/** Supprime une ferme (vérifie qu'il n'y a pas de données métier) */
export async function deleteFarm(id: string): Promise<ActionResult> {
  await requireAdmin()
  const admin = createAdminClient()

  // Vérifier qu'il n'y a pas de données métier liées (vérifier les tables principales)
  const tables = ['seed_lots', 'seedlings', 'soil_works', 'plantings', 'harvests', 'production_lots'] as const
  for (const table of tables) {
    const { count } = await admin
      .from(table)
      .select('id', { count: 'exact', head: true })
      .eq('farm_id', id)

    if (count && count > 0) {
      return { error: 'Cette ferme contient des données. Supprimez-les avant de supprimer la ferme.' }
    }
  }

  // Supprimer les modules, farm_access, farm_variety_settings, farm_material_settings
  await admin.from('farm_modules').delete().eq('farm_id', id)
  await admin.from('farm_access').delete().eq('farm_id', id)
  await admin.from('farm_variety_settings').delete().eq('farm_id', id)
  await admin.from('farm_material_settings').delete().eq('farm_id', id)

  const { error } = await admin
    .from('farms')
    .delete()
    .eq('id', id)

  if (error) return { error: `Erreur : ${error.message}` }

  revalidatePath('/', 'layout')
  return { success: true }
}

/** Active ou désactive un module pour une ferme */
export async function toggleModule(farmId: string, module: FarmModule): Promise<ActionResult> {
  await requireAdmin()
  const admin = createAdminClient()

  // Vérifier si le module est déjà actif
  const { data: existing } = await admin
    .from('farm_modules')
    .select('id')
    .eq('farm_id', farmId)
    .eq('module', module)
    .single()

  if (existing) {
    // Désactiver
    const { error } = await admin
      .from('farm_modules')
      .delete()
      .eq('id', existing.id)

    if (error) return { error: `Erreur : ${error.message}` }
  } else {
    // Activer
    const { error } = await admin
      .from('farm_modules')
      .insert({ farm_id: farmId, module })

    if (error) return { error: `Erreur : ${error.message}` }
  }

  revalidatePath('/', 'layout')
  return { success: true }
}
