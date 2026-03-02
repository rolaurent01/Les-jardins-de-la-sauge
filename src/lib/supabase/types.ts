/**
 * Types Supabase — schéma complet de l'appli LJS.
 *
 * Ce fichier est écrit manuellement pour correspondre aux migrations SQL.
 * Pour régénérer depuis Supabase CLI (recommandé si le schéma évolue) :
 *   npx supabase gen types typescript --project-id <project-id> > src/lib/supabase/types.ts
 *
 * Inclut les colonnes ajoutées par la migration 002 (deleted_at sur
 * sites, parcels, rows, external_materials) et la migration 004
 * (partie_plante sur toutes les tables de stock et transformation,
 * parties_utilisees sur varieties).
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
      // 1. RÉFÉRENTIEL
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
          seuil_alerte_g: number | null
          notes: string | null
          deleted_at: string | null
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
          seuil_alerte_g?: number | null
          notes?: string | null
          deleted_at?: string | null
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
          seuil_alerte_g?: number | null
          notes?: string | null
          deleted_at?: string | null
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
          created_at: string
        }
        Insert: {
          id?: string
          nom: string
          unite?: string
          notes?: string | null
          deleted_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          nom?: string
          unite?: string
          notes?: string | null
          deleted_at?: string | null
          created_at?: string
        }
        Relationships: []
      }

      sites: {
        Row: {
          id: string
          nom: string
          description: string | null
          deleted_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          nom: string
          description?: string | null
          deleted_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          nom?: string
          description?: string | null
          deleted_at?: string | null
          created_at?: string
        }
        Relationships: []
      }

      parcels: {
        Row: {
          id: string
          site_id: string | null
          nom: string
          code: string
          orientation: string | null
          description: string | null
          deleted_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          site_id?: string | null
          nom: string
          code: string
          orientation?: string | null
          description?: string | null
          deleted_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          site_id?: string | null
          nom?: string
          code?: string
          orientation?: string | null
          description?: string | null
          deleted_at?: string | null
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
          parcel_id: string | null
          numero: string
          ancien_numero: string | null
          longueur_m: number | null
          largeur_m: number | null
          position_ordre: number | null
          notes: string | null
          deleted_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          parcel_id?: string | null
          numero: string
          ancien_numero?: string | null
          longueur_m?: number | null
          largeur_m?: number | null
          position_ordre?: number | null
          notes?: string | null
          deleted_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          parcel_id?: string | null
          numero?: string
          ancien_numero?: string | null
          longueur_m?: number | null
          largeur_m?: number | null
          position_ordre?: number | null
          notes?: string | null
          deleted_at?: string | null
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
          uuid_client: string | null
          lot_interne: string
          variety_id: string | null
          fournisseur: string | null
          numero_lot_fournisseur: string | null
          date_achat: string | null
          date_facture: string | null
          numero_facture: string | null
          poids_sachet_g: number | null
          certif_ab: boolean
          commentaire: string | null
          deleted_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          uuid_client?: string | null
          lot_interne: string
          variety_id?: string | null
          fournisseur?: string | null
          numero_lot_fournisseur?: string | null
          date_achat?: string | null
          date_facture?: string | null
          numero_facture?: string | null
          poids_sachet_g?: number | null
          certif_ab?: boolean
          commentaire?: string | null
          deleted_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          uuid_client?: string | null
          lot_interne?: string
          variety_id?: string | null
          fournisseur?: string | null
          numero_lot_fournisseur?: string | null
          date_achat?: string | null
          date_facture?: string | null
          numero_facture?: string | null
          poids_sachet_g?: number | null
          certif_ab?: boolean
          commentaire?: string | null
          deleted_at?: string | null
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
          date_semis: string | null
          poids_graines_utilise_g: number | null
          date_levee: string | null
          date_repiquage: string | null
          temps_semis_min: number | null
          temps_repiquage_min: number | null
          commentaire: string | null
          deleted_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
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
          date_semis?: string | null
          poids_graines_utilise_g?: number | null
          date_levee?: string | null
          date_repiquage?: string | null
          temps_semis_min?: number | null
          temps_repiquage_min?: number | null
          commentaire?: string | null
          deleted_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
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
          date_semis?: string | null
          poids_graines_utilise_g?: number | null
          date_levee?: string | null
          date_repiquage?: string | null
          temps_semis_min?: number | null
          temps_repiquage_min?: number | null
          commentaire?: string | null
          deleted_at?: string | null
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
          uuid_client: string | null
          row_id: string | null
          date: string
          type_travail: 'depaillage' | 'motoculteur' | 'amendement' | 'autre' | null
          detail: string | null
          temps_min: number | null
          commentaire: string | null
          created_at: string
        }
        Insert: {
          id?: string
          uuid_client?: string | null
          row_id?: string | null
          date: string
          type_travail?: 'depaillage' | 'motoculteur' | 'amendement' | 'autre' | null
          detail?: string | null
          temps_min?: number | null
          commentaire?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          uuid_client?: string | null
          row_id?: string | null
          date?: string
          type_travail?: 'depaillage' | 'motoculteur' | 'amendement' | 'autre' | null
          detail?: string | null
          temps_min?: number | null
          commentaire?: string | null
          created_at?: string
        }
        Relationships: []
      }

      plantings: {
        Row: {
          id: string
          uuid_client: string | null
          row_id: string | null
          variety_id: string | null
          seedling_id: string | null
          fournisseur: string | null
          annee: number
          date_plantation: string | null
          nb_plants: number | null
          type_plant:
            | 'mini_motte' | 'godet' | 'caissette'
            | 'achat_godets' | 'repiquage_pleine_terre'
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
          created_at: string
        }
        Insert: {
          id?: string
          uuid_client?: string | null
          row_id?: string | null
          variety_id?: string | null
          seedling_id?: string | null
          fournisseur?: string | null
          annee: number
          date_plantation?: string | null
          nb_plants?: number | null
          type_plant?:
            | 'mini_motte' | 'godet' | 'caissette'
            | 'achat_godets' | 'repiquage_pleine_terre'
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
          created_at?: string
        }
        Update: {
          id?: string
          uuid_client?: string | null
          row_id?: string | null
          variety_id?: string | null
          seedling_id?: string | null
          fournisseur?: string | null
          annee?: number
          date_plantation?: string | null
          nb_plants?: number | null
          type_plant?:
            | 'mini_motte' | 'godet' | 'caissette'
            | 'achat_godets' | 'repiquage_pleine_terre'
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
          created_at?: string
        }
        Relationships: []
      }

      row_care: {
        Row: {
          id: string
          uuid_client: string | null
          row_id: string | null
          variety_id: string
          date: string
          type_soin: 'desherbage' | 'paillage' | 'arrosage' | 'autre' | null
          temps_min: number | null
          commentaire: string | null
          created_at: string
        }
        Insert: {
          id?: string
          uuid_client?: string | null
          row_id?: string | null
          variety_id: string
          date: string
          type_soin?: 'desherbage' | 'paillage' | 'arrosage' | 'autre' | null
          temps_min?: number | null
          commentaire?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          uuid_client?: string | null
          row_id?: string | null
          variety_id?: string
          date?: string
          type_soin?: 'desherbage' | 'paillage' | 'arrosage' | 'autre' | null
          temps_min?: number | null
          commentaire?: string | null
          created_at?: string
        }
        Relationships: []
      }

      harvests: {
        Row: {
          id: string
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
          created_at: string
        }
        Insert: {
          id?: string
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
          created_at?: string
        }
        Update: {
          id?: string
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
          created_at?: string
        }
        Relationships: []
      }

      uprootings: {
        Row: {
          id: string
          uuid_client: string | null
          row_id: string
          variety_id: string | null
          date: string
          temps_min: number | null
          commentaire: string | null
          created_at: string
        }
        Insert: {
          id?: string
          uuid_client?: string | null
          row_id: string
          variety_id?: string | null
          date: string
          temps_min?: number | null
          commentaire?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          uuid_client?: string | null
          row_id?: string
          variety_id?: string | null
          date?: string
          temps_min?: number | null
          commentaire?: string | null
          created_at?: string
        }
        Relationships: []
      }

      occultations: {
        Row: {
          id: string
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
          created_at: string
        }
        Insert: {
          id?: string
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
          created_at?: string
        }
        Update: {
          id?: string
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
          uuid_client: string | null
          variety_id: string
          partie_plante: PartiePlante
          type: 'entree' | 'sortie'
          date: string
          poids_g: number
          temps_min: number | null
          commentaire: string | null
          created_at: string
        }
        Insert: {
          id?: string
          uuid_client?: string | null
          variety_id: string
          partie_plante: PartiePlante
          type: 'entree' | 'sortie'
          date: string
          poids_g: number
          temps_min?: number | null
          commentaire?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          uuid_client?: string | null
          variety_id?: string
          partie_plante?: PartiePlante
          type?: 'entree' | 'sortie'
          date?: string
          poids_g?: number
          temps_min?: number | null
          commentaire?: string | null
          created_at?: string
        }
        Relationships: []
      }

      dryings: {
        Row: {
          id: string
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
          created_at: string
        }
        Insert: {
          id?: string
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
          created_at?: string
        }
        Update: {
          id?: string
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
          created_at?: string
        }
        Relationships: []
      }

      sortings: {
        Row: {
          id: string
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
          created_at: string
        }
        Insert: {
          id?: string
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
          created_at?: string
        }
        Update: {
          id?: string
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
          created_at: string
        }
        Insert: {
          id?: string
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
          created_at?: string
        }
        Update: {
          id?: string
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
          created_at?: string
        }
        Relationships: []
      }

      stock_purchases: {
        Row: {
          id: string
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
          created_at: string
        }
        Insert: {
          id?: string
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
          created_at?: string
        }
        Update: {
          id?: string
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
          created_at?: string
        }
        Relationships: []
      }

      stock_direct_sales: {
        Row: {
          id: string
          uuid_client: string | null
          variety_id: string
          partie_plante: PartiePlante
          date: string
          etat_plante: string
          poids_g: number
          destinataire: string | null
          commentaire: string | null
          created_at: string
        }
        Insert: {
          id?: string
          uuid_client?: string | null
          variety_id: string
          partie_plante: PartiePlante
          date: string
          etat_plante: string
          poids_g: number
          destinataire?: string | null
          commentaire?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          uuid_client?: string | null
          variety_id?: string
          partie_plante?: PartiePlante
          date?: string
          etat_plante?: string
          poids_g?: number
          destinataire?: string | null
          commentaire?: string | null
          created_at?: string
        }
        Relationships: []
      }

      stock_adjustments: {
        Row: {
          id: string
          uuid_client: string | null
          variety_id: string
          partie_plante: PartiePlante
          date: string
          type_mouvement: 'entree' | 'sortie'
          etat_plante: string
          poids_g: number
          motif: string
          created_at: string
        }
        Insert: {
          id?: string
          uuid_client?: string | null
          variety_id: string
          partie_plante: PartiePlante
          date: string
          type_mouvement: 'entree' | 'sortie'
          etat_plante: string
          poids_g: number
          motif: string
          created_at?: string
        }
        Update: {
          id?: string
          uuid_client?: string | null
          variety_id?: string
          partie_plante?: PartiePlante
          date?: string
          type_mouvement?: 'entree' | 'sortie'
          etat_plante?: string
          poids_g?: number
          motif?: string
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
          created_at: string
        }
        Insert: {
          id?: string
          nom: string
          created_at?: string
        }
        Update: {
          id?: string
          nom?: string
          created_at?: string
        }
        Relationships: []
      }

      recipes: {
        Row: {
          id: string
          category_id: string | null
          nom: string
          numero_tisane: string | null
          poids_sachet_g: number
          description: string | null
          actif: boolean
          deleted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          category_id?: string | null
          nom: string
          numero_tisane?: string | null
          poids_sachet_g: number
          description?: string | null
          actif?: boolean
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          category_id?: string | null
          nom?: string
          numero_tisane?: string | null
          poids_sachet_g?: number
          description?: string | null
          actif?: boolean
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }

      recipe_ingredients: {
        Row: {
          id: string
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
          created_at: string
        }
        Insert: {
          id?: string
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
          created_at?: string
        }
        Update: {
          id?: string
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
          created_at?: string
        }
        Relationships: []
      }

      production_lot_ingredients: {
        Row: {
          id: string
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
          production_lot_id: string | null
          date: string
          type_mouvement: 'entree' | 'sortie'
          quantite: number
          commentaire: string | null
          created_at: string
        }
        Insert: {
          id?: string
          production_lot_id?: string | null
          date: string
          type_mouvement: 'entree' | 'sortie'
          quantite: number
          commentaire?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          production_lot_id?: string | null
          date?: string
          type_mouvement?: 'entree' | 'sortie'
          quantite?: number
          commentaire?: string | null
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
          annee: number
          variety_id: string
          etat_plante: string
          partie_plante: PartiePlante | null
          quantite_prevue_g: number | null
          commentaire: string | null
          created_at: string
        }
        Insert: {
          id?: string
          annee: number
          variety_id: string
          etat_plante: string
          partie_plante?: PartiePlante | null
          quantite_prevue_g?: number | null
          commentaire?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          annee?: number
          variety_id?: string
          etat_plante?: string
          partie_plante?: PartiePlante | null
          quantite_prevue_g?: number | null
          commentaire?: string | null
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
          updated_at: string
        }
        Insert: {
          id?: string
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
          level: 'info' | 'warn' | 'error'
          source: string
          message: string
          metadata: Record<string, unknown> | null
          created_at: string
        }
        Insert: {
          id?: string
          level: 'info' | 'warn' | 'error'
          source: string
          message: string
          metadata?: Record<string, unknown> | null
          created_at?: string
        }
        Update: {
          id?: string
          level?: 'info' | 'warn' | 'error'
          source?: string
          message?: string
          metadata?: Record<string, unknown> | null
          created_at?: string
        }
        Relationships: []
      }
    }

    Views: {
      // Vue v_stock — stock calculé en temps réel par variété × partie × état
      v_stock: {
        Row: {
          variety_id: string
          nom_vernaculaire: string
          partie_plante: PartiePlante
          etat_plante: string
          stock_g: number | null
        }
        Relationships: []
      }
    }
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
