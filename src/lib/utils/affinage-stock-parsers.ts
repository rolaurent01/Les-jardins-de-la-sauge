/**
 * Helpers de parsing pour les formulaires du module Affinage du stock.
 * Fonctions pures extraites des Server Actions pour être testables sans dépendances serveur.
 */

import { z } from 'zod'
import { purchaseSchema, directSaleSchema, adjustmentSchema } from '@/lib/validation/affinage-stock'

// ---- Helpers ----

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

// ---- Achat externe ----

export function parsePurchaseForm(
  formData: FormData,
): { data: ReturnType<typeof purchaseSchema.parse> } | { error: string } {
  const certifRaw = formData.get('certif_ab') as string
  const raw = {
    variety_id:             (formData.get('variety_id') as string) || '',
    partie_plante:          (formData.get('partie_plante') as string) || '',
    date:                   (formData.get('date') as string) || '',
    etat_plante:            (formData.get('etat_plante') as string) || '',
    poids_g:                parseOptionalDecimal(formData, 'poids_g') ?? 0,
    fournisseur:            (formData.get('fournisseur') as string)?.trim() || '',
    numero_lot_fournisseur: (formData.get('numero_lot_fournisseur') as string)?.trim() || null,
    certif_ab:              certifRaw === 'true' || certifRaw === 'on' || certifRaw === '1',
    prix:                   parseOptionalDecimal(formData, 'prix'),
    commentaire:            (formData.get('commentaire') as string)?.trim() || null,
  }

  const result = purchaseSchema.safeParse(raw)
  if (!result.success) return { error: formatError(result.error) }

  return { data: result.data }
}

// ---- Vente directe ----

export function parseDirectSaleForm(
  formData: FormData,
): { data: ReturnType<typeof directSaleSchema.parse> } | { error: string } {
  const raw = {
    variety_id:    (formData.get('variety_id') as string) || '',
    partie_plante: (formData.get('partie_plante') as string) || '',
    date:          (formData.get('date') as string) || '',
    etat_plante:   (formData.get('etat_plante') as string) || '',
    poids_g:       parseOptionalDecimal(formData, 'poids_g') ?? 0,
    destinataire:  (formData.get('destinataire') as string)?.trim() || null,
    commentaire:   (formData.get('commentaire') as string)?.trim() || null,
  }

  const result = directSaleSchema.safeParse(raw)
  if (!result.success) return { error: formatError(result.error) }

  return { data: result.data }
}

// ---- Ajustement manuel ----

export function parseAdjustmentForm(
  formData: FormData,
): { data: ReturnType<typeof adjustmentSchema.parse> } | { error: string } {
  const raw = {
    variety_id:     (formData.get('variety_id') as string) || '',
    partie_plante:  (formData.get('partie_plante') as string) || '',
    date:           (formData.get('date') as string) || '',
    type_mouvement: (formData.get('type_mouvement') as string) || '',
    etat_plante:    (formData.get('etat_plante') as string) || '',
    poids_g:        parseOptionalDecimal(formData, 'poids_g') ?? 0,
    motif:          (formData.get('motif') as string)?.trim() || '',
    commentaire:    (formData.get('commentaire') as string)?.trim() || null,
  }

  const result = adjustmentSchema.safeParse(raw)
  if (!result.success) return { error: formatError(result.error) }

  return { data: result.data }
}
