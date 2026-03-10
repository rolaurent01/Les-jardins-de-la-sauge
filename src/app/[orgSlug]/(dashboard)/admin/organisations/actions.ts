'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'
import { isPlatformAdmin } from '@/lib/admin/is-platform-admin'
import { revalidatePath } from 'next/cache'
import type { ActionResult, Organization } from '@/lib/types'

/** Vérifie que l'utilisateur courant est super admin */
async function requireAdmin(): Promise<string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non authentifié')
  if (!(await isPlatformAdmin(user.id))) throw new Error('Accès refusé')
  return user.id
}

/** Génère un slug URL-safe depuis un nom */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Organisation enrichie avec compteurs */
export type OrganizationWithCounts = Organization & {
  farmsCount: number
  usersCount: number
}

/** Récupère toutes les organisations avec compteurs */
export async function fetchOrganizations(): Promise<OrganizationWithCounts[]> {
  await requireAdmin()
  const admin = createAdminClient()

  const { data: orgs, error } = await admin
    .from('organizations')
    .select('*')
    .order('nom')

  if (error) throw new Error(`Erreur : ${error.message}`)
  if (!orgs) return []

  // Compteurs en parallèle
  const enriched = await Promise.all(
    orgs.map(async (org) => {
      const [farmsRes, membersRes] = await Promise.all([
        admin.from('farms').select('id', { count: 'exact', head: true }).eq('organization_id', org.id),
        admin.from('memberships').select('id', { count: 'exact', head: true }).eq('organization_id', org.id),
      ])
      return {
        ...org,
        farmsCount: farmsRes.count ?? 0,
        usersCount: membersRes.count ?? 0,
      } as OrganizationWithCounts
    })
  )

  return enriched
}

/** Crée une nouvelle organisation */
export async function createOrganization(formData: FormData): Promise<ActionResult<Organization>> {
  await requireAdmin()
  const admin = createAdminClient()

  const nom = (formData.get('nom') as string)?.trim()
  if (!nom) return { error: 'Le nom est obligatoire.' }

  const slug = (formData.get('slug') as string)?.trim() || slugify(nom)
  const nom_affiche = (formData.get('nom_affiche') as string)?.trim() || null
  const VALID_PLANS = ['starter', 'pro', 'enterprise'] as const
  type Plan = typeof VALID_PLANS[number]
  const rawPlan = (formData.get('plan') as string) || 'starter'
  const plan: Plan = VALID_PLANS.includes(rawPlan as Plan) ? (rawPlan as Plan) : 'starter'
  const max_farms = parseInt(formData.get('max_farms') as string) || 3
  const max_users = parseInt(formData.get('max_users') as string) || 5
  const couleur_primaire = (formData.get('couleur_primaire') as string)?.trim() || '#3A5A40'
  const couleur_secondaire = (formData.get('couleur_secondaire') as string)?.trim() || '#588157'

  // Vérifier unicité du slug
  const { data: existing } = await admin
    .from('organizations')
    .select('id')
    .eq('slug', slug)
    .single()

  if (existing) return { error: `Le slug "${slug}" est déjà utilisé.` }

  const { data, error } = await admin
    .from('organizations')
    .insert({ nom, slug, nom_affiche, plan, max_farms, max_users, couleur_primaire, couleur_secondaire })
    .select()
    .single()

  if (error) return { error: `Erreur : ${error.message}` }

  revalidatePath('/', 'layout')
  return { success: true, data: data as Organization }
}

/** Met à jour une organisation */
export async function updateOrganization(id: string, formData: FormData): Promise<ActionResult> {
  await requireAdmin()
  const admin = createAdminClient()

  const nom = (formData.get('nom') as string)?.trim()
  if (!nom) return { error: 'Le nom est obligatoire.' }

  const slug = (formData.get('slug') as string)?.trim()
  if (!slug) return { error: 'Le slug est obligatoire.' }

  const nom_affiche = (formData.get('nom_affiche') as string)?.trim() || null
  const VALID_PLANS = ['starter', 'pro', 'enterprise'] as const
  type Plan = typeof VALID_PLANS[number]
  const rawPlan = (formData.get('plan') as string) || 'starter'
  const plan: Plan = VALID_PLANS.includes(rawPlan as Plan) ? (rawPlan as Plan) : 'starter'
  const max_farms = parseInt(formData.get('max_farms') as string) || 3
  const max_users = parseInt(formData.get('max_users') as string) || 5
  const couleur_primaire = (formData.get('couleur_primaire') as string)?.trim() || '#3A5A40'
  const couleur_secondaire = (formData.get('couleur_secondaire') as string)?.trim() || '#588157'

  // Vérifier unicité du slug (exclure l'organisation courante)
  const { data: existing } = await admin
    .from('organizations')
    .select('id')
    .eq('slug', slug)
    .neq('id', id)
    .single()

  if (existing) return { error: `Le slug "${slug}" est déjà utilisé.` }

  const { error } = await admin
    .from('organizations')
    .update({ nom, slug, nom_affiche, plan, max_farms, max_users, couleur_primaire, couleur_secondaire })
    .eq('id', id)

  if (error) return { error: `Erreur : ${error.message}` }

  revalidatePath('/', 'layout')
  return { success: true }
}

/** Supprime une organisation (vérifie qu'il n'y a pas de fermes) */
export async function deleteOrganization(id: string): Promise<ActionResult> {
  await requireAdmin()
  const admin = createAdminClient()

  // Vérifier qu'il n'y a aucune ferme liée
  const { count } = await admin
    .from('farms')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', id)

  if (count && count > 0) {
    return { error: 'Supprimez d\u2019abord les fermes de cette organisation.' }
  }

  // Supprimer les memberships associés
  await admin.from('memberships').delete().eq('organization_id', id)

  const { error } = await admin
    .from('organizations')
    .delete()
    .eq('id', id)

  if (error) return { error: `Erreur : ${error.message}` }

  revalidatePath('/', 'layout')
  return { success: true }
}

/** Upload du logo d'une organisation vers Supabase Storage */
export async function uploadOrganizationLogo(orgId: string, formData: FormData): Promise<ActionResult> {
  await requireAdmin()
  const admin = createAdminClient()

  const file = formData.get('logo') as File
  if (!file || file.size === 0) return { error: 'Aucun fichier sélectionné.' }

  const MAX_SIZE = 2 * 1024 * 1024 // 2 Mo
  if (file.size > MAX_SIZE) return { error: 'Le fichier dépasse 2 Mo.' }

  // Vérifier/créer le bucket
  const { data: buckets } = await admin.storage.listBuckets()
  const bucketExists = buckets?.some(b => b.name === 'org-logos')
  if (!bucketExists) {
    await admin.storage.createBucket('org-logos', { public: true })
  }

  const ext = file.name.split('.').pop() || 'png'
  const path = `${orgId}/logo.${ext}`

  // Upload (upsert pour remplacer si existant)
  const { error: uploadError } = await admin.storage
    .from('org-logos')
    .upload(path, file, { upsert: true })

  if (uploadError) return { error: `Erreur upload : ${uploadError.message}` }

  // Récupérer l'URL publique
  const { data: urlData } = admin.storage
    .from('org-logos')
    .getPublicUrl(path)

  // Mettre à jour l'organisation
  const { error: updateError } = await admin
    .from('organizations')
    .update({ logo_url: urlData.publicUrl })
    .eq('id', orgId)

  if (updateError) return { error: `Erreur mise à jour : ${updateError.message}` }

  revalidatePath('/', 'layout')
  return { success: true }
}
