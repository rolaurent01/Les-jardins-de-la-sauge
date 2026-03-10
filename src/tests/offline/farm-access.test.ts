/**
 * Tests unitaires — farm-access.ts
 * Vérification d'accès ferme via memberships.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock du module supabase/server AVANT l'import de farm-access
const mockFrom = vi.fn()
const mockAdminClient = { from: mockFrom }

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => mockAdminClient,
}))

import { userHasFarmAccess } from '@/lib/sync/farm-access'

const USER_ID = '00000000-0000-4000-a000-000000000010'
const FARM_ID = '00000000-0000-4000-a000-000000000020'
const ORG_ID = '00000000-0000-4000-a000-000000000030'

/** Helper pour configurer les réponses mock Supabase */
function mockSupabaseResponses(farmData: unknown, membershipData: unknown) {
  // Chainage Supabase : from().select().eq().eq().single()
  mockFrom.mockImplementation((table: string) => {
    if (table === 'farms') {
      return {
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: farmData, error: null }),
          }),
        }),
      }
    }
    if (table === 'memberships') {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: membershipData, error: null }),
            }),
          }),
        }),
      }
    }
    return { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null }) }) }) }
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('userHasFarmAccess', () => {
  it('utilisateur avec membership sur l\'org propriétaire → true', async () => {
    mockSupabaseResponses(
      { id: FARM_ID, organization_id: ORG_ID },
      { id: 'membership-1' },
    )
    const result = await userHasFarmAccess(USER_ID, FARM_ID)
    expect(result).toBe(true)
  })

  it('utilisateur sans membership → false', async () => {
    mockSupabaseResponses(
      { id: FARM_ID, organization_id: ORG_ID },
      null,
    )
    const result = await userHasFarmAccess(USER_ID, FARM_ID)
    expect(result).toBe(false)
  })

  it('farm_id inexistant → false', async () => {
    mockSupabaseResponses(null, null)
    const result = await userHasFarmAccess(USER_ID, 'inexistant')
    expect(result).toBe(false)
  })
})
