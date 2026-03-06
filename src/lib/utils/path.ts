/**
 * Construit un chemin absolu préfixé par le slug de l'organisation.
 * Utilisé par les Server Actions pour revalidatePath avec le routing multi-tenant.
 *
 * @example buildPath('ljs', '/semis/sachets') → '/ljs/semis/sachets'
 */
export function buildPath(orgSlug: string, path: string): string {
  return `/${orgSlug}${path.startsWith('/') ? path : '/' + path}`
}
