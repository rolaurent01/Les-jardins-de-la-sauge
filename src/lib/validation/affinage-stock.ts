/**
 * Schémas de validation Zod pour le module Affinage du stock.
 * Couvre les 3 tables : stock_purchases, stock_direct_sales, stock_adjustments.
 */

import { z } from 'zod'
import { PARTIES_PLANTE } from '@/lib/types'

// ---- Helpers (identiques à transformation.ts) ----

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

// Tous les états plante sont valides pour achats/ventes/ajustements
const ETATS_PLANTE = [
  'frais', 'tronconnee', 'sechee',
  'tronconnee_sechee', 'sechee_triee', 'tronconnee_sechee_triee',
] as const

// ---- Achat externe ----

export const purchaseSchema = z.object({
  variety_id: z.string().uuid('Variété invalide'),
  partie_plante: z.enum(PARTIES_PLANTE as [string, ...string[]]),
  date: dateNotInFuture,
  etat_plante: z.enum(ETATS_PLANTE),
  poids_g: positiveDecimal,
  fournisseur: z.string().min(1, 'Fournisseur requis'),
  numero_lot_fournisseur: z.string().optional().nullable(),
  certif_ab: z.boolean().default(false),
  prix: z.number().nonnegative('Le prix doit être positif ou nul').optional().nullable(),
  commentaire: z.string().max(1000).optional().nullable(),
})

// ---- Vente directe ----

export const directSaleSchema = z.object({
  variety_id: z.string().uuid('Variété invalide'),
  partie_plante: z.enum(PARTIES_PLANTE as [string, ...string[]]),
  date: dateNotInFuture,
  etat_plante: z.enum(ETATS_PLANTE),
  poids_g: positiveDecimal,
  destinataire: z.string().optional().nullable(),
  commentaire: z.string().max(1000).optional().nullable(),
})

// ---- Ajustement manuel ----

export const adjustmentSchema = z.object({
  variety_id: z.string().uuid('Variété invalide'),
  partie_plante: z.enum(PARTIES_PLANTE as [string, ...string[]]),
  date: dateNotInFuture,
  type_mouvement: z.enum(['entree', 'sortie']),
  etat_plante: z.enum(ETATS_PLANTE),
  poids_g: positiveDecimal,
  motif: z.string().min(1, 'Motif requis').max(500),
  commentaire: z.string().max(1000).optional().nullable(),
})
