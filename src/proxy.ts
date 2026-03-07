import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/lib/supabase/types'

/**
 * Proxy d'authentification + résolution du slug d'organisation (Next.js 16).
 *
 * Logique :
 * 1. Page /login → publique (passe-travers)
 * 2. Vérifie l'authentification Supabase
 * 3. / (racine) → redirect vers /{orgSlug}/dashboard
 * 4. /{slug}/... → vérifie que le slug existe et que l'utilisateur est membre
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })
  const { pathname } = request.nextUrl

  // Page de login — publique
  if (pathname === '/login') {
    return response
  }

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT : getUser() peut rafraîchir le token et appeler setAll.
  // Tous les redirects doivent préserver les cookies de `response`.
  const { data: { user } } = await supabase.auth.getUser()

  /** Crée un redirect qui préserve les cookies écrits par setAll (token refresh) */
  function redirectTo(url: URL) {
    const redirectResponse = NextResponse.redirect(url)
    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value)
    })
    return redirectResponse
  }

  if (!user) {
    return redirectTo(new URL('/login', request.url))
  }

  // Initialiser le cookie active_farm_id si absent
  if (!request.cookies.get('active_farm_id')?.value) {
    const farmId = await resolveFirstFarmId(supabase, user.id)
    if (farmId) {
      response.cookies.set('active_farm_id', farmId, {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 365 * 24 * 60 * 60, // 1 an
      })
    }
  }

  // Redirection de la racine vers la première organisation de l'utilisateur
  if (pathname === '/') {
    const orgSlug = await resolveFirstOrgSlug(supabase, user.id)
    if (!orgSlug) return redirectTo(new URL('/login', request.url))
    return redirectTo(new URL(`/${orgSlug}/dashboard`, request.url))
  }

  // Vérification du slug d'organisation dans le path
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length > 0) {
    const potentialSlug = segments[0]

    const { data: org } = await supabase
      .from('organizations')
      .select('id')
      .eq('slug', potentialSlug)
      .single()

    if (!org) {
      const orgSlug = await resolveFirstOrgSlug(supabase, user.id)
      if (!orgSlug) return redirectTo(new URL('/login', request.url))
      return redirectTo(new URL(`/${orgSlug}/dashboard`, request.url))
    }

    // Vérifier l'appartenance à cette organisation
    const { data: membership } = await supabase
      .from('memberships')
      .select('id')
      .eq('organization_id', org.id)
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      const orgSlug = await resolveFirstOrgSlug(supabase, user.id)
      if (!orgSlug) return redirectTo(new URL('/login', request.url))
      return redirectTo(new URL(`/${orgSlug}/dashboard`, request.url))
    }
  }

  return response
}

/** Résout le slug de la première organisation accessible à l'utilisateur */
async function resolveFirstOrgSlug(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string
): Promise<string | null> {
  const { data } = await supabase
    .from('memberships')
    .select('organizations(slug)')
    .eq('user_id', userId)
    .limit(1)
    .single()

  return (data?.organizations as { slug: string } | null)?.slug ?? null
}

/** Résout l'id de la première ferme accessible à l'utilisateur */
async function resolveFirstFarmId(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string
): Promise<string | null> {
  const { data } = await supabase
    .from('memberships')
    .select('organizations(farms(id))')
    .eq('user_id', userId)
    .limit(1)
    .single()

  const org = data?.organizations as { farms: { id: string }[] } | null
  return org?.farms?.[0]?.id ?? null
}

export const config = {
  // Exclure les assets statiques, les routes API internes et les fichiers PWA
  matcher: [
    '/((?!api|_next/static|_next/image|favicon\\.ico|manifest\\.json|icons|.*\\.png|.*\\.ico|.*\\.svg).*)',
  ],
}
