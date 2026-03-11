/**
 * Schéma de validation Zod pour le module Prévisionnel (forecasts).
 */

import { z } from 'zod'

const ETATS_PLANTE = [
  'frais', 'tronconnee', 'sechee',
  'tronconnee_sechee', 'sechee_triee', 'tronconnee_sechee_triee',
] as const

const PARTIES_PLANTE = [
  'feuille', 'fleur', 'graine', 'racine', 'fruit', 'plante_entiere',
] as const

export const forecastSchema = z.object({
  variety_id: z.string().uuid('Variété invalide'),
  annee: z.number().int('L\'année doit être un entier').min(2020, 'Année minimum : 2020').max(2100, 'Année maximum : 2100'),
  quantite_prevue_g: z.number().min(0, 'La quantité doit être positive ou nulle'),
  etat_plante: z.enum(ETATS_PLANTE).nullable().optional(),
  partie_plante: z.enum(PARTIES_PLANTE).nullable().optional(),
  commentaire: z.string().max(1000, 'Maximum 1000 caractères').nullable().optional(),
})

export type ForecastInput = z.infer<typeof forecastSchema>
