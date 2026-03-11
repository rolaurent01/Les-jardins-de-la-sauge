import Dexie, { type Table } from 'dexie'

// --- Interfaces exportées (réutilisées en A6.4/A6.6) ---

/** Contexte offline — identifie la ferme active et l'utilisateur */
export interface OfflineContext {
  key: 'current'
  userId: string
  farmId: string
  organizationId: string
  orgSlug: string
  lastSyncedAt: string | null // ISO timestamp du dernier chargement réussi
}

/** Cache variétés (filtrées server-side : hidden/merged/deleted exclus) */
export interface CachedVariety {
  id: string
  nom_vernaculaire: string
  nom_latin: string | null
  famille: string | null
  type_cycle: string | null
  parties_utilisees: string[]
}

/** Cache sites */
export interface CachedSite {
  id: string
  nom: string
}

/** Cache parcelles */
export interface CachedParcel {
  id: string
  site_id: string
  nom: string
  code: string
}

/** Cache rangs */
export interface CachedRow {
  id: string
  parcel_id: string
  numero: string
  longueur_m: number | null
  largeur_m: number | null
  position_ordre: number | null
}

/** Cache recettes (privées par ferme) */
export interface CachedRecipe {
  id: string
  nom: string
  category_id: string | null
  poids_sachet_g: number
  actif: boolean
}

/** Cache sachets de graines pour dropdown "sachet source" */
export interface CachedSeedLot {
  id: string
  lot_interne: string
  variety_id: string
}

/** Cache matériaux externes */
export interface CachedExternalMaterial {
  id: string
  nom: string
  unite: string
}

/** Cache semis enrichis pour le sélecteur plantation mobile */
export interface CachedSeedling {
  id: string
  processus: string
  statut: string
  numero_caisse: string | null
  nb_plants_obtenus: number | null
  date_semis: string
  variety_id: string | null
  variety_name: string | null
  seed_lot_interne: string | null
  plants_plantes: number
  plants_restants: number | null
}

/** File d'attente de sync (structure créée ici, logique en A6.4) */
export interface SyncQueueEntry {
  id?: number // auto-increment Dexie
  uuid_client: string
  farm_id: string
  table_cible: string // 'harvests', 'cuttings', 'soil_works', etc.
  payload: Record<string, unknown>
  status: 'pending' | 'syncing' | 'synced' | 'error'
  tentatives: number
  derniere_erreur: string | null
  created_at: string // ISO timestamp
  synced_at: string | null
}

/** Réponse de l'API /api/offline/reference-data */
export interface ReferenceDataResponse {
  varieties: CachedVariety[]
  sites: CachedSite[]
  parcels: CachedParcel[]
  rows: CachedRow[]
  recipes: CachedRecipe[]
  seedLots: CachedSeedLot[]
  seedlings: CachedSeedling[]
  externalMaterials: CachedExternalMaterial[]
  timestamp: string // ISO
}

// --- Base Dexie ---

class OfflineDatabase extends Dexie {
  context!: Table<OfflineContext>
  varieties!: Table<CachedVariety>
  sites!: Table<CachedSite>
  parcels!: Table<CachedParcel>
  rows!: Table<CachedRow>
  recipes!: Table<CachedRecipe>
  seedLots!: Table<CachedSeedLot>
  seedlings!: Table<CachedSeedling>
  externalMaterials!: Table<CachedExternalMaterial>
  syncQueue!: Table<SyncQueueEntry>

  constructor() {
    super('ljs-offline')
    this.version(1).stores({
      context: 'key',
      varieties: 'id, nom_vernaculaire',
      sites: 'id',
      parcels: 'id, site_id',
      rows: 'id, parcel_id',
      recipes: 'id',
      seedLots: 'id, variety_id',
      externalMaterials: 'id',
      syncQueue: '++id, uuid_client, status, farm_id, created_at',
    })
    this.version(2).stores({
      context: 'key',
      varieties: 'id, nom_vernaculaire',
      sites: 'id',
      parcels: 'id, site_id',
      rows: 'id, parcel_id',
      recipes: 'id',
      seedLots: 'id, variety_id',
      seedlings: 'id, variety_id, statut',
      externalMaterials: 'id',
      syncQueue: '++id, uuid_client, status, farm_id, created_at',
    })
  }
}

export const offlineDb = new OfflineDatabase()
