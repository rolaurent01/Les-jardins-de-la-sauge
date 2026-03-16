/**
 * Tests du proxy d'authentification (src/proxy.ts)
 *
 * Couvre les scénarios critiques :
 * - Route publique /login
 * - Redirect non-authentifié → /login
 * - Redirect racine desktop / mobile
 * - Slug invalide → redirect vers org réelle
 * - Non-membre d'une org → redirect vers org réelle
 * - Route admin sans être platform_admin → redirect dashboard
 * - Route admin en tant que platform_admin → passe
 * - Cookie active_farm_id d'une autre org → auto-switch
 * - Mobile sur route desktop → redirect /m/saisie
 * - ?desktop=1 → pas de redirect mobile
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- Mocks des modules externes ---

const mockGetUser = vi.fn()
const mockAdminFrom = vi.fn()

// Mock @supabase/ssr — createServerClient retourne un client avec auth.getUser
vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: { getUser: mockGetUser },
  }),
}))

// Mock @supabase/supabase-js — createClient retourne le client admin
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => {
    const fromFn = (table: string) => {
      const result = mockAdminFrom(table)
      return result
    }
    return { from: fromFn }
  },
}))

// Mock next/server — NextRequest et NextResponse simplifiés
const mockCookies = new Map<string, string>()
const mockResponseCookies: Array<{ name: string; value: string; options?: Record<string, unknown> }> = []

vi.mock('next/server', () => {
  class FakeNextRequest {
    nextUrl: { pathname: string; searchParams: URLSearchParams }
    url: string
    headers: Map<string, string>
    cookies: {
      getAll: () => Array<{ name: string; value: string }>
      get: (name: string) => { value: string } | undefined
      set: (name: string, value: string) => void
    }

    constructor(url: string, options?: { headers?: Record<string, string> }) {
      const parsed = new URL(url)
      this.nextUrl = { pathname: parsed.pathname, searchParams: parsed.searchParams }
      this.url = url
      this.headers = new Map(Object.entries(options?.headers ?? {}))

      this.cookies = {
        getAll: () => Array.from(mockCookies.entries()).map(([name, value]) => ({ name, value })),
        get: (name: string) => {
          const val = mockCookies.get(name)
          return val !== undefined ? { value: val } : undefined
        },
        set: (name: string, value: string) => { mockCookies.set(name, value) },
      }
    }
  }

  const FakeNextResponse = {
    next: ({ request }: { request: unknown }) => ({
      _type: 'next',
      _request: request,
      cookies: {
        getAll: () => [...mockResponseCookies],
        set: (name: string, value: string, options?: Record<string, unknown>) => {
          mockResponseCookies.push({ name, value, options })
        },
      },
    }),
    redirect: (url: URL) => ({
      _type: 'redirect',
      _url: url.toString(),
      cookies: {
        getAll: () => [...mockResponseCookies],
        set: (name: string, value: string, options?: Record<string, unknown>) => {
          mockResponseCookies.push({ name, value, options })
        },
      },
    }),
  }

  return {
    NextResponse: FakeNextResponse,
    NextRequest: FakeNextRequest,
  }
})

// Import après les mocks
import { proxy } from '@/proxy'
import { NextRequest } from 'next/server'

// --- Helpers ---

const USER_ID = 'user-111'
const ORG_ID = 'org-222'
const ORG_SLUG = 'ljs'
const FARM_ID = 'farm-333'
const FARM_ID_OTHER = 'farm-999'

function makeRequest(path: string, options?: { userAgent?: string; cookies?: Record<string, string>; searchParams?: Record<string, string> }) {
  mockCookies.clear()
  mockResponseCookies.length = 0

  if (options?.cookies) {
    for (const [k, v] of Object.entries(options.cookies)) {
      mockCookies.set(k, v)
    }
  }

  let url = `http://localhost:3000${path}`
  if (options?.searchParams) {
    const params = new URLSearchParams(options.searchParams)
    url += `?${params.toString()}`
  }

  const headers: Record<string, string> = {}
  if (options?.userAgent) headers['user-agent'] = options.userAgent

  return new NextRequest(url, { headers })
}

/** Configure le mock admin.from() pour répondre à des requêtes chaînées */
function setupAdminMock(responses: Record<string, unknown>) {
  mockAdminFrom.mockImplementation((table: string) => {
    const response = responses[table]

    // Chaîne fluide : .select().eq().eq().single() etc.
    const chain: Record<string, unknown> = {}
    const self = () => chain
    chain.select = self
    chain.eq = self
    chain.in = self
    chain.gte = self
    chain.lt = self
    chain.is = self
    chain.order = self
    chain.limit = self
    chain.single = () => Promise.resolve({ data: response ?? null, error: null })

    return chain
  })
}

const DESKTOP_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
const MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15'

// --- Tests ---

describe('proxy', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCookies.clear()
    mockResponseCookies.length = 0

    // Env vars
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key'
  })

  it('devrait laisser passer /login sans vérification', async () => {
    const req = makeRequest('/login')
    const res = await proxy(req)
    expect((res as { _type: string })._type).toBe('next')
  })

  it('devrait rediriger vers /login si non authentifié', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const req = makeRequest('/ljs/dashboard', { userAgent: DESKTOP_UA })
    const res = await proxy(req)
    expect((res as { _type: string })._type).toBe('redirect')
    expect((res as { _url: string })._url).toContain('/login')
  })

  it('devrait rediriger / vers /{orgSlug}/dashboard sur desktop', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } })
    setupAdminMock({
      memberships: { organizations: { slug: ORG_SLUG, farms: [{ id: FARM_ID }] } },
    })

    const req = makeRequest('/', { userAgent: DESKTOP_UA, cookies: { active_farm_id: FARM_ID } })
    const res = await proxy(req)
    expect((res as { _type: string })._type).toBe('redirect')
    expect((res as { _url: string })._url).toContain(`/${ORG_SLUG}/dashboard`)
  })

  it('devrait rediriger / vers /{orgSlug}/m/saisie sur mobile', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } })
    setupAdminMock({
      memberships: { organizations: { slug: ORG_SLUG, farms: [{ id: FARM_ID }] } },
    })

    const req = makeRequest('/', { userAgent: MOBILE_UA, cookies: { active_farm_id: FARM_ID } })
    const res = await proxy(req)
    expect((res as { _type: string })._type).toBe('redirect')
    expect((res as { _url: string })._url).toContain(`/${ORG_SLUG}/m/saisie`)
  })

  it('devrait rediriger vers la vraie org si slug invalide', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } })
    setupAdminMock({
      organizations: null, // slug inconnu
      memberships: { organizations: { slug: ORG_SLUG, farms: [{ id: FARM_ID }] } },
    })

    const req = makeRequest('/fake-org/dashboard', { userAgent: DESKTOP_UA, cookies: { active_farm_id: FARM_ID } })
    const res = await proxy(req)
    expect((res as { _type: string })._type).toBe('redirect')
    expect((res as { _url: string })._url).toContain(`/${ORG_SLUG}/dashboard`)
  })

  it('devrait rediriger vers la vraie org si non-membre', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } })

    // Premier appel : org existe. Deuxième appel : pas de membership. Troisième : resolve slug.
    let callCount = 0
    mockAdminFrom.mockImplementation((table: string) => {
      const chain: Record<string, unknown> = {}
      const self = () => chain
      chain.select = self; chain.eq = self; chain.order = self; chain.limit = self

      chain.single = () => {
        callCount++
        if (table === 'organizations' && callCount === 1) {
          return Promise.resolve({ data: { id: ORG_ID }, error: null })
        }
        if (table === 'memberships' && callCount === 2) {
          return Promise.resolve({ data: null, error: null }) // pas membre
        }
        if (table === 'memberships' && callCount === 3) {
          return Promise.resolve({ data: { organizations: { slug: 'my-org' } }, error: null })
        }
        return Promise.resolve({ data: null, error: null })
      }
      return chain
    })

    const req = makeRequest('/other-org/dashboard', { userAgent: DESKTOP_UA, cookies: { active_farm_id: FARM_ID } })
    const res = await proxy(req)
    expect((res as { _type: string })._type).toBe('redirect')
    expect((res as { _url: string })._url).toContain('/my-org/dashboard')
  })

  it('devrait rediriger vers dashboard si route admin sans être platform_admin', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } })

    let callCount = 0
    mockAdminFrom.mockImplementation((table: string) => {
      const chain: Record<string, unknown> = {}
      const self = () => chain
      chain.select = self; chain.eq = self; chain.order = self; chain.limit = self

      chain.single = () => {
        callCount++
        if (table === 'organizations') return Promise.resolve({ data: { id: ORG_ID }, error: null })
        if (table === 'memberships') return Promise.resolve({ data: { id: 'mem-1' }, error: null })
        if (table === 'farms') return Promise.resolve({ data: { organization_id: ORG_ID }, error: null })
        if (table === 'platform_admins') return Promise.resolve({ data: null, error: null }) // pas admin
        return Promise.resolve({ data: null, error: null })
      }
      return chain
    })

    const req = makeRequest(`/${ORG_SLUG}/admin/outils`, { userAgent: DESKTOP_UA, cookies: { active_farm_id: FARM_ID } })
    const res = await proxy(req)
    expect((res as { _type: string })._type).toBe('redirect')
    expect((res as { _url: string })._url).toContain(`/${ORG_SLUG}/dashboard`)
  })

  it('devrait laisser passer la route admin si platform_admin', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } })

    mockAdminFrom.mockImplementation((table: string) => {
      const chain: Record<string, unknown> = {}
      const self = () => chain
      chain.select = self; chain.eq = self; chain.order = self; chain.limit = self

      chain.single = () => {
        if (table === 'organizations') return Promise.resolve({ data: { id: ORG_ID }, error: null })
        if (table === 'memberships') return Promise.resolve({ data: { id: 'mem-1' }, error: null })
        if (table === 'farms') return Promise.resolve({ data: { organization_id: ORG_ID }, error: null })
        if (table === 'platform_admins') return Promise.resolve({ data: { user_id: USER_ID }, error: null })
        return Promise.resolve({ data: null, error: null })
      }
      return chain
    })

    const req = makeRequest(`/${ORG_SLUG}/admin/outils`, { userAgent: DESKTOP_UA, cookies: { active_farm_id: FARM_ID } })
    const res = await proxy(req)
    expect((res as { _type: string })._type).toBe('next')
  })

  it('devrait auto-switch active_farm_id si cookie pointe vers une autre org', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } })

    mockAdminFrom.mockImplementation((table: string) => {
      const chain: Record<string, unknown> = {}
      const self = () => chain
      chain.select = self; chain.eq = self; chain.order = self; chain.limit = self

      chain.single = () => {
        if (table === 'organizations') return Promise.resolve({ data: { id: ORG_ID }, error: null })
        if (table === 'memberships') return Promise.resolve({ data: { id: 'mem-1' }, error: null })
        if (table === 'farms') return Promise.resolve({ data: { organization_id: 'other-org-id' }, error: null }) // autre org !
        if (table === 'platform_admins') return Promise.resolve({ data: null, error: null })
        return Promise.resolve({ data: null, error: null })
      }

      // Pour farms.select().eq().order().limit() → pas de .single(), retourne un tableau
      chain.limit = () => Promise.resolve({ data: [{ id: FARM_ID }], error: null })

      return chain
    })

    const req = makeRequest(`/${ORG_SLUG}/dashboard`, { userAgent: DESKTOP_UA, cookies: { active_farm_id: FARM_ID_OTHER } })
    const res = await proxy(req)

    // Vérifie que le cookie a été mis à jour
    const farmCookie = mockResponseCookies.find(c => c.name === 'active_farm_id')
    expect(farmCookie).toBeDefined()
    expect(farmCookie!.value).toBe(FARM_ID)
  })

  it('devrait rediriger mobile vers /m/saisie sur route desktop', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } })

    mockAdminFrom.mockImplementation((table: string) => {
      const chain: Record<string, unknown> = {}
      const self = () => chain
      chain.select = self; chain.eq = self; chain.order = self; chain.limit = self

      chain.single = () => {
        if (table === 'organizations') return Promise.resolve({ data: { id: ORG_ID }, error: null })
        if (table === 'memberships') return Promise.resolve({ data: { id: 'mem-1' }, error: null })
        if (table === 'farms') return Promise.resolve({ data: { organization_id: ORG_ID }, error: null })
        return Promise.resolve({ data: null, error: null })
      }
      return chain
    })

    const req = makeRequest(`/${ORG_SLUG}/dashboard`, { userAgent: MOBILE_UA, cookies: { active_farm_id: FARM_ID } })
    const res = await proxy(req)
    expect((res as { _type: string })._type).toBe('redirect')
    expect((res as { _url: string })._url).toContain(`/${ORG_SLUG}/m/saisie`)
  })

  it('devrait ne PAS rediriger mobile si ?desktop=1', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } })

    mockAdminFrom.mockImplementation((table: string) => {
      const chain: Record<string, unknown> = {}
      const self = () => chain
      chain.select = self; chain.eq = self; chain.order = self; chain.limit = self

      chain.single = () => {
        if (table === 'organizations') return Promise.resolve({ data: { id: ORG_ID }, error: null })
        if (table === 'memberships') return Promise.resolve({ data: { id: 'mem-1' }, error: null })
        if (table === 'farms') return Promise.resolve({ data: { organization_id: ORG_ID }, error: null })
        return Promise.resolve({ data: null, error: null })
      }
      return chain
    })

    const req = makeRequest(`/${ORG_SLUG}/dashboard`, {
      userAgent: MOBILE_UA,
      cookies: { active_farm_id: FARM_ID },
      searchParams: { desktop: '1' },
    })
    const res = await proxy(req)
    expect((res as { _type: string })._type).toBe('next')
  })
})
