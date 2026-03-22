/**
 * Schema de validation Zod pour le module Stock graines.
 * L'utilisateur saisit uniquement le poids constate (inventaire).
 */

import { z } from 'zod'

const dateNotInFuture = z.string().refine(
  (val) => {
    if (!val) return true
    const inputDate = new Date(val)
    const today = new Date()
    today.setHours(23, 59, 59, 999)
    return inputDate <= today
  },
  { message: 'La date ne peut pas être dans le futur' },
)

export const seedAdjustmentSchema = z.object({
  seed_lot_id: z.string().uuid('Sachet invalide'),
  date: dateNotInFuture,
  poids_constate_g: z
    .number({ error: 'Doit être un nombre' })
    .nonnegative('Doit être positif ou nul')
    .refine((v) => Math.round(v * 100) / 100 === v, {
      message: 'Maximum 2 décimales',
    }),
  commentaire: z.string().max(1000).optional().nullable(),
})
