import { z } from 'zod'

/** Tables reelles autorisees pour la synchronisation mobile */
export const SYNC_TABLES = [
  'seed_lots',
  'seedlings',
  'soil_works',
  'plantings',
  'row_care',
  'harvests',
  'uprootings',
  'occultations',
  'cuttings',
  'dryings',
  'sortings',
  'stock_purchases',
  'stock_direct_sales',
  'stock_adjustments',
  'production_lots',
] as const

/** Cibles virtuelles (pas de table reelle — dispatch via RPC combinee) */
export const SYNC_VIRTUAL_TABLES = [
  'cuttings_combined',
  'sortings_combined',
] as const

/** Toutes les cibles autorisees pour POST /api/sync */
export const ALL_SYNC_TARGETS = [...SYNC_TABLES, ...SYNC_VIRTUAL_TABLES] as const

export type SyncTable = (typeof ALL_SYNC_TARGETS)[number]

/**
 * Format UUID souple (8-4-4-4-12 hex) sans vérification de version/variant.
 * Nécessaire car les IDs bootstrappés (migration 011) ne sont pas RFC 4122 v4
 * et z.string().uuid() strict les rejette.
 */
const uuidFormat = z.string().regex(
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  'Doit être au format UUID',
)

/** Schéma de validation pour POST /api/sync */
export const syncRequestSchema = z.object({
  uuid_client: uuidFormat,
  table_cible: z.enum(ALL_SYNC_TARGETS, {
    message: `table_cible invalide. Tables autorisées : ${ALL_SYNC_TARGETS.join(', ')}`,
  }),
  farm_id: uuidFormat,
  payload: z
    .record(z.string(), z.unknown())
    .refine((obj) => Object.keys(obj).length > 0, {
      message: 'Le payload ne peut pas être vide',
    }),
})

export type SyncRequest = z.infer<typeof syncRequestSchema>

/** Schéma de validation pour POST /api/sync/audit */
export const auditRequestSchema = z.object({
  uuid_clients: z
    .array(uuidFormat)
    .min(1, 'Au moins 1 uuid_client requis')
    .max(200, 'Maximum 200 UUID par requête, utilisez la pagination'),
  farm_id: uuidFormat,
})

export type AuditRequest = z.infer<typeof auditRequestSchema>
