/**
 * Types Supabase — schéma complet de l'appli LJS.
 *
 * Ce fichier est écrit manuellement pour correspondre aux migrations SQL.
 * Pour régénérer depuis Supabase CLI (recommandé si le schéma évolue) :
 *   npx supabase gen types typescript --project-id <project-id> > src/lib/supabase/types.ts
 *
 * Inclut les colonnes ajoutées par :
 *   - migration 002 (deleted_at sur sites, parcels, rows, external_materials)
 *   - migration 004 (partie_plante sur toutes les tables de stock et transformation,
 *     parties_utilisees sur varieties)
 *   - migration 007 (occultations)
 *   - migration 008 (dates NOT NULL, lune sur plantings)
 *   - migration 011 (multi-tenant : farm_id, created_by, updated_by sur toutes les tables
 *     métier ; tables plateforme organisations/fermes/membres)
 *
 * Note : chaque table requiert Relationships: [] pour que le SDK v2.x
 * puisse inférer correctement les types Insert/Update.
 */

// Parties de plante — les 6 valeurs possibles (migration 004)
export type PartiePlante =
  | 'feuille'
  | 'fleur'
  | 'graine'
  | 'racine'
  | 'fruit'
  | 'plante_entiere'

// Méthodes d'occultation — les 4 valeurs possibles (migration 007)
export type MethodeOccultation =
  | 'paille'
  | 'foin'
  | 'bache'
  | 'engrais_vert'

export type Database = {
  public: {
    Tables: {

      // ──────────────────────────────────────────────────────────────
      // 0. PLATEFORME MULTI-TENANT (migration 011)
      // ──────────────────────────────────────────────────────────────

      organizations: {
        Row: {
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
        Insert: {
          id?: string
          nom: string
          slug: string
          nom_affiche?: string | null
          logo_url?: string | null
          couleur_primaire?: string
          couleur_secondaire?: string
          max_farms?: number
          max_users?: number
          plan?: 'starter' | 'pro' | 'enterprise'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          nom?: string
          slug?: string
          nom_affiche?: string | null
          logo_url?: string | null
          couleur_primaire?: string
          couleur_secondaire?: string
          max_farms?: number
          max_users?: number
          plan?: 'starter' | 'pro' | 'enterprise'
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }

      farms: {
        Row: {
          id: string
          organization_id: string
          nom: string
          slug: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          nom: string
          slug: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          nom?: string
          slug?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'farms_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          }
        ]
      }

      memberships: {
        Row: {
          id: string
          organization_id: string
          user_id: string
          role: 'owner' | 'admin' | 'member'
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          user_id: string
          role?: 'owner' | 'admin' | 'member'
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          user_id?: string
          role?: 'owner' | 'admin' | 'member'
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'memberships_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          }
        ]
      }

      farm_access: {
        Row: {
          id: string
          farm_id: string
          user_id: string
          permission: 'full' | 'read' | 'write'
          created_at: string
        }
        Insert: {
          id?: string
          farm_id: string
          user_id: string
          permission?: 'full' | 'read' | 'write'
          created_at?: string
        }
        Update: {
          id?: string
          farm_id?: string
          user_id?: string
          permission?: 'full' | 'read' | 'write'
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'farm_access_farm_id_fkey'
            columns: ['farm_id']
            isOneToOne: false
            referencedRelation: 'farms'
            referencedColumns: ['id']
          }
        ]
      }

      farm_modules: {
        Row: {
          id: string
          farm_id: string
          module: string
          actif: boolean
          created_at: string
        }
        Insert: {
          id?: string
          farm_id: string
          module: string
          actif?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          farm_id?: string
          module?: string
          actif?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'farm_modules_farm_id_fkey'
            columns: ['farm_id']
            isOneToOne: false
            referencedRelation: 'farms'
            referencedColumns: ['id']
          }
        ]
      }

      platform_admins: {
        Row: {
          user_id: string
          created_at: string
        }
        Insert: {
          user_id: string
          created_at?: string
        }
        Update: {
          user_id?: string
          created_at?: string
        }
        Relationships: []
      }

      farm_variety_settings: {
        Row: {
          id: string
          farm_id: string
          variety_id: string
          seuil_alerte_g: number | null
          actif: boolean
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          farm_id: string
          variety_id: string
          seuil_alerte_g?: number | null
          actif?: boolean
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          farm_id?: string
          variety_id?: string
          seuil_alerte_g?: number | null
          actif?: boolean
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'farm_variety_settings_farm_id_fkey'
            columns: ['farm_id']
            isOneToOne: false
            referencedRelation: 'farms'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'farm_variety_settings_variety_id_fkey'
            columns: ['variety_id']
            isOneToOne: false
            referencedRelation: 'varieties'
            referencedColumns: ['id']
          }
        ]
      }

      farm_material_settings: {
        Row: {
          id: string
          farm_id: string
          external_material_id: string
          actif: boolean
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          farm_id: string
          external_material_id: string
          actif?: boolean
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          farm_id?: string
          external_material_id?: string
          actif?: boolean
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'farm_material_settings_farm_id_fkey'
            columns: ['farm_id']
            isOneToOne: false
            referencedRelation: 'farms'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'farm_material_settings_external_material_id_fkey'
            columns: ['external_material_id']
            isOneToOne: false
            referencedRelation: 'external_materials'
            referencedColumns: ['id']
          }
        ]
      }

      notifications: {
        Row: {
          id: string
          farm_id: string
          user_id: string | null
          type: string
          titre: string
          message: string | null
          lu: boolean
          metadata: Record<string, unknown> | null
          created_at: string
        }
        Insert: {
          id?: string
          farm_id: string
          user_id?: string | null
          type: string
          titre: string
          message?: string | null
          lu?: boolean
          metadata?: Record<string, unknown> | null
          created_at?: string
        }
        Update: {
          id?: string
          farm_id?: string
          user_id?: string | null
          type?: string
          titre?: string
          message?: string | null
          lu?: boolean
          metadata?: Record<string, unknown> | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'notifications_farm_id_fkey'
            columns: ['farm_id']
            isOneToOne: false
            referencedRelation: 'farms'
            referencedColumns: ['id']
          }
        ]
      }

      audit_log: {
        Row: {
          id: string
          farm_id: string | null
          user_id: string | null
          action: string
          table_name: string
          record_id: string | null
          old_data: Record<string, unknown> | null
          new_data: Record<string, unknown> | null
          created_at: string
        }
        Insert: {
          id?: string
          farm_id?: string | null
          user_id?: string | null
          action: string
          table_name: string
          record_id?: string | null
          old_data?: Record<string, unknown> | null
          new_data?: Record<string, unknown> | null
          created_at?: string
        }
        Update: {
          id?: string
          farm_id?: string | null
          user_id?: string | null
          action?: string
          table_name?: string
          record_id?: string | null
          old_data?: Record<string, unknown> | null
          new_data?: Record<string, unknown> | null
          created_at?: string
        }
        Relationships: []
      }

      // ──────────────────────────────────────────────────────────────
      // 1. RÉFÉRENTIEL (catalogue partagé)
      // ──────────────────────────────────────────────────────────────

      varieties: {
        Row: {
          id: string
          nom_vernaculaire: string
          nom_latin: string | null
          famille: string | null
          type_cycle: 'annuelle' | 'bisannuelle' | 'perenne' | 'vivace' | null
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
        Insert: {
          id?: string
          nom_vernaculaire: string
          nom_latin?: string | null
          famille?: string | null
          type_cycle?: 'annuelle' | 'bisannuelle' | 'perenne' | 'vivace' | null
          duree_peremption_mois?: number
          parties_utilisees?: PartiePlante[]
          notes?: string | null
          deleted_at?: string | null
          created_by_farm_id?: string | null
          created_by?: string | null
          updated_by?: string | null
          verified?: boolean
          aliases?: string[] | null
          merged_into_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          nom_vernaculaire?: string
          nom_latin?: string | null
          famille?: string | null
          type_cycle?: 'annuelle' | 'bisannuelle' | 'perenne' | 'vivace' | null
          duree_peremption_mois?: number
          parties_utilisees?: PartiePlante[]
          notes?: string | null
          deleted_at?: string | null
          created_by_farm_id?: string | null
          created_by?: string | null
          updated_by?: string | null
          verified?: boolean
          aliases?: string[] | null
          merged_into_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }

      external_materials: {
        Row: {
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
        Insert: {
          id?: string
          nom: string
          unite?: string
          notes?: string | null
          deleted_at?: string | null
          created_by_farm_id?: string | null
          created_by?: string | null
          updated_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          nom?: string
          unite?: string
          notes?: string | null
          deleted_at?: string | null
          created_by_farm_id?: string | null
          created_by?: string | null
          updated_by?: string | null
          created_at?: string
        }
        Relationships: []
      }

      sites: {
        Row: {
          id: string
          farm_id: string
          nom: string
          description: string | null
          deleted_at: string | null
          created_by: string | null
          updated_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          farm_id?: string
          nom: string
          description?: string | null
          deleted_at?: string | null
          created_by?: string | null
          updated_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          farm_id?: string
          nom?: string
          description?: string | null
          deleted_at?: string | null
          created_by?: string | null
          updated_by?: string | null
          created_at?: string
        }
        Relationships: []
      }

      parcels: {
        Row: {
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
        Insert: {
          id?: string
          farm_id?: string
          site_id?: string | null
          nom: string
          code: string
          orientation?: string | null
          description?: string | null
          deleted_at?: string | null
          created_by?: string | null
          updated_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          farm_id?: string
          site_id?: string | null
          nom?: string
          code?: string
          orientation?: string | null
          description?: string | null
          deleted_at?: string | null
          created_by?: string | null
          updated_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'parcels_site_id_fkey'
            columns: ['site_id']
            isOneToOne: false
            referencedRelation: 'sites'
            referencedColumns: ['id']
          }
        ]
      }

      rows: {
        Row: {
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
        Insert: {
          id?: string
          farm_id?: string
          parcel_id?: string | null
          numero: string
          ancien_numero?: string | null
          longueur_m?: number | null
          largeur_m?: number | null
          position_ordre?: number | null
          notes?: string | null
          deleted_at?: string | null
          created_by?: string | null
          updated_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          farm_id?: string
          parcel_id?: string | null
          numero?: string
          ancien_numero?: string | null
          longueur_m?: number | null
          largeur_m?: number | null
          position_ordre?: number | null
          notes?: string | null
          deleted_at?: string | null
          created_by?: string | null
          updated_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'rows_parcel_id_fkey'
            columns: ['parcel_id']
            isOneToOne: false
            referencedRelation: 'parcels'
            referencedColumns: ['id']
          }
        ]
      }

      // ──────────────────────────────────────────────────────────────
      // 2. SEMIS
      // ──────────────────────────────────────────────────────────────

      seed_lots: {
        Row: {
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
        Insert: {
          id?: string
          farm_id?: string
          uuid_client?: string | null
          lot_interne: string
          variety_id?: string | null
          fournisseur?: string | null
          numero_lot_fournisseur?: string | null
          date_achat: string
          date_facture?: string | null
          numero_facture?: string | null
          poids_sachet_g?: number | null
          certif_ab?: boolean
          commentaire?: string | null
          deleted_at?: string | null
          created_by?: string | null
          updated_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          farm_id?: string
          uuid_client?: string | null
          lot_interne?: string
          variety_id?: string | null
          fournisseur?: string | null
          numero_lot_fournisseur?: string | null
          date_achat?: string
          date_facture?: string | null
          numero_facture?: string | null
          poids_sachet_g?: number | null
          certif_ab?: boolean
          commentaire?: string | null
          deleted_at?: string | null
          created_by?: string | null
          updated_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'seed_lots_variety_id_fkey'
            columns: ['variety_id']
            isOneToOne: false
            referencedRelation: 'varieties'
            referencedColumns: ['id']
          }
        ]
      }

      seedlings: {
        Row: {
          id: string
          farm_id: string
          uuid_client: string | null
          seed_lot_id: string | null
          variety_id: string | null
          processus: 'caissette_godet' | 'mini_motte' | null
          numero_caisse: string | null
          nb_mottes: number | null
          nb_mortes_mottes: number
          nb_caissettes: number | null
          nb_plants_caissette: number | null
          nb_mortes_caissette: number
          nb_godets: number | null
          nb_mortes_godet: number
          nb_donnees: number
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
        Insert: {
          id?: string
          farm_id?: string
          uuid_client?: string | null
          seed_lot_id?: string | null
          variety_id?: string | null
          processus?: 'caissette_godet' | 'mini_motte' | null
          numero_caisse?: string | null
          nb_mottes?: number | null
          nb_mortes_mottes?: number
          nb_caissettes?: number | null
          nb_plants_caissette?: number | null
          nb_mortes_caissette?: number
          nb_godets?: number | null
          nb_mortes_godet?: number
          nb_donnees?: number
          nb_plants_obtenus?: number | null
          date_semis: string
          poids_graines_utilise_g?: number | null
          date_levee?: string | null
          date_repiquage?: string | null
          temps_semis_min?: number | null
          temps_repiquage_min?: number | null
          commentaire?: string | null
          deleted_at?: string | null
          created_by?: string | null
          updated_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          farm_id?: string
          uuid_client?: string | null
          seed_lot_id?: string | null
          variety_id?: string | null
          processus?: 'caissette_godet' | 'mini_motte' | null
          numero_caisse?: string | null
          nb_mottes?: number | null
          nb_mortes_mottes?: number
          nb_caissettes?: number | null
          nb_plants_caissette?: number | null
          nb_mortes_caissette?: number
          nb_godets?: number | null
          nb_mortes_godet?: number
          nb_donnees?: number
          nb_plants_obtenus?: number | null
          date_semis?: string
          poids_graines_utilise_g?: number | null
          date_levee?: string | null
          date_repiquage?: string | null
          temps_semis_min?: number | null
          temps_repiquage_min?: number | null
          commentaire?: string | null
          deleted_at?: string | null
          created_by?: string | null
          updated_by?: string | null
          created_at?: string
        }
        Relationships: []
      }

      // ──────────────────────────────────────────────────────────────
      // 3. SUIVI PARCELLE
      // ──────────────────────────────────────────────────────────────

      soil_works: {
        Row: {
          id: string
          farm_id: string
          uuid_client: string | null
          row_id: string | null
          date: string
          type_travail: 'depaillage' | 'motoculteur' | 'amendement' | 'autre' | null
          detail: string | null
          temps_min: number | null
          commentaire: string | null
          created_by: string | null
          updated_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          farm_id?: string
          uuid_client?: string | null
          row_id?: string | null
          date: string
          type_travail?: 'depaillage' | 'motoculteur' | 'amendement' | 'autre' | null
          detail?: string | null
          temps_min?: number | null
          commentaire?: string | null
          created_by?: string | null
          updated_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          farm_id?: string
          uuid_client?: string | null
          row_id?: string | null
          date?: string
          type_travail?: 'depaillage' | 'motoculteur' | 'amendement' | 'autre' | null
          detail?: string | null
          temps_min?: number | null
          commentaire?: string | null
          created_by?: string | null
          updated_by?: string | null
          created_at?: string
        }
        Relationships: []
      }

      plantings: {
        Row: {
          id: string
          farm_id: string
          uuid_client: string | null
          row_id: string | null
          variety_id: string | null
          seedling_id: string | null
          fournisseur: string | null
          annee: number
          date_plantation: string
          lune: 'montante' | 'descendante' | null
          nb_plants: number | null
          type_plant:
            | 'godet' | 'caissette' | 'mini_motte' | 'plant_achete'
            | 'division' | 'bouture' | 'marcottage' | 'stolon' | 'rhizome' | 'semis_direct'
            | null
          espacement_cm: number | null
          longueur_m: number | null
          largeur_m: number | null
          certif_ab: boolean
          date_commande: string | null
          numero_facture: string | null
          temps_min: number | null
          commentaire: string | null
          actif: boolean
          deleted_at: string | null
          created_by: string | null
          updated_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          farm_id?: string
          uuid_client?: string | null
          row_id?: string | null
          variety_id?: string | null
          seedling_id?: string | null
          fournisseur?: string | null
          annee: number
          date_plantation: string
          lune?: 'montante' | 'descendante' | null
          nb_plants?: number | null
          type_plant?:
            | 'godet' | 'caissette' | 'mini_motte' | 'plant_achete'
            | 'division' | 'bouture' | 'marcottage' | 'stolon' | 'rhizome' | 'semis_direct'
            | null
          espacement_cm?: number | null
          longueur_m?: number | null
          largeur_m?: number | null
          certif_ab?: boolean
          date_commande?: string | null
          numero_facture?: string | null
          temps_min?: number | null
          commentaire?: string | null
          actif?: boolean
          deleted_at?: string | null
          created_by?: string | null
          updated_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          farm_id?: string
          uuid_client?: string | null
          row_id?: string | null
          variety_id?: string | null
          seedling_id?: string | null
          fournisseur?: string | null
          annee?: number
          date_plantation?: string
          lune?: 'montante' | 'descendante' | null
          nb_plants?: number | null
          type_plant?:
            | 'godet' | 'caissette' | 'mini_motte' | 'plant_achete'
            | 'division' | 'bouture' | 'marcottage' | 'stolon' | 'rhizome' | 'semis_direct'
            | null
          espacement_cm?: number | null
          longueur_m?: number | null
          largeur_m?: number | null
          certif_ab?: boolean
          date_commande?: string | null
          numero_facture?: string | null
          temps_min?: number | null
          commentaire?: string | null
          actif?: boolean
          deleted_at?: string | null
          created_by?: string | null
          updated_by?: string | null
          created_at?: string
        }
        Relationships: []
      }

      row_care: {
        Row: {
          id: string
          farm_id: string
          uuid_client: string | null
          row_id: string | null
          variety_id: string
          date: string
          type_soin: 'desherbage' | 'paillage' | 'arrosage' | 'autre' | null
          temps_min: number | null
          commentaire: string | null
          created_by: string | null
          updated_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          farm_id?: string
          uuid_client?: string | null
          row_id?: string | null
          variety_id: string
          date: string
          type_soin?: 'desherbage' | 'paillage' | 'arrosage' | 'autre' | null
          temps_min?: number | null
          commentaire?: string | null
          created_by?: string | null
          updated_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          farm_id?: string
          uuid_client?: string | null
          row_id?: string | null
          variety_id?: string
          date?: string
          type_soin?: 'desherbage' | 'paillage' | 'arrosage' | 'autre' | null
          temps_min?: number | null
          commentaire?: string | null
          created_by?: string | null
          updated_by?: string | null
          created_at?: string
        }
        Relationships: []
      }

      harvests: {
        Row: {
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
        Insert: {
          id?: string
          farm_id?: string
          uuid_client?: string | null
          type_cueillette: 'parcelle' | 'sauvage'
          row_id?: string | null
          lieu_sauvage?: string | null
          variety_id: string
          partie_plante: PartiePlante
          date: string
          poids_g: number
          temps_min?: number | null
          commentaire?: string | null
          deleted_at?: string | null
          created_by?: string | null
          updated_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          farm_id?: string
          uuid_client?: string | null
          type_cueillette?: 'parcelle' | 'sauvage'
          row_id?: string | null
          lieu_sauvage?: string | null
          variety_id?: string
          partie_plante?: PartiePlante
          date?: string
          poids_g?: number
          temps_min?: number | null
          commentaire?: string | null
          deleted_at?: string | null
          created_by?: string | null
          updated_by?: string | null
          created_at?: string
        }
        Relationships: []
      }

      uprootings: {
        Row: {
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
        Insert: {
          id?: string
          farm_id?: string
          uuid_client?: string | null
          row_id: string
          variety_id?: string | null
          date: string
          temps_min?: number | null
          commentaire?: string | null
          created_by?: string | null
          updated_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          farm_id?: string
          uuid_client?: string | null
          row_id?: string
          variety_id?: string | null
          date?: string
          temps_min?: number | null
          commentaire?: string | null
          created_by?: string | null
          updated_by?: string | null
          created_at?: string
        }
        Relationships: []
      }

      occultations: {
        Row: {
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
        Insert: {
          id?: string
          farm_id?: string
          uuid_client?: string | null
          row_id: string
          date_debut: string
          date_fin?: string | null
          methode: MethodeOccultation
          fournisseur?: string | null
          attestation?: string | null
          engrais_vert_nom?: string | null
          engrais_vert_fournisseur?: string | null
          engrais_vert_facture?: string | null
          engrais_vert_certif_ab?: boolean
          temps_retrait_min?: number | null
          temps_min?: number | null
          commentaire?: string | null
          created_by?: string | null
          updated_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          farm_id?: string
          uuid_client?: string | null
          row_id?: string
          date_debut?: string
          date_fin?: string | null
          methode?: MethodeOccultation
          fournisseur?: string | null
          attestation?: string | null
          engrais_vert_nom?: string | null
          engrais_vert_fournisseur?: string | null
          engrais_vert_facture?: string | null
          engrais_vert_certif_ab?: boolean
          temps_retrait_min?: number | null
          temps_min?: number | null
          commentaire?: string | null
          created_by?: string | null
          updated_by?: string | null
          created_at?: string
        }
        Relationships: []
      }

      // ──────────────────────────────────────────────────────────────
      // 4. TRANSFORMATION
      // ──────────────────────────────────────────────────────────────

      cuttings: {
        Row: {
          id: string
          farm_id: string
          uuid_client: string | null
          variety_id: string
          partie_plante: PartiePlante
          type: 'entree' | 'sortie'
          date: string
          poids_g: number
          temps_min: number | null
          commentaire: string | null
          created_by: string | null
          updated_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          farm_id?: string
          uuid_client?: string | null
          variety_id: string
          partie_plante: PartiePlante
          type: 'entree' | 'sortie'
          date: string
          poids_g: number
          temps_min?: number | null
          commentaire?: string | null
          created_by?: string | null
          updated_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          farm_id?: string
          uuid_client?: string | null
          variety_id?: string
          partie_plante?: PartiePlante
          type?: 'entree' | 'sortie'
          date?: string
          poids_g?: number
          temps_min?: number | null
          commentaire?: string | null
          created_by?: string | null
          updated_by?: string | null
          created_at?: string
        }
        Relationships: []
      }

      dryings: {
        Row: {
          id: string
          farm_id: string
          uuid_client: string | null
          variety_id: string
          partie_plante: PartiePlante
          type: 'entree' | 'sortie'
          etat_plante: string
          date: string
          poids_g: number
          temps_min: number | null
          commentaire: string | null
          deleted_at: string | null
          created_by: string | null
          updated_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          farm_id?: string
          uuid_client?: string | null
          variety_id: string
          partie_plante: PartiePlante
          type: 'entree' | 'sortie'
          etat_plante: string
          date: string
          poids_g: number
          temps_min?: number | null
          commentaire?: string | null
          deleted_at?: string | null
          created_by?: string | null
          updated_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          farm_id?: string
          uuid_client?: string | null
          variety_id?: string
          partie_plante?: PartiePlante
          type?: 'entree' | 'sortie'
          etat_plante?: string
          date?: string
          poids_g?: number
          temps_min?: number | null
          commentaire?: string | null
          deleted_at?: string | null
          created_by?: string | null
          updated_by?: string | null
          created_at?: string
        }
        Relationships: []
      }

      sortings: {
        Row: {
          id: string
          farm_id: string
          uuid_client: string | null
          variety_id: string
          partie_plante: PartiePlante
          type: 'entree' | 'sortie'
          etat_plante: string
          date: string
          poids_g: number
          temps_min: number | null
          commentaire: string | null
          deleted_at: string | null
          created_by: string | null
          updated_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          farm_id?: string
          uuid_client?: string | null
          variety_id: string
          partie_plante: PartiePlante
          type: 'entree' | 'sortie'
          etat_plante: string
          date: string
          poids_g: number
          temps_min?: number | null
          commentaire?: string | null
          deleted_at?: string | null
          created_by?: string | null
          updated_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          farm_id?: string
          uuid_client?: string | null
          variety_id?: string
          partie_plante?: PartiePlante
          type?: 'entree' | 'sortie'
          etat_plante?: string
          date?: string
          poids_g?: number
          temps_min?: number | null
          commentaire?: string | null
          deleted_at?: string | null
          created_by?: string | null
          updated_by?: string | null
          created_at?: string
        }
        Relationships: []
      }

      // ──────────────────────────────────────────────────────────────
      // 5. STOCK (event-sourced)
      // ──────────────────────────────────────────────────────────────

      stock_movements: {
        Row: {
          id: string
          farm_id: string
          variety_id: string
          partie_plante: PartiePlante
          date: string
          type_mouvement: 'entree' | 'sortie'
          etat_plante: string
          poids_g: number
          source_type: string
          source_id: string | null
          commentaire: string | null
          deleted_at: string | null
          // pas de updated_by — les mouvements sont immuables
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          farm_id?: string
          variety_id: string
          partie_plante: PartiePlante
          date: string
          type_mouvement: 'entree' | 'sortie'
          etat_plante: string
          poids_g: number
          source_type: string
          source_id?: string | null
          commentaire?: string | null
          deleted_at?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          farm_id?: string
          variety_id?: string
          partie_plante?: PartiePlante
          date?: string
          type_mouvement?: 'entree' | 'sortie'
          etat_plante?: string
          poids_g?: number
          source_type?: string
          source_id?: string | null
          commentaire?: string | null
          deleted_at?: string | null
          created_by?: string | null
          created_at?: string
        }
        Relationships: []
      }

      stock_purchases: {
        Row: {
          id: string
          farm_id: string
          uuid_client: string | null
          variety_id: string
          partie_plante: PartiePlante
          date: string
          etat_plante: string
          poids_g: number
          fournisseur: string
          numero_lot_fournisseur: string | null
          certif_ab: boolean
          prix: number | null
          commentaire: string | null
          created_by: string | null
          updated_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          farm_id?: string
          uuid_client?: string | null
          variety_id: string
          partie_plante: PartiePlante
          date: string
          etat_plante: string
          poids_g: number
          fournisseur: string
          numero_lot_fournisseur?: string | null
          certif_ab?: boolean
          prix?: number | null
          commentaire?: string | null
          created_by?: string | null
          updated_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          farm_id?: string
          uuid_client?: string | null
          variety_id?: string
          partie_plante?: PartiePlante
          date?: string
          etat_plante?: string
          poids_g?: number
          fournisseur?: string
          numero_lot_fournisseur?: string | null
          certif_ab?: boolean
          prix?: number | null
          commentaire?: string | null
          created_by?: string | null
          updated_by?: string | null
          created_at?: string
        }
        Relationships: []
      }

      stock_direct_sales: {
        Row: {
          id: string
          farm_id: string
          uuid_client: string | null
          variety_id: string
          partie_plante: PartiePlante
          date: string
          etat_plante: string
          poids_g: number
          destinataire: string | null
          commentaire: string | null
          created_by: string | null
          updated_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          farm_id?: string
          uuid_client?: string | null
          variety_id: string
          partie_plante: PartiePlante
          date: string
          etat_plante: string
          poids_g: number
          destinataire?: string | null
          commentaire?: string | null
          created_by?: string | null
          updated_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          farm_id?: string
          uuid_client?: string | null
          variety_id?: string
          partie_plante?: PartiePlante
          date?: string
          etat_plante?: string
          poids_g?: number
          destinataire?: string | null
          commentaire?: string | null
          created_by?: string | null
          updated_by?: string | null
          created_at?: string
        }
        Relationships: []
      }

      stock_adjustments: {
        Row: {
          id: string
          farm_id: string
          uuid_client: string | null
          variety_id: string
          partie_plante: PartiePlante
          date: string
          type_mouvement: 'entree' | 'sortie'
          etat_plante: string
          poids_g: number
          motif: string
          created_by: string | null
          updated_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          farm_id?: string
          uuid_client?: string | null
          variety_id: string
          partie_plante: PartiePlante
          date: string
          type_mouvement: 'entree' | 'sortie'
          etat_plante: string
          poids_g: number
          motif: string
          created_by?: string | null
          updated_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          farm_id?: string
          uuid_client?: string | null
          variety_id?: string
          partie_plante?: PartiePlante
          date?: string
          type_mouvement?: 'entree' | 'sortie'
          etat_plante?: string
          poids_g?: number
          motif?: string
          created_by?: string | null
          updated_by?: string | null
          created_at?: string
        }
        Relationships: []
      }

      // ──────────────────────────────────────────────────────────────
      // 6. PRODUITS
      // ──────────────────────────────────────────────────────────────

      product_categories: {
        Row: {
          id: string
          nom: string
          // champs catalogue multi-tenant (migration 011)
          created_by_farm_id: string | null
          created_by: string | null
          updated_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          nom: string
          created_by_farm_id?: string | null
          created_by?: string | null
          updated_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          nom?: string
          created_by_farm_id?: string | null
          created_by?: string | null
          updated_by?: string | null
          created_at?: string
        }
        Relationships: []
      }

      recipes: {
        Row: {
          id: string
          farm_id: string
          category_id: string | null
          nom: string
          numero_tisane: string | null
          poids_sachet_g: number
          description: string | null
          actif: boolean
          deleted_at: string | null
          created_by: string | null
          updated_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          farm_id?: string
          category_id?: string | null
          nom: string
          numero_tisane?: string | null
          poids_sachet_g: number
          description?: string | null
          actif?: boolean
          deleted_at?: string | null
          created_by?: string | null
          updated_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          farm_id?: string
          category_id?: string | null
          nom?: string
          numero_tisane?: string | null
          poids_sachet_g?: number
          description?: string | null
          actif?: boolean
          deleted_at?: string | null
          created_by?: string | null
          updated_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }

      recipe_ingredients: {
        Row: {
          id: string
          farm_id: string
          recipe_id: string | null
          variety_id: string | null
          external_material_id: string | null
          etat_plante: string | null
          partie_plante: PartiePlante | null
          pourcentage: number
          ordre: number | null
          created_at: string
        }
        Insert: {
          id?: string
          farm_id?: string
          recipe_id?: string | null
          variety_id?: string | null
          external_material_id?: string | null
          etat_plante?: string | null
          partie_plante?: PartiePlante | null
          pourcentage: number
          ordre?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          farm_id?: string
          recipe_id?: string | null
          variety_id?: string | null
          external_material_id?: string | null
          etat_plante?: string | null
          partie_plante?: PartiePlante | null
          pourcentage?: number
          ordre?: number | null
          created_at?: string
        }
        Relationships: []
      }

      production_lots: {
        Row: {
          id: string
          farm_id: string
          uuid_client: string | null
          recipe_id: string | null
          numero_lot: string
          date_production: string
          ddm: string
          nb_unites: number
          poids_total_g: number
          temps_min: number | null
          commentaire: string | null
          deleted_at: string | null
          created_by: string | null
          updated_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          farm_id?: string
          uuid_client?: string | null
          recipe_id?: string | null
          numero_lot: string
          date_production: string
          ddm: string
          nb_unites: number
          poids_total_g: number
          temps_min?: number | null
          commentaire?: string | null
          deleted_at?: string | null
          created_by?: string | null
          updated_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          farm_id?: string
          uuid_client?: string | null
          recipe_id?: string | null
          numero_lot?: string
          date_production?: string
          ddm?: string
          nb_unites?: number
          poids_total_g?: number
          temps_min?: number | null
          commentaire?: string | null
          deleted_at?: string | null
          created_by?: string | null
          updated_by?: string | null
          created_at?: string
        }
        Relationships: []
      }

      production_lot_ingredients: {
        Row: {
          id: string
          farm_id: string
          production_lot_id: string | null
          variety_id: string | null
          external_material_id: string | null
          etat_plante: string | null
          partie_plante: PartiePlante | null
          pourcentage: number
          poids_g: number
          annee_recolte: number | null
          fournisseur: string | null
          created_at: string
        }
        Insert: {
          id?: string
          farm_id?: string
          production_lot_id?: string | null
          variety_id?: string | null
          external_material_id?: string | null
          etat_plante?: string | null
          partie_plante?: PartiePlante | null
          pourcentage: number
          poids_g: number
          annee_recolte?: number | null
          fournisseur?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          farm_id?: string
          production_lot_id?: string | null
          variety_id?: string | null
          external_material_id?: string | null
          etat_plante?: string | null
          partie_plante?: PartiePlante | null
          pourcentage?: number
          poids_g?: number
          annee_recolte?: number | null
          fournisseur?: string | null
          created_at?: string
        }
        Relationships: []
      }

      product_stock_movements: {
        Row: {
          id: string
          farm_id: string
          production_lot_id: string | null
          date: string
          type_mouvement: 'entree' | 'sortie'
          quantite: number
          commentaire: string | null
          created_by: string | null
          updated_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          farm_id?: string
          production_lot_id?: string | null
          date: string
          type_mouvement: 'entree' | 'sortie'
          quantite: number
          commentaire?: string | null
          created_by?: string | null
          updated_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          farm_id?: string
          production_lot_id?: string | null
          date?: string
          type_mouvement?: 'entree' | 'sortie'
          quantite?: number
          commentaire?: string | null
          created_by?: string | null
          updated_by?: string | null
          created_at?: string
        }
        Relationships: []
      }

      // ──────────────────────────────────────────────────────────────
      // 7. PRÉVISIONS
      // ──────────────────────────────────────────────────────────────

      forecasts: {
        Row: {
          id: string
          farm_id: string
          annee: number
          variety_id: string
          etat_plante: string
          partie_plante: PartiePlante | null
          quantite_prevue_g: number | null
          commentaire: string | null
          created_by: string | null
          updated_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          farm_id?: string
          annee: number
          variety_id: string
          etat_plante: string
          partie_plante?: PartiePlante | null
          quantite_prevue_g?: number | null
          commentaire?: string | null
          created_by?: string | null
          updated_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          farm_id?: string
          annee?: number
          variety_id?: string
          etat_plante?: string
          partie_plante?: PartiePlante | null
          quantite_prevue_g?: number | null
          commentaire?: string | null
          created_by?: string | null
          updated_by?: string | null
          created_at?: string
        }
        Relationships: []
      }

      // ──────────────────────────────────────────────────────────────
      // 8. AGRÉGAT
      // ──────────────────────────────────────────────────────────────

      production_summary: {
        Row: {
          id: string
          farm_id: string
          variety_id: string
          annee: number
          mois: number | null
          total_cueilli_g: number
          total_tronconnee_g: number
          total_sechee_g: number
          total_triee_g: number
          total_utilise_production_g: number
          total_vendu_direct_g: number
          total_achete_g: number
          temps_cueillette_min: number
          temps_tronconnage_min: number
          temps_sechage_min: number
          temps_triage_min: number
          temps_production_min: number
          // pas de created_by/updated_by — table agrégat maintenue par triggers
          updated_at: string
        }
        Insert: {
          id?: string
          farm_id?: string
          variety_id: string
          annee: number
          mois?: number | null
          total_cueilli_g?: number
          total_tronconnee_g?: number
          total_sechee_g?: number
          total_triee_g?: number
          total_utilise_production_g?: number
          total_vendu_direct_g?: number
          total_achete_g?: number
          temps_cueillette_min?: number
          temps_tronconnage_min?: number
          temps_sechage_min?: number
          temps_triage_min?: number
          temps_production_min?: number
          updated_at?: string
        }
        Update: {
          id?: string
          farm_id?: string
          variety_id?: string
          annee?: number
          mois?: number | null
          total_cueilli_g?: number
          total_tronconnee_g?: number
          total_sechee_g?: number
          total_triee_g?: number
          total_utilise_production_g?: number
          total_vendu_direct_g?: number
          total_achete_g?: number
          temps_cueillette_min?: number
          temps_tronconnage_min?: number
          temps_sechage_min?: number
          temps_triage_min?: number
          temps_production_min?: number
          updated_at?: string
        }
        Relationships: []
      }

      // ──────────────────────────────────────────────────────────────
      // 9. LOGS
      // ──────────────────────────────────────────────────────────────

      app_logs: {
        Row: {
          id: string
          farm_id: string
          level: 'info' | 'warn' | 'error'
          source: string
          message: string
          metadata: Record<string, unknown> | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          farm_id?: string
          level: 'info' | 'warn' | 'error'
          source: string
          message: string
          metadata?: Record<string, unknown> | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          farm_id?: string
          level?: 'info' | 'warn' | 'error'
          source?: string
          message?: string
          metadata?: Record<string, unknown> | null
          created_by?: string | null
          created_at?: string
        }
        Relationships: []
      }
    }

    Views: {
      // Vue v_stock — stock calculé en temps réel par ferme × variété × partie × état
      v_stock: {
        Row: {
          farm_id: string
          variety_id: string
          partie_plante: string
          etat_plante: string
          stock_g: number
        }
        Relationships: []
      }
    }
    Functions: {
      /** Cree un harvest + stock_movement d'entree (frais) dans une seule transaction */
      create_harvest_with_stock: {
        Args: {
          p_farm_id: string
          p_uuid_client: string | null
          p_type_cueillette: string
          p_row_id: string | null
          p_lieu_sauvage: string | null
          p_variety_id: string
          p_partie_plante: string
          p_date: string
          p_poids_g: number
          p_temps_min: number | null
          p_commentaire: string | null
          p_created_by: string
        }
        Returns: string
      }
      /** Met a jour un harvest + son stock_movement dans une seule transaction */
      update_harvest_with_stock: {
        Args: {
          p_harvest_id: string
          p_type_cueillette: string
          p_row_id: string | null
          p_lieu_sauvage: string | null
          p_variety_id: string
          p_partie_plante: string
          p_date: string
          p_poids_g: number
          p_temps_min: number | null
          p_commentaire: string | null
          p_updated_by: string
        }
        Returns: undefined
      }
      /** Cree un cutting + stock_movement dans une seule transaction */
      create_cutting_with_stock: {
        Args: {
          p_farm_id: string
          p_variety_id: string
          p_partie_plante: string
          p_type: string
          p_date: string
          p_poids_g: number
          p_temps_min: number | null
          p_commentaire: string | null
          p_created_by: string
          p_uuid_client: string | null
        }
        Returns: string
      }
      /** Met a jour un cutting + son stock_movement dans une seule transaction */
      update_cutting_with_stock: {
        Args: {
          p_cutting_id: string
          p_variety_id: string
          p_partie_plante: string
          p_date: string
          p_poids_g: number
          p_temps_min: number | null
          p_commentaire: string | null
          p_updated_by: string
        }
        Returns: undefined
      }
      /** Supprime un cutting + son stock_movement dans une seule transaction */
      delete_cutting_with_stock: {
        Args: {
          p_cutting_id: string
        }
        Returns: undefined
      }
      /** Cree un drying + stock_movement dans une seule transaction */
      create_drying_with_stock: {
        Args: {
          p_farm_id: string
          p_variety_id: string
          p_partie_plante: string
          p_type: string
          p_etat_plante: string
          p_date: string
          p_poids_g: number
          p_temps_min: number | null
          p_commentaire: string | null
          p_created_by: string
          p_uuid_client: string | null
        }
        Returns: string
      }
      /** Met a jour un drying + son stock_movement dans une seule transaction */
      update_drying_with_stock: {
        Args: {
          p_drying_id: string
          p_variety_id: string
          p_partie_plante: string
          p_etat_plante: string
          p_date: string
          p_poids_g: number
          p_temps_min: number | null
          p_commentaire: string | null
          p_updated_by: string
        }
        Returns: undefined
      }
      /** Supprime un drying + son stock_movement dans une seule transaction */
      delete_drying_with_stock: {
        Args: {
          p_drying_id: string
        }
        Returns: undefined
      }
      /** Cree un sorting + stock_movement dans une seule transaction */
      create_sorting_with_stock: {
        Args: {
          p_farm_id: string
          p_variety_id: string
          p_partie_plante: string
          p_type: string
          p_etat_plante: string
          p_date: string
          p_poids_g: number
          p_temps_min: number | null
          p_commentaire: string | null
          p_created_by: string
          p_uuid_client: string | null
        }
        Returns: string
      }
      /** Met a jour un sorting + son stock_movement dans une seule transaction */
      update_sorting_with_stock: {
        Args: {
          p_sorting_id: string
          p_variety_id: string
          p_partie_plante: string
          p_etat_plante: string
          p_date: string
          p_poids_g: number
          p_temps_min: number | null
          p_commentaire: string | null
          p_updated_by: string
        }
        Returns: undefined
      }
      /** Supprime un sorting + son stock_movement dans une seule transaction */
      delete_sorting_with_stock: {
        Args: {
          p_sorting_id: string
        }
        Returns: undefined
      }

      // ── Affinage du stock : Achats ──

      /** Cree un achat + stock_movement d'entree dans une seule transaction */
      create_purchase_with_stock: {
        Args: {
          p_farm_id: string
          p_variety_id: string
          p_partie_plante: string
          p_date: string
          p_etat_plante: string
          p_poids_g: number
          p_fournisseur: string
          p_numero_lot_fournisseur: string | null
          p_certif_ab: boolean
          p_prix: number | null
          p_commentaire: string | null
          p_created_by: string
          p_uuid_client: string | null
        }
        Returns: string
      }
      /** Met a jour un achat + son stock_movement dans une seule transaction */
      update_purchase_with_stock: {
        Args: {
          p_purchase_id: string
          p_variety_id: string
          p_partie_plante: string
          p_date: string
          p_etat_plante: string
          p_poids_g: number
          p_fournisseur: string
          p_numero_lot_fournisseur: string | null
          p_certif_ab: boolean
          p_prix: number | null
          p_commentaire: string | null
          p_updated_by: string
        }
        Returns: undefined
      }
      /** Supprime un achat + son stock_movement dans une seule transaction */
      delete_purchase_with_stock: {
        Args: {
          p_purchase_id: string
          p_farm_id: string
        }
        Returns: undefined
      }

      // ── Affinage du stock : Ventes directes ──

      /** Cree une vente directe + stock_movement de sortie dans une seule transaction */
      create_direct_sale_with_stock: {
        Args: {
          p_farm_id: string
          p_variety_id: string
          p_partie_plante: string
          p_date: string
          p_etat_plante: string
          p_poids_g: number
          p_destinataire: string | null
          p_commentaire: string | null
          p_created_by: string
          p_uuid_client: string | null
        }
        Returns: string
      }
      /** Met a jour une vente directe + son stock_movement dans une seule transaction */
      update_direct_sale_with_stock: {
        Args: {
          p_sale_id: string
          p_variety_id: string
          p_partie_plante: string
          p_date: string
          p_etat_plante: string
          p_poids_g: number
          p_destinataire: string | null
          p_commentaire: string | null
          p_updated_by: string
        }
        Returns: undefined
      }
      /** Supprime une vente directe + son stock_movement dans une seule transaction */
      delete_direct_sale_with_stock: {
        Args: {
          p_sale_id: string
          p_farm_id: string
        }
        Returns: undefined
      }

      // ── Affinage du stock : Ajustements ──

      /** Cree un ajustement + stock_movement dans une seule transaction */
      create_adjustment_with_stock: {
        Args: {
          p_farm_id: string
          p_variety_id: string
          p_partie_plante: string
          p_date: string
          p_type_mouvement: string
          p_etat_plante: string
          p_poids_g: number
          p_motif: string
          p_commentaire: string | null
          p_created_by: string
          p_uuid_client: string | null
        }
        Returns: string
      }
      /** Met a jour un ajustement + son stock_movement dans une seule transaction */
      update_adjustment_with_stock: {
        Args: {
          p_adjustment_id: string
          p_variety_id: string
          p_partie_plante: string
          p_date: string
          p_type_mouvement: string
          p_etat_plante: string
          p_poids_g: number
          p_motif: string
          p_commentaire: string | null
          p_updated_by: string
        }
        Returns: undefined
      }
      /** Supprime un ajustement + son stock_movement dans une seule transaction */
      delete_adjustment_with_stock: {
        Args: {
          p_adjustment_id: string
          p_farm_id: string
        }
        Returns: undefined
      }
    }
    Enums: Record<string, never>
  }
}
