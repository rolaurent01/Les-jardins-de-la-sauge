/**
 * Schémas de validation Zod pour le module Transformation.
 * Couvre les 3 tables : cuttings, dryings, sortings.
 */

import { z } from 'zod'
import { PARTIES_PLANTE } from '@/lib/types'

// ---- Helpers (identiques à parcelles.ts) ----

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

const positiveDecimal = z
  .number({ error: 'Doit être un nombre' })
  .positive('Doit être supérieur à 0')
  .refine((v) => Math.round(v * 100) / 100 === v, {
    message: 'Maximum 2 décimales',
  })

const positiveInt = z
  .number({ error: 'Doit être un entier' })
  .int('Doit être un entier')
  .positive('Doit être supérieur à 0')

// ---- Tronçonnage ----

export const cuttingSchema = z.object({
  variety_id: z.string().uuid('Variété invalide'),
  partie_plante: z.enum(PARTIES_PLANTE as [string, ...string[]]),
  type: z.enum(['entree', 'sortie']),
  date: dateNotInFuture,
  poids_g: positiveDecimal,
  temps_min: positiveInt.optional().nullable(),
  commentaire: z.string().max(1000).optional().nullable(),
})

// ---- Séchage ----

export const dryingSchema = z
  .object({
    variety_id: z.string().uuid('Variété invalide'),
    partie_plante: z.enum(PARTIES_PLANTE as [string, ...string[]]),
    type: z.enum(['entree', 'sortie']),
    etat_plante: z.string().min(1, 'État plante requis'),
    date: dateNotInFuture,
    poids_g: positiveDecimal,
    temps_min: positiveInt.optional().nullable(),
    commentaire: z.string().max(1000).optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.type === 'entree' && !['frais', 'tronconnee'].includes(data.etat_plante)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['etat_plante'],
        message: 'État plante invalide pour séchage entrée (frais ou tronconnee)',
      })
    }
    if (data.type === 'sortie' && !['sechee', 'tronconnee_sechee'].includes(data.etat_plante)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['etat_plante'],
        message: 'État plante invalide pour séchage sortie (sechee ou tronconnee_sechee)',
      })
    }
  })

// ---- Triage ----

export const sortingSchema = z
  .object({
    variety_id: z.string().uuid('Variété invalide'),
    partie_plante: z.enum(PARTIES_PLANTE as [string, ...string[]]),
    type: z.enum(['entree', 'sortie']),
    etat_plante: z.string().min(1, 'État plante requis'),
    date: dateNotInFuture,
    poids_g: positiveDecimal,
    temps_min: positiveInt.optional().nullable(),
    commentaire: z.string().max(1000).optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.type === 'entree' && !['sechee', 'tronconnee_sechee'].includes(data.etat_plante)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['etat_plante'],
        message: 'État plante invalide pour triage entrée (sechee ou tronconnee_sechee)',
      })
    }
    if (data.type === 'sortie' && !['sechee_triee', 'tronconnee_sechee_triee'].includes(data.etat_plante)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['etat_plante'],
        message: 'État plante invalide pour triage sortie (sechee_triee ou tronconnee_sechee_triee)',
      })
    }
  })
