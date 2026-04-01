/**
 * Schémas de validation Zod pour le module Parcelles.
 * Couvre les 6 tables : soil_works, plantings, row_care, harvests, uprootings, occultations.
 * Utilisés dans les Server Actions et côté client (formulaires).
 */

import { z } from 'zod'
import { PARTIES_PLANTE } from '@/lib/types'

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

/** Date optionnelle pas dans le futur */
const optionalDateNotInFuture = z
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
  .nullable()

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

// ---- Schéma travail de sol ----

export const soilWorkSchema = z.object({
  row_id: z.string().uuid('Rang invalide'),
  date: dateNotInFuture,
  type_travail: z.enum(['depaillage', 'motoculteur', 'amendement', 'autre']),
  detail: z.string().max(500).optional().nullable(),
  temps_min: positiveInt.optional().nullable(),
  commentaire: z.string().max(1000).optional().nullable(),
})

export type SoilWorkFormData = z.infer<typeof soilWorkSchema>

// ---- Schéma plantation ----

export const plantingSchema = z
  .object({
    row_id: z.string().uuid('Rang invalide'),
    variety_id: z.string().uuid('Variété invalide'),
    annee: z.number().int('Doit être un entier').min(2000).max(2100),
    date_plantation: dateNotInFuture,
    nb_plants: positiveInt.optional().nullable(),
    type_plant: z.enum([
      'godet',
      'caissette',
      'mini_motte',
      'plant_achete',
      'division',
      'bouture',
      'marcottage',
      'stolon',
      'rhizome',
      'semis_direct',
    ]),
    seedling_id: z.string().uuid('Semis invalide').optional().nullable(),
    bouture_id: z.string().uuid('Bouture invalide').optional().nullable(),
    fournisseur: z.string().max(200).optional().nullable(),
    lune: z.enum(['montante', 'descendante']).optional().nullable(),
    espacement_cm: positiveInt.optional().nullable(),
    certif_ab: z.boolean().default(false),
    longueur_m: positiveDecimal.optional().nullable(),
    largeur_m: positiveDecimal.optional().nullable(),
    temps_min: positiveInt.optional().nullable(),
    commentaire: z.string().max(1000).optional().nullable(),
  })
  .superRefine((data, ctx) => {
    // Validation conditionnelle : seedling_id, bouture_id et fournisseur sont mutuellement exclusifs
    const sources = [data.seedling_id, data.bouture_id, data.fournisseur].filter(Boolean)
    if (sources.length > 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['seedling_id'],
        message: 'Une seule source possible : semis, bouture ou fournisseur',
      })
    }
  })

export type PlantingFormData = z.infer<typeof plantingSchema>

// ---- Schéma plantation mobile (sans seedling_id, fournisseur, date_commande, numero_facture) ----

export const mobilePlantingSchema = z.object({
  row_id: z.string().uuid('Rang invalide'),
  variety_id: z.string().uuid('Variété invalide'),
  annee: z.number().int('Doit être un entier').min(2000).max(2100),
  date_plantation: dateNotInFuture,
  lune: z.enum(['montante', 'descendante']).optional().nullable(),
  nb_plants: positiveInt.optional().nullable(),
  type_plant: z.enum([
    'godet',
    'caissette',
    'mini_motte',
    'plant_achete',
    'division',
    'bouture',
    'marcottage',
    'stolon',
    'rhizome',
    'semis_direct',
  ]),
  espacement_cm: positiveInt.optional().nullable(),
  longueur_m: positiveDecimal.optional().nullable(),
  largeur_m: positiveDecimal.optional().nullable(),
  certif_ab: z.boolean().default(false),
  temps_min: positiveInt.optional().nullable(),
  commentaire: z.string().max(1000).optional().nullable(),
})

export type MobilePlantingFormData = z.infer<typeof mobilePlantingSchema>

// ---- Schéma suivi de rang ----

export const rowCareSchema = z.object({
  row_id: z.string().uuid('Rang invalide'),
  variety_id: z.string().uuid('Variété invalide').nullable().optional(),
  date: dateNotInFuture,
  type_soin: z.enum(['desherbage', 'paillage', 'arrosage', 'autre']),
  temps_min: positiveInt.optional().nullable(),
  commentaire: z.string().max(1000).optional().nullable(),
})

export type RowCareFormData = z.infer<typeof rowCareSchema>

// ---- Schéma cueillette ----

export const harvestSchema = z
  .object({
    type_cueillette: z.enum(['parcelle', 'sauvage']),
    variety_id: z.string().uuid('Variété invalide'),
    partie_plante: z.enum(PARTIES_PLANTE as [string, ...string[]]).refine(
      (v) => PARTIES_PLANTE.includes(v as never),
      { message: 'Partie de plante invalide' },
    ),
    date: dateNotInFuture,
    poids_g: positiveDecimal,
    row_id: z.string().uuid('Rang invalide').optional().nullable(),
    lieu_sauvage: z.string().max(500).optional().nullable(),
    temps_min: positiveInt.optional().nullable(),
    commentaire: z.string().max(1000).optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.type_cueillette === 'parcelle') {
      // row_id obligatoire, lieu_sauvage doit être null
      if (!data.row_id) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['row_id'],
          message: 'Le rang est obligatoire pour une cueillette en parcelle',
        })
      }
      if (data.lieu_sauvage) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['lieu_sauvage'],
          message: 'Le lieu sauvage ne peut pas être renseigné pour une cueillette en parcelle',
        })
      }
    } else if (data.type_cueillette === 'sauvage') {
      // lieu_sauvage obligatoire, row_id doit être null
      if (!data.lieu_sauvage) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['lieu_sauvage'],
          message: 'Le lieu sauvage est obligatoire pour une cueillette sauvage',
        })
      }
      if (data.row_id) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['row_id'],
          message: 'Le rang ne peut pas être renseigné pour une cueillette sauvage',
        })
      }
    }
  })

export type HarvestFormData = z.infer<typeof harvestSchema>

// ---- Schéma arrachage ----

export const uprootingSchema = z.object({
  row_id: z.string().uuid('Rang invalide'),
  date: dateNotInFuture,
  variety_id: z.string().uuid('Variété invalide').optional().nullable(),
  temps_min: positiveInt.optional().nullable(),
  commentaire: z.string().max(1000).optional().nullable(),
})

export type UprootingFormData = z.infer<typeof uprootingSchema>

// ---- Schéma occultation ----

export const occultationSchema = z
  .object({
    row_id: z.string().uuid('Rang invalide'),
    date_debut: dateNotInFuture,
    date_fin: optionalDateNotInFuture,
    methode: z.enum(['paille', 'foin', 'bache', 'engrais_vert']),
    // Paille / Foin
    fournisseur: z.string().max(200).optional().nullable(),
    attestation: z.string().max(500).optional().nullable(),
    // Engrais vert
    engrais_vert_nom: z.string().max(200).optional().nullable(),
    engrais_vert_fournisseur: z.string().max(200).optional().nullable(),
    engrais_vert_facture: z.string().max(100).optional().nullable(),
    engrais_vert_certif_ab: z.boolean().default(false),
    // Bâche
    temps_retrait_min: positiveInt.optional().nullable(),
    // Commun
    temps_min: positiveInt.optional().nullable(),
    commentaire: z.string().max(1000).optional().nullable(),
  })
  .superRefine((data, ctx) => {
    // Validation que date_fin >= date_debut si les deux sont renseignées
    if (data.date_fin && data.date_debut) {
      if (new Date(data.date_fin) < new Date(data.date_debut)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['date_fin'],
          message: 'La date de fin doit être >= à la date de début',
        })
      }
    }

    // Validations conditionnelles par méthode
    if (data.methode === 'paille') {
      if (!data.fournisseur) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['fournisseur'],
          message: 'Le fournisseur est obligatoire pour la méthode paille',
        })
      }
    }

    if (data.methode === 'foin') {
      if (!data.fournisseur) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['fournisseur'],
          message: 'Le fournisseur est obligatoire pour la méthode foin',
        })
      }
    }

    if (data.methode === 'engrais_vert') {
      if (!data.engrais_vert_nom) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['engrais_vert_nom'],
          message: 'Le nom de l\'engrais vert est obligatoire',
        })
      }
      if (!data.engrais_vert_fournisseur) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['engrais_vert_fournisseur'],
          message: 'Le fournisseur de l\'engrais vert est obligatoire',
        })
      }
    }
  })

export type OccultationFormData = z.infer<typeof occultationSchema>
