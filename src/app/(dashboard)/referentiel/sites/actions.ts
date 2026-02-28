'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { ActionResult, Site, ParcelWithSite, RowWithParcel } from '@/lib/types'

const REVALIDATE = '/referentiel/sites'

// ============================================================
// SITES
// ============================================================

export async function createSite(formData: FormData): Promise<ActionResult<Site>> {
  const supabase = await createClient()
  const nom = (formData.get('nom') as string).trim()
  const description = (formData.get('description') as string)?.trim() || null

  if (!nom) return { error: 'Le nom du site est obligatoire.' }

  const { data, error } = await supabase
    .from('sites')
    .insert({ nom, description })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') return { error: 'Un site avec ce nom existe déjà.' }
    return { error: `Erreur : ${error.message}` }
  }

  revalidatePath(REVALIDATE)
  return { success: true, data: data as Site }
}

export async function updateSite(id: string, formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()
  const nom = (formData.get('nom') as string).trim()
  const description = (formData.get('description') as string)?.trim() || null

  if (!nom) return { error: 'Le nom du site est obligatoire.' }

  const { error } = await supabase
    .from('sites')
    .update({ nom, description })
    .eq('id', id)

  if (error) {
    if (error.code === '23505') return { error: 'Un site avec ce nom existe déjà.' }
    return { error: `Erreur : ${error.message}` }
  }

  revalidatePath(REVALIDATE)
  return { success: true }
}

export async function archiveSite(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('sites')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { error: `Erreur lors de l'archivage : ${error.message}` }
  revalidatePath(REVALIDATE)
  return { success: true }
}

export async function restoreSite(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('sites')
    .update({ deleted_at: null })
    .eq('id', id)

  if (error) return { error: `Erreur lors de la restauration : ${error.message}` }
  revalidatePath(REVALIDATE)
  return { success: true }
}

// ============================================================
// PARCELLES
// ============================================================

function parseParcelForm(formData: FormData) {
  return {
    site_id: (formData.get('site_id') as string) || null,
    nom: (formData.get('nom') as string).trim(),
    code: (formData.get('code') as string).trim().toUpperCase(),
    orientation: (formData.get('orientation') as string)?.trim() || null,
    description: (formData.get('description') as string)?.trim() || null,
  }
}

export async function createParcel(formData: FormData): Promise<ActionResult<ParcelWithSite>> {
  const supabase = await createClient()
  const fields = parseParcelForm(formData)

  if (!fields.nom) return { error: 'Le nom de la parcelle est obligatoire.' }
  if (!fields.code) return { error: 'Le code de la parcelle est obligatoire.' }
  if (!fields.site_id) return { error: 'Le site est obligatoire.' }

  const { data, error } = await supabase
    .from('parcels')
    .insert(fields)
    .select('*, sites(id, nom)')
    .single()

  if (error) {
    if (error.code === '23505') return { error: 'Ce code de parcelle existe déjà.' }
    return { error: `Erreur : ${error.message}` }
  }

  revalidatePath(REVALIDATE)
  return { success: true, data: data as ParcelWithSite }
}

export async function updateParcel(id: string, formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()
  const fields = parseParcelForm(formData)

  if (!fields.nom) return { error: 'Le nom de la parcelle est obligatoire.' }
  if (!fields.code) return { error: 'Le code de la parcelle est obligatoire.' }
  if (!fields.site_id) return { error: 'Le site est obligatoire.' }

  const { error } = await supabase
    .from('parcels')
    .update(fields)
    .eq('id', id)

  if (error) {
    if (error.code === '23505') return { error: 'Ce code de parcelle existe déjà.' }
    return { error: `Erreur : ${error.message}` }
  }

  revalidatePath(REVALIDATE)
  return { success: true }
}

export async function archiveParcel(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('parcels')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { error: `Erreur lors de l'archivage : ${error.message}` }
  revalidatePath(REVALIDATE)
  return { success: true }
}

export async function restoreParcel(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('parcels')
    .update({ deleted_at: null })
    .eq('id', id)

  if (error) return { error: `Erreur lors de la restauration : ${error.message}` }
  revalidatePath(REVALIDATE)
  return { success: true }
}

// ============================================================
// RANGS
// ============================================================

function parseRowForm(formData: FormData) {
  return {
    parcel_id: (formData.get('parcel_id') as string) || null,
    numero: (formData.get('numero') as string).trim(),
    ancien_numero: (formData.get('ancien_numero') as string)?.trim() || null,
    longueur_m: formData.get('longueur_m')
      ? parseFloat(formData.get('longueur_m') as string)
      : null,
    position_ordre: formData.get('position_ordre')
      ? parseInt(formData.get('position_ordre') as string, 10)
      : null,
    notes: (formData.get('notes') as string)?.trim() || null,
  }
}

export async function createRow(formData: FormData): Promise<ActionResult<RowWithParcel>> {
  const supabase = await createClient()
  const fields = parseRowForm(formData)

  if (!fields.numero) return { error: 'Le numéro de rang est obligatoire.' }
  if (!fields.parcel_id) return { error: 'La parcelle est obligatoire.' }

  const { data, error } = await supabase
    .from('rows')
    .insert(fields)
    .select('*, parcels(id, nom, code, sites(id, nom))')
    .single()

  if (error) {
    if (error.code === '23505') return { error: 'Ce numéro de rang existe déjà dans cette parcelle.' }
    return { error: `Erreur : ${error.message}` }
  }

  revalidatePath(REVALIDATE)
  return { success: true, data: data as RowWithParcel }
}

export async function updateRow(id: string, formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()
  const fields = parseRowForm(formData)

  if (!fields.numero) return { error: 'Le numéro de rang est obligatoire.' }
  if (!fields.parcel_id) return { error: 'La parcelle est obligatoire.' }

  const { error } = await supabase
    .from('rows')
    .update(fields)
    .eq('id', id)

  if (error) {
    if (error.code === '23505') return { error: 'Ce numéro de rang existe déjà dans cette parcelle.' }
    return { error: `Erreur : ${error.message}` }
  }

  revalidatePath(REVALIDATE)
  return { success: true }
}

export async function archiveRow(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('rows')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { error: `Erreur lors de l'archivage : ${error.message}` }
  revalidatePath(REVALIDATE)
  return { success: true }
}

export async function restoreRow(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('rows')
    .update({ deleted_at: null })
    .eq('id', id)

  if (error) return { error: `Erreur lors de la restauration : ${error.message}` }
  revalidatePath(REVALIDATE)
  return { success: true }
}
