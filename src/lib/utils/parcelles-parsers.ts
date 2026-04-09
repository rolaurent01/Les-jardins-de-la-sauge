/**
 * Helpers de parsing pour les formulaires du module Parcelles.
 * Fonctions pures extraites des Server Actions pour être testables sans dépendances serveur.
 */

import { soilWorkSchema, plantingSchema, rowCareSchema, harvestSchema, uprootingSchema, occultationSchema } from '@/lib/validation/parcelles'

// ---- Helpers partagés ----

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

/** Parse `'on'` / `'true'` / `'1'` en boolean */
function parseBool(formData: FormData, key: string): boolean {
  const v = formData.get(key) as string | null
  return v === 'on' || v === 'true' || v === '1'
}

// ---- Travail de sol ----

/** Extrait et valide les champs du formulaire travail de sol avec Zod */
export function parseSoilWorkForm(
  formData: FormData,
): { data: ReturnType<typeof soilWorkSchema.parse> } | { error: string } {
  const raw = {
    row_id:       (formData.get('row_id') as string) || '',
    date:         (formData.get('date') as string) || '',
    type_travail: (formData.get('type_travail') as string) || '',
    detail:       (formData.get('detail') as string)?.trim() || null,
    temps_min:    parseOptionalInt(formData, 'temps_min'),
    commentaire:  (formData.get('commentaire') as string)?.trim() || null,
  }

  const result = soilWorkSchema.safeParse(raw)
  if (!result.success) {
    const first = result.error.issues[0]
    const field = first.path.length > 0 ? `${String(first.path[0])} : ` : ''
    return { error: `${field}${first.message}` }
  }

  return { data: result.data }
}

// ---- Plantation ----

/** Type de retour enrichi du parser plantation (champs Zod + champs hors schéma) */
export type PlantingInsertData = ReturnType<typeof plantingSchema.parse> & {
  date_commande: string | null
  numero_facture: string | null
}

/**
 * Extrait et valide les champs du formulaire plantation avec Zod.
 * Les champs date_commande et numero_facture sont ajoutés en dehors du schéma Zod.
 */
export function parsePlantingForm(
  formData: FormData,
): { data: PlantingInsertData } | { error: string } {
  const raw = {
    row_id:        (formData.get('row_id') as string) || '',
    variety_id:    (formData.get('variety_id') as string) || '',
    seedling_id:   (formData.get('seedling_id') as string)?.trim() || null,
    bouture_id:    (formData.get('bouture_id') as string)?.trim() || null,
    seed_lot_id:   (formData.get('seed_lot_id') as string)?.trim() || null,
    fournisseur:   (formData.get('fournisseur') as string)?.trim() || null,
    annee:         parseOptionalInt(formData, 'annee') ?? 0,
    date_plantation: (formData.get('date_plantation') as string) || '',
    lune:          (formData.get('lune') as string)?.trim() || null,
    nb_plants:     parseOptionalInt(formData, 'nb_plants'),
    type_plant:    (formData.get('type_plant') as string) || '',
    espacement_cm: parseOptionalInt(formData, 'espacement_cm'),
    certif_ab:     parseBool(formData, 'certif_ab'),
    longueur_m:    parseOptionalDecimal(formData, 'longueur_m'),
    largeur_m:     parseOptionalDecimal(formData, 'largeur_m'),
    temps_min:     parseOptionalInt(formData, 'temps_min'),
    commentaire:   (formData.get('commentaire') as string)?.trim() || null,
  }

  const result = plantingSchema.safeParse(raw)
  if (!result.success) {
    const first = result.error.issues[0]
    const field = first.path.length > 0 ? `${String(first.path[0])} : ` : ''
    return { error: `${field}${first.message}` }
  }

  // Champs non couverts par le schéma Zod (intégrité simple, pas de règle métier complexe)
  const date_commande = (formData.get('date_commande') as string)?.trim() || null
  const numero_facture = (formData.get('numero_facture') as string)?.trim() || null

  return {
    data: {
      ...result.data,
      date_commande,
      numero_facture,
    },
  }
}

// ---- Suivi de rang ----

/** Extrait et valide les champs du formulaire suivi de rang avec Zod */
export function parseRowCareForm(
  formData: FormData,
): { data: ReturnType<typeof rowCareSchema.parse> } | { error: string } {
  const raw = {
    row_id:      (formData.get('row_id') as string) || '',
    variety_id:  (formData.get('variety_id') as string)?.trim() || null,
    date:        (formData.get('date') as string) || '',
    type_soin:   (formData.get('type_soin') as string) || '',
    temps_min:   parseOptionalInt(formData, 'temps_min'),
    commentaire: (formData.get('commentaire') as string)?.trim() || null,
  }

  const result = rowCareSchema.safeParse(raw)
  if (!result.success) {
    const first = result.error.issues[0]
    const field = first.path.length > 0 ? `${String(first.path[0])} : ` : ''
    return { error: `${field}${first.message}` }
  }

  return { data: result.data }
}

// ---- Cueillette ----

/** Extrait et valide les champs du formulaire cueillette avec Zod */
export function parseHarvestForm(
  formData: FormData,
): { data: ReturnType<typeof harvestSchema.parse> } | { error: string } {
  const raw = {
    type_cueillette: (formData.get('type_cueillette') as string) || '',
    variety_id:      (formData.get('variety_id') as string) || '',
    partie_plante:   (formData.get('partie_plante') as string) || '',
    date:            (formData.get('date') as string) || '',
    poids_g:         parseOptionalDecimal(formData, 'poids_g') ?? 0,
    row_id:          (formData.get('row_id') as string)?.trim() || null,
    lieu_sauvage:    (formData.get('lieu_sauvage') as string)?.trim() || null,
    temps_min:       parseOptionalInt(formData, 'temps_min'),
    commentaire:     (formData.get('commentaire') as string)?.trim() || null,
  }

  const result = harvestSchema.safeParse(raw)
  if (!result.success) {
    const first = result.error.issues[0]
    const field = first.path.length > 0 ? `${String(first.path[0])} : ` : ''
    return { error: `${field}${first.message}` }
  }

  return { data: result.data }
}

// ---- Arrachage ----

/** Extrait et valide les champs du formulaire arrachage avec Zod */
export function parseUprootingForm(
  formData: FormData,
): { data: ReturnType<typeof uprootingSchema.parse> } | { error: string } {
  const raw = {
    row_id:      (formData.get('row_id') as string) || '',
    date:        (formData.get('date') as string) || '',
    variety_id:  (formData.get('variety_id') as string)?.trim() || null,
    temps_min:   parseOptionalInt(formData, 'temps_min'),
    commentaire: (formData.get('commentaire') as string)?.trim() || null,
  }

  const result = uprootingSchema.safeParse(raw)
  if (!result.success) {
    const first = result.error.issues[0]
    const field = first.path.length > 0 ? `${String(first.path[0])} : ` : ''
    return { error: `${field}${first.message}` }
  }

  return { data: result.data }
}

// ---- Occultation ----

/** Extrait et valide les champs du formulaire occultation avec Zod */
export function parseOccultationForm(
  formData: FormData,
): { data: ReturnType<typeof occultationSchema.parse> } | { error: string } {
  const raw = {
    row_id:                  (formData.get('row_id') as string) || '',
    date_debut:              (formData.get('date_debut') as string) || '',
    date_fin:                (formData.get('date_fin') as string)?.trim() || null,
    methode:                 (formData.get('methode') as string) || '',
    fournisseur:             (formData.get('fournisseur') as string)?.trim() || null,
    attestation:             (formData.get('attestation') as string)?.trim() || null,
    engrais_vert_nom:        (formData.get('engrais_vert_nom') as string)?.trim() || null,
    engrais_vert_fournisseur:(formData.get('engrais_vert_fournisseur') as string)?.trim() || null,
    engrais_vert_facture:    (formData.get('engrais_vert_facture') as string)?.trim() || null,
    engrais_vert_certif_ab:  parseBool(formData, 'engrais_vert_certif_ab'),
    temps_retrait_min:       parseOptionalInt(formData, 'temps_retrait_min'),
    temps_min:               parseOptionalInt(formData, 'temps_min'),
    commentaire:             (formData.get('commentaire') as string)?.trim() || null,
  }

  const result = occultationSchema.safeParse(raw)
  if (!result.success) {
    const first = result.error.issues[0]
    const field = first.path.length > 0 ? `${String(first.path[0])} : ` : ''
    return { error: `${field}${first.message}` }
  }

  return { data: result.data }
}
