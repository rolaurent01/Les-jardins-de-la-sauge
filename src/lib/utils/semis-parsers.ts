/**
 * Helpers de parsing pour les formulaires du module Semis.
 * Fonctions pures extraites des Server Actions pour être testables sans dépendances serveur.
 */

import { seedLotSchema, seedlingSchema } from '@/lib/validation/semis'

// ---- Sachet de graines ----

/** Extrait et valide les champs du formulaire sachet avec Zod */
export function parseSeedLotForm(
  formData: FormData,
): { data: ReturnType<typeof seedLotSchema.parse> } | { error: string } {
  const raw = {
    variety_id:              (formData.get('variety_id') as string) || '',
    fournisseur:             (formData.get('fournisseur') as string)?.trim()              || null,
    numero_lot_fournisseur:  (formData.get('numero_lot_fournisseur') as string)?.trim()   || null,
    date_achat:              (formData.get('date_achat') as string)  || '',
    date_facture:            (formData.get('date_facture') as string)?.trim()             || null,
    numero_facture:          (formData.get('numero_facture') as string)?.trim()           || null,
    poids_sachet_g:          (() => {
      const v = formData.get('poids_sachet_g') as string
      return v ? parseFloat(v) : null
    })(),
    certif_ab: formData.get('certif_ab') === 'on' || formData.get('certif_ab') === 'true',
    commentaire: (formData.get('commentaire') as string)?.trim() || null,
  }

  const result = seedLotSchema.safeParse(raw)
  if (!result.success) {
    // Retourner le premier message d'erreur Zod
    const first = result.error.issues[0]
    const field = first.path.length > 0 ? `${String(first.path[0])} : ` : ''
    return { error: `${field}${first.message}` }
  }

  return { data: result.data }
}

// ---- Semis ----

/** Extrait et valide les champs du formulaire semis avec Zod.
 *  Les champs de l'autre processus sont explicitement mis à null
 *  pour éviter des données orphelines en base. */
export function parseSeedlingForm(
  formData: FormData,
): { data: ReturnType<typeof seedlingSchema.parse> } | { error: string } {
  const processus = formData.get('processus') as string

  const parseOptionalInt = (key: string): number | null => {
    const v = formData.get(key) as string
    if (!v || v.trim() === '') return null
    const n = parseInt(v, 10)
    return isNaN(n) ? null : n
  }

  const parseOptionalFloat = (key: string): number | null => {
    const v = formData.get(key) as string
    if (!v || v.trim() === '') return null
    const n = parseFloat(v)
    return isNaN(n) ? null : n
  }

  const parseOptionalDate = (key: string): string | null => {
    const v = formData.get(key) as string
    return v?.trim() || null
  }

  // Champs conditionnels selon le processus — l'autre processus est mis à null
  const isMiniMotte = processus === 'mini_motte'

  const raw = {
    processus:               (formData.get('processus') as string) || '',
    variety_id:              (formData.get('variety_id') as string) || '',
    seed_lot_id:             (formData.get('seed_lot_id') as string)?.trim() || null,
    date_semis:              (formData.get('date_semis') as string) || '',
    date_levee:              parseOptionalDate('date_levee'),
    poids_graines_utilise_g: parseOptionalFloat('poids_graines_utilise_g'),
    nb_donnees:              parseOptionalInt('nb_donnees') ?? 0,
    nb_plants_obtenus:       parseOptionalInt('nb_plants_obtenus'),
    temps_semis_min:         parseOptionalInt('temps_semis_min'),
    temps_repiquage_min:     parseOptionalInt('temps_repiquage_min'),
    commentaire:             (formData.get('commentaire') as string)?.trim() || null,

    // Champs mini_motte (null si processus = caissette_godet, sauf nb_mortes_mottes = 0 car NOT NULL en base)
    numero_caisse:    isMiniMotte ? ((formData.get('numero_caisse') as string)?.trim() || null) : null,
    nb_mottes:        isMiniMotte ? parseOptionalInt('nb_mottes') : null,
    nb_mortes_mottes: isMiniMotte ? (parseOptionalInt('nb_mortes_mottes') ?? 0) : 0,

    // Champs caissette_godet (null si processus = mini_motte, sauf nb_mortes_* = 0 car NOT NULL en base)
    nb_caissettes:       !isMiniMotte ? parseOptionalInt('nb_caissettes') : null,
    nb_plants_caissette: !isMiniMotte ? parseOptionalInt('nb_plants_caissette') : null,
    nb_mortes_caissette: !isMiniMotte ? (parseOptionalInt('nb_mortes_caissette') ?? 0) : 0,
    nb_godets:           !isMiniMotte ? parseOptionalInt('nb_godets') : null,
    nb_mortes_godet:     !isMiniMotte ? (parseOptionalInt('nb_mortes_godet') ?? 0) : 0,
    date_repiquage:      !isMiniMotte ? parseOptionalDate('date_repiquage') : null,
  }

  const result = seedlingSchema.safeParse(raw)
  if (!result.success) {
    // Retourner le premier message d'erreur Zod
    const first = result.error.issues[0]
    const field = first.path.length > 0 ? `${String(first.path[0])} : ` : ''
    return { error: `${field}${first.message}` }
  }

  return { data: result.data }
}
