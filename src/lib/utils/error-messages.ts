/**
 * Mappe les erreurs Supabase/PostgreSQL vers des messages FR lisibles.
 * Ne jamais exposer error.message brut à l'utilisateur.
 */
export function mapSupabaseError(
  error: { message?: string; code?: string; details?: string } | null,
): string {
  if (!error) return 'Une erreur inattendue est survenue.'

  const msg = error.message ?? ''
  const code = error.code ?? ''

  // Contraintes UNIQUE
  if (code === '23505' || msg.includes('duplicate key') || msg.includes('unique constraint')) {
    if (msg.includes('nom_vernaculaire')) return 'Cette variété existe déjà.'
    if (msg.includes('lot_interne')) return 'Ce numéro de lot existe déjà.'
    if (msg.includes('numero_lot')) return 'Ce numéro de lot existe déjà.'
    if (msg.includes('slug')) return 'Ce slug est déjà utilisé.'
    if (msg.includes('code')) return 'Ce code existe déjà.'
    if (msg.includes('nom')) return 'Ce nom existe déjà.'
    return 'Un enregistrement identique existe déjà.'
  }

  // FK violation
  if (code === '23503' || msg.includes('foreign key')) {
    return 'Cet élément est référencé ailleurs et ne peut pas être modifié/supprimé.'
  }

  // NOT NULL violation
  if (code === '23502' || msg.includes('not-null')) {
    return 'Un champ obligatoire est manquant.'
  }

  // CHECK constraint
  if (code === '23514' || msg.includes('check constraint')) {
    return "La valeur saisie n'est pas valide."
  }

  // RLS / permission
  if (code === '42501' || msg.includes('permission denied') || msg.includes('RLS')) {
    return "Vous n'avez pas les droits pour cette opération."
  }

  // Stock insuffisant (RPCs) — message déjà en FR
  if (msg.includes('Stock insuffisant') || msg.includes('stock insuffisant')) {
    return msg
  }

  // Infinite recursion RLS
  if (msg.includes('infinite recursion')) {
    return "Erreur de configuration des permissions. Contactez l'administrateur."
  }

  // Réseau / timeout
  if (msg.includes('Failed to fetch') || msg.includes('Load failed') || msg.includes('NetworkError')) {
    return 'Erreur de connexion. Vérifiez votre réseau et réessayez.'
  }

  // Fallback : ne JAMAIS exposer le message brut
  return 'Une erreur est survenue. Veuillez réessayer.'
}
