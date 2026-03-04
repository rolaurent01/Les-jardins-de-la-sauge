/**
 * Helpers de parsing pour les formulaires du module Parcelles.
 * Fonctions pures extraites des Server Actions pour être testables sans dépendances serveur.
 */

import { soilWorkSchema } from '@/lib/validation/parcelles'

// ---- Helpers partagés ----

function parseOptionalInt(formData: FormData, key: string): number | null {
  const v = formData.get(key) as string
  if (!v || v.trim() === '') return null
  const n = parseInt(v, 10)
  return isNaN(n) ? null : n
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
