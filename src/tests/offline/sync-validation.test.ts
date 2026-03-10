/**
 * Tests unitaires — validation des payloads sync (Zod).
 */
import { describe, it, expect } from 'vitest'
import { syncRequestSchema, auditRequestSchema, SYNC_TABLES } from '@/lib/validation/sync'

// ─────────────────────────────────────────────────────────────
// syncRequestSchema
// ─────────────────────────────────────────────────────────────

describe('syncRequestSchema', () => {
  const VALID_UUID = '00000000-0000-4000-a000-000000000001'

  const validPayload = {
    uuid_client: VALID_UUID,
    table_cible: 'harvests' as const,
    farm_id: VALID_UUID,
    payload: { poids_g: 500 },
  }

  it('payload valide → passe', () => {
    const result = syncRequestSchema.safeParse(validPayload)
    expect(result.success).toBe(true)
  })

  it('uuid_client invalide (pas UUID) → erreur', () => {
    const result = syncRequestSchema.safeParse({ ...validPayload, uuid_client: 'pas-un-uuid' })
    expect(result.success).toBe(false)
  })

  it('table_cible inconnue → erreur', () => {
    const result = syncRequestSchema.safeParse({ ...validPayload, table_cible: 'table_inexistante' })
    expect(result.success).toBe(false)
  })

  it('farm_id manquant → erreur', () => {
    const { farm_id: _, ...noFarmId } = validPayload
    const result = syncRequestSchema.safeParse(noFarmId)
    expect(result.success).toBe(false)
  })

  it('payload vide ({}) → erreur', () => {
    const result = syncRequestSchema.safeParse({ ...validPayload, payload: {} })
    expect(result.success).toBe(false)
  })

  it('table_cible valide pour chacune des 15 tables → passe', () => {
    for (const table of SYNC_TABLES) {
      const result = syncRequestSchema.safeParse({ ...validPayload, table_cible: table })
      expect(result.success, `Table ${table} devrait être valide`).toBe(true)
    }
    expect(SYNC_TABLES).toHaveLength(15)
  })
})

// ─────────────────────────────────────────────────────────────
// auditRequestSchema
// ─────────────────────────────────────────────────────────────

describe('auditRequestSchema', () => {
  const VALID_UUID = '00000000-0000-4000-a000-000000000001'

  it('liste de 1 UUID → passe', () => {
    const result = auditRequestSchema.safeParse({
      uuid_clients: [VALID_UUID],
      farm_id: VALID_UUID,
    })
    expect(result.success).toBe(true)
  })

  it('liste de 200 UUIDs → passe', () => {
    const uuids = Array.from({ length: 200 }, () => crypto.randomUUID())
    const result = auditRequestSchema.safeParse({
      uuid_clients: uuids,
      farm_id: VALID_UUID,
    })
    expect(result.success).toBe(true)
  })

  it('liste de 201 UUIDs → erreur (max 200)', () => {
    const uuids = Array.from({ length: 201 }, () => crypto.randomUUID())
    const result = auditRequestSchema.safeParse({
      uuid_clients: uuids,
      farm_id: VALID_UUID,
    })
    expect(result.success).toBe(false)
  })

  it('liste vide → erreur', () => {
    const result = auditRequestSchema.safeParse({
      uuid_clients: [],
      farm_id: VALID_UUID,
    })
    expect(result.success).toBe(false)
  })

  it('UUID invalide dans la liste → erreur', () => {
    const result = auditRequestSchema.safeParse({
      uuid_clients: [VALID_UUID, 'pas-un-uuid'],
      farm_id: VALID_UUID,
    })
    expect(result.success).toBe(false)
  })
})
