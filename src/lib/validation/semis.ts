/**
 * Schémas de validation Zod pour le module Semis.
 * Utilisés dans les Server Actions et côté client (formulaires).
 */

import { z } from 'zod'

// ---- Helpers ----

/** Vérifie qu'une date ISO (YYYY-MM-DD) n'est pas dans le futur */
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

/** Décimal positif avec 2 décimales maximum */
const positiveDecimal = z
  .number({ error: 'Doit être un nombre' })
  .positive('Doit être supérieur à 0')
  .refine((v) => Math.round(v * 100) / 100 === v, {
    message: 'Maximum 2 décimales',
  })

/** Entier positif strict */
const positiveInt = z
  .number({ error: 'Doit être un entier' })
  .int('Doit être un entier')
  .positive('Doit être supérieur à 0')

/** Entier >= 0 */
const nonNegativeInt = z
  .number({ error: 'Doit être un entier' })
  .int('Doit être un entier')
  .min(0, 'Doit être >= 0')

// ---- Schéma sachet de graines ----

export const seedLotSchema = z.object({
  variety_id: z.string().uuid('Variété invalide'),
  fournisseur: z.string().max(200).optional().nullable(),
  numero_lot_fournisseur: z.string().max(100).optional().nullable(),
  date_achat: dateNotInFuture,
  date_facture: z
    .string()
    .refine(
      (val) => {
        if (!val) return true
        const inputDate = new Date(val)
        const today = new Date()
        today.setHours(23, 59, 59, 999)
        return inputDate <= today
      },
      { message: 'La date ne peut pas être dans le futur' },
    )
    .optional()
    .nullable(),
  numero_facture: z.string().max(100).optional().nullable(),
  poids_sachet_g: positiveDecimal.optional().nullable(),
  certif_ab: z.boolean().default(false),
  commentaire: z.string().max(1000).optional().nullable(),
})

export type SeedLotFormData = z.infer<typeof seedLotSchema>

// ---- Schéma semis ----

/** Champs communs aux deux processus */
const seedlingBaseFields = {
  processus: z.enum(['caissette_godet', 'mini_motte'] as const),
  variety_id: z.string().uuid('Variété invalide'),
  seed_lot_id: z.string().uuid('Sachet invalide').optional().nullable(),
  date_semis: dateNotInFuture,
  nb_donnees: nonNegativeInt.default(0),
  nb_plants_obtenus: nonNegativeInt.optional().nullable(),
  date_levee: z
    .string()
    .refine(
      (val) => {
        if (!val) return true
        const inputDate = new Date(val)
        const today = new Date()
        today.setHours(23, 59, 59, 999)
        return inputDate <= today
      },
      { message: 'La date ne peut pas être dans le futur' },
    )
    .optional()
    .nullable(),
  date_repiquage: z
    .string()
    .refine(
      (val) => {
        if (!val) return true
        const inputDate = new Date(val)
        const today = new Date()
        today.setHours(23, 59, 59, 999)
        return inputDate <= today
      },
      { message: 'La date ne peut pas être dans le futur' },
    )
    .optional()
    .nullable(),
  temps_semis_min: positiveInt.optional().nullable(),
  temps_repiquage_min: positiveInt.optional().nullable(),
  poids_graines_utilise_g: positiveDecimal.optional().nullable(),
  commentaire: z.string().max(1000).optional().nullable(),
  // Champs mini-motte (présents dans l'objet, validés conditionnellement)
  numero_caisse: z.string().max(50).optional().nullable(),
  nb_mottes: positiveInt.optional().nullable(),
  nb_mortes_mottes: nonNegativeInt.default(0).optional().nullable(),
  // Champs caissette/godet (présents dans l'objet, validés conditionnellement)
  nb_caissettes: positiveInt.optional().nullable(),
  nb_plants_caissette: positiveInt.optional().nullable(),
  nb_mortes_caissette: nonNegativeInt.default(0).optional().nullable(),
  nb_godets: nonNegativeInt.optional().nullable(),
  nb_mortes_godet: nonNegativeInt.default(0).optional().nullable(),
}

export const seedlingSchema = z
  .object(seedlingBaseFields)
  .superRefine((data, ctx) => {
    if (data.processus === 'mini_motte') {
      // nb_mottes obligatoire et > 0
      if (data.nb_mottes == null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['nb_mottes'],
          message: 'Nombre de mottes obligatoire pour le processus mini-motte',
        })
      }
    } else if (data.processus === 'caissette_godet') {
      // nb_caissettes obligatoire et > 0
      if (data.nb_caissettes == null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['nb_caissettes'],
          message: 'Nombre de caissettes obligatoire pour ce processus',
        })
      }
      // nb_plants_caissette obligatoire et > 0
      if (data.nb_plants_caissette == null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['nb_plants_caissette'],
          message: 'Nombre de plants en caissette obligatoire pour ce processus',
        })
      }
    }
  })

export type SeedlingFormData = z.infer<typeof seedlingSchema>
