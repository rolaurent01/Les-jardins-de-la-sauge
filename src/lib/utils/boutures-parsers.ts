/**
 * Helpers de parsing pour les formulaires du module Boutures.
 * Fonctions pures extraites des Server Actions pour être testables sans dépendances serveur.
 */

import { cuttingSchema } from '@/lib/validation/boutures'

/** Extrait et valide les champs du formulaire bouture avec Zod.
 *  Les champs plaque sont mis à null si non utilisés. */
export function parseCuttingForm(
  formData: FormData,
): { data: ReturnType<typeof cuttingSchema.parse> } | { error: string } {
  const parseOptionalInt = (key: string): number | null => {
    const v = formData.get(key) as string
    if (!v || v.trim() === '') return null
    const n = parseInt(v, 10)
    return isNaN(n) ? null : n
  }

  const parseOptionalDate = (key: string): string | null => {
    const v = formData.get(key) as string
    return v?.trim() || null
  }

  // Détecter si le flux plaque est utilisé
  const usePlaque = parseOptionalInt('nb_plaques') != null

  const raw = {
    variety_id:          (formData.get('variety_id') as string) || '',
    type_multiplication: (formData.get('type_multiplication') as string) || '',
    origine:             (formData.get('origine') as string)?.trim() || null,
    certif_ab:           formData.get('certif_ab') === 'on' || formData.get('certif_ab') === 'true',
    date_bouturage:      (formData.get('date_bouturage') as string) || '',

    // Plaque alvéolée (null si non utilisée)
    nb_plaques:          usePlaque ? parseOptionalInt('nb_plaques') : null,
    nb_trous_par_plaque: usePlaque ? parseOptionalInt('nb_trous_par_plaque') : null,
    nb_mortes_plaque:    usePlaque ? (parseOptionalInt('nb_mortes_plaque') ?? 0) : 0,
    date_mise_en_plaque: usePlaque ? parseOptionalDate('date_mise_en_plaque') : null,
    temps_bouturage_min: parseOptionalInt('temps_bouturage_min'),

    // Godet
    nb_godets:           parseOptionalInt('nb_godets'),
    nb_mortes_godet:     parseOptionalInt('nb_mortes_godet') ?? 0,
    date_rempotage:      parseOptionalDate('date_rempotage'),
    temps_rempotage_min: parseOptionalInt('temps_rempotage_min'),

    // Résultat
    nb_plants_obtenus:   parseOptionalInt('nb_plants_obtenus'),
    nb_donnees:          parseOptionalInt('nb_donnees') ?? 0,
    commentaire:         (formData.get('commentaire') as string)?.trim() || null,
  }

  const result = cuttingSchema.safeParse(raw)
  if (!result.success) {
    const first = result.error.issues[0]
    const field = first.path.length > 0 ? `${String(first.path[0])} : ` : ''
    return { error: `${field}${first.message}` }
  }

  return { data: result.data }
}
