/**
 * Schémas de validation Zod pour le module Boutures.
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

// ---- Schéma bouture ----

const cuttingBaseFields = {
  variety_id: z.string().uuid('Variété invalide'),
  type_multiplication: z.enum([
    'rhizome', 'bouture', 'marcotte', 'eclat_pied', 'drageon', 'eclat_racine',
  ] as const),
  origine: z.string().max(200).optional().nullable(),
  certif_ab: z.boolean().default(false),
  date_bouturage: dateNotInFuture,

  // Plaque alvéolée (optionnel)
  nb_plaques: positiveInt.optional().nullable(),
  nb_trous_par_plaque: positiveInt.optional().nullable(),
  nb_mortes_plaque: nonNegativeInt.default(0).optional().nullable(),
  date_mise_en_plaque: z
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
  temps_bouturage_min: positiveInt.optional().nullable(),

  // Godet
  nb_godets: nonNegativeInt.optional().nullable(),
  nb_mortes_godet: nonNegativeInt.default(0).optional().nullable(),
  date_rempotage: z
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
  temps_rempotage_min: positiveInt.optional().nullable(),

  // Résultat
  nb_plants_obtenus: nonNegativeInt.optional().nullable(),
  nb_donnees: nonNegativeInt.default(0),
  commentaire: z.string().max(1000).optional().nullable(),
}

export const cuttingSchema = z
  .object(cuttingBaseFields)
  .superRefine((data, ctx) => {
    // Si nb_plaques renseigné, nb_trous_par_plaque obligatoire
    if (data.nb_plaques != null && data.nb_trous_par_plaque == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['nb_trous_par_plaque'],
        message: 'Nombre de trous par plaque obligatoire quand des plaques sont renseignées',
      })
    }
    // Si nb_trous_par_plaque renseigné, nb_plaques obligatoire
    if (data.nb_trous_par_plaque != null && data.nb_plaques == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['nb_plaques'],
        message: 'Nombre de plaques obligatoire quand le nombre de trous est renseigné',
      })
    }
  })

export type CuttingFormData = z.infer<typeof cuttingSchema>
