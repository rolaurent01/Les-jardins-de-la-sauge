/** Normalise une chaîne pour la recherche : supprime les accents et met en minuscules */
export function normalize(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}
