/**
 * Helpers de parsing pour le formulaire inventaire stock graines.
 * Fonctions pures extraites des Server Actions pour etre testables.
 */

import { z } from 'zod'
import { seedAdjustmentSchema } from '@/lib/validation/seed-stock'

function formatError(zodError: z.ZodError): string {
  const first = zodError.issues[0]
  const field = first.path.length > 0 ? `${String(first.path[0])} : ` : ''
  return `${field}${first.message}`
}

export function parseSeedAdjustmentForm(
  formData: FormData,
): { data: ReturnType<typeof seedAdjustmentSchema.parse> } | { error: string } {
  const poidsRaw = formData.get('poids_constate_g') as string
  const poids = poidsRaw && poidsRaw.trim() !== '' ? parseFloat(poidsRaw) : NaN

  const raw = {
    seed_lot_id: (formData.get('seed_lot_id') as string) || '',
    date: (formData.get('date') as string) || '',
    poids_constate_g: isNaN(poids) ? -1 : poids,
    commentaire: (formData.get('commentaire') as string)?.trim() || null,
  }

  const result = seedAdjustmentSchema.safeParse(raw)
  if (!result.success) return { error: formatError(result.error) }

  return { data: result.data }
}
