import { z } from 'zod'

/** Tables autorisées pour la synchronisation mobile */
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

export type SyncTable = (typeof SYNC_TABLES)[number]

/** Schéma de validation pour POST /api/sync */
export const syncRequestSchema = z.object({
  uuid_client: z.string().uuid('uuid_client doit être un UUID v4 valide'),
  table_cible: z.enum(SYNC_TABLES, {
    message: `table_cible invalide. Tables autorisées : ${SYNC_TABLES.join(', ')}`,
  }),
  farm_id: z.string().uuid('farm_id doit être un UUID valide'),
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
    .array(z.string().uuid('Chaque uuid_client doit être un UUID valide'))
    .min(1, 'Au moins 1 uuid_client requis')
    .max(200, 'Maximum 200 UUID par requête, utilisez la pagination'),
  farm_id: z.string().uuid('farm_id doit être un UUID valide'),
})

export type AuditRequest = z.infer<typeof auditRequestSchema>
