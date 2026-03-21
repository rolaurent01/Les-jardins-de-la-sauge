/**
 * Helpers de parsing pour les formulaires du module Transformation.
 * Fonctions pures extraites des Server Actions pour être testables sans dépendances serveur.
 */

import { z } from 'zod'
import {
  cuttingSchema, dryingSchema, sortingSchema,
  cuttingCombinedSchema, sortingCombinedSchema,
} from '@/lib/validation/transformation'

// ---- Helpers ----

function parseOptionalInt(formData: FormData, key: string): number | null {
  const v = formData.get(key) as string
  if (!v || v.trim() === '') return null
  const n = parseInt(v, 10)
  return isNaN(n) ? null : n
}

function parseOptionalDecimal(formData: FormData, key: string): number | null {
  const v = formData.get(key) as string
  if (!v || v.trim() === '') return null
  const n = parseFloat(v)
  return isNaN(n) ? null : n
}

function formatError(zodError: z.ZodError): string {
  const first = zodError.issues[0]
  const field = first.path.length > 0 ? `${String(first.path[0])} : ` : ''
  return `${field}${first.message}`
}

// ---- Tronçonnage ----

export function parseCuttingForm(
  formData: FormData,
): { data: ReturnType<typeof cuttingSchema.parse> } | { error: string } {
  const raw = {
    variety_id:    (formData.get('variety_id') as string) || '',
    partie_plante: (formData.get('partie_plante') as string) || '',
    type:          (formData.get('type') as string) || '',
    date:          (formData.get('date') as string) || '',
    poids_g:       parseOptionalDecimal(formData, 'poids_g') ?? 0,
    temps_min:     parseOptionalInt(formData, 'temps_min'),
    commentaire:   (formData.get('commentaire') as string)?.trim() || null,
  }

  const result = cuttingSchema.safeParse(raw)
  if (!result.success) return { error: formatError(result.error) }

  return { data: result.data }
}

// ---- Séchage ----

export function parseDryingForm(
  formData: FormData,
): { data: ReturnType<typeof dryingSchema.parse> } | { error: string } {
  const raw = {
    variety_id:    (formData.get('variety_id') as string) || '',
    partie_plante: (formData.get('partie_plante') as string) || '',
    type:          (formData.get('type') as string) || '',
    etat_plante:   (formData.get('etat_plante') as string) || '',
    date:          (formData.get('date') as string) || '',
    poids_g:       parseOptionalDecimal(formData, 'poids_g') ?? 0,
    temps_min:     parseOptionalInt(formData, 'temps_min'),
    commentaire:   (formData.get('commentaire') as string)?.trim() || null,
  }

  const result = dryingSchema.safeParse(raw)
  if (!result.success) return { error: formatError(result.error) }

  return { data: result.data }
}

// ---- Triage ----

export function parseSortingForm(
  formData: FormData,
): { data: ReturnType<typeof sortingSchema.parse> } | { error: string } {
  const raw = {
    variety_id:    (formData.get('variety_id') as string) || '',
    partie_plante: (formData.get('partie_plante') as string) || '',
    type:          (formData.get('type') as string) || '',
    etat_plante:   (formData.get('etat_plante') as string) || '',
    date:          (formData.get('date') as string) || '',
    poids_g:       parseOptionalDecimal(formData, 'poids_g') ?? 0,
    temps_min:     parseOptionalInt(formData, 'temps_min'),
    commentaire:   (formData.get('commentaire') as string)?.trim() || null,
  }

  const result = sortingSchema.safeParse(raw)
  if (!result.success) return { error: formatError(result.error) }

  return { data: result.data }
}

// ---- Tronçonnage combiné ----

export function parseCuttingCombinedForm(
  formData: FormData,
): { data: ReturnType<typeof cuttingCombinedSchema.parse> } | { error: string } {
  const raw = {
    variety_id:     (formData.get('variety_id') as string) || '',
    partie_plante:  (formData.get('partie_plante') as string) || '',
    date:           (formData.get('date') as string) || '',
    poids_entree_g: parseOptionalDecimal(formData, 'poids_entree_g') ?? 0,
    poids_sortie_g: parseOptionalDecimal(formData, 'poids_sortie_g') ?? 0,
    temps_min:      parseOptionalInt(formData, 'temps_min'),
    commentaire:    (formData.get('commentaire') as string)?.trim() || null,
  }

  const result = cuttingCombinedSchema.safeParse(raw)
  if (!result.success) return { error: formatError(result.error) }

  return { data: result.data }
}

// ---- Triage combiné ----

export function parseSortingCombinedForm(
  formData: FormData,
): { data: ReturnType<typeof sortingCombinedSchema.parse> } | { error: string } {
  const raw = {
    variety_id:     (formData.get('variety_id') as string) || '',
    partie_plante:  (formData.get('partie_plante') as string) || '',
    etat_plante:    (formData.get('etat_plante') as string) || '',
    date:           (formData.get('date') as string) || '',
    poids_entree_g: parseOptionalDecimal(formData, 'poids_entree_g') ?? 0,
    poids_sortie_g: parseOptionalDecimal(formData, 'poids_sortie_g') ?? 0,
    temps_min:      parseOptionalInt(formData, 'temps_min'),
    commentaire:    (formData.get('commentaire') as string)?.trim() || null,
  }

  const result = sortingCombinedSchema.safeParse(raw)
  if (!result.success) return { error: formatError(result.error) }

  return { data: result.data }
}
