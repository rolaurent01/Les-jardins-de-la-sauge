/**
 * Tests unitaires — générateur UUID v4.
 */
import { describe, it, expect } from 'vitest'
import { generateUUID } from '@/lib/utils/uuid'

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

describe('generateUUID', () => {
  it('retourne un string de 36 caractères (format UUID)', () => {
    const uuid = generateUUID()
    expect(uuid).toHaveLength(36)
  })

  it('format valide : 8-4-4-4-12 hex', () => {
    const uuid = generateUUID()
    expect(uuid).toMatch(UUID_V4_REGEX)
  })

  it('1000 UUIDs générés sont tous uniques', () => {
    const uuids = new Set<string>()
    for (let i = 0; i < 1000; i++) {
      uuids.add(generateUUID())
    }
    expect(uuids.size).toBe(1000)
  })

  it('pas de collision entre appels successifs', () => {
    const a = generateUUID()
    const b = generateUUID()
    expect(a).not.toBe(b)
  })
})
