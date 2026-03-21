/**
 * Liste des routes mobiles à précacher via warm cache.
 * Correspond aux pages sous src/app/[orgSlug]/(mobile)/m/saisie/
 */
export function getMobileRoutes(orgSlug: string): string[] {
  return [
    // Menu principal
    `/${orgSlug}/m/saisie`,
    // Sous-menus catégories
    `/${orgSlug}/m/saisie/semis`,
    `/${orgSlug}/m/saisie/parcelle`,
    `/${orgSlug}/m/saisie/transfo`,
    `/${orgSlug}/m/saisie/stock`,
    `/${orgSlug}/m/saisie/produits`,
    // Formulaires semis
    `/${orgSlug}/m/saisie/semis/sachet`,
    `/${orgSlug}/m/saisie/semis/suivi-semis`,
    `/${orgSlug}/m/saisie/semis/avancement`,
    // Formulaires parcelle
    `/${orgSlug}/m/saisie/parcelle/travail-sol`,
    `/${orgSlug}/m/saisie/parcelle/plantation`,
    `/${orgSlug}/m/saisie/parcelle/suivi-rang`,
    `/${orgSlug}/m/saisie/parcelle/cueillette`,
    `/${orgSlug}/m/saisie/parcelle/arrachage`,
    `/${orgSlug}/m/saisie/parcelle/occultation`,
    // Formulaires transformation
    `/${orgSlug}/m/saisie/transfo/tronconnage`,
    `/${orgSlug}/m/saisie/transfo/sechage`,
    `/${orgSlug}/m/saisie/transfo/triage`,
    // Formulaires stock
    `/${orgSlug}/m/saisie/stock/achat`,
    `/${orgSlug}/m/saisie/stock/vente`,
    // Formulaires produits
    `/${orgSlug}/m/saisie/produits/production`,
  ]
}
