export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      app_logs: {
        Row: {
          created_at: string | null
          id: string
          level: string
          message: string
          metadata: Json | null
          source: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          level: string
          message: string
          metadata?: Json | null
          source: string
        }
        Update: {
          created_at?: string | null
          id?: string
          level?: string
          message?: string
          metadata?: Json | null
          source?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          created_at: string | null
          farm_id: string | null
          id: string
          new_data: Json | null
          old_data: Json | null
          record_id: string
          table_name: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string | null
          farm_id?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id: string
          table_name: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string | null
          farm_id?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string
          table_name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
        ]
      }
      boutures: {
        Row: {
          certif_ab: boolean | null
          commentaire: string | null
          created_at: string | null
          created_by: string | null
          date_bouturage: string
          date_mise_en_plaque: string | null
          date_rempotage: string | null
          deleted_at: string | null
          farm_id: string
          id: string
          nb_donnees: number | null
          nb_godets: number | null
          nb_mortes_godet: number | null
          nb_mortes_plaque: number | null
          nb_plants_obtenus: number | null
          nb_plaques: number | null
          nb_trous_par_plaque: number | null
          origine: string | null
          statut: string
          temps_bouturage_min: number | null
          temps_rempotage_min: number | null
          type_multiplication: string
          updated_by: string | null
          uuid_client: string | null
          variety_id: string | null
        }
        Insert: {
          certif_ab?: boolean | null
          commentaire?: string | null
          created_at?: string | null
          created_by?: string | null
          date_bouturage: string
          date_mise_en_plaque?: string | null
          date_rempotage?: string | null
          deleted_at?: string | null
          farm_id: string
          id?: string
          nb_donnees?: number | null
          nb_godets?: number | null
          nb_mortes_godet?: number | null
          nb_mortes_plaque?: number | null
          nb_plants_obtenus?: number | null
          nb_plaques?: number | null
          nb_trous_par_plaque?: number | null
          origine?: string | null
          statut?: string
          temps_bouturage_min?: number | null
          temps_rempotage_min?: number | null
          type_multiplication: string
          updated_by?: string | null
          uuid_client?: string | null
          variety_id?: string | null
        }
        Update: {
          certif_ab?: boolean | null
          commentaire?: string | null
          created_at?: string | null
          created_by?: string | null
          date_bouturage?: string
          date_mise_en_plaque?: string | null
          date_rempotage?: string | null
          deleted_at?: string | null
          farm_id?: string
          id?: string
          nb_donnees?: number | null
          nb_godets?: number | null
          nb_mortes_godet?: number | null
          nb_mortes_plaque?: number | null
          nb_plants_obtenus?: number | null
          nb_plaques?: number | null
          nb_trous_par_plaque?: number | null
          origine?: string | null
          statut?: string
          temps_bouturage_min?: number | null
          temps_rempotage_min?: number | null
          type_multiplication?: string
          updated_by?: string | null
          uuid_client?: string | null
          variety_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "boutures_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boutures_variety_id_fkey"
            columns: ["variety_id"]
            isOneToOne: false
            referencedRelation: "varieties"
            referencedColumns: ["id"]
          },
        ]
      }
      changelog_entries: {
        Row: {
          created_at: string
          description: string
          id: string
          published: boolean
          title: string
          type: Database["public"]["Enums"]["changelog_entry_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          published?: boolean
          title: string
          type?: Database["public"]["Enums"]["changelog_entry_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          published?: boolean
          title?: string
          type?: Database["public"]["Enums"]["changelog_entry_type"]
          updated_at?: string
        }
        Relationships: []
      }
      changelog_reads: {
        Row: {
          entry_id: string
          id: string
          read_at: string
          user_id: string
        }
        Insert: {
          entry_id: string
          id?: string
          read_at?: string
          user_id: string
        }
        Update: {
          entry_id?: string
          id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "changelog_reads_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "changelog_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      conditionnements: {
        Row: {
          commentaire: string | null
          created_at: string | null
          created_by: string | null
          date_conditionnement: string
          ddm: string | null
          deleted_at: string | null
          farm_id: string
          id: string
          nb_unites: number
          numero_lot: string
          production_lot_id: string
          temps_min: number | null
          updated_by: string | null
        }
        Insert: {
          commentaire?: string | null
          created_at?: string | null
          created_by?: string | null
          date_conditionnement: string
          ddm?: string | null
          deleted_at?: string | null
          farm_id: string
          id?: string
          nb_unites: number
          numero_lot: string
          production_lot_id: string
          temps_min?: number | null
          updated_by?: string | null
        }
        Update: {
          commentaire?: string | null
          created_at?: string | null
          created_by?: string | null
          date_conditionnement?: string
          ddm?: string | null
          deleted_at?: string | null
          farm_id?: string
          id?: string
          nb_unites?: number
          numero_lot?: string
          production_lot_id?: string
          temps_min?: number | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conditionnements_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conditionnements_production_lot_id_fkey"
            columns: ["production_lot_id"]
            isOneToOne: false
            referencedRelation: "production_lots"
            referencedColumns: ["id"]
          },
        ]
      }
      cuttings: {
        Row: {
          commentaire: string | null
          created_at: string | null
          created_by: string | null
          date: string
          farm_id: string
          id: string
          paired_id: string | null
          partie_plante: string
          poids_g: number
          temps_min: number | null
          type: string
          updated_by: string | null
          uuid_client: string | null
          variety_id: string
        }
        Insert: {
          commentaire?: string | null
          created_at?: string | null
          created_by?: string | null
          date: string
          farm_id: string
          id?: string
          paired_id?: string | null
          partie_plante?: string
          poids_g: number
          temps_min?: number | null
          type: string
          updated_by?: string | null
          uuid_client?: string | null
          variety_id: string
        }
        Update: {
          commentaire?: string | null
          created_at?: string | null
          created_by?: string | null
          date?: string
          farm_id?: string
          id?: string
          paired_id?: string | null
          partie_plante?: string
          poids_g?: number
          temps_min?: number | null
          type?: string
          updated_by?: string | null
          uuid_client?: string | null
          variety_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cuttings_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cuttings_paired_id_fkey"
            columns: ["paired_id"]
            isOneToOne: false
            referencedRelation: "cuttings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cuttings_variety_id_fkey"
            columns: ["variety_id"]
            isOneToOne: false
            referencedRelation: "varieties"
            referencedColumns: ["id"]
          },
        ]
      }
      dryings: {
        Row: {
          commentaire: string | null
          created_at: string | null
          created_by: string | null
          date: string
          etat_plante: string
          farm_id: string
          id: string
          partie_plante: string
          poids_g: number
          temps_min: number | null
          type: string
          updated_by: string | null
          uuid_client: string | null
          variety_id: string
        }
        Insert: {
          commentaire?: string | null
          created_at?: string | null
          created_by?: string | null
          date: string
          etat_plante: string
          farm_id: string
          id?: string
          partie_plante?: string
          poids_g: number
          temps_min?: number | null
          type: string
          updated_by?: string | null
          uuid_client?: string | null
          variety_id: string
        }
        Update: {
          commentaire?: string | null
          created_at?: string | null
          created_by?: string | null
          date?: string
          etat_plante?: string
          farm_id?: string
          id?: string
          partie_plante?: string
          poids_g?: number
          temps_min?: number | null
          type?: string
          updated_by?: string | null
          uuid_client?: string | null
          variety_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dryings_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dryings_variety_id_fkey"
            columns: ["variety_id"]
            isOneToOne: false
            referencedRelation: "varieties"
            referencedColumns: ["id"]
          },
        ]
      }
      external_materials: {
        Row: {
          created_at: string | null
          created_by: string | null
          created_by_farm_id: string | null
          deleted_at: string | null
          id: string
          nom: string
          notes: string | null
          unite: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          created_by_farm_id?: string | null
          deleted_at?: string | null
          id?: string
          nom: string
          notes?: string | null
          unite?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          created_by_farm_id?: string | null
          deleted_at?: string | null
          id?: string
          nom?: string
          notes?: string | null
          unite?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "external_materials_created_by_farm_id_fkey"
            columns: ["created_by_farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
        ]
      }
      farm_access: {
        Row: {
          created_at: string | null
          farm_id: string
          id: string
          permission: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          farm_id: string
          id?: string
          permission?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          farm_id?: string
          id?: string
          permission?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "farm_access_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
        ]
      }
      farm_material_settings: {
        Row: {
          external_material_id: string
          farm_id: string
          hidden: boolean
          id: string
        }
        Insert: {
          external_material_id: string
          farm_id: string
          hidden?: boolean
          id?: string
        }
        Update: {
          external_material_id?: string
          farm_id?: string
          hidden?: boolean
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "farm_material_settings_external_material_id_fkey"
            columns: ["external_material_id"]
            isOneToOne: false
            referencedRelation: "external_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "farm_material_settings_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
        ]
      }
      farm_modules: {
        Row: {
          activated_at: string | null
          farm_id: string
          id: string
          module: string
        }
        Insert: {
          activated_at?: string | null
          farm_id: string
          id?: string
          module: string
        }
        Update: {
          activated_at?: string | null
          farm_id?: string
          id?: string
          module?: string
        }
        Relationships: [
          {
            foreignKeyName: "farm_modules_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
        ]
      }
      farm_variety_settings: {
        Row: {
          farm_id: string
          hidden: boolean
          id: string
          seuil_alerte_g: number | null
          variety_id: string
        }
        Insert: {
          farm_id: string
          hidden?: boolean
          id?: string
          seuil_alerte_g?: number | null
          variety_id: string
        }
        Update: {
          farm_id?: string
          hidden?: boolean
          id?: string
          seuil_alerte_g?: number | null
          variety_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "farm_variety_settings_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "farm_variety_settings_variety_id_fkey"
            columns: ["variety_id"]
            isOneToOne: false
            referencedRelation: "varieties"
            referencedColumns: ["id"]
          },
        ]
      }
      farms: {
        Row: {
          certif_bio: boolean
          created_at: string | null
          id: string
          nom: string
          numero_certificat: string | null
          organisme_certificateur: string | null
          organization_id: string
          slug: string
          updated_at: string | null
        }
        Insert: {
          certif_bio?: boolean
          created_at?: string | null
          id?: string
          nom: string
          numero_certificat?: string | null
          organisme_certificateur?: string | null
          organization_id: string
          slug: string
          updated_at?: string | null
        }
        Update: {
          certif_bio?: boolean
          created_at?: string | null
          id?: string
          nom?: string
          numero_certificat?: string | null
          organisme_certificateur?: string | null
          organization_id?: string
          slug?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "farms_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      forecasts: {
        Row: {
          annee: number
          commentaire: string | null
          created_at: string | null
          created_by: string | null
          etat_plante: string | null
          farm_id: string
          id: string
          partie_plante: string | null
          quantite_prevue_g: number | null
          updated_by: string | null
          variety_id: string
        }
        Insert: {
          annee: number
          commentaire?: string | null
          created_at?: string | null
          created_by?: string | null
          etat_plante?: string | null
          farm_id: string
          id?: string
          partie_plante?: string | null
          quantite_prevue_g?: number | null
          updated_by?: string | null
          variety_id: string
        }
        Update: {
          annee?: number
          commentaire?: string | null
          created_at?: string | null
          created_by?: string | null
          etat_plante?: string | null
          farm_id?: string
          id?: string
          partie_plante?: string | null
          quantite_prevue_g?: number | null
          updated_by?: string | null
          variety_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "forecasts_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forecasts_variety_id_fkey"
            columns: ["variety_id"]
            isOneToOne: false
            referencedRelation: "varieties"
            referencedColumns: ["id"]
          },
        ]
      }
      harvests: {
        Row: {
          commentaire: string | null
          created_at: string | null
          created_by: string | null
          date: string
          deleted_at: string | null
          farm_id: string
          id: string
          lieu_sauvage: string | null
          partie_plante: string
          poids_g: number
          row_id: string | null
          temps_min: number | null
          type_cueillette: string
          updated_by: string | null
          uuid_client: string | null
          variety_id: string
        }
        Insert: {
          commentaire?: string | null
          created_at?: string | null
          created_by?: string | null
          date: string
          deleted_at?: string | null
          farm_id: string
          id?: string
          lieu_sauvage?: string | null
          partie_plante?: string
          poids_g: number
          row_id?: string | null
          temps_min?: number | null
          type_cueillette: string
          updated_by?: string | null
          uuid_client?: string | null
          variety_id: string
        }
        Update: {
          commentaire?: string | null
          created_at?: string | null
          created_by?: string | null
          date?: string
          deleted_at?: string | null
          farm_id?: string
          id?: string
          lieu_sauvage?: string | null
          partie_plante?: string
          poids_g?: number
          row_id?: string | null
          temps_min?: number | null
          type_cueillette?: string
          updated_by?: string | null
          uuid_client?: string | null
          variety_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "harvests_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "harvests_row_id_fkey"
            columns: ["row_id"]
            isOneToOne: false
            referencedRelation: "rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "harvests_variety_id_fkey"
            columns: ["variety_id"]
            isOneToOne: false
            referencedRelation: "varieties"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          created_at: string | null
          id: string
          organization_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          organization_id: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          organization_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          farm_id: string | null
          id: string
          message: string | null
          metadata: Json | null
          read: boolean
          title: string
          type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          farm_id?: string | null
          id?: string
          message?: string | null
          metadata?: Json | null
          read?: boolean
          title: string
          type: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          farm_id?: string | null
          id?: string
          message?: string | null
          metadata?: Json | null
          read?: boolean
          title?: string
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
        ]
      }
      occultations: {
        Row: {
          attestation: string | null
          commentaire: string | null
          created_at: string | null
          created_by: string | null
          date_debut: string
          date_fin: string | null
          engrais_vert_certif_ab: boolean | null
          engrais_vert_facture: string | null
          engrais_vert_fournisseur: string | null
          engrais_vert_nom: string | null
          farm_id: string
          fournisseur: string | null
          id: string
          methode: string
          row_id: string
          temps_min: number | null
          temps_retrait_min: number | null
          updated_by: string | null
          uuid_client: string | null
        }
        Insert: {
          attestation?: string | null
          commentaire?: string | null
          created_at?: string | null
          created_by?: string | null
          date_debut: string
          date_fin?: string | null
          engrais_vert_certif_ab?: boolean | null
          engrais_vert_facture?: string | null
          engrais_vert_fournisseur?: string | null
          engrais_vert_nom?: string | null
          farm_id: string
          fournisseur?: string | null
          id?: string
          methode: string
          row_id: string
          temps_min?: number | null
          temps_retrait_min?: number | null
          updated_by?: string | null
          uuid_client?: string | null
        }
        Update: {
          attestation?: string | null
          commentaire?: string | null
          created_at?: string | null
          created_by?: string | null
          date_debut?: string
          date_fin?: string | null
          engrais_vert_certif_ab?: boolean | null
          engrais_vert_facture?: string | null
          engrais_vert_fournisseur?: string | null
          engrais_vert_nom?: string | null
          farm_id?: string
          fournisseur?: string | null
          id?: string
          methode?: string
          row_id?: string
          temps_min?: number | null
          temps_retrait_min?: number | null
          updated_by?: string | null
          uuid_client?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "occultations_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "occultations_row_id_fkey"
            columns: ["row_id"]
            isOneToOne: false
            referencedRelation: "rows"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          couleur_primaire: string | null
          couleur_secondaire: string | null
          created_at: string | null
          id: string
          logo_url: string | null
          max_farms: number
          max_users: number
          nom: string
          nom_affiche: string | null
          plan: string
          slug: string
          updated_at: string | null
        }
        Insert: {
          couleur_primaire?: string | null
          couleur_secondaire?: string | null
          created_at?: string | null
          id?: string
          logo_url?: string | null
          max_farms?: number
          max_users?: number
          nom: string
          nom_affiche?: string | null
          plan?: string
          slug: string
          updated_at?: string | null
        }
        Update: {
          couleur_primaire?: string | null
          couleur_secondaire?: string | null
          created_at?: string | null
          id?: string
          logo_url?: string | null
          max_farms?: number
          max_users?: number
          nom?: string
          nom_affiche?: string | null
          plan?: string
          slug?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      parcels: {
        Row: {
          code: string
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          description: string | null
          farm_id: string
          id: string
          nom: string
          orientation: string | null
          site_id: string | null
          updated_by: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          farm_id: string
          id?: string
          nom: string
          orientation?: string | null
          site_id?: string | null
          updated_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          farm_id?: string
          id?: string
          nom?: string
          orientation?: string | null
          site_id?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "parcels_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parcels_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      plantings: {
        Row: {
          actif: boolean | null
          annee: number
          bouture_id: string | null
          certif_ab: boolean | null
          commentaire: string | null
          created_at: string | null
          created_by: string | null
          date_commande: string | null
          date_plantation: string
          deleted_at: string | null
          espacement_cm: number | null
          farm_id: string
          fournisseur: string | null
          id: string
          largeur_m: number | null
          longueur_m: number | null
          lune: string | null
          nb_plants: number | null
          numero_facture: string | null
          row_id: string | null
          seed_lot_id: string | null
          seedling_id: string | null
          temps_min: number | null
          type_plant: string | null
          updated_by: string | null
          uuid_client: string | null
          variety_id: string | null
        }
        Insert: {
          actif?: boolean | null
          annee: number
          bouture_id?: string | null
          certif_ab?: boolean | null
          commentaire?: string | null
          created_at?: string | null
          created_by?: string | null
          date_commande?: string | null
          date_plantation: string
          deleted_at?: string | null
          espacement_cm?: number | null
          farm_id: string
          fournisseur?: string | null
          id?: string
          largeur_m?: number | null
          longueur_m?: number | null
          lune?: string | null
          nb_plants?: number | null
          numero_facture?: string | null
          row_id?: string | null
          seed_lot_id?: string | null
          seedling_id?: string | null
          temps_min?: number | null
          type_plant?: string | null
          updated_by?: string | null
          uuid_client?: string | null
          variety_id?: string | null
        }
        Update: {
          actif?: boolean | null
          annee?: number
          bouture_id?: string | null
          certif_ab?: boolean | null
          commentaire?: string | null
          created_at?: string | null
          created_by?: string | null
          date_commande?: string | null
          date_plantation?: string
          deleted_at?: string | null
          espacement_cm?: number | null
          farm_id?: string
          fournisseur?: string | null
          id?: string
          largeur_m?: number | null
          longueur_m?: number | null
          lune?: string | null
          nb_plants?: number | null
          numero_facture?: string | null
          row_id?: string | null
          seed_lot_id?: string | null
          seedling_id?: string | null
          temps_min?: number | null
          type_plant?: string | null
          updated_by?: string | null
          uuid_client?: string | null
          variety_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plantings_bouture_id_fkey"
            columns: ["bouture_id"]
            isOneToOne: false
            referencedRelation: "boutures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plantings_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plantings_row_id_fkey"
            columns: ["row_id"]
            isOneToOne: false
            referencedRelation: "rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plantings_seed_lot_id_fkey"
            columns: ["seed_lot_id"]
            isOneToOne: false
            referencedRelation: "seed_lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plantings_seedling_id_fkey"
            columns: ["seedling_id"]
            isOneToOne: false
            referencedRelation: "seedlings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plantings_seedling_id_fkey"
            columns: ["seedling_id"]
            isOneToOne: false
            referencedRelation: "v_seed_cost_per_seedling"
            referencedColumns: ["seedling_id"]
          },
          {
            foreignKeyName: "plantings_variety_id_fkey"
            columns: ["variety_id"]
            isOneToOne: false
            referencedRelation: "varieties"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_admins: {
        Row: {
          created_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      product_categories: {
        Row: {
          created_at: string | null
          created_by: string | null
          created_by_farm_id: string | null
          id: string
          nom: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          created_by_farm_id?: string | null
          id?: string
          nom: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          created_by_farm_id?: string | null
          id?: string
          nom?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_categories_created_by_farm_id_fkey"
            columns: ["created_by_farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
        ]
      }
      product_stock_movements: {
        Row: {
          commentaire: string | null
          conditionnement_id: string | null
          created_at: string | null
          created_by: string | null
          date: string
          deleted_at: string | null
          farm_id: string
          id: string
          production_lot_id: string | null
          quantite: number
          type_mouvement: string
          updated_by: string | null
        }
        Insert: {
          commentaire?: string | null
          conditionnement_id?: string | null
          created_at?: string | null
          created_by?: string | null
          date: string
          deleted_at?: string | null
          farm_id: string
          id?: string
          production_lot_id?: string | null
          quantite: number
          type_mouvement: string
          updated_by?: string | null
        }
        Update: {
          commentaire?: string | null
          conditionnement_id?: string | null
          created_at?: string | null
          created_by?: string | null
          date?: string
          deleted_at?: string | null
          farm_id?: string
          id?: string
          production_lot_id?: string | null
          quantite?: number
          type_mouvement?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_stock_movements_conditionnement_id_fkey"
            columns: ["conditionnement_id"]
            isOneToOne: false
            referencedRelation: "conditionnements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_stock_movements_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_stock_movements_production_lot_id_fkey"
            columns: ["production_lot_id"]
            isOneToOne: false
            referencedRelation: "production_lots"
            referencedColumns: ["id"]
          },
        ]
      }
      production_ingredient_sources: {
        Row: {
          created_at: string | null
          farm_id: string
          id: string
          poids_g: number
          production_lot_ingredient_id: string
          stock_purchase_id: string
        }
        Insert: {
          created_at?: string | null
          farm_id: string
          id?: string
          poids_g: number
          production_lot_ingredient_id: string
          stock_purchase_id: string
        }
        Update: {
          created_at?: string | null
          farm_id?: string
          id?: string
          poids_g?: number
          production_lot_ingredient_id?: string
          stock_purchase_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_ingredient_sources_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_ingredient_sources_production_lot_ingredient_id_fkey"
            columns: ["production_lot_ingredient_id"]
            isOneToOne: false
            referencedRelation: "production_lot_ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_ingredient_sources_stock_purchase_id_fkey"
            columns: ["stock_purchase_id"]
            isOneToOne: false
            referencedRelation: "stock_purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      production_lot_ingredients: {
        Row: {
          annee_recolte: number | null
          created_at: string | null
          etat_plante: string | null
          external_material_id: string | null
          fournisseur: string | null
          id: string
          partie_plante: string | null
          poids_g: number
          pourcentage: number
          production_lot_id: string | null
          variety_id: string | null
        }
        Insert: {
          annee_recolte?: number | null
          created_at?: string | null
          etat_plante?: string | null
          external_material_id?: string | null
          fournisseur?: string | null
          id?: string
          partie_plante?: string | null
          poids_g: number
          pourcentage: number
          production_lot_id?: string | null
          variety_id?: string | null
        }
        Update: {
          annee_recolte?: number | null
          created_at?: string | null
          etat_plante?: string | null
          external_material_id?: string | null
          fournisseur?: string | null
          id?: string
          partie_plante?: string | null
          poids_g?: number
          pourcentage?: number
          production_lot_id?: string | null
          variety_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "production_lot_ingredients_external_material_id_fkey"
            columns: ["external_material_id"]
            isOneToOne: false
            referencedRelation: "external_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_lot_ingredients_production_lot_id_fkey"
            columns: ["production_lot_id"]
            isOneToOne: false
            referencedRelation: "production_lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_lot_ingredients_variety_id_fkey"
            columns: ["variety_id"]
            isOneToOne: false
            referencedRelation: "varieties"
            referencedColumns: ["id"]
          },
        ]
      }
      production_lots: {
        Row: {
          commentaire: string | null
          created_at: string | null
          created_by: string | null
          date_production: string
          ddm: string
          deleted_at: string | null
          farm_id: string
          id: string
          mode: string
          nb_unites: number | null
          numero_lot: string | null
          poids_total_g: number | null
          recipe_id: string | null
          temps_min: number | null
          updated_by: string | null
          uuid_client: string | null
        }
        Insert: {
          commentaire?: string | null
          created_at?: string | null
          created_by?: string | null
          date_production: string
          ddm: string
          deleted_at?: string | null
          farm_id: string
          id?: string
          mode?: string
          nb_unites?: number | null
          numero_lot?: string | null
          poids_total_g?: number | null
          recipe_id?: string | null
          temps_min?: number | null
          updated_by?: string | null
          uuid_client?: string | null
        }
        Update: {
          commentaire?: string | null
          created_at?: string | null
          created_by?: string | null
          date_production?: string
          ddm?: string
          deleted_at?: string | null
          farm_id?: string
          id?: string
          mode?: string
          nb_unites?: number | null
          numero_lot?: string | null
          poids_total_g?: number | null
          recipe_id?: string | null
          temps_min?: number | null
          updated_by?: string | null
          uuid_client?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "production_lots_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_lots_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      production_summary: {
        Row: {
          annee: number
          farm_id: string
          id: string
          mois: number | null
          temps_arrachage_min: number | null
          temps_cueillette_min: number | null
          temps_plantation_min: number | null
          temps_production_min: number | null
          temps_repiquage_min: number | null
          temps_sechage_min: number | null
          temps_semis_min: number | null
          temps_suivi_rang_min: number | null
          temps_triage_min: number | null
          temps_tronconnage_min: number | null
          total_achete_g: number | null
          total_cueilli_g: number | null
          total_sechee_g: number | null
          total_triee_g: number | null
          total_tronconnee_g: number | null
          total_utilise_production_g: number | null
          total_vendu_direct_g: number | null
          updated_at: string | null
          variety_id: string
        }
        Insert: {
          annee: number
          farm_id: string
          id?: string
          mois?: number | null
          temps_arrachage_min?: number | null
          temps_cueillette_min?: number | null
          temps_plantation_min?: number | null
          temps_production_min?: number | null
          temps_repiquage_min?: number | null
          temps_sechage_min?: number | null
          temps_semis_min?: number | null
          temps_suivi_rang_min?: number | null
          temps_triage_min?: number | null
          temps_tronconnage_min?: number | null
          total_achete_g?: number | null
          total_cueilli_g?: number | null
          total_sechee_g?: number | null
          total_triee_g?: number | null
          total_tronconnee_g?: number | null
          total_utilise_production_g?: number | null
          total_vendu_direct_g?: number | null
          updated_at?: string | null
          variety_id: string
        }
        Update: {
          annee?: number
          farm_id?: string
          id?: string
          mois?: number | null
          temps_arrachage_min?: number | null
          temps_cueillette_min?: number | null
          temps_plantation_min?: number | null
          temps_production_min?: number | null
          temps_repiquage_min?: number | null
          temps_sechage_min?: number | null
          temps_semis_min?: number | null
          temps_suivi_rang_min?: number | null
          temps_triage_min?: number | null
          temps_tronconnage_min?: number | null
          total_achete_g?: number | null
          total_cueilli_g?: number | null
          total_sechee_g?: number | null
          total_triee_g?: number | null
          total_tronconnee_g?: number | null
          total_utilise_production_g?: number | null
          total_vendu_direct_g?: number | null
          updated_at?: string | null
          variety_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_summary_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_summary_variety_id_fkey"
            columns: ["variety_id"]
            isOneToOne: false
            referencedRelation: "varieties"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_ingredients: {
        Row: {
          created_at: string | null
          etat_plante: string | null
          external_material_id: string | null
          id: string
          ordre: number | null
          partie_plante: string | null
          pourcentage: number
          recipe_id: string | null
          variety_id: string | null
        }
        Insert: {
          created_at?: string | null
          etat_plante?: string | null
          external_material_id?: string | null
          id?: string
          ordre?: number | null
          partie_plante?: string | null
          pourcentage: number
          recipe_id?: string | null
          variety_id?: string | null
        }
        Update: {
          created_at?: string | null
          etat_plante?: string | null
          external_material_id?: string | null
          id?: string
          ordre?: number | null
          partie_plante?: string | null
          pourcentage?: number
          recipe_id?: string | null
          variety_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recipe_ingredients_external_material_id_fkey"
            columns: ["external_material_id"]
            isOneToOne: false
            referencedRelation: "external_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_ingredients_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_ingredients_variety_id_fkey"
            columns: ["variety_id"]
            isOneToOne: false
            referencedRelation: "varieties"
            referencedColumns: ["id"]
          },
        ]
      }
      recipes: {
        Row: {
          actif: boolean | null
          category_id: string | null
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          description: string | null
          farm_id: string
          id: string
          nom: string
          numero_tisane: string | null
          poids_sachet_g: number
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          actif?: boolean | null
          category_id?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          farm_id: string
          id?: string
          nom: string
          numero_tisane?: string | null
          poids_sachet_g: number
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          actif?: boolean | null
          category_id?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          farm_id?: string
          id?: string
          nom?: string
          numero_tisane?: string | null
          poids_sachet_g?: number
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recipes_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipes_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
        ]
      }
      row_care: {
        Row: {
          commentaire: string | null
          created_at: string | null
          created_by: string | null
          date: string
          farm_id: string
          id: string
          row_id: string | null
          temps_min: number | null
          type_soin: string | null
          updated_by: string | null
          uuid_client: string | null
          variety_id: string
        }
        Insert: {
          commentaire?: string | null
          created_at?: string | null
          created_by?: string | null
          date: string
          farm_id: string
          id?: string
          row_id?: string | null
          temps_min?: number | null
          type_soin?: string | null
          updated_by?: string | null
          uuid_client?: string | null
          variety_id: string
        }
        Update: {
          commentaire?: string | null
          created_at?: string | null
          created_by?: string | null
          date?: string
          farm_id?: string
          id?: string
          row_id?: string | null
          temps_min?: number | null
          type_soin?: string | null
          updated_by?: string | null
          uuid_client?: string | null
          variety_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "row_care_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "row_care_row_id_fkey"
            columns: ["row_id"]
            isOneToOne: false
            referencedRelation: "rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "row_care_variety_id_fkey"
            columns: ["variety_id"]
            isOneToOne: false
            referencedRelation: "varieties"
            referencedColumns: ["id"]
          },
        ]
      }
      rows: {
        Row: {
          ancien_numero: string | null
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          farm_id: string
          id: string
          largeur_m: number | null
          longueur_m: number | null
          notes: string | null
          numero: string
          parcel_id: string | null
          position_ordre: number | null
          updated_by: string | null
        }
        Insert: {
          ancien_numero?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          farm_id: string
          id?: string
          largeur_m?: number | null
          longueur_m?: number | null
          notes?: string | null
          numero: string
          parcel_id?: string | null
          position_ordre?: number | null
          updated_by?: string | null
        }
        Update: {
          ancien_numero?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          farm_id?: string
          id?: string
          largeur_m?: number | null
          longueur_m?: number | null
          notes?: string | null
          numero?: string
          parcel_id?: string | null
          position_ordre?: number | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rows_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rows_parcel_id_fkey"
            columns: ["parcel_id"]
            isOneToOne: false
            referencedRelation: "parcels"
            referencedColumns: ["id"]
          },
        ]
      }
      season_closures: {
        Row: {
          annee: number
          closed_at: string
          closed_by: string | null
          commentaire: string | null
          farm_id: string
          id: string
          plantings_kept: number | null
          plantings_uprooted: number | null
        }
        Insert: {
          annee: number
          closed_at?: string
          closed_by?: string | null
          commentaire?: string | null
          farm_id: string
          id?: string
          plantings_kept?: number | null
          plantings_uprooted?: number | null
        }
        Update: {
          annee?: number
          closed_at?: string
          closed_by?: string | null
          commentaire?: string | null
          farm_id?: string
          id?: string
          plantings_kept?: number | null
          plantings_uprooted?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "season_closures_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
        ]
      }
      seed_lots: {
        Row: {
          certif_ab: boolean | null
          commentaire: string | null
          created_at: string | null
          created_by: string | null
          date_achat: string
          date_facture: string | null
          deleted_at: string | null
          farm_id: string
          fournisseur: string | null
          id: string
          lot_interne: string
          numero_facture: string | null
          numero_lot_fournisseur: string | null
          poids_sachet_g: number | null
          updated_by: string | null
          uuid_client: string | null
          variety_id: string | null
        }
        Insert: {
          certif_ab?: boolean | null
          commentaire?: string | null
          created_at?: string | null
          created_by?: string | null
          date_achat: string
          date_facture?: string | null
          deleted_at?: string | null
          farm_id: string
          fournisseur?: string | null
          id?: string
          lot_interne: string
          numero_facture?: string | null
          numero_lot_fournisseur?: string | null
          poids_sachet_g?: number | null
          updated_by?: string | null
          uuid_client?: string | null
          variety_id?: string | null
        }
        Update: {
          certif_ab?: boolean | null
          commentaire?: string | null
          created_at?: string | null
          created_by?: string | null
          date_achat?: string
          date_facture?: string | null
          deleted_at?: string | null
          farm_id?: string
          fournisseur?: string | null
          id?: string
          lot_interne?: string
          numero_facture?: string | null
          numero_lot_fournisseur?: string | null
          poids_sachet_g?: number | null
          updated_by?: string | null
          uuid_client?: string | null
          variety_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "seed_lots_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seed_lots_variety_id_fkey"
            columns: ["variety_id"]
            isOneToOne: false
            referencedRelation: "varieties"
            referencedColumns: ["id"]
          },
        ]
      }
      seed_stock_adjustments: {
        Row: {
          commentaire: string | null
          created_at: string | null
          created_by: string | null
          date: string
          deleted_at: string | null
          farm_id: string
          id: string
          poids_constate_g: number
          seed_lot_id: string
          updated_by: string | null
          uuid_client: string | null
        }
        Insert: {
          commentaire?: string | null
          created_at?: string | null
          created_by?: string | null
          date: string
          deleted_at?: string | null
          farm_id: string
          id?: string
          poids_constate_g: number
          seed_lot_id: string
          updated_by?: string | null
          uuid_client?: string | null
        }
        Update: {
          commentaire?: string | null
          created_at?: string | null
          created_by?: string | null
          date?: string
          deleted_at?: string | null
          farm_id?: string
          id?: string
          poids_constate_g?: number
          seed_lot_id?: string
          updated_by?: string | null
          uuid_client?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "seed_stock_adjustments_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seed_stock_adjustments_seed_lot_id_fkey"
            columns: ["seed_lot_id"]
            isOneToOne: false
            referencedRelation: "seed_lots"
            referencedColumns: ["id"]
          },
        ]
      }
      seed_stock_movements: {
        Row: {
          commentaire: string | null
          created_at: string | null
          created_by: string | null
          date: string
          deleted_at: string | null
          farm_id: string
          id: string
          poids_g: number
          seed_lot_id: string
          source_id: string | null
          source_type: string
          type_mouvement: string
          updated_by: string | null
          variety_id: string | null
        }
        Insert: {
          commentaire?: string | null
          created_at?: string | null
          created_by?: string | null
          date: string
          deleted_at?: string | null
          farm_id: string
          id?: string
          poids_g: number
          seed_lot_id: string
          source_id?: string | null
          source_type: string
          type_mouvement: string
          updated_by?: string | null
          variety_id?: string | null
        }
        Update: {
          commentaire?: string | null
          created_at?: string | null
          created_by?: string | null
          date?: string
          deleted_at?: string | null
          farm_id?: string
          id?: string
          poids_g?: number
          seed_lot_id?: string
          source_id?: string | null
          source_type?: string
          type_mouvement?: string
          updated_by?: string | null
          variety_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "seed_stock_movements_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seed_stock_movements_seed_lot_id_fkey"
            columns: ["seed_lot_id"]
            isOneToOne: false
            referencedRelation: "seed_lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seed_stock_movements_variety_id_fkey"
            columns: ["variety_id"]
            isOneToOne: false
            referencedRelation: "varieties"
            referencedColumns: ["id"]
          },
        ]
      }
      seedlings: {
        Row: {
          commentaire: string | null
          created_at: string | null
          created_by: string | null
          date_levee: string | null
          date_repiquage: string | null
          date_semis: string
          deleted_at: string | null
          farm_id: string
          id: string
          nb_caissettes: number | null
          nb_donnees: number | null
          nb_godets: number | null
          nb_mortes_caissette: number | null
          nb_mortes_godet: number | null
          nb_mortes_mottes: number | null
          nb_mottes: number | null
          nb_plants_caissette: number | null
          nb_plants_obtenus: number | null
          numero_caisse: string | null
          poids_graines_utilise_g: number | null
          processus: string | null
          seed_lot_id: string | null
          statut: string
          temps_repiquage_min: number | null
          temps_semis_min: number | null
          updated_by: string | null
          uuid_client: string | null
          variety_id: string | null
        }
        Insert: {
          commentaire?: string | null
          created_at?: string | null
          created_by?: string | null
          date_levee?: string | null
          date_repiquage?: string | null
          date_semis: string
          deleted_at?: string | null
          farm_id: string
          id?: string
          nb_caissettes?: number | null
          nb_donnees?: number | null
          nb_godets?: number | null
          nb_mortes_caissette?: number | null
          nb_mortes_godet?: number | null
          nb_mortes_mottes?: number | null
          nb_mottes?: number | null
          nb_plants_caissette?: number | null
          nb_plants_obtenus?: number | null
          numero_caisse?: string | null
          poids_graines_utilise_g?: number | null
          processus?: string | null
          seed_lot_id?: string | null
          statut?: string
          temps_repiquage_min?: number | null
          temps_semis_min?: number | null
          updated_by?: string | null
          uuid_client?: string | null
          variety_id?: string | null
        }
        Update: {
          commentaire?: string | null
          created_at?: string | null
          created_by?: string | null
          date_levee?: string | null
          date_repiquage?: string | null
          date_semis?: string
          deleted_at?: string | null
          farm_id?: string
          id?: string
          nb_caissettes?: number | null
          nb_donnees?: number | null
          nb_godets?: number | null
          nb_mortes_caissette?: number | null
          nb_mortes_godet?: number | null
          nb_mortes_mottes?: number | null
          nb_mottes?: number | null
          nb_plants_caissette?: number | null
          nb_plants_obtenus?: number | null
          numero_caisse?: string | null
          poids_graines_utilise_g?: number | null
          processus?: string | null
          seed_lot_id?: string | null
          statut?: string
          temps_repiquage_min?: number | null
          temps_semis_min?: number | null
          updated_by?: string | null
          uuid_client?: string | null
          variety_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "seedlings_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seedlings_seed_lot_id_fkey"
            columns: ["seed_lot_id"]
            isOneToOne: false
            referencedRelation: "seed_lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seedlings_variety_id_fkey"
            columns: ["variety_id"]
            isOneToOne: false
            referencedRelation: "varieties"
            referencedColumns: ["id"]
          },
        ]
      }
      sites: {
        Row: {
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          description: string | null
          farm_id: string
          id: string
          nom: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          farm_id: string
          id?: string
          nom: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          farm_id?: string
          id?: string
          nom?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sites_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
        ]
      }
      soil_works: {
        Row: {
          commentaire: string | null
          created_at: string | null
          created_by: string | null
          date: string
          detail: string | null
          farm_id: string
          id: string
          row_id: string | null
          temps_min: number | null
          type_travail: string | null
          updated_by: string | null
          uuid_client: string | null
        }
        Insert: {
          commentaire?: string | null
          created_at?: string | null
          created_by?: string | null
          date: string
          detail?: string | null
          farm_id: string
          id?: string
          row_id?: string | null
          temps_min?: number | null
          type_travail?: string | null
          updated_by?: string | null
          uuid_client?: string | null
        }
        Update: {
          commentaire?: string | null
          created_at?: string | null
          created_by?: string | null
          date?: string
          detail?: string | null
          farm_id?: string
          id?: string
          row_id?: string | null
          temps_min?: number | null
          type_travail?: string | null
          updated_by?: string | null
          uuid_client?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "soil_works_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "soil_works_row_id_fkey"
            columns: ["row_id"]
            isOneToOne: false
            referencedRelation: "rows"
            referencedColumns: ["id"]
          },
        ]
      }
      sortings: {
        Row: {
          commentaire: string | null
          created_at: string | null
          created_by: string | null
          date: string
          etat_plante: string
          farm_id: string
          id: string
          paired_id: string | null
          partie_plante: string
          poids_g: number
          temps_min: number | null
          type: string
          updated_by: string | null
          uuid_client: string | null
          variety_id: string
        }
        Insert: {
          commentaire?: string | null
          created_at?: string | null
          created_by?: string | null
          date: string
          etat_plante: string
          farm_id: string
          id?: string
          paired_id?: string | null
          partie_plante?: string
          poids_g: number
          temps_min?: number | null
          type: string
          updated_by?: string | null
          uuid_client?: string | null
          variety_id: string
        }
        Update: {
          commentaire?: string | null
          created_at?: string | null
          created_by?: string | null
          date?: string
          etat_plante?: string
          farm_id?: string
          id?: string
          paired_id?: string | null
          partie_plante?: string
          poids_g?: number
          temps_min?: number | null
          type?: string
          updated_by?: string | null
          uuid_client?: string | null
          variety_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sortings_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sortings_paired_id_fkey"
            columns: ["paired_id"]
            isOneToOne: false
            referencedRelation: "sortings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sortings_variety_id_fkey"
            columns: ["variety_id"]
            isOneToOne: false
            referencedRelation: "varieties"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_adjustments: {
        Row: {
          commentaire: string | null
          created_at: string | null
          created_by: string | null
          date: string
          etat_plante: string
          farm_id: string
          id: string
          motif: string
          partie_plante: string
          poids_g: number
          type_mouvement: string
          updated_by: string | null
          uuid_client: string | null
          variety_id: string
        }
        Insert: {
          commentaire?: string | null
          created_at?: string | null
          created_by?: string | null
          date: string
          etat_plante: string
          farm_id: string
          id?: string
          motif: string
          partie_plante?: string
          poids_g: number
          type_mouvement: string
          updated_by?: string | null
          uuid_client?: string | null
          variety_id: string
        }
        Update: {
          commentaire?: string | null
          created_at?: string | null
          created_by?: string | null
          date?: string
          etat_plante?: string
          farm_id?: string
          id?: string
          motif?: string
          partie_plante?: string
          poids_g?: number
          type_mouvement?: string
          updated_by?: string | null
          uuid_client?: string | null
          variety_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_adjustments_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_adjustments_variety_id_fkey"
            columns: ["variety_id"]
            isOneToOne: false
            referencedRelation: "varieties"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_direct_sales: {
        Row: {
          commentaire: string | null
          created_at: string | null
          created_by: string | null
          date: string
          destinataire: string | null
          etat_plante: string
          farm_id: string
          id: string
          partie_plante: string
          poids_g: number
          updated_by: string | null
          uuid_client: string | null
          variety_id: string
        }
        Insert: {
          commentaire?: string | null
          created_at?: string | null
          created_by?: string | null
          date: string
          destinataire?: string | null
          etat_plante: string
          farm_id: string
          id?: string
          partie_plante?: string
          poids_g: number
          updated_by?: string | null
          uuid_client?: string | null
          variety_id: string
        }
        Update: {
          commentaire?: string | null
          created_at?: string | null
          created_by?: string | null
          date?: string
          destinataire?: string | null
          etat_plante?: string
          farm_id?: string
          id?: string
          partie_plante?: string
          poids_g?: number
          updated_by?: string | null
          uuid_client?: string | null
          variety_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_direct_sales_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_direct_sales_variety_id_fkey"
            columns: ["variety_id"]
            isOneToOne: false
            referencedRelation: "varieties"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          commentaire: string | null
          created_at: string | null
          created_by: string | null
          date: string
          deleted_at: string | null
          etat_plante: string | null
          external_material_id: string | null
          farm_id: string
          id: string
          partie_plante: string | null
          poids_g: number
          source_id: string | null
          source_type: string
          type_mouvement: string
          variety_id: string | null
        }
        Insert: {
          commentaire?: string | null
          created_at?: string | null
          created_by?: string | null
          date: string
          deleted_at?: string | null
          etat_plante?: string | null
          external_material_id?: string | null
          farm_id: string
          id?: string
          partie_plante?: string | null
          poids_g: number
          source_id?: string | null
          source_type: string
          type_mouvement: string
          variety_id?: string | null
        }
        Update: {
          commentaire?: string | null
          created_at?: string | null
          created_by?: string | null
          date?: string
          deleted_at?: string | null
          etat_plante?: string | null
          external_material_id?: string | null
          farm_id?: string
          id?: string
          partie_plante?: string | null
          poids_g?: number
          source_id?: string | null
          source_type?: string
          type_mouvement?: string
          variety_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_external_material_id_fkey"
            columns: ["external_material_id"]
            isOneToOne: false
            referencedRelation: "external_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_variety_id_fkey"
            columns: ["variety_id"]
            isOneToOne: false
            referencedRelation: "varieties"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_purchases: {
        Row: {
          certif_ab: boolean | null
          commentaire: string | null
          created_at: string | null
          created_by: string | null
          date: string
          etat_plante: string | null
          external_material_id: string | null
          farm_id: string
          fournisseur: string | null
          id: string
          numero_facture: string | null
          numero_lot_fournisseur: string | null
          partie_plante: string
          poids_g: number
          prix: number | null
          updated_by: string | null
          uuid_client: string | null
          variety_id: string | null
        }
        Insert: {
          certif_ab?: boolean | null
          commentaire?: string | null
          created_at?: string | null
          created_by?: string | null
          date: string
          etat_plante?: string | null
          external_material_id?: string | null
          farm_id: string
          fournisseur?: string | null
          id?: string
          numero_facture?: string | null
          numero_lot_fournisseur?: string | null
          partie_plante?: string
          poids_g: number
          prix?: number | null
          updated_by?: string | null
          uuid_client?: string | null
          variety_id?: string | null
        }
        Update: {
          certif_ab?: boolean | null
          commentaire?: string | null
          created_at?: string | null
          created_by?: string | null
          date?: string
          etat_plante?: string | null
          external_material_id?: string | null
          farm_id?: string
          fournisseur?: string | null
          id?: string
          numero_facture?: string | null
          numero_lot_fournisseur?: string | null
          partie_plante?: string
          poids_g?: number
          prix?: number | null
          updated_by?: string | null
          uuid_client?: string | null
          variety_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_purchases_external_material_id_fkey"
            columns: ["external_material_id"]
            isOneToOne: false
            referencedRelation: "external_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_purchases_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_purchases_variety_id_fkey"
            columns: ["variety_id"]
            isOneToOne: false
            referencedRelation: "varieties"
            referencedColumns: ["id"]
          },
        ]
      }
      support_ticket_messages: {
        Row: {
          author_id: string
          content: string
          created_at: string
          id: string
          is_admin_reply: boolean
          ticket_id: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          id?: string
          is_admin_reply?: boolean
          ticket_id: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          is_admin_reply?: boolean
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          assigned_to: string | null
          created_at: string
          created_by: string
          description: string
          id: string
          organization_id: string
          page_url: string | null
          priority: Database["public"]["Enums"]["support_ticket_priority"]
          screenshot_url: string | null
          status: Database["public"]["Enums"]["support_ticket_status"]
          subject: string
          type: Database["public"]["Enums"]["support_ticket_type"]
          updated_at: string
          user_last_seen_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          created_by: string
          description: string
          id?: string
          organization_id: string
          page_url?: string | null
          priority?: Database["public"]["Enums"]["support_ticket_priority"]
          screenshot_url?: string | null
          status?: Database["public"]["Enums"]["support_ticket_status"]
          subject: string
          type?: Database["public"]["Enums"]["support_ticket_type"]
          updated_at?: string
          user_last_seen_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string
          description?: string
          id?: string
          organization_id?: string
          page_url?: string | null
          priority?: Database["public"]["Enums"]["support_ticket_priority"]
          screenshot_url?: string | null
          status?: Database["public"]["Enums"]["support_ticket_status"]
          subject?: string
          type?: Database["public"]["Enums"]["support_ticket_type"]
          updated_at?: string
          user_last_seen_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      uprootings: {
        Row: {
          commentaire: string | null
          created_at: string | null
          created_by: string | null
          date: string
          farm_id: string
          id: string
          row_id: string
          temps_min: number | null
          updated_by: string | null
          uuid_client: string | null
          variety_id: string | null
        }
        Insert: {
          commentaire?: string | null
          created_at?: string | null
          created_by?: string | null
          date: string
          farm_id: string
          id?: string
          row_id: string
          temps_min?: number | null
          updated_by?: string | null
          uuid_client?: string | null
          variety_id?: string | null
        }
        Update: {
          commentaire?: string | null
          created_at?: string | null
          created_by?: string | null
          date?: string
          farm_id?: string
          id?: string
          row_id?: string
          temps_min?: number | null
          updated_by?: string | null
          uuid_client?: string | null
          variety_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "uprootings_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "uprootings_row_id_fkey"
            columns: ["row_id"]
            isOneToOne: false
            referencedRelation: "rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "uprootings_variety_id_fkey"
            columns: ["variety_id"]
            isOneToOne: false
            referencedRelation: "varieties"
            referencedColumns: ["id"]
          },
        ]
      }
      varieties: {
        Row: {
          aliases: string[] | null
          created_at: string | null
          created_by: string | null
          created_by_farm_id: string | null
          deleted_at: string | null
          duree_peremption_mois: number | null
          famille: string | null
          id: string
          merged_into_id: string | null
          nom_latin: string | null
          nom_vernaculaire: string
          notes: string | null
          parties_utilisees: string[]
          type_cycle: string | null
          updated_at: string | null
          updated_by: string | null
          verified: boolean | null
        }
        Insert: {
          aliases?: string[] | null
          created_at?: string | null
          created_by?: string | null
          created_by_farm_id?: string | null
          deleted_at?: string | null
          duree_peremption_mois?: number | null
          famille?: string | null
          id?: string
          merged_into_id?: string | null
          nom_latin?: string | null
          nom_vernaculaire: string
          notes?: string | null
          parties_utilisees?: string[]
          type_cycle?: string | null
          updated_at?: string | null
          updated_by?: string | null
          verified?: boolean | null
        }
        Update: {
          aliases?: string[] | null
          created_at?: string | null
          created_by?: string | null
          created_by_farm_id?: string | null
          deleted_at?: string | null
          duree_peremption_mois?: number | null
          famille?: string | null
          id?: string
          merged_into_id?: string | null
          nom_latin?: string | null
          nom_vernaculaire?: string
          notes?: string | null
          parties_utilisees?: string[]
          type_cycle?: string | null
          updated_at?: string | null
          updated_by?: string | null
          verified?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "varieties_created_by_farm_id_fkey"
            columns: ["created_by_farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "varieties_merged_into_id_fkey"
            columns: ["merged_into_id"]
            isOneToOne: false
            referencedRelation: "varieties"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_seed_cost_per_seedling: {
        Row: {
          farm_id: string | null
          nb_plants_obtenus: number | null
          poids_graines_estime_g: number | null
          poids_par_plant_g: number | null
          seed_lot_id: string | null
          seedling_id: string | null
          variety_id: string | null
        }
        Insert: {
          farm_id?: string | null
          nb_plants_obtenus?: number | null
          poids_graines_estime_g?: never
          poids_par_plant_g?: never
          seed_lot_id?: string | null
          seedling_id?: string | null
          variety_id?: string | null
        }
        Update: {
          farm_id?: string | null
          nb_plants_obtenus?: number | null
          poids_graines_estime_g?: never
          poids_par_plant_g?: never
          seed_lot_id?: string | null
          seedling_id?: string | null
          variety_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "seedlings_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seedlings_seed_lot_id_fkey"
            columns: ["seed_lot_id"]
            isOneToOne: false
            referencedRelation: "seed_lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seedlings_variety_id_fkey"
            columns: ["variety_id"]
            isOneToOne: false
            referencedRelation: "varieties"
            referencedColumns: ["id"]
          },
        ]
      }
      v_seed_stock: {
        Row: {
          farm_id: string | null
          lot_interne: string | null
          poids_initial_g: number | null
          seed_lot_id: string | null
          stock_g: number | null
          variety_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "seed_lots_variety_id_fkey"
            columns: ["variety_id"]
            isOneToOne: false
            referencedRelation: "varieties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seed_stock_movements_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seed_stock_movements_seed_lot_id_fkey"
            columns: ["seed_lot_id"]
            isOneToOne: false
            referencedRelation: "seed_lots"
            referencedColumns: ["id"]
          },
        ]
      }
      v_stock: {
        Row: {
          etat_plante: string | null
          farm_id: string | null
          partie_plante: string | null
          stock_g: number | null
          variety_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_variety_id_fkey"
            columns: ["variety_id"]
            isOneToOne: false
            referencedRelation: "varieties"
            referencedColumns: ["id"]
          },
        ]
      }
      v_stock_external: {
        Row: {
          external_material_id: string | null
          farm_id: string | null
          nom: string | null
          stock_g: number | null
          unite: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_external_material_id_fkey"
            columns: ["external_material_id"]
            isOneToOne: false
            referencedRelation: "external_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      _ps_upsert: {
        Args: {
          p_annee: number
          p_delta_achete?: number
          p_delta_cueilli?: number
          p_delta_sechee?: number
          p_delta_temps_arrachage?: number
          p_delta_temps_cueillette?: number
          p_delta_temps_plantation?: number
          p_delta_temps_production?: number
          p_delta_temps_repiquage?: number
          p_delta_temps_sechage?: number
          p_delta_temps_semis?: number
          p_delta_temps_suivi_rang?: number
          p_delta_temps_triage?: number
          p_delta_temps_tronconnage?: number
          p_delta_triee?: number
          p_delta_tronconnee?: number
          p_delta_utilise_prod?: number
          p_delta_vendu_direct?: number
          p_farm_id: string
          p_mois: number
          p_variety_id: string
        }
        Returns: undefined
      }
      create_adjustment_with_stock: {
        Args: {
          p_commentaire: string
          p_created_by: string
          p_date: string
          p_etat_plante: string
          p_farm_id: string
          p_motif: string
          p_partie_plante: string
          p_poids_g: number
          p_type_mouvement: string
          p_uuid_client: string
          p_variety_id: string
        }
        Returns: string
      }
      create_conditionnement: {
        Args: {
          p_commentaire: string
          p_created_by: string
          p_date_conditionnement: string
          p_ddm: string
          p_farm_id: string
          p_nb_unites: number
          p_numero_lot: string
          p_production_lot_id: string
          p_temps_min: number
        }
        Returns: string
      }
      create_cutting_combined: {
        Args: {
          p_commentaire: string
          p_created_by: string
          p_date: string
          p_farm_id: string
          p_partie_plante: string
          p_poids_entree_g: number
          p_poids_sortie_g: number
          p_temps_min: number
          p_uuid_client_entree?: string
          p_uuid_client_sortie?: string
          p_variety_id: string
        }
        Returns: string
      }
      create_cutting_with_stock: {
        Args: {
          p_commentaire: string
          p_created_by: string
          p_date: string
          p_farm_id: string
          p_partie_plante: string
          p_poids_g: number
          p_temps_min: number
          p_type: string
          p_uuid_client?: string
          p_variety_id: string
        }
        Returns: string
      }
      create_direct_sale_with_stock: {
        Args: {
          p_commentaire: string
          p_created_by: string
          p_date: string
          p_destinataire: string
          p_etat_plante: string
          p_farm_id: string
          p_partie_plante: string
          p_poids_g: number
          p_uuid_client: string
          p_variety_id: string
        }
        Returns: string
      }
      create_drying_with_stock: {
        Args: {
          p_commentaire: string
          p_created_by: string
          p_date: string
          p_etat_plante: string
          p_farm_id: string
          p_partie_plante: string
          p_poids_g: number
          p_temps_min: number
          p_type: string
          p_uuid_client?: string
          p_variety_id: string
        }
        Returns: string
      }
      create_harvest_with_stock: {
        Args: {
          p_created_by: string
          p_date: string
          p_farm_id: string
          p_partie_plante: string
          p_poids_g: number
          p_type_cueillette: string
          p_variety_id: string
          p_commentaire?: string
          p_lieu_sauvage?: string
          p_row_id?: string
          p_temps_min?: number
          p_uuid_client?: string
        }
        Returns: string
      }
      create_production_lot_with_stock: {
        Args: {
          p_commentaire: string
          p_created_by: string
          p_date_production: string
          p_ddm: string
          p_farm_id: string
          p_ingredients: Json
          p_mode: string
          p_nb_unites: number
          p_numero_lot: string
          p_poids_total_g: number
          p_recipe_id: string
          p_temps_min: number
        }
        Returns: string
      }
      create_purchase_with_stock:
        | {
            Args: {
              p_certif_ab: boolean
              p_commentaire: string
              p_created_by: string
              p_date: string
              p_etat_plante: string
              p_farm_id: string
              p_fournisseur: string
              p_numero_lot_fournisseur: string
              p_partie_plante: string
              p_poids_g: number
              p_prix: number
              p_uuid_client: string
              p_variety_id: string
            }
            Returns: string
          }
        | {
            Args: {
              p_certif_ab: boolean
              p_commentaire: string
              p_created_by: string
              p_date: string
              p_etat_plante: string
              p_external_material_id?: string
              p_farm_id: string
              p_fournisseur: string
              p_numero_facture?: string
              p_numero_lot_fournisseur: string
              p_partie_plante: string
              p_poids_g: number
              p_prix: number
              p_uuid_client: string
              p_variety_id: string
            }
            Returns: string
          }
      create_seed_adjustment: {
        Args: {
          p_commentaire: string
          p_created_by: string
          p_date: string
          p_farm_id: string
          p_poids_constate_g: number
          p_seed_lot_id: string
          p_uuid_client: string
        }
        Returns: string
      }
      create_sorting_combined: {
        Args: {
          p_commentaire: string
          p_created_by: string
          p_date: string
          p_etat_plante_entree: string
          p_farm_id: string
          p_partie_plante: string
          p_poids_entree_g: number
          p_poids_sortie_g: number
          p_temps_min: number
          p_uuid_client_entree?: string
          p_uuid_client_sortie?: string
          p_variety_id: string
        }
        Returns: string
      }
      create_sorting_with_stock: {
        Args: {
          p_commentaire: string
          p_created_by: string
          p_date: string
          p_etat_plante: string
          p_farm_id: string
          p_partie_plante: string
          p_poids_g: number
          p_temps_min: number
          p_type: string
          p_uuid_client?: string
          p_variety_id: string
        }
        Returns: string
      }
      delete_adjustment_with_stock: {
        Args: { p_adjustment_id: string; p_farm_id: string }
        Returns: undefined
      }
      delete_conditionnement: {
        Args: { p_cond_id: string; p_farm_id: string; p_updated_by: string }
        Returns: undefined
      }
      delete_cutting_paired: {
        Args: { p_cutting_id: string }
        Returns: undefined
      }
      delete_cutting_with_stock: {
        Args: { p_cutting_id: string }
        Returns: undefined
      }
      delete_direct_sale_with_stock: {
        Args: { p_farm_id: string; p_sale_id: string }
        Returns: undefined
      }
      delete_drying_with_stock: {
        Args: { p_drying_id: string }
        Returns: undefined
      }
      delete_production_lot_with_stock: {
        Args: { p_farm_id: string; p_lot_id: string; p_updated_by: string }
        Returns: undefined
      }
      delete_purchase_with_stock: {
        Args: { p_farm_id: string; p_purchase_id: string }
        Returns: undefined
      }
      delete_seed_adjustment: {
        Args: { p_adjustment_id: string; p_farm_id: string }
        Returns: undefined
      }
      delete_sorting_paired: {
        Args: { p_sorting_id: string }
        Returns: undefined
      }
      delete_sorting_with_stock: {
        Args: { p_sorting_id: string }
        Returns: undefined
      }
      immutable_unaccent: { Args: { "": string }; Returns: string }
      recalculate_production_summary: { Args: never; Returns: string }
      restore_production_lot_with_stock:
        | {
            Args: { p_farm_id: string; p_lot_id: string; p_updated_by: string }
            Returns: undefined
          }
        | {
            Args: {
              p_farm_id: string
              p_ingredients: Json
              p_lot_id: string
              p_updated_by: string
            }
            Returns: undefined
          }
      stock_at_date: {
        Args: { p_date: string; p_farm_id: string }
        Returns: {
          etat_plante: string
          partie_plante: string
          stock_g: number
          variety_id: string
        }[]
      }
      unaccent: { Args: { "": string }; Returns: string }
      update_adjustment_with_stock: {
        Args: {
          p_adjustment_id: string
          p_commentaire: string
          p_date: string
          p_etat_plante: string
          p_motif: string
          p_partie_plante: string
          p_poids_g: number
          p_type_mouvement: string
          p_updated_by: string
          p_variety_id: string
        }
        Returns: undefined
      }
      update_cutting_combined: {
        Args: {
          p_commentaire: string
          p_date: string
          p_entree_id: string
          p_partie_plante: string
          p_poids_entree_g: number
          p_poids_sortie_g: number
          p_temps_min: number
          p_updated_by: string
          p_variety_id: string
        }
        Returns: undefined
      }
      update_cutting_with_stock: {
        Args: {
          p_commentaire: string
          p_cutting_id: string
          p_date: string
          p_partie_plante: string
          p_poids_g: number
          p_temps_min: number
          p_updated_by: string
          p_variety_id: string
        }
        Returns: undefined
      }
      update_direct_sale_with_stock: {
        Args: {
          p_commentaire: string
          p_date: string
          p_destinataire: string
          p_etat_plante: string
          p_partie_plante: string
          p_poids_g: number
          p_sale_id: string
          p_updated_by: string
          p_variety_id: string
        }
        Returns: undefined
      }
      update_drying_with_stock: {
        Args: {
          p_commentaire: string
          p_date: string
          p_drying_id: string
          p_etat_plante: string
          p_partie_plante: string
          p_poids_g: number
          p_temps_min: number
          p_updated_by: string
          p_variety_id: string
        }
        Returns: undefined
      }
      update_harvest_with_stock: {
        Args: {
          p_date: string
          p_harvest_id: string
          p_partie_plante: string
          p_poids_g: number
          p_type_cueillette: string
          p_updated_by: string
          p_variety_id: string
          p_commentaire?: string
          p_lieu_sauvage?: string
          p_row_id?: string
          p_temps_min?: number
        }
        Returns: undefined
      }
      update_production_lot_conditionner: {
        Args: {
          p_farm_id: string
          p_lot_id: string
          p_nb_unites: number
          p_updated_by: string
        }
        Returns: undefined
      }
      update_purchase_with_stock:
        | {
            Args: {
              p_certif_ab: boolean
              p_commentaire: string
              p_date: string
              p_etat_plante: string
              p_fournisseur: string
              p_numero_lot_fournisseur: string
              p_partie_plante: string
              p_poids_g: number
              p_prix: number
              p_purchase_id: string
              p_updated_by: string
              p_variety_id: string
            }
            Returns: undefined
          }
        | {
            Args: {
              p_certif_ab: boolean
              p_commentaire: string
              p_date: string
              p_etat_plante: string
              p_external_material_id?: string
              p_fournisseur: string
              p_numero_facture?: string
              p_numero_lot_fournisseur: string
              p_partie_plante: string
              p_poids_g: number
              p_prix: number
              p_purchase_id: string
              p_updated_by: string
              p_variety_id: string
            }
            Returns: undefined
          }
      update_seed_adjustment: {
        Args: {
          p_adjustment_id: string
          p_commentaire: string
          p_date: string
          p_poids_constate_g: number
          p_updated_by: string
        }
        Returns: undefined
      }
      update_sorting_combined: {
        Args: {
          p_commentaire: string
          p_date: string
          p_entree_id: string
          p_etat_plante_entree: string
          p_partie_plante: string
          p_poids_entree_g: number
          p_poids_sortie_g: number
          p_temps_min: number
          p_updated_by: string
          p_variety_id: string
        }
        Returns: undefined
      }
      update_sorting_with_stock: {
        Args: {
          p_commentaire: string
          p_date: string
          p_etat_plante: string
          p_partie_plante: string
          p_poids_g: number
          p_sorting_id: string
          p_temps_min: number
          p_updated_by: string
          p_variety_id: string
        }
        Returns: undefined
      }
      user_farm_ids: { Args: never; Returns: string[] }
    }
    Enums: {
      changelog_entry_type: "feature" | "improvement" | "fix"
      support_ticket_priority: "low" | "normal" | "urgent"
      support_ticket_status: "new" | "in_progress" | "resolved" | "closed"
      support_ticket_type: "bug" | "suggestion" | "question"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      changelog_entry_type: ["feature", "improvement", "fix"],
      support_ticket_priority: ["low", "normal", "urgent"],
      support_ticket_status: ["new", "in_progress", "resolved", "closed"],
      support_ticket_type: ["bug", "suggestion", "question"],
    },
  },
} as const
