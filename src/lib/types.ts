/**
 * Types métier de l'application LJS.
 * Ces types reflètent le schéma Supabase défini dans les migrations SQL.
 */

import type { MethodeOccultation } from '@/lib/supabase/types'
export type { MethodeOccultation }

export type TypeCycle = 'annuelle' | 'bisannuelle' | 'perenne' | 'vivace'

/** Parties récoltables d'une plante — synchronisé avec la migration 004 */
export type PartiePlante =
  | 'feuille'
  | 'fleur'
  | 'graine'
  | 'racine'
  | 'fruit'
  | 'plante_entiere'

export const PARTIES_PLANTE: PartiePlante[] = [
  'feuille', 'fleur', 'graine', 'racine', 'fruit', 'plante_entiere',
]

export const PARTIE_PLANTE_LABELS: Record<PartiePlante, string> = {
  feuille:        'Feuille',
  fleur:          'Fleur',
  graine:         'Graine',
  racine:         'Racine',
  fruit:          'Fruit',
  plante_entiere: 'Plante entière',
}

export type Variety = {
  id: string
  nom_vernaculaire: string
  nom_latin: string | null
  famille: string | null
  type_cycle: TypeCycle | null
  duree_peremption_mois: number
  parties_utilisees: PartiePlante[]
  notes: string | null
  deleted_at: string | null
  // champs catalogue multi-tenant (migration 011)
  created_by_farm_id: string | null
  created_by: string | null
  updated_by: string | null
  verified: boolean
  aliases: string[] | null
  merged_into_id: string | null
  created_at: string
  updated_at: string
}

// ---- Référentiel géographique ----

export type Site = {
  id: string
  farm_id: string
  nom: string
  description: string | null
  deleted_at: string | null
  created_by: string | null
  updated_by: string | null
  created_at: string
}

export type Parcel = {
  id: string
  farm_id: string
  site_id: string | null
  nom: string
  code: string
  orientation: string | null
  description: string | null
  deleted_at: string | null
  created_by: string | null
  updated_by: string | null
  created_at: string
}

/** Parcelle avec son site en jointure */
export type ParcelWithSite = Parcel & {
  sites: Pick<Site, 'id' | 'nom'> | null
}

export type Row = {
  id: string
  farm_id: string
  parcel_id: string | null
  numero: string
  ancien_numero: string | null
  longueur_m: number | null
  largeur_m: number | null
  position_ordre: number | null
  notes: string | null
  deleted_at: string | null
  created_by: string | null
  updated_by: string | null
  created_at: string
}

/** Rang avec sa parcelle (et son site) en jointure */
export type RowWithParcel = Row & {
  parcels:
    | (Pick<Parcel, 'id' | 'nom' | 'code'> & {
        sites: Pick<Site, 'id' | 'nom'> | null
      })
    | null
}

// ---- Matières premières externes ----

/** Matière première non-plante (sel, sucre, huile essentielle achetée…) */
export type ExternalMaterial = {
  id: string
  nom: string
  unite: string
  notes: string | null
  deleted_at: string | null
  // champs catalogue multi-tenant (migration 011)
  created_by_farm_id: string | null
  created_by: string | null
  updated_by: string | null
  created_at: string
}

/**
 * Résultat uniforme des Server Actions.
 * T = unknown par défaut : ActionResult<Site> est assignable à ActionResult
 * sans perdre la sûreté de type (contrairement à `any`).
 */
export type ActionResult<T = unknown> =
  | { success: true; data?: T }
  | { error: string }

// ---- Module Semis ----

/** Processus de semis disponibles */
export type Processus = 'caissette_godet' | 'mini_motte'

/** Sachet de graines acheté — table seed_lots */
export type SeedLot = {
  id: string
  farm_id: string
  uuid_client: string | null
  lot_interne: string
  variety_id: string | null
  fournisseur: string | null
  numero_lot_fournisseur: string | null
  date_achat: string
  date_facture: string | null
  numero_facture: string | null
  poids_sachet_g: number | null
  certif_ab: boolean
  commentaire: string | null
  deleted_at: string | null
  created_by: string | null
  updated_by: string | null
  created_at: string
}

/** Sachet avec la variété jointe (pour affichage dans les listes) */
export type SeedLotWithVariety = SeedLot & {
  varieties: Pick<Variety, 'id' | 'nom_vernaculaire' | 'nom_latin'> | null
}

/** Suivi d'un semis — table seedlings */
export type Seedling = {
  id: string
  farm_id: string
  uuid_client: string | null
  seed_lot_id: string | null
  variety_id: string | null
  processus: Processus

  // ===== PROCESS 1 : MINI-MOTTES =====
  numero_caisse: string | null
  nb_mottes: number | null
  nb_mortes_mottes: number | null

  // ===== PROCESS 2 : CAISSETTE/GODET =====
  nb_caissettes: number | null
  nb_plants_caissette: number | null
  nb_mortes_caissette: number | null
  nb_godets: number | null
  nb_mortes_godet: number | null

  // ===== COMMUN =====
  nb_donnees: number | null
  nb_plants_obtenus: number | null
  date_semis: string
  poids_graines_utilise_g: number | null
  date_levee: string | null
  date_repiquage: string | null
  temps_semis_min: number | null
  temps_repiquage_min: number | null
  commentaire: string | null
  deleted_at: string | null
  created_by: string | null
  updated_by: string | null
  created_at: string
}

/** Semis avec la variété et le sachet joints (pour affichage détaillé) */
export type SeedlingWithRelations = Seedling & {
  varieties: Pick<Variety, 'id' | 'nom_vernaculaire' | 'nom_latin'> | null
  seed_lots: Pick<SeedLot, 'id' | 'lot_interne' | 'fournisseur'> | null
}

// ---- Module Parcelles ----

// ---- Travail de sol ----

/** Types de travaux de sol */
export type TypeTravailSol = 'depaillage' | 'motoculteur' | 'amendement' | 'autre'

/** Travail de sol sur un rang — table soil_works */
export type SoilWork = {
  id: string
  farm_id: string
  uuid_client: string | null
  row_id: string | null
  date: string
  type_travail: TypeTravailSol | null
  detail: string | null
  temps_min: number | null
  commentaire: string | null
  created_by: string | null
  updated_by: string | null
  created_at: string
}

/** Travail de sol avec le rang joint (numéro, parcelle et site) */
export type SoilWorkWithRelations = SoilWork & {
  rows:
    | (Pick<Row, 'id' | 'numero'> & {
        parcels:
          | (Pick<Parcel, 'id' | 'nom'> & {
              sites: Pick<Site, 'id' | 'nom'> | null
            })
          | null
      })
    | null
}

// ---- Plantation ----

/** Types de plant pour une plantation */
export type TypePlant =
  | 'godet'
  | 'caissette'
  | 'mini_motte'
  | 'plant_achete'
  | 'division'
  | 'bouture'
  | 'marcottage'
  | 'stolon'
  | 'rhizome'
  | 'semis_direct'

/** Phase lunaire lors de la plantation */
export type LunePlantation = 'montante' | 'descendante'

/** Plantation sur un rang — table plantings */
export type Planting = {
  id: string
  farm_id: string
  uuid_client: string | null
  row_id: string | null
  variety_id: string | null
  seedling_id: string | null
  fournisseur: string | null
  annee: number
  date_plantation: string
  lune: LunePlantation | null
  nb_plants: number | null
  type_plant: TypePlant | null
  espacement_cm: number | null
  certif_ab: boolean
  date_commande: string | null
  numero_facture: string | null
  temps_min: number | null
  commentaire: string | null
  longueur_m: number | null
  largeur_m: number | null
  actif: boolean
  deleted_at: string | null
  created_by: string | null
  updated_by: string | null
  created_at: string
}

/** Plantation avec variété, rang (parcelle + site) et semis d'origine joints */
export type PlantingWithRelations = Planting & {
  varieties: Pick<Variety, 'id' | 'nom_vernaculaire'> | null
  rows:
    | (Pick<Row, 'id' | 'numero'> & {
        parcels: Pick<Parcel, 'id' | 'nom'> | null
      })
    | null
  seedlings: Pick<Seedling, 'id' | 'processus'> | null
}

// ---- Suivi de rang ----

/** Types de soins de rang */
export type TypeSoin = 'desherbage' | 'paillage' | 'arrosage' | 'autre'

/** Suivi de rang — table row_care */
export type RowCare = {
  id: string
  farm_id: string
  uuid_client: string | null
  row_id: string | null
  variety_id: string
  date: string
  type_soin: TypeSoin | null
  temps_min: number | null
  commentaire: string | null
  created_by: string | null
  updated_by: string | null
  created_at: string
}

/** Suivi de rang avec rang et variété joints */
export type RowCareWithRelations = RowCare & {
  rows:
    | (Pick<Row, 'id' | 'numero'> & {
        parcels: Pick<Parcel, 'id' | 'nom'> | null
      })
    | null
  varieties: Pick<Variety, 'id' | 'nom_vernaculaire'> | null
}

// ---- Cueillette ----

/** Cueillette (parcelle ou sauvage) — table harvests */
export type Harvest = {
  id: string
  farm_id: string
  uuid_client: string | null
  type_cueillette: 'parcelle' | 'sauvage'
  row_id: string | null
  lieu_sauvage: string | null
  variety_id: string
  partie_plante: PartiePlante
  date: string
  poids_g: number
  temps_min: number | null
  commentaire: string | null
  deleted_at: string | null
  created_by: string | null
  updated_by: string | null
  created_at: string
}

/** Cueillette avec rang (optionnel si sauvage) et variété joints */
export type HarvestWithRelations = Harvest & {
  rows:
    | (Pick<Row, 'id' | 'numero'> & {
        parcels: Pick<Parcel, 'id' | 'nom'> | null
      })
    | null
  varieties: Pick<Variety, 'id' | 'nom_vernaculaire'> | null
}

// ---- Arrachage ----

/** Arrachage d'un rang — table uprootings */
export type Uprooting = {
  id: string
  farm_id: string
  uuid_client: string | null
  row_id: string
  variety_id: string | null
  date: string
  temps_min: number | null
  commentaire: string | null
  created_by: string | null
  updated_by: string | null
  created_at: string
}

/** Arrachage avec rang et variété joints */
export type UprootingWithRelations = Uprooting & {
  rows:
    | (Pick<Row, 'id' | 'numero'> & {
        parcels: Pick<Parcel, 'id' | 'nom'> | null
      })
    | null
  varieties: Pick<Variety, 'id' | 'nom_vernaculaire'> | null
}

// ---- Occultation ----

/** Occultation d'un rang — table occultations */
export type Occultation = {
  id: string
  farm_id: string
  uuid_client: string | null
  row_id: string
  date_debut: string
  date_fin: string | null
  methode: MethodeOccultation
  fournisseur: string | null
  attestation: string | null
  engrais_vert_nom: string | null
  engrais_vert_fournisseur: string | null
  engrais_vert_facture: string | null
  engrais_vert_certif_ab: boolean
  temps_retrait_min: number | null
  temps_min: number | null
  commentaire: string | null
  created_by: string | null
  updated_by: string | null
  created_at: string
}

/** Occultation avec rang joint (parcelle + site) */
export type OccultationWithRelations = Occultation & {
  rows:
    | (Pick<Row, 'id' | 'numero'> & {
        parcels:
          | (Pick<Parcel, 'id' | 'nom' | 'code'> & {
              sites: Pick<Site, 'id' | 'nom'> | null
            })
          | null
      })
    | null
}

// ---- Module Transformation ----

/** Type d'opération de transformation (entrée ou sortie de stock) */
export type TransformationType = 'entree' | 'sortie'

/** Tronçonnage — table cuttings */
export type Cutting = {
  id: string
  farm_id: string
  uuid_client: string | null
  variety_id: string
  partie_plante: PartiePlante
  type: TransformationType
  date: string
  poids_g: number
  temps_min: number | null
  commentaire: string | null
  created_by: string | null
  updated_by: string | null
  created_at: string
}

/** Tronçonnage avec variété jointe */
export type CuttingWithVariety = Cutting & {
  varieties: Pick<Variety, 'id' | 'nom_vernaculaire' | 'nom_latin'>
}

/** Séchage — table dryings */
export type Drying = {
  id: string
  farm_id: string
  uuid_client: string | null
  variety_id: string
  partie_plante: PartiePlante
  type: TransformationType
  etat_plante: string
  date: string
  poids_g: number
  temps_min: number | null
  commentaire: string | null
  created_by: string | null
  updated_by: string | null
  created_at: string
}

/** Séchage avec variété jointe */
export type DryingWithVariety = Drying & {
  varieties: Pick<Variety, 'id' | 'nom_vernaculaire' | 'nom_latin'>
}

/** Triage — table sortings */
export type Sorting = {
  id: string
  farm_id: string
  uuid_client: string | null
  variety_id: string
  partie_plante: PartiePlante
  type: TransformationType
  etat_plante: string
  date: string
  poids_g: number
  temps_min: number | null
  commentaire: string | null
  created_by: string | null
  updated_by: string | null
  created_at: string
}

/** Triage avec variété jointe */
export type SortingWithVariety = Sorting & {
  varieties: Pick<Variety, 'id' | 'nom_vernaculaire' | 'nom_latin'>
}

// ---- Plateforme multi-tenant (migration 011) ----

/** Organisation propriétaire de une ou plusieurs fermes */
export type Organization = {
  id: string
  nom: string
  slug: string
  nom_affiche: string | null
  logo_url: string | null
  couleur_primaire: string
  couleur_secondaire: string
  max_farms: number
  max_users: number
  plan: 'starter' | 'pro' | 'enterprise'
  created_at: string
  updated_at: string
}

/** Ferme (unité de production isolée par RLS) */
export type Farm = {
  id: string
  organization_id: string
  nom: string
  slug: string
  created_at: string
  updated_at: string
}

/** Rôle d'un utilisateur dans une organisation */
export type MembershipRole = 'owner' | 'admin' | 'member'

/** Permission d'un utilisateur sur une ferme */
export type FarmAccessPermission = 'full' | 'read' | 'write'

/** Membre d'une organisation */
export type Membership = {
  id: string
  organization_id: string
  user_id: string
  role: MembershipRole
  created_at: string
}

/** Accès d'un utilisateur à une ferme */
export type FarmAccess = {
  id: string
  farm_id: string
  user_id: string
  permission: FarmAccessPermission
  created_at: string
}

/**
 * Contexte applicatif courant — ferme active + identifiants de l'utilisateur.
 * Résolu côté serveur dans les Server Actions via getContext() (src/lib/context.ts).
 */
export type AppContext = {
  userId: string
  farmId: string
  organizationId: string
  orgSlug: string
}
